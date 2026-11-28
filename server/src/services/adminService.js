import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { MIN_VENDOR_RATING } from '../config/business.js';
import { AppError, notFound } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { fromDateString, toDateString } from '../utils/batchDate.js';
import { publicUserSelect } from './authService.js';

const sum = (agg, field) => agg._sum[field] ?? 0;

// Ops dashboard numbers. Optional date range filters by batch date.
export async function getSummary({ from, to }) {
  const batch = from || to
    ? { batchDate: { ...(from && { gte: fromDateString(from) }), ...(to && { lte: fromDateString(to) }) } }
    : {};
  const paid = { ...batch, paidAt: { not: null } };
  const live = { ...paid, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } };

  const [byStatus, revenue, refunds, cancelledPaid, liveItems, payouts, riderPay, wallets, vendors, flags] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where: batch, _count: { _all: true } }),
    prisma.order.aggregate({ where: live, _sum: { totalKobo: true, deliveryFeeKobo: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...paid, status: 'CANCELLED' }, _sum: { refundKobo: true } }),
    prisma.order.aggregate({ where: { ...paid, status: 'CANCELLED' }, _sum: { totalKobo: true } }),
    prisma.orderItem.findMany({ where: { order: live }, select: { qty: true, studentPriceKobo: true, wholesaleCostKobo: true } }),
    prisma.stallPickup.groupBy({ by: ['payoutStatus'], where: batch, _sum: { payoutKobo: true }, _count: { _all: true } }),
    prisma.riderEarning.aggregate({ where: { order: batch }, _sum: { amountKobo: true }, _count: { _all: true } }),
    prisma.user.aggregate({ where: { role: 'STUDENT' }, _sum: { walletBalanceKobo: true } }),
    prisma.vendor.findMany({
      orderBy: { ratingScore: 'asc' },
      select: { id: true, name: true, stallNumber: true, ratingScore: true, ratingCount: true, isActive: true, payoutBalanceKobo: true },
    }),
    prisma.orderItem.groupBy({ by: ['vendorId'], where: { issueTag: { not: null }, order: batch }, _count: { _all: true } }),
  ]);

  const itemMarginKobo = liveItems.reduce((s, i) => s + (i.studentPriceKobo - i.wholesaleCostKobo) * i.qty, 0);
  const cancellationFeesKobo = sum(cancelledPaid, 'totalKobo') - sum(refunds, 'refundKobo');
  const riderCostKobo = sum(riderPay, 'amountKobo');
  const flagsByVendor = new Map(flags.map((f) => [f.vendorId, f._count._all]));

  return {
    range: { from: from ?? null, to: to ?? null },
    orders: {
      byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
      paidAndActive: revenue._count._all,
    },
    money: {
      salesKobo: sum(revenue, 'totalKobo'), // paid, not cancelled
      deliveryFeesKobo: sum(revenue, 'deliveryFeeKobo'),
      itemMarginKobo, // student price − vendor wholesale cost
      cancellationFeesKobo,
      refundsKobo: sum(refunds, 'refundKobo'),
      riderEarningsKobo: riderCostKobo,
      // What LodgeMart keeps: item margin + delivery fees + cancellation fees − rider commission
      grossProfitKobo: itemMarginKobo + sum(revenue, 'deliveryFeeKobo') + cancellationFeesKobo - riderCostKobo,
      studentWalletBalancesKobo: sum(wallets, 'walletBalanceKobo'), // money we hold for students
    },
    payouts: Object.fromEntries(payouts.map((p) => [p.payoutStatus, { count: p._count._all, amountKobo: p._sum.payoutKobo ?? 0 }])),
    deliveries: { collected: riderPay._count._all },
    vendors: vendors.map((v) => ({
      ...v,
      ratingScore: Number(v.ratingScore),
      flaggedItems: flagsByVendor.get(v.id) ?? 0,
      receivesOrders: v.isActive && Number(v.ratingScore) >= MIN_VENDOR_RATING,
    })),
  };
}

// All orders (admin view: never includes the pickup PIN).
export async function listOrders({ status, batchDate, page }) {
  const where = { ...(status && { status }), ...(batchDate && { batchDate: fromDateString(batchDate) }) };
  const take = 50;
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
      select: {
        id: true, orderNumber: true, status: true, batchDate: true, batchSlotId: true, totalKobo: true,
        paymentMethod: true, paidAt: true, requiresBagMerge: true, delegateName: true, deliveredTo: true,
        createdAt: true, cancelledAt: true, refundKobo: true, ratedAt: true,
        student: { select: { id: true, name: true, email: true, phone: true } },
        hub: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);
  return {
    page, pageSize: take, total,
    orders: rows.map(({ _count, ...o }) => ({ ...o, orderLabel: `#${o.orderNumber}`, batchDate: toDateString(o.batchDate), itemCount: _count.items })),
  };
}

// Staff accounts (vendors, riders, admins) are created here, never by public sign-up.
export async function createStaffUser({ role, name, email, phone, password, vendor }) {
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  const passwordHash = await hashPassword(password);

  try {
    return await prisma.$transaction(async (tx) => {
      let vendorId;
      if (role === 'VENDOR') {
        const v = await tx.vendor.create({
          data: {
            id: `v-${randomUUID().slice(0, 8)}`,
            name: vendor.stallName ?? name,
            market: vendor.market,
            stallNumber: vendor.stallNumber,
            bankName: vendor.bankName,
            bankCode: vendor.bankCode,
            bankAccountNumber: vendor.bankAccountNumber,
          },
        });
        vendorId = v.id;
      }
      return tx.user.create({
        data: { role, name, email, phone, passwordHash, vendorId },
        select: publicUserSelect,
      });
    });
  } catch (err) {
    if (err?.code === 'P2002') throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    throw err;
  }
}

export async function listUsers({ role }) {
  return prisma.user.findMany({
    where: role ? { role } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: publicUserSelect,
  });
}

// Disable / re-enable an account. Disabled users are logged out immediately
// (the auth middleware re-checks isActive on every request).
export async function setUserActive(admin, userId, isActive) {
  if (admin.id === userId) throw new AppError(400, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound('User not found');
  return prisma.user.update({ where: { id: userId }, data: { isActive }, select: publicUserSelect });
}

export async function listVendors() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, market: true, stallNumber: true, bankName: true, bankCode: true, bankAccountNumber: true,
      ratingScore: true, ratingCount: true, payoutBalanceKobo: true, isActive: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  return vendors.map((v) => ({ ...v, ratingScore: Number(v.ratingScore) }));
}

// Update a stall. Changing bank details forgets the saved Paystack recipient,
// so the next payout goes to the NEW account.
export async function updateVendor(vendorId, data) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw notFound('Vendor not found');
  const bankChanged = ['bankName', 'bankCode', 'bankAccountNumber'].some((k) => k in data);
  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { ...data, ...(bankChanged && { paystackRecipientCode: null }) },
    select: {
      id: true, name: true, market: true, stallNumber: true, bankName: true, bankCode: true, bankAccountNumber: true,
      ratingScore: true, ratingCount: true, isActive: true,
    },
  });
  return { ...updated, ratingScore: Number(updated.ratingScore) };
}
