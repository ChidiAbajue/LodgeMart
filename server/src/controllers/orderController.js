import * as orderService from '../services/orderService.js';
import { rateOrder } from '../services/ratingService.js';

// POST /api/orders — student places an order.
//   WALLET   → { order }                       (paid, status ORDER_PLACED)
//   PAYSTACK → { order, payment: { authorizationUrl, reference } }  (status PENDING_PAYMENT;
//              send the student to authorizationUrl)
export async function createOrder(req, res) {
  res.status(201).json(await orderService.createOrder(req.user, req.body));
}

// POST /api/orders/:id/verify-payment — owner; asks Paystack now (if the webhook is slow).
export async function verifyPayment(req, res) {
  res.json({ order: await orderService.verifyMyPayment(req.user, req.params.id) });
}

// GET /api/orders — the logged-in student's own orders, newest first.
export async function listMyOrders(req, res) {
  res.json({ orders: await orderService.listMyOrders(req.user) });
}

// GET /api/orders/:id — owner or admin.
export async function getOrder(req, res) {
  res.json({ order: await orderService.getOrder(req.user, req.params.id) });
}

// POST /api/orders/:id/cancel — owner, before rider pickup.
export async function cancelOrder(req, res) {
  res.json(await orderService.cancelOrder(req.user, req.params.id));
}

// POST /api/orders/:id/delegate — owner hands pickup to a roommate (new PIN).
export async function delegatePickup(req, res) {
  res.json(await orderService.delegatePickup(req.user, req.params.id, req.body));
}

// POST /api/orders/:id/rating — owner, once, after collection.
// { stars: 1-5, flaggedItems: [{ itemId, issueTag }] }  (flags required for 1–3 stars)
export async function rateOrderHandler(req, res) {
  res.json(await rateOrder(req.user, req.params.id, req.body));
}
