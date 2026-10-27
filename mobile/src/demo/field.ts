import type { ConversationDetail, ConversationRow, Contact, JobTrack, LatLng, Nearby, Route, RouteStep } from '../api/field';
import type { Task } from '../api/types';
import { attendanceToday, demoAdmin, iso, MIN, NOW, requests, supervisor, storekeeper, tasks, techs } from './data';

/*
 * Demo answers for live tracking, dispatch and chat. Technicians on their way really move: their position
 * is worked out from the clock, so the map changes every time the screen polls.
 */

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
export function metres(a: LatLng, b: LatLng) {
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const bearing = (a: LatLng, b: LatLng) => {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

const ROADS = ['Thika Road', 'Kiambu Road', 'Outer Ring Road', 'Ngong Road', 'Mombasa Road', 'Waiyaki Way', 'Langata Road', 'Kangundo Road', 'Jogoo Road', 'Limuru Road'];

/** A believable road-like route: along one road, a turn, along another, with gentle bends. */
export function demoRoute(from: LatLng, to: LatLng): Route {
  const seed = hash(`${from[0].toFixed(3)}${to[1].toFixed(3)}`);
  const corner: LatLng = seed % 2 ? [from[0], to[1]] : [to[0], from[1]];
  const leg = (a: LatLng, b: LatLng, n: number, wiggle: number) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / n;
      const bend = Math.sin(t * Math.PI * 2 + seed) * wiggle;
      return [a[0] + (b[0] - a[0]) * t + bend * (b[1] - a[1]), a[1] + (b[1] - a[1]) * t - bend * (b[0] - a[0])] as LatLng;
    });
  const geometry: LatLng[] = [...leg(from, corner, 24, 0.035), ...leg(corner, to, 24, 0.03), to];
  let distance = 0;
  for (let i = 1; i < geometry.length; i += 1) distance += metres(geometry[i - 1], geometry[i]);
  const speed = 7; // m/s in town traffic
  const roadA = ROADS[seed % ROADS.length];
  const roadB = ROADS[(seed >> 3) % ROADS.length === seed % ROADS.length ? (seed + 1) % ROADS.length : (seed >> 3) % ROADS.length];
  const d1 = metres(from, corner);
  const d2 = Math.max(0, distance - d1);
  const turn = bearing(from, corner) < 180 === bearing(corner, to) < 180 ? 'left' : 'right';
  const steps: RouteStep[] = [
    { instruction: `Start along ${roadA}`, distance: Math.round(d1), duration: Math.round(d1 / speed), lat: from[0], lng: from[1] },
    { instruction: `Turn ${turn} onto ${roadB}`, distance: Math.round(d2 * 0.7), duration: Math.round((d2 * 0.7) / speed), lat: corner[0], lng: corner[1] },
    { instruction: 'Turn right onto the customer’s street', distance: Math.round(d2 * 0.3), duration: Math.round((d2 * 0.3) / speed), lat: geometry[42][0], lng: geometry[42][1] },
    { instruction: 'You have arrived at the customer', distance: 0, duration: 0, lat: to[0], lng: to[1] },
  ];
  return { distance: Math.round(distance), duration: Math.round(distance / speed), geometry, steps, source: 'road' };
}

/** Where a technician is now on a 12-minute loop from their area towards the job (so the demo moves). */
function onTheWay(task: Task) {
  const site: LatLng = [task.lat!, task.lng!];
  const seed = hash(task.id);
  const start: LatLng = [site[0] + 0.012 + (seed % 7) / 900, site[1] + 0.016 - (seed % 5) / 700];
  const full = demoRoute(start, site);
  const loop = 12 * 60_000;
  const frac = Math.min(0.92, ((Date.now() + seed) % loop) / loop);
  const at = Math.max(1, Math.floor(frac * (full.geometry.length - 1)));
  const here = full.geometry[at];
  const next = full.geometry[Math.min(at + 1, full.geometry.length - 1)];
  const remaining = full.geometry.slice(at);
  let left = 0;
  for (let i = 1; i < remaining.length; i += 1) left += metres(remaining[i - 1], remaining[i]);
  const route: Route = { ...full, geometry: remaining, distance: Math.round(left), duration: Math.round(left / 7), steps: full.steps.filter((s) => metres([s.lat, s.lng], site) <= left + 5) };
  return { here, heading: bearing(here, next), trail: full.geometry.slice(0, at + 1), route };
}

