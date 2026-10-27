import { Router } from 'express';
import { z } from 'zod';
import type { Conversation, ConversationMember, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, forbidden, notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { notify } from '../notifications/notifications.service';
import { MANAGER_ROLES, chatBlockedReason, isManagerRole, linkingJobs, pairKey } from './chat.service';

/** Messaging between technicians, customers and the office. The app polls; there is no socket to keep open. */
export const chatRouter = Router();

type Me = { id: string; role: Role; name: string };
type ConvWithMembers = Conversation & { members: (ConversationMember & { user: { id: string; name: string; role: Role; phone: string | null; customerAccount: string | null } })[] };

const memberUser = { select: { id: true, name: true, role: true, phone: true, customerAccount: true } } as const;

async function loadConversation(id: string) {
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { members: { include: { user: memberUser } } } });
  if (!conv) throw notFound('Conversation');
  return conv as ConvWithMembers;
}

/** Members can read; on a support conversation every supervisor and admin can too. */
function assertAccess(conv: ConvWithMembers, user: Me) {
  if (conv.members.some((m) => m.userId === user.id)) return;
  if (conv.kind === 'SUPPORT' && isManagerRole(user.role)) return;
  throw forbidden('You are not part of this conversation');
}

/** How the conversation is named for this viewer. */
function describe(conv: ConvWithMembers, user: Me) {
  if (conv.kind === 'SUPPORT') {
    const customer = conv.members.find((m) => m.user.role === 'CUSTOMER')?.user;
    if (user.role === 'CUSTOMER') return { title: 'Optimas support', subtitle: 'The Optimas office', role: 'SUPPORT' as const, other: null };
    return { title: customer?.name ?? 'Customer', subtitle: `Customer${customer?.customerAccount ? ` · ${customer.customerAccount}` : ''}`, role: 'CUSTOMER' as const, other: customer ?? null };
  }
  const other = conv.members.find((m) => m.userId !== user.id)?.user;
  const label: Record<Role, string> = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', STOREKEEPER: 'Store', TECHNICIAN: 'Technician', CUSTOMER: 'Customer' };
  return { title: other?.name ?? 'Conversation', subtitle: other ? `${label[other.role]}${other.role === 'CUSTOMER' && other.customerAccount ? ` · ${other.customerAccount}` : ''}` : '', role: other?.role ?? null, other: other ?? null };
}

async function unreadIn(conv: ConvWithMembers, user: Me) {
  const mine = conv.members.find((m) => m.userId === user.id);
  return prisma.message.count({ where: { conversationId: conv.id, senderId: { not: user.id }, createdAt: mine?.lastReadAt ? { gt: mine.lastReadAt } : undefined } });
}

