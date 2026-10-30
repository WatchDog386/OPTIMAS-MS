import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma, Role, type User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error';
import { passwordSchema, temporaryPassword } from '../../lib/password';
import { ah } from '../../middleware/async';
import { ROLES, requireRole, forgetUser } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { workDateOf } from '../../lib/time';

export const usersRouter = Router();

export const publicUser = (u: User) => ({
  id: u.id,
  staffNo: u.staffNo,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  region: u.region,
  customerAccount: u.customerAccount,
  address: u.address,
  active: u.active,
  mustChangePassword: u.mustChangePassword,
  locationConsent: u.locationConsent,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

const DAY_MS = 86_400_000;
const isStaffRole = (r: Role) => r !== 'CUSTOMER';

/**
 * Who may manage whom: admins manage everyone; supervisors manage technicians and customers
 * (field staff and subscribers) but never admins, supervisors or storekeepers.
 */
function assertCanManage(actor: { id: string; role: Role }, targetRole: Role) {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'SUPERVISOR' && (targetRole === 'TECHNICIAN' || targetRole === 'CUSTOMER')) return;
  throw forbidden('You can only manage technicians and customers');
}

/** Team / directory list. Staff see staff; pass ?role=CUSTOMER (managers) for customers. */
usersRouter.get(
  '/',
  requireRole([...ROLES.STORE]),
  ah(async (req, res) => {
    const role = typeof req.query.role === 'string' && req.query.role in Role ? (req.query.role as Role) : undefined;
    if (role === 'CUSTOMER' && !ROLES.MANAGERS.includes(req.user!.role)) throw forbidden();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const today = workDateOf();
    const users = await prisma.user.findMany({
      where: {
        role: role ?? { not: 'CUSTOMER' },
        active,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { staffNo: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { email: { contains: q, mode: 'insensitive' } },
                { customerAccount: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      take: 300,
      include: {
        attendance: { where: { workDate: today }, take: 1 },
        _count: {
          select: {
            tasksAssigned: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } },
            unitsHeld: { where: { status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } } },
          },
        },
      },
    });
    res.json({
      users: users.map((u) => ({
        ...publicUser(u),
        today: u.attendance[0]
          ? {
              status: u.attendance[0].status,
              checkInAt: u.attendance[0].checkInAt,
              checkOutAt: u.attendance[0].checkOutAt,
              dressReview: u.attendance[0].dressReview,
            }
          : null,
        openTasks: u._count.tasksAssigned,
        unitsInCustody: u._count.unitsHeld,
      })),
    });
  }),
);

/** Full profile for supervisors: attendance (30 days), job stats, recent jobs, custody. */
usersRouter.get(
  '/:id',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('User');
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [attendance, taskGroups, avg, recentTasks, units, bulk, lastCount] = await Promise.all([
      prisma.attendance.findMany({ where: { userId: user.id, workDate: { gte: since } }, orderBy: { workDate: 'desc' } }),
      prisma.task.groupBy({ by: ['status'], where: { assigneeId: user.id }, _count: { _all: true } }),
      prisma.task.aggregate({ where: { assigneeId: user.id, durationMinutes: { not: null } }, _avg: { durationMinutes: true }, _sum: { amountCollected: true } }),
      prisma.task.findMany({
        where: { assigneeId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, code: true, title: true, status: true, type: true, customerName: true, endedAt: true, durationMinutes: true },
      }),
      prisma.serialUnit.findMany({
        where: { holderId: user.id, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } },
        select: { id: true, serialNumber: true, status: true, heldSince: true, item: { select: { name: true } } },
      }),
      prisma.bulkHolding.findMany({ where: { userId: user.id, quantity: { gt: 0 } }, include: { item: { select: { name: true, unit: true } } } }),
      prisma.stockCount.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    const tasks = Object.fromEntries(taskGroups.map((g) => [g.status, g._count._all]));
    res.json({
      user: publicUser(user),
      stats: {
        daysPresent30: attendance.length,
        lateDays30: attendance.filter((a) => a.status === 'LATE').length,
        hoursWorked30: Math.round(attendance.reduce((n, a) => n + (a.workedMinutes ?? 0), 0) / 60),
        dressRejected30: attendance.filter((a) => a.dressReview === 'REJECTED').length,
        tasks,
        avgJobMinutes: Math.round(avg._avg.durationMinutes ?? 0),
        amountCollected: avg._sum.amountCollected ?? 0,
      },
      attendance,
      recentTasks,
      custody: { units, bulk: bulk.map((b) => ({ name: b.item.name, unit: b.item.unit, quantity: b.quantity })) },
      lastCount,
    });
  }),
);

