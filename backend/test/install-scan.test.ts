import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { api, approveAllStock, auth, checkIn, createTask, itemBySku, login, newTechnician, photoId } from './helpers';

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
    const store = (await login('FBI-ADM-001')).token;
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
    // Until an admin approves, the device stays in the technician's hands, marked as waiting
    const waiting = await api().get('/api/v1/inventory/my').set(auth(tech.token));
    expect(waiting.body.waiting.map((w: { summary: string }) => w.summary).join()).toContain(`48575443${tail}`);
    expect([...waiting.body.units, ...waiting.body.pending].some((u: { serialNumber: string }) => u.serialNumber === `48575443${tail}`)).toBe(true);
    // A supervisor cannot approve; the admin can
    const sup2 = (await login('FBI-SUP-001')).token;
    const pendingId = (await api().get('/api/v1/inventory/requests').set(auth(admin))).body.requests.find((r: { summary: string }) => r.summary.includes(`48575443${tail}`)).id;
    expect((await api().post(`/api/v1/inventory/requests/${pendingId}/approve`).set(auth(sup2)).send({})).status).toBe(403);
    expect((await api().post(`/api/v1/inventory/requests/${pendingId}/approve`).set(auth(admin)).send({})).status).toBe(200);
    expect((await api().post(`/api/v1/inventory/requests/${pendingId}/approve`).set(auth(admin)).send({})).body.error.code).toBe('ALREADY_DECIDED');
    const trail = await api().get(`/api/v1/inventory/units/48575443${tail}/history`).set(auth(store));
    expect(trail.body.unit.status).toBe('INSTALLED');
    expect(trail.body.unit.movements.map((m: { type: string }) => m.type)).toEqual(['RECEIVE', 'ISSUE', 'ACCEPT', 'INSTALL']);
    const my = await api().get('/api/v1/inventory/my').set(auth(tech.token));
    expect([...my.body.units, ...my.body.pending].some((u: { serialNumber: string }) => u.serialNumber === `48575443${tail}`)).toBe(false);
  });

  it('records an install with no job, by MAC address too, and refuses devices the technician does not hold', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const other = await newTechnician(admin);
    const serial = `MRB${hex8()}`;
    const mac = `A4:${hex8().match(/../g)!.join(':')}:0B`;
    await issueRouter(store, tech.user.id, serial, mac);
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    const asked = await api().post('/api/v1/inventory/install').set(auth(tech.token)).send({ serial: mac, customerAccount: 'fbi-cus-77001' });
    expect(asked.status).toBe(202);
    // Asking twice for the same device is refused while the first is waiting
    expect((await api().post('/api/v1/inventory/install').set(auth(tech.token)).send({ serial, customerAccount: 'FBI-CUS-77001' })).body.error.code).toBe('APPROVAL_PENDING');
    await approveAllStock(admin);
    const trail = await api().get(`/api/v1/inventory/units/${serial}/history`).set(auth(store));
    expect(trail.body.unit).toMatchObject({ status: 'INSTALLED', customerAccount: 'FBI-CUS-77001' });

    const notMine = await api().post('/api/v1/inventory/install').set(auth(other.token)).send({ serial, customerAccount: 'FBI-CUS-77002' });
    expect(notMine.status).toBe(409);
    expect((await api().post('/api/v1/inventory/install').set(auth(store)).send({ serial, customerAccount: 'X1' })).status).toBe(403);
  });

  it('leaves the device in the technician\'s hands when the admin rejects, and tells them why', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const serial = `MRB${hex8()}`;
    await issueRouter(admin, tech.user.id, serial);
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    const asked = await api().post('/api/v1/inventory/install').set(auth(tech.token)).send({ serial, customerAccount: 'FBI-CUS-70001' });
    expect(asked.status).toBe(202);
    expect((await api().post(`/api/v1/inventory/requests/${asked.body.request.id}/reject`).set(auth(admin)).send({ note: 'Wrong customer account' })).status).toBe(200);
    expect((await api().get(`/api/v1/inventory/units/${serial}/history`).set(auth(admin))).body.unit.status).toBe('WITH_TECHNICIAN');
    const inbox = await api().get('/api/v1/notifications').set(auth(tech.token));
    expect(inbox.body.notifications.some((n: { type: string; body: string }) => n.type === 'STOCK_APPROVAL' && n.body.includes('Wrong customer account'))).toBe(true);
  });

  it("lets the store mark a device installed that is stuck in a technician's hands, once the admin approves", async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-STR-001')).token;
    const tech = await newTechnician(admin);
    const serial = `MRB${hex8()}`;
    await issueRouter(admin, tech.user.id, serial);
    expect((await api().post(`/api/v1/inventory/units/${serial}/mark-installed`).set(auth(tech.token)).send({ customerAccount: 'FBI-CUS-1', note: 'seen at site' })).status).toBe(403);
    const fixed = await api().post(`/api/v1/inventory/units/${serial}/mark-installed`).set(auth(store)).send({ customerAccount: 'FBI-CUS-88001', note: 'Installed at Murumba, confirmed by the technician' });
    expect(fixed.status).toBe(202);
    await approveAllStock(admin);
    const rec = await api().get('/api/v1/inventory/reconciliation').set(auth(store));
    const row = rec.body.technicians.find((t: { technician: { id: string } }) => t.technician.id === tech.user.id);
    expect(row.serialised).toMatchObject({ inHand: 0, installed: 1 });
  });
});

