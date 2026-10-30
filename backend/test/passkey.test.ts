import { describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician } from './helpers';

const site = { Host: 'ms.example.co.ke', Origin: 'https://ms.example.co.ke' };

describe('fingerprint lock (server side)', () => {
  it('hands out registration options bound to the app’s own address, and refuses other sites', async () => {
    const tech = await newTechnician((await login('FBI-ADM-001')).token);
    const ok = await api().post('/api/v1/auth/passkeys/register-options').set(auth(tech.token)).set(site).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.rp).toMatchObject({ id: 'ms.example.co.ke', name: 'Optimas MS' });
    expect(ok.body.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'platform', userVerification: 'required' });
    expect(ok.body.challenge.length).toBeGreaterThan(20);

    const evil = await api().post('/api/v1/auth/passkeys/register-options').set(auth(tech.token)).set({ Host: 'ms.example.co.ke', Origin: 'https://evil.example.com' }).send({});
    expect(evil.status).toBe(403);
    expect((await api().post('/api/v1/auth/passkeys/register-options').send({})).status).toBe(401);
  });

  it('rejects a made-up registration, and a reused challenge', async () => {
    const tech = await newTechnician((await login('FBI-ADM-001')).token);
    await api().post('/api/v1/auth/passkeys/register-options').set(auth(tech.token)).set(site).send({});
    const fake = { id: 'abc', rawId: 'abc', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'AA' }, clientExtensionResults: {} };
    const bad = await api().post('/api/v1/auth/passkeys/register').set(auth(tech.token)).set(site).send({ response: fake });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('NOT_VERIFIED');
    const again = await api().post('/api/v1/auth/passkeys/register').set(auth(tech.token)).set(site).send({ response: fake });
    expect(again.body.error.code).toBe('CHALLENGE_EXPIRED');
  });

  it('has nothing to unlock with until a fingerprint is registered; checks the password fallback', async () => {
    const tech = await newTechnician((await login('FBI-ADM-001')).token);
    expect((await api().post('/api/v1/auth/passkeys/unlock-options').set(auth(tech.token)).set(site).send({})).status).toBe(404);
    expect((await api().get('/api/v1/auth/passkeys').set(auth(tech.token))).body.passkeys).toEqual([]);
    expect((await api().post('/api/v1/auth/verify-password').set(auth(tech.token)).send({ password: 'Tech-pass-123' })).status).toBe(200);
    const wrong = await api().post('/api/v1/auth/verify-password').set(auth(tech.token)).send({ password: 'nope' });
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');
    expect((await api().delete('/api/v1/auth/passkeys/not-mine').set(auth(tech.token))).status).toBe(404);
  });
});

describe('fingerprint sign-in (no session yet)', () => {
  it('is reachable while signed out, but needs a registered fingerprint and a real signature', async () => {
    const opts = await api().post('/api/v1/auth/passkeys/login-options').set(site).send({ identifier: 'FBI-TEC-002' });
    expect(opts.status).toBe(404); // reachable (not 401), but no fingerprint registered for this account
    const fake = { id: 'abc', rawId: 'abc', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' }, clientExtensionResults: {} };
    const login = await api().post('/api/v1/auth/passkeys/login').set(site).send({ identifier: 'FBI-TEC-002', response: fake });
    expect([401, 403]).toContain(login.status);
    expect(login.body.token).toBeUndefined();
    // the signed-in fingerprint routes still need a session
    expect((await api().get('/api/v1/auth/passkeys').set(site)).status).toBe(401);
  });
});
