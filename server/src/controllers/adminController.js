import { z } from 'zod';
import * as payoutService from '../services/payoutService.js';

const payoutQuery = z.strictObject({
  status: z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED']).optional(),
});

// GET /api/admin/payouts?status=
export async function listPayouts(req, res) {
  res.json({ payouts: await payoutService.listPayouts(payoutQuery.parse(req.query)) });
}

// POST /api/admin/payouts/run — send all pending/failed vendor payouts via Paystack.
export async function runPayouts(req, res) {
  res.json(await payoutService.runPayouts());
}
