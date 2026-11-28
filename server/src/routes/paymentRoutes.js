import { Router } from 'express';
import { paystackWebhook } from '../controllers/paymentController.js';
import { rateLimit } from '../middleware/rateLimitMiddleware.js';

// The webhook is on the PUBLIC_ROUTES allow-list (Paystack has no login token);
// it authenticates by HMAC signature instead.
export const paymentRoutes = Router();

const webhookLimit = rateLimit({ name: 'paystack-webhook', max: 600, windowSeconds: 60, key: (req) => req.ip });

paymentRoutes.post('/paystack/webhook', webhookLimit, paystackWebhook);
