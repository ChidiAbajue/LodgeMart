import { prisma } from '../config/prisma.js';
import { AppError, forbidden, notFound } from '../utils/errors.js';
import { toDateString } from '../utils/batchDate.js';

// Line-item rating, ported from submitOrderRating() in the prototype:
//   4–5 stars → every item and every vendor in the order gets that score.
//   1–3 stars → only FLAGGED items (and their vendors) get the low score;
//               unflagged items get 5, so a good stall isn't punished for
//               another stall's bad item.
// Fix vs prototype: 1–3 stars must flag at least one item (the prototype
// silently gave every vendor 5★ for an unflagged low rating).
// Each vendor gets ONE rating per order (the lowest that applies to them).
export function planRating(items, stars, flags) {
  const flagByItem = new Map(flags.map((f) => [f.itemId, f.issueTag]));
  const itemUpdates = [];
  const vendorScores = new Map();
  for (const item of items) {
    const issueTag = stars <= 3 ? flagByItem.get(item.id) ?? null : null;
    const itemRating = stars >= 4 || issueTag ? stars : 5;
    itemUpdates.push({ id: item.id, itemRating, issueTag });
    const prev = vendorScores.get(item.vendorId);
    vendorScores.set(item.vendorId, prev === undefined ? itemRating : Math.min(prev, itemRating));
  }
  return { itemUpdates, vendorScores };
}

export async function rateOrder(student, orderId, { stars, flaggedItems }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, studentId: student.id },
      select: { id: true, status: true, items: { select: { id: true, vendorId: true } } },
    });
    if (!order) throw notFound('Order not found');
    if (order.status !== 'COLLECTED') {
      throw new AppError(409, 'NOT_COLLECTED', 'You can rate an order after you have collected it');
    }

    const itemIds = new Set(order.items.map((i) => i.id));
    const stray = flaggedItems.find((f) => !itemIds.has(f.itemId));
    if (stray) throw new AppError(400, 'INVALID_ITEM', 'A flagged item is not part of this order', { itemId: stray.itemId });
    if (stars <= 3 && flaggedItems.length === 0) {
      throw new AppError(400, 'FLAG_REQUIRED', 'For 1–3 stars, select the item(s) that had a problem');
    }

    // Rated exactly once: this conditional update is the gate (double-submit safe).
    const gate = await tx.order.updateMany({ where: { id: orderId, ratedAt: null }, data: { ratedAt: new Date() } });
    if (gate.count === 0) throw new AppError(409, 'ALREADY_RATED', 'You have already rated this order');

    const { itemUpdates, vendorScores } = planRating(order.items, stars, flaggedItems);
    for (const u of itemUpdates) {
      await tx.orderItem.update({ where: { id: u.id }, data: { itemRating: u.itemRating, issueTag: u.issueTag } });
    }

    // Running average. The increment takes the vendor row lock first, so two
    // orders rated at the same moment can't overwrite each other's update.
    const vendors = [];
    for (const [vendorId, score] of [...vendorScores].sort(([a], [b]) => a.localeCompare(b))) {
      const locked = await tx.vendor.update({
        where: { id: vendorId },
        data: { ratingCount: { increment: 1 } },
        select: { ratingScore: true, ratingCount: true },
      });
      const oldCount = locked.ratingCount - 1;
      const newScore = Math.round(((Number(locked.ratingScore) * oldCount + score) / locked.ratingCount) * 100) / 100;
      await tx.vendor.update({ where: { id: vendorId }, data: { ratingScore: newScore } });
      vendors.push({ vendorId, appliedRating: score, newScore, ratingCount: locked.ratingCount });
    }
    return { orderId, stars, items: itemUpdates, vendors };
  });
}

// Vendor sees flagged items for their stall (no student identity).
export async function vendorFeedback(user) {
  if (!user.vendorId) throw forbidden('This account is not linked to a vendor stall');
  const items = await prisma.orderItem.findMany({
    where: { vendorId: user.vendorId, itemRating: { not: null } },
    orderBy: { order: { ratedAt: 'desc' } },
    take: 100,
    select: {
      itemRating: true, issueTag: true, qty: true,
      product: { select: { name: true, unit: true } },
      order: { select: { orderNumber: true, ratedAt: true, batchDate: true } },
    },
  });
  return items.map(({ order, ...i }) => ({
    ...i, orderLabel: `#${order.orderNumber}`, ratedAt: order.ratedAt, batchDate: toDateString(order.batchDate),
  }));
}