const baseSchema = {
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: z
    .email('Enter a valid email')
    .transform((s) => s.toLowerCase())
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{9,16}$/, 'Enter a valid phone number, e.g. +254712345678')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  region: z.string().trim().max(60).optional(),
  address: z.string().trim().max(300).optional(),
  customerAccount: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .optional(),
};

const createSchema = z
  .object({
    ...baseSchema,
    staffNo: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only')
      .transform((s) => s.toUpperCase())
      .optional(),
    role: z.enum(Role).default(Role.TECHNICIAN),
    /** Optional: if omitted a one-time temporary password is generated. */
    password: passwordSchema.optional(),
  })
  .refine((b) => b.role !== 'CUSTOMER' || !!b.customerAccount, { message: 'Customer accounts need an account number', path: ['customerAccount'] })
  .refine((b) => b.role === 'CUSTOMER' || !!b.staffNo, { message: 'Enter a staff number', path: ['staffNo'] });

usersRouter.post(
  '/',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const actor = req.user!;
    const { password, staffNo, ...data } = parse(createSchema, req.body);
    assertCanManage(actor, data.role);
    // Customers sign in with their account number; staff with their staff number.
    const loginId = data.role === 'CUSTOMER' ? data.customerAccount! : staffNo!;
    if (data.role !== 'CUSTOMER') data.customerAccount = undefined;
    const temp = password ?? temporaryPassword();
    try {
      const user = await prisma.user.create({
        data: { ...data, staffNo: loginId, passwordHash: await bcrypt.hash(temp, 10), mustChangePassword: true },
      });
      await audit(actor.id, 'USER_CREATED', 'User', user.id, `Created ${user.role.toLowerCase()} ${user.name} (${user.staffNo})`);
      res.status(201).json({ user: publicUser(user), temporaryPassword: password ? undefined : temp });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const field = String((e.meta?.target as string[] | undefined)?.[0] ?? 'value');
        throw conflict(field === 'email' ? 'That email is already used by another account' : 'That staff / account number already exists', 'DUPLICATE');
      }
      throw e;
    }
  }),
);

const onboardSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer’s name').max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,16}$/, 'Enter a valid phone number, e.g. +254712345678'),
  email: baseSchema.email,
  address: z.string().trim().min(3, 'Enter where the customer is').max(300),
  region: baseSchema.region,
  /** The ISP account number if the office already issued one; otherwise one is created. */
  customerAccount: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,40}$/, 'Use letters, numbers and dashes only')
    .transform((s) => s.toUpperCase())
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Premises pin (the technician's phone while standing there). */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** The installation job this customer is being onboarded on. */
  taskId: z.string().optional(),
});

