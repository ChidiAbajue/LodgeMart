import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { CANCELLATION_FEE_KOBO, DELIVERY_FEE_KOBO } from '../config/business.js';
import { AppError, notFound } from '../utils/errors.js';
import { batchDateFor, toDateString } from '../utils/batchDate.js';
import { routeBasket } from './routingService.js';
import { routableVendor } from './catalogService.js';

const CANCELLABLE = ['ORDER_PLACED', 'PACKED_AT_MARKET']; // before the rider has picked up
const DELEGATABLE = ['ORDER_PLACED', 'PACKED_AT_MARKET', 'RIDER_IN_TRANSIT', 'READY_AT_HUB'];
const MAX_STOCK_RACE_RETRIES = 3;

// 4-digit handover PIN from a cryptographically secure source.
const newPickupPin = () => String(randomInt(1000, 10000));

// What a student (or admin) sees. Wholesale costs are never included.
const orderSelect = {
  id: true,
  orderNumber: true,
  studentId: true,
  status: true,
  zone: { select: { id: true, name: true } },
  hub: { select: { id: true, name: true } },
  batchSlot: { select: { id: true, label: true, startTime: true, endTime: true } },
  batchDate: true,
  pickupPin: true,
  delegateName: true,
  delegatePhone: true,
  requiresBagMerge: true,
  subtotalKobo: true,
  deliveryFeeKobo: true,
  totalKobo: true,
  paymentMethod: true,
  paymentRef: true,
  paidAt: true,
  deliveredTo: true,
  collectedAt: true,
  ratedAt: true,
  cancelledAt: true,
  refundKobo: true,
  createdAt: true,
  items: {
    orderBy: { product: { name: 'asc' } },
    select: {
      id: true,
      productId: true,
      qty: true,
      studentPriceKobo: true,
      vendorPacked: true,
      riderPickedUp: true,
      itemRating: true,
      issueTag: true,
      product: { select: { name: true, unit: true, emoji: true } },
      vendor: { select: { id: true, name: true, stallNumber: true } },
    },
  },
};

// The pickup PIN is only ever shown to the student who owns the order.
function toView(order, viewer) {
  const { studentId, pickupPin, batchDate, ...rest } = order;
  return {
    ...rest,
    orderLabel: `#${order.orderNumber}`,
    batchDate: toDateString(batchDate),
    ...(viewer.id === studentId && { pickupPin }),
  };
}

class StockRace extends Error {}

async function loadOrderInputs({ items, zoneId, hubId, batchSlotId }) {
  const [zoneHub, slot, products] = await Promise.all([
    prisma.zoneHub.findUnique({ where: { zoneId_hubId: { zoneId, hubId } } }),
    prisma.batchSlot.findUnique({ where: { id: batchSlotId } }),
    prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) }, isActive: true } }),
  ]);
  if (!zoneHub) throw new AppError(400, 'INVALID_HUB', 'That pickup hub is not in your campus zone');
  if (!slot) throw new AppError(400, 'INVALID_BATCH_SLOT', 'Unknown delivery batch');
  const byId = new Map(products.map((p) => [p.id, p]));
  const missing = items.find((i) => !byId.has(i.productId));
  if (missing) {
    throw new AppError(400, 'PRODUCT_UNAVAILABLE', 'A product in your basket is no longer available', {
      productId: missing.productId,
    });
  }
  return { slot, products: byId };
}

