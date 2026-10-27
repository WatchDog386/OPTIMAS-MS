import { ApiError } from '../api/errors';
import type { Dashboard, MyStats, Reconciliation, StockCountResult, Task } from '../api/types';
import {
  DAY,
  MIN,
  NOW,
  absentToday,
  allUnits,
  allUsers,
  asPerson,
  attendanceHistory,
  attendanceToday,
  auditEntries,
  bulkOf,
  dateOf,
  demoAdmin,
  iso,
  items,
  movements,
  notifications,
  requests,
  tasks,
  team,
  techs,
  unitsInStatus,
} from './data';

/*
 * Answers the app's API calls from the demo data instead of the server.
 * Reading works everywhere; saving is refused with a clear message so the demo can never be mistaken for real work.
 */

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const done = (t: Task) => t.status === 'COMPLETED' || t.status === 'VERIFIED';
const endedMs = (t: Task) => (t.endedAt ? Date.parse(t.endedAt) : 0);
const inLast = (ms: number, days: number) => ms >= NOW - days * DAY;

function dashboard(): Dashboard {
  const week = tasks.filter((t) => done(t) && inLast(endedMs(t), 7));
  const lostRecent = unitsInStatus('LOST');
  return {
    attendance: {
      technicians: techs.length,
      checkedIn: attendanceToday.length,
      late: attendanceToday.filter((a) => a.status === 'LATE').length,
      checkedOut: attendanceToday.filter((a) => a.checkOutAt).length,
      absent: absentToday.length,
      pendingDressReviews: attendanceToday.filter((a) => a.dressReview === 'PENDING').length,
    },
    tasks: {
      assigned: tasks.filter((t) => t.status === 'ASSIGNED').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      awaitingVerification: tasks.filter((t) => t.status === 'COMPLETED').length,
      completedLast7Days: week.length,
      avgDurationMinutes: Math.round(avg(week.map((t) => t.durationMinutes ?? 0))),
      amountCollectedLast7Days: week.reduce((n, t) => n + (t.amountCollected ?? 0), 0),
    },
    routers: {
      inStore: unitsInStatus('IN_STORE'),
      inTransit: unitsInStatus('IN_TRANSIT'),
      withTechnicians: unitsInStatus('WITH_TECHNICIAN'),
      installed: unitsInStatus('INSTALLED'),
      faulty: unitsInStatus('FAULTY'),
      lost: lostRecent,
      overdueInCustody: allUnits.filter((u) => (u.daysHeld ?? 0) > 7).length,
      lostLast30Days: lostRecent,
      missingInSpotCounts: 2,
    },
    lowStockItems: items.filter((i) => i.lowStock).length,
    requests: { open: requests.filter((r) => r.status === 'OPEN').length },
  };
}

function reconciliation(): Reconciliation {
  return {
    generatedAt: iso(NOW),
    ageAlertDays: 7,
    technicians: techs.map((t) => {
      const mine = allUnits.filter((u) => u.holderId === t.id);
      const overdue = mine.filter((u) => (u.daysHeld ?? 0) > 7);
      const installed = tasks.filter((x) => x.assignee.id === t.id && x.type === 'INSTALLATION' && done(x) && inLast(endedMs(x), 30)).length;
      const pending = mine.filter((u) => u.status === 'IN_TRANSIT').length;
      return {
        technician: asPerson(t),
        serialised: {
          issued: mine.length + installed + 1,
          installed,
          returned: 1,
          lost: 0,
          inHand: mine.length - pending,
          pendingAcceptance: pending,
          overdue: overdue.map((u) => ({ serialNumber: u.serialNumber, name: u.item.name, heldSince: u.heldSince ?? iso(NOW) })),
        },
        bulkInHand: bulkOf(t.id).map((b) => ({ name: b.item.name, unit: b.item.unit, quantity: b.quantity })),
        lastCount: t.name.startsWith('Samuel') ? { at: iso(NOW - 2 * DAY), missing: [allUnits.find((u) => u.holderId === t.id)?.serialNumber ?? 'HWAX3-0000000'], unexpected: [] } : { at: iso(NOW - 3 * DAY), missing: [], unexpected: [] },
        risk: overdue.length ? 'HIGH' : t.name.startsWith('Samuel') ? 'HIGH' : 'CLEAR',
      };
    }),
  };
}