async function myConversations(user: Me) {
  return (await prisma.conversation.findMany({
    where: isManagerRole(user.role) ? { OR: [{ members: { some: { userId: user.id } } }, { kind: 'SUPPORT' }] } : { members: { some: { userId: user.id } } },
    include: { members: { include: { user: memberUser } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { lastMessageAt: 'desc' },
    take: 60,
  })) as (ConvWithMembers & { messages: { body: string; createdAt: Date; senderId: string }[] })[];
}

chatRouter.get(
  '/conversations',
  ah(async (req, res) => {
    const user = me(req);
    const convs = await myConversations(user);
    const rows = await Promise.all(
      convs
        // Conversations nobody has written in yet stay out of the list
        .filter((c) => c.messages.length)
        .map(async (c) => {
          const d = describe(c, user);
          const last = c.messages[0];
          return { id: c.id, kind: c.kind, title: d.title, subtitle: d.subtitle, role: d.role, lastMessage: { body: last.body, at: last.createdAt, mine: last.senderId === user.id }, unread: await unreadIn(c, user) };
        }),
    );
    res.json({ conversations: rows });
  }),
);

/** Number of conversations with something new (for the tab badge). */
chatRouter.get(
  '/unread',
  ah(async (req, res) => {
    const user = me(req);
    const convs = await myConversations(user);
    const counts = await Promise.all(convs.filter((c) => c.messages.length && c.messages[0].senderId !== user.id).map((c) => unreadIn(c, user)));
    res.json({ unread: counts.filter((n) => n > 0).length });
  }),
);

/** People this user may start a conversation with. */
chatRouter.get(
  '/contacts',
  ah(async (req, res) => {
    const user = me(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const search = q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { staffNo: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }] } : {};
    const select = { id: true, name: true, role: true, phone: true, customerAccount: true } as const;
    type Contact = { id: string; name: string; role: Role; phone: string | null; customerAccount: string | null; reason?: string };
    let contacts: Contact[] = [];
    if (user.role === 'CUSTOMER') {
      // Technicians on my open or recent visits
      const self = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { customerAccount: true } });
      const jobs = await prisma.task.findMany({
        where: {
          OR: [{ customerAccount: self.customerAccount ?? '__none__' }, { request: { customerId: user.id } }],
          AND: [{ OR: [{ status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }, { endedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) } }] }],
          assignee: { active: true },
        },
        select: { title: true, assignee: { select } },
        orderBy: { createdAt: 'desc' },
      });
      const seen = new Set<string>();
      for (const j of jobs) if (!seen.has(j.assignee.id)) (seen.add(j.assignee.id), contacts.push({ ...j.assignee, reason: `Your technician · ${j.title}` }));
      res.json({ support: true, contacts });
      return;
    }
    const staffRoles: Role[] = ['ADMIN', 'SUPERVISOR', 'STOREKEEPER', 'TECHNICIAN'];
    const staff = await prisma.user.findMany({ where: { active: true, role: { in: staffRoles }, id: { not: user.id }, ...search }, select, orderBy: { name: 'asc' }, take: 50 });
    contacts = staff;
    if (isManagerRole(user.role) && q) {
      contacts = contacts.concat(await prisma.user.findMany({ where: { active: true, role: 'CUSTOMER', OR: [...search.OR!, { customerAccount: { contains: q, mode: 'insensitive' } }] }, select, take: 20 }));
    }
    if (user.role === 'TECHNICIAN') {
      // Customers of my open or recent jobs
      const jobs = await prisma.task.findMany({
        where: { assigneeId: user.id, OR: [{ status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }, { endedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60_000) } }] },
        select: { title: true, customerAccount: true, request: { select: { customerId: true } } },
      });
      const accounts = [...new Set(jobs.map((j) => j.customerAccount).filter((a): a is string => !!a))];
      const ids = [...new Set(jobs.map((j) => j.request?.customerId).filter((a): a is string => !!a))];
      const customers = await prisma.user.findMany({ where: { active: true, role: 'CUSTOMER', OR: [{ customerAccount: { in: accounts } }, { id: { in: ids } }], ...(q ? search : {}) }, select });
      contacts = customers.map((c): Contact => ({ ...c, reason: `Customer · ${jobs.find((j) => j.customerAccount === c.customerAccount || j.request?.customerId === c.id)?.title ?? 'your job'}` })).concat(contacts);
    }
    res.json({ support: false, contacts });
  }),
);

const openSchema = z.union([
  z.object({ userId: z.string().min(1) }),
  z.object({ support: z.literal(true) }),
  z.object({ customerId: z.string().min(1) }),
  /** The customer (or the technician) of a job. */
  z.object({ taskId: z.string().min(1), with: z.enum(['customer', 'technician']) }),
]);

/** The person on the other side of a job: its technician, or the customer's app account. */
async function personOnJob(taskId: string, side: 'customer' | 'technician') {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { assigneeId: true, customerAccount: true, request: { select: { customerId: true } } } });
  if (!task) throw notFound('Job');
  if (side === 'technician') return task.assigneeId;
  const customer = task.request
    ? { id: task.request.customerId }
    : task.customerAccount
      ? await prisma.user.findFirst({ where: { role: 'CUSTOMER', active: true, customerAccount: task.customerAccount }, select: { id: true } })
      : null;
  if (!customer) throw notFound('An app account for this customer');
  return customer.id;
}

/** Find or start a conversation: with a person, or the customer's support line (customers; managers by customerId). */
chatRouter.post(
  '/conversations',
  ah(async (req, res) => {
    const user = me(req);
    const body = parse(openSchema, req.body);
    let conv: Conversation;
    if ('support' in body || 'customerId' in body) {
      const customerId = 'support' in body ? user.id : body.customerId;
      if ('support' in body && user.role !== 'CUSTOMER') throw badRequest('Only customers have a support line');
      if ('customerId' in body && !isManagerRole(user.role)) throw forbidden();
      const customer = await prisma.user.findUnique({ where: { id: customerId } });
      if (!customer || customer.role !== 'CUSTOMER') throw notFound('Customer');
      conv = await prisma.conversation.upsert({
        where: { customerId },
        update: {},
        create: { kind: 'SUPPORT', customerId, members: { create: [{ userId: customerId }] } },
      });
    } else {
      const otherId = 'taskId' in body ? await personOnJob(body.taskId, body.with) : body.userId;
      const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true, role: true, active: true } });
      if (!other) throw notFound('Person');
      const blocked = await chatBlockedReason(user, other);
      if (blocked) throw forbidden(blocked);
      conv = await prisma.conversation.upsert({
        where: { pairKey: pairKey(user.id, other.id) },
        update: {},
        create: { kind: 'DIRECT', pairKey: pairKey(user.id, other.id), members: { create: [{ userId: user.id }, { userId: other.id }] } },
      });
    }
    res.status(201).json({ conversation: { id: conv.id } });
  }),
);

