import 'dotenv/config';
import { z } from 'zod';

const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : Number(v)));

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_PHOTO_MB: z.coerce.number().default(8),
  TZ_OFFSET_MINUTES: z.coerce.number().default(180),
  SHIFT_START: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  LATE_GRACE_MINUTES: z.coerce.number().default(15),
  CAPTURE_TTL_SECONDS: z.coerce.number().default(90),
  MIN_GPS_ACCURACY_M: z.coerce.number().default(100),
  OFFICE_LAT: optionalNumber,
  OFFICE_LNG: optionalNumber,
  OFFICE_RADIUS_M: z.coerce.number().default(300),
  MAX_ROUTERS_IN_CUSTODY: z.coerce.number().default(5),
  CUSTODY_AGE_ALERT_DAYS: z.coerce.number().default(3),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
