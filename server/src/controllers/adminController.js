import { z } from 'zod';
import * as payoutService from '../services/payoutService.js';
import * as adminService from '../services/adminService.js';
import { adminOrdersQuery, summaryQuery, usersQuery } from '../utils/adminSchema.js';

const payoutQuery = z.strictObject({
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED']).optional(),
});

// GET /api/admin/summary?from=YYYY-MM-DD&to=YYYY-MM-DD — ops dashboard numbers.
export async function getSummary(req, res) {
  res.json(await adminService.getSummary(summaryQuery.parse(req.query)));
}

// GET /api/admin/orders?status=&batchDate=&page=
export async function listOrders(req, res) {
  res.json(await adminService.listOrders(adminOrdersQuery.parse(req.query)));
}

// GET /api/admin/users?role=
export async function listUsers(req, res) {
  res.json({ users: await adminService.listUsers(usersQuery.parse(req.query)) });
}

// POST /api/admin/users — create a VENDOR (with stall + bank), RIDER or ADMIN account.
export async function createStaffUser(req, res) {
  res.status(201).json({ user: await adminService.createStaffUser(req.body) });
}

// PATCH /api/admin/users/:id  { isActive }
export async function setUserActive(req, res) {
  res.json({ user: await adminService.setUserActive(req.user, req.params.id, req.body.isActive) });
}

// GET /api/admin/vendors
export async function listVendors(req, res) {
  res.json({ vendors: await adminService.listVendors() });
}

// PATCH /api/admin/vendors/:id  { name?, stallNumber?, market?, bankName?, bankCode?, bankAccountNumber?, isActive? }
export async function updateVendor(req, res) {
  res.json({ vendor: await adminService.updateVendor(req.params.id, req.body) });
}

// GET /api/admin/payouts?status=
export async function listPayouts(req, res) {
  res.json({ payouts: await payoutService.listPayouts(payoutQuery.parse(req.query)) });
}

// POST /api/admin/payouts/run — send all pending/failed vendor payouts via Paystack.
export async function runPayouts(req, res) {
  res.json(await payoutService.runPayouts());
}
