import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as monnify from './monnifyClient.js';

// LodgeMart Wallet, backed by the student's own Monnify (Moniepoint) virtual
// account: money transferred into that account is credited to the wallet.

const accountReference = (userId) => `lm-wallet-${userId}`;

export async function getWallet(user) {
  const [row, fundings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalanceKobo: true, virtualAccountNumber: true, virtualAccountName: true, virtualAccountBank: true },
    }),
    prisma.walletFunding.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { amountKobo: true, createdAt: true },
    }),
  ]);
  return {
    balanceKobo: row.walletBalanceKobo,
    virtualAccount: row.virtualAccountNumber
      ? { accountNumber: row.virtualAccountNumber, accountName: row.virtualAccountName, bankName: row.virtualAccountBank }
      : null,
    fundingAvailable: monnify.monnifyEnabled(),
    recentFundings: fundings,
  };
}

// Create the student's permanent virtual account (once). Monnify requires a BVN
// or NIN; we pass it straight through and never store or log it.
export async function createVirtualAccount(user, { bvn, nin }) {
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { virtualAccountNumber: true } });
  if (existing.virtualAccountNumber) return getWallet(user);
  if (!monnify.monnifyEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Wallet funding is not available right now');
  }

  let res;
  try {
    res = await monnify.reserveAccount({
      accountReference: accountReference(user.id),
      accountName: `LodgeMart ${user.name}`.slice(0, 60),
      customerEmail: user.email,
      customerName: user.name,
      bvn,
      nin,
    });
  } catch (err) {
    if (err instanceof monnify.MonnifyError) {
      throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not create your wallet account, please check your details and try again');
    }
    throw err;
  }
  const account = res.accounts?.[0];
  if (!account?.accountNumber) {
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Could not create your wallet account, please try again');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { virtualAccountNumber: account.accountNumber, virtualAccountName: account.accountName, virtualAccountBank: account.bankName },
  });
  return getWallet(user);
}

// A transfer into a student's virtual account (SUCCESSFUL_TRANSACTION with
// product.type RESERVED_ACCOUNT, re-checked with Monnify by the caller).
// Credits amountPaid once per Monnify transactionReference.
export async function applyWalletFunding(tx) {
  if (!['PAID', 'OVERPAID'].includes(tx.paymentStatus) || (tx.currency ?? 'NGN') !== 'NGN') return 'NOT_PAID';
  const ref = tx.product?.reference ?? '';
  if (!ref.startsWith('lm-wallet-')) return 'UNKNOWN_REFERENCE';
  const userId = ref.slice('lm-wallet-'.length);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return 'UNKNOWN_REFERENCE';
  const amountKobo = monnify.toKobo(tx.amountPaid);
  if (!(amountKobo > 0)) return 'NOT_PAID';

  try {
    await prisma.$transaction([
      prisma.walletFunding.create({ data: { userId, amountKobo, transactionReference: tx.transactionReference } }),
      prisma.user.update({ where: { id: userId }, data: { walletBalanceKobo: { increment: amountKobo } } }),
    ]);
    return 'CREDITED';
  } catch (err) {
    if (err?.code === 'P2002') return 'ALREADY_PROCESSED'; // same transaction seen before
    logger.error({ err: err.message }, 'Wallet funding failed');
    throw err;
  }
}
