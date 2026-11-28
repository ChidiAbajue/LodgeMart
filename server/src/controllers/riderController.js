import * as riderService from '../services/riderService.js';
import { manifestQuery } from '../utils/staffSchema.js';
import { createPickupUploadSignature } from '../services/photoService.js';

// GET /api/rider/photo-upload-signature — signed, short-lived Cloudinary upload
// permission. The phone POSTs the photo + these fields to uploadUrl, then sends
// the returned secure_url as photoUrl when confirming the stall pickup.
export function getPhotoUploadSignature(req, res) {
  res.json(createPickupUploadSignature());
}

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

// POST /api/rider/kiosk-drop  { orderId } — after the 20-minute hub wait
export async function leaveAtKiosk(req, res) {
  res.json(await riderService.leaveAtKiosk(req.user, req.body));
}

// GET /api/rider/earnings
export async function getEarnings(req, res) {
  res.json(await riderService.getEarnings(req.user));
}
