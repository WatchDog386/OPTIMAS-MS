import { describe, expect, it } from 'vitest';
import { api, auth, login } from './helpers';

describe('fewer, faster requests', () => {
  it('answers several reads in one request, each exactly as if asked alone', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = (await login('FBI-TEC-001')).token;
    const res = await api().post('/api/v1/batch').set(auth(admin)).send({ paths: ['/auth/me', '/notifications/unread-count', '/approvals/summary', '/nope'] });
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: { status: number }) => r.status)).toEqual([200, 200, 200, 404]);
    expect(res.body.results[0].body.user.staffNo).toBe('FBI-ADM-001');
    expect(typeof res.body.results[2].body.total).toBe('number');
    // The same rules apply inside a batch: a technician cannot read the managers' approvals
    const techRes = await api().post('/api/v1/batch').set(auth(tech)).send({ paths: ['/approvals/summary', '/auth/me'] });
    expect(techRes.body.results.map((r: { status: number }) => r.status)).toEqual([403, 200]);
    // Signed in only, a few paths at a time, and no batches inside batches
    expect((await api().post('/api/v1/batch').send({ paths: ['/auth/me'] })).status).toBe(401);
    expect((await api().post('/api/v1/batch').set(auth(admin)).send({ paths: Array(13).fill('/auth/me') })).status).toBe(400);
    expect((await api().post('/api/v1/batch').set(auth(admin)).send({ paths: ['/batch'] })).status).toBe(400);
    expect((await api().post('/api/v1/batch').set(auth(admin)).send({ paths: ['http://evil.example/'] })).status).toBe(400);
  });

  it('serves polled counts from memory, and never stale after a change', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const first = await api().get('/api/v1/approvals/summary').set(auth(admin));
    const second = await api().get('/api/v1/approvals/summary').set(auth(admin));
    expect(second.headers['x-cache']).toBe('hit');
    expect(second.body).toEqual(first.body);
    // A change anywhere empties the cache: the next read is fresh
    const item = (await api().get('/api/v1/inventory/items').set(auth(admin))).body.items.find((i: { sku: string }) => i.sku === 'CBL-CAT6');
    expect((await api().post('/api/v1/inventory/adjust').set(auth(admin)).send({ itemId: item.id, quantity: 5, reason: 'Speed test top-up' })).status).toBe(200);
    const items = await api().get('/api/v1/inventory/items').set(auth(admin));
    expect(items.headers['x-cache']).toBeUndefined();
    expect(items.body.items.find((i: { sku: string }) => i.sku === 'CBL-CAT6').storeQuantity).toBe(item.storeQuantity + 5);
  });
});
