import * as vendorService from '../services/vendorService.js';
import { vendorItemsQuery } from '../utils/staffSchema.js';
import { vendorFeedback } from '../services/ratingService.js';
import { applyPriceChange } from '../services/priceSpikeService.js';
import { vendorIdOf } from '../services/vendorService.js';

// POST /api/vendor/price-change — price went up for a batch already ordered.
export async function reportPriceChange(req, res) {
  res.json(await applyPriceChange({ vendorId: vendorIdOf(req.user), ...req.body }));
}

// GET /api/vendor/feedback — ratings + flagged items for my stall (no student identity).
export async function getFeedback(req, res) {
  res.json({ feedback: await vendorFeedback(req.user) });
}

// GET /api/vendor/dashboard — stall profile, inventory, payouts.
export async function getDashboard(req, res) {
  res.json(await vendorService.getDashboard(req.user));
}

// GET /api/vendor/items?batchDate=&batchSlotId= — items to pack.
export async function listItems(req, res) {
  const query = vendorItemsQuery.parse(req.query);
  res.json({ items: await vendorService.listItems(req.user, query) });
}

// PATCH /api/vendor/items/:itemId/packed  { packed: true|false }
export async function setPacked(req, res) {
  res.json(await vendorService.setPacked(req.user, req.params.itemId, req.body.packed));
}

// PUT /api/vendor/inventory/:productId  { wholesalePriceKobo, stockQty }
export async function setInventory(req, res) {
  res.json({ inventory: await vendorService.setInventory(req.user, req.params.productId, req.body) });
}
