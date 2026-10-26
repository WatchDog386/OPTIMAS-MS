import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, itemBySku, login, newTechnician, photoId, receiveSerials } from './helpers';

describe('a technician’s day: check-in → job → completion → verification', () => {
  let admin: string;
  let store: string;
  let sup: string;
  let tech: { token: string; user: { id: string } };
  let serials: string[];
  let cableId: string;

  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    store = (await login('OPT-STR-001')).token;
    sup = (await login('OPT-SUP-001')).token;
    tech = await newTechnician(admin);
    ({ serials } = await receiveSerials(store, 'RTR-HW-AX3', 2));
    cableId = (await itemBySku(store, 'CBL-DROP-1C')).id;
    expect((await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials })).status).toBe(201);
    expect((await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, itemId: cableId, quantity: 100 })).status).toBe(201);
  });

  it('cannot start a job before checking in', async () => {
    const task = await createTask(sup, tech.user.id);
    const res = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_CHECKED_IN');
  });

  it('runs a full installation with every control enforced', async () => {
    await checkIn(tech.token);
    const task = await createTask(sup, tech.user.id);
    const start = await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) });
    expect(start.status).toBe(200);
    expect(start.body.task.status).toBe('IN_PROGRESS');

    // only one job in progress at a time
    const other = await createTask(sup, tech.user.id, { type: 'REPAIR' });
    const second = await api().post(`/api/v1/tasks/${other.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', other.id) });
    expect(second.body.error.code).toBe('TASK_IN_PROGRESS');

    const complete = (body: Record<string, unknown>) =>
      photoId(tech.token, 'TASK_END', task.id).then((pid) => api().post(`/api/v1/tasks/${task.id}/complete`).set(auth(tech.token)).send({ photoId: pid, notes: 'Installed and tested', ...body }));

    expect((await complete({})).body.error.code).toBe('SERIAL_REQUIRED');
    expect((await complete({ serials: [serials[0]], signature: { path: 'M1 1 L20 20 L40 5', signedBy: 'Jane' } })).body.error.code).toBe('NOT_ACCEPTED');
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    expect((await complete({ serials: [serials[0]] })).body.error.code).toBe('SIGNATURE_REQUIRED');
    const xss = await complete({ serials: [serials[0]], signature: { path: '<script>alert(1)</script>', signedBy: 'Jane' } });
    expect(xss.status).toBe(400);
    const tooMuch = await complete({ serials: [serials[0]], signature: { path: 'M1 1 L20 20 L40 5', signedBy: 'Jane' }, materials: [{ itemId: cableId, quantity: 1000 }] });
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_HOLDING');

    const done = await complete({
      serials: [serials[0]],
      signature: { path: 'M1 1 L20 20 L40 5', signedBy: 'Jane' },
      materials: [{ itemId: cableId, quantity: 40 }],
      amountCollected: 2500,
    });
    expect(done.status).toBe(200);
    expect(done.body.task.status).toBe('COMPLETED');
    expect(done.body.task.signedByName).toBe('Jane');
    expect(done.body.task.materials).toHaveLength(2);
    expect(done.body.task.durationMinutes).toBeGreaterThanOrEqual(0);

    // a failed completion attempt must not have consumed stock
    const my = await api().get('/api/v1/inventory/my').set(auth(tech.token));
    expect(my.body.bulk.find((b: { item: { id: string } }) => b.item.id === cableId).quantity).toBe(60);
    expect(my.body.units.map((u: { serialNumber: string }) => u.serialNumber)).toEqual([serials[1]]);

    // the installed unit is bound to the customer account
    const trail = await api().get(`/api/v1/inventory/units/${serials[0]}/history`).set(auth(store));
    expect(trail.body.unit.status).toBe('INSTALLED');
    expect(trail.body.unit.customerAccount).toBe('OPT-CUS-TEST');
    expect(trail.body.unit.movements.map((m: { type: string }) => m.type)).toEqual(['RECEIVE', 'ISSUE', 'ACCEPT', 'INSTALL']);

    // verification: rejection needs a reason
    expect((await api().post(`/api/v1/tasks/${task.id}/verify`).set(auth(sup)).send({ decision: 'REJECTED' })).status).toBe(400);
    const verified = await api().post(`/api/v1/tasks/${task.id}/verify`).set(auth(sup)).send({ decision: 'VERIFIED' });
    expect(verified.body.task.status).toBe('VERIFIED');
  });

  it('records check-out with worked minutes and lists what is still held', async () => {
    const res = await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') });
    expect(res.status).toBe(200);
    expect(res.body.record.workedMinutes).toBeGreaterThanOrEqual(0);
    expect(res.body.custody.units.map((u: { serialNumber: string }) => u.serialNumber)).toEqual([serials[1]]);
    const again = await api().post('/api/v1/attendance/check-out').set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'CHECK_OUT') });
    expect(again.body.error.code).toBe('ALREADY_CHECKED_OUT');
  });
});
