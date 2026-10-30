import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
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

/**
 * Who a signed-in person is *right now*. The token only proves they signed in; their role and whether the
 * account is still active come from the database (cached for a few seconds), so deactivating someone or
 * changing their role takes effect on their very next request instead of when the token expires.
 */
const LIVE_MS = 10_000;
const live = new Map<string, { at: number; role: Role; name: string; active: boolean; sessionVersion: number }>();

/** Call after changing a user's role, active flag or password so the change applies immediately. */
export const forgetUser = (id: string) => live.delete(id);

async function liveUser(id: string) {
  const hit = live.get(id);
  if (hit && Date.now() - hit.at < LIVE_MS) return hit;
  const row = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true, active: true, sessionVersion: true } });
  if (!row) {
    live.delete(id);
    return null;
  }
  const fresh = { at: Date.now(), ...row };
  live.set(id, fresh);
  return fresh;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  let sub: string;
  let sv: number;
  try {
    const payload = verifyToken(header.slice(7));
    sub = payload.sub;
    sv = payload.sv ?? 0; // tokens issued before this existed count as version 0
  } catch {
    return next(unauthorized('Session expired, please log in again'));
  }
  try {
    const user = await liveUser(sub);
    if (!user || !user.active) return next(unauthorized('This account has been deactivated. Contact your administrator.'));
    // Signed out remotely (password changed, or "sign out other devices")
    if (sv !== user.sessionVersion) return next(unauthorized('You were signed out. Please sign in again.'));
    req.user = { id: sub, role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}

/** Role groups used across modules. */
export const ROLES = {
  STAFF: ['ADMIN', 'SUPERVISOR', 'STOREKEEPER', 'TECHNICIAN', 'CUSTOMER_CARE'] as Role[],
  CUSTOMER: ['CUSTOMER'] as Role[],
  MANAGERS: ['ADMIN', 'SUPERVISOR'] as Role[],
  STORE: ['ADMIN', 'SUPERVISOR', 'STOREKEEPER'] as Role[],
  ADMIN: ['ADMIN'] as Role[],
  /** Look after customers: support chats, requests, customer logins. */
  CARE: ['ADMIN', 'SUPERVISOR', 'CUSTOMER_CARE'] as Role[],
  /** May see every job and follow it live (dispatching stays with managers). */
  JOB_VIEWERS: ['ADMIN', 'SUPERVISOR', 'STOREKEEPER', 'CUSTOMER_CARE'] as Role[],
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
