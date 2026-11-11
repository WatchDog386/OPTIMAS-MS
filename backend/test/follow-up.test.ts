import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { runFollowUp } from '../src/modules/tasks/follow-up';
import { api, auth, checkIn, eventually, login, newTechnician, photoId } from './helpers';

const base = { type: 'REPAIR', title: 'No internet', customerName: 'Wanjiku', address: 'Roysambu, Hse 9' };
const inbox = async (token: string) => (await api().get('/api/v1/notifications').set(auth(token))).body.notifications as { title: string; type: string; data?: { taskId?: string } }[];

describe('assigned tasks are seen through', () => {
  it('blocks check-out until the task is reported (or handed back) and the daily report is sent', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const a = (await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, assigneeId: tech.user.id })).body.task;
    const b = (await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, title: 'Customer away', assigneeId: tech.user.id })).body.task;

    let ready = (await api().get('/api/v1/attendance/checkout-ready').set(auth(tech.token))).body;
    expect(ready.ready).toBe(false);
    expect(ready.tasks.map((t: { id: string }) => t.id).sort()).toEqual([a.id, b.id].sort());
    const out = await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') });
    expect(out.body.error.code).toBe('TASKS_NOT_REPORTED');

    // One cannot be done: handed back with a reason; the office hears and it waits to be assigned again
    expect((await api().post(`/api/v1/tasks/${b.id}/unable`).set(auth(tech.token)).send({ reason: 'x' })).status).toBe(400);
    const back = await api().post(`/api/v1/tasks/${b.id}/unable`).set(auth(tech.token)).send({ reason: 'Customer travelled, gate locked' });
    expect(back.body.task).toMatchObject({ status: 'OPEN', assignee: null, returnNote: expect.stringContaining('gate locked') });
    expect((await eventually(() => inbox(admin), (l) => l.some((n) => n.title.includes(`could not do ${b.code}`)))).some((n) => n.title.includes(`could not do ${b.code}`))).toBe(true);

    // The other is done with its report: now the daily report is what is missing
    await api().post(`/api/v1/tasks/${a.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', a.id) });
    await api().post(`/api/v1/tasks/${a.id}/complete`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_END', a.id), notes: 'Replaced the patch cord' });
    ready = (await api().get('/api/v1/attendance/checkout-ready').set(auth(tech.token))).body;
    expect(ready).toMatchObject({ ready: false, tasks: [], needsDayReport: true });
    const out2 = await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') });
    expect(out2.body.error.code).toBe('DAY_REPORT_MISSING');
    expect((await api().post('/api/v1/day-reports').set(auth(tech.token)).send({})).status).toBe(201);
    expect((await api().get('/api/v1/attendance/checkout-ready').set(auth(tech.token))).body.ready).toBe(true);
    expect((await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') })).status).toBe(200);
  });

  it('reminds the technician until the task is opened, and tells the office once', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const t = (await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, assigneeId: tech.user.id })).body.task;
    // Given 40 minutes ago and not opened
    await prisma.task.update({ where: { id: t.id }, data: { assignedAt: new Date(Date.now() - 40 * 60_000) } });
    await runFollowUp(new Date(), { anyHour: true });
    expect((await inbox(tech.token)).some((n) => n.title.startsWith('Open your new task') && n.data?.taskId === t.id)).toBe(true);
    const alerts = async () => (await inbox(admin)).filter((n) => n.title.includes(`has not opened ${t.code}`)).length;
    expect(await alerts()).toBe(1);
    await runFollowUp(new Date(), { anyHour: true });
    expect(await alerts()).toBe(1);

    // Opening it counts as seen; the office sees when
    const opened = await api().get(`/api/v1/tasks/${t.id}`).set(auth(tech.token));
    expect(opened.body.task.seenAt).toBeTruthy();
    expect((await api().get(`/api/v1/tasks/${t.id}`).set(auth(admin))).body.task.seenAt).toBeTruthy();

    // Started long ago and not reported: reminded to finish, office told
    await checkIn(tech.token);
    await api().post(`/api/v1/tasks/${t.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', t.id) });
    await prisma.task.update({ where: { id: t.id }, data: { startedAt: new Date(Date.now() - 6 * 3600_000), lastReminderAt: null } });
    await runFollowUp(new Date(), { anyHour: true });
    expect((await inbox(tech.token)).some((n) => n.title === `Finish ${t.code} and send the report`)).toBe(true);
    expect((await inbox(admin)).some((n) => n.title === `${t.code} still in progress`)).toBe(true);
  });
});
