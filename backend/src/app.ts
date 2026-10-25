import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { captureRouter } from './modules/capture/capture.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { reportsRouter } from './modules/reports/reports.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'optimas-ms-api', time: new Date() }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', requireAuth, usersRouter);
  api.use('/capture', requireAuth, captureRouter);
  api.use('/attendance', requireAuth, attendanceRouter);
  api.use('/tasks', requireAuth, tasksRouter);
  api.use('/inventory', requireAuth, inventoryRouter);
  api.use('/reports', requireAuth, reportsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
