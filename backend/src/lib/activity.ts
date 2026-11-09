import type { NextFunction, Request, Response } from 'express';
import { prisma } from './prisma';
import { notify } from '../modules/notifications/notifications.service';

/*
 * The activity feed: every action anyone takes in the app (check-in, a job started or finished, stock
 * issued, an account added …) is told to the admins and supervisors as it happens — not only the flagged
 * ones. One rule per action turns the request and its result into a plain sentence. Constant background
 * traffic (sign-in, chat, location, photo uploads, reading notifications) is left out; chat and the
 * flagged events already have their own alerts.
 */

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Say = { title: string; body?: string; data?: Record<string, string> } | null;
type Rule = [method: string, path: RegExp, say: (who: string, req: Request, out: Body) => Say];

const n = (x: unknown) => (typeof x === 'number' ? x : Array.isArray(x) ? x.length : 0);
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const job = (out: Body) => out.task ?? out.job ?? {};
const jobData = (out: Body) => (job(out).id ? { taskId: String(job(out).id) } : undefined);
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }) : '');

const RULES: Rule[] = [
  // Attendance
  ['POST', /^\/attendance\/check-in$/, (who, _r, o) => (o.record?.status === 'LATE' ? null : { title: `${who} checked in`, body: `On time at ${hhmm(o.record?.checkInAt)}.` })],
  ['POST', /^\/attendance\/check-out$/, (who, _r, o) => ({ title: `${who} checked out`, body: `At ${hhmm(o.record?.checkOutAt)}${o.record?.workedMinutes != null ? ` · ${Math.floor(o.record.workedMinutes / 60)} h ${o.record.workedMinutes % 60} min worked` : ''}.` })],
  ['PUT', /^\/attendance\/office$/, (who, r) => ({ title: `${who} moved the office location`, body: `${r.body?.name ?? 'Office'} · check-in zone ${r.body?.radiusM ?? 300} m.` })],
  ['DELETE', /^\/attendance\/office$/, (who) => ({ title: `${who} reset the office location` })],
  ['POST', /^\/attendance\/[^/]+\/review$/, (who, r) => ({ title: `${who} reviewed a check-in photo`, body: r.body?.status === 'REJECTED' ? `Dress code rejected${r.body?.note ? `: ${r.body.note}` : ''}.` : 'Dress code approved.' })],
  ['POST', /^\/attendance\/[^/]+\/review-checkout$/, (who, r) => ({ title: `${who} reviewed a check-out`, body: r.body?.status === 'REJECTED' ? 'Check-out rejected.' : 'Check-out approved.' })],

  // Jobs
  ['POST', /^\/tasks$/, (who, _r, o) => ({ title: `${who} created job ${job(o).code ?? ''}`.trim(), body: [job(o).title, job(o).customerName].filter(Boolean).join(' · '), data: jobData(o) })],
  ['PATCH', /^\/tasks\/[^/]+$/, (who, _r, o) => ({ title: `${who} updated job ${job(o).code ?? ''}`.trim(), body: job(o).title, data: jobData(o) })],
  ['POST', /^\/tasks\/[^/]+\/forward$/, (who, _r, o) => ({ title: `${who} moved job ${job(o).code ?? ''} to another technician`.trim(), body: job(o).title, data: jobData(o) })],
  ['POST', /^\/tasks\/[^/]+\/cancel$/, (who, _r, o) => ({ title: `${who} cancelled job ${job(o).code ?? ''}`.trim(), body: job(o).title, data: jobData(o) })],
  ['POST', /^\/tasks\/[^/]+\/verify$/, (who, r, o) => ({ title: `${who} ${r.body?.approve === false || r.body?.status === 'REJECTED' ? 'sent back' : 'verified'} job ${job(o).code ?? ''}`.trim(), body: job(o).title, data: jobData(o) })],
  ['POST', /^\/tasks\/[^/]+\/start$/, (who, _r, o) => ({ title: `${who} started job ${job(o).code ?? ''}`.trim(), body: [job(o).title, job(o).customerName].filter(Boolean).join(' · '), data: jobData(o) })],
  ['POST', /^\/tasks\/[^/]+\/complete$/, (who, _r, o) => ({ title: `${who} finished job ${job(o).code ?? ''}`.trim(), body: [job(o).title, job(o).customerName].filter(Boolean).join(' · '), data: jobData(o) })],
  ['POST', /^\/approvals\/bulk-approve$/, (who, r) => ({ title: `${who} approved items in bulk`, body: plural(n(r.body?.ids ?? r.body?.items), 'item') })],
  ['POST', /^\/teams$/, (who, r) => ({ title: `${who} created the team ${r.body?.name ?? ''}`.trim() })],
  ['PATCH', /^\/teams\/[^/]+$/, (who, r) => ({ title: `${who} updated a team`, body: r.body?.name })],
  ['DELETE', /^\/teams\/[^/]+$/, (who) => ({ title: `${who} removed a team` })],

  // People
  ['POST', /^\/users$/, (who, _r, o) => ({ title: `${who} added an account`, body: o.user ? `${o.user.name} · ${String(o.user.role ?? '').toLowerCase().replace('_', ' ')} · ${o.user.staffNo}` : undefined })],
  ['PATCH', /^\/users\/[^/]+$/, (who, _r, o) => ({ title: `${who} updated an account`, body: o.user?.name })],
  ['POST', /^\/users\/[^/]+\/reset-password$/, (who) => ({ title: `${who} reset someone's password` })],
  ['POST', /^\/users\/onboard-customer$/, (who, _r, o) => ({ title: `${who} onboarded a customer`, body: o.user?.name ?? o.customer?.name })],

  // Stock
  ['POST', /^\/inventory\/receive$/, (who, r) => ({ title: `${who} received stock into the store`, body: r.body?.serials?.length ? plural(r.body.serials.length, 'device') : r.body?.quantity ? `${r.body.quantity} units` : undefined })],
  ['POST', /^\/inventory\/issue$/, (who, r, o) => ({ title: `${who} issued stock`, body: [o.serials?.issued ? plural(o.serials.issued, 'device') : null, o.bulk ? 'materials' : null].filter(Boolean).join(' and ') || (r.body?.serials?.length ? plural(r.body.serials.length, 'device') : undefined) })],
  ['POST', /^\/inventory\/accept$/, (who, _r, o) => (o.accepted ? { title: `${who} confirmed receiving stock`, body: plural(o.accepted, 'item') } : null)],
  ['POST', /^\/inventory\/return$/, (who, r) => ({ title: `${who} returned stock to the store`, body: r.body?.serials?.length ? plural(r.body.serials.length, 'device') : undefined })],
  ['POST', /^\/inventory\/install$/, (who, r, o) => ({ title: `${who} recorded a device installed`, body: `${o.unit?.serialNumber ?? ''} at ${o.unit?.customerAccount ?? r.body?.customerAccount ?? 'a customer'}` })],
  ['POST', /^\/inventory\/units\/[^/]+\/mark-installed$/, (who, r, o) => ({ title: `${who} marked a device installed`, body: `${o.unit?.serialNumber ?? ''} · ${r.body?.note ?? ''}` })],
  ['POST', /^\/inventory\/stock-count$/, (who, _r, o) => ({ title: `${who} did a stock count`, body: o.count && (o.count.missing?.length || o.count.unexpected?.length) ? 'Some devices did not match.' : 'Everything matched.' })],
  ['POST', /^\/inventory\/recover$/, (who, _r, o) => ({ title: `${who} collected a device from a customer`, body: o.serial })],
  ['POST', /^\/inventory\/adjust$/, (who, r) => ({ title: `${who} adjusted store stock`, body: r.body?.reason ?? r.body?.note })],
  ['POST', /^\/inventory\/items(\/catalog-entry(-bulk)?)?$/, (who, _r, o) => ({ title: `${who} added to the catalogue`, body: o.item?.name ?? (o.count ? plural(o.count, 'item') : undefined) })],
  ['PATCH', /^\/inventory\/items\/[^/]+$/, (who, _r, o) => ({ title: `${who} updated a catalogue item`, body: o.item?.name })],

  // Customers and requests
  ['POST', /^\/customer\/requests$/, (who) => ({ title: `${who} asked for a service visit` })],
  ['POST', /^\/customer\/jobs\/[^/]+\/rate$/, (who, r) => ({ title: `${who} rated a visit`, body: r.body?.rating ? `${'★'.repeat(Number(r.body.rating))}${r.body?.feedback ? ` “${String(r.body.feedback).slice(0, 80)}”` : ''}` : undefined })],
  ['POST', /^\/requests\/[^/]+\/close$/, (who, r) => ({ title: `${who} closed a customer request`, body: r.body?.note })],
];

/**
 * Express middleware for the API router: after an action succeeds, tells the admins and supervisors.
 * It never delays or changes the response.
 */
export function activityFeed(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  // Keep what the action answered, to describe it
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    res.locals.activityBody = body;
    return json(body);
  };
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const path = req.originalUrl.split('?')[0].replace(/^\/api\/v1/, '');
    const rule = RULES.find(([m, re]) => m === req.method && re.test(path));
    if (!rule) return;
    void tell(req, rule, (res.locals.activityBody ?? {}) as Body);
  });
  next();
}

async function tell(req: Request, rule: Rule, out: Body) {
  try {
    const actor = req.user!;
    const say = rule[2](actor.name, req, out);
    if (!say) return;
    const managers = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'SUPERVISOR'] }, active: true, id: { not: actor.id } }, select: { id: true } });
    await notify(
      managers.map((m) => m.id),
      { type: 'ACTIVITY', title: say.title, body: say.body?.trim() || 'Just now', data: { ...(say.data ?? {}), actorId: actor.id } },
    );
  } catch (err) {
    console.error('[activity] failed', err);
  }
}
