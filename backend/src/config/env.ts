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
  PUSH_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  TRUST_PROXY: z.coerce.number().default(0),
  LOGIN_RATE_LIMIT: z.coerce.number().default(10),
  /** Requests one address may make per minute across the whole API (the app polls, so keep this generous). */
  API_RATE_LIMIT: z.coerce.number().default(600),
  SUPPORT_PHONE: z.string().default('+254700000000'),
  SUPPORT_WHATSAPP: z.string().default('254700000000'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

// A live server must not run with a guessable signing key: anyone who knows it can sign in as any user.
if (env.NODE_ENV === 'production') {
  const placeholder = /change[-_ ]?me|replace[-_ ]?me|your[-_ ]?secret|^(secret|password|test|default|example)/i.test(env.JWT_SECRET);
  if (placeholder) {
    console.error('❌ JWT_SECRET is still a placeholder: use 32+ random characters (e.g. `openssl rand -hex 32`).');
    process.exit(1);
  }
  if (env.JWT_SECRET.length < 32) console.warn('⚠️  JWT_SECRET is shorter than 32 characters: generate a longer one (`openssl rand -hex 32`).');
  if (env.CORS_ORIGIN === '*') console.warn('⚠️  CORS_ORIGIN is "*": set it to your web address (e.g. https://ms.example.co.ke) in production.');
}
