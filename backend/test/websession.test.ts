import { beforeAll, describe, expect, it, vi } from 'vitest';

// The real push service is never contacted: the library is replaced by a recorder
const sent: { endpoint: string; payload: string }[] = [];
let failWith: number | null = null;
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      if (failWith) throw Object.assign(new Error('gone'), { statusCode: failWith });
      sent.push({ endpoint: sub.endpoint, payload });
    }),
  },
}));

import { prisma } from '../src/lib/prisma';
import { api, auth, createTask, login, newTechnician, PASSWORD } from './helpers';

describe('signing out other devices', () => {
  let admin: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
  });

  it('a password change ends every other session and hands this device a fresh token', async () => {
    const tech = await newTechnician(admin);
    const other = await login(tech.user.staffNo as string, 'Tech-pass-123');
    expect((await api().get('/api/v1/tasks').set(auth(other.token))).status).toBe(200);

    const change = await api().post('/api/v1/auth/change-password').set(auth(tech.token)).send({ currentPassword: 'Tech-pass-123', newPassword: 'Brand-new-pass-456' });
    expect(change.status).toBe(200);
    expect(change.body.token).toBeTruthy();

    expect((await api().get('/api/v1/tasks').set(auth(tech.token))).status).toBe(401); // old token on this device
    expect((await api().get('/api/v1/tasks').set(auth(other.token))).status).toBe(401); // the other phone
    expect((await api().get('/api/v1/tasks').set(auth(change.body.token))).status).toBe(200); // the fresh one
  });

  it('"sign out other devices" keeps this one signed in', async () => {
    const tech = await newTechnician(admin);
    const other = await login(tech.user.staffNo as string, 'Tech-pass-123');
    const res = await api().post('/api/v1/auth/logout-others').set(auth(tech.token));
    expect(res.status).toBe(200);
    expect((await api().get('/api/v1/tasks').set(auth(other.token))).status).toBe(401);
    expect((await api().get('/api/v1/tasks').set(auth(res.body.token))).status).toBe(200);
  });

  it('an admin password reset signs that person out everywhere', async () => {
    const tech = await newTechnician(admin);
    const reset = await api().post(`/api/v1/users/${tech.user.id}/reset-password`).set(auth(admin));
    expect(reset.status).toBe(200);
    expect((await api().get('/api/v1/tasks').set(auth(tech.token))).status).toBe(401);
  });
});

describe('web push', () => {
  let admin: string;
  let sup: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001', PASSWORD)).token;
  });

  const sub = (n: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/test-${n}`, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } });

  it('hands out the public key and stores a subscription per browser', async () => {
    const key = await api().get('/api/v1/notifications/web-push-key').set(auth(sup));
    expect(key.body.publicKey).toBeTruthy();
    expect((await api().post('/api/v1/notifications/web-push').set(auth(sup)).send({ endpoint: 'not a url', keys: {} })).status).toBe(400);
    const s = sub(`a-${Date.now()}`);
    expect((await api().post('/api/v1/notifications/web-push').set(auth(sup)).send(s)).status).toBe(201);
    // the same browser signing in as someone else moves the subscription to them
    expect((await api().post('/api/v1/notifications/web-push').set(auth(admin)).send(s)).status).toBe(201);
    expect(await prisma.webPushSubscription.count({ where: { endpoint: s.endpoint } })).toBe(1);
    expect((await api().delete('/api/v1/notifications/web-push').set(auth(admin)).send({ endpoint: s.endpoint })).status).toBe(200);
    expect(await prisma.webPushSubscription.count({ where: { endpoint: s.endpoint } })).toBe(0);
  });

  it('pushes a notification to the subscribed browser and drops dead subscriptions', async () => {
    const tech = await newTechnician(admin);
    const mine = sub(`b-${Date.now()}`);
    await api().post('/api/v1/notifications/web-push').set(auth(tech.token)).send(mine);
    sent.length = 0;
    await createTask(sup, tech.user.id); // "new job assigned" notification
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(sent[0].endpoint).toBe(mine.endpoint);
    expect(JSON.parse(sent[0].payload)).toMatchObject({ title: expect.any(String), body: expect.any(String), type: 'TASK_ASSIGNED' });

    failWith = 410; // the browser says this subscription no longer exists
    await createTask(sup, tech.user.id);
    await vi.waitFor(async () => expect(await prisma.webPushSubscription.count({ where: { endpoint: mine.endpoint } })).toBe(0));
    failWith = null;
  });
});
