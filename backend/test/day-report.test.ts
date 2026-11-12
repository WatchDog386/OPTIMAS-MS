import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, eventually, login, newTechnician, photoId, REPORT } from './helpers';

/** Starts and finishes a task with its task report (as the person given). */
async function doTask(token: string, taskId: string, report: Record<string, unknown>) {
  expect((await api().post(`/api/v1/tasks/${taskId}/start`).set(auth(token)).send({ photoId: await photoId(token, 'TASK_START', taskId) })).status).toBe(200);
  const done = await api()
    .post(`/api/v1/tasks/${taskId}/complete`)
    .set(auth(token))
    .send({ photoId: await photoId(token, 'TASK_END', taskId), report: REPORT, ...report });
  expect(done.status).toBe(200);
  return done.body.task;
}

describe('end-of-day report', () => {
  it('the team leader sends one report for the team, built from the task reports', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [lead, helper] = await Promise.all([newTechnician(admin), newTechnician(admin)]);
    const name = `Team ${Date.now().toString(36)}`;
    const base = { type: 'MAINTENANCE', customerName: 'Congo', address: 'Kware, Terena Apartments' };
    const t1 = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, title: 'Installation Congo', newTeam: { name, memberIds: [lead.user.id, helper.user.id], leaderId: lead.user.id } });
    const teamId = t1.body.task.team.id;
    const t2 = await api().post('/api/v1/tasks').set(auth(admin)).send({ ...base, title: 'Second install', customerName: 'Kware client', teamId });
    await checkIn(lead.token);

    const done = await doTask(lead.token, t1.body.task.id, { signal: '-27 dBm', houseNo: 'D3', dropCableM: 30, fatPreinstalled: true, amountCollected: 3000 });
    expect(done).toMatchObject({ signal: '-27 dBm', houseNo: 'D3', dropCableM: 30, fatPreinstalled: true });
    await doTask(lead.token, t2.body.task.id, { signal: '-24', dropCableM: 0, fatPreinstalled: true, amountCollected: 3000 });

    // The helper is told the leader sends it
    const helperView = await api().get('/api/v1/day-reports/mine').set(auth(helper.token));
    expect(helperView.body.report.canSubmit).toBe(false);
    expect(helperView.body.report.reason).toContain('sends the team');
    expect((await api().post('/api/v1/day-reports').set(auth(helper.token)).send({})).status).toBe(403);

    const mine = await api().get('/api/v1/day-reports/mine').set(auth(lead.token));
    const r = mine.body.report;
    expect(r).toMatchObject({ canSubmit: true, tasksDone: 2, collected: 6000, cable: 30, team: { name } });
    expect(r.members.map((m: { name: string }) => m.name)).toEqual([lead.user.name, helper.user.name]);
    for (const bit of [`*Daily report — ${name}*`, '*Members*', `1. ${lead.user.name} (leader)`, `2. ${helper.user.name}`, '*Task 1 — Maintenance*', 'Location: Kware, Terena Apartments · House D3', 'Signal: -27 dBm', 'Client paid: KES 3,000', 'Drop cable: 30 m', 'FAT pre-installed: Yes', '*Task 2 — Maintenance*', 'Tasks completed: 2', 'Client paid in total: KES 6,000']) {
      expect(r.text).toContain(bit);
    }

    const sent = await api().post('/api/v1/day-reports').set(auth(lead.token)).send({ note: 'All clients happy' });
    expect(sent.status).toBe(201);
    expect(sent.body.report.text).toContain('*Comments*\nAll clients happy');
    // Sending again the same day replaces it
    expect((await api().post('/api/v1/day-reports').set(auth(lead.token)).send({})).status).toBe(201);
    const list = await api().get('/api/v1/day-reports').set(auth(admin));
    expect(list.body.reports.filter((x: { submittedBy: { id: string } }) => x.submittedBy.id === lead.user.id)).toHaveLength(1);
    expect((await api().get('/api/v1/day-reports').set(auth(lead.token))).status).toBe(403);

    const inbox = await eventually(
      () => api().get('/api/v1/notifications').set(auth(admin)),
      (x) => x.body.notifications.some((n: { type: string; title: string }) => n.type === 'DAY_REPORT' && n.title.includes(name)),
    );
    const note = inbox.body.notifications.find((n: { type: string; title: string }) => n.type === 'DAY_REPORT' && n.title.includes(name));
    expect(note.body).toContain('2 tasks completed');
    expect((await api().get(`/api/v1/day-reports/${note.data.dayReportId}`).set(auth(admin))).body.report.tasksDone).toBe(2);
  });

  it('the report form: corrects today\'s task fields and adds tasks done outside the app', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const r2 = await api().post('/api/v1/tasks').set(auth(admin)).send({ type: 'REPAIR', title: 'Fix', customerName: 'Baraka', address: 'Zimmerman', assigneeId: tech.user.id });
    expect((await api().post(`/api/v1/tasks/${r2.body.task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', r2.body.task.id) })).status).toBe(200);
    expect((await api().get('/api/v1/day-reports/mine').set(auth(tech.token))).body.report.canSubmit).toBe(false);
    // Not finished yet: cannot be changed on the form
    expect((await api().patch(`/api/v1/day-reports/tasks/${r2.body.task.id}`).set(auth(tech.token)).send({ signal: '-20' })).status).toBe(403);
    expect((await api().post(`/api/v1/tasks/${r2.body.task.id}/complete`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_END', r2.body.task.id), report: REPORT })).status).toBe(200);

    const fixed = await api().patch(`/api/v1/day-reports/tasks/${r2.body.task.id}`).set(auth(tech.token)).send({ signal: '-22 dBm', houseNo: 'B12', amountCollected: 500, dropCableM: 5, fatPreinstalled: false });
    expect(fixed.status).toBe(200);
    expect((await api().patch(`/api/v1/day-reports/tasks/${r2.body.task.id}`).set(auth(admin)).send({ signal: 'x' })).status).toBe(403);

    const extra = [{ type: 'Installation', customer: 'Congo', location: 'Kware, Congo', signal: '-27 dBm', paid: 3000, materials: ['1 ATB', '1 patch cord', '1 router'], cableM: 30, fat: true }];
    const preview = await api().post('/api/v1/day-reports/preview').set(auth(tech.token)).send({ extra });
    const text = preview.body.report.text as string;
    for (const bit of ['Location: Zimmerman · House B12', 'Signal: -22 dBm', 'Client paid: KES 500', 'FAT pre-installed: No', '*Task 2 — Installation*', 'Customer: Congo', '  3. 1 router', 'Drop cable: 30 m', 'Tasks completed: 2', 'Client paid in total: KES 3,500']) expect(text).toContain(bit);
    expect(preview.body.report.tasksDone).toBe(2);

    const sent = await api().post('/api/v1/day-reports').set(auth(tech.token)).send({ extra });
    expect(sent.status).toBe(201);
    expect(sent.body.report).toMatchObject({ tasksDone: 2, collected: 3500 });
    const mine = await api().get('/api/v1/day-reports/mine').set(auth(tech.token));
    expect(mine.body.sent.extra).toHaveLength(1);
  });
});
