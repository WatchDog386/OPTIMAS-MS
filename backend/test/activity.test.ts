import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, eventually, login, newTechnician, photoId } from './helpers';

type N = { type: string; title: string; body: string; data?: { actorId?: string; taskId?: string } };
const inbox = (token: string) => api().get('/api/v1/notifications?limit=200').set(auth(token));

describe('activity alerts: managers hear about everything people do', () => {
  it('tells admins and supervisors when a technician checks in and starts a job, but not the technician', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const sup = (await login('FBI-SUP-001')).token;
    const tech = await newTechnician(admin);
    const record = await checkIn(tech.token);
    const task = await createTask(sup, tech.user.id);
    expect((await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) })).status).toBe(200);

    const mine = (r: { body: { notifications: N[] } }) => r.body.notifications.filter((x) => x.type === 'ACTIVITY' && x.data?.actorId === tech.user.id);
    // A late check-in has its own "checked in late" alert, so the feed only reports on-time ones
    const want = record.status === 'LATE' ? 1 : 2;
    const seen = await eventually(() => inbox(admin), (r) => mine(r).length >= want);
    const titles = mine(seen).map((x) => x.title);
    expect(titles.some((t) => /checked in$/.test(t))).toBe(record.status !== 'LATE');
    const started = mine(seen).find((x) => x.title.includes(`started job ${task.code}`));
    expect(started?.data?.taskId).toBe(task.id);
    // The supervisor who created the job hears about the technician too, but not about their own action
    const supInbox = await eventually(() => inbox(sup), (r) => mine(r).length >= want);
    const supId = (await login('FBI-SUP-001')).user.id;
    const adminInbox = (await inbox(admin)).body.notifications as N[];
    expect(supInbox.body.notifications.some((x: N) => x.type === 'ACTIVITY' && x.data?.actorId === supId)).toBe(false);
    // …while the admin is told the supervisor created it
    expect(adminInbox.some((x) => x.type === 'ACTIVITY' && x.data?.actorId === supId && x.title.includes(`created job ${task.code}`))).toBe(true);
    // Nobody is told about their own actions
    const techInbox = await inbox(tech.token);
    expect(techInbox.body.notifications.some((x: N) => x.type === 'ACTIVITY' && x.data?.actorId === tech.user.id)).toBe(false);
    // A failed action says nothing
    const before = mine(await inbox(admin)).length;
    expect((await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: 'nope' })).status).toBeGreaterThanOrEqual(400);
    await new Promise((r) => setTimeout(r, 300));
    expect(mine(await inbox(admin)).length).toBe(before);
  });
});
