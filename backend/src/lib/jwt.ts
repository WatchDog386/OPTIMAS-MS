import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  role: Role;
  name: string;
  /** Session version the token was issued under; raised to sign a person out of every device. */
  sv?: number;
}

export const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });

export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET) as TokenPayload & jwt.JwtPayload;
