import * as orderService from '../services/orderService.js';

// POST /api/orders — student places an order (wallet payment).
export async function createOrder(req, res) {
  res.status(201).json({ order: await orderService.createOrder(req.user, req.body) });
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
