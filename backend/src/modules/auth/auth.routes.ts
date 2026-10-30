import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { HttpError, badRequest, unauthorized } from '../../lib/http-error';
import { passwordSchema } from '../../lib/password';
import { ah } from '../../middleware/async';
import { forgetUser, me, requireAuth } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { publicUser } from '../users/users.routes';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Staff number or email is required').max(120),
  password: z.string().min(1, 'Password is required').max(200),
});

/** Compared against when the account doesn't exist, so a wrong staff number takes as long as a wrong password. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
/** Too many wrong passwords for one account (from any address) pauses that account's sign-in for a while. */
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { count: number; first: number }>();
function lockedOut(key: string) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > LOCK_MS) {
    fails.delete(key);
    return false;
  }
  return f.count >= MAX_FAILS;
}
function recordFail(key: string) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > LOCK_MS) fails.set(key, { count: 1, first: Date.now() });
  else f.count += 1;
  if (fails.size > 10_000) fails.clear();
}

authRouter.post(
  '/login',
  ah(async (req, res) => {
    const { identifier, password } = parse(loginSchema, req.body);
    const key = identifier.toLowerCase();
    if (lockedOut(key)) throw new HttpError(429, 'Too many wrong passwords for this account. Try again in 15 minutes or ask your administrator to reset it.', 'ACCOUNT_LOCKED');
    const user = await prisma.user.findFirst({
      where: { OR: [{ staffNo: identifier.toUpperCase() }, { email: identifier.toLowerCase() }] },
    });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      recordFail(key);
      throw unauthorized('Invalid staff number or password');
    }
    fails.delete(key);
    if (!user.active) throw unauthorized('This account has been deactivated. Contact your administrator.');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({ sub: user.id, role: user.role, name: user.name, sv: user.sessionVersion });
    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    if (!user.active) throw unauthorized('This account has been deactivated');
    res.json({ user: publicUser(user) });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});

authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect', 'WRONG_PASSWORD');
    if (body.currentPassword === body.newPassword) throw badRequest('Choose a password different from the current one');
    const updated = await prisma.user.update({
      where: { id: user.id },
      // A new password ends every other session (a stolen phone or a shared login stops working); this device gets a fresh token
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    forgetUser(user.id);
    res.json({ ok: true, user: publicUser(updated), token: signToken({ sub: updated.id, role: updated.role, name: updated.name, sv: updated.sessionVersion }) });
  }),
);

/** "Sign out other devices": every token issued before now stops working, except the fresh one returned here. */
authRouter.post(
  '/logout-others',
  requireAuth,
  ah(async (req, res) => {
    const updated = await prisma.user.update({ where: { id: me(req).id }, data: { sessionVersion: { increment: 1 } } });
    forgetUser(updated.id);
    res.json({ ok: true, token: signToken({ sub: updated.id, role: updated.role, name: updated.name, sv: updated.sessionVersion }) });
  }),
);

/**
 * Right of access (Data Protection Act, 2019, s.26): everything the app holds about the signed-in person,
 * as one JSON file. Photos are listed (when, where, what for) rather than embedded.
 */
authRouter.get(
  '/my-data',
  requireAuth,
  ah(async (req, res) => {
    const id = me(req).id;
    const [user, attendance, photos, tasks, requests, locations, messages, notifications] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id } }),
      prisma.attendance.findMany({ where: { userId: id }, orderBy: { workDate: 'desc' }, select: { workDate: true, status: true, checkInAt: true, checkOutAt: true, workedMinutes: true, dressReview: true, reviewNote: true, checkOutNote: true } }),
      prisma.photo.findMany({ where: { userId: id }, orderBy: { receivedAt: 'desc' }, select: { id: true, purpose: true, receivedAt: true, lat: true, lng: true, accuracyM: true, flags: true } }),
      prisma.task.findMany({ where: { assigneeId: id }, orderBy: { createdAt: 'desc' }, select: { code: true, title: true, status: true, customerName: true, address: true, startedAt: true, endedAt: true } }),
      prisma.serviceRequest.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, select: { type: true, description: true, address: true, status: true, createdAt: true } }),
      prisma.locationPing.findMany({ where: { userId: id }, orderBy: { at: 'desc' }, select: { lat: true, lng: true, at: true } }),
      prisma.message.findMany({ where: { senderId: id }, orderBy: { createdAt: 'desc' }, select: { body: true, createdAt: true } }),
      prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, select: { title: true, body: true, createdAt: true } }),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="optimas-my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: { ...publicUser(user), lastLocation: user.lastLat != null ? { lat: user.lastLat, lng: user.lastLng, at: user.lastLocationAt } : null },
      attendance,
      photos,
      jobs: tasks,
      serviceRequests: requests,
      locationTrail: locations,
      messagesSent: messages,
      notifications,
    });
  }),
);

/**
 * Right to erasure (s.40) for customers: the account is anonymised and closed. Visit and payment records
 * stay (the company must keep them) but no longer carry the person's name, phone, e-mail or location.
 * Staff records are employment records: staff ask an administrator instead.
 */
authRouter.post(
  '/delete-account',
  requireAuth,
  ah(async (req, res) => {
    const { password } = parse(z.object({ password: z.string().min(1, 'Enter your password to confirm').max(200) }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    if (user.role !== 'CUSTOMER') throw badRequest('Staff accounts are closed by an administrator. Ask your supervisor.', 'STAFF_ACCOUNT');
    if (!(await bcrypt.compare(password, user.passwordHash))) throw badRequest('Password is incorrect', 'WRONG_PASSWORD');
    await prisma.$transaction([
      prisma.locationPing.deleteMany({ where: { userId: user.id } }),
      prisma.notification.deleteMany({ where: { userId: user.id } }),
      prisma.pushToken.deleteMany({ where: { userId: user.id } }),
      prisma.webPushSubscription.deleteMany({ where: { userId: user.id } }),
      prisma.message.updateMany({ where: { senderId: user.id }, data: { body: '(message deleted)' } }),
      prisma.serviceRequest.updateMany({ where: { customerId: user.id }, data: { phone: null, address: null, lat: null, lng: null } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: 'Deleted customer',
          email: null,
          phone: null,
          address: null,
          region: null,
          active: false,
          locationConsent: false,
          lastLat: null,
          lastLng: null,
          lastAccuracy: null,
          lastHeading: null,
          lastSpeed: null,
          lastLocationAt: null,
          // Nobody can sign in to it again
          passwordHash: await bcrypt.hash(`${user.id}-${Date.now()}-${Math.random()}`, 10),
          sessionVersion: { increment: 1 },
        },
      }),
    ]);
    forgetUser(user.id);
    res.json({ ok: true });
  }),
);
