import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { redis } from '../config/redis.js';
import { RIDER_COMMISSION_KOBO } from '../config/business.js';
import { AppError, notFound, serviceUnavailable } from '../utils/errors.js';
import { fromDateString, isPastCutoff, toDateString } from '../utils/batchDate.js';
import { assertPickupPhotoUrl } from './photoService.js';

const AT_MARKET = ['ORDER_PLACED', 'PACKED_AT_MARKET'];
const PIN_MAX_FAILURES = 5;
const PIN_LOCK_SECONDS = 15 * 60;

async function loadSlot(batchSlotId) {
  const slot = await prisma.batchSlot.findUnique({ where: { id: batchSlotId } });
  if (!slot) throw new AppError(400, 'INVALID_BATCH_SLOT', 'Unknown delivery batch');
  return slot;
}

const recipientOf = (order) => (order.delegateName ? `${order.delegateName} (Delegate)` : order.student.name);

// Everything a rider needs for one batch: which stalls to visit and what to
// collect, then which hubs to drop at and who to hand each order to.
// Never includes PINs, wholesale costs, or student phone/email.
export async function getManifest({ batchDate, batchSlotId }) {
  const slot = await loadSlot(batchSlotId);
  const date = fromDateString(batchDate);
  const batch = { batchDate: date, batchSlotId };

  const [orders, pickups, arrivals] = await Promise.all([
    prisma.order.findMany({
      where: { ...batch, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } }, // unpaid orders aren't real yet
      orderBy: { orderNumber: 'asc' },
      select: {
        id: true, orderNumber: true, status: true, requiresBagMerge: true, delegateName: true,
        student: { select: { name: true } },
        hub: { select: { id: true, name: true } },
        items: {
          select: {
            qty: true, vendorPacked: true, riderPickedUp: true,
            product: { select: { name: true, unit: true } },
            vendor: { select: { id: true, name: true, stallNumber: true, market: true } },
          },
        },
      },
    }),
    prisma.stallPickup.findMany({ where: batch, select: { id: true, vendorId: true, capturedAt: true } }),
    prisma.hubArrival.findMany({ where: batch, select: { hubId: true, arrivedAt: true } }),
  ]);

  const stalls = new Map();
  const hubs = new Map();
  for (const o of orders) {
    const orderLabel = `#${o.orderNumber}`;
    for (const item of o.items) {
      const v = item.vendor;
      if (!stalls.has(v.id)) stalls.set(v.id, { vendor: v, items: [] });
      stalls.get(v.id).items.push({
        orderLabel, product: item.product, qty: item.qty, vendorPacked: item.vendorPacked, riderPickedUp: item.riderPickedUp,
      });
    }
    if (!hubs.has(o.hub.id)) hubs.set(o.hub.id, { hub: o.hub, orders: [] });
    hubs.get(o.hub.id).orders.push({
      id: o.id, orderLabel, status: o.status, recipientName: recipientOf(o),
      requiresBagMerge: o.requiresBagMerge, itemCount: o.items.length,
    });
  }

  const pickupByVendor = new Map(pickups.map((p) => [p.vendorId, p]));
  const arrivalByHub = new Map(arrivals.map((a) => [a.hubId, a]));
  return {
    batch: { batchDate, batchSlotId, label: slot.label, cutoffTime: slot.cutoffTime, pickupOpen: isPastCutoff(slot, date) },
    stalls: [...stalls.values()].map((s) => ({ ...s, pickup: pickupByVendor.get(s.vendor.id) ?? null })),
    hubs: [...hubs.values()].map((h) => ({ ...h, arrivedAt: arrivalByHub.get(h.hub.id)?.arrivedAt ?? null })),
  };
}

// Rider collects one stall's items for ONE batch (fixes the prototype bug that
// collected and paid for every uncollected item regardless of batch).
// One pickup + one payout per vendor per batch (DB unique constraint).
export async function confirmStallPickup(rider, { vendorId, batchDate, batchSlotId, photoUrl }) {
  assertPickupPhotoUrl(photoUrl);
  const slot = await loadSlot(batchSlotId);
  const date = fromDateString(batchDate);
  if (!isPastCutoff(slot, date)) {
    throw new AppError(409, 'BEFORE_CUTOFF', `Stall pickup opens after the ${slot.cutoffTime} cutoff`);
  }
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw notFound('Vendor not found');

  try {
    return await prisma.$transaction(async (tx) => {
      const pickup = await tx.stallPickup.create({
        data: { vendorId, riderId: rider.id, batchSlotId, batchDate: date, photoUrl, payoutKobo: 0 },
      });

      // Lock each candidate order row while confirming it is still at the market.
      // A concurrent cancel either finishes first (order skipped here) or waits
      // for us and then sees the picked-up items and refuses.
      const candidates = await tx.order.findMany({
        where: { batchDate: date, batchSlotId, status: { in: AT_MARKET }, items: { some: { vendorId, riderPickedUp: false } } },
        select: { id: true },
      });
      const lockedIds = [];
      for (const { id } of candidates) {
        const { count } = await tx.order.updateMany({ where: { id, status: { in: AT_MARKET } }, data: { updatedAt: new Date() } });
        if (count === 1) lockedIds.push(id);
      }

      const items = await tx.orderItem.findMany({
        where: { orderId: { in: lockedIds }, vendorId, riderPickedUp: false },
        select: { id: true, qty: true, wholesaleCostKobo: true },
      });
      if (items.length === 0) throw new AppError(409, 'NOTHING_TO_COLLECT', 'No items to collect from this stall for this batch');

      // Vendor is paid the wholesale cost snapshot taken when the order was placed.
      const payoutKobo = items.reduce((sum, i) => sum + i.wholesaleCostKobo * i.qty, 0);
      await tx.orderItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { riderPickedUp: true, vendorPacked: true, stallPickupId: pickup.id },
      });
      await tx.stallPickup.update({ where: { id: pickup.id }, data: { payoutKobo } });

      // Orders whose every item is now collected are on the road.
      const moved = await tx.order.updateMany({
        where: { id: { in: lockedIds }, status: { in: AT_MARKET }, items: { every: { riderPickedUp: true } } },
        data: { status: 'RIDER_IN_TRANSIT' },
      });

      return {
        stallPickupId: pickup.id, vendorId, batchDate, batchSlotId,
        itemsCollected: items.length, payoutKobo, payoutStatus: 'PENDING', ordersInTransit: moved.count,
      };
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      throw new AppError(409, 'ALREADY_PICKED_UP', 'This stall has already been collected for this batch');
    }
    throw err;
  }
}

