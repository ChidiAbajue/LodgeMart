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
import { catalogRoutes } from './routes/catalogRoutes.js';
import { orderRoutes } from './routes/orderRoutes.js';
import { vendorRoutes } from './routes/vendorRoutes.js';
import { riderRoutes } from './routes/riderRoutes.js';
import { paymentRoutes } from './routes/paymentRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { walletRoutes } from './routes/walletRoutes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway proxy: real client IP for rate limits

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = server-to-server or curl (e.g. Monnify webhooks): allow.
        if (!origin || env.CLIENT_URL.includes(origin)) return cb(null, true);
        return cb(new Error('CORS_NOT_ALLOWED'));
      },
      credentials: true,
    }),
  );
  // Keep the exact raw bytes too: Monnify webhook signatures are computed over them.
  app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use(pinoHttp({ logger }));

  // Secure by default: every /api route requires a valid token unless it is on
  // the PUBLIC_ROUTES allow-list in middleware/authMiddleware.js.
  app.use('/api', authenticate);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/api/rider', riderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/wallet', walletRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
