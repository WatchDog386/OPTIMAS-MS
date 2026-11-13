import { describe, expect, it } from 'vitest';
import { api, auth, checkIn, login, newTechnician, photoId, receiveSerials, REPORT } from './helpers';

const sig = { path: 'M1 1 L20 20 L40 5', signedBy: 'Sato' };
const fields = { signal: '-24 dBm', fatPreinstalled: true, dropCableM: 20, amountCollected: 3000 };

describe("installing with the customer's own router", () => {
  it('records it with its SN and a live photo of its label, outside stock', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const t = (await api().post('/api/v1/tasks').set(auth(admin)).send({ type: 'INSTALLATION', title: 'Install, client has a router', customerName: 'Sato', address: 'Opp Aziel towers', assigneeId: tech.user.id })).body.task;
    await api().post(`/api/v1/tasks/${t.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', t.id) });
    const sn = `OWN${Date.now().toString(36).toUpperCase()}`;
    const end = await photoId(tech.token, 'TASK_END', t.id);
    const complete = (extra: Record<string, unknown>) => api().post(`/api/v1/tasks/${t.id}/complete`).set(auth(tech.token)).send({ photoId: end, report: REPORT, signature: sig, ...fields, ...extra });

    // No stock router and no customer's router: refused
    expect((await complete({})).body.error.code).toBe('SERIAL_REQUIRED');
    // The label photo is required, and must be a label photo
    expect((await complete({ ownRouter: { model: 'TP-Link Archer C6', sn } })).status).toBe(400);
    const wrong = await photoId(tech.token, 'TASK_END', t.id);
    expect((await complete({ ownRouter: { model: 'TP-Link Archer C6', sn, photoId: wrong } })).body.error.code).toBe('PHOTO_WRONG_PURPOSE');

    const label = await photoId(tech.token, 'ROUTER_LABEL', t.id);
    const done = await complete({ ownRouter: { model: 'TP-Link Archer C6', sn: sn.toLowerCase(), mac: 'aa:bb:cc:dd:ee:ff', photoId: label } });
    expect(done.status).toBe(200);
    expect(done.body.task).toMatchObject({ status: 'COMPLETED', ownRouterModel: 'TP-Link Archer C6', ownRouterSn: sn, ownRouterMac: 'AA:BB:CC:DD:EE:FF', ownRouterPhoto: { id: label } });

    // On record as the customer's device; no stock approval filed; not in the store's items
    const trail = await api().get(`/api/v1/inventory/units/${sn}/history`).set(auth(admin));
    expect(trail.body.unit).toMatchObject({ status: 'INSTALLED', customerOwned: true, holderId: null });
    const check = await api().post('/api/v1/inventory/verify').set(auth(admin)).send({ code: sn });
    expect(check.body.verdict.title).toContain("Customer's own router");
    expect((await api().get('/api/v1/inventory/requests').set(auth(admin))).body.requests.some((r: { summary: string }) => r.summary.includes(sn))).toBe(false);
    expect((await api().get('/api/v1/inventory/items').set(auth(admin))).body.items.some((i: { sku: string }) => i.sku === 'CUSTOMER-ROUTER')).toBe(false);

    // The daily report lists it
    const text = (await api().get('/api/v1/day-reports/mine').set(auth(tech.token))).body.report.text as string;
    expect(text).toContain(`1. 1 Customer's own router: TP-Link Archer C6 (SN ${sn})`);
    expect(text).toContain('Routers installed: 1');
  });

  it('refuses an Optimas stock router passed off as the customer\'s', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const stockSn = (await receiveSerials(admin, 'RTR-HW-AX3', 1)).serials[0];
    const t = (await api().post('/api/v1/tasks').set(auth(admin)).send({ type: 'INSTALLATION', title: 'Install', customerName: 'Xavier', address: 'Kahawa West', assigneeId: tech.user.id })).body.task;
    await api().post(`/api/v1/tasks/${t.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', t.id) });
    const res = await api()
      .post(`/api/v1/tasks/${t.id}/complete`)
      .set(auth(tech.token))
      .send({ photoId: await photoId(tech.token, 'TASK_END', t.id), report: REPORT, signature: sig, ...fields, ownRouter: { model: 'Huawei', sn: stockSn, photoId: await photoId(tech.token, 'ROUTER_LABEL', t.id) } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OPTIMAS_DEVICE');
  });
});
