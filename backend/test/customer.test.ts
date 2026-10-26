import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createTask, eventually, login, newTechnician } from './helpers';

describe('customer portal and service requests', () => {
  let admin: string, sup: string, customer: string;
  beforeAll(async () => {
    admin = (await login('OPT-ADM-001')).token;
    sup = (await login('OPT-SUP-001')).token;
    customer = (await login('OPT-CUS-10421')).token;
  });

  it('turns a customer request into a job exactly once and notifies the customer', async () => {
    const tech = await newTechnician(admin);
    const req = await api().post('/api/v1/customer/requests').set(auth(customer)).send({ type: 'REPAIR', description: 'Internet drops at night' });
    expect(req.status).toBe(201);
    const inbox = await api().get('/api/v1/requests?status=OPEN').set(auth(sup));
    expect(inbox.body.requests.some((r: { id: string }) => r.id === req.body.request.id)).toBe(true);

    const job = await createTask(sup, tech.user.id, { type: 'REPAIR', customerAccount: 'OPT-CUS-10421', requestId: req.body.request.id });
    const dup = await api()
      .post('/api/v1/tasks')
      .set(auth(sup))
      .send({ title: 'Duplicate', type: 'REPAIR', customerName: 'Amani', address: 'Kilimani', assigneeId: tech.user.id, requestId: req.body.request.id });
    expect(dup.status).toBe(409);

    const mine = await api().get('/api/v1/customer/requests').set(auth(customer));
    expect(mine.body.requests.find((r: { id: string }) => r.id === req.body.request.id).status).toBe('SCHEDULED');
    const assigned = (r: { body: { notifications: { title: string }[] } }) => r.body.notifications.some((n) => /assigned/i.test(n.title));
    const notes = await eventually(() => api().get('/api/v1/notifications').set(auth(customer)), assigned);
    expect(assigned(notes)).toBe(true);

    // cancelling the job reopens the request
    await api().post(`/api/v1/tasks/${job.id}/cancel`).set(auth(sup)).send({});
    const after = await api().get('/api/v1/customer/requests').set(auth(customer));
    expect(after.body.requests.find((r: { id: string }) => r.id === req.body.request.id).status).toBe('OPEN');
  });

  it('only shows a customer their own account', async () => {
    const tech = await newTechnician(admin);
    const theirs = await createTask(sup, tech.user.id, { customerAccount: 'OPT-CUS-OTHER' });
    expect((await api().get(`/api/v1/customer/jobs/${theirs.id}`).set(auth(customer))).status).toBe(404);
    const overview = await api().get('/api/v1/customer/overview').set(auth(customer));
    expect(overview.status).toBe(200);
    expect(overview.body.active.every((j: { id: string }) => j.id !== theirs.id)).toBe(true);
  });

  it('lets supervisors close a request with a note', async () => {
    const req = await api().post('/api/v1/customer/requests').set(auth(customer)).send({ type: 'MAINTENANCE', description: 'Please check signal strength' });
    expect((await api().post(`/api/v1/requests/${req.body.request.id}/close`).set(auth(sup)).send({ note: 'x' })).status).toBe(400);
    const closed = await api().post(`/api/v1/requests/${req.body.request.id}/close`).set(auth(sup)).send({ note: 'Resolved remotely' });
    expect(closed.body.request.status).toBe('CLOSED');
    expect((await api().post(`/api/v1/requests/${req.body.request.id}/close`).set(auth(sup)).send({ note: 'Again please' })).status).toBe(409);
  });
});