// Place an order paid from the student's wallet. Everything happens in one
// transaction: if any step fails, no stock or money moves.
export async function createOrder(student, input) {
  const { slot, products } = await loadOrderInputs(input);
  const lines = input.items;

  // Prices come from the database, never from the client.
  const subtotalKobo = lines.reduce((sum, l) => sum + products.get(l.productId).studentPriceKobo * l.qty, 0);
  const totalKobo = subtotalKobo + DELIVERY_FEE_KOBO;

  for (let attempt = 1; attempt <= MAX_STOCK_RACE_RETRIES; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const inventory = await tx.vendorInventory.findMany({
          where: { productId: { in: lines.map((l) => l.productId) }, stockQty: { gt: 0 }, vendor: routableVendor },
          select: {
            productId: true,
            stockQty: true,
            wholesalePriceKobo: true,
            vendor: { select: { id: true, ratingScore: true } },
          },
        });
        const vendors = new Map();
        for (const row of inventory) {
          if (!vendors.has(row.vendor.id)) {
            vendors.set(row.vendor.id, { id: row.vendor.id, rating: Number(row.vendor.ratingScore), inventory: new Map() });
          }
          vendors.get(row.vendor.id).inventory.set(row.productId, row);
        }

        const routed = routeBasket(lines, [...vendors.values()]);
        if (!routed.ok) {
          const name = products.get(routed.productId).name;
          throw new AppError(409, 'OUT_OF_STOCK', `Not enough stock for ${name}`, { productId: routed.productId });
        }

        // Take stock only if it is still there. If another order took it since
        // we read it, count is 0: abort and re-route with fresh stock levels.
        for (const a of routed.assignments) {
          const { count } = await tx.vendorInventory.updateMany({
            where: { vendorId: a.vendorId, productId: a.productId, stockQty: { gte: a.qty } },
            data: { stockQty: { decrement: a.qty } },
          });
          if (count === 0) throw new StockRace();
        }

        // Same pattern for the wallet: the balance can never go negative.
        const paid = await tx.user.updateMany({
          where: { id: student.id, walletBalanceKobo: { gte: totalKobo } },
          data: { walletBalanceKobo: { decrement: totalKobo } },
        });
        if (paid.count === 0) {
          throw new AppError(402, 'INSUFFICIENT_FUNDS', 'Insufficient LodgeMart Wallet balance');
        }

        return tx.order.create({
          data: {
            studentId: student.id,
            zoneId: input.zoneId,
            hubId: input.hubId,
            batchSlotId: slot.id,
            batchDate: batchDateFor(slot),
            status: 'ORDER_PLACED',
            pickupPin: newPickupPin(),
            requiresBagMerge: new Set(routed.assignments.map((a) => a.vendorId)).size >= 2,
            subtotalKobo,
            deliveryFeeKobo: DELIVERY_FEE_KOBO,
            totalKobo,
            paymentMethod: 'WALLET',
            paymentRef: `LM-WALLET-${randomUUID()}`,
            paidAt: new Date(),
            items: {
              create: routed.assignments.map((a) => ({
                productId: a.productId,
                vendorId: a.vendorId,
                qty: a.qty,
                studentPriceKobo: products.get(a.productId).studentPriceKobo,
                wholesaleCostKobo: a.wholesaleCostKobo,
              })),
            },
          },
          select: orderSelect,
        });
      });
      return toView(order, student);
    } catch (err) {
      if (err instanceof StockRace) continue;
      throw err;
    }
  }
  throw new AppError(409, 'OUT_OF_STOCK', 'Stock just ran out for an item in your basket, please try again');
}

export async function listMyOrders(student) {
  const orders = await prisma.order.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: orderSelect,
  });
  return orders.map((o) => toView(o, student));
}

// Owner or admin. Anyone else gets 404, as if the order didn't exist.
export async function getOrder(viewer, id) {
  const order = await prisma.order.findUnique({ where: { id }, select: orderSelect });
  if (!order || (viewer.role !== 'ADMIN' && order.studentId !== viewer.id)) throw notFound('Order not found');
  return toView(order, viewer);
}

// Cancel before rider pickup: refund total minus the cancellation fee to the
// wallet and put the stock back. The status update only succeeds once, so a
// double-click (or two devices) can never refund twice.
export async function cancelOrder(student, id) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, studentId: student.id },
      select: { id: true, status: true, totalKobo: true, items: { select: { vendorId: true, productId: true, qty: true } } },
    });
    if (!order) throw notFound('Order not found');

    const refundKobo = Math.max(0, order.totalKobo - CANCELLATION_FEE_KOBO);
    const { count } = await tx.order.updateMany({
      where: { id, status: { in: CANCELLABLE } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), refundKobo },
    });
    if (count === 0) {
      // Re-read: a parallel request may have just cancelled it.
      const { status } = await tx.order.findUnique({ where: { id }, select: { status: true } });
      if (status === 'CANCELLED') {
        throw new AppError(409, 'ALREADY_CANCELLED', 'This order has already been cancelled');
      }
      throw new AppError(409, 'CANNOT_CANCEL', 'Order cannot be cancelled once the rider has picked it up');
    }

    // Partially collected (one stall picked up, another not yet): the vendor has
    // already been paid for those items, so the order can't be cancelled.
    // Our status update above holds the order row lock, so a stall pickup
    // running right now has either committed already (seen here) or waits.
    const collected = await tx.orderItem.count({ where: { orderId: id, riderPickedUp: true } });
    if (collected > 0) {
      throw new AppError(409, 'CANNOT_CANCEL', 'Order cannot be cancelled once the rider has picked it up');
    }

    for (const item of order.items) {
      await tx.vendorInventory.updateMany({
        where: { vendorId: item.vendorId, productId: item.productId },
        data: { stockQty: { increment: item.qty } },
      });
    }
    await tx.user.update({
      where: { id: student.id },
      data: { walletBalanceKobo: { increment: refundKobo } },
    });

    return { orderId: id, status: 'CANCELLED', refundKobo, cancellationFeeKobo: order.totalKobo - refundKobo };
  });
}

// Hand pickup to a roommate: issues a NEW PIN (the old one stops working).
export async function delegatePickup(student, id, { name, phone }) {
  const pickupPin = newPickupPin();
  const { count } = await prisma.order.updateMany({
    where: { id, studentId: student.id, status: { in: DELEGATABLE } },
    data: { pickupPin, delegateName: name, delegatePhone: phone },
  });
  if (count === 0) {
    const exists = await prisma.order.findFirst({ where: { id, studentId: student.id }, select: { id: true } });
    if (!exists) throw notFound('Order not found');
    throw new AppError(409, 'ORDER_CLOSED', 'This order can no longer be delegated');
  }
  return { orderId: id, pickupPin, delegateName: name, delegatePhone: phone };
}