function myStats(): MyStats {
  const me = techs[0];
  const mine = tasks.filter((t) => t.assignee.id === me.id);
  const month = mine.filter((t) => done(t) && inLast(endedMs(t), 30));
  const week = mine.filter((t) => done(t) && inLast(endedMs(t), 7));
  const att = attendanceHistory.filter((a) => a.userId === me.id);
  const ratings = month.map((t) => t.customerRating).filter((r): r is number => r != null);
  return {
    openTasks: mine.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length,
    completedThisMonth: month.length,
    avgJobMinutes: Math.round(avg(month.map((t) => t.durationMinutes ?? 0))),
    daysPresent: att.length,
    lateDays: att.filter((a) => a.status === 'LATE').length,
    hoursWorked: Math.round(att.reduce((n, a) => n + (a.workedMinutes ?? 0), 0) / 60),
    unitsInCustody: allUnits.filter((u) => u.holderId === me.id).length,
    week: { jobs: week.length, avgMinutes: Math.round(avg(week.map((t) => t.durationMinutes ?? 0))), hours: Math.round(week.length * 1.4), days: Math.min(6, att.filter((a) => inLast(Date.parse(a.checkInAt), 7)).length) },
    month: { jobs: month.length, avgMinutes: Math.round(avg(month.map((t) => t.durationMinutes ?? 0))), days: att.length, onTimeRate: 92, verified: month.filter((t) => t.status === 'VERIFIED').length, sentBack: 1 },
    rating: { average: ratings.length ? round1(avg(ratings)) : null, count: ratings.length },
  };
}

// ── Insights (same shapes as the real /insights endpoints) ────────────────────────────────────────
const dayKeys = (days: number) => Array.from({ length: days }, (_, i) => dateOf(NOW - (days - 1 - i) * DAY));

function leaderboard(range: 'week' | 'month') {
  const days = range === 'month' ? 30 : 7;
  const leaders = techs.map((u) => {
    const mine = tasks.filter((t) => t.assignee.id === u.id && done(t) && inLast(endedMs(t), days));
    const rated = mine.map((t) => t.customerRating).filter((r): r is number => r != null);
    const att = attendanceHistory.filter((a) => a.userId === u.id && inLast(Date.parse(a.checkInAt), days));
    const late = att.filter((a) => a.status === 'LATE').length;
    const rating = rated.length ? round1(avg(rated)) : null;
    const onTime = mine.filter((t) => t.dueAt && t.endedAt);
    return {
      user: { id: u.id, name: u.name, staffNo: u.staffNo, region: u.region },
      jobs: mine.length,
      avgMinutes: Math.round(avg(mine.map((t) => t.durationMinutes ?? 0))),
      rating: { average: rating, count: rated.length },
      daysPresent: att.length,
      lateDays: late,
      onTimeRate: onTime.length ? Math.round((onTime.filter((t) => Date.parse(t.endedAt!) <= Date.parse(t.dueAt!)).length / onTime.length) * 100) : null,
      score: Math.max(0, Math.round(mine.length * 10 + (rating ?? 0) * 8 + att.length * 2 - late * 3)),
    };
  });
  leaders.sort((a, b) => b.score - a.score || b.jobs - a.jobs);
  return { range, days, from: iso(NOW - days * DAY), leaders: leaders.map((l, i) => ({ rank: i + 1, ...l })) };
}

function liveMap() {
  const staff = techs.map((u) => {
    const att = attendanceToday.find((a) => a.userId === u.id);
    const current = tasks.find((t) => t.assignee.id === u.id && t.status === 'IN_PROGRESS');
    const state = !att || att.checkOutAt ? 'OFFLINE' : current ? 'ON_JOB' : 'AVAILABLE';
    const wobble = (u.id.charCodeAt(u.id.length - 1) % 5) / 400;
    return {
      user: { id: u.id, name: u.name, staffNo: u.staffNo, phone: u.phone },
      state,
      lat: current?.lat ?? u.t.lat + wobble,
      lng: current?.lng ?? u.t.lng - wobble,
      seenAt: att ? iso(NOW - (u.id.charCodeAt(u.id.length - 1) % 9 + 2) * MIN) : null,
      currentTask: current ? { code: current.code, title: current.title } : null,
    };
  });
  const jobs = tasks
    .filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')
    .map((t) => ({ id: t.id, code: t.code, title: t.title, status: t.status, priority: t.priority, address: t.address, lat: t.lat, lng: t.lng, assigneeName: t.assignee.name }));
  return { generatedAt: iso(NOW), staff, jobs };
}