/** The next customer account number after the highest on record (FBI-CUS-10000, FBI-CUS-10001 …). */
async function newAccountNumber(offset = 0): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("staffNo" FROM 9) AS INTEGER)) AS n FROM "User" WHERE "staffNo" ~ '^FBI-CUS-[0-9]+$'`;
  const next = Math.max(9999, Number(rows[0]?.n ?? 0)) + 1 + offset;
  return `FBI-CUS-${String(next).padStart(5, '0')}`;
}

/**
 * Onboarding: a technician (or the office) creates the app login for the customer they are installing for.
 * The customer signs in with the account number and a one-time password, then chooses their own.
 */
usersRouter.post(
  '/onboard-customer',
  requireRole(['ADMIN', 'SUPERVISOR', 'TECHNICIAN']),
  ah(async (req, res) => {
    const actor = req.user!;
    const body = parse(onboardSchema, req.body);
    let account = body.customerAccount;
    if (body.taskId) {
      const task = await prisma.task.findUnique({ where: { id: body.taskId }, select: { id: true, code: true, assigneeId: true, customerAccount: true, status: true } });
      if (!task) throw notFound('Job');
      if (actor.role === 'TECHNICIAN' && task.assigneeId !== actor.id) throw forbidden('This job is not assigned to you');
      if (task.customerAccount && account && task.customerAccount !== account) throw conflict(`This job belongs to account ${task.customerAccount}`, 'ACCOUNT_MISMATCH');
      account = account ?? task.customerAccount ?? undefined;
    }
    if (account && (await prisma.user.findFirst({ where: { customerAccount: account, role: 'CUSTOMER' } }))) {
      throw conflict(`Account ${account} already has an app login. Ask the office to reset its password instead.`, 'ALREADY_ONBOARDED');
    }
    const temp = temporaryPassword();
    const passwordHash = await bcrypt.hash(temp, 10);
    let user: User | null = null;
    // Two onboardings at the same moment can pick the same next number: try the following one
    for (let attempt = 0; !user && attempt < 5; attempt += 1) {
      const loginId = account ?? (await newAccountNumber(attempt));
      try {
        user = await prisma.user.create({
          data: {
            name: body.name,
            phone: body.phone,
            email: body.email,
            address: body.address,
            region: body.region,
            role: 'CUSTOMER',
            customerAccount: loginId,
            staffNo: loginId,
            passwordHash,
            mustChangePassword: true,
            lastLat: body.lat ?? null,
            lastLng: body.lng ?? null,
            lastLocationAt: body.lat != null ? new Date() : null,
          },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        const field = String((e.meta?.target as string[] | undefined)?.[0] ?? '');
        if (field === 'email') throw conflict('That email is already used by another account', 'DUPLICATE');
        if (account) throw conflict(`Account ${account} already has an app login`, 'ALREADY_ONBOARDED');
      }
    }
    if (!user) throw conflict('Could not create an account number. Try again.');
    // Link the job to the new account so the customer sees the visit straight away
    if (body.taskId) await prisma.task.updateMany({ where: { id: body.taskId, customerAccount: null }, data: { customerAccount: user.customerAccount } });
    await audit(actor.id, 'CUSTOMER_ONBOARDED', 'User', user.id, `Onboarded customer ${user.name} (${user.staffNo})${body.taskId ? ' on a job' : ''}`);
    res.status(201).json({ user: publicUser(user), loginId: user.staffNo, temporaryPassword: temp });
  }),
);

const updateSchema = z.object({
  name: baseSchema.name.optional(),
  email: baseSchema.email,
  phone: baseSchema.phone,
  region: baseSchema.region,
  address: baseSchema.address,
  customerAccount: z
    .string()
    .trim()
    .min(3, 'Enter the account number')
    .transform((s) => s.toUpperCase())
    .optional(),
  role: z.enum(Role).optional(),
  active: z.boolean().optional(),
});

usersRouter.patch(
  '/:id',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const actor = req.user!;
    const body = parse(updateSchema, req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('User');
    assertCanManage(actor, target.role);
    if (body.role && body.role !== target.role) {
      assertCanManage(actor, body.role);
      if (isStaffRole(target.role) !== isStaffRole(body.role)) throw badRequest('Staff accounts and customer accounts cannot be converted into each other');
      if (target.id === actor.id) throw badRequest('You cannot change your own role');
    }
    if (body.active === false) {
      if (target.id === actor.id) throw badRequest('You cannot deactivate your own account');
      const held = await prisma.serialUnit.findMany({
        where: { holderId: target.id, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } },
        select: { serialNumber: true },
      });
      if (held.length) {
        throw conflict(`${target.name} still holds ${held.length} device(s): ${held.map((h) => h.serialNumber).join(', ')}. Record a return or report them lost first.`, 'HOLDS_DEVICES');
      }
    }
    const demotingAdmin = target.role === 'ADMIN' && ((body.role && body.role !== 'ADMIN') || body.active === false);
    if (demotingAdmin) {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
      if (admins <= 1) throw badRequest('There must always be at least one active administrator');
    }
    if (body.customerAccount && target.role !== 'CUSTOMER') throw badRequest('Only customer accounts have an account number');
    // Customers sign in with their account number, so it doubles as their login id.
    const loginChange = target.role === 'CUSTOMER' && body.customerAccount && body.customerAccount !== target.customerAccount ? { staffNo: body.customerAccount } : {};
    let user: User;
    try {
      user = await prisma.user.update({ where: { id: target.id }, data: { ...body, ...loginChange } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('That email or account number is already used by another account', 'DUPLICATE');
      throw e;
    }
    forgetUser(user.id);
    const changes = Object.keys(body).join(', ');
    await audit(actor.id, body.active === false ? 'USER_DEACTIVATED' : body.active === true ? 'USER_REACTIVATED' : 'USER_UPDATED', 'User', user.id, `Updated ${user.name}: ${changes}`, body as Prisma.InputJsonObject);
    res.json({ user: publicUser(user) });
  }),
);

usersRouter.post(
  '/:id/reset-password',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const actor = req.user!;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw notFound('User');
    assertCanManage(actor, target.role);
    if (target.id === actor.id) throw badRequest('Use “Change password” for your own account');
    const temp = temporaryPassword();
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(temp, 10), mustChangePassword: true, sessionVersion: { increment: 1 } } });
    forgetUser(target.id);
    await audit(actor.id, 'PASSWORD_RESET', 'User', target.id, `Reset password for ${target.name} (${target.staffNo})`);
    res.json({ temporaryPassword: temp });
  }),
);
