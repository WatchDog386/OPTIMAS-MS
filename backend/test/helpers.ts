import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = 'Optimas@2026';

export async function login(identifier: string, password = PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ identifier, password });
  if (res.status !== 200) throw new Error(`login ${identifier} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { token: string; user: { id: string; role: string; mustChangePassword: boolean } };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let seq = 0;
/** Creates a fresh technician (as admin) and returns a session for them. */
export async function newTechnician(adminToken: string) {
  seq += 1;
  const staffNo = `T-${Date.now().toString(36)}-${seq}`.toUpperCase();
  const res = await api()
    .post('/api/v1/users')
    .set(auth(adminToken))
    .send({ staffNo, name: `Test Tech ${seq}`, role: 'TECHNICIAN', password: 'Tech-pass-123' });
  if (res.status !== 201) throw new Error(`create tech failed ${res.status} ${JSON.stringify(res.body)}`);
  return login(staffNo, 'Tech-pass-123');
}

/** A unique minimal JPEG payload (only the magic bytes are checked server-side). */
export const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(256)]);

export async function capture(token: string, purpose: string, opts: { taskId?: string; lat?: number; lng?: number; file?: Buffer } = {}) {
  const ch = await api().post('/api/v1/capture/challenge').set(auth(token)).send({ purpose, taskId: opts.taskId });
  if (ch.status !== 201) throw new Error(`challenge failed ${ch.status}`);
  const res = await api()
    .post('/api/v1/capture/upload')
    .set(auth(token))
    .field('challengeId', ch.body.challengeId)
    .field('nonce', ch.body.nonce)
    .field('lat', String(opts.lat ?? -1.2921))
    .field('lng', String(opts.lng ?? 36.8219))
    .attach('photo', opts.file ?? jpeg(), 'p.jpg');
  return res;
}

export async function photoId(token: string, purpose: string, taskId?: string) {
  const res = await capture(token, purpose, { taskId });
  if (res.status !== 201) throw new Error(`upload failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.photoId as string;
}

export const CHECKLIST = { uniform: true, idBadge: true, safetyBoots: true, groomed: true };

export async function checkIn(token: string) {
  const res = await api().post('/api/v1/attendance/check-in').set(auth(token)).send({ photoId: await photoId(token, 'CHECK_IN'), checklist: CHECKLIST });
  if (res.status !== 201) throw new Error(`check-in failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.record;
}

export async function itemBySku(token: string, sku: string) {
  const res = await api().get('/api/v1/inventory/items').set(auth(token));
  return (res.body.items as { id: string; sku: string; storeQuantity: number }[]).find((i) => i.sku === sku)!;
}

/** Registers fresh serialised units (so tests never fight over seed stock). */
export async function receiveSerials(token: string, sku: string, count: number) {
  const item = await itemBySku(token, sku);
  const serials = Array.from({ length: count }, () => `TS${crypto.randomBytes(4).toString('hex').toUpperCase()}`);
  const res = await api()
    .post('/api/v1/inventory/receive')
    .set(auth(token))
    .send({ itemId: item.id, serials: serials.map((serialNumber) => ({ serialNumber })) });
  if (res.status !== 201) throw new Error(`receive failed ${res.status} ${JSON.stringify(res.body)}`);
  return { item, serials };
}

export async function createTask(token: string, assigneeId: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/v1/tasks')
    .set(auth(token))
    .send({ title: 'Test installation', type: 'INSTALLATION', customerName: 'Test Customer', customerAccount: 'FBI-CUS-TEST', address: 'Test street', assigneeId, ...extra });
  if (res.status !== 201) throw new Error(`create task failed ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.task as { id: string; code: string };
}

/** Retries an assertion until it passes (for background work such as notifications). */
export async function eventually<T>(fn: () => Promise<T>, check: (v: T) => boolean, timeoutMs = 3000): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last = await fn();
  while (!check(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 100));
    last = await fn();
  }
  return last;
}
