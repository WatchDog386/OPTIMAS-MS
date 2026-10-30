import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician, receiveSerials } from './helpers';

describe('role-based access', () => {
  let admin: string, sup: string, store: string, tech: string, customer: string;
  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
    sup = (await login('FBI-SUP-001')).token;
    store = (await login('FBI-STR-001')).token;
    tech = (await login('FBI-TEC-001')).token;
    customer = (await login('FBI-CUS-10421')).token;
  });

  it('keeps customers out of every staff endpoint', async () => {
    for (const path of ['/users', '/tasks', '/inventory/items', '/inventory/my', '/attendance/today', '/reports/me', '/exports/jobs.xlsx', '/requests', '/search?q=ab', '/audit']) {
      const res = await api().get(`/api/v1${path}`).set(auth(customer));
      expect([401, 403], path).toContain(res.status);
    }
  });

  it('keeps technicians out of management endpoints', async () => {
    for (const [method, path] of [
      ['get', '/reports/dashboard'],
      ['get', '/inventory/reconciliation'],
      ['get', '/attendance'],
      ['get', '/requests'],
      ['get', '/audit'],
      ['post', '/tasks'],
      ['post', '/users'],
      ['post', '/inventory/issue'],
    ] as const) {
      const res = await api()[method](`/api/v1${path}`).set(auth(tech)).send({});
      expect(res.status, path).toBe(403);
    }
  });

  it('only admins manage staff; supervisors manage technicians and customers', async () => {
    const asSup = await api().post('/api/v1/users').set(auth(sup)).send({ staffNo: 'ACC-ADM-X', name: 'Would-be admin', role: 'ADMIN' });
    expect(asSup.status).toBe(403);
    const tech1 = await api().post('/api/v1/users').set(auth(sup)).send({ staffNo: 'ACC-TEC-1', name: 'New Tech', role: 'TECHNICIAN' });
    expect(tech1.status).toBe(201);
    const cust = await api().post('/api/v1/users').set(auth(sup)).send({ name: 'New Customer', role: 'CUSTOMER', customerAccount: 'fbi-cus-55555' });
    expect(cust.status).toBe(201);
    expect(cust.body.user.staffNo).toBe('FBI-CUS-55555'); // customers sign in with their account number
    const noAcct = await api().post('/api/v1/users').set(auth(sup)).send({ staffNo: 'ACC-C-2', name: 'Bad Customer', role: 'CUSTOMER' });
    expect(noAcct.status).toBe(400);
    expect((await api().post('/api/v1/users').set(auth(store)).send({ staffNo: 'ACC-TEC-2', name: 'Nope', role: 'TECHNICIAN' })).status).toBe(403);
  });

  it('protects against lock-outs and orphaned devices', async () => {
    const me = await login('FBI-ADM-001');
    expect((await api().patch(`/api/v1/users/${me.user.id}`).set(auth(admin)).send({ active: false })).status).toBe(400);
    expect((await api().patch(`/api/v1/users/${me.user.id}`).set(auth(admin)).send({ role: 'SUPERVISOR' })).status).toBe(400);

    const holder = await newTechnician(admin);
    const { serials } = await receiveSerials(store, 'RTR-TP-C6', 1);
    await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: holder.user.id, serials });
    const deact = await api().patch(`/api/v1/users/${holder.user.id}`).set(auth(admin)).send({ active: false });
    expect(deact.body.error.code).toBe('HOLDS_DEVICES');

    const crossing = await api().patch(`/api/v1/users/${holder.user.id}`).set(auth(admin)).send({ role: 'CUSTOMER' });
    expect(crossing.status).toBe(400);
  });

  it('resets passwords with a one-time password and audits admin actions', async () => {
    const t = await newTechnician(admin);
    const reset = await api().post(`/api/v1/users/${t.user.id}/reset-password`).set(auth(sup)).send({});
    expect(reset.status).toBe(200);
    expect((await login(((await api().get(`/api/v1/users/${t.user.id}`).set(auth(sup))).body.user.staffNo as string), reset.body.temporaryPassword)).user.mustChangePassword).toBe(true);
    const log = await api().get('/api/v1/audit?limit=20').set(auth(admin));
    expect(log.body.entries.some((e: { action: string; entityId: string }) => e.action === 'PASSWORD_RESET' && e.entityId === t.user.id)).toBe(true);
    expect((await api().get('/api/v1/audit').set(auth(sup))).status).toBe(403);
  });
});

describe('customer account edits', () => {
  it('moves the login id with the account number and refuses duplicates', async () => {
    const sup = (await login('FBI-SUP-001')).token;
    const a = await api().post('/api/v1/users').set(auth(sup)).send({ name: 'Edit Me', role: 'CUSTOMER', customerAccount: 'FBI-CUS-70001', password: 'Cust-pass-1' });
    await api().post('/api/v1/users').set(auth(sup)).send({ name: 'Taken', role: 'CUSTOMER', customerAccount: 'FBI-CUS-70002', password: 'Cust-pass-1' });
    const moved = await api().patch(`/api/v1/users/${a.body.user.id}`).set(auth(sup)).send({ customerAccount: 'fbi-cus-70003' });
    expect(moved.body.user.staffNo).toBe('FBI-CUS-70003');
    expect((await login('FBI-CUS-70003', 'Cust-pass-1')).user.role).toBe('CUSTOMER');
    const dup = await api().patch(`/api/v1/users/${a.body.user.id}`).set(auth(sup)).send({ customerAccount: 'FBI-CUS-70002' });
    expect(dup.status).toBe(409);
    const blank = await api().patch(`/api/v1/users/${a.body.user.id}`).set(auth(sup)).send({ customerAccount: '' });
    expect(blank.status).toBe(400);
  });
});
