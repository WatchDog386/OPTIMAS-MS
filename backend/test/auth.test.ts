import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, login } from './helpers';

describe('authentication', () => {
  let admin: string;
  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
  });

  it('logs in by staff number or email, case-insensitively', async () => {
    expect((await login('opt-tec-001')).user.role).toBe('TECHNICIAN');
    expect((await login('supervisor@optimas.co.ke')).user.role).toBe('SUPERVISOR');
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await api().post('/api/v1/auth/login').send({ identifier: 'FBI-TEC-001', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid/i);
  });

  it('requires a token for protected routes and rejects garbage tokens', async () => {
    expect((await api().get('/api/v1/tasks')).status).toBe(401);
    expect((await api().get('/api/v1/tasks').set(auth('not-a-jwt'))).status).toBe(401);
  });

  it('forces a password change for admin-created accounts, enforcing the policy', async () => {
    const created = await api().post('/api/v1/users').set(auth(admin)).send({ staffNo: 'AUTH-T-1', name: 'Policy Person', role: 'TECHNICIAN' });
    expect(created.status).toBe(201);
    const temp = created.body.temporaryPassword as string;
    expect(temp).toMatch(/^Opt-/);

    const session = await login('AUTH-T-1', temp);
    expect(session.user.mustChangePassword).toBe(true);

    const weak = await api().post('/api/v1/auth/change-password').set(auth(session.token)).send({ currentPassword: temp, newPassword: 'short' });
    expect(weak.status).toBe(400);
    const wrong = await api().post('/api/v1/auth/change-password').set(auth(session.token)).send({ currentPassword: 'bad-current-1', newPassword: 'Strong-pass-9' });
    expect(wrong.status).toBe(400);
    const ok = await api().post('/api/v1/auth/change-password').set(auth(session.token)).send({ currentPassword: temp, newPassword: 'Strong-pass-9' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.mustChangePassword).toBe(false);
    expect((await login('AUTH-T-1', 'Strong-pass-9')).user.mustChangePassword).toBe(false);
  });

  it('blocks deactivated accounts from signing in', async () => {
    const created = await api().post('/api/v1/users').set(auth(admin)).send({ staffNo: 'AUTH-T-2', name: 'Leaver', role: 'TECHNICIAN', password: 'Leaver-pass-1' });
    await api().patch(`/api/v1/users/${created.body.user.id}`).set(auth(admin)).send({ active: false });
    const res = await api().post('/api/v1/auth/login').send({ identifier: 'AUTH-T-2', password: 'Leaver-pass-1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/deactivated/i);
  });
});
