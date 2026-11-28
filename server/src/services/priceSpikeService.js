import { prisma } from '../config/prisma.js';
import { MIN_VENDOR_RATING, PRICE_SPIKE_ABSORB_LIMIT_KOBO } from '../config/business.js';
import { AppError, notFound } from '../utils/errors.js';
import { fromDateString } from '../utils/batchDate.js';

// 3-layer price-spike safeguard (Chidi's operating story, Act 3). When a
// vendor's price for a product goes up after students have ordered (before the
// rider picks up), every affected line item in that batch is handled so the
// student never pays more than the price they were shown:
//   1. Rise ≤ ₦150 per unit  → ABSORBED: vendor is paid the new price; LodgeMart
//                               eats the difference (from its bulk-to-retail spread).
//   2. Rise > ₦150 per unit  → REASSIGNED to another verified trader who has the
//                               stock at (or within ₦150 of) the locked price and
//                               hasn't been collected from yet in this batch.
//   3. No such trader         → REFUNDED: that line item's price goes back to the
//                               student's wallet. If nothing is left in the order,
//                               the delivery fee is refunded too and it's closed.
// The vendor's catalogue price is updated for future orders either way.

const AT_MARKET = ['ORDER_PLACED', 'PACKED_AT_MARKET'];

export async function applyPriceChange({ vendorId, productId, batchDate, batchSlotId, newWholesalePriceKobo }) {
  const date = fromDateString(batchDate);
  const [vendor, product, slot] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }),
    prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } }),
    prisma.batchSlot.findUnique({ where: { id: batchSlotId }, select: { id: true } }),
  ]);
  if (!vendor) throw notFound('Vendor not found');
  if (!product) throw notFound('Product not found');
  if (!slot) throw new AppError(400, 'INVALID_BATCH_SLOT', 'Unknown delivery batch');

  return prisma.$transaction(async (tx) => {
    // Future orders use the new price.
    await tx.vendorInventory.updateMany({ where: { vendorId, productId }, data: { wholesalePriceKobo: newWholesalePriceKobo } });

    // Lock each affected order (same pattern as stall pickup / cancel), so a
    // pickup or cancel running right now can't interleave with this.
    const candidates = await tx.order.findMany({
      where: {
        batchDate: date, batchSlotId, status: { in: AT_MARKET },
        items: { some: { vendorId, productId, riderPickedUp: false, refundedAt: null } },
      },
      select: { id: true },
    });
    const lockedIds = [];
    for (const { id } of candidates) {
      const { count } = await tx.order.updateMany({ where: { id, status: { in: AT_MARKET } }, data: { updatedAt: new Date() } });
      if (count === 1) lockedIds.push(id);
    }

    const items = await tx.orderItem.findMany({
      where: { orderId: { in: lockedIds }, vendorId, productId, riderPickedUp: false, refundedAt: null },
      orderBy: { order: { orderNumber: 'asc' } },
      select: { id: true, orderId: true, qty: true, wholesaleCostKobo: true, studentPriceKobo: true, order: { select: { studentId: true } } },
    });

    // Traders already collected from in this batch can't take extra items.
    const collected = new Set(
      (await tx.stallPickup.findMany({ where: { batchDate: date, batchSlotId }, select: { vendorId: true } })).map((p) => p.vendorId),
    );

    const outcome = { absorbed: 0, reassigned: 0, refunded: 0, unchanged: 0, absorbedKobo: 0, refundedKobo: 0, items: [] };
    for (const item of items) {
      const locked = item.wholesaleCostKobo;
      const rise = newWholesalePriceKobo - locked;

      if (rise <= 0) {
        outcome.unchanged++;
        outcome.items.push({ itemId: item.id, result: 'UNCHANGED' });
        continue;
      }

      if (rise <= PRICE_SPIKE_ABSORB_LIMIT_KOBO) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { wholesaleCostKobo: newWholesalePriceKobo, priceAdjustmentKobo: { increment: rise * item.qty } },
        });
        outcome.absorbed++;
        outcome.absorbedKobo += rise * item.qty;
        outcome.items.push({ itemId: item.id, result: 'ABSORBED', extraKobo: rise * item.qty });
        continue;
      }

      // Layer 2: another verified trader at (or within ₦150 of) the locked price.
      const alternatives = await tx.vendorInventory.findMany({
        where: {
          productId,
          vendorId: { not: vendorId, notIn: [...collected] },
          stockQty: { gte: item.qty },
          wholesalePriceKobo: { lte: locked + PRICE_SPIKE_ABSORB_LIMIT_KOBO },
          vendor: { isActive: true, ratingScore: { gte: MIN_VENDOR_RATING } },
        },
        select: { vendorId: true, wholesalePriceKobo: true, vendor: { select: { priorityTier: true, ratingScore: true } } },
      });
      alternatives.sort((a, b) =>
        Number(b.vendor.priorityTier) - Number(a.vendor.priorityTier) ||
        Number(b.vendor.ratingScore) - Number(a.vendor.ratingScore) ||
        a.wholesalePriceKobo - b.wholesalePriceKobo ||
        a.vendorId.localeCompare(b.vendorId));

      let moved = false;
      for (const alt of alternatives) {
        const took = await tx.vendorInventory.updateMany({
          where: { vendorId: alt.vendorId, productId, stockQty: { gte: item.qty } },
          data: { stockQty: { decrement: item.qty } },
        });
        if (took.count === 0) continue;
        await tx.vendorInventory.updateMany({ where: { vendorId, productId }, data: { stockQty: { increment: item.qty } } });
        const extra = Math.max(0, alt.wholesalePriceKobo - locked) * item.qty;
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            vendorId: alt.vendorId, wholesaleCostKobo: alt.wholesalePriceKobo, vendorPacked: false,
            reassignedFromVendorId: vendorId, priceAdjustmentKobo: { increment: extra },
          },
        });
        outcome.reassigned++;
        outcome.absorbedKobo += extra;
        outcome.items.push({ itemId: item.id, result: 'REASSIGNED', toVendorId: alt.vendorId });
        moved = true;
        break;
      }
      if (moved) continue;

      // Layer 3: refund this line item to the student's wallet.
      const refundKobo = item.studentPriceKobo * item.qty;
      await tx.orderItem.update({ where: { id: item.id }, data: { refundedAt: new Date(), refundKobo } });
      await tx.vendorInventory.updateMany({ where: { vendorId, productId }, data: { stockQty: { increment: item.qty } } });
      await tx.user.update({ where: { id: item.order.studentId }, data: { walletBalanceKobo: { increment: refundKobo } } });
      outcome.refunded++;
      outcome.refundedKobo += refundKobo;
      outcome.items.push({ itemId: item.id, result: 'REFUNDED', refundKobo });
    }

    // Re-derive each touched order: bag merge, packed status, or fully refunded.
    for (const orderId of new Set(items.map((i) => i.orderId))) {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          studentId: true, deliveryFeeKobo: true,
          items: { select: { vendorId: true, vendorPacked: true, refundedAt: true, refundKobo: true } },
        },
      });
      const live = order.items.filter((i) => !i.refundedAt);
      if (live.length === 0) {
        const itemRefunds = order.items.reduce((s, i) => s + (i.refundKobo ?? 0), 0);
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED', cancelledAt: new Date(), refundKobo: itemRefunds + order.deliveryFeeKobo },
        });
        await tx.user.update({ where: { id: order.studentId }, data: { walletBalanceKobo: { increment: order.deliveryFeeKobo } } });
        outcome.refundedKobo += order.deliveryFeeKobo;
        continue;
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          requiresBagMerge: new Set(live.map((i) => i.vendorId)).size >= 2,
          status: live.every((i) => i.vendorPacked) ? 'PACKED_AT_MARKET' : 'ORDER_PLACED',
        },
      });
    }

    return { vendorId, productId, productName: product.name, batchDate, batchSlotId, newWholesalePriceKobo, ...outcome };
  });
}
