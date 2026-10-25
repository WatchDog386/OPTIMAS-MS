import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { badRequest, unauthorized } from '../../lib/http-error';
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
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw unauthorized('Invalid staff number or password');
    }
    const token = signToken({ sub: user.id, role: user.role, name: user.name });
    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    res.json({ user: publicUser(user) });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10) },
    });
    res.json({ ok: true });
  }),
);