function charts(days: number) {
  const keys = dayKeys(days);
  const perDay = keys.map((date) => {
    const finished = tasks.filter((t) => done(t) && t.endedAt && dateOf(Date.parse(t.endedAt)) === date);
    const att = attendanceHistory.filter((a) => a.workDate === date);
    const installs = finished.filter((t) => t.type === 'INSTALLATION').length;
    return {
      date,
      created: tasks.filter((t) => dateOf(Date.parse(t.createdAt)) === date).length,
      completed: finished.length,
      collected: finished.reduce((n, t) => n + (t.amountCollected ?? 0), 0),
      present: att.length,
      late: att.filter((a) => a.status === 'LATE').length,
      issued: installs + 2 + (date.charCodeAt(9) % 4),
      returned: date.charCodeAt(9) % 3,
      installed: installs,
      consumed: finished.reduce((n, t) => n + (t.materials?.[0]?.quantity ?? 0), 0),
    };
  });
  const counts: Record<string, number> = {};
  for (const t of tasks) if (done(t) && inLast(endedMs(t), days)) counts[t.type] = (counts[t.type] ?? 0) + 1;
  return { days, perDay, byType: Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count) };
}

function ratings() {
  const rated = tasks.filter((t) => t.customerRating != null && t.ratedAt && inLast(Date.parse(t.ratedAt), 90)).sort((a, b) => (b.ratedAt ?? '').localeCompare(a.ratedAt ?? ''));
  const byTech = new Map<string, { user: { id: string; name: string; staffNo: string }; sum: number; count: number }>();
  for (const t of rated) {
    const row = byTech.get(t.assignee.id) ?? { user: { id: t.assignee.id, name: t.assignee.name, staffNo: t.assignee.staffNo }, sum: 0, count: 0 };
    row.sum += t.customerRating ?? 0;
    row.count += 1;
    byTech.set(t.assignee.id, row);
  }
  return {
    average: round1(avg(rated.map((t) => t.customerRating ?? 0))),
    count: rated.length,
    distribution: [1, 2, 3, 4, 5].map((stars) => ({ stars, count: rated.filter((t) => t.customerRating === stars).length })),
    byTechnician: [...byTech.values()].map((r) => ({ user: r.user, average: round1(r.sum / r.count), count: r.count })).sort((a, b) => b.average - a.average || b.count - a.count),
    recent: rated.slice(0, 20).map((t) => ({ id: t.id, code: t.code, title: t.title, customerName: t.customerName, rating: t.customerRating, feedback: t.customerFeedback, ratedAt: t.ratedAt, technician: t.assignee.name })),
  };
}

// ── Review desk (same shapes as /approvals/...) ────────────────────────────────────────────────────
const who = (id: string) => {
  const u = allUsers.find((x) => x.id === id)!;
  return { id: u.id, name: u.name, staffNo: u.staffNo, phone: u.phone };
};
const DRESS = { uniform: true, idBadge: true, safetyBoots: true, groomed: true };
// Yesterday's check-outs: the three most recent still wait for a look, the rest were approved
const yesterday = dateOf(NOW - DAY);
const checkOuts = () =>
  attendanceHistory
    .filter((a) => a.workDate === yesterday && a.checkOutAt)
    .map((a, i) => ({ ...a, user: who(a.userId), checkOutReview: i < 3 ? 'PENDING' : 'APPROVED', checkOutNote: null, checkOutReviewedAt: i < 3 ? null : iso(NOW - 14 * 3_600_000), checkOutReviewedBy: i < 3 ? null : { id: 'demo-u2', name: 'Grace Achieng' } }));
const checkIns = (status: string) =>
  (status === 'PENDING' ? attendanceToday.filter((a) => a.dressReview === 'PENDING') : attendanceHistory.filter((a) => a.workDate === yesterday))
    .map((a) => ({ ...a, user: who(a.userId), dressChecklist: DRESS, reviewedAt: status === 'PENDING' ? null : iso(NOW - 20 * 3_600_000), reviewedBy: status === 'PENDING' ? null : { id: 'demo-u2', name: 'Grace Achieng' }, dressReview: status === 'PENDING' ? 'PENDING' : 'APPROVED' }));
const jobReview = (t: Task) => ({ ...t, customerSignature: undefined, signed: t.type === 'INSTALLATION', assignee: { ...t.assignee }, verifiedBy: t.verifiedBy ?? null, verifiedAt: t.status === 'VERIFIED' ? t.ratedAt ?? t.endedAt : null, materials: t.materials ?? [] });

