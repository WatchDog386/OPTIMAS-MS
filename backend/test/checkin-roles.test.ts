import { describe, expect, it } from 'vitest';
import { CHECKLIST, api, auth, checkIn, login, photoId } from './helpers';

describe('who checks in', () => {
  it('everyone on staff checks in except admins', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const refused = await api().post('/api/v1/attendance/check-in').set(auth(admin)).send({ photoId: await photoId(admin, 'CHECK_IN'), checklist: CHECKLIST });
    expect(refused.status).toBe(403);

    // A supervisor and a customer-care agent can (each once a day)
    const sup = (await login('FBI-SUP-001')).token;
    const today = await api().get('/api/v1/attendance/today').set(auth(sup));
    if (!today.body.record) expect((await checkIn(sup)).status).toMatch(/PRESENT|LATE/);
    const staffNo = `FBI-CC-${Date.now().toString(36)}`.toUpperCase();
    await api().post('/api/v1/users').set(auth(admin)).send({ staffNo, name: 'Care Shift', role: 'CUSTOMER_CARE', password: 'Care-pass-123' });
    const care = (await login(staffNo, 'Care-pass-123')).token;
    expect((await checkIn(care)).status).toMatch(/PRESENT|LATE/);

    // They show on the supervisors' register
    const register = await api().get('/api/v1/attendance').set(auth(sup));
    expect(register.body.records.some((r: { user: { staffNo: string } }) => r.user.staffNo === staffNo)).toBe(true);
  });
});
