import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { toDateString } from '../utils/batchDate.js';
import * as paystack from './paystackClient.js';

// Vendor payouts. Each StallPickup (one per vendor per batch, created in
// Phase 4 as PENDING) becomes one Paystack transfer.
//
//   PENDING / FAILED --claim--> PROCESSING --transfer.success--> PAID (+ vendor.payoutBalanceKobo)
//                                         --transfer.failed----> FAILED (admin can retry)
//
// Double-payment guards: the claim is a conditional update (two admins
// clicking "run" at once can't both claim a pickup), every attempt has its own
// reference, and Paystack refuses a reference it has already seen.

const newTransferRef = () => `lm-payout-${randomUUID()}`;

// Re-read the vendor each time: an earlier payout in the same run may have
// just saved the recipient code (don't register the same bank account twice).
async function ensureRecipient(vendorId) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, bankCode: true, bankAccountNumber: true, paystackRecipientCode: true },
  });
  if (vendor.paystackRecipientCode) return vendor.paystackRecipientCode;
  if (!vendor.bankCode) throw new Error('Vendor has no bank code on file');
  const r = await paystack.createTransferRecipient({
    name: vendor.name,
    accountNumber: vendor.bankAccountNumber,
    bankCode: vendor.bankCode,
  });
  await prisma.vendor.update({ where: { id: vendor.id }, data: { paystackRecipientCode: r.recipient_code } });
  return r.recipient_code;
}

async function markPaid(stallPickupId, transferRef) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.stallPickup.updateMany({
      where: { id: stallPickupId, transferRef, payoutStatus: 'PROCESSING' },
      data: { payoutStatus: 'PAID', paidAt: new Date(), payoutFailureReason: null },
    });
    if (count === 1) {
      const p = await tx.stallPickup.findUnique({ where: { id: stallPickupId }, select: { vendorId: true, payoutKobo: true } });
      await tx.vendor.update({ where: { id: p.vendorId }, data: { payoutBalanceKobo: { increment: p.payoutKobo } } });
    }
    return count === 1;
  });
}

const markFailed = (stallPickupId, transferRef, reason) =>
  prisma.stallPickup.updateMany({
    where: { id: stallPickupId, transferRef, payoutStatus: 'PROCESSING' },
    data: { payoutStatus: 'FAILED', payoutFailureReason: String(reason).slice(0, 300) },
  });

// Admin: send every pending (or previously failed) payout.
export async function runPayouts() {
  // Without a key, refuse up front instead of marking every payout FAILED.
  if (!paystack.paystackEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Paystack is not configured, so payouts cannot be sent');
  }
  const due = await prisma.stallPickup.findMany({
    where: { payoutStatus: { in: ['PENDING', 'FAILED'] }, payoutKobo: { gt: 0 } },
    orderBy: { capturedAt: 'asc' },
    take: 100,
    select: { id: true, payoutKobo: true, payoutStatus: true, batchDate: true, batchSlotId: true, vendor: true },
  });

  const results = [];
  for (const p of due) {
    const transferRef = newTransferRef();
    const claimed = await prisma.stallPickup.updateMany({
      where: { id: p.id, payoutStatus: p.payoutStatus },
      data: { payoutStatus: 'PROCESSING', transferRef, payoutAttempts: { increment: 1 }, payoutFailureReason: null },
    });
    if (claimed.count === 0) continue; // another run got it

    const base = { stallPickupId: p.id, vendorId: p.vendor.id, amountKobo: p.payoutKobo };
    try {
      const recipientCode = await ensureRecipient(p.vendor.id);
      const t = await paystack.initiateTransfer({
        amountKobo: p.payoutKobo,
        recipientCode,
        reference: transferRef,
        reason: `LodgeMart payout ${p.batchSlotId} ${toDateString(p.batchDate)}`,
      });
      if (t.status === 'success') {
        await markPaid(p.id, transferRef);
        results.push({ ...base, status: 'PAID' });
      } else if (t.status === 'otp') {
        await markFailed(p.id, transferRef, 'Paystack requires OTP: disable transfer OTP in the Paystack dashboard');
        results.push({ ...base, status: 'FAILED', reason: 'OTP_REQUIRED' });
      } else {
        results.push({ ...base, status: 'PROCESSING' }); // final result arrives by webhook
      }
    } catch (err) {
      logger.warn({ stallPickupId: p.id, err: err.message }, 'Payout failed');
      await markFailed(p.id, transferRef, err.message);
      results.push({ ...base, status: 'FAILED', reason: err.message });
    }
  }
  return { attempted: results.length, results };
}

// transfer.success / transfer.failed / transfer.reversed webhooks.
export async function applyTransferEvent(event, data) {
  const pickup = await prisma.stallPickup.findUnique({
    where: { transferRef: data?.reference ?? '' },
    select: { id: true, payoutKobo: true, payoutStatus: true, vendorId: true },
  });
  if (!pickup) return 'UNKNOWN_REFERENCE';

  if (event === 'transfer.success') {
    if (data.amount !== pickup.payoutKobo) {
      logger.error({ reference: data.reference, amount: data.amount }, 'Transfer amount mismatch');
      return 'AMOUNT_MISMATCH';
    }
    return (await markPaid(pickup.id, data.reference)) ? 'PAID' : 'ALREADY_PROCESSED';
  }

  if (event === 'transfer.failed') {
    const { count } = await markFailed(pickup.id, data.reference, data.reason || 'Transfer failed');
    return count ? 'FAILED' : 'ALREADY_PROCESSED';
  }

  if (event === 'transfer.reversed') {
    // Money came back to us. If we had counted it as paid, un-count it once.
    // Each status gets its own conditional update, so the balance is only
    // decremented if THIS update is the one that moved it out of PAID.
    return prisma.$transaction(async (tx) => {
      const reversed = { payoutStatus: 'FAILED', payoutFailureReason: 'Transfer reversed by bank', paidAt: null };
      const wasPaid = await tx.stallPickup.updateMany({
        where: { id: pickup.id, transferRef: data.reference, payoutStatus: 'PAID' },
        data: reversed,
      });
      if (wasPaid.count === 1) {
        await tx.vendor.update({ where: { id: pickup.vendorId }, data: { payoutBalanceKobo: { decrement: pickup.payoutKobo } } });
        return 'REVERSED';
      }
      const wasProcessing = await tx.stallPickup.updateMany({
        where: { id: pickup.id, transferRef: data.reference, payoutStatus: 'PROCESSING' },
        data: reversed,
      });
      return wasProcessing.count ? 'REVERSED' : 'ALREADY_PROCESSED';
    });
  }
  return 'IGNORED';
}

// Admin: list payouts, optionally by status.
export async function listPayouts({ status }) {
  const rows = await prisma.stallPickup.findMany({
    where: status ? { payoutStatus: status } : {},
    orderBy: { capturedAt: 'desc' },
    take: 100,
    select: {
      id: true, batchDate: true, batchSlotId: true, capturedAt: true, payoutKobo: true, payoutStatus: true,
      payoutAttempts: true, payoutFailureReason: true, paidAt: true, transferRef: true,
      vendor: { select: { id: true, name: true, stallNumber: true } },
    },
  });
  return rows.map((r) => ({ ...r, batchDate: toDateString(r.batchDate) }));
}
