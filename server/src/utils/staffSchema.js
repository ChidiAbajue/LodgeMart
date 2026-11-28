import { z } from 'zod';

const id = z.string().trim().min(1).max(64);
const kobo = z.number().int().min(0);
export const batchDate = z.iso.date('Use YYYY-MM-DD');

// ---- Vendor ---------------------------------------------------------------
export const itemIdParams = z.strictObject({ itemId: z.uuid('Invalid item id') });
export const productIdParams = z.strictObject({ productId: id });

export const setPackedSchema = z.strictObject({ packed: z.boolean() });

export const inventorySchema = z.strictObject({
  wholesalePriceKobo: kobo.max(10_000_000, 'Price is too high'), // ≤ ₦100,000 per unit
  stockQty: z.number().int().min(0).max(10_000),
});

export const vendorItemsQuery = z.strictObject({
  batchDate: batchDate.optional(),
  batchSlotId: id.optional(),
});

// ---- Rider ----------------------------------------------------------------
export const manifestQuery = z.strictObject({
  batchDate,
  batchSlotId: id,
});

export const stallPickupSchema = z.strictObject({
  vendorId: id,
  batchDate,
  batchSlotId: id,
  // Phase 5 replaces this with an uploaded photo; until then an https URL.
  photoUrl: z.url({ protocol: /^https$/, error: 'photoUrl must be an https URL' }).max(500),
});

export const hubArrivalSchema = z.strictObject({
  hubId: id,
  batchDate,
  batchSlotId: id,
});

export const kioskDropSchema = z.strictObject({ orderId: z.uuid('Invalid order id') });

export const handoverSchema = z.strictObject({
  orderId: z.uuid('Invalid order id'),
  pin: z.string().trim().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

// Vendor reports a price rise for a product in a batch that students have
// already ordered (price-spike safeguard).
export const priceChangeSchema = z.strictObject({
  productId: id,
  batchDate,
  batchSlotId: id,
  newWholesalePriceKobo: kobo.max(10_000_000, 'Price is too high'),
});
