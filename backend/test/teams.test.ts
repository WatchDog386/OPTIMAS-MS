import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, eventually, login, newTechnician, photoId } from './helpers';

const job = { title: 'Mast install', type: 'MAINTENANCE', customerName: 'Team Customer', address: 'Ring Rd' };

describe('team jobs', () => {
  it('makes a team while assigning; the whole team sees the job; only the leader starts and reports it', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [lead, helper, outsider] = await Promise.all([newTechnician(admin), newTechnician(admin), newTechnician(admin)]);
    const name = `Crew ${Date.now().toString(36)}`;

    const created = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...job, newTeam: { name, memberIds: [lead.user.id, helper.user.id], leaderId: lead.user.id } });
    expect(created.status).toBe(201);
    const task = created.body.task;
    expect(task.assignee.id).toBe(lead.user.id);
    expect(task.team).toMatchObject({ name, leaderId: lead.user.id });
    expect(task.team.members).toHaveLength(2);

    // Both members have it in their list and can open it; someone else cannot
    for (const t of [lead, helper]) {
      const list = await api().get('/api/v1/tasks').set(auth(t.token));
      expect(list.body.tasks.map((x: { id: string }) => x.id)).toContain(task.id);
      expect((await api().get(`/api/v1/tasks/${task.id}`).set(auth(t.token))).status).toBe(200);
    }
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(auth(outsider.token))).status).toBe(403);

    // The helper was told who leads
    const inbox = await eventually(
      () => api().get('/api/v1/notifications').set(auth(helper.token)),
      (r) => r.body.notifications.some((n: { title: string }) => n.title.startsWith(name)),
    );
    expect(inbox.body.notifications.find((n: { title: string }) => n.title.startsWith(name)).body).toContain('leads and files the report');

    // Only the leader starts it
    await checkIn(helper.token);
    const helperStart = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(helper.token)).send({ photoId: await photoId(helper.token, 'TASK_START', task.id).catch(() => 'x') });
    expect(helperStart.status).toBe(403);
    expect(helperStart.body.error.message).toContain('files the report');
    await checkIn(lead.token);
    const started = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(lead.token)).send({ photoId: await photoId(lead.token, 'TASK_START', task.id) });
    expect(started.status).toBe(200);
  });

  it('reuses a saved team, refuses bad teams, and turns a team job back into a one-person job', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [a, b] = await Promise.all([newTechnician(admin), newTechnician(admin)]);
    const name = `Team ${Date.now().toString(36)}`;

    expect((await api().post('/api/v1/teams').set(auth(admin)).send({ name, memberIds: [a.user.id], leaderId: a.user.id })).status).toBe(400);
    expect((await api().post('/api/v1/teams').set(auth(admin)).send({ name, memberIds: [a.user.id, b.user.id], leaderId: 'someone-else' })).status).toBe(400);
    const team = await api().post('/api/v1/teams').set(auth(admin)).send({ name, memberIds: [a.user.id, b.user.id], leaderId: b.user.id });
    expect(team.status).toBe(201);
    expect((await api().post('/api/v1/teams').set(auth(admin)).send({ name: name.toUpperCase(), memberIds: [a.user.id, b.user.id], leaderId: b.user.id })).body.error.code).toBe('TEAM_EXISTS');
    expect((await api().post('/api/v1/teams').set(auth(a.token)).send({ name: 'x', memberIds: [a.user.id, b.user.id], leaderId: a.user.id })).status).toBe(403);

    const list = await api().get('/api/v1/teams').set(auth(admin));
    expect(list.body.teams.find((t: { id: string }) => t.id === team.body.team.id)).toMatchObject({ name, openJobs: 0 });

    const t = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...job, teamId: team.body.team.id });
    expect(t.body.task.assignee.id).toBe(b.user.id);
    expect((await api().delete(`/api/v1/teams/${team.body.team.id}`).set(auth(admin))).body.error.code).toBe('TEAM_BUSY');

    // Back to one technician: the team no longer sees it
    const solo = await api().patch(`/api/v1/tasks/${t.body.task.id}`).set(auth(admin)).send({ teamId: null, assigneeId: a.user.id });
    expect(solo.status).toBe(200);
    expect(solo.body.task.team).toBeNull();
    expect(solo.body.task.assignee.id).toBe(a.user.id);
    expect((await api().get(`/api/v1/tasks/${t.body.task.id}`).set(auth(b.token))).status).toBe(403);
    expect((await api().delete(`/api/v1/teams/${team.body.team.id}`).set(auth(admin))).status).toBe(204);
  });
});
