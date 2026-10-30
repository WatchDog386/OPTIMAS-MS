import { describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician } from './helpers';

/** Creates a customer-care login (as admin) and signs in with it. */
async function newCare(admin: string) {
  const staffNo = `FBI-CC-${Date.now().toString(36)}`.toUpperCase();
  const res = await api().post('/api/v1/users').set(auth(admin)).send({ staffNo, name: 'Care Agent', role: 'CUSTOMER_CARE', password: 'Care-pass-123' });
  expect(res.status).toBe(201);
  return login(staffNo, 'Care-pass-123');
}

describe('customer care accounts', () => {
  it('only an admin makes them; supervisors cannot', async () => {
    const sup = (await login('FBI-SUP-001')).token;
    const r = await api().post('/api/v1/users').set(auth(sup)).send({ staffNo: 'FBI-CC-NOPE', name: 'Nope', role: 'CUSTOMER_CARE' });
    expect(r.status).toBe(403);
  });

  it('creates customer logins and resends their details, but cannot touch staff', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const care = await newCare(admin);
    const account = `FBI-CUS-${String(Date.now()).slice(-6)}`;
    const cust = await api().post('/api/v1/users').set(auth(care.token)).send({ role: 'CUSTOMER', name: 'Wanjiku Home', phone: '0712345678', customerAccount: account });
    expect(cust.status).toBe(201);
    expect(cust.body.temporaryPassword).toBeTruthy();
    const again = await api().post(`/api/v1/users/${cust.body.user.id}/reset-password`).set(auth(care.token)).send({});
    expect(again.status).toBe(200);
    expect(again.body.temporaryPassword).not.toBe(cust.body.temporaryPassword);
    expect((await api().get(`/api/v1/users/${cust.body.user.id}`).set(auth(care.token))).status).toBe(200);

    expect((await api().post('/api/v1/users').set(auth(care.token)).send({ role: 'TECHNICIAN', staffNo: 'FBI-TEC-777', name: 'Not allowed' })).status).toBe(403);
    const tech = await newTechnician(admin);
    expect((await api().post(`/api/v1/users/${tech.user.id}/reset-password`).set(auth(care.token)).send({})).status).toBe(403);
    expect((await api().get('/api/v1/users').set(auth(care.token))).status).toBe(403);
    expect((await api().get('/api/v1/users?role=CUSTOMER').set(auth(care.token))).status).toBe(200);
  });

  it('answers the support line, sees requests and follows jobs, but does not dispatch or approve', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const care = await newCare(admin);
    const customer = await login('FBI-CUS-10421');
    const conv = (await api().post('/api/v1/chat/conversations').set(auth(customer.token)).send({ support: true })).body.conversation.id;
    await api().post(`/api/v1/chat/conversations/${conv}/messages`).set(auth(customer.token)).send({ body: 'My internet is down' });
    const inbox = await api().get('/api/v1/chat/conversations').set(auth(care.token));
    expect(inbox.body.conversations.some((c: { id: string }) => c.id === conv)).toBe(true);
    expect((await api().post(`/api/v1/chat/conversations/${conv}/messages`).set(auth(care.token)).send({ body: 'Sorry about that, checking now' })).status).toBe(201);

    expect((await api().get('/api/v1/requests').set(auth(care.token))).status).toBe(200);
    const jobs = await api().get('/api/v1/tasks').set(auth(care.token));
    expect(jobs.status).toBe(200);
    expect(jobs.body.tasks.length).toBeGreaterThan(0);
    expect((await api().get(`/api/v1/tasks/${jobs.body.tasks[0].id}`).set(auth(care.token))).status).toBe(200);
    expect((await api().post(`/api/v1/tasks/${jobs.body.tasks[0].id}/cancel`).set(auth(care.token)).send({})).status).toBe(403);
    expect((await api().get('/api/v1/approvals/summary').set(auth(care.token))).status).toBe(403);
  });
});

describe('customer care opens jobs', () => {
  it('takes the customer, issue, account, phone, location and urgency and assigns a technician', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const care = await newCare(admin);
    const tech = await newTechnician(admin);
    expect((await api().get('/api/v1/users?role=TECHNICIAN').set(auth(care.token))).status).toBe(200);
    expect((await api().get('/api/v1/teams').set(auth(care.token))).status).toBe(200);
    const res = await api()
      .post('/api/v1/tasks')
      .set(auth(care.token))
      .send({ type: 'REPAIR', title: 'No internet since morning', customerName: 'Amina Hassan', customerPhone: '0722000111', customerAccount: 'ACC-55501', address: 'Kilimani, Argwings Kodhek Rd', priority: 'URGENT', assigneeId: tech.user.id });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ priority: 'URGENT', customerAccount: 'ACC-55501', assigneeId: tech.user.id });
    expect(res.body.task.createdBy.id).toBe(care.user.id);

    // Reassign before it starts
    const other = await newTechnician(admin);
    const moved = await api().patch(`/api/v1/tasks/${res.body.task.id}`).set(auth(care.token)).send({ assigneeId: other.user.id });
    expect(moved.status).toBe(200);
    expect(moved.body.task.assigneeId).toBe(other.user.id);

    // New teams stay with managers
    const team = await api()
      .post('/api/v1/tasks')
      .set(auth(care.token))
      .send({ type: 'REPAIR', title: 'x', customerName: 'y', address: 'z', newTeam: { name: 'Care crew', memberIds: [tech.user.id, other.user.id], leaderId: tech.user.id } });
    expect(team.status).toBe(403);
    expect((await api().get('/api/v1/users').set(auth(care.token))).status).toBe(403);
  });
});
