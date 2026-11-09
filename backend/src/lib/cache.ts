import cluster from 'node:cluster';
import type { NextFunction, Request, Response } from 'express';

/*
 * A small in-memory answer cache, no Redis needed. Read requests that many people poll (approval counts,
 * open requests, reconciliation, charts, unread counts) are answered from memory for a few seconds.
 * It can never show stale data after a change: every successful write anywhere in the app moves the
 * "data version" on, which empties the cache at once — in this process and, when the API runs one process
 * per CPU core, in all of them (the primary process relays the signal).
 */

let version = 0;
const store = new Map<string, { at: number; status: number; body: unknown }>();
const MAX_ENTRIES = 5_000;

/** Something changed: every cached answer is out of date. */
export function bumpDataVersion(fromPeer = false) {
  version += 1;
  store.clear();
  // Tell the other processes (via the primary), unless this signal came from them
  if (!fromPeer && cluster.isWorker && process.send) process.send({ type: 'data-version' });
}

if (cluster.isWorker) {
  process.on('message', (m: { type?: string }) => {
    if (m?.type === 'data-version') bumpDataVersion(true);
  });
}

/** Constant background writes that change none of the cached figures (live location, photo uploads, chat, sign-in). */
const QUIET = /^\/api\/v1\/(location|capture\/(challenge|upload)|chat\/|notifications\/(push-token|web-push)|auth\/(login|passkeys|verify-password)|batch)/;

/** Middleware for the whole API: a successful write moves the data version on. */
export function invalidateOnWrite(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && !QUIET.test(req.originalUrl)) {
    res.on('finish', () => {
      if (res.statusCode < 400) bumpDataVersion();
    });
  }
  next();
}

/**
 * Caches a read route's answer for `ttlMs`. `per`: 'user' keeps one answer per person (their own counts),
 * 'role' one per role (the same office-wide figures for everyone in that role).
 */
export function cacheFor(ttlMs: number, per: 'user' | 'role' = 'role') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !req.user) return next();
    const key = `${version}|${per === 'user' ? req.user.id : req.user.role}|${req.originalUrl}`;
    const hit = store.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      res.setHeader('X-Cache', 'hit');
      return void res.status(hit.status).json(hit.body);
    }
    const startedAt = version;
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only keep answers computed entirely after the last change
      if (res.statusCode < 400 && startedAt === version) {
        if (store.size >= MAX_ENTRIES) store.clear();
        store.set(key, { at: Date.now(), status: res.statusCode, body });
      }
      return json(body);
    };
    next();
  };
}
