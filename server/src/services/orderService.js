import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { CANCELLATION_FEE_KOBO, DELIVERY_FEE_KOBO } from '../config/business.js';
import { AppError, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { batchDateFor, toDateString } from '../utils/batchDate.js';
import { routeBasket } from './routingService.js';
import { routableVendor } from './catalogService.js';
import * as paystack from './paystackClient.js';

const CANCELLABLE = ['PENDING_PAYMENT', 'ORDER_PLACED', 'PACKED_AT_MARKET']; // before the rider has picked up
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

// The pickup PIN is only ever shown to the student who owns the order, and
// only once it's paid for.
function toView(order, viewer) {
  const { studentId, pickupPin, batchDate, ...rest } = order;
  const showPin = viewer.id === studentId && order.status !== 'PENDING_PAYMENT';
  return {
    ...rest,
    orderLabel: `#${order.orderNumber}`,
    batchDate: toDateString(batchDate),
    ...(showPin && { pickupPin }),
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

// Put an order's items back on the shelf (cancel / expiry).
async function restock(tx, orderId) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { vendorId: true, productId: true, qty: true } });
  for (const item of items) {
    await tx.vendorInventory.updateMany({
      where: { vendorId: item.vendorId, productId: item.productId },
      data: { stockQty: { increment: item.qty } },
    });
  }
}

// Place an order. Routing + stock reservation happen in one transaction.
//   WALLET   → paid immediately from the wallet → ORDER_PLACED.
//   PAYSTACK → PENDING_PAYMENT (stock held); returns a Paystack checkout URL.
//              The webhook (or verifyMyPayment) marks it paid.
export async function createOrder(student, input) {
  const { slot, products } = await loadOrderInputs(input);
  const lines = input.items;
  const isCard = input.paymentMethod === 'PAYSTACK';
  if (isCard && !paystack.paystackEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Card payments are not available right now');
  }

  // Prices come from the database, never from the client.
  const subtotalKobo = lines.reduce((sum, l) => sum + products.get(l.productId).studentPriceKobo * l.qty, 0);
  const totalKobo = subtotalKobo + DELIVERY_FEE_KOBO;

  let order;
  for (let attempt = 1; attempt <= MAX_STOCK_RACE_RETRIES && !order; attempt++) {
    try {
      order = await prisma.$transaction(async (tx) => {
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

        if (!isCard) {
          // Same pattern for the wallet: the balance can never go negative.
          const paid = await tx.user.updateMany({
            where: { id: student.id, walletBalanceKobo: { gte: totalKobo } },
            data: { walletBalanceKobo: { decrement: totalKobo } },
          });
          if (paid.count === 0) {
            throw new AppError(402, 'INSUFFICIENT_FUNDS', 'Insufficient LodgeMart Wallet balance');
          }
        }

        return tx.order.create({
          data: {
            studentId: student.id,
            zoneId: input.zoneId,
            hubId: input.hubId,
            batchSlotId: slot.id,
            batchDate: batchDateFor(slot),
            status: isCard ? 'PENDING_PAYMENT' : 'ORDER_PLACED',
            pickupPin: newPickupPin(),
            requiresBagMerge: new Set(routed.assignments.map((a) => a.vendorId)).size >= 2,
            subtotalKobo,
            deliveryFeeKobo: DELIVERY_FEE_KOBO,
            totalKobo,
            paymentMethod: isCard ? 'PAYSTACK' : 'WALLET',
            paymentRef: isCard ? `lm-ps-${randomUUID()}` : `LM-WALLET-${randomUUID()}`,
            paidAt: isCard ? null : new Date(),
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
    } catch (err) {
      if (!(err instanceof StockRace)) throw err;
    }
  }
  if (!order) throw new AppError(409, 'OUT_OF_STOCK', 'Stock just ran out for an item in your basket, please try again');
  if (!isCard) return { order: toView(order, student) };

  // Card: open a Paystack checkout. If Paystack can't be reached, release the
  // held stock straight away rather than waiting for expiry.
  try {
    const checkout = await paystack.initializeTransaction({
      email: student.email,
      amountKobo: totalKobo,
      reference: order.paymentRef,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });
    return {
      order: toView(order, student),
      payment: { provider: 'PAYSTACK', reference: order.paymentRef, authorizationUrl: checkout.authorization_url },
    };
  } catch (err) {
    await releaseUnpaidOrder(order.id);
    if (err instanceof paystack.PaystackError) {
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not start card payment, please try again');
    }
    throw err;
  }
}

// Cancel an unpaid card order and return its stock. Safe to call twice.
async function releaseUnpaidOrder(orderId) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), refundKobo: 0 },
    });
    if (count === 1) await restock(tx, orderId);
    return count === 1;
  });
}

// Unpaid card orders older than the TTL give their stock back. Run on a timer
// (server.js) and safe to run from several servers at once.
export async function expireStalePendingOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.PENDING_PAYMENT_TTL_MINUTES * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
    select: { id: true },
    take: 200,
  });
  let expired = 0;
  for (const { id } of stale) if (await releaseUnpaidOrder(id)) expired++;
  if (expired) logger.info({ expired }, 'Expired unpaid card orders');
  return expired;
}