/** Messages (newest 100, or only those after `after`), and marks the conversation read for this person. */
chatRouter.get(
  '/conversations/:id',
  ah(async (req, res) => {
    const user = me(req);
    const conv = await loadConversation(req.params.id);
    assertAccess(conv, user);
    const after = typeof req.query.after === 'string' && !Number.isNaN(Date.parse(req.query.after)) ? new Date(req.query.after) : null;
    const messages = after
      ? await prisma.message.findMany({ where: { conversationId: conv.id, createdAt: { gt: after } }, orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true, role: true } } } })
      : (await prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { sender: { select: { id: true, name: true, role: true } } } })).reverse();
    // Reading marks it read (a manager reading a support line joins it for their own read marker)
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId: user.id } },
      update: { lastReadAt: new Date() },
      create: { conversationId: conv.id, userId: user.id, lastReadAt: new Date() },
    });
    const d = describe(conv, user);
    // When the other side is my customer/technician, mention the job that connects us
    let context: { id: string; code: string; title: string; status: string }[] = [];
    if (d.other && user.role === 'TECHNICIAN' && d.other.role === 'CUSTOMER') context = await linkingJobs(user.id, d.other.id);
    if (d.other && user.role === 'CUSTOMER' && d.other.role === 'TECHNICIAN') context = await linkingJobs(d.other.id, user.id);
    res.json({
      conversation: { id: conv.id, kind: conv.kind, title: d.title, subtitle: d.subtitle, role: d.role, phone: user.role === 'CUSTOMER' && conv.kind === 'SUPPORT' ? null : (d.other?.phone ?? null), otherId: d.other?.id ?? null, jobs: context },
      messages: messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === user.id, sender: { id: m.sender.id, name: m.sender.name, role: m.sender.role } })),
    });
  }),
);

chatRouter.post(
  '/conversations/:id/messages',
  ah(async (req, res) => {
    const user = me(req);
    const { body } = parse(z.object({ body: z.string().trim().min(1, 'Type a message').max(2000, 'Keep messages under 2000 characters') }), req.body);
    const conv = await loadConversation(req.params.id);
    assertAccess(conv, user);
    // The right to talk can lapse (e.g. two weeks after a visit): check again on every message
    if (conv.kind === 'DIRECT') {
      const other = conv.members.find((m) => m.userId !== user.id)!.user;
      const otherActive = await prisma.user.findUnique({ where: { id: other.id }, select: { active: true } });
      const blocked = await chatBlockedReason(user, { id: other.id, role: other.role, active: otherActive?.active });
      if (blocked) throw forbidden(blocked);
    }
    const now = new Date();
    const [message] = await prisma.$transaction([
      prisma.message.create({ data: { conversationId: conv.id, senderId: user.id, body, createdAt: now } }),
      prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } }),
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId: user.id } },
        update: { lastReadAt: now },
        create: { conversationId: conv.id, userId: user.id, lastReadAt: now },
      }),
    ]);
    // Who gets the buzz: the other person; on a support line the customer or the whole office
    let to = conv.members.map((m) => m.userId).filter((id) => id !== user.id);
    if (conv.kind === 'SUPPORT') {
      if (user.role === 'CUSTOMER') {
        const office = await prisma.user.findMany({ where: { role: { in: MANAGER_ROLES }, active: true }, select: { id: true } });
        to = office.map((u) => u.id);
      } else to = conv.customerId ? [conv.customerId] : [];
    }
    const title = conv.kind === 'SUPPORT' && user.role !== 'CUSTOMER' ? 'Optimas support' : user.name;
    void notify(to, { type: 'CHAT_MESSAGE', title, body: body.length > 140 ? `${body.slice(0, 137)}…` : body, data: { conversationId: conv.id } }, { inbox: false });
    res.status(201).json({ message: { id: message.id, body: message.body, createdAt: message.createdAt, mine: true, sender: { id: user.id, name: user.name, role: user.role } } });
  }),
);
