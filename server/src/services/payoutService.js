import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { toDateString } from '../utils/batchDate.js';
import * as monnify from './monnifyClient.js';

// Vendor payouts — 100%, zero holdback, sent via Monnify as soon as the rider
// confirms the stall pickup (one StallPickup per vendor per batch).
//
//   PENDING / FAILED --claim--> PROCESSING --SUCCESS---------------------> PAID (+ vendor.payoutBalanceKobo)
//                                         --definite failure-------------> FAILED (admin may retry)
//                                         --unclear (timeout, PENDING,
//                                           awaiting OTP, requery)-------> stays PROCESSING, re-checked
//                                                                           by status query / webhook
//
// Double-payment guards: the claim is a conditional update (two triggers can't
// both claim a pickup); a NEW reference is used only after a DEFINITE failure;
// an unclear outcome is re-queried, never re-sent.

const newTransferRef = () => `lm-payout-${randomUUID()}`;
const SUCCESS = ['SUCCESS', 'COMPLETED'];
const DEFINITELY_FAILED = ['FAILED', 'REVERSED', 'EXPIRED'];

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

const noteWaiting = (stallPickupId, transferRef, reason) =>
  prisma.stallPickup.updateMany({
    where: { id: stallPickupId, transferRef, payoutStatus: 'PROCESSING' },
    data: { payoutFailureReason: reason },
  });

// Act on a Monnify transfer status (from initiate, status query or webhook).
async function settle(pickupId, transferRef, status, reason) {
  if (SUCCESS.includes(status)) {
    await markPaid(pickupId, transferRef);
    return 'PAID';
  }
  if (DEFINITELY_FAILED.includes(status)) {
    await markFailed(pickupId, transferRef, reason || `Transfer ${status.toLowerCase()}`);
    return 'FAILED';
  }
  if (status === 'PENDING_AUTHORIZATION' || status === 'OTP_EMAIL_DISPATCH_FAILED') {
    await noteWaiting(pickupId, transferRef, 'Waiting for OTP approval in the Monnify dashboard (or disable transfer 2FA)');
  }
  return 'PROCESSING';
}

// Send one pickup's payout. Safe to call more than once: only a PENDING or
// FAILED pickup can be claimed.
export async function payPickup(stallPickupId) {
  const p = await prisma.stallPickup.findUnique({
    where: { id: stallPickupId },
    select: {
      id: true, payoutKobo: true, payoutStatus: true, batchDate: true, batchSlotId: true,
      vendor: { select: { id: true, name: true, bankCode: true, bankAccountNumber: true } },
    },
  });
  if (!p || !['PENDING', 'FAILED'].includes(p.payoutStatus) || p.payoutKobo <= 0) {
    return { stallPickupId, status: p?.payoutStatus ?? 'NOT_FOUND' };
  }
  const base = { stallPickupId: p.id, vendorId: p.vendor.id, amountKobo: p.payoutKobo };

  if (!p.vendor.bankCode || !p.vendor.bankAccountNumber) {
    await prisma.stallPickup.update({ where: { id: p.id }, data: { payoutFailureReason: 'Vendor has no bank details on file' } });
    return { ...base, status: p.payoutStatus, reason: 'Vendor has no bank details on file' };
  }

  const transferRef = newTransferRef();
  const claimed = await prisma.stallPickup.updateMany({
    where: { id: p.id, payoutStatus: p.payoutStatus },
    data: { payoutStatus: 'PROCESSING', transferRef, payoutAttempts: { increment: 1 }, payoutFailureReason: null },
  });
  if (claimed.count === 0) return { ...base, status: 'PROCESSING' }; // someone else got it

  try {
    const t = await monnify.singleTransfer({
      amountKobo: p.payoutKobo,
      reference: transferRef,
      narration: `LodgeMart payout ${p.batchSlotId} ${toDateString(p.batchDate)}`,
      bankCode: p.vendor.bankCode,
      accountNumber: p.vendor.bankAccountNumber,
    });
    const status = await settle(p.id, transferRef, t.status, t.comment);
    return { ...base, status, ...(status !== 'PAID' && t.status !== 'SUCCESS' && { providerStatus: t.status }) };
  } catch (err) {
    if (err instanceof monnify.MonnifyError && !err.definite) {
      // We don't know whether Monnify sent it. Leave it PROCESSING and re-check later.
      await noteWaiting(p.id, transferRef, 'Outcome unknown, will re-check with Monnify');
      logger.warn({ stallPickupId: p.id, err: err.message }, 'Payout outcome unknown');
      return { ...base, status: 'PROCESSING', reason: 'OUTCOME_UNKNOWN' };
    }
    logger.warn({ stallPickupId: p.id, err: err.message }, 'Payout failed');
    await markFailed(p.id, transferRef, err.message);
    return { ...base, status: 'FAILED', reason: err.message };
  }
}

