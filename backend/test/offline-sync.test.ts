import { describe, expect, it } from 'vitest';
import { api, auth, CHECKLIST, createTask, jpeg, login, newTechnician, REPORT } from './helpers';

/** What the app's outbox does when the signal returns: the photo (taken earlier, offline), then the action. */
async function offlinePhoto(token: string, purpose: string, takenAt: Date, key: string, file = jpeg(), taskId?: string) {
  const ch = await api().post('/api/v1/capture/challenge').set(auth(token)).send({ purpose, taskId });
  return api()
    .post('/api/v1/capture/upload')
    .set(auth(token))
    .set('Idempotency-Key', key)
    .field('challengeId', ch.body.challengeId)
    .field('nonce', ch.body.nonce)
    .field('deviceTime', takenAt.toISOString())
    .field('offline', '1')
    .field('lat', '-1.185254')
    .field('lng', '36.903793')
    .attach('photo', file, 'p.jpg');
}

describe('work done offline, sent later (the outbox)', () => {
  it('keeps the real time of an offline check-in and does each change once, however often it is sent', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const takenAt = new Date(Date.now() - 40 * 60_000);
    const k = `${Date.now()}`;

    // The photo: sent, then sent again because the answer was lost: same photo back, no "duplicate photo"
    const file = jpeg();
    const p1 = await offlinePhoto(tech.token, 'CHECK_IN', takenAt, `photo-${k}`, file);
    expect(p1.status).toBe(201);
    expect(p1.body.flags).toContain('OFFLINE_CAPTURE');
    const p2 = await offlinePhoto(tech.token, 'CHECK_IN', takenAt, `photo-${k}`, file);
    expect(p2.status).toBe(201);
    expect(p2.headers['idempotent-replay']).toBe('true');
    expect(p2.body.photoId).toBe(p1.body.photoId);

    // The check-in: twice with the same key gives one check-in, at the time the photo was taken
    const send = () => api().post('/api/v1/attendance/check-in').set(auth(tech.token)).set('Idempotency-Key', `in-${k}`).send({ photoId: p1.body.photoId, checklist: CHECKLIST });
    const a = await send();
    const b = await send();
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.record.id).toBe(a.body.record.id);
    expect(Math.abs(Date.parse(a.body.record.checkInAt) - takenAt.getTime())).toBeLessThan(1000);

    // Another person cannot replay someone else's key
    const other = await newTechnician(admin);
    const c = await api().post('/api/v1/attendance/check-in').set(auth(other.token)).set('Idempotency-Key', `in-${k}`).send({ photoId: p1.body.photoId, checklist: CHECKLIST });
    expect(c.headers['idempotent-replay']).toBeUndefined();
    expect(c.status).toBe(400);

    // A refused change is remembered too (sending it again gives the same answer, not a new attempt)
    const bad = () => api().post('/api/v1/inventory/use').set(auth(tech.token)).set('Idempotency-Key', `use-${k}`).send({ itemId: 'nope', quantity: 1, note: 'Customer call-out' });
    const r1 = await bad();
    const r2 = await bad();
    expect(r1.status).toBeGreaterThanOrEqual(400);
    expect(r2.status).toBe(r1.status);
    expect(r2.headers['idempotent-replay']).toBe('true');
  });

  it('accepts a whole offline day in order: start, finish with report, daily report, check-out', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const k = `${Date.now()}`;
    const inPhoto = await offlinePhoto(tech.token, 'CHECK_IN', new Date(Date.now() - 5 * 3_600_000), `p0-${k}`);
    expect((await api().post('/api/v1/attendance/check-in').set(auth(tech.token)).set('Idempotency-Key', `a-${k}`).send({ photoId: inPhoto.body.photoId, checklist: CHECKLIST })).status).toBe(201);
    const task = await createTask(admin, tech.user.id, { type: 'REPAIR' });

    const startedAt = new Date(Date.now() - 3 * 3_600_000);
    const sp = await offlinePhoto(tech.token, 'TASK_START', startedAt, `p1-${k}`, jpeg(), task.id);
    const start = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).set('Idempotency-Key', `s-${k}`).send({ photoId: sp.body.photoId });
    expect(start.status).toBe(200);
    expect(Math.abs(Date.parse(start.body.task.startedAt) - startedAt.getTime())).toBeLessThan(1000);

    const ep = await offlinePhoto(tech.token, 'TASK_END', new Date(Date.now() - 2 * 3_600_000), `p2-${k}`, jpeg(), task.id);
    const done = () => api().post(`/api/v1/tasks/${task.id}/complete`).set(auth(tech.token)).set('Idempotency-Key', `c-${k}`).send({ photoId: ep.body.photoId, report: REPORT });
    expect((await done()).status).toBe(200);
    expect((await done()).status).toBe(200); // sent twice: still one completion

    const report = await api().post('/api/v1/day-reports').set(auth(tech.token)).set('Idempotency-Key', `d-${k}`).send({});
    expect(report.status).toBeLessThan(300);
    const outPhoto = await offlinePhoto(tech.token, 'CHECK_OUT', new Date(Date.now() - 60 * 60_000), `p3-${k}`);
    const out = await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).set('Idempotency-Key', `o-${k}`).send({ photoId: outPhoto.body.photoId });
    expect(out.status).toBe(200);

    // The office sees the daily report
    const list = (await api().get('/api/v1/day-reports').set(auth(admin))).body;
    const rows = list.reports ?? list.items ?? [];
    expect(rows.some((r: { submittedBy?: { id: string }; submittedById?: string }) => (r.submittedBy?.id ?? r.submittedById) === tech.user.id)).toBe(true);
  });
});
