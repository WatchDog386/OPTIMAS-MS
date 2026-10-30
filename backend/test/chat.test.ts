import { describe, expect, it } from 'vitest';
import { api, auth, login, newTechnician } from './helpers';

const open = async (token: string, userId: string) => (await api().post('/api/v1/chat/conversations').set(auth(token)).send({ userId })).body.conversation.id as string;
const say = (token: string, conv: string, body: string, replyToId?: string) => api().post(`/api/v1/chat/conversations/${conv}/messages`).set(auth(token)).send({ body, replyToId });
const read = (token: string, conv: string) => api().get(`/api/v1/chat/conversations/${conv}`).set(auth(token));

describe('chat like WhatsApp', () => {
  it('shows one tick when sent, two grey when delivered, two blue when read', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [a, b] = await Promise.all([newTechnician(admin), newTechnician(admin)]);
    const conv = await open(a.token, b.user.id);
    await say(a.token, conv, 'Are you at the site?');

    const list = async () => (await api().get('/api/v1/chat/conversations').set(auth(a.token))).body.conversations.find((c: { id: string }) => c.id === conv);
    expect((await list()).lastMessage.status).toBe('sent');
    await api().get('/api/v1/chat/unread').set(auth(b.token)); // b's app checks for news
    expect((await list()).lastMessage.status).toBe('delivered');
    await read(b.token, conv); // b opens the chat
    expect((await list()).lastMessage.status).toBe('read');
    const mine = await read(a.token, conv);
    expect(new Date(mine.body.receipts.readAt).getTime()).toBeGreaterThanOrEqual(new Date(mine.body.messages[0].createdAt).getTime());
  });

  it('quotes the message being replied to, only from the same chat', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [a, b, c] = await Promise.all([newTechnician(admin), newTechnician(admin), newTechnician(admin)]);
    const ab = await open(a.token, b.user.id);
    const ac = await open(a.token, c.user.id);
    const first = (await say(a.token, ab, 'Bring the ladder')).body.message;
    const reply = await say(b.token, ab, 'On my way with it', first.id);
    expect(reply.status).toBe(201);
    expect(reply.body.message.replyTo).toMatchObject({ id: first.id, body: 'Bring the ladder' });
    expect((await read(a.token, ab)).body.messages[1].replyTo).toMatchObject({ id: first.id, sender: 'You' });
    expect((await say(a.token, ac, 'nope', first.id)).status).toBe(400);
  });

  it('gives every team a group chat for its members and the office, not for others', async () => {
    const admin = (await login('FBI-ADM-001')).token;
    const [lead, helper, outsider] = await Promise.all([newTechnician(admin), newTechnician(admin), newTechnician(admin)]);
    const name = `Group ${Date.now().toString(36)}`;
    await api().post('/api/v1/teams').set(auth(admin)).send({ name, memberIds: [lead.user.id, helper.user.id], leaderId: lead.user.id });

    const group = (await api().get('/api/v1/chat/conversations').set(auth(helper.token))).body.conversations.find((c: { title: string }) => c.title === name);
    expect(group).toMatchObject({ kind: 'TEAM', lastMessage: null, members: 2 });
    expect((await say(helper.token, group.id, 'Meet at the store at 8')).status).toBe(201);
    expect((await read(lead.token, group.id)).body.messages.at(-1).body).toBe('Meet at the store at 8');
    expect((await say(admin, group.id, 'Noted, thanks team')).status).toBe(201);
    expect((await read(outsider.token, group.id)).status).toBe(403);
  });
});
