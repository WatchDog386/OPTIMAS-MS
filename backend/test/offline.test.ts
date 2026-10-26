import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { workDateOf } from '../src/lib/time';
import { api, auth, createTask, jpeg, login, newTechnician, CHECKLIST } from './helpers';

/** A photo taken with no signal and sent later: same camera-only proof, but stamped with when it really happened. */
async function offlinePhoto(token: string, purpose: string, takenAt: Date | null, taskId?: string) {
  const ch = await api().post('/api/v1/capture/challenge').set(auth(token)).send({ purpose, taskId });
  const req = api()
    .post('/api/v1/capture/upload')
    .set(auth(token))
    .field('challengeId', ch.body.challengeId)
    .field('nonce', ch.body.nonce)
    .field('lat', '-1.2921')
    .field('lng', '36.8219')
    .field('offline', '1')
    .attach('photo', Buffer.concat([jpeg(), crypto.randomBytes(8)]), 'p.jpg');
  if (takenAt) req.field('deviceTime', takenAt.toISOString());
  return req;
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe('work done offline is recorded when it happened, not when it was sent', () => {
  let sup: string;
  let tech: { token: string; user: { id: string } };

  beforeAll(async () => {
    sup = (await login('OPT-SUP-001')).token;
    const admin = (await login('OPT-ADM-001')).token;
    tech = await newTechnician(admin);
  });

  it('refuses an offline photo with no capture time, or one that is too old', async () => {
    const missing = await offlinePhoto(tech.token, 'CHECK_IN', null);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('OFFLINE_TIME_REQUIRED');
    const old = await offlinePhoto(tech.token, 'CHECK_IN', ago(60 * 72));
    expect(old.status).toBe(400);
    expect(old.body.error.code).toBe('OFFLINE_TIME_INVALID');
    const future = await offlinePhoto(tech.token, 'CHECK_IN', new Date(Date.now() + 3_600_000));
    expect(future.body.error.code).toBe('OFFLINE_TIME_INVALID');
  });

  it('flags the photo and uses its time for check-in, job start and completion', async () => {
    // Skip in the first minutes after local midnight, when "35 minutes ago" is yesterday's work date
    if (workDateOf(ago(36)).getTime() !== workDateOf().getTime()) return;

    const inAt = ago(35);
    const checkInPhoto = await offlinePhoto(tech.token, 'CHECK_IN', inAt);
    expect(checkInPhoto.status).toBe(201);
    expect(checkInPhoto.body.flags).toContain('OFFLINE_CAPTURE');
    expect(checkInPhoto.body.flags).not.toContain('DEVICE_CLOCK_SKEW');
    const checkIn = await api().post('/api/v1/attendance/check-in').set(auth(tech.token)).send({ photoId: checkInPhoto.body.photoId, checklist: CHECKLIST });
    expect(checkIn.status).toBe(201);
    expect(new Date(checkIn.body.record.checkInAt).getTime()).toBe(inAt.getTime());

    const task = await createTask(sup, tech.user.id, { type: 'REPAIR' });
    const startAt = ago(20);
    const startPhoto = await offlinePhoto(tech.token, 'TASK_START', startAt, task.id);
    const start = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: startPhoto.body.photoId });
    expect(start.status).toBe(200);
    expect(new Date(start.body.task.startedAt).getTime()).toBe(startAt.getTime());

    const endAt = ago(5);
    const endPhoto = await offlinePhoto(tech.token, 'TASK_END', endAt, task.id);
    const done = await api().post(`/api/v1/tasks/${task.id}/complete`).set(auth(tech.token)).send({ photoId: endPhoto.body.photoId, notes: 'Replaced the patch cord' });
    expect(done.status).toBe(200);
    expect(done.body.task.durationMinutes).toBe(15);
    expect(new Date(done.body.task.endedAt).getTime()).toBe(endAt.getTime());
  });

  it('keeps the live-camera rules for ordinary photos', async () => {
    // A normal photo still cannot claim to be offline-stamped: its time is the server's
    const ch = await api().post('/api/v1/capture/challenge').set(auth(tech.token)).send({ purpose: 'CHECK_OUT' });
    const res = await api()
      .post('/api/v1/capture/upload')
      .set(auth(tech.token))
      .field('challengeId', ch.body.challengeId)
      .field('nonce', ch.body.nonce)
      .field('deviceTime', ago(120).toISOString())
      .attach('photo', jpeg(), 'p.jpg');
    expect(res.status).toBe(201);
    expect(res.body.flags).toContain('DEVICE_CLOCK_SKEW');
    expect(res.body.flags).not.toContain('OFFLINE_CAPTURE');
  });
});
