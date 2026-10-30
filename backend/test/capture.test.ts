import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, capture, CHECKLIST, jpeg, login, newTechnician, photoId } from './helpers';

describe('camera-only photo integrity', () => {
  let tech: string;
  beforeAll(async () => {
    tech = (await newTechnician((await login('FBI-ADM-001')).token)).token;
  });

  it('accepts a live capture and flags missing / far-away locations', async () => {
    const ok = await capture(tech, 'CHECK_IN');
    expect(ok.status).toBe(201);
    expect(ok.body.flags).toEqual([]);
    const far = await capture(tech, 'CHECK_IN', { lat: -1.1, lng: 36.9 });
    expect(far.body.flags).toContain('OUTSIDE_GEOFENCE');
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
