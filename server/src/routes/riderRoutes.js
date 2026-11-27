import { Router } from 'express';
import * as riderController from '../controllers/riderController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { handoverLimit, staffWriteLimit } from '../middleware/rateLimitMiddleware.js';
import { handoverSchema, hubArrivalSchema, stallPickupSchema } from '../utils/staffSchema.js';

// Rider dispatch. Every route: logged in (app.js) + RIDER role.
export const riderRoutes = Router();
riderRoutes.use(requireRole('RIDER'));

riderRoutes.get('/manifest', riderController.getManifest);
riderRoutes.post('/stall-pickups', staffWriteLimit, validate(stallPickupSchema), riderController.confirmStallPickup);
riderRoutes.post('/hub-arrivals', staffWriteLimit, validate(hubArrivalSchema), riderController.markHubArrived);
riderRoutes.post('/handover', handoverLimit, validate(handoverSchema), riderController.handover);
riderRoutes.get('/earnings', riderController.getEarnings);