// Apply a confirmed Paystack payment. Called by the webhook and by the
// student's "check payment" button; idempotent, so duplicates are harmless.
//   PAID                   → order moves PENDING_PAYMENT → ORDER_PLACED
//   LATE_PAYMENT_REFUNDED  → order was already cancelled/expired: money goes to the wallet
//   ALREADY_PROCESSED / NOT_PAID / AMOUNT_MISMATCH / UNKNOWN_REFERENCE
export async function applyPaystackPayment({ reference, status, amount, currency }) {
  if (status !== 'success') return 'NOT_PAID';
  const order = await prisma.order.findUnique({
    where: { paymentRef: reference },
    select: { id: true, studentId: true, totalKobo: true, paymentMethod: true },
  });
  if (!order || order.paymentMethod !== 'PAYSTACK') return 'UNKNOWN_REFERENCE';
  if (amount !== order.totalKobo || currency !== 'NGN') {
    // Never mark paid on a short (or wrong-currency) payment. Needs a human.
    logger.error({ reference, amount, currency, expected: order.totalKobo }, 'Paystack amount mismatch');
    return 'AMOUNT_MISMATCH';
  }

  return prisma.$transaction(async (tx) => {
    const paid = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'ORDER_PLACED', paidAt: new Date() },
    });
    if (paid.count === 1) return 'PAID';

    // Paid after it was cancelled/expired: refund the full amount to the wallet, once.
    const late = await tx.order.updateMany({
      where: { id: order.id, status: 'CANCELLED', paidAt: null },
      data: { paidAt: new Date(), refundKobo: order.totalKobo },
    });
    if (late.count === 1) {
      await tx.user.update({ where: { id: order.studentId }, data: { walletBalanceKobo: { increment: order.totalKobo } } });
      logger.warn({ reference }, 'Payment arrived after order was cancelled; refunded to wallet');
      return 'LATE_PAYMENT_REFUNDED';
    }
    return 'ALREADY_PROCESSED';
  });
}

// Student's "I've paid, check now" button (useful if the webhook is slow):
// asks Paystack directly, then applies the same idempotent logic.
export async function verifyMyPayment(student, id) {
  const order = await prisma.order.findFirst({
    where: { id, studentId: student.id },
    select: { paymentRef: true, paymentMethod: true, status: true },
  });
  if (!order) throw notFound('Order not found');
  if (order.paymentMethod === 'PAYSTACK' && order.status === 'PENDING_PAYMENT') {
    let tx;
    try {
      tx = await paystack.verifyTransaction(order.paymentRef);
    } catch (err) {
      if (err instanceof paystack.PaystackError) {
        throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not check payment, please try again');
      }
      throw err;
    }
    await applyPaystackPayment(tx);
  }
  return getOrder(student, id);
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

// Cancel before rider pickup. Paid orders: refund total minus the cancellation
// fee to the wallet. Unpaid card orders: no fee, nothing to refund. Either way
// stock goes back. The status update only succeeds once, so a double-click (or
// two devices) can never refund twice.
export async function cancelOrder(student, id) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, studentId: student.id },
      select: { id: true, status: true, totalKobo: true },
    });
    if (!order) throw notFound('Order not found');

    // The refund depends on whether it was paid, so the update only applies if
    // the status is still exactly what we read. If a payment confirmation
    // (PENDING_PAYMENT → ORDER_PLACED) lands in between, re-read and recompute.
    let status = order.status;
    let refundKobo;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (status === 'CANCELLED') throw new AppError(409, 'ALREADY_CANCELLED', 'This order has already been cancelled');
      if (!CANCELLABLE.includes(status)) {
        throw new AppError(409, 'CANNOT_CANCEL', 'Order cannot be cancelled once the rider has picked it up');
      }
      refundKobo = status === 'PENDING_PAYMENT' ? 0 : Math.max(0, order.totalKobo - CANCELLATION_FEE_KOBO);
      const { count } = await tx.order.updateMany({
        where: { id, status },
        data: { status: 'CANCELLED', cancelledAt: new Date(), refundKobo },
      });
      if (count === 1) break;
      ({ status } = await tx.order.findUnique({ where: { id }, select: { status: true } }));
      if (attempt === 1) throw new AppError(409, 'CANNOT_CANCEL', 'Order changed while cancelling, please try again');
    }
    const unpaid = refundKobo === 0 && status === 'PENDING_PAYMENT';

    // Partially collected (one stall picked up, another not yet): the vendor has
    // already been paid for those items, so the order can't be cancelled.
    // Our status update above holds the order row lock, so a stall pickup
    // running right now has either committed already (seen here) or waits.
    const collected = await tx.orderItem.count({ where: { orderId: id, riderPickedUp: true } });
    if (collected > 0) {
      throw new AppError(409, 'CANNOT_CANCEL', 'Order cannot be cancelled once the rider has picked it up');
    }

    await restock(tx, id);
    if (refundKobo > 0) {
      await tx.user.update({
        where: { id: student.id },
        data: { walletBalanceKobo: { increment: refundKobo } },
      });
    }

    return {
      orderId: id,
      status: 'CANCELLED',
      refundKobo,
      cancellationFeeKobo: unpaid ? 0 : order.totalKobo - refundKobo,
    };
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
