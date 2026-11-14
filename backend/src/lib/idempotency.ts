import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { verifyToken } from './jwt';

/*
 * Sending the same change twice does it once. The app saves work done with no signal and sends it later,
 * and it retries anything whose answer was lost on a weak connection: each change carries an
 * Idempotency-Key that stays the same on every try. The first answer is kept, so a repeat gets that answer
 * back instead of a second check-in, a second "used 2 ATB boxes" or a second chat message.
 */

const KEEP_DAYS = 7;
let lastSweep = 0;

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.get('Idempotency-Key');
  if (!key || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || key.length > 100) return next();
  const header = req.headers.authorization;
  let userId: string;
  try {
    if (!header?.startsWith('Bearer ')) return next();
    userId = verifyToken(header.slice(7)).sub;
  } catch {
    return next(); // the route answers "signed out"; nothing is kept
  }

  try {
    const seen = await prisma.idempotentRequest.findUnique({ where: { userId_key: { userId, key } } });
    if (seen) {
      if (seen.status == null) {
        res.status(409).json({ error: { message: 'This is still being saved. Try again in a moment.', code: 'IN_PROGRESS' } });
        return;
      }
      res.setHeader('Idempotent-Replay', 'true');
      res.status(seen.status).json(seen.body ?? {});
      return;
    }
    await prisma.idempotentRequest.create({ data: { userId, key, method: req.method, path: req.originalUrl.slice(0, 300) } });
  } catch (e) {
    // Two tries arrived at the same moment: the other one does the work
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ error: { message: 'This is still being saved. Try again in a moment.', code: 'IN_PROGRESS' } });
      return;
    }
    return next(e);
  }

  let kept = false;
  const forget = () => prisma.idempotentRequest.delete({ where: { userId_key: { userId, key } } }).catch(() => undefined);
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    kept = true;
    const status = res.statusCode;
    // Answers that may change on a later try (signed out, too many requests, a server fault) are not kept
    if (status === 401 || status === 429 || status >= 500) void forget();
    else void prisma.idempotentRequest.update({ where: { userId_key: { userId, key } }, data: { status, body: (body ?? {}) as Prisma.InputJsonValue } }).catch(() => undefined);
    return json(body);
  };
  res.on('close', () => {
    if (!kept) void forget();
  });

  if (Date.now() - lastSweep > 3_600_000) {
    lastSweep = Date.now();
    void prisma.idempotentRequest.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } }).catch(() => undefined);
  }
  next();
}
