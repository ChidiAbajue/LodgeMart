import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { authenticate } from './middleware/authMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway proxy: real client IP for rate limits

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = server-to-server or curl (e.g. Paystack webhooks): allow.
        if (!origin || env.CLIENT_URL.includes(origin)) return cb(null, true);
        return cb(new Error('CORS_NOT_ALLOWED'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  // Secure by default: every /api route requires a valid token unless it is on
  // the PUBLIC_ROUTES allow-list in middleware/authMiddleware.js.
  app.use('/api', authenticate);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