// Rider arrives at a hub: that batch's in-transit orders for the hub become
// READY_AT_HUB. Safe to repeat (e.g. after collecting a late stall).
export async function markHubArrived(rider, { hubId, batchDate, batchSlotId }) {
  await loadSlot(batchSlotId);
  const hub = await prisma.hub.findUnique({ where: { id: hubId }, select: { id: true } });
  if (!hub) throw notFound('Hub not found');
  const date = fromDateString(batchDate);

  return prisma.$transaction(async (tx) => {
    const arrival = await tx.hubArrival.upsert({
      where: { hubId_batchSlotId_batchDate: { hubId, batchSlotId, batchDate: date } },
      create: { hubId, batchSlotId, batchDate: date, riderId: rider.id },
      update: {}, // keep the first arrival time
    });
    const ready = await tx.order.updateMany({
      where: { hubId, batchSlotId, batchDate: date, status: 'RIDER_IN_TRANSIT' },
      data: { status: 'READY_AT_HUB' },
    });
    return { hubId, batchDate, batchSlotId, arrivedAt: arrival.arrivedAt, ordersReady: ready.count };
  });
}

const failKey = (orderId) => `pin:fail:${orderId}`;

function pinMatches(entered, actual) {
  const a = Buffer.from(entered);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Hand an order to the student (or their delegate) after checking the PIN.
// Single use: only a READY_AT_HUB order can be collected, exactly once, and
// the rider's ₦150 commission is unique per order. After 5 wrong PINs the
// order is locked for 15 minutes.
export async function handover(rider, { orderId, pin }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, pickupPin: true, delegateName: true, student: { select: { name: true } } },
  });
  if (!order) throw notFound('Order not found');
  if (order.status === 'COLLECTED') throw new AppError(409, 'ALREADY_COLLECTED', 'This order has already been collected');
  if (order.status !== 'READY_AT_HUB') throw new AppError(409, 'NOT_READY', 'This order is not at the hub yet');

  // Count the attempt BEFORE comparing (atomic INCR), so parallel guesses
  // can't slip past the limit. A correct PIN clears the counter.
  let attempts;
  try {
    const res = await redis.multi().incr(failKey(orderId)).expire(failKey(orderId), PIN_LOCK_SECONDS, 'NX').exec();
    attempts = res[0][1];
  } catch {
    throw serviceUnavailable();
  }
  if (attempts > PIN_MAX_FAILURES) {
    throw new AppError(429, 'PIN_LOCKED', 'Too many wrong PINs for this order. Try again in 15 minutes.');
  }
  if (!pinMatches(pin, order.pickupPin)) {
    throw new AppError(400, 'INVALID_PIN', 'Invalid 4-digit PIN. Check with the student or delegate.', {
      attemptsLeft: PIN_MAX_FAILURES - attempts,
    });
  }

  const recipient = recipientOf(order);
  return prisma.$transaction(async (tx) => {
    // Conditional on status AND pin: two riders submitting at once → only one wins.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'READY_AT_HUB', pickupPin: pin },
      data: { status: 'COLLECTED', deliveredTo: recipient, collectedAt: new Date() },
    });
    if (count === 0) throw new AppError(409, 'ALREADY_COLLECTED', 'This order has already been collected');
    await tx.riderEarning.create({ data: { riderId: rider.id, orderId, amountKobo: RIDER_COMMISSION_KOBO } });
    await redis.del(failKey(orderId)).catch(() => {});
    return { orderId, orderLabel: `#${order.orderNumber}`, status: 'COLLECTED', deliveredTo: recipient, earnedKobo: RIDER_COMMISSION_KOBO };
  });
}

export async function getEarnings(rider) {
  const [total, recent] = await Promise.all([
    prisma.riderEarning.aggregate({ where: { riderId: rider.id }, _sum: { amountKobo: true }, _count: true }),
    prisma.riderEarning.findMany({
      where: { riderId: rider.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { amountKobo: true, createdAt: true, order: { select: { orderNumber: true, batchDate: true } } },
    }),
  ]);
  return {
    totalKobo: total._sum.amountKobo ?? 0,
    deliveries: total._count,
    recent: recent.map((e) => ({
      amountKobo: e.amountKobo, createdAt: e.createdAt,
      orderLabel: `#${e.order.orderNumber}`, batchDate: toDateString(e.order.batchDate),
    })),
  };
}
