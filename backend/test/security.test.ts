import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician, PASSWORD } from './helpers';

describe('access follows the account, not just the token', () => {
  let admin: string;
  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
  });

  it('locks out a deactivated person on their very next request', async () => {
    const tech = await newTechnician(admin);
    expect((await api().get('/api/v1/auth/me').set(auth(tech.token))).status).toBe(200);
    const off = await api().patch(`/api/v1/users/${tech.user.id}`).set(auth(admin)).send({ active: false });
    expect(off.status).toBe(200);
    const after = await api().get('/api/v1/tasks').set(auth(tech.token));
    expect(after.status).toBe(401);
    // …and they come back the moment they are reactivated
    await api().patch(`/api/v1/users/${tech.user.id}`).set(auth(admin)).send({ active: true });
    expect((await api().get('/api/v1/tasks').set(auth(tech.token))).status).toBe(200);
  });

  it('takes powers away as soon as a role is lowered', async () => {
    const created = await api()
      .post('/api/v1/users')
      .set(auth(admin))
      .send({ staffNo: `SUP-${Date.now().toString(36)}`.toUpperCase(), name: 'Temp Supervisor', role: 'SUPERVISOR', password: 'Super-pass-123' });
    expect(created.status).toBe(201);
    const sup = await login(created.body.user.staffNo, 'Super-pass-123');
    expect((await api().get('/api/v1/reports/dashboard').set(auth(sup.token))).status).toBe(200);
    const demote = await api().patch(`/api/v1/users/${created.body.user.id}`).set(auth(admin)).send({ role: 'TECHNICIAN' });
    expect(demote.status).toBe(200);
    expect((await api().get('/api/v1/reports/dashboard').set(auth(sup.token))).status).toBe(403);
  });
});

describe('platform safeguards', () => {
  it('reports health only while the database answers', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('manager insights', () => {
  let admin: string, sup: string, tech: string, customer: string;
  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
    sup = (await login('FBI-SUP-001', PASSWORD)).token;
    tech = (await login('FBI-TEC-001')).token;
    customer = (await login('FBI-CUS-10421')).token;
  });

  const paths = ['/insights/leaderboard?range=week', '/insights/leaderboard?range=month', '/insights/map', '/insights/charts?days=14', '/insights/ratings'];

  it('is for admins and supervisors only', async () => {
    for (const p of paths) {
      expect((await api().get(`/api/v1${p}`).set(auth(admin))).status, p).toBe(200);
      expect((await api().get(`/api/v1${p}`).set(auth(sup))).status, p).toBe(200);
      expect((await api().get(`/api/v1${p}`).set(auth(tech))).status, p).toBe(403);
      expect([401, 403]).toContain((await api().get(`/api/v1${p}`).set(auth(customer))).status);
      expect((await api().get(`/api/v1${p}`)).status, p).toBe(401);
    }
  });

  it('returns the shapes the screens draw', async () => {
    const board = (await api().get('/api/v1/insights/leaderboard?range=week').set(auth(admin))).body;
    expect(board.leaders.length).toBeGreaterThan(0);
    expect(board.leaders[0]).toMatchObject({ rank: 1, jobs: expect.any(Number), score: expect.any(Number), rating: { count: expect.any(Number) } });
    const charts = (await api().get('/api/v1/insights/charts?days=7').set(auth(admin))).body;
    expect(charts.perDay).toHaveLength(7);
    expect(charts.perDay[0]).toEqual(expect.objectContaining({ date: expect.any(String), completed: expect.any(Number), collected: expect.any(Number) }));
    const map = (await api().get('/api/v1/insights/map').set(auth(admin))).body;
    expect(Array.isArray(map.staff) && Array.isArray(map.jobs)).toBe(true);
    const ratings = (await api().get('/api/v1/insights/ratings').set(auth(admin))).body;
    expect(ratings.distribution).toHaveLength(5);
  });
});
