import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, login, newTechnician, photoId, receiveSerials } from './helpers';

const verify = (token: string, code: string) => api().post('/api/v1/inventory/verify').set(auth(token)).send({ code });

describe('device labels: is this the one we issued?', () => {
  it('prints signed labels, accepts them everywhere a serial goes, and spots fakes', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const [tech, other] = await Promise.all([newTechnician(admin), newTechnician(admin)]);
    const { serials, item } = await receiveSerials(store, 'RTR-HW-AX3', 2);

    const labels = await api().get(`/api/v1/inventory/labels?serials=${serials.join(',')}`).set(auth(store));
    expect(labels.status).toBe(200);
    const [a, b] = labels.body.labels as { serial: string; code: string; item: string }[];
    expect(a.code).toMatch(new RegExp(`^OPTIMAS:${a.serial}:[0-9A-F]{12}$`));
    expect((await api().get(`/api/v1/inventory/labels?itemId=${item.id}`).set(auth(tech.token))).status).toBe(403);

    // Issue by scanning the labels (not the serials)
    expect((await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials: [a.code, b.code] })).status).toBe(201);

    // The technician checks it: theirs; another technician: not theirs; the store: who has it
    const mine = await verify(tech.token, a.code);
    expect(mine.body).toMatchObject({ label: 'genuine', verdict: { tone: 'success', title: 'Yes, this is the one issued to you' } });
    expect(mine.body.unit.issued.by).toBeTruthy();
    expect((await verify(other.token, a.code)).body.verdict).toMatchObject({ tone: 'danger', title: 'Not yours' });
    expect((await verify(store, a.serial)).body).toMatchObject({ label: 'none', verdict: { tone: 'info' } });

    // A copied label on another serial, an edited signature, and an unknown device
    const forged = `OPTIMAS:${b.serial}:${a.code.split(':')[2]}`;
    expect((await verify(tech.token, forged)).body).toMatchObject({ label: 'fake', verdict: { tone: 'danger' } });
    expect((await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({ serials: [forged] })).body.error.code).toBe('FAKE_LABEL');
    // Accepting by scanning: only what was issued to you
    expect((await api().post('/api/v1/inventory/accept').set(auth(other.token)).send({ serials: [a.code] })).body.error.code).toBe('NOT_ISSUED_TO_YOU');
    expect((await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({ serials: [a.code] })).body.accepted).toBe(1);
    expect((await verify(tech.token, 'NOT-A-REAL-SERIAL-999')).body.verdict.title).toBe('Not an Optimas device');
  });

  it('lets the technician on the job collect an installed device back, and nobody else', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const sup = (await login('FBI-SUP-001')).token;
    const [tech, stranger] = await Promise.all([newTechnician(admin), newTechnician(admin)]);
    const { serials } = await receiveSerials(store, 'RTR-HW-AX3', 1);
    await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials });
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    await checkIn(tech.token);
    const account = `FBI-CUS-R${Date.now().toString(36).toUpperCase()}`;
    const task = await createTask(sup, tech.user.id, { customerAccount: account });
    await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) });
    const done = await api().post(`/api/v1/tasks/${task.id}/complete`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_END', task.id), notes: 'Installed and tested', serials, signature: { path: 'M1 1 L20 20 L40 5', signedBy: 'Jane' } });
    expect(done.status).toBe(200);

    const body = { code: serials[0], reason: 'Customer is relocating', condition: 'GOOD' };
    expect((await api().post('/api/v1/inventory/recover').set(auth(stranger.token)).send(body)).status).toBe(403);
    const back = await api().post('/api/v1/inventory/recover').set(auth(tech.token)).send(body);
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('WITH_TECHNICIAN');
    expect((await verify(tech.token, serials[0])).body.verdict.title).toBe('Yes, this is the one issued to you');
    const trail = await api().get(`/api/v1/inventory/units/${serials[0]}/history`).set(auth(store));
    expect(trail.body.unit.movements.map((m: { type: string }) => m.type)).toEqual(['RECEIVE', 'ISSUE', 'ACCEPT', 'INSTALL', 'RECOVER']);
    expect((await api().post('/api/v1/inventory/recover').set(auth(tech.token)).send(body)).body.error.code).toBe('NOT_INSTALLED');
  });
});
