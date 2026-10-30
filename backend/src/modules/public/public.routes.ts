import { Router } from 'express';
import { env } from '../../config/env';
import { RETENTION } from '../../lib/retention';

/**
 * Public (no sign-in) facts for the help, privacy and terms pages: who runs the app and how to reach
 * them. Nothing personal is ever served here.
 */
export const publicRouter = Router();

publicRouter.get('/info', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    company: env.COMPANY_NAME,
    address: env.COMPANY_ADDRESS || null,
    support: { phone: env.SUPPORT_PHONE || null, whatsapp: env.SUPPORT_WHATSAPP || null, email: env.SUPPORT_EMAIL || null },
    privacyEmail: env.PRIVACY_EMAIL || env.SUPPORT_EMAIL || null,
    retention: RETENTION,
  });
});