function activity(userId: string, date: string) {
  const user = allUsers.find((u) => u.id === userId);
  if (!user) throw new ApiError(404, 'Person not found', 'NOT_FOUND');
  const att = attendanceHistory.find((a) => a.userId === userId && a.workDate === date);
  const events: Record<string, unknown>[] = [];
  if (att) {
    events.push({ at: att.checkInAt, kind: 'CHECK_IN', title: att.status === 'LATE' ? 'Checked in late' : 'Checked in', photo: att.checkInPhoto, status: att.dressReview, attendanceId: att.id });
    if (att.checkOutAt) events.push({ at: att.checkOutAt, kind: 'CHECK_OUT', title: 'Checked out', detail: att.workedMinutes != null ? `${Math.floor(att.workedMinutes / 60)} h ${att.workedMinutes % 60} min worked` : undefined, photo: att.checkOutPhoto, status: date === yesterday ? 'PENDING' : 'APPROVED', attendanceId: att.id });
  }
  for (const t of tasks.filter((x) => x.assignee.id === userId)) {
    if (t.startedAt && dateOf(Date.parse(t.startedAt)) === date) events.push({ at: t.startedAt, kind: 'JOB_START', title: `Started ${t.code}`, detail: `${t.title} · ${t.customerName} · ${t.address}`, photo: t.startPhoto, taskId: t.id });
    if (t.endedAt && dateOf(Date.parse(t.endedAt)) === date) {
      events.push({ at: t.endedAt, kind: 'JOB_END', title: `Completed ${t.code}`, detail: `${t.durationMinutes ?? 0} min${t.amountCollected ? ` · KES ${t.amountCollected.toLocaleString('en-KE')} collected` : ''}`, photo: t.endPhoto, status: t.status, taskId: t.id });
      if (t.status === 'VERIFIED') events.push({ at: iso(Date.parse(t.endedAt) + 50 * MIN), kind: 'JOB_VERIFIED', title: `${t.code} verified by Grace Achieng`, taskId: t.id });
    }
  }
  events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const jobsDone = events.filter((e) => e.kind === 'JOB_END').length;
  return {
    user: { ...who(userId), role: user.role },
    date,
    summary: { jobsDone, minutesWorked: att?.workedMinutes ?? null, photos: events.filter((e) => e.photo).length, flags: events.filter((e) => ((e.photo as { flags?: string[] } | undefined)?.flags?.length ?? 0) > 0).length, checkedIn: !!att },
    events,
  };
}

function photoInfo(id: string) {
  const owner = [...attendanceHistory].find((a) => a.checkInPhoto?.id === id || a.checkOutPhoto?.id === id);
  const task = tasks.find((t) => t.startPhoto?.id === id || t.endPhoto?.id === id);
  const p = owner ? (owner.checkInPhoto?.id === id ? owner.checkInPhoto : owner.checkOutPhoto) : task ? (task.startPhoto?.id === id ? task.startPhoto : task.endPhoto) : null;
  if (!p) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');
  const userId = owner?.userId ?? task!.assignee.id;
  return {
    photo: {
      id,
      purpose: owner ? (owner.checkInPhoto?.id === id ? 'CHECK_IN' : 'CHECK_OUT') : task!.startPhoto?.id === id ? 'TASK_START' : 'TASK_END',
      receivedAt: p.receivedAt,
      deviceTime: p.receivedAt,
      lat: p.lat,
      lng: p.lng,
      accuracyM: 8 + (id.length % 9),
      deviceId: `a1b2c3${id.length}f9e8`,
      sizeBytes: 412_000,
      flags: p.flags,
      user: who(userId),
      usedFor: task ? { kind: 'TASK', id: task.id, code: task.code, title: task.title } : { kind: 'ATTENDANCE', id: owner!.id },
    },
  };
}

