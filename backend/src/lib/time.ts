import { env } from '../config/env';

const offsetMs = () => env.TZ_OFFSET_MINUTES * 60_000;

/** The company-local calendar date (as a UTC-midnight Date suitable for @db.Date columns). */
export function workDateOf(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + offsetMs());
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** The instant the shift starts on the given work date. */
export function shiftStartFor(workDate: Date): Date {
  const [h, m] = env.SHIFT_START.split(':').map(Number);
  return new Date(workDate.getTime() + (h * 60 + m) * 60_000 - offsetMs());
}

/** The instant the working day ends on the given work date. */
export function shiftEndFor(workDate: Date): Date {
  const [h, m] = env.SHIFT_END.split(':').map(Number);
  return new Date(workDate.getTime() + (h * 60 + m) * 60_000 - offsetMs());
}

export const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

/** HH:mm in company local time, for human-readable messages. */
export function time(at: Date): string {
  const local = new Date(at.getTime() + offsetMs());
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}
