import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Thin wrapper around the Monnify (by Moniepoint) REST API. Credentials only
// ever live here, on the server. Monnify amounts are NAIRA (decimals); this
// file converts to/from our integer kobo at the boundary.
// Field names follow Monnify's docs (auth, init-transaction, bank-transfer
// init-payment, v2 transactions, v2 reserved accounts, v2 single disbursements).

export const monnifyEnabled = () => env.monnify !== null;

export class MonnifyError extends Error {
  constructor(message, { definite = true, code } = {}) {
    super(message);
    this.definite = definite; // false = we don't know if Monnify acted (timeout, 5xx, code 99)
    this.code = code;
  }
}

export const toNaira = (kobo) => Number((kobo / 100).toFixed(2));
export const toKobo = (naira) => Math.round(Number(naira) * 100);

function requireEnabled() {
  if (!monnifyEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Bank payments are not available right now');
  }
}

// Access token: POST /api/v1/auth/login with Basic base64(apiKey:secretKey).
// Valid ~1 hour; cached and renewed a minute early.
let token = null;
async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const { apiKey, secretKey, baseUrl } = env.monnify;
  const basic = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
  const res = await fetchJson(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  const body = res.json?.responseBody;
  if (!res.ok || res.json?.requestSuccessful !== true || !body?.accessToken) {
    throw new MonnifyError('Monnify login failed (check API key / secret)');
  }
  token = { value: body.accessToken, expiresAt: Date.now() + (body.expiresIn ?? 3600) * 1000 };
  return token.value;
}
export function resetMonnifyToken() {
  token = null;
}

async function fetchJson(url, init) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    logger.error({ url: new URL(url).pathname, err: err.message }, 'Monnify request failed');
    throw new MonnifyError('Could not reach Monnify', { definite: false });
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function call(method, path, body, { retried = false } = {}) {
  requireEnabled();
  const res = await fetchJson(`${env.monnify.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried) {
    token = null;
    return call(method, path, body, { retried: true });
  }
  if (res.ok && res.json?.requestSuccessful === true) return res.json.responseBody;

  const code = res.json?.responseCode;
  const message = res.json?.responseMessage || `Monnify error ${res.status}`;
  logger.warn({ path, httpStatus: res.status, code, message }, 'Monnify rejected request');
  // 5xx or code 99 ("requery") mean the outcome is unknown, not failed.
  throw new MonnifyError(message, { definite: !(res.status >= 500 || code === '99'), code });
}

// --- Collections -------------------------------------------------------------

// One-time checkout for an order. Returns { transactionReference, checkoutUrl, ... }.
export const initTransaction = ({ amountKobo, customerName, customerEmail, paymentReference, description }) =>
  call('POST', '/api/v1/merchant/transactions/init-transaction', {
    amount: toNaira(amountKobo),
    customerName,
    customerEmail,
    paymentReference,
    paymentDescription: description,
    currencyCode: 'NGN',
    contractCode: env.monnify.contractCode,
    ...(env.monnify.redirectUrl && { redirectUrl: env.monnify.redirectUrl }),
    paymentMethods: ['ACCOUNT_TRANSFER'],
  });

// One-time virtual account for that checkout. Returns { accountNumber, accountName,
// bankName, bankCode, accountDurationSeconds, amount, fee, totalPayable, ... }.
export const initBankTransfer = (transactionReference) =>
  call('POST', '/api/v1/merchant/bank-transfer/init-payment', { transactionReference });

// Ask Monnify what happened. Returns { paymentStatus, amountPaid, totalPayable,
// currency, paymentReference, transactionReference, product, ... }.
export const getTransaction = (transactionReference) =>
  call('GET', `/api/v2/transactions/${encodeURIComponent(transactionReference)}`);

// Student's permanent virtual account (wallet funding). BVN or NIN is passed
// straight through to Monnify and never stored by us.
export const reserveAccount = ({ accountReference, accountName, customerEmail, customerName, bvn, nin }) =>
  call('POST', '/api/v2/bank-transfer/reserved-accounts', {
    accountReference,
    accountName,
    currencyCode: 'NGN',
    contractCode: env.monnify.contractCode,
    customerEmail,
    customerName,
    ...(bvn && { bvn }),
    ...(nin && { nin }),
    getAllAvailableBanks: false,
    preferredBanks: ['50515'], // Moniepoint Microfinance Bank
  });

// --- Disbursements (vendor payouts) -----------------------------------------

// Returns { status: SUCCESS | PENDING | IN_PROGRESS | PENDING_AUTHORIZATION | FAILED | ..., reference, ... }
export function singleTransfer({ amountKobo, reference, narration, bankCode, accountNumber }) {
  if (!env.monnify?.walletAccountNumber) {
    throw new MonnifyError('MONNIFY_WALLET_ACCOUNT_NUMBER is not set, so payouts cannot be sent');
  }
  return call('POST', '/api/v2/disbursements/single', {
    amount: toNaira(amountKobo),
    reference,
    narration,
    destinationBankCode: bankCode,
    destinationAccountNumber: accountNumber,
    currency: 'NGN',
    sourceAccountNumber: env.monnify.walletAccountNumber,
  });
}

export const getTransferStatus = (reference) =>
  call('GET', `/api/v2/disbursements/single/summary?reference=${encodeURIComponent(reference)}`);

// --- Webhooks -----------------------------------------------------------------

// Monnify signs the raw request body: header `monnify-signature` =
// hex HMAC-SHA512(body, client secret key).
export function isValidWebhookSignature(rawBody, signature) {
  if (!monnifyEnabled() || !rawBody || typeof signature !== 'string') return false;
  const expected = createHmac('sha512', env.monnify.secretKey).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
