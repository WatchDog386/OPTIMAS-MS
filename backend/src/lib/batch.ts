import type { Request, Response } from 'express';
import { z } from 'zod';
import { parse } from '../middleware/validate';

/*
 * One request, many answers: the app sends the reads a page needs together (POST /api/v1/batch with up to
 * 12 paths) instead of one request each. On a phone network every request costs a round trip of a few
 * hundred milliseconds, so a dashboard that needed eight now needs one. Each path is answered exactly as
 * if it had been asked on its own (same sign-in, same rules), here on the server, in parallel.
 */

const schema = z.object({
  paths: z
    .array(
      z
        .string()
        .max(500)
        .regex(/^\/(?!batch)[A-Za-z0-9/_\-?=&.%:,~+]*$/, 'Not a path the app can batch'),
    )
    .min(1)
    .max(12),
});

export async function batch(req: Request, res: Response) {
  const { paths } = parse(schema, req.body);
  // The same server, asked directly over loopback with the person's own sign-in
  const base = `http://127.0.0.1:${req.socket.localPort}/api/v1`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        const r = await fetch(base + path, { headers });
        const text = await r.text();
        return { status: r.status, body: text ? JSON.parse(text) : null };
      } catch {
        return { status: 502, body: { error: { message: 'Could not load this part', code: 'BATCH_PART_FAILED' } } };
      }
    }),
  );
  res.json({ results });
}
