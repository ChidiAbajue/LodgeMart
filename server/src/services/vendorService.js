import { prisma } from '../config/prisma.js';
import { AppError, forbidden, notFound } from '../utils/errors.js';
import { fromDateString, latestClosedBatchDate, toDateString } from '../utils/batchDate.js';

const OPEN = ['ORDER_PLACED', 'PACKED_AT_MARKET']; // still at the market

// Vendors only see a batch once its cutoff (3 PM) has passed: until then
// students can still cancel, so the order list isn't final. Returns a Prisma
// `order` filter: for each slot, batch dates up to the newest closed one.
export async function closedBatchFilter(now = new Date()) {
  const slots = await prisma.batchSlot.findMany({ select: { id: true, cutoffTime: true } });
  return { OR: slots.map((s) => ({ batchSlotId: s.id, batchDate: { lte: latestClosedBatchDate(s, now) } })) };
}

// A vendor login is linked to exactly one stall.
export function vendorIdOf(user) {
  if (!user.vendorId) throw forbidden('This account is not linked to a vendor stall');
  return user.vendorId;
}

export async function getDashboard(user) {
  const vendorId = vendorIdOf(user);
  const [vendor, pickups] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true, name: true, market: true, stallNumber: true, bankName: true, bankCode: true, bankAccountNumber: true,
        ratingScore: true, ratingCount: true, payoutBalanceKobo: true, isActive: true, priorityTier: true,
        inventory: {
          orderBy: { product: { name: 'asc' } },
          select: {
            productId: true, wholesalePriceKobo: true, stockQty: true,
            product: { select: { name: true, unit: true, emoji: true, studentPriceKobo: true } },
          },
        },
      },
    }),
    prisma.stallPickup.findMany({
      where: { vendorId },
      orderBy: { capturedAt: 'desc' },
      take: 30,
      select: {
        id: true, batchDate: true, batchSlotId: true, capturedAt: true, payoutKobo: true, payoutStatus: true,
        rider: { select: { name: true } },
      },
    }),
  ]);
  if (!vendor) throw notFound('Vendor not found');
  const pendingPayoutKobo = pickups.filter((p) => p.payoutStatus !== 'PAID').reduce((s, p) => s + p.payoutKobo, 0);
  return {
    vendor: { ...vendor, ratingScore: Number(vendor.ratingScore), pendingPayoutKobo },
    stallPickups: pickups.map((p) => ({ ...p, batchDate: toDateString(p.batchDate) })),
  };
}

// Items this stall must pack, oldest batch first. Never shows the student's
// PIN or contact details — vendors only need order number, hub and batch.
export async function listItems(user, { batchDate, batchSlotId }) {
  const vendorId = vendorIdOf(user);
  const closed = await closedBatchFilter();
  const items = await prisma.orderItem.findMany({
    where: {
      vendorId,
      order: {
        ...closed, // batches still open to students are hidden
        status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] }, // unpaid transfer orders aren't packed
        ...(batchDate && { batchDate: fromDateString(batchDate) }),
        ...(batchSlotId && { batchSlotId }),
      },
      refundedAt: null, // refunded line items (price-spike safeguard) are not packed
      ...(!batchDate && { riderPickedUp: false }), // default view: what's still to do
    },
    orderBy: [{ order: { batchDate: 'asc' } }, { order: { orderNumber: 'asc' } }],
    take: 500,
    select: {
      id: true, qty: true, wholesaleCostKobo: true, vendorPacked: true, riderPickedUp: true,
      product: { select: { id: true, name: true, unit: true, emoji: true } },
      order: {
        select: {
          id: true, orderNumber: true, status: true, batchDate: true, requiresBagMerge: true,
          batchSlot: { select: { id: true, label: true } },
          hub: { select: { id: true, name: true } },
        },
      },
    },
  });
  return items.map(({ order, ...item }) => ({
    ...item,
    order: { ...order, orderLabel: `#${order.orderNumber}`, batchDate: toDateString(order.batchDate) },
  }));
}

// Mark one line item packed/unpacked. When every item in the order is packed
// the order becomes PACKED_AT_MARKET (and goes back if one is unpacked).
export async function setPacked(user, itemId, packed) {
  const vendorId = vendorIdOf(user);
  return prisma.$transaction(async (tx) => {
    const closed = await closedBatchFilter();
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, vendorId, refundedAt: null, order: closed }, // open batches aren't visible yet
      select: { orderId: true, riderPickedUp: true },
    });
    if (!item) throw notFound('Item not found');
    if (item.riderPickedUp) throw new AppError(409, 'ALREADY_PICKED_UP', 'The rider has already collected this item');

    // Lock the order row and confirm it's still at the market (not cancelled).
    const locked = await tx.order.updateMany({ where: { id: item.orderId, status: { in: OPEN } }, data: { updatedAt: new Date() } });
    if (locked.count === 0) throw new AppError(409, 'ORDER_CLOSED', 'This order is no longer being packed');

    await tx.orderItem.update({ where: { id: itemId }, data: { vendorPacked: packed } });
    const unpacked = await tx.orderItem.count({ where: { orderId: item.orderId, vendorPacked: false, refundedAt: null } });
    const status = unpacked === 0 ? 'PACKED_AT_MARKET' : 'ORDER_PLACED';
    await tx.order.update({ where: { id: item.orderId }, data: { status } });
    return { itemId, vendorPacked: packed, orderStatus: status };
  });
}

// Vendor sets their own wholesale price and stock for a product.
export async function setInventory(user, productId, { wholesalePriceKobo, stockQty }) {
  const vendorId = vendorIdOf(user);
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw notFound('Product not found');
  return prisma.vendorInventory.upsert({
    where: { vendorId_productId: { vendorId, productId } },
    create: { vendorId, productId, wholesalePriceKobo, stockQty },
    update: { wholesalePriceKobo, stockQty },
    select: { productId: true, wholesalePriceKobo: true, stockQty: true },
  });
}
