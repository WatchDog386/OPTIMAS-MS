import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { announceRelease } from '../src/lib/release';
import { api, auth, login } from './helpers';

describe('a new release tells everyone the app was updated', () => {
  it('announces each release once, and never with no release id', async () => {
    const mutable = env as { APP_BUILD: string };
    const tech = await login('FBI-TEC-001');
    mutable.APP_BUILD = '';
    expect(await announceRelease()).toBe(0);

    mutable.APP_BUILD = `t${Date.now().toString(36)}`;
    expect(await announceRelease()).toBeGreaterThan(0);
    // The same release starting again (a restart) says nothing
    expect(await announceRelease()).toBe(0);

    const inbox = await api().get('/api/v1/notifications').set(auth(tech.token));
    const updates = inbox.body.notifications.filter((n: { type: string; data?: { build?: string } }) => n.type === 'APP_UPDATE' && n.data?.build === mutable.APP_BUILD);
    expect(updates).toHaveLength(1);
    expect(updates[0].title).toBe('Optimas MS has been updated');
    mutable.APP_BUILD = '';
  });
});
