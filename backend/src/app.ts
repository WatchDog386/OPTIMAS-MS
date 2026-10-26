import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { ROLES, requireAuth, requireRole } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { captureRouter } from './modules/capture/capture.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { insightsRouter } from './modules/insights/insights.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { exportsRouter } from './modules/exports/exports.routes';
import { customerRouter } from './modules/customer/customer.routes';
import { requestsRouter } from './modules/requests/requests.routes';
import { searchRouter } from './modules/search/search.routes';
import { auditRouter } from './modules/audit/audit.routes';

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
  // A ceiling on how fast one address can hammer the API (the login route has its own, stricter limit below)
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.API_RATE_LIMIT,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { message: 'Too many requests. Slow down and try again in a minute.', code: 'RATE_LIMITED' } },
    }),
  );
  // Customer logins can only reach /customer and /notifications.
  const staff = requireRole(ROLES.STAFF);
  api.use(
    '/auth/login',
    rateLimit({
      windowMs: 15 * 60_000,
      limit: env.LOGIN_RATE_LIMIT,
      // Only wrong passwords count: a whole office signing in from one Wi-Fi in the morning must not lock itself out
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { message: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' } },
    }),
  );
  api.use('/auth', authRouter);
  api.use('/users', requireAuth, staff, usersRouter);
  api.use('/capture', requireAuth, staff, captureRouter);
  api.use('/attendance', requireAuth, staff, attendanceRouter);
  api.use('/tasks', requireAuth, staff, tasksRouter);
  api.use('/inventory', requireAuth, staff, inventoryRouter);
  api.use('/reports', requireAuth, staff, reportsRouter);
  api.use('/insights', requireAuth, requireRole(ROLES.MANAGERS), insightsRouter);
  api.use('/notifications', requireAuth, notificationsRouter);
  api.use('/exports', requireAuth, staff, exportsRouter);
  api.use('/requests', requireAuth, requireRole(ROLES.MANAGERS), requestsRouter);
  api.use('/search', requireAuth, staff, searchRouter);
  api.use('/audit', requireAuth, requireRole(ROLES.ADMIN), auditRouter);
  api.use('/customer', requireAuth, requireRole(ROLES.CUSTOMER), customerRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
