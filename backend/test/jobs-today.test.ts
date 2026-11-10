import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, auth, createTask, login, newTechnician } from './helpers';

describe('jobs pages list only jobs created today', () => {
  it('returns today\'s jobs and counts the earlier ones', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const sup = (await login('FBI-SUP-001')).token;
    const tech = await newTechnician(admin);
    const fresh = await createTask(sup, tech.user.id);
    const old = await createTask(sup, tech.user.id);
    await prisma.task.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 3 * 24 * 3600_000) } });

    const today = await api().get('/api/v1/tasks?created=today').set(auth(tech.token));
    expect(today.status).toBe(200);
    expect(today.body.tasks.map((t: { id: string }) => t.id)).toEqual([fresh.id]);
    expect(today.body.earlier).toBe(1);
    // Without the filter, everything is still there
    const all = await api().get('/api/v1/tasks').set(auth(tech.token));
    expect(all.body.tasks.map((t: { id: string }) => t.id).sort()).toEqual([fresh.id, old.id].sort());
  });
});
