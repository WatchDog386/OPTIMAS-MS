import { describe, expect, it } from 'vitest';
import { CHECKLIST, api, auth, checkIn, login, newTechnician, photoId } from './helpers';

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
    // Customer care upload the call-centre report before going home
    expect((await api().post('/api/v1/day-reports/upload').set(auth(care)).attach('file', Buffer.from('Calls,48'), 'calls.csv')).status).toBe(201);
    const checkout = await api()
      .post('/api/v1/attendance/check-out')
      .set(auth(care))
      .send({ photoId: await photoId(care, 'CHECK_OUT') });
    expect(checkout.status).toBe(200);
    expect(checkout.body.record.checkOutAt).toBeTruthy();

    // They show on the supervisors' register
    const register = await api().get('/api/v1/attendance').set(auth(sup));
    expect(register.body.records.some((r: { user: { staffNo: string } }) => r.user.staffNo === staffNo)).toBe(true);
  });
});

describe('office location', () => {
  it('is set by a supervisor standing at the office and used for check-in', async () => {
    const sup = (await login('FBI-SUP-001')).token;
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    // The same spot the other tests check photos against
    const spot = { lat: -1.2921, lng: 36.8219, radiusM: 300, name: 'Barber & Spa, Kahawa Station Rd' };
    expect((await api().put('/api/v1/attendance/office').set(auth(tech.token)).send(spot)).status).toBe(403);
    const set = await api().put('/api/v1/attendance/office').set(auth(sup)).send(spot);
    expect(set.status).toBe(200);
    const got = await api().get('/api/v1/attendance/office').set(auth(tech.token));
    expect(got.body.office).toMatchObject({ ...spot, source: 'app' });

    // A spot outside Nairobi (e.g. GPS gone wrong) is refused
    const far = await api().put('/api/v1/attendance/office').set(auth(sup)).send({ ...spot, lat: -4.04, lng: 39.66 });
    expect(far.status).toBe(400);
    expect(far.body.error.code).toBe('OUTSIDE_SERVICE_AREA');
    // Undo: back to the office from the settings, and only managers may do it
    expect((await api().delete('/api/v1/attendance/office').set(auth(tech.token))).status).toBe(403);
    const reset = await api().delete('/api/v1/attendance/office').set(auth(sup));
    expect(reset.status).toBe(200);
    expect(reset.body.office.source).toBe('settings');
  });
});
