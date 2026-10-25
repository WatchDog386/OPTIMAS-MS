import type { z } from 'zod';
import { badRequest } from '../lib/http-error';

/** Parse and validate input with a zod schema, throwing a 400 with field details on failure. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw badRequest('Some fields are invalid', 'VALIDATION_ERROR', fields);
  }
  return result.data;
}
