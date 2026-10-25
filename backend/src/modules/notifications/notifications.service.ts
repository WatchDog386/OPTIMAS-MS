import type { NotificationType, Prisma, Role } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface Message {
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonObject;
}

/**
 * Records an in-app notification for each user and delivers it as a push notification.
 * Never throws: a notification failure must not fail the business action that triggered it.
 */
export async function notify(userIds: (string | null | undefined)[], msg: Message) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, type: msg.type, title: msg.title, body: msg.body, data: msg.data })),
    });
    if (env.PUSH_ENABLED) await sendPush(ids, msg);
  } catch (err) {
    console.error('[notify] failed', err);
  }
}

/** Notify every active user holding one of the given roles. */
export async function notifyRoles(roles: Role[], msg: Message, exceptUserId?: string) {
  const users = await prisma.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
  await notify(users.map((u) => u.id).filter((id) => id !== exceptUserId), msg);
}

async function sendPush(userIds: string[], msg: Message) {
  const tokens = await prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
  if (!tokens.length) return;
  const messages = tokens.map((t) => ({
    to: t.token,
    title: msg.title,
    body: msg.body,
    data: { type: msg.type, ...(msg.data ?? {}) },
    sound: 'default',
    channelId: 'default',
  }));

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.warn('[push] Expo push API responded', res.status);
      continue;
    }
    // Remove tokens for uninstalled apps so we stop sending to them.
    const { data } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const dead = (data ?? [])
      .map((ticket, idx) => (ticket.details?.error === 'DeviceNotRegistered' ? chunk[idx].to : null))
      .filter((t): t is string => !!t);
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
