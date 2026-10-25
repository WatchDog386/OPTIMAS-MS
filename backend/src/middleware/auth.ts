import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/http-error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; name: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    next(unauthorized('Session expired, please log in again'));
  }
}

/** Role groups used across modules. */
export const ROLES = {
  MANAGERS: ['ADMIN', 'SUPERVISOR'] as Role[],
  STORE: ['ADMIN', 'SUPERVISOR', 'STOREKEEPER'] as Role[],
  ADMIN: ['ADMIN'] as Role[],
};

export const requireRole =
  (roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Narrow `req.user` for handlers mounted behind requireAuth. */
export const me = (req: Request) => {
  if (!req.user) throw unauthorized();
  return req.user;
};
