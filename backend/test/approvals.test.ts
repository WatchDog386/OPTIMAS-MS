import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, auth, checkIn, createTask, eventually, login, newTechnician, photoId } from './helpers';

describe('the supervisor review desk', () => {
  let admin: string;
  let sup: string;
  let tech: { token: string; user: { id: string } };
  let other: { token: string; user: { id: string } };
  let attendanceId: string;
  let taskId: string;

  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
    sup = (await login('FBI-SUP-001')).token;
    tech = await newTechnician(admin);
    other = await newTechnician(admin);
    attendanceId = (await checkIn(tech.token)).id;
    // a repair job (no device or signature needed) taken through start and completion
    const task = await createTask(sup, tech.user.id, { type: 'REPAIR' });
    taskId = task.id;
    expect((await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) })).status).toBe(200);
    expect((await api().post(`/api/v1/tasks/${task.id}/complete`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_END', task.id), notes: 'Replaced patch cord' })).status).toBe(200);
    expect((await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') })).status).toBe(200);
  });

  it('is for supervisors and admins only', async () => {
    for (const p of ['/approvals/summary', '/approvals/check-ins', '/approvals/check-outs', '/approvals/jobs', `/approvals/activity?userId=${tech.user.id}`]) {
      expect((await api().get(`/api/v1${p}`).set(auth(tech.token))).status, p).toBe(403);
      expect((await api().get(`/api/v1${p}`).set(auth(sup))).status, p).toBe(200);
    }
  });

  it('lists every submission with its photos waiting for review', async () => {
    const summary = (await api().get('/api/v1/approvals/summary').set(auth(sup))).body;
    expect(summary.checkIns).toBeGreaterThan(0);
    expect(summary.checkOuts).toBeGreaterThan(0);
    expect(summary.jobs).toBeGreaterThan(0);

    const ins = (await api().get('/api/v1/approvals/check-ins').set(auth(sup))).body.records;
    const mineIn = ins.find((r: { id: string }) => r.id === attendanceId);
    expect(mineIn.checkInPhoto.id).toBeTruthy();
    expect(mineIn.user.name).toBeTruthy();

    const outs = (await api().get('/api/v1/approvals/check-outs').set(auth(sup))).body.records;
    const mineOut = outs.find((r: { id: string }) => r.id === attendanceId);
    expect(mineOut.checkOutPhoto.id).toBeTruthy();
    expect(mineOut.checkInPhoto.id).toBeTruthy();

    const jobs = (await api().get('/api/v1/approvals/jobs').set(auth(sup))).body.tasks;
    const job = jobs.find((t: { id: string }) => t.id === taskId);
    expect(job.startPhoto.id && job.endPhoto.id).toBeTruthy();
    expect(job).not.toHaveProperty('customerSignature');
  });

  it('a rejected check-out needs a reason, and the technician is told', async () => {
    expect((await api().post(`/api/v1/attendance/${attendanceId}/review-checkout`).set(auth(sup)).send({ decision: 'REJECTED' })).status).toBe(400);
    const res = await api().post(`/api/v1/attendance/${attendanceId}/review-checkout`).set(auth(sup)).send({ decision: 'REJECTED', note: 'Face not visible' });
    expect(res.status).toBe(200);
    expect(res.body.record.checkOutReview).toBe('REJECTED');
    // the notice is sent in the background
    const n = await eventually(() => prisma.notification.findFirst({ where: { userId: tech.user.id, type: 'CHECKOUT_REJECTED' } }), (x) => !!x);
    expect(n?.body).toBe('Face not visible');
    const done = (await api().get('/api/v1/approvals/check-outs?status=DONE').set(auth(sup))).body.records;
    expect(done.find((r: { id: string }) => r.id === attendanceId)?.checkOutReviewedBy?.name).toBeTruthy();
  });

  it('approves the clean ones in one go, and never twice', async () => {
    const items = [
      { kind: 'CHECK_IN', id: attendanceId },
      { kind: 'JOB', id: taskId },
    ];
    const first = await api().post('/api/v1/approvals/bulk-approve').set(auth(sup)).send({ items });
    expect(first.body).toEqual({ approved: 2, skipped: 0 });
    expect((await prisma.task.findUnique({ where: { id: taskId } }))?.status).toBe('VERIFIED');
    expect((await prisma.attendance.findUnique({ where: { id: attendanceId } }))?.dressReview).toBe('APPROVED');
    const again = await api().post('/api/v1/approvals/bulk-approve').set(auth(sup)).send({ items });
    expect(again.body).toEqual({ approved: 0, skipped: 2 });
  });

  it('shows the whole day as a timeline, in order, with the photos', async () => {
    const day = (await api().get(`/api/v1/approvals/activity?userId=${tech.user.id}`).set(auth(sup))).body;
    const kinds = day.events.map((e: { kind: string }) => e.kind);
    expect(kinds.indexOf('CHECK_IN')).toBeLessThan(kinds.indexOf('JOB_START'));
    expect(kinds.indexOf('JOB_START')).toBeLessThan(kinds.indexOf('JOB_END'));
    expect(kinds.indexOf('JOB_END')).toBeLessThan(kinds.indexOf('CHECK_OUT'));
    expect(kinds).toContain('JOB_VERIFIED');
    expect(day.events.filter((e: { photo?: unknown }) => e.photo)).toHaveLength(4);
    expect(day.summary).toMatchObject({ jobsDone: 1, photos: 4, checkedIn: true });
  });

  it('gives photo details to the owner and supervisors, not to other technicians', async () => {
    const ins = (await api().get('/api/v1/approvals/check-ins?status=DONE').set(auth(sup))).body.records;
    const pid = ins.find((r: { id: string }) => r.id === attendanceId).checkInPhoto.id;
    const info = await api().get(`/api/v1/capture/photos/${pid}/info`).set(auth(sup));
    expect(info.status).toBe(200);
    expect(info.body.photo).toMatchObject({ purpose: 'CHECK_IN', user: { id: tech.user.id }, usedFor: { kind: 'ATTENDANCE', id: attendanceId } });
    expect((await api().get(`/api/v1/capture/photos/${pid}/info`).set(auth(tech.token))).status).toBe(200);
    expect((await api().get(`/api/v1/capture/photos/${pid}/info`).set(auth(other.token))).status).toBe(403);
  });
});
