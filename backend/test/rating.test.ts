import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, checkIn, createTask, eventually, login, newTechnician, photoId } from './helpers';

describe('customer ratings and personal performance', () => {
  let admin: string, sup: string, customer: string;
  beforeAll(async () => {
    admin = (await login('FBI-ADM-001')).token;
    sup = (await login('FBI-SUP-001')).token;
    customer = (await login('FBI-CUS-10421')).token;
  });

  it('lets a customer rate a finished visit once and tells the technician', async () => {
    const tech = await newTechnician(admin);
    await checkIn(tech.token);
    const job = await createTask(sup, tech.user.id, { type: 'REPAIR', customerAccount: 'FBI-CUS-10421' });
    const rate = (body: Record<string, unknown>) => api().post(`/api/v1/customer/jobs/${job.id}/rate`).set(auth(customer)).send(body);

    expect((await rate({ rating: 5 })).body.error.code).toBe('NOT_FINISHED');

    await api().post(`/api/v1/tasks/${job.id}/start`).set(auth(tech.token)).send({ photoId: await photoId(tech.token, 'TASK_START', job.id) });
    const done = await api()
      .post(`/api/v1/tasks/${job.id}/complete`)
      .set(auth(tech.token))
      .send({ photoId: await photoId(tech.token, 'TASK_END', job.id), notes: 'Replaced patch cord' });
    expect(done.status).toBe(200);

    expect((await rate({ rating: 6 })).status).toBe(400);
    expect((await rate({ rating: 0 })).status).toBe(400);
    const ok = await rate({ rating: 4, comment: 'Quick and tidy' });
    expect(ok.status).toBe(200);
    expect(ok.body.job.customerRating).toBe(4);
    expect(ok.body.job.customerFeedback).toBe('Quick and tidy');
    expect((await rate({ rating: 1 })).body.error.code).toBe('ALREADY_RATED');

    const told = (r: { body: { notifications: { title: string }[] } }) => r.body.notifications.some((n) => n.title.startsWith('★★★★☆'));
    expect(told(await eventually(() => api().get('/api/v1/notifications').set(auth(tech.token)), told))).toBe(true);

    const mine = await api().get('/api/v1/reports/me').set(auth(tech.token));
    expect(mine.status).toBe(200);
    expect(mine.body.rating).toEqual({ average: 4, count: 1 });
    expect(mine.body.week.jobs).toBe(1);
    expect(mine.body.month.days).toBe(1);
    expect(mine.body.month.onTimeRate === null || typeof mine.body.month.onTimeRate === 'number').toBe(true);
  });

  it('refuses ratings for visits on another account, and personal stats to customers', async () => {
    const tech = await newTechnician(admin);
    const theirs = await createTask(sup, tech.user.id, { customerAccount: 'FBI-CUS-OTHER' });
    expect((await api().post(`/api/v1/customer/jobs/${theirs.id}/rate`).set(auth(customer)).send({ rating: 5 })).status).toBe(404);
    expect((await api().get('/api/v1/reports/me').set(auth(customer))).status).toBe(403);
  });
});