// Re-check transfers still PROCESSING (unclear outcome, awaiting OTP, missed webhook).
async function reconcileProcessing() {
  const rows = await prisma.stallPickup.findMany({
    where: { payoutStatus: 'PROCESSING', transferRef: { not: null } },
    select: { id: true, transferRef: true, vendorId: true, payoutKobo: true },
    take: 100,
  });
  const results = [];
  for (const r of rows) {
    try {
      const t = await monnify.getTransferStatus(r.transferRef);
      const status = await settle(r.id, r.transferRef, t.status, t.transactionDescription);
      results.push({ stallPickupId: r.id, vendorId: r.vendorId, amountKobo: r.payoutKobo, status, recheck: true });
    } catch (err) {
      results.push({ stallPickupId: r.id, vendorId: r.vendorId, amountKobo: r.payoutKobo, status: 'PROCESSING', recheck: true, reason: err.message });
    }
  }
  return results;
}

// Admin: re-check in-flight transfers, then send everything still pending or failed.
export async function runPayouts() {
  if (!monnify.monnifyEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Monnify is not configured, so payouts cannot be sent');
  }
  const rechecked = await reconcileProcessing();
  const due = await prisma.stallPickup.findMany({
    where: { payoutStatus: { in: ['PENDING', 'FAILED'] }, payoutKobo: { gt: 0 } },
    orderBy: { capturedAt: 'asc' },
    take: 100,
    select: { id: true },
  });
  const sent = [];
  for (const { id } of due) sent.push(await payPickup(id));
  const results = [...rechecked, ...sent];
  return { attempted: results.length, results };
}

// SUCCESSFUL_DISBURSEMENT / FAILED_DISBURSEMENT / REVERSED_DISBURSEMENT webhooks
// (re-checked with Monnify by the caller before arriving here).
export async function applyTransferEvent(eventType, data) {
  const pickup = await prisma.stallPickup.findUnique({
    where: { transferRef: data?.reference ?? '' },
    select: { id: true, payoutKobo: true, vendorId: true },
  });
  if (!pickup) return 'UNKNOWN_REFERENCE';

  if (eventType === 'SUCCESSFUL_DISBURSEMENT') {
    if (monnify.toKobo(data.amount) !== pickup.payoutKobo) {
      logger.error({ reference: data.reference, amount: data.amount }, 'Transfer amount mismatch');
      return 'AMOUNT_MISMATCH';
    }
    return (await markPaid(pickup.id, data.reference)) ? 'PAID' : 'ALREADY_PROCESSED';
  }

  if (eventType === 'FAILED_DISBURSEMENT') {
    const { count } = await markFailed(pickup.id, data.reference, data.transactionDescription || 'Transfer failed');
    return count ? 'FAILED' : 'ALREADY_PROCESSED';
  }

  if (eventType === 'REVERSED_DISBURSEMENT') {
    // Money came back to us. If we had counted it as paid, un-count it once.
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
