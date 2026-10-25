import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, type User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah } from '../../middleware/async';
import { ROLES, requireRole } from '../../middleware/auth';
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
  active: u.active,
});

/** Team list with today's attendance and workload — used by the supervisor "Team" screen. */
usersRouter.get(
  '/',
  requireRole([...ROLES.STORE]),
  ah(async (req, res) => {
    const role = typeof req.query.role === 'string' && req.query.role in Role ? (req.query.role as Role) : undefined;
    const today = workDateOf();
    const users = await prisma.user.findMany({
      where: { role },
      orderBy: { name: 'asc' },
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

const createSchema = z.object({
  staffNo: z.string().trim().min(2).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2),
  email: z.email().transform((s) => s.toLowerCase()).optional(),
  phone: z.string().trim().optional(),
  role: z.enum(Role).default(Role.TECHNICIAN),
  region: z.string().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

usersRouter.post(
  '/',
  requireRole(ROLES.ADMIN),
  ah(async (req, res) => {
    const { password, ...data } = parse(createSchema, req.body);
    const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
    res.status(201).json({ user: publicUser(user) });
  }),
);

const updateSchema = createSchema.omit({ staffNo: true, password: true }).partial().extend({
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

usersRouter.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  ah(async (req, res) => {
    const { password, ...data } = parse(updateSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    });
    res.json({ user: publicUser(user) });
  }),
);
