import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/rateLimitMiddleware.js';

// Admin console. Every route: logged in (app.js) + ADMIN role (checklist #13).
export const adminRoutes = Router();
adminRoutes.use(requireRole('ADMIN'));

const payoutRunLimit = rateLimit({ name: 'payout-run', max: 10, windowSeconds: 10 * 60, key: (req) => req.user?.id });

adminRoutes.get('/payouts', adminController.listPayouts);
adminRoutes.post('/payouts/run', payoutRunLimit, adminController.runPayouts);
