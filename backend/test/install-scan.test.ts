import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, itemBySku, login, newTechnician, photoId } from './helpers';

/** Receives one router with the given serial (and MAC) and issues it to the technician (not yet accepted). */
async function issueRouter(store: string, techId: string, serialNumber: string, macAddress?: string) {
  const item = await itemBySku(store, 'RTR-HW-AX3');
  expect((await api().post('/api/v1/inventory/receive').set(auth(store)).send({ itemId: item.id, serials: [{ serialNumber, macAddress }] })).status).toBe(201);
  expect((await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: techId, serials: [serialNumber] })).status).toBe(201);
}
const hex8 = () => crypto.randomBytes(4).toString('hex').toUpperCase();

describe('scanning the device installed: it leaves "in hand" and shows as installed', () => {
  it('matches the other form of a GPON serial, and accepts a device that was never accepted', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const sup = (await login('FBI-SUP-001')).token;
    const tech = await newTechnician(admin);
    const tail = hex8();
    // The store recorded the hex form; the technician scans the "HWTC…" form printed on the same sticker
    await issueRouter(store, tech.user.id, `48575443${tail}`);
    const found = await api().get(`/api/v1/inventory/my/find?code=${encodeURIComponent(`SN: HWTC${tail}`)}`).set(auth(tech.token));
    expect(found.status).toBe(200);
    expect(found.body.unit.serialNumber).toBe(`48575443${tail}`);

    await checkIn(tech.token);
    const task = await createTask(sup, tech.user.id);
    expect((await api().post(`/api/v1/tasks/${task.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', task.id) })).status).toBe(200);
    const done = await api()
      .post(`/api/v1/tasks/${task.id}/complete`)
      .set(auth(tech.token))
      .send({ photoId: await photoId(tech.token, 'TASK_END', task.id), notes: 'Installed and tested', serials: [`HWTC${tail}`], signature: { path: 'M1 1 L20 20 L40 5', signedBy: 'Jane' } });
    expect(done.status).toBe(200);
    const trail = await api().get(`/api/v1/inventory/units/48575443${tail}/history`).set(auth(store));
    expect(trail.body.unit.status).toBe('INSTALLED');
    expect(trail.body.unit.movements.map((m: { type: string }) => m.type)).toEqual(['RECEIVE', 'ISSUE', 'ACCEPT', 'INSTALL']);
    const my = await api().get('/api/v1/inventory/my').set(auth(tech.token));
    expect([...my.body.units, ...my.body.pending].some((u: { serialNumber: string }) => u.serialNumber === `48575443${tail}`)).toBe(false);
  });

  it('records an install with no job, by MAC address too, and refuses devices the technician does not hold', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const tech = await newTechnician(admin);
    const other = await newTechnician(admin);
    const serial = `MRB${hex8()}`;
    const mac = `A4:${hex8().match(/../g)!.join(':')}:0B`;
    await issueRouter(store, tech.user.id, serial, mac);
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    expect((await api().post('/api/v1/inventory/install').set(auth(tech.token)).send({ serial: mac, customerAccount: 'fbi-cus-77001' })).status).toBe(200);
    const trail = await api().get(`/api/v1/inventory/units/${serial}/history`).set(auth(store));
    expect(trail.body.unit).toMatchObject({ status: 'INSTALLED', customerAccount: 'FBI-CUS-77001' });

    const notMine = await api().post('/api/v1/inventory/install').set(auth(other.token)).send({ serial, customerAccount: 'FBI-CUS-77002' });
    expect(notMine.status).toBe(409);
    expect((await api().post('/api/v1/inventory/install').set(auth(store)).send({ serial, customerAccount: 'X1' })).status).toBe(403);
  });

  it("lets the store mark a device installed that is stuck in a technician's hands", async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const tech = await newTechnician(admin);
    const serial = `MRB${hex8()}`;
    await issueRouter(store, tech.user.id, serial);
    expect((await api().post(`/api/v1/inventory/units/${serial}/mark-installed`).set(auth(tech.token)).send({ customerAccount: 'FBI-CUS-1', note: 'seen at site' })).status).toBe(403);
    const fixed = await api().post(`/api/v1/inventory/units/${serial}/mark-installed`).set(auth(store)).send({ customerAccount: 'FBI-CUS-88001', note: 'Installed at Murumba, confirmed by the technician' });
    expect(fixed.status).toBe(200);
    const rec = await api().get('/api/v1/inventory/reconciliation').set(auth(store));
    const row = rec.body.technicians.find((t: { technician: { id: string } }) => t.technician.id === tech.user.id);
    expect(row.serialised).toMatchObject({ inHand: 0, installed: 1 });
  });
});
