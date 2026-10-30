import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { verifyToken } from './lib/jwt';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { ROLES, requireAuth, requireRole } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { captureRouter } from './modules/capture/capture.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { teamsRouter } from './modules/teams/teams.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { insightsRouter } from './modules/insights/insights.routes';
import { approvalsRouter } from './modules/approvals/approvals.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { exportsRouter } from './modules/exports/exports.routes';
import { customerRouter } from './modules/customer/customer.routes';
import { requestsRouter } from './modules/requests/requests.routes';
import { searchRouter } from './modules/search/search.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { locationRouter } from './modules/location/location.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { publicRouter } from './modules/public/public.routes';
import { passkeyLoginRouter, passkeyRouter } from './modules/auth/passkey.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind Caddy/Nginx: trust the proxy so rate limiting and logs see the real client IP.
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Reports healthy only while the database answers, so the proxy and monitors notice an outage
  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', service: 'optimas-ms-api', time: new Date() });
    } catch {
      res.status(503).json({ status: 'degraded', service: 'optimas-ms-api', database: 'unreachable', time: new Date() });
    }
  });

  const api = express.Router();
  // A ceiling on how fast one person (signed in) or one address (not signed in) can hammer the API. Signed-in
  // people count on their own, so a whole office behind one Wi-Fi address does not share one allowance.
  // The login route has its own, stricter limit below.
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.API_RATE_LIMIT,
      keyGenerator: (req) => {
        const header = req.headers.authorization;
        if (header?.startsWith('Bearer ')) {
          try {
            return `user:${verifyToken(header.slice(7)).sub}`;
          } catch {
            /* not a valid token: counted by address */
          }
        }
        return `ip:${ipKeyGenerator(req.ip ?? '')}`;
      },
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { message: 'Too many requests. Slow down and try again in a minute.', code: 'RATE_LIMITED' } },
    }),
  );
  // Customer logins can only reach /customer, /notifications, /location and /chat.
  const staff = requireRole(ROLES.STAFF);
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: env.LOGIN_RATE_LIMIT,
    // Only wrong passwords count: a whole office signing in from one Wi-Fi in the morning must not lock itself out
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { message: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' } },
  });
  api.use('/auth/login', loginLimit);
  // Fingerprint sign-in (no session yet): same limit as the password, then its own router before the signed-in one
  api.use('/auth/passkeys/login', loginLimit);
  api.use('/auth/passkeys/login-options', loginLimit);

  api.use('/auth/passkeys', passkeyLoginRouter);
  api.use('/auth/passkeys', requireAuth, passkeyRouter);
  api.use('/auth', authRouter);
  api.use('/public', publicRouter);
  api.use('/users', requireAuth, staff, usersRouter);
  api.use('/capture', requireAuth, staff, captureRouter);
  api.use('/attendance', requireAuth, staff, attendanceRouter);
  api.use('/tasks', requireAuth, staff, tasksRouter);
  api.use('/teams', requireAuth, staff, teamsRouter);
  api.use('/inventory', requireAuth, staff, inventoryRouter);
  api.use('/reports', requireAuth, staff, reportsRouter);
  api.use('/insights', requireAuth, requireRole(ROLES.MANAGERS), insightsRouter);
  api.use('/approvals', requireAuth, requireRole(ROLES.MANAGERS), approvalsRouter);
  api.use('/notifications', requireAuth, notificationsRouter);
  api.use('/exports', requireAuth, staff, exportsRouter);
  api.use('/requests', requireAuth, requireRole(ROLES.CARE), requestsRouter);
  api.use('/search', requireAuth, staff, searchRouter);
  api.use('/audit', requireAuth, requireRole(ROLES.ADMIN), auditRouter);
  api.use('/customer', requireAuth, requireRole(ROLES.CUSTOMER), customerRouter);
  // Everyone signed in (staff and customers)
  api.use('/location', requireAuth, locationRouter);
  api.use('/chat', requireAuth, chatRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