export function demoTrack(id: string): JobTrack {
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new Error('Job not found');
  const job = { id: t.id, code: t.code, title: t.title, status: t.status, address: t.address, customerName: t.customerName, lat: t.lat, lng: t.lng, startedAt: t.startedAt };
  const tech = { id: t.assignee.id, name: t.assignee.name, phone: t.assignee.phone ?? null };
  if (t.lat == null || t.lng == null) return { job, tech: { ...tech, position: null }, trail: [], route: null };
  if (t.status !== 'ASSIGNED') return { job, tech: { ...tech, position: { lat: t.lat + 0.0002, lng: t.lng - 0.0002, at: iso(Date.now() - 40_000), heading: null, speed: 0, kind: 'live' } }, trail: [], route: null };
  const w = onTheWay(t);
  return {
    job,
    tech: { ...tech, position: { lat: w.here[0], lng: w.here[1], at: iso(Date.now() - 6_000), heading: w.heading, speed: 7, kind: 'live' } },
    trail: w.trail,
    route: { ...w.route, arriveAt: iso(Date.now() + w.route.duration * 1000) },
  };
}

/** Where each demo technician is right now (moving ones are on the way to their next job). */
export function demoPositions() {
  return techs.map((u) => {
    const att = attendanceToday.find((a) => a.userId === u.id);
    const working = tasks.find((t) => t.assignee.id === u.id && t.status === 'IN_PROGRESS');
    const next = tasks.find((t) => t.assignee.id === u.id && t.status === 'ASSIGNED' && t.lat != null);
    if (working?.lat != null) return { user: u, att, working, lat: working.lat, lng: working.lng!, heading: null as number | null, live: true };
    if (att && !att.checkOutAt && next) {
      const w = onTheWay(next);
      return { user: u, att, working, lat: w.here[0], lng: w.here[1], heading: w.heading as number | null, live: true };
    }
    const wobble = (hash(u.id) % 5) / 400;
    return { user: u, att, working, lat: u.t.lat + wobble, lng: u.t.lng - wobble, heading: null as number | null, live: false };
  });
}

export function demoNearby(id: string): Nearby {
  const t = tasks.find((x) => x.id === id);
  if (!t) throw new Error('Job not found');
  const site: LatLng | null = t.lat != null && t.lng != null ? [t.lat, t.lng] : null;
  const rows = demoPositions().map((p) => {
    const onDuty = !!p.att && !p.att.checkOutAt;
    const d = site ? metres([p.lat, p.lng], site) : null;
    return {
      user: { id: p.user.id, name: p.user.name, phone: p.user.phone, staffNo: p.user.staffNo },
      current: p.user.id === t.assignee.id,
      onDuty,
      busy: !!p.working,
      openJobs: tasks.filter((x) => x.assignee.id === p.user.id && (x.status === 'ASSIGNED' || x.status === 'IN_PROGRESS')).length,
      position: onDuty || p.live ? { lat: p.lat, lng: p.lng, at: iso(Date.now() - (hash(p.user.id) % 9) * MIN), kind: p.live ? ('live' as const) : ('recent' as const) } : null,
      distanceKm: d == null || !(onDuty || p.live) ? null : Math.round(d / 100) / 10,
      etaMinutes: d == null || !(onDuty || p.live) ? null : Math.max(1, Math.round((d * 1.4) / (24_000 / 60))),
    };
  });
  const rank = (r: (typeof rows)[number]) => (r.onDuty ? 0 : 2) + (r.busy ? 1 : 0);
  rows.sort((a, b) => rank(a) - rank(b) || (a.etaMinutes ?? 1e9) - (b.etaMinutes ?? 1e9) || a.openJobs - b.openJobs);
  const best = rows.find((r) => !r.current && r.onDuty && !r.busy && r.etaMinutes != null);
  return { job: { id: t.id, lat: t.lat, lng: t.lng, status: t.status }, suggestedId: best?.user.id ?? null, technicians: rows };
}

/** Coordinates for the demo customer requests (near the places named in their addresses). */
const REQUEST_PINS: Record<string, LatLng> = { 'demo-r1': [-1.2172, 36.9021], 'demo-r2': [-1.2051, 36.7781], 'demo-r3': [-1.3601, 36.9342], 'demo-r4': [-1.3952, 36.7533] };
export const demoRequestPins = () =>
  requests
    .filter((r) => r.status === 'OPEN')
    .map((r) => ({ id: r.id, type: r.type, description: r.description, address: r.address, lat: REQUEST_PINS[r.id]?.[0] ?? null, lng: REQUEST_PINS[r.id]?.[1] ?? null, createdAt: r.createdAt, customerName: r.customer?.name ?? 'Customer' }));

