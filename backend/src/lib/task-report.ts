// A task is completed only with a real report of the work — never on the photos alone.
import { z } from 'zod';

/** The task report filed after the completion photo: what was found, what was done, the result. */
export const taskReportSchema = z.object({
  found: z.string().trim().max(1000),
  done: z.string().trim().max(1500),
  result: z.string().trim().max(1000),
});
export type TaskReport = z.infer<typeof taskReportSchema>;

const words = (s: string) => s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
/** Filler that says nothing ("done", "ok", "completed", "n/a" …). */
const FILLER = /^(done|ok|okay|complete|completed|finished|fixed|sorted|resolved|success|successful|good|fine|na|n\/a|nil|none|no|yes|job|task|work|the|is|was|it|and|all|well|working|works)$/i;

/** Why a part of the report is not good enough, or undefined when it is. */
export function reportProblem(part: string, what: string, minWords: number): string | undefined {
  const w = words(part);
  if (w.length < minWords || part.replace(/\s+/g, ' ').trim().length < minWords * 4) return `${what}: write at least ${minWords} words`;
  if (w.every((x) => FILLER.test(x.replace(/[^a-z/]/gi, '')))) return `${what}: describe what actually happened — "${part.trim().slice(0, 30)}" is not a report`;
  return undefined;
}

/** The three parts checked: what was found (3+ words), the work done (5+), the result (3+). */
export const taskReportProblem = (r: TaskReport) =>
  reportProblem(r.found, 'What you found', 3) ?? reportProblem(r.done, 'Work done', 5) ?? reportProblem(r.result, 'Result', 3);

/** The report as one text, kept in the task's completion notes. */
export const taskReportText = (r: TaskReport) => `Found: ${r.found}\nWork done: ${r.done}\nResult: ${r.result}`;

/** A report written as one text (older app versions, the report form): at least 8 real words. */
export const NOTES_MIN_WORDS = 8;
