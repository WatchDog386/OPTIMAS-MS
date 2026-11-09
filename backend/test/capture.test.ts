import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, capture, CHECKLIST, eventually, jpeg, login, newTechnician, photoId } from './helpers';

describe('camera-only photo integrity', () => {
  let tech: string;
  beforeAll(async () => {
    tech = (await newTechnician((await login('FBI-ADM-001')).token)).token;
  });

  it('accepts a live capture and flags missing / far-away locations', async () => {
    const ok = await capture(tech, 'CHECK_IN');
    expect(ok.status).toBe(201);
    expect(ok.body.flags).toEqual([]);
    const officeCheckOut = await capture(tech, 'CHECK_OUT', { lat: -1.18525, lng: 36.90379 });
    expect(officeCheckOut.status).toBe(201);
    expect(officeCheckOut.body.flags).not.toContain('OUTSIDE_GEOFENCE');
    const far = await capture(tech, 'CHECK_IN', { lat: -1.1, lng: 36.9 });
    expect(far.body.flags).toContain('OUTSIDE_GEOFENCE');
  });

  it('records an off-site check-in with a warning instead of blocking it', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const offsiteTech = (await newTechnician(admin)).token;
    const photo = await capture(offsiteTech, 'CHECK_IN', { lat: -1.1, lng: 36.9 });
    const checkIn = await api()
      .post('/api/v1/attendance/check-in')
      .set(auth(offsiteTech))
      .send({ photoId: photo.body.photoId, checklist: CHECKLIST });

    expect(checkIn.status).toBe(201);
    expect(checkIn.body.record.checkInPhoto.flags).toContain('OUTSIDE_GEOFENCE');
    // Supervisors are told how far away it was
    const sup = (await login('FBI-SUP-001')).token;
    const alert = await eventually(
      () => api().get('/api/v1/notifications').set(auth(sup)),
      (r) => r.body.notifications.some((n: { type: string; data: { attendanceId?: string } }) => n.type === 'PHOTO_FLAGGED' && n.data?.attendanceId === checkIn.body.record.id),
    );
    const n = alert.body.notifications.find((x: { type: string; data: { attendanceId?: string } }) => x.type === 'PHOTO_FLAGGED' && x.data?.attendanceId === checkIn.body.record.id);
    expect(n.body).toMatch(/Checked in [\d.]+ km from the office/);
  });

  it('does not count a reading too rough to place someone at the office', async () => {
    const rough = await capture(tech, 'CHECK_IN', { lat: -1.18525, lng: 36.90379, accuracyM: 2500 });
    expect(rough.body.flags).toContain('LOCATION_UNCONFIRMED');
    const precise = await capture(tech, 'CHECK_IN', { lat: -1.18525, lng: 36.90379, accuracyM: 12 });
    expect(precise.body.flags).toEqual([]);
  });

  it('rejects non-JPEG uploads', async () => {
    const res = await capture(tech, 'CHECK_IN', { file: Buffer.from('this is not an image at all') });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('rejects a byte-identical re-upload', async () => {
    const file = jpeg();
    expect((await capture(tech, 'CHECK_IN', { file })).status).toBe(201);
    const again = await capture(tech, 'CHECK_IN', { file });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DUPLICATE_PHOTO');
  });

  it('rejects a reused challenge and a wrong nonce', async () => {
    const ch = await api().post('/api/v1/capture/challenge').set(auth(tech)).send({ purpose: 'CHECK_IN' });
    const send = (nonce: string) =>
      api().post('/api/v1/capture/upload').set(auth(tech)).field('challengeId', ch.body.challengeId).field('nonce', nonce).attach('photo', jpeg(), 'p.jpg');
    expect((await send('0'.repeat(32))).status).toBe(403);
    expect((await send(ch.body.nonce)).status).toBe(201);
    const reused = await send(ch.body.nonce);
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('CHALLENGE_USED');
  });

  it('refuses another user’s challenge', async () => {
    const other = (await login('FBI-TEC-002')).token;
    const ch = await api().post('/api/v1/capture/challenge').set(auth(other)).send({ purpose: 'CHECK_IN' });
    const res = await api().post('/api/v1/capture/upload').set(auth(tech)).field('challengeId', ch.body.challengeId).field('nonce', ch.body.nonce).attach('photo', jpeg(), 'p.jpg');
    expect(res.status).toBe(404);
  });

  it('only lets a photo be used once, for its own purpose', async () => {
    const checkoutPhoto = await photoId(tech, 'CHECK_OUT');
    const wrongPurpose = await api().post('/api/v1/attendance/check-in').set(auth(tech)).send({ photoId: checkoutPhoto, checklist: CHECKLIST });
    expect(wrongPurpose.status).toBe(400);
    expect(wrongPurpose.body.error.code).toBe('PHOTO_WRONG_PURPOSE');
    const inPhoto = await photoId(tech, 'CHECK_IN');
    expect((await api().post('/api/v1/attendance/check-in').set(auth(tech)).send({ photoId: inPhoto, checklist: CHECKLIST })).status).toBe(201);
    const twice = await api().post('/api/v1/attendance/check-in').set(auth(tech)).send({ photoId: inPhoto, checklist: CHECKLIST });
    expect(twice.status).toBe(409);
  });
});