// ── Router ────────────────────────────────────────────────────────────────────────────────────────
function profileOf(id: string) {
  const user = allUsers.find((u) => u.id === id);
  if (!user) throw new ApiError(404, 'Person not found', 'NOT_FOUND');
  const mine = tasks.filter((t) => t.assignee.id === id);
  const month = mine.filter((t) => done(t) && inLast(endedMs(t), 30));
  const att = attendanceHistory.filter((a) => a.userId === id);
  const count: Record<string, number> = {};
  for (const t of mine) count[t.status] = (count[t.status] ?? 0) + 1;
  return {
    user,
    stats: {
      daysPresent30: att.length,
      lateDays30: att.filter((a) => a.status === 'LATE').length,
      hoursWorked30: Math.round(att.reduce((n, a) => n + (a.workedMinutes ?? 0), 0) / 60),
      dressRejected30: 0,
      tasks: count,
      avgJobMinutes: Math.round(avg(month.map((t) => t.durationMinutes ?? 0))),
      amountCollected: month.reduce((n, t) => n + (t.amountCollected ?? 0), 0),
    },
    attendance: att.slice(0, 14),
    recentTasks: mine.slice(0, 8).map((t) => ({ id: t.id, code: t.code, title: t.title, status: t.status, type: t.type, customerName: t.customerName, endedAt: t.endedAt, durationMinutes: t.durationMinutes })),
    custody: {
      units: allUnits.filter((u) => u.holderId === id).map((u) => ({ id: u.id, serialNumber: u.serialNumber, status: u.status, heldSince: u.heldSince, item: { name: u.item.name } })),
      bulk: bulkOf(id).map((b) => ({ name: b.item.name, unit: b.item.unit, quantity: b.quantity })),
    },
    lastCount: null,
  };
}

function search(q: string) {
  const s = q.trim().toLowerCase();
  const has = (...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(s));
  return {
    tasks: tasks.filter((t) => has(t.code, t.title, t.customerName, t.address)).slice(0, 8).map((t) => ({ id: t.id, code: t.code, title: t.title, status: t.status, customerName: t.customerName, assignee: { name: t.assignee.name } })),
    units: allUnits.filter((u) => has(u.serialNumber, u.customerAccount, u.item.name)).slice(0, 8).map((u) => ({ id: u.id, serialNumber: u.serialNumber, status: u.status, customerAccount: u.customerAccount ?? null, item: { name: u.item.name }, holder: u.holder ? { name: u.holder.name } : null })),
    staff: allUsers.filter((u) => has(u.name, u.staffNo, u.region)).slice(0, 8).map((u) => ({ id: u.id, name: u.name, staffNo: u.staffNo, role: u.role, active: u.active })),
    customers: [],
    requests: requests.filter((r) => has(r.description, r.customer?.name)).map((r) => ({ id: r.id, type: r.type, status: r.status, description: r.description, customer: { name: r.customer?.name ?? '' } })),
  };
}

function myStock() {
  const me = techs[0];
  const mine = allUnits.filter((u) => u.holderId === me.id);
  const count: StockCountResult = { id: 'demo-sc1', expected: mine.map((u) => u.serialNumber), scanned: mine.map((u) => u.serialNumber), missing: [], unexpected: [], createdAt: iso(NOW - 3 * DAY) };
  return { pending: mine.filter((u) => u.status === 'IN_TRANSIT'), units: mine.filter((u) => u.status === 'WITH_TECHNICIAN'), bulk: bulkOf(me.id), lastCount: count, ageAlertDays: 7 };
}

