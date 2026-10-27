import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, eventually, login, newTechnician, photoId } from './helpers';

const SITE = { lat: -1.2905, lng: 36.7834 }; // Kilimani

async function share(token: string, lat: number, lng: number) {
  await api().post('/api/v1/location/consent').set(auth(token)).send({ granted: true });
  const res = await api().post('/api/v1/location').set(auth(token)).send({ lat, lng, accuracy: 12, heading: 90, speed: 6 });
  expect(res.status).toBe(200);
}

describe('live location, tracking and dispatch', () => {
  let admin: string, sup: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001')).token;
  });

  it('only records location after the person said yes, and forgets it when they say no', async () => {
    const tech = await newTechnician(admin);
    expect(tech.user).toHaveProperty('locationConsent', null);
    const refused = await api().post('/api/v1/location').set(auth(tech.token)).send({ lat: -1.3, lng: 36.8 });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('LOCATION_OFF');

    await share(tech.token, -1.3, 36.8);
    const meRes = await api().get('/api/v1/auth/me').set(auth(tech.token));
    expect(meRes.body.user.locationConsent).toBe(true);

    await api().post('/api/v1/location/consent').set(auth(tech.token)).send({ granted: false });
    const job = await createTask(sup, tech.user.id, SITE);
    const t = await api().get(`/api/v1/tasks/${job.id}/track`).set(auth(sup));
    expect(t.body.tech.position).toBeNull();
    expect(t.body.trail).toEqual([]);
  });

  it('lets the assignee and managers follow a job, with a route and arrival time, but not other technicians', async () => {
    const tech = await newTechnician(admin);
    const other = await newTechnician(admin);
    const job = await createTask(sup, tech.user.id, SITE);
    await share(tech.token, -1.2833, 36.8167); // CBD, ~4 km away

    const t = await api().get(`/api/v1/tasks/${job.id}/track`).set(auth(sup));
    expect(t.status).toBe(200);
    expect(t.body.tech.position).toMatchObject({ lat: -1.2833, lng: 36.8167, kind: 'live', heading: 90 });
    expect(t.body.trail.length).toBe(1);
    expect(t.body.route.distance).toBeGreaterThan(3000);
    expect(t.body.route.duration).toBeGreaterThan(0);
    expect(Date.parse(t.body.route.arriveAt)).toBeGreaterThan(Date.now());

    expect((await api().get(`/api/v1/tasks/${job.id}/track`).set(auth(tech.token))).status).toBe(200);
    expect((await api().get(`/api/v1/tasks/${job.id}/track`).set(auth(other.token))).status).toBe(403);

    const route = await api().get('/api/v1/location/route?from=-1.2833,36.8167&to=-1.2905,36.7834').set(auth(tech.token));
    expect(route.status).toBe(200);
    expect(route.body.route.geometry.length).toBeGreaterThanOrEqual(2);
    expect((await api().get('/api/v1/location/route?from=abc&to=1,2').set(auth(tech.token))).status).toBe(400);
  });

  it('ranks free, checked-in technicians by distance and forwards the job to the nearest', async () => {
    const assigned = await newTechnician(admin);
    const near = await newTechnician(admin);
    const far = await newTechnician(admin);
    const offDuty = await newTechnician(admin);
    for (const t of [assigned, near, far]) await checkIn(t.token);
    await share(assigned.token, -1.2192, 36.8869); // Kasarani, far
    await share(near.token, -1.2921, 36.7856); // next door
    await share(far.token, -1.3197, 36.9275); // Embakasi
    await share(offDuty.token, -1.2906, 36.7835); // closest, but not checked in

    const job = await createTask(sup, assigned.user.id, SITE);
    const res = await api().get(`/api/v1/tasks/${job.id}/nearby`).set(auth(sup));
    expect(res.status).toBe(200);
    expect(res.body.suggestedId).toBe(near.user.id);
    const ids = res.body.technicians.map((r: { user: { id: string } }) => r.user.id);
    expect(ids.indexOf(near.user.id)).toBeLessThan(ids.indexOf(far.user.id));
    expect(ids.indexOf(far.user.id)).toBeLessThan(ids.indexOf(offDuty.user.id));
    const nearRow = res.body.technicians.find((r: { user: { id: string } }) => r.user.id === near.user.id);
    expect(nearRow.distanceKm).toBeLessThan(1);
    expect(nearRow.etaMinutes).toBeGreaterThan(0);
    expect(res.body.technicians.find((r: { user: { id: string } }) => r.user.id === assigned.user.id).current).toBe(true);

    // technicians cannot dispatch
    expect((await api().get(`/api/v1/tasks/${job.id}/nearby`).set(auth(near.token))).status).toBe(403);
    expect((await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(near.token)).send({ technicianId: near.user.id })).status).toBe(403);

    const fwd = await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(sup)).send({ technicianId: near.user.id, note: 'You are closest' });
    expect(fwd.status).toBe(200);
    expect(fwd.body.task.assignee.id).toBe(near.user.id);
    expect((await api().get(`/api/v1/tasks/${job.id}`).set(auth(assigned.token))).status).toBe(403);
    expect((await api().get(`/api/v1/tasks/${job.id}`).set(auth(near.token))).status).toBe(200);
    const got = await eventually(
      () => api().get('/api/v1/notifications').set(auth(near.token)),
      (r) => r.body.notifications.some((n: { title: string }) => /forwarded to you/i.test(n.title)),
    );
    expect(got.body.notifications.some((n: { title: string }) => /forwarded to you/i.test(n.title))).toBe(true);

    // same person again, or to a non-technician
    expect((await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(sup)).send({ technicianId: near.user.id })).status).toBe(400);
    const supUser = (await login('OPT-SUP-001')).user;
    expect((await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(sup)).send({ technicianId: supUser.id })).status).toBe(400);
  });

  it('cannot forward a job that has started', async () => {
    const tech = await newTechnician(admin);
    const other = await newTechnician(admin);
    await checkIn(tech.token);
    const job = await createTask(sup, tech.user.id);
    const start = await api().post(`/api/v1/tasks/${job.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', job.id) });
    expect(start.status).toBe(200);
    const fwd = await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(sup)).send({ technicianId: other.user.id });
    expect(fwd.status).toBe(409);
  });

  it('shows open customer requests and live technicians on the manager map', async () => {
    const customer = (await login('OPT-CUS-10421')).token;
    const req = await api().post('/api/v1/customer/requests').set(auth(customer)).send({ type: 'REPAIR', description: 'Map test request', lat: -1.3, lng: 36.79 });
    expect(req.status).toBe(201);
    const map = await api().get('/api/v1/insights/map').set(auth(sup));
    const row = map.body.requests.find((r: { id: string }) => r.id === req.body.request.id);
    expect(row).toMatchObject({ lat: -1.3, lng: 36.79, customerName: expect.any(String) });
    // the job made from it starts at the customer's pin
    const tech = await newTechnician(admin);
    const job = await createTask(sup, tech.user.id, { type: 'REPAIR', customerAccount: 'OPT-CUS-10421', requestId: req.body.request.id });
    const detail = await api().get(`/api/v1/tasks/${job.id}`).set(auth(sup));
    expect(detail.body.task).toMatchObject({ lat: -1.3, lng: 36.79 });
    // and the customer can follow the technician to it
    await share(tech.token, -1.31, 36.8);
    const follow = await api().get(`/api/v1/customer/jobs/${job.id}/track`).set(auth(customer));
    expect(follow.status).toBe(200);
    expect(follow.body.tech.position.lat).toBe(-1.31);
    expect(follow.body.tech.id).toBe(tech.user.id);
    expect(follow.body.route.duration).toBeGreaterThan(0);
  });
});

describe('customer onboarding by technicians', () => {
  let admin: string, sup: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001')).token;
  });

  it('creates a login for the customer on the job, links the job, and the customer can sign in', async () => {
    const tech = await newTechnician(admin);
    const job = await createTask(sup, tech.user.id, { customerAccount: undefined, customerName: 'Wanjiru Home' });
    const res = await api()
      .post('/api/v1/users/onboard-customer')
      .set(auth(tech.token))
      .send({ name: 'Wanjiru Kamau', phone: '+254712000111', address: 'Lavington, Nairobi', lat: -1.28, lng: 36.77, taskId: job.id });
    expect(res.status).toBe(201);
    expect(res.body.loginId).toMatch(/^OPT-CUS-\d{5}$/);
    expect(res.body.user.role).toBe('CUSTOMER');
    const session = await login(res.body.loginId, res.body.temporaryPassword);
    expect(session.user.mustChangePassword).toBe(true);
    const detail = await api().get(`/api/v1/tasks/${job.id}`).set(auth(sup));
    expect(detail.body.task.customerAccount).toBe(res.body.loginId);
    // the new customer sees the visit straight away
    const overview = await api().get('/api/v1/customer/overview').set(auth(session.token));
    expect(overview.status).toBe(200);
    expect(JSON.stringify(overview.body)).toContain(job.id);
    // and the same account cannot be onboarded twice
    const again = await api().post('/api/v1/users/onboard-customer').set(auth(sup)).send({ name: 'Dup', phone: '+254712000112', address: 'Somewhere', customerAccount: res.body.loginId });
    expect(again.status).toBe(409);
  });

  it('uses the account number the office gave, and stops technicians onboarding on other people’s jobs', async () => {
    const tech = await newTechnician(admin);
    const other = await newTechnician(admin);
    const theirs = await createTask(sup, other.user.id);
    const blocked = await api().post('/api/v1/users/onboard-customer').set(auth(tech.token)).send({ name: 'Someone', phone: '+254712000113', address: 'Kileleshwa', taskId: theirs.id });
    expect(blocked.status).toBe(403);
    const acct = `OPT-CUS-T${Date.now().toString().slice(-6)}`;
    const ok = await api().post('/api/v1/users/onboard-customer').set(auth(tech.token)).send({ name: 'Given Number', phone: '+254712000114', address: 'Kileleshwa', customerAccount: acct.toLowerCase() });
    expect(ok.status).toBe(201);
    expect(ok.body.loginId).toBe(acct);
    const bad = await api().post('/api/v1/users/onboard-customer').set(auth(tech.token)).send({ name: 'X', phone: 'abc', address: 'Kileleshwa' });
    expect(bad.status).toBe(400);
    // storekeepers and customers cannot onboard
    const store = (await login('OPT-STR-001')).token;
    expect((await api().post('/api/v1/users/onboard-customer').set(auth(store)).send({ name: 'Y', phone: '+254712000115', address: 'Kileleshwa' })).status).toBe(403);
  });
});

describe('chat', () => {
  let admin: string, sup: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001')).token;
  });

  async function onboarded(techToken: string, taskId?: string) {
    const res = await api().post('/api/v1/users/onboard-customer').set(auth(techToken)).send({ name: 'Chat Customer', phone: '+254712000200', address: 'Westlands', taskId });
    return login(res.body.loginId, res.body.temporaryPassword);
  }

  it('lets a technician and their customer talk, and blocks strangers', async () => {
    const tech = await newTechnician(admin);
    const stranger = await newTechnician(admin);
    const job = await createTask(sup, tech.user.id, { customerAccount: undefined });
    const customer = await onboarded(tech.token, job.id);

    const open = await api().post('/api/v1/chat/conversations').set(auth(tech.token)).send({ userId: customer.user.id });
    expect(open.status).toBe(201);
    const id = open.body.conversation.id;
    // opening again finds the same conversation (from either side)
    expect((await api().post('/api/v1/chat/conversations').set(auth(customer.token)).send({ userId: tech.user.id })).body.conversation.id).toBe(id);

    const sent = await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(tech.token)).send({ body: 'I am 10 minutes away' });
    expect(sent.status).toBe(201);
    const unread = await api().get('/api/v1/chat/unread').set(auth(customer.token));
    expect(unread.body.unread).toBe(1);
    const list = await api().get('/api/v1/chat/conversations').set(auth(customer.token));
    expect(list.body.conversations[0]).toMatchObject({ id, title: tech.user.id ? expect.any(String) : '', unread: 1, lastMessage: { body: 'I am 10 minutes away', mine: false } });

    const thread = await api().get(`/api/v1/chat/conversations/${id}`).set(auth(customer.token));
    expect(thread.body.messages.map((m: { body: string }) => m.body)).toEqual(['I am 10 minutes away']);
    expect(thread.body.conversation.jobs[0].id).toBe(job.id);
    expect((await api().get('/api/v1/chat/unread').set(auth(customer.token))).body.unread).toBe(0);

    const reply = await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(customer.token)).send({ body: 'Gate is open' });
    expect(reply.status).toBe(201);
    const since = await api().get(`/api/v1/chat/conversations/${id}?after=${encodeURIComponent(sent.body.message.createdAt)}`).set(auth(tech.token));
    expect(since.body.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([['Gate is open', false]]);

    // the job itself leads to the same conversation, from either side
    expect((await api().post('/api/v1/chat/conversations').set(auth(tech.token)).send({ taskId: job.id, with: 'customer' })).body.conversation.id).toBe(id);
    expect((await api().post('/api/v1/chat/conversations').set(auth(customer.token)).send({ taskId: job.id, with: 'technician' })).body.conversation.id).toBe(id);
    const noApp = await createTask(sup, tech.user.id, { customerAccount: 'OPT-CUS-NOAPP' });
    expect((await api().post('/api/v1/chat/conversations').set(auth(tech.token)).send({ taskId: noApp.id, with: 'customer' })).status).toBe(404);

    // a technician with no job for this customer can neither start a chat nor read this one
    expect((await api().post('/api/v1/chat/conversations').set(auth(stranger.token)).send({ userId: customer.user.id })).status).toBe(403);
    expect((await api().get(`/api/v1/chat/conversations/${id}`).set(auth(stranger.token))).status).toBe(403);
    expect((await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(stranger.token)).send({ body: 'hi' })).status).toBe(403);
    expect((await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(tech.token)).send({ body: '   ' })).status).toBe(400);

    // once the job is moved to someone else, the old technician can no longer write
    await api().post(`/api/v1/tasks/${job.id}/forward`).set(auth(sup)).send({ technicianId: stranger.user.id });
    expect((await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(tech.token)).send({ body: 'still there?' })).status).toBe(403);
  });

  it('gives customers one support line that every supervisor and admin can answer', async () => {
    const tech = await newTechnician(admin);
    const customer = await onboarded(tech.token);
    const open = await api().post('/api/v1/chat/conversations').set(auth(customer.token)).send({ support: true });
    expect(open.status).toBe(201);
    const id = open.body.conversation.id;
    await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(customer.token)).send({ body: 'My bill is wrong' });

    for (const token of [sup, admin]) {
      const list = await api().get('/api/v1/chat/conversations').set(auth(token));
      const row = list.body.conversations.find((c: { id: string }) => c.id === id);
      expect(row).toMatchObject({ kind: 'SUPPORT', title: 'Chat Customer', unread: 1 });
    }
    const answer = await api().post(`/api/v1/chat/conversations/${id}/messages`).set(auth(sup)).send({ body: 'Checking it now' });
    expect(answer.status).toBe(201);
    const seen = await api().get(`/api/v1/chat/conversations/${id}`).set(auth(customer.token));
    expect(seen.body.conversation.title).toBe('Optimas support');
    expect(seen.body.messages.map((m: { body: string }) => m.body)).toEqual(['My bill is wrong', 'Checking it now']);
    // a manager can also open it from the customer's side
    expect((await api().post('/api/v1/chat/conversations').set(auth(admin)).send({ customerId: customer.user.id })).body.conversation.id).toBe(id);

    // technicians cannot read support lines; staff cannot open one for themselves
    expect((await api().get(`/api/v1/chat/conversations/${id}`).set(auth(tech.token))).status).toBe(403);
    expect((await api().post('/api/v1/chat/conversations').set(auth(tech.token)).send({ support: true })).status).toBe(400);
  });

  it('lets office and technicians message each other, but not customers with each other', async () => {
    const tech = await newTechnician(admin);
    const supUser = (await login('OPT-SUP-001')).user;
    const dm = await api().post('/api/v1/chat/conversations').set(auth(tech.token)).send({ userId: supUser.id });
    expect(dm.status).toBe(201);
    expect((await api().post(`/api/v1/chat/conversations/${dm.body.conversation.id}/messages`).set(auth(sup)).send({ body: 'Go to Kilimani first' })).status).toBe(201);

    const contacts = await api().get('/api/v1/chat/contacts').set(auth(tech.token));
    expect(contacts.body.contacts.some((c: { id: string }) => c.id === supUser.id)).toBe(true);
    expect(contacts.body.contacts.some((c: { role: string }) => c.role === 'CUSTOMER')).toBe(false);

    const a = await onboarded(tech.token);
    const b = await onboarded(tech.token);
    expect((await api().post('/api/v1/chat/conversations').set(auth(a.token)).send({ userId: b.user.id })).status).toBe(403);
    expect((await api().post('/api/v1/chat/conversations').set(auth(a.token)).send({ userId: a.user.id })).status).toBe(403);
    const customerContacts = await api().get('/api/v1/chat/contacts').set(auth(a.token));
    expect(customerContacts.body.support).toBe(true);
  });
});
