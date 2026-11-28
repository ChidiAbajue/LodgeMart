import { Router } from 'express';
import * as walletController from '../controllers/walletController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { orderWriteLimit } from '../middleware/rateLimitMiddleware.js';
import { virtualAccountSchema } from '../utils/orderSchema.js';

// Student wallet. Every route: logged in (app.js) + STUDENT role.
export const walletRoutes = Router();
walletRoutes.use(requireRole('STUDENT'));

walletRoutes.get('/', walletController.getWallet);
walletRoutes.post('/virtual-account', orderWriteLimit, validate(virtualAccountSchema), walletController.createVirtualAccount);