/** Handles one API call the way the server would. `path` includes the query string. */
export async function demoRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = (options.method ?? (options.body ? 'POST' : 'GET')).toUpperCase();
  // Only look-ups; anything that would save something is refused
  if (method !== 'GET') {
    throw new ApiError(403, 'This is demo data, so changes are not saved. Sign out and sign in with your own account to work for real.', 'DEMO');
  }
  await new Promise((r) => setTimeout(r, 120));
  const [route, query = ''] = path.split('?');
  const q = new URLSearchParams(query);
  const body = (v: unknown) => v as T;

  if (route === '/auth/me') return body({ user: demoAdmin });
  if (route === '/notifications/unread-count') return body({ unread: notifications.filter((n) => !n.readAt).length });
  if (route === '/notifications') return body({ notifications, unread: notifications.filter((n) => !n.readAt).length });
  if (route === '/reports/dashboard') return body(dashboard());
  if (route === '/reports/me') return body(myStats());
  if (route === '/inventory/reconciliation') return body(reconciliation());
  if (route === '/inventory/items') return body({ items });
  if (route === '/inventory/my') return body(myStock());
  if (route === '/inventory/movements') return body({ movements: movements.slice(0, Number(q.get('limit') ?? 100)) });
  const unit = /^\/inventory\/units\/([^/]+)\/history$/.exec(route);
  if (unit) {
    const serial = decodeURIComponent(unit[1]);
    const found = allUnits.find((u) => u.serialNumber === serial);
    if (!found) throw new ApiError(404, 'Serial number not found in the demo data', 'NOT_FOUND');
    return body({ unit: { ...found, movements: movements.slice(0, 5), task: null } });
  }

  if (route === '/tasks') {
    const statuses = q.get('status')?.split(',');
    return body({ tasks: statuses ? tasks.filter((t) => statuses.includes(t.status)) : tasks });
  }
  const task = /^\/tasks\/([^/]+)$/.exec(route);
  if (task) {
    const found = tasks.find((t) => t.id === task[1]);
    if (!found) throw new ApiError(404, 'Job not found', 'NOT_FOUND');
    return body({ task: found });
  }

  if (route === '/users') {
    const role = q.get('role');
    return body({ users: team().filter((u) => !role || u.role === role) });
  }
  const person = /^\/users\/([^/]+)$/.exec(route);
  if (person) {
    const found = allUsers.find((u) => u.id === person[1]);
    if (!found) throw new ApiError(404, 'Person not found', 'NOT_FOUND');
    return body(route.includes('/edit') ? { user: found } : { ...profileOf(found.id), user: found });
  }

  if (route === '/attendance/today') return body({ shiftStart: '08:00', graceMinutes: 15, record: attendanceToday.find((a) => a.userId === techs[0].id) ?? null, custody: { units: [], bulk: [], tasksInProgress: 1 } });
  if (route === '/attendance/history') return body({ records: attendanceHistory.filter((a) => a.userId === techs[0].id).slice(0, 30) });
  if (route === '/attendance/reviews/pending') return body({ records: attendanceToday.filter((a) => a.dressReview === 'PENDING') });
  if (route === '/attendance') {
    const day = q.get('date') ?? dateOf(NOW);
    const records = attendanceHistory.filter((a) => a.workDate === day);
    return body({ workDate: day, records, absent: day === dateOf(NOW) ? absentToday : techs.filter((t) => !records.some((r) => r.userId === t.id)).map(asPerson) });
  }

  if (route === '/requests') {
    const status = q.get('status');
    return body({ requests: requests.filter((r) => !status || r.status === status) });
  }
  if (route === '/audit') return body({ entries: auditEntries.slice(0, Number(q.get('limit') ?? 50)) });
  if (route === '/search') return body(search(q.get('q') ?? ''));

  if (route === '/approvals/summary') {
    const ins = checkIns('PENDING').length;
    const outs = checkOuts().filter((r) => r.checkOutReview === 'PENDING').length;
    const jobs = tasks.filter((t) => t.status === 'COMPLETED').length;
    const flagged = checkIns('PENDING').filter((r) => r.checkInPhoto?.flags.length).length + tasks.filter((t) => t.status === 'COMPLETED' && (t.startPhoto?.flags.length || t.endPhoto?.flags.length)).length;
    return body({ checkIns: ins, checkOuts: outs, jobs, total: ins + outs + jobs, flagged });
  }
  if (route === '/approvals/check-ins') return body({ records: checkIns(q.get('status') === 'DONE' ? 'DONE' : 'PENDING') });
  if (route === '/approvals/check-outs') {
    const done = q.get('status') === 'DONE';
    return body({ records: checkOuts().filter((r) => (done ? r.checkOutReview !== 'PENDING' : r.checkOutReview === 'PENDING')) });
  }
  if (route === '/approvals/jobs') {
    const done = q.get('status') === 'DONE';
    return body({ tasks: tasks.filter((t) => (done ? t.status === 'VERIFIED' : t.status === 'COMPLETED')).slice(0, done ? 20 : 50).map(jobReview) });
  }
  if (route === '/approvals/activity') return body(activity(q.get('userId') ?? techs[0].id, q.get('date') ?? dateOf(NOW)));
  const info = /^\/capture\/photos\/([^/]+)\/info$/.exec(route);
  if (info) return body(photoInfo(info[1]));

  if (route === '/insights/leaderboard') return body(leaderboard(q.get('range') === 'month' ? 'month' : 'week'));
  if (route === '/insights/map') return body(liveMap());
  if (route === '/insights/charts') return body(charts(Math.min(30, Math.max(7, Number(q.get('days')) || 14))));
  if (route === '/insights/ratings') return body(ratings());

  throw new ApiError(404, 'This screen has no demo data yet', 'NOT_FOUND');
}