// ── Chat ─────────────────────────────────────────────────────────────────────────────────────────
const [t0, t1, t2] = techs;
const customerJob = tasks.find((t) => t.status === 'ASSIGNED') ?? tasks[0];
type Seed = { id: string; kind: 'DIRECT' | 'SUPPORT'; with: { id: string; name: string; role: ConversationRow['role'] & string; phone: string | null; account?: string }; lines: [mine: boolean, body: string, minsAgo: number][]; unread: number };
const THREADS: Seed[] = [
  {
    id: 'demo-chat-1',
    kind: 'DIRECT',
    with: { id: t0.id, name: t0.name, role: 'TECHNICIAN', phone: t0.phone },
    lines: [
      [true, `Brian, can you take ${customerJob.code} after your current job? The customer is near you.`, 48],
      [false, 'Yes boss. I will be done here in about 30 minutes.', 45],
      [true, 'Great. They asked for a call before you arrive.', 44],
      [false, 'Noted 👍 Leaving now, 15 minutes away.', 6],
    ],
    unread: 1,
  },
  {
    id: 'demo-chat-2',
    kind: 'SUPPORT',
    with: { id: 'c1', name: 'Grace Wanjiru', role: 'CUSTOMER', phone: '0712 880 441', account: 'OPT-C-1042' },
    lines: [
      [false, 'Hello, my internet keeps dropping every evening around 8pm.', 130],
      [true, 'Sorry about that Grace. We have booked a technician to check your line.', 122],
      [false, 'Thank you. Will they call before coming?', 20],
    ],
    unread: 1,
  },
  {
    id: 'demo-chat-3',
    kind: 'DIRECT',
    with: { id: t1.id, name: t1.name, role: 'TECHNICIAN', phone: t1.phone },
    lines: [
      [false, 'Installation at Ruaka done. Customer signed and rated 5 stars.', 190],
      [true, 'Excellent work Mercy, thank you!', 185],
    ],
    unread: 0,
  },
  {
    id: 'demo-chat-4',
    kind: 'DIRECT',
    with: { id: storekeeper.id, name: storekeeper.name, role: 'STOREKEEPER', phone: storekeeper.phone },
    lines: [
      [false, 'We are down to 9 packs of cable clips. Should I order more?', 300],
      [true, 'Yes, order 20 packs please.', 290],
    ],
    unread: 0,
  },
];

const ROLE_LABEL: Record<string, string> = { TECHNICIAN: 'Technician', STOREKEEPER: 'Store', SUPERVISOR: 'Supervisor', ADMIN: 'Admin', CUSTOMER: 'Customer' };
const subtitleOf = (s: Seed) => (s.with.role === 'CUSTOMER' ? `Customer${s.with.account ? ` · ${s.with.account}` : ''}` : ROLE_LABEL[s.with.role]);
const read = new Set<string>();

export const demoConversations = (): { conversations: ConversationRow[] } => ({
  conversations: THREADS.map((s) => {
    const last = s.lines[s.lines.length - 1];
    return { id: s.id, kind: s.kind, title: s.with.name, subtitle: subtitleOf(s), role: s.with.role as ConversationRow['role'], lastMessage: { body: last[1], at: iso(NOW - last[2] * MIN), mine: last[0] }, unread: read.has(s.id) ? 0 : s.unread };
  }),
});

export const demoUnread = () => ({ unread: THREADS.filter((s) => s.unread && !read.has(s.id)).length });

export function demoConversation(id: string): ConversationDetail {
  const s = THREADS.find((x) => x.id === id);
  if (!s) throw new Error('Conversation not found');
  read.add(id);
  return {
    conversation: { id: s.id, kind: s.kind, title: s.with.name, subtitle: subtitleOf(s), role: s.with.role as ConversationRow['role'], phone: s.with.phone, otherId: s.with.id, jobs: s.id === 'demo-chat-1' ? [{ id: customerJob.id, code: customerJob.code, title: customerJob.title, status: customerJob.status }] : [] },
    messages: s.lines.map(([mine, body, ago], i) => ({
      id: `${s.id}-m${i}`,
      body,
      createdAt: iso(NOW - ago * MIN),
      mine,
      sender: mine ? { id: demoAdmin.id, name: demoAdmin.name, role: 'ADMIN' } : { id: s.with.id, name: s.with.name, role: s.with.role === 'CUSTOMER' ? 'CUSTOMER' : (s.with.role as 'TECHNICIAN') },
    })),
  };
}

export const demoContacts = (): { support: boolean; contacts: Contact[] } => ({
  support: false,
  contacts: [supervisor, storekeeper, t0, t1, t2, ...techs.slice(3)].map((u) => ({ id: u.id, name: u.name, role: u.role, phone: u.phone, customerAccount: null })),
});

/** The conversation for a person (demo: an existing thread, or the first one). */
export const demoOpen = (userId?: string) => ({ conversation: { id: THREADS.find((s) => s.with.id === userId)?.id ?? THREADS[0].id } });
