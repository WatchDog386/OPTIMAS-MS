import type {
  Attendance,
  BulkHolding,
  Item,
  Movement,
  Person,
  PhotoRef,
  Role,
  SerialUnit,
  ServiceRequest,
  Task,
  TaskMaterial,
  TaskPriority,
  TaskStatus,
  TaskType,
  TeamMember,
  UnitStatus,
  User,
} from '../api/types';

/*
 * Demo data: a believable month of Optimas operations, generated the same way every time and anchored
 * to "now" so today always looks live. Used when someone signs in with "Explore with demo data";
 * nothing here ever touches the real server.
 */

export { DEMO_TOKEN } from '../api/demoToken';

// Small deterministic random numbers so the demo looks identical on every phone
let seed = 20261026;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const NOW = Date.now();
const MIN = 60_000;
const DAY = 86_400_000;
export const iso = (ms: number) => new Date(ms).toISOString();
/** East Africa time is UTC+3; "today" starts at local midnight. */
const EAT = 3 * 3_600_000;
const DAY_START = Math.floor((NOW + EAT) / DAY) * DAY - EAT;
/** A moment `days` ago at the given local hour/minute. Times today never lie in the future. */
const at = (days: number, hour: number, minute = 0) => {
  const t = DAY_START - days * DAY + (hour * 60 + minute) * MIN;
  return days === 0 && t > NOW - 20 * MIN ? NOW - (20 + ((hour * 7 + minute) % 40)) * MIN : t;
};

// ── People ────────────────────────────────────────────────────────────────────────────────────────
interface Tech {
  skill: number; // jobs per day
  quality: number; // average rating
  late: number; // chance of arriving late
  region: string;
  lat: number;
  lng: number;
}

