import * as riderService from '../services/riderService.js';
import { manifestQuery } from '../utils/staffSchema.js';

// GET /api/rider/manifest?batchDate=YYYY-MM-DD&batchSlotId=midday
export async function getManifest(req, res) {
  res.json(await riderService.getManifest(manifestQuery.parse(req.query)));
}

// POST /api/rider/stall-pickups  { vendorId, batchDate, batchSlotId, photoUrl }
export async function confirmStallPickup(req, res) {
  res.status(201).json(await riderService.confirmStallPickup(req.user, req.body));
}

// POST /api/rider/hub-arrivals  { hubId, batchDate, batchSlotId }
export async function markHubArrived(req, res) {
  res.json(await riderService.markHubArrived(req.user, req.body));
}

// POST /api/rider/handover  { orderId, pin }
export async function handover(req, res) {
  res.json(await riderService.handover(req.user, req.body));
}

// GET /api/rider/earnings
export async function getEarnings(req, res) {
  res.json(await riderService.getEarnings(req.user));
}
