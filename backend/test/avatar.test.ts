import { describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician } from './helpers';

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ==';

describe('profile photo', () => {
  it('saves, returns and removes the person’s own photo, and refuses anything that is not an image', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const tech = await newTechnician(admin);
    const saved = await api().put('/api/v1/auth/me/avatar').set(auth(tech.token)).send({ image: PIXEL });
    expect(saved.status).toBe(200);
    expect(saved.body.user.avatarUrl).toBe(PIXEL);
    expect((await api().get('/api/v1/auth/me').set(auth(tech.token))).body.user.avatarUrl).toBe(PIXEL);
    // Not an image, or a script dressed as one
    expect((await api().put('/api/v1/auth/me/avatar').set(auth(tech.token)).send({ image: 'data:text/html;base64,PHNjcmlwdD4=' })).status).toBe(400);
    expect((await api().put('/api/v1/auth/me/avatar').set(auth(tech.token)).send({ image: 'javascript:alert(1)' })).status).toBe(400);
    // Team lists stay light: no photos in them
    const users = await api().get('/api/v1/users').set(auth(admin));
    expect(JSON.stringify(users.body)).not.toContain('data:image');
    const removed = await api().put('/api/v1/auth/me/avatar').set(auth(tech.token)).send({ image: null });
    expect(removed.body.user.avatarUrl).toBeNull();
    expect((await api().put('/api/v1/auth/me/avatar').send({ image: PIXEL })).status).toBe(401);
  });
});
