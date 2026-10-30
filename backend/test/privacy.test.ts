import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, checkIn, login, newTechnician, photoId } from './helpers';
import { runRetention } from '../src/lib/retention';
import { prisma } from '../src/lib/prisma';

describe('sign-in hardening', () => {
  it('answers the same for an unknown account and a wrong password, and locks an account after repeated failures', async () => {
    const unknown = await api().post('/api/v1/auth/login').send({ identifier: 'NOBODY-123', password: 'x' });
    const wrong = await api().post('/api/v1/auth/login').send({ identifier: 'OPT-STR-001', password: 'wrong' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);

    const admin = (await login('OPT-ADM-001')).token;
    const tech = await newTechnician(admin);
    const me = await api().get('/api/v1/auth/me').set(auth(tech.token));
    const id = me.body.user.staffNo;
    for (let i = 0; i < 8; i += 1) await api().post('/api/v1/auth/login').send({ identifier: id, password: 'nope' });
    const locked = await api().post('/api/v1/auth/login').send({ identifier: id, password: 'Tech-pass-123' });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('only accepts real browser push services as push addresses', async () => {
    const tech = await newTechnician((await login('OPT-ADM-001')).token);
    const keys = { p256dh: 'BOr', auth: 'x' };
    for (const endpoint of ['http://169.254.169.254/latest/meta-data', 'https://internal.example.com/push', 'http://fcm.googleapis.com/fcm/send/abc']) {
      expect((await api().post('/api/v1/notifications/web-push').set(auth(tech.token)).send({ endpoint, keys })).status).toBe(400);
    }
    expect((await api().post('/api/v1/notifications/web-push').set(auth(tech.token)).send({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys })).status).toBe(201);
  });
});

describe('who sees staff photos', () => {
  it('lets supervisors see check-in selfies but not the store', async () => {
    const admin = (await login('OPT-ADM-001')).token;
    const tech = await newTechnician(admin);
    const rec = await checkIn(tech.token);
    const store = (await login('OPT-STR-001')).token;
    const sup = (await login('OPT-SUP-001')).token;
    expect((await api().get(`/api/v1/capture/photos/${rec.checkInPhotoId}`).set(auth(store))).status).toBe(403);
    expect((await api().get(`/api/v1/capture/photos/${rec.checkInPhotoId}/info`).set(auth(store))).status).toBe(403);
    expect((await api().get(`/api/v1/capture/photos/${rec.checkInPhotoId}`).set(auth(sup))).status).toBe(200);
    expect((await api().get(`/api/v1/capture/photos/${rec.checkInPhotoId}`).set(auth(tech.token))).status).toBe(200);
  });
});

describe('personal data rights', () => {
  let admin: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
  });

  it('gives anyone a copy of their own data', async () => {
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const res = await api().get('/api/v1/auth/my-data').set(auth(tech.token));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.profile.id).toBe(tech.user.id);
    expect(res.body.attendance.length).toBe(1);
    expect(res.body.photos.length).toBeGreaterThan(0);
    expect(res.body.profile).not.toHaveProperty('passwordHash');
  });

  it('lets a customer delete their account (anonymised, signed out, cannot sign in), but not staff', async () => {
    const tech = await newTechnician(admin);
    const made = await api().post('/api/v1/users/onboard-customer').set(auth(tech.token)).send({ name: 'Jane Privacy', phone: '+254712000300', email: 'jane.privacy@example.com', address: 'Karen', lat: -1.31, lng: 36.7 });
    const customer = await login(made.body.loginId, made.body.temporaryPassword);
    expect((await api().post('/api/v1/auth/delete-account').set(auth(customer.token)).send({ password: 'wrong' })).status).toBe(400);
    expect((await api().post('/api/v1/auth/delete-account').set(auth(customer.token)).send({ password: made.body.temporaryPassword })).status).toBe(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: customer.user.id } });
    expect(row).toMatchObject({ name: 'Deleted customer', email: null, phone: null, address: null, lastLat: null, active: false });
    expect((await api().get('/api/v1/auth/me').set(auth(customer.token))).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ identifier: made.body.loginId, password: made.body.temporaryPassword })).status).toBe(401);
    expect((await api().post('/api/v1/auth/delete-account').set(auth(tech.token)).send({ password: 'Tech-pass-123' })).body.error.code).toBe('STAFF_ACCOUNT');
  });

  it('deletes old trail points, old notifications and abandoned photos', async () => {
    const tech = await newTechnician(admin);
    await prisma.locationPing.create({ data: { userId: tech.user.id, lat: 1, lng: 1, at: new Date(Date.now() - 5 * 86_400_000) } });
    await prisma.notification.create({ data: { userId: tech.user.id, type: 'JOB_UPDATE', title: 'old', body: 'old', createdAt: new Date(Date.now() - 200 * 86_400_000) } });
    const unused = await photoId(tech.token, 'CHECK_IN');
    await prisma.photo.update({ where: { id: unused }, data: { receivedAt: new Date(Date.now() - 2 * 86_400_000) } });
    const r = await runRetention();
    expect(r.trail).toBeGreaterThanOrEqual(1);
    expect(r.notifications).toBeGreaterThanOrEqual(1);
    expect(await prisma.photo.findUnique({ where: { id: unused } })).toBeNull();
  });
});
