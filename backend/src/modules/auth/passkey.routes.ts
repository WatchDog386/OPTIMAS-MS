import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../lib/jwt';
import { badRequest, forbidden, notFound, unauthorized } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { publicUser } from '../users/users.routes';

/**
 * Fingerprint (or face) lock with the phone's own sensor, using WebAuthn. The sensor signs a fresh
 * challenge from the server; only its public key is stored here, never the fingerprint. Unlocking is
 * checked on the server, so the lock cannot be skipped by editing the app.
 */
export const passkeyRouter = Router();

const CHALLENGE_MS = 5 * 60_000;
const challenges = new Map<string, { value: string; at: number; kind: 'register' | 'unlock' }>();

/**
 * Where the app runs: the page's own address. It must be the same site as this API (the web app and
 * /api share one address) or be listed in WEBAUTHN_ORIGINS; the phone binds each key to that site.
 */
function site(req: Request) {
  const origin = String(req.headers.origin ?? '');
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw badRequest('Fingerprint lock works only from the app in a browser', 'NO_ORIGIN');
  }
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  const allowed = env.WEBAUTHN_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (url.host !== host && !allowed.includes(origin)) throw forbidden('This address may not use fingerprint lock');
  return { origin, rpID: url.hostname };
}

function takeChallenge(userId: string, kind: 'register' | 'unlock') {
  const c = challenges.get(userId);
  challenges.delete(userId);
  if (!c || c.kind !== kind || Date.now() - c.at > CHALLENGE_MS) throw badRequest('That took too long. Try again.', 'CHALLENGE_EXPIRED');
  return c.value;
}

passkeyRouter.get(
  '/',
  ah(async (req, res) => {
    const keys = await prisma.passkey.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' }, select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true } });
    res.json({ passkeys: keys });
  }),
);

passkeyRouter.post(
  '/register-options',
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me(req).id } });
    const { rpID } = site(req);
    const options = await generateRegistrationOptions({
      rpName: 'Optimas MS',
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.staffNo,
      userDisplayName: user.name,
      attestationType: 'none',
      // The phone's own sensor, and it must check the person (fingerprint, face or screen lock). A key kept on
      // the phone only (not a synced passkey): works on Android phones without a Google account and can be
      // registered again after the app's storage is cleared.
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    });
    challenges.set(user.id, { value: options.challenge, at: Date.now(), kind: 'register' });
    res.json(options);
  }),
);

passkeyRouter.post(
  '/register',
  ah(async (req, res) => {
    const userId = me(req).id;
    const body = parse(z.object({ response: z.record(z.string(), z.unknown()), deviceName: z.string().trim().max(80).optional() }), req.body);
    const { origin, rpID } = site(req);
    const expectedChallenge = takeChallenge(userId, 'register');
    const result = await verifyRegistrationResponse({
      response: body.response as unknown as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    }).catch(() => null);
    if (!result?.verified || !result.registrationInfo) throw badRequest('The fingerprint could not be registered. Try again.', 'NOT_VERIFIED');
    const { credential } = result.registrationInfo;
    await prisma.passkey.create({
      data: { id: credential.id, userId, publicKey: Buffer.from(credential.publicKey), counter: credential.counter, transports: credential.transports ?? [], deviceName: body.deviceName ?? null },
    });
    res.status(201).json({ id: credential.id });
  }),
);

passkeyRouter.post(
  '/unlock-options',
  ah(async (req, res) => {
    const userId = me(req).id;
    const keys = await prisma.passkey.findMany({ where: { userId }, select: { id: true, transports: true } });
    if (!keys.length) throw notFound('A registered fingerprint');
    const { rpID } = site(req);
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: keys.map((k) => ({ id: k.id, transports: k.transports as AuthenticatorTransportFuture[] })) });
    challenges.set(userId, { value: options.challenge, at: Date.now(), kind: 'unlock' });
    res.json(options);
  }),
);

passkeyRouter.post(
  '/unlock',
  ah(async (req, res) => {
    const userId = me(req).id;
    const { response } = parse(z.object({ response: z.record(z.string(), z.unknown()) }), req.body);
    const answer = response as unknown as AuthenticationResponseJSON;
    const key = await prisma.passkey.findUnique({ where: { id: String(answer.id ?? '') } });
    if (!key || key.userId !== userId) throw forbidden('That fingerprint is not registered to this account');
    const { origin, rpID } = site(req);
    const expectedChallenge = takeChallenge(userId, 'unlock');
    const result = await verifyAuthenticationResponse({
      response: answer,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: key.id, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports as AuthenticatorTransportFuture[] },
    }).catch(() => null);
    if (!result?.verified) throw forbidden('Fingerprint not recognised');
    await prisma.passkey.update({ where: { id: key.id }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    res.json({ ok: true });
  }),
);

passkeyRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const { count } = await prisma.passkey.deleteMany({ where: { id: req.params.id, userId: me(req).id } });
    if (!count) throw notFound('Fingerprint');
    res.json({ ok: true });
  }),
);

/** Sign in with fingerprint instead of a password. The person gives their staff/account number first. */
const loginOptionsSchema = z.object({
  identifier: z.string().trim().min(1, 'Staff number or account number is required').max(120),
});

passkeyRouter.post(
  '/login-options',
  ah(async (req, res) => {
    const { identifier } = parse(loginOptionsSchema, req.body);
    const id = identifier.toUpperCase();
    const user =
      (await prisma.user.findFirst({ where: { OR: [{ staffNo: id }, { email: identifier.toLowerCase() }] } })) ??
      (id.startsWith('OPT-') ? await prisma.user.findUnique({ where: { staffNo: `FBI-${id.slice(4)}` } }) : null);
    if (!user || !user.active) throw notFound('Account');
    const keys = await prisma.passkey.findMany({ where: { userId: user.id }, select: { id: true, transports: true } });
    if (!keys.length) throw notFound('No fingerprint is registered on this account');
    const { rpID } = site(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: keys.map((k) => ({ id: k.id, transports: k.transports as AuthenticatorTransportFuture[] })),
    });
    challenges.set(user.id, { value: options.challenge, at: Date.now(), kind: 'unlock' });
    res.json(options);
  }),
);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Staff number or account number is required').max(120),
  response: z.record(z.string(), z.unknown()),
});

passkeyRouter.post(
  '/login',
  ah(async (req, res) => {
    const { identifier, response } = parse(loginSchema, req.body);
    const id = identifier.toUpperCase();
    const user =
      (await prisma.user.findFirst({ where: { OR: [{ staffNo: id }, { email: identifier.toLowerCase() }] } })) ??
      (id.startsWith('OPT-') ? await prisma.user.findUnique({ where: { staffNo: `FBI-${id.slice(4)}` } }) : null);
    if (!user || !user.active) throw unauthorized('Invalid account or fingerprint');
    const key = await prisma.passkey.findUnique({ where: { id: String((response as { id?: unknown })?.id ?? '') } });
    if (!key || key.userId !== user.id) throw forbidden('That fingerprint is not registered to this account');
    const { origin, rpID } = site(req);
    const expectedChallenge = takeChallenge(user.id, 'unlock');
    const result = await verifyAuthenticationResponse({
      response: response as unknown as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: key.id, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports as AuthenticatorTransportFuture[] },
    }).catch(() => null);
    if (!result?.verified) throw forbidden('Fingerprint not recognised');
    await prisma.passkey.update({ where: { id: key.id }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({ sub: user.id, role: user.role, name: user.name, sv: user.sessionVersion });
    res.json({ token, user: publicUser(user) });
  }),
);
