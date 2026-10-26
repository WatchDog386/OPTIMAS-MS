import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createTask, login, newTechnician } from './helpers';

describe('search and admin reports', () => {
  let admin: string, sup: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001')).token;
  });

  it('scopes technician search to their own work', async () => {
    const a = await newTechnician(admin);
    const b = await newTechnician(admin);
    await createTask(sup, a.user.id, { customerName: 'Zebra Heights Unique' });
    await createTask(sup, b.user.id, { customerName: 'Zebra Heights Unique' });
    const asA = await api().get('/api/v1/search?q=zebra heights').set(auth(a.token));
    expect(asA.body.tasks).toHaveLength(1);
    expect(asA.body.staff).toHaveLength(0);
    const asSup = await api().get('/api/v1/search?q=zebra heights').set(auth(sup));
    expect(asSup.body.tasks.length).toBeGreaterThanOrEqual(2);
    expect((await api().get('/api/v1/search?q=z').set(auth(sup))).status).toBe(400);
  });

  it('serves the dashboard and Excel exports to managers', async () => {
    const dash = await api().get('/api/v1/reports/dashboard').set(auth(sup));
    expect(dash.status).toBe(200);
    expect(dash.body).toHaveProperty('requests.open');
    const xlsx = await api().get('/api/v1/exports/reconciliation.xlsx').set(auth(sup));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
  });

  it('returns a profile with stats for a team member', async () => {
    const t = await newTechnician(admin);
    const res = await api().get(`/api/v1/users/${t.user.id}`).set(auth(sup));
    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({ daysPresent30: 0, lateDays30: 0 });
    expect(res.body.custody.units).toEqual([]);
  });
});
