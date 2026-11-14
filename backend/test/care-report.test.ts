import { describe, expect, it } from 'vitest';
import { api, auth, jpeg, login, photoId, CHECKLIST } from './helpers';

async function newCare(admin: string) {
  const staffNo = `CC-${Date.now().toString(36)}`.toUpperCase();
  const res = await api().post('/api/v1/users').set(auth(admin)).send({ staffNo, name: 'Faith Njeri', role: 'CUSTOMER_CARE', password: 'Care-pass-123' });
  expect(res.status).toBe(201);
  return login(staffNo, 'Care-pass-123');
}

describe("customer care's daily report (a file from the call-centre system)", () => {
  it('must be uploaded before check-out, replaces itself the same day, and the office can open it', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const care = await newCare(admin);
    const checkIn = await api().post('/api/v1/attendance/check-in').set(auth(care.token)).send({ photoId: await photoId(care.token, 'CHECK_IN'), checklist: CHECKLIST });
    expect(checkIn.status).toBe(201);

    // Check-out waits for the report
    expect((await api().get('/api/v1/attendance/checkout-ready').set(auth(care.token))).body).toMatchObject({ ready: false, needsDayReport: true });
    const early = await api().post('/api/v1/attendance/check-out').set(auth(care.token)).send({ photoId: await photoId(care.token, 'CHECK_OUT') });
    expect(early.body.error.code).toBe('DAY_REPORT_MISSING');

    // Wrong kind of file, and no file
    expect((await api().post('/api/v1/day-reports/upload').set(auth(care.token)).attach('file', Buffer.from('MZ'), 'tool.exe')).body.error.code).toBe('FILE_TYPE');
    expect((await api().post('/api/v1/day-reports/upload').set(auth(care.token)).field('note', 'x')).body.error.code).toBe('FILE_REQUIRED');
    // Technicians send the task-based report instead
    const tech = await login('FBI-TEC-002');
    expect((await api().post('/api/v1/day-reports/upload').set(auth(tech.token)).attach('file', Buffer.from('a,b'), 'r.csv')).status).toBe(403);

    const csv = Buffer.from('Agent,Calls,Resolved\nFaith,48,41\n');
    const up = await api().post('/api/v1/day-reports/upload').set(auth(care.token)).field('note', '7 escalated to field').attach('file', csv, 'calls-14-nov.csv');
    expect(up.status).toBe(201);
    expect(up.body.report).toMatchObject({ fileName: 'calls-14-nov.csv', fileType: 'text/csv' });
    // Sent again: one report for the day, with the new file
    const again = await api().post('/api/v1/day-reports/upload').set(auth(care.token)).attach('file', jpeg(), 'screenshot.jpg');
    expect(again.body.report.id).toBe(up.body.report.id);
    expect(again.body.report.fileName).toBe('screenshot.jpg');

    // The office lists it and downloads the file; another person cannot
    const list = (await api().get('/api/v1/day-reports').set(auth(admin))).body.reports;
    expect(list.some((r: { id: string; fileName: string }) => r.id === up.body.report.id && r.fileName === 'screenshot.jpg')).toBe(true);
    const file = await api().get(`/api/v1/day-reports/${up.body.report.id}/file`).set(auth(admin));
    expect(file.status).toBe(200);
    expect(file.headers['content-disposition']).toContain('screenshot.jpg');
    expect((await api().get(`/api/v1/day-reports/${up.body.report.id}/file`).set(auth(tech.token))).status).toBe(403);

    // Now check-out goes through
    expect((await api().get('/api/v1/attendance/checkout-ready').set(auth(care.token))).body.ready).toBe(true);
    const out = await api().post('/api/v1/attendance/check-out').set(auth(care.token)).send({ photoId: await photoId(care.token, 'CHECK_OUT') });
    expect(out.status).toBe(200);
  });
});
