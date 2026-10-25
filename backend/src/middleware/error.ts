import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { HttpError } from '../lib/http-error';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
  }
  if (err instanceof MulterError) {
    return res.status(400).json({ error: { message: err.message, code: err.code } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { message: 'A record with these details already exists', code: 'DUPLICATE' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { message: 'Record not found', code: 'NOT_FOUND' } });
    }
  }
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our side', code: 'INTERNAL' } });
}
