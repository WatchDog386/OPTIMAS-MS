import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { badRequest, unauthorized } from '../../lib/http-error';
import { passwordSchema } from '../../lib/password';
import { ah } from '../../middleware/async';
import { me, requireAuth } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { publicUser } from '../users/users.routes';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Staff number or email is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post(
  '/login',
  ah(async (req, res) => {
    const { identifier, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findFirst({
      where: { OR: [{ staffNo: identifier.toUpperCase() }, { email: identifier.toLowerCase() }] },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized('Invalid staff number or password');
    }
    if (!user.active) throw unauthorized('This account has been deactivated. Contact your administrator.');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({ sub: user.id, role: user.role, name: user.name });
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
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10), mustChangePassword: false },
    });
    res.json({ ok: true, user: publicUser(updated) });
  }),
);
