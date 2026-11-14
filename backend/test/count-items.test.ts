import { describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician } from './helpers';

describe('items tracked by count (labels not printed)', () => {
  it('turns generated-label items into a count, keeps who holds how many, and approves what is used', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    // Added with generated labels (never printed): 10 units
    const made = await api().post('/api/v1/inventory/items/catalog-entry-bulk').set(auth(admin)).send({ name: `ATB box ${Date.now().toString(36)}`, category: 'ACCESSORY', quantity: 10 });
    expect(made.status).toBe(201);
    const itemId = made.body.item.id;
    const serials = (made.body.labels ?? made.body.units ?? []).map((l: { serial?: string; serialNumber?: string }) => l.serial ?? l.serialNumber);
    // 3 of them issued by serial before the change
    if (serials.length) expect((await api().post('/api/v1/inventory/issue').set(auth(admin)).send({ userId: tech.user.id, serials: serials.slice(0, 3) })).status).toBe(201);

    // Only admins switch an item to counting
    expect((await api().post(`/api/v1/inventory/items/${itemId}/track-by-count`).set(auth(tech.token))).status).toBe(403);
    const sw = await api().post(`/api/v1/inventory/items/${itemId}/track-by-count`).set(auth(admin));
    expect(sw.status).toBe(200);
    expect(sw.body).toMatchObject({ inStore: serials.length ? 7 : 10, withTechnicians: serials.length ? 3 : 0, retired: 10 });
    const items = (await api().get('/api/v1/inventory/items').set(auth(admin))).body.items;
    expect(items.find((i: { id: string }) => i.id === itemId)).toMatchObject({ tracking: 'BULK' });

    // Issued by count, no scanning: to whom and how many
    expect((await api().post('/api/v1/inventory/issue').set(auth(admin)).send({ userId: tech.user.id, itemId, quantity: 2 })).status).toBe(201);
    const holders = (await api().get(`/api/v1/inventory/items/${itemId}/holders`).set(auth(admin))).body.holders;
    expect(holders).toEqual([expect.objectContaining({ user: expect.objectContaining({ id: tech.user.id }), quantity: serials.length ? 5 : 2 })]);
    // (the technician confirms receipt as usual)
    await api().post('/api/v1/inventory/accept').set(auth(tech.token)).send({});

    // The technician records what they used; it waits for the admin
    expect((await api().post('/api/v1/inventory/use').set(auth(tech.token)).send({ itemId, quantity: 99, note: 'Too many' })).body.error.code).toBe('INSUFFICIENT_HOLDING');
    const used = await api().post('/api/v1/inventory/use').set(auth(tech.token)).send({ itemId, quantity: 2, note: 'Customer call-out at Roysambu' });
    expect(used.status).toBe(202);
    expect((await api().get(`/api/v1/inventory/items/${itemId}/holders`).set(auth(admin))).body.holders[0].quantity).toBe(serials.length ? 5 : 2);
    expect((await api().post(`/api/v1/inventory/requests/${used.body.request.id}/approve`).set(auth(admin)).send({})).status).toBe(200);
    expect((await api().get(`/api/v1/inventory/items/${itemId}/holders`).set(auth(admin))).body.holders[0].quantity).toBe(serials.length ? 3 : 0);
  });
});
