import { Router } from 'express';
import * as vendorController from '../controllers/vendorController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validate, validateParams } from '../middleware/validateMiddleware.js';
import { staffWriteLimit } from '../middleware/rateLimitMiddleware.js';
import { inventorySchema, itemIdParams, productIdParams, setPackedSchema } from '../utils/staffSchema.js';

// Vendor portal. Every route: logged in (app.js) + VENDOR role. Ownership:
// vendors only ever touch rows for their own stall (req.user.vendorId).
export const vendorRoutes = Router();
vendorRoutes.use(requireRole('VENDOR'));

vendorRoutes.get('/dashboard', vendorController.getDashboard);
vendorRoutes.get('/items', vendorController.listItems);
vendorRoutes.patch('/items/:itemId/packed', validateParams(itemIdParams), staffWriteLimit, validate(setPackedSchema), vendorController.setPacked);
vendorRoutes.put('/inventory/:productId', validateParams(productIdParams), staffWriteLimit, validate(inventorySchema), vendorController.setInventory);
