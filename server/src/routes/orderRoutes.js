import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validate, validateParams } from '../middleware/validateMiddleware.js';
import { orderWriteLimit } from '../middleware/rateLimitMiddleware.js';
import { createOrderSchema, delegateSchema, orderIdParams } from '../utils/orderSchema.js';

// All routes require a token (global authenticate in app.js).
export const orderRoutes = Router();

const student = requireRole('STUDENT');
const byId = validateParams(orderIdParams);

orderRoutes.post('/', student, orderWriteLimit, validate(createOrderSchema), orderController.createOrder);
orderRoutes.get('/', student, orderController.listMyOrders);
orderRoutes.get('/:id', requireRole('STUDENT', 'ADMIN'), byId, orderController.getOrder);
orderRoutes.post('/:id/cancel', student, byId, orderWriteLimit, orderController.cancelOrder);
orderRoutes.post('/:id/verify-payment', student, byId, orderWriteLimit, orderController.verifyPayment);
orderRoutes.post('/:id/delegate', student, byId, orderWriteLimit, validate(delegateSchema), orderController.delegatePickup);