describe('stock counts and reconciliation do not raise false alarms', () => {
  it('matches any form of a code, ignores installed devices, and re-checks old counts', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const store = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const a = hex8();
    const b = `MRB${hex8()}`;
    await issueRouter(store, tech.user.id, `48575443${a}`);
    await issueRouter(store, tech.user.id, b, `A4:${hex8().match(/../g)!.join(':')}:0C`);
    // Confirming receipt by scanning the other form of the serial works
    expect((await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({ serials: [`SN: HWTC${a}`] })).body.accepted).toBe(1);
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});

    // Scanned by the text form and by the MAC: nothing missing, nothing unexpected
    const mac = (await api().get(`/api/v1/inventory/units/${b}/history`).set(auth(store))).body.unit.macAddress;
    const ok = await api().post('/api/v1/inventory/stock-count').set(auth(tech.token)).send({ serials: [`HWTC${a}`, mac] });
    expect(ok.body.count).toMatchObject({ missing: [], unexpected: [] });

    // One router installed but never recorded: the count says it is missing...
    const miss = await api().post('/api/v1/inventory/stock-count').set(auth(tech.token)).send({ serials: [`HWTC${a}`] });
    expect(miss.body.count.missing).toEqual([b]);
    let row = (await api().get('/api/v1/inventory/reconciliation').set(auth(store))).body.technicians.find((t: { technician: { id: string } }) => t.technician.id === tech.user.id);
    expect(row.lastCount.missing).toEqual([b]);
    expect(row.risk).toBe('HIGH');
    // ...until it is recorded as installed; then reconciliation no longer counts it
    expect((await api().post('/api/v1/inventory/install').set(auth(tech.token)).send({ serial: b, customerAccount: 'FBI-CUS-90001' })).status).toBe(202);
    await approveAllStock(admin);
    row = (await api().get('/api/v1/inventory/reconciliation').set(auth(store))).body.technicians.find((t: { technician: { id: string } }) => t.technician.id === tech.user.id);
    expect(row.lastCount.missing).toEqual([]);
    expect(row.risk).toBe('NORMAL');
    expect((await api().get('/api/v1/inventory/my').set(auth(tech.token))).body.lastCount.missing).toEqual([]);

    // Scanning a router already installed at a customer is not "unexpected"
    const again = await api().post('/api/v1/inventory/stock-count').set(auth(tech.token)).send({ serials: [`HWTC${a}`, b] });
    expect(again.body.count).toMatchObject({ missing: [], unexpected: [] });
  });
});
