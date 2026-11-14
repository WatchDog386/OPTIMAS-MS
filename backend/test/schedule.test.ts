import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { workDateOf } from '../src/lib/time';
import { releaseScheduledTasks } from '../src/modules/tasks/release';
import { api, auth, checkIn, eventually, login, newTechnician, photoId, REPORT } from './helpers';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const base = { type: 'INSTALLATION', title: 'Installation opp Aziel towers', customerName: 'Sato', customerPhone: '+254 740020387', address: 'Opp Aziel towers', description: 'Available Saturday, has a router' };

describe('tasks for a later day', () => {
  it('stays out of the technician\'s way until its day, then goes out with a notice', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const tomorrow = ymd(new Date(workDateOf().getTime() + 86_400_000));
    expect((await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, assigneeId: tech.user.id, scheduledFor: ymd(new Date(workDateOf().getTime() - 86_400_000)) })).status).toBe(400);
    const made = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, assigneeId: tech.user.id, scheduledFor: tomorrow });
    expect(made.status).toBe(201);
    const id = made.body.task.id;
    expect(made.body.task.scheduledFor.slice(0, 10)).toBe(tomorrow);

    // Not in the technician's list, no notice, cannot be started; the office sees it under Scheduled
    expect((await api().get('/api/v1/tasks').set(auth(tech.token))).body.tasks.map((t: { id: string }) => t.id)).not.toContain(id);
    const scheduled = await api().get('/api/v1/tasks?scheduled=1').set(auth(admin));
    const row = scheduled.body.tasks.find((t: { id: string }) => t.id === id);
    expect(row.createdBy.name).toBeTruthy();
    expect((await api().get('/api/v1/notifications').set(auth(tech.token))).body.notifications.some((n: { data?: { taskId?: string } }) => n.data?.taskId === id)).toBe(false);
    await checkIn(tech.token);
    const early = await api().post(`/api/v1/tasks/${id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', id) });
    expect(early.body.error.code).toBe('NOT_YET');

    // Its day comes
    await prisma.task.update({ where: { id }, data: { scheduledFor: workDateOf() } });
    await releaseScheduledTasks();
    const inbox = await eventually(
      () => api().get('/api/v1/notifications').set(auth(tech.token)),
      (r) => r.body.notifications.some((n: { title: string }) => n.title.startsWith('Today task')),
    );
    expect(inbox.body.notifications.find((n: { title: string }) => n.title.startsWith('Today task')).data.taskId).toBe(id);
    const today = await api().get('/api/v1/tasks?created=today').set(auth(tech.token));
    expect(today.body.tasks.map((t: { id: string }) => t.id)).toContain(id);
    // Released once only
    await releaseScheduledTasks();
    const again = await api().get('/api/v1/notifications').set(auth(tech.token));
    expect(again.body.notifications.filter((n: { title: string }) => n.title.startsWith('Today task')).length).toBe(1);
  });

  it('works out the drop cable from the length marks, and the report shows them', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const t = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, type: 'REPAIR', title: 'Re-run drop', assigneeId: tech.user.id });
    expect(t.body.task.createdBy.name).toBeTruthy();
    await checkIn(tech.token);
    await api().post(`/api/v1/tasks/${t.body.task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', t.body.task.id) });
    const done = await api()
      .post(`/api/v1/tasks/${t.body.task.id}/complete`)
      .set(auth(tech.token))
      .send({ photoId: await photoId(tech.token, 'TASK_END', t.body.task.id), report: REPORT, dropStartM: 1240, dropEndM: 1210 });
    expect(done.status).toBe(200);
    expect(done.body.task).toMatchObject({ dropCableM: 30, dropStartM: 1240, dropEndM: 1210 });
    const text = (await api().get('/api/v1/day-reports/mine').set(auth(tech.token))).body.report.text as string;
    expect(text).toContain('Drop cable: 30 m (marks 1240 m → 1210 m)');
    const preview = await api().post('/api/v1/day-reports/preview').set(auth(tech.token)).send({ extra: [{ type: 'Installation', location: 'Kware', cableStart: 500, cableEnd: 455 }] });
    expect(preview.body.report.text).toContain('Drop cable: 45 m (marks 500 m → 455 m)');
  });

  it('takes the cable mark before at the start and the mark after at the end', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const t = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, type: 'REPAIR', title: 'New drop run', assigneeId: tech.user.id });
    await checkIn(tech.token);
    const started = await api().post(`/api/v1/tasks/${t.body.task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', t.body.task.id), dropStartM: 860 });
    expect(started.body.task.dropStartM).toBe(860);
    const done = await api()
      .post(`/api/v1/tasks/${t.body.task.id}/complete`)
      .set(auth(tech.token))
      .send({ photoId: await photoId(tech.token, 'TASK_END', t.body.task.id), report: REPORT, amountCollected: 0, signal: '-22 dBm', dropEndM: 815 });
    expect(done.status).toBe(200);
    expect(done.body.task).toMatchObject({ dropStartM: 860, dropEndM: 815, dropCableM: 45 });
  });
});
