import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { rateLimit } from '../middleware/rateLimitMiddleware.js';
import { validate, validateParams } from '../middleware/validateMiddleware.js';
import { createStaffSchema, setActiveSchema, updateVendorSchema, userIdParams, vendorIdParams } from '../utils/adminSchema.js';
import { priceChangeSchema } from '../utils/staffSchema.js';

// Admin console. Every route: logged in (app.js) + ADMIN role (checklist #13).
export const adminRoutes = Router();
adminRoutes.use(requireRole('ADMIN'));

const adminWriteLimit = rateLimit({ name: 'admin-write', max: 60, windowSeconds: 10 * 60, key: (req) => req.user?.id });
const payoutRunLimit = rateLimit({ name: 'payout-run', max: 10, windowSeconds: 10 * 60, key: (req) => req.user?.id });

adminRoutes.get('/summary', adminController.getSummary);
adminRoutes.get('/orders', adminController.listOrders);

adminRoutes.get('/users', adminController.listUsers);
adminRoutes.post('/users', adminWriteLimit, validate(createStaffSchema), adminController.createStaffUser);
adminRoutes.patch('/users/:id', validateParams(userIdParams), adminWriteLimit, validate(setActiveSchema), adminController.setUserActive);

adminRoutes.get('/vendors', adminController.listVendors);
adminRoutes.get('/vendors/:id', validateParams(vendorIdParams), adminController.getVendor);
adminRoutes.post('/vendors/:id/price-change', validateParams(vendorIdParams), adminWriteLimit, validate(priceChangeSchema), adminController.reportPriceChange);
adminRoutes.patch('/vendors/:id', validateParams(vendorIdParams), adminWriteLimit, validate(updateVendorSchema), adminController.updateVendor);

adminRoutes.get('/payouts', adminController.listPayouts);
adminRoutes.post('/payouts/run', payoutRunLimit, adminController.runPayouts);
