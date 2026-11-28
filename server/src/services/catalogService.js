import { prisma } from '../config/prisma.js';
import { CANCELLATION_FEE_KOBO, DELIVERY_FEE, MIN_VENDOR_RATING } from '../config/business.js';
import { batchDateFor, toDateString } from '../utils/batchDate.js';

// Vendors that may receive orders.
export const routableVendor = { isActive: true, ratingScore: { gte: MIN_VENDOR_RATING } };

// Public catalog. Never exposes vendor wholesale prices, stock levels or bank details.
export async function getCatalog(now = new Date()) {
  const [products, zones, slots] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        unit: true,
        category: true,
        emoji: true,
        studentPriceKobo: true,
        kioskComparePriceKobo: true,
        isBulkItem: true,
        inventory: { where: { stockQty: { gt: 0 }, vendor: routableVendor }, select: { vendorId: true }, take: 1 },
      },
    }),
    prisma.campusZone.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, hubs: { select: { hub: { select: { id: true, name: true } } } } },
    }),
    prisma.batchSlot.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return {
    products: products.map(({ inventory, ...p }) => ({ ...p, inStock: inventory.length > 0 })),
    zones: zones.map((z) => ({ id: z.id, name: z.name, hubs: z.hubs.map((h) => h.hub) })),
    batchSlots: slots.map(({ sortOrder, isActive, ...s }) => ({ // eslint-disable-line no-unused-vars
      ...s,
      nextBatchDate: toDateString(batchDateFor(s, now)), // the batch an order placed now would join
    })),
    // Delivery fee rules, so the cart can preview the fee. The server recalculates at checkout.
    fees: { deliveryFee: DELIVERY_FEE, cancellationFeeKobo: CANCELLATION_FEE_KOBO },
  };
}