const person = (n: number, name: string, role: Role, region: string, phone: string, prefix: string): User => ({
  id: `demo-u${n}`,
  staffNo: `OPT-${prefix}-${String(n).padStart(3, '0')}`,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@optimaswifi.co.ke`,
  phone,
  role,
  region,
  active: true,
  mustChangePassword: false,
  lastLoginAt: iso(NOW - between(5, 600) * MIN),
  createdAt: iso(at(120, 9)),
});

export const demoAdmin: User = { ...person(1, 'Demo Admin', 'ADMIN', 'Head office', '0700 000 001', 'ADM'), id: 'demo-admin', staffNo: 'OPT-ADM-001', email: 'admin@optimaswifi.co.ke' };

const supervisor = person(2, 'Grace Achieng', 'SUPERVISOR', 'Nairobi', '0711 222 301', 'SUP');
const storekeeper = person(3, 'Peter Mwangi', 'STOREKEEPER', 'Nairobi', '0722 410 502', 'STO');

const TECH_DEFS: { name: string; phone: string; t: Tech }[] = [
  { name: 'Brian Otieno', phone: '0712 345 101', t: { skill: 2.6, quality: 4.8, late: 0.03, region: 'Kasarani', lat: -1.2191, lng: 36.8979 } },
  { name: 'Mercy Wanjiku', phone: '0723 456 102', t: { skill: 2.3, quality: 4.7, late: 0.05, region: 'Ruaka', lat: -1.2064, lng: 36.7747 } },
  { name: 'Kevin Mutua', phone: '0734 567 103', t: { skill: 2.0, quality: 4.4, late: 0.12, region: 'Rongai', lat: -1.3964, lng: 36.7518 } },
  { name: 'Faith Njeri', phone: '0745 678 104', t: { skill: 1.9, quality: 4.6, late: 0.06, region: 'Kitengela', lat: -1.4731, lng: 36.9569 } },
  { name: 'Samuel Kiprop', phone: '0756 789 105', t: { skill: 1.6, quality: 4.1, late: 0.2, region: 'Embakasi', lat: -1.3236, lng: 36.9005 } },
  { name: 'Janet Akinyi', phone: '0767 890 106', t: { skill: 2.2, quality: 4.5, late: 0.08, region: 'Githurai', lat: -1.1989, lng: 36.9249 } },
  { name: 'Dennis Kamau', phone: '0778 901 107', t: { skill: 1.4, quality: 3.9, late: 0.25, region: 'Thika Road', lat: -1.2402, lng: 36.8812 } },
  { name: 'Lucy Chebet', phone: '0789 012 108', t: { skill: 1.8, quality: 4.3, late: 0.1, region: 'Kikuyu', lat: -1.2467, lng: 36.6631 } },
];
export const techs: (User & { t: Tech })[] = TECH_DEFS.map((d, i) => ({ ...person(10 + i, d.name, 'TECHNICIAN', d.t.region, d.phone, 'TEC'), t: d.t }));
export const allUsers: User[] = [demoAdmin, supervisor, storekeeper, ...techs.map(({ t: _t, ...u }) => u)];
const asPerson = (u: User): Person => ({ id: u.id, name: u.name, staffNo: u.staffNo, phone: u.phone });

// ── Catalogue and devices ─────────────────────────────────────────────────────────────────────────
type ItemDef = Omit<Item, 'id' | 'stock' | 'lowStock'> & { store: number };
const ITEM_DEFS: ItemDef[] = [
  { sku: 'RTR-HW-AX3', name: 'Huawei AX3 Wi-Fi 6 Router', category: 'ROUTER', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 5200, reorderLevel: 10, store: 0 },
  { sku: 'RTR-TP-C6', name: 'TP-Link Archer C6 Router', category: 'ROUTER', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 3800, reorderLevel: 8, store: 0 },
  { sku: 'ONT-ZTE-F670', name: 'ZTE F670L Fibre ONT', category: 'ONT', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 4500, reorderLevel: 10, store: 0 },
  { sku: 'ONT-HW-HG8010', name: 'Huawei HG8010H ONT', category: 'ONT', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 3900, reorderLevel: 6, store: 0 },
  { sku: 'CBL-DROP-1C', name: 'Fibre drop cable (1 core)', category: 'CABLE', tracking: 'BULK', unit: 'm', unitPrice: 28, reorderLevel: 1500, store: 6200 },
  { sku: 'CBL-CAT6', name: 'Cat6 patch cable 5m', category: 'CABLE', tracking: 'BULK', unit: 'pcs', unitPrice: 350, reorderLevel: 40, store: 118 },
  { sku: 'CON-SC-APC', name: 'SC/APC fast connector', category: 'CONNECTOR', tracking: 'BULK', unit: 'pcs', unitPrice: 120, reorderLevel: 150, store: 96 },
  { sku: 'ACC-SLEEVE', name: 'Fusion splice sleeve', category: 'ACCESSORY', tracking: 'BULK', unit: 'pcs', unitPrice: 15, reorderLevel: 300, store: 940 },
  { sku: 'ACC-CLIP', name: 'Cable clips (pack of 100)', category: 'ACCESSORY', tracking: 'BULK', unit: 'packs', unitPrice: 450, reorderLevel: 12, store: 9 },
  { sku: 'ACC-PWR-12V', name: 'ONT power adapter 12V', category: 'ACCESSORY', tracking: 'BULK', unit: 'pcs', unitPrice: 600, reorderLevel: 25, store: 64 },
  { sku: 'TL-SPLICER', name: 'Fusion splicer', category: 'TOOL', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 145000, reorderLevel: 1, store: 0 },
  { sku: 'TL-OPM', name: 'Optical power meter', category: 'TOOL', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 18500, reorderLevel: 2, store: 0 },
];
const itemRows: (Item & { store: number })[] = ITEM_DEFS.map((d, i) => ({ ...d, id: `demo-i${i + 1}` }));

const UNIT_PLAN: Record<string, Partial<Record<UnitStatus, number>>> = {
  'RTR-HW-AX3': { IN_STORE: 14, WITH_TECHNICIAN: 11, INSTALLED: 38, FAULTY: 2, LOST: 1, IN_TRANSIT: 2 },
  'RTR-TP-C6': { IN_STORE: 9, WITH_TECHNICIAN: 6, INSTALLED: 22, FAULTY: 1 },
  'ONT-ZTE-F670': { IN_STORE: 6, WITH_TECHNICIAN: 9, INSTALLED: 31, FAULTY: 1, IN_TRANSIT: 1 },
  'ONT-HW-HG8010': { IN_STORE: 7, WITH_TECHNICIAN: 4, INSTALLED: 17 },
  'TL-SPLICER': { IN_STORE: 1, WITH_TECHNICIAN: 3 },
  'TL-OPM': { IN_STORE: 1, WITH_TECHNICIAN: 4 },
};
const PREFIX: Record<string, string> = { 'RTR-HW-AX3': 'HWAX3', 'RTR-TP-C6': 'TPC6', 'ONT-ZTE-F670': 'ZTEF6', 'ONT-HW-HG8010': 'HGONT', 'TL-SPLICER': 'SPLCR', 'TL-OPM': 'OPMTR' };

const units: (SerialUnit & { holderId: string | null })[] = [];
let unitNo = 0;
for (const item of itemRows.filter((i) => i.tracking === 'SERIALIZED')) {
  for (const [status, n] of Object.entries(UNIT_PLAN[item.sku] ?? {}) as [UnitStatus, number][]) {
    for (let k = 0; k < n; k++) {
      unitNo += 1;
      const holder = status === 'WITH_TECHNICIAN' || status === 'IN_TRANSIT' ? techs[unitNo % techs.length] : null;
      const heldDays = status === 'WITH_TECHNICIAN' ? (unitNo % 11 === 0 ? between(8, 14) : between(0, 6)) : status === 'IN_TRANSIT' ? 1 : 0;
      units.push({
        id: `demo-s${unitNo}`,
        serialNumber: `${PREFIX[item.sku]}-${String(2290000 + unitNo * 37).padStart(7, '0')}`,
        status,
        heldSince: holder ? iso(NOW - (heldDays * DAY + between(1, 9) * 3_600_000)) : null,
        daysHeld: holder ? heldDays : undefined,
        customerAccount: status === 'INSTALLED' ? `OPT-C-${1000 + unitNo}` : null,
        item: { id: item.id, name: item.name, sku: item.sku, category: item.category },
        holder: holder ? asPerson(holder) : null,
        holderId: holder?.id ?? null,
      });
    }
  }
}
for (const item of itemRows) {
  if (item.tracking === 'SERIALIZED') item.store = units.filter((u) => u.item.id === item.id && u.status === 'IN_STORE').length;
}

// Bulk stock held by technicians
const bulkHoldings: { techId: string; item: Item; quantity: number }[] = [];
for (const tech of techs) {
  for (const sku of ['CBL-DROP-1C', 'CON-SC-APC', 'ACC-SLEEVE', 'ACC-PWR-12V']) {
    const item = itemRows.find((i) => i.sku === sku)!;
    bulkHoldings.push({ techId: tech.id, item, quantity: sku === 'CBL-DROP-1C' ? between(120, 420) : sku === 'ACC-SLEEVE' ? between(10, 40) : between(4, 24) });
  }
}

export const items: Item[] = itemRows.map(({ store, ...i }) => {
  const withTech =
    i.tracking === 'SERIALIZED'
      ? units.filter((u) => u.item.id === i.id && (u.status === 'WITH_TECHNICIAN' || u.status === 'IN_TRANSIT')).length
      : bulkHoldings.filter((b) => b.item.id === i.id).reduce((n, b) => n + b.quantity, 0);
  return { ...i, stock: { inStore: store, withTechnicians: withTech }, lowStock: store <= i.reorderLevel };
});

// ── Customers and jobs ────────────────────────────────────────────────────────────────────────────
const AREAS: { name: string; lat: number; lng: number }[] = [
  { name: 'Kasarani', lat: -1.2191, lng: 36.8979 },
  { name: 'Ruaka', lat: -1.2064, lng: 36.7747 },
  { name: 'Rongai', lat: -1.3964, lng: 36.7518 },
  { name: 'Kitengela', lat: -1.4731, lng: 36.9569 },
  { name: 'Embakasi', lat: -1.3236, lng: 36.9005 },
  { name: 'Githurai 45', lat: -1.1989, lng: 36.9249 },
  { name: 'Roysambu', lat: -1.2194, lng: 36.8851 },
  { name: 'Kikuyu', lat: -1.2467, lng: 36.6631 },
  { name: 'South B', lat: -1.3086, lng: 36.8363 },
  { name: 'Kilimani', lat: -1.2905, lng: 36.7836 },
  { name: 'Syokimau', lat: -1.3578, lng: 36.9368 },
  { name: 'Zimmerman', lat: -1.2108, lng: 36.8931 },
];
const FIRST = ['Wanjiru', 'Otieno', 'Achieng', 'Kamau', 'Njeri', 'Mutua', 'Chebet', 'Omondi', 'Wambui', 'Kiprono', 'Atieno', 'Mwangi', 'Naliaka', 'Barasa', 'Muthoni', 'Ochieng', 'Wafula', 'Nyambura', 'Kariuki', 'Adhiambo'];
const GIVEN = ['Grace', 'John', 'Mary', 'Peter', 'Esther', 'David', 'Ann', 'James', 'Ruth', 'Joseph', 'Lilian', 'Samuel', 'Agnes', 'Paul', 'Rose'];
const STREETS = ['Mwiki Road', 'Kamiti Road', 'Garden Estate', 'Thome 2', 'Ngong Road', 'Mombasa Road', 'Outer Ring Road', 'Eastern Bypass', 'Kangundo Road', 'Limuru Road', 'Mugumo Close', 'Mumbi Lane'];
const TYPE_TITLE: Record<TaskType, string[]> = {
  INSTALLATION: ['New fibre installation', 'Home fibre installation', 'Business line installation'],
  REPAIR: ['No internet — fault repair', 'Slow speeds — line check', 'Router replacement', 'Cable cut repair'],
  MAINTENANCE: ['Scheduled line maintenance', 'Signal level check'],
  RELOCATION: ['Move service to new house'],
  SURVEY: ['Site survey for fibre'],
};
const FEEDBACK: Record<number, string[]> = {
  5: ['Very professional and quick. Internet is flying!', 'Arrived on time, tidy work, explained everything.', 'Excellent service, thank you.', 'Best installation I have had. Neat cables.', 'Fixed it in 20 minutes. Great technician!'],
  4: ['Good job, slightly late but worked well.', 'Happy with the speed now. Thanks.', 'Friendly and knowledgeable.'],
  3: ['Fixed, but took longer than promised.', 'Okay service. Had to call twice.'],
  2: ['Came late and the fault returned the next day.'],
};

const photo = (n: string, lat: number, lng: number, when: number): PhotoRef => ({ id: `demo-p-${n}`, flags: [], lat, lng, receivedAt: iso(when) });
let taskNo = 0;
const mkTask = (o: { tech: User & { t: Tech }; status: TaskStatus; type?: TaskType; start: number; priority?: TaskPriority; rated?: boolean }): Task => {
  taskNo += 1;
  const type = o.type ?? pick<TaskType>(['INSTALLATION', 'INSTALLATION', 'REPAIR', 'REPAIR', 'REPAIR', 'MAINTENANCE', 'RELOCATION', 'SURVEY']);
  const area = pick(AREAS);
  const lat = area.lat + (rnd() - 0.5) * 0.02;
  const lng = area.lng + (rnd() - 0.5) * 0.02;
  const customerName = `${pick(GIVEN)} ${pick(FIRST)}`;
  const finished = o.status === 'COMPLETED' || o.status === 'VERIFIED';
  const mins = type === 'INSTALLATION' ? between(75, 160) : type === 'SURVEY' ? between(25, 50) : between(30, 95);
  const started = o.status === 'ASSIGNED' || o.status === 'CANCELLED' ? null : o.start;
  const ended = finished ? o.start + mins * MIN : null;
  const rating = finished && (o.rated ?? rnd() < 0.7) ? Math.max(2, Math.min(5, Math.round(o.tech.t.quality + (rnd() - 0.5) * 1.6))) : null;
  const materials: TaskMaterial[] = finished
    ? [
        { id: `demo-m${taskNo}a`, quantity: type === 'INSTALLATION' ? between(40, 120) : between(5, 30), unitPrice: 28, amount: 0, item: { name: 'Fibre drop cable (1 core)', sku: 'CBL-DROP-1C', unit: 'm', category: 'CABLE' as const }, unit: null },
        ...(type === 'INSTALLATION' ? [{ id: `demo-m${taskNo}b`, quantity: 2, unitPrice: 120, amount: 240, item: { name: 'SC/APC fast connector', sku: 'CON-SC-APC', unit: 'pcs', category: 'CONNECTOR' as const }, unit: null }] : []),
      ].map((m) => ({ ...m, amount: m.quantity * m.unitPrice }))
    : [];
  const code = `JOB-${String(2400 + taskNo).padStart(4, '0')}`;
  return {
    id: `demo-t${taskNo}`,
    code,
    title: pick(TYPE_TITLE[type]),
    description: type === 'REPAIR' ? 'Customer reports intermittent connection. Check the line, ONT and router.' : 'Standard job. Confirm the customer is home before travelling.',
    type,
    priority: o.priority ?? (rnd() < 0.12 ? 'HIGH' : rnd() < 0.04 ? 'URGENT' : 'NORMAL'),
    status: o.status,
    customerName,
    customerPhone: `07${between(10, 99)} ${between(100, 999)} ${between(100, 999)}`,
    customerAccount: `OPT-C-${between(1001, 1400)}`,
    address: `${between(2, 88)} ${pick(STREETS)}, ${area.name}`,
    lat,
    lng,
    dueAt: iso(o.start + between(1, 5) * 3_600_000),
    startedAt: started ? iso(started) : null,
    endedAt: ended ? iso(ended) : null,
    durationMinutes: finished ? mins : null,
    completionNotes: finished ? 'Job completed, speed test passed, customer shown how to restart the router.' : null,
    amountCollected: finished && type === 'INSTALLATION' ? pick([1500, 2500, 3500, 5000]) : null,
    verificationNote: o.status === 'VERIFIED' ? 'Photos clear. Approved.' : null,
    customerSignature: null,
    signedByName: finished ? customerName : null,
    signedAt: ended ? iso(ended) : null,
    customerRating: rating,
    customerFeedback: rating ? pick(FEEDBACK[rating] ?? FEEDBACK[4]) : null,
    ratedAt: rating && ended ? iso(ended + between(20, 600) * MIN) : null,
    createdAt: iso(o.start - between(2, 20) * 3_600_000),
    assignee: asPerson(o.tech),
    createdBy: asPerson(supervisor),
    verifiedBy: o.status === 'VERIFIED' ? asPerson(supervisor) : null,
    startPhoto: started ? photo(`${taskNo}s`, lat, lng, started) : null,
    endPhoto: ended ? photo(`${taskNo}e`, lat, lng, ended) : null,
    materials,
  };
};

const tasks: Task[] = [];
// The last 30 days of finished work
for (let d = 1; d <= 30; d++) {
  for (const tech of techs) {
    const n = Math.round(tech.t.skill * (0.55 + rnd() * 0.9) * (d % 7 === 0 ? 0.3 : 1));
    for (let k = 0; k < n; k++) {
      const status: TaskStatus = d === 1 && rnd() < 0.5 ? 'COMPLETED' : rnd() < 0.03 ? 'REJECTED' : 'VERIFIED';
      tasks.push(mkTask({ tech, status, start: at(d, 8 + k * 2 + between(0, 1), between(0, 50)) }));
    }
  }
}
// Today: finished, in progress and waiting
const [t0, t1, t2, t3, t4, t5, t6, t7] = techs;
tasks.push(mkTask({ tech: t0, status: 'COMPLETED', start: at(0, 8, 40), type: 'INSTALLATION', rated: false }));
tasks.push(mkTask({ tech: t1, status: 'COMPLETED', start: at(0, 9, 5), type: 'REPAIR', rated: false }));
tasks.push(mkTask({ tech: t5, status: 'COMPLETED', start: at(0, 9, 30), type: 'INSTALLATION', rated: false }));
tasks.push(mkTask({ tech: t0, status: 'IN_PROGRESS', start: NOW - 38 * MIN, type: 'INSTALLATION', priority: 'HIGH' }));
tasks.push(mkTask({ tech: t2, status: 'IN_PROGRESS', start: NOW - 22 * MIN, type: 'REPAIR' }));
tasks.push(mkTask({ tech: t7, status: 'IN_PROGRESS', start: NOW - 51 * MIN, type: 'MAINTENANCE' }));
for (const [tech, type, priority] of [
  [t1, 'INSTALLATION', 'NORMAL'],
  [t3, 'INSTALLATION', 'NORMAL'],
  [t3, 'REPAIR', 'URGENT'],
  [t4, 'REPAIR', 'HIGH'],
  [t5, 'SURVEY', 'NORMAL'],
  [t6, 'REPAIR', 'NORMAL'],
  [t2, 'INSTALLATION', 'NORMAL'],
  [t7, 'RELOCATION', 'LOW'],
] as [(typeof techs)[number], TaskType, TaskPriority][]) {
  tasks.push(mkTask({ tech, status: 'ASSIGNED', type, priority, start: NOW + between(30, 280) * MIN }));
}
tasks.push(mkTask({ tech: t4, status: 'CANCELLED', start: at(2, 10), type: 'REPAIR' }));
tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export { tasks };

// ── Attendance ────────────────────────────────────────────────────────────────────────────────────
const dateOf = (ms: number) => new Date(ms + 3 * 3_600_000).toISOString().slice(0, 10);
const attendanceFor = (user: User, daysAgo: number, late: boolean, checkedOut: boolean): Attendance => {
  const inAt = at(daysAgo, 8, late ? between(18, 55) : between(0, 12));
  const outAt = checkedOut ? at(daysAgo, between(16, 18), between(0, 50)) : null;
  const t = techs.find((x) => x.id === user.id)!;
  return {
    id: `demo-a-${user.id}-${daysAgo}`,
    userId: user.id,
    workDate: dateOf(inAt),
    status: late ? 'LATE' : 'PRESENT',
    checkInAt: iso(inAt),
    checkOutAt: outAt ? iso(outAt) : null,
    workedMinutes: outAt ? Math.round((outAt - inAt) / MIN) : null,
    dressReview: daysAgo === 0 ? (rnd() < 0.5 ? 'PENDING' : 'APPROVED') : 'APPROVED',
    reviewNote: null,
    checkInPhoto: photo(`in-${user.id}-${daysAgo}`, t.t.lat, t.t.lng, inAt),
    checkOutPhoto: outAt ? photo(`out-${user.id}-${daysAgo}`, t.t.lat, t.t.lng, outAt) : null,
    user: { id: user.id, name: user.name, staffNo: user.staffNo, role: user.role },
  };
};
export const attendanceHistory: Attendance[] = [];
for (let d = 0; d <= 30; d++) {
  for (const tech of techs) {
    if (d === 0) continue;
    if (d % 7 === 0 || rnd() < 0.04) continue;
    attendanceHistory.push(attendanceFor(tech, d, rnd() < tech.t.late, true));
  }
}
// Today: everyone but Dennis is in; Samuel and Kevin were late
export const attendanceToday: Attendance[] = techs
  .filter((t) => t.id !== t6.id)
  .map((t) => attendanceFor(t, 0, t.id === t4.id || t.id === t2.id, false));
export const absentToday: Person[] = [asPerson(t6)];
// One photo with a warning, so the review desk shows how flagged items look
{
  const samuel = attendanceToday.find((a) => a.userId === t4.id);
  if (samuel?.checkInPhoto) samuel.checkInPhoto.flags = ['OUTSIDE_GEOFENCE'];
  if (samuel) samuel.dressReview = 'PENDING';
}
attendanceHistory.unshift(...attendanceToday);

// ── Movements, requests, notifications, audit ─────────────────────────────────────────────────────
const movementTypes = ['RECEIVE', 'ISSUE', 'ACCEPT', 'INSTALL', 'CONSUME', 'RETURN'] as const;
export const movements: Movement[] = Array.from({ length: 70 }, (_, i) => {
  const type = pick(movementTypes);
  const tech = pick(techs);
  const unit = type === 'CONSUME' ? null : pick(units.filter((u) => u.item.category === 'ROUTER' || u.item.category === 'ONT'));
  const item = unit ? itemRows.find((x) => x.id === unit.item.id)! : pick(itemRows.filter((x) => x.tracking === 'BULK'));
  return {
    id: `demo-mv${i}`,
    type,
    quantity: unit ? 1 : between(2, 60),
    note: type === 'RECEIVE' ? 'Delivery from supplier' : null,
    createdAt: iso(NOW - i * between(40, 160) * MIN),
    item: { name: item.name, unit: item.unit },
    unit: unit ? { serialNumber: unit.serialNumber } : null,
    actor: { name: type === 'INSTALL' || type === 'CONSUME' || type === 'ACCEPT' ? tech.name : storekeeper.name },
    fromUser: type === 'ISSUE' || type === 'RECEIVE' ? { name: storekeeper.name } : type === 'RETURN' ? { name: tech.name } : null,
    toUser: type === 'ISSUE' || type === 'ACCEPT' ? { name: tech.name } : type === 'RETURN' ? { name: storekeeper.name } : null,
    task: type === 'INSTALL' || type === 'CONSUME' ? { code: pick(tasks).code } : null,
  };
});

export const requests: ServiceRequest[] = [
  { id: 'demo-r1', type: 'REPAIR', description: 'Internet keeps dropping every evening.', phone: '0712 880 441', address: '14 Mwiki Road, Kasarani', status: 'OPEN', closedNote: null, createdAt: iso(NOW - 2 * 3_600_000), customerAccount: 'OPT-C-1042', customer: { id: 'c1', name: 'Grace Wanjiru', phone: '0712 880 441', customerAccount: 'OPT-C-1042', address: '14 Mwiki Road, Kasarani' } },
  { id: 'demo-r2', type: 'INSTALLATION', description: 'New fibre for our shop, 20 Mbps.', phone: '0733 120 884', address: 'Tom Mboya St, Ruaka', status: 'OPEN', closedNote: null, createdAt: iso(NOW - 5 * 3_600_000), customerAccount: null, customer: { id: 'c2', name: 'Otieno Hardware', phone: '0733 120 884', customerAccount: null, address: 'Tom Mboya St, Ruaka' } },
  { id: 'demo-r3', type: 'RELOCATION', description: 'Moving to Syokimau next week — please move my line.', phone: '0701 554 332', address: 'Syokimau Phase 2', status: 'SCHEDULED', closedNote: null, createdAt: iso(NOW - 26 * 3_600_000), customerAccount: 'OPT-C-1117', customer: { id: 'c3', name: 'Mercy Atieno', phone: '0701 554 332', customerAccount: 'OPT-C-1117', address: 'Syokimau Phase 2' }, task: { id: tasks[0].id, code: tasks[0].code, status: 'ASSIGNED', assignee: { name: t3.name } } },
  { id: 'demo-r4', type: 'REPAIR', description: 'Router lights red since morning.', phone: '0722 334 115', address: 'Rongai, Maasai Lodge Rd', status: 'CLOSED', closedNote: 'Replaced the ONT power adapter.', createdAt: iso(NOW - 70 * 3_600_000), customerAccount: 'OPT-C-1201', customer: { id: 'c4', name: 'Samuel Kiprono', phone: '0722 334 115', customerAccount: 'OPT-C-1201', address: 'Rongai, Maasai Lodge Rd' } },
];

export const notifications = [
  { id: 'demo-n1', type: 'TASK_COMPLETED', title: 'Job completed', body: `${t0.name} finished ${tasks.find((t) => t.status === 'COMPLETED')?.code ?? 'JOB'} — waiting for your verification.`, data: null, readAt: null, createdAt: iso(NOW - 14 * MIN) },
  { id: 'demo-n2', type: 'ATTENDANCE_LATE', title: 'Late check-in', body: `${t4.name} checked in at 08:41.`, data: null, readAt: null, createdAt: iso(NOW - 3 * 3_600_000) },
  { id: 'demo-n3', type: 'LOW_STOCK', title: 'Low stock', body: 'Cable clips (pack of 100): 9 left, reorder level 12.', data: null, readAt: null, createdAt: iso(NOW - 5 * 3_600_000) },
  { id: 'demo-n4', type: 'REQUEST_NEW', title: 'New customer request', body: 'Otieno Hardware asked for a new fibre installation.', data: null, readAt: iso(NOW - 4 * 3_600_000), createdAt: iso(NOW - 5 * 3_600_000) },
  { id: 'demo-n5', type: 'TASK_RATED', title: 'New 5-star rating', body: `${t0.name} was rated 5 stars by a customer.`, data: null, readAt: iso(NOW - 20 * 3_600_000), createdAt: iso(NOW - 22 * 3_600_000) },
  { id: 'demo-n6', type: 'UNIT_OVERDUE', title: 'Device held too long', body: 'One router has been with a technician for more than 7 days.', data: null, readAt: iso(NOW - 30 * 3_600_000), createdAt: iso(NOW - 32 * 3_600_000) },
];

const AUDIT_LINES: [string, string, string][] = [
  ['TASK_CREATED', 'Task', 'created job {code} for {name}'],
  ['TASK_VERIFIED', 'Task', 'verified job {code}'],
  ['UNIT_ISSUED', 'InventoryItem', 'issued a router to {name}'],
  ['USER_UPDATED', 'User', 'updated the profile of {name}'],
  ['REQUEST_SCHEDULED', 'ServiceRequest', 'scheduled a customer request for {name}'],
  ['ITEM_CREATED', 'InventoryItem', 'added an item to the catalogue'],
];
export const auditEntries = Array.from({ length: 60 }, (_, i) => {
  const [action, entity, line] = pick(AUDIT_LINES);
  const actor = pick([supervisor, storekeeper, demoAdmin]);
  return {
    id: `demo-au${i}`,
    action,
    entity,
    entityId: null,
    summary: line.replace('{code}', pick(tasks).code).replace('{name}', pick(techs).name),
    createdAt: iso(NOW - i * between(25, 140) * MIN),
    actor: { name: actor.name, staffNo: actor.staffNo, role: actor.role },
  };
});

// ── Views the screens ask for ─────────────────────────────────────────────────────────────────────
export const unitsInStatus = (s: UnitStatus) => units.filter((u) => u.status === s).length;
export const allUnits = units;
export const bulkOf = (techId: string): BulkHolding[] =>
  bulkHoldings.filter((b) => b.techId === techId).map((b, i) => ({ id: `demo-b${techId}-${i}`, quantity: b.quantity, item: { id: b.item.id, name: b.item.name, sku: b.item.sku, unit: b.item.unit, unitPrice: b.item.unitPrice, category: b.item.category } }));
export const team = (): TeamMember[] =>
  [supervisor, storekeeper, ...techs.map(({ t: _t, ...u }) => u)].map((u) => {
    const rec = attendanceToday.find((a) => a.userId === u.id);
    return {
      ...u,
      today: rec ? { status: rec.status, checkInAt: rec.checkInAt, checkOutAt: rec.checkOutAt, dressReview: rec.dressReview } : null,
      openTasks: tasks.filter((t) => t.assignee.id === u.id && (t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')).length,
      unitsInCustody: units.filter((x) => x.holderId === u.id).length,
    };
  });
export { supervisor, storekeeper, asPerson, dateOf, DAY, MIN, NOW };
