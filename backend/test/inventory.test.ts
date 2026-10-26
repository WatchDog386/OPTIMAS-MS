import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, itemBySku, login, newTechnician, receiveSerials } from './helpers';

describe('inventory chain of custody', () => {
  let admin: string;
  let store: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    store = (await login('OPT-STR-001')).token;
  });

  it('refuses duplicate serial registration', async () => {
    const { item, serials } = await receiveSerials(store, 'ONT-HG8145', 1);
    const dup = await api().post('/api/v1/inventory/receive').set(auth(store)).send({ itemId: item.id, serials: [{ serialNumber: serials[0] }] });
    expect(dup.status).toBe(409);
  });

  it('enforces the custody cap on routers', async () => {
    const tech = await newTechnician(admin);
    const { serials } = await receiveSerials(store, 'RTR-TP-C6', 6);
    const over = await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('CUSTODY_LIMIT');
    expect((await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials: serials.slice(0, 5) })).status).toBe(201);
  });

  it('cannot issue a unit that is not in the store', async () => {
    const a = await newTechnician(admin);
    const b = await newTechnician(admin);
    const { serials } = await receiveSerials(store, 'RTR-TP-C6', 1);
    await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: a.user.id, serials });
    const again = await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: b.user.id, serials });
    expect(again.body.error.code).toBe('UNIT_UNAVAILABLE');
  });

  it('returns, stock counts and reconciliation add up', async () => {
    const tech = await newTechnician(admin);
    const { serials } = await receiveSerials(store, 'RTR-TP-C6', 3);
    await api().post('/api/v1/inventory/issue').set(auth(store)).send({ userId: tech.user.id, serials });
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});
    await api().post('/api/v1/inventory/return').set(auth(store)).send({ userId: tech.user.id, serials: [serials[0]], condition: 'FAULTY', note: 'dead on arrival' });

    const count = await api().post('/api/v1/inventory/stock-count').set(auth(tech.token)).send({ serials: [serials[1], 'NOT-MINE-1'] });
    expect(count.body.count.missing).toEqual([serials[2]]);
    expect(count.body.count.unexpected).toEqual(['NOT-MINE-1']);

    const rec = await api().get('/api/v1/inventory/reconciliation').set(auth(store));
    const row = rec.body.technicians.find((t: { technician: { id: string } }) => t.technician.id === tech.user.id);
    expect(row.serialised).toMatchObject({ issued: 3, returned: 1, inHand: 2, installed: 0, lost: 0 });
    expect(row.serialised.issued).toBe(row.serialised.installed + row.serialised.returned + row.serialised.lost + row.serialised.inHand);
    expect(row.risk).toBe('HIGH'); // missing at last count
  });

  it('adjusts bulk stock with a reason and never below zero', async () => {
    const clips = await itemBySku(store, 'ACC-CLIP');
    expect((await api().post('/api/v1/inventory/adjust').set(auth(store)).send({ itemId: clips.id, quantity: -2, reason: 'x' })).status).toBe(400);
    const ok = await api().post('/api/v1/inventory/adjust').set(auth(store)).send({ itemId: clips.id, quantity: -2, reason: 'Two packs water damaged' });
    expect(ok.status).toBe(200);
    expect(ok.body.item.storeQuantity).toBe(clips.storeQuantity - 2);
    const neg = await api().post('/api/v1/inventory/adjust').set(auth(store)).send({ itemId: clips.id, quantity: -1_000_000, reason: 'Way too many removed' });
    expect(neg.body.error.code).toBe('INSUFFICIENT_STOCK');
    const ledger = await api().get('/api/v1/inventory/movements?limit=5').set(auth(store));
    expect(ledger.body.movements[0]).toMatchObject({ type: 'ADJUST', quantity: -2, note: 'Two packs water damaged' });
  });

  it('will not archive an item that technicians still hold', async () => {
    const cable = await itemBySku(store, 'CBL-DROP-1C'); // seed issues cable to technicians
    const res = await api().patch(`/api/v1/inventory/items/${cable.id}`).set(auth(store)).send({ active: false });
    expect(res.body.error.code).toBe('ITEM_IN_FIELD');
    const price = await api().patch(`/api/v1/inventory/items/${cable.id}`).set(auth(store)).send({ unitPrice: 40 });
    expect(price.body.item.unitPrice).toBe(40);
  });
});
