import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Thin wrapper around the Paystack REST API. The secret key only ever lives
// here, on the server; nothing in this file's responses is sent to clients raw.

export const paystackEnabled = () => env.PAYSTACK_SECRET_KEY !== '';

export class PaystackError extends Error {}

function requireEnabled() {
  if (!paystackEnabled()) {
    throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Card payments are not available right now');
  }
}

async function call(method, path, body) {
  requireEnabled();
  let res;
  try {
    res = await fetch(`${env.PAYSTACK_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.error({ path, err: err.message }, 'Paystack request failed');
    throw new PaystackError('Could not reach Paystack');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status !== true) {
    // Log Paystack's message for us; callers decide what the client sees.
    logger.warn({ path, httpStatus: res.status, message: json.message }, 'Paystack rejected request');
    throw new PaystackError(json.message || `Paystack error ${res.status}`);
  }
  return json.data;
}

// Start a card payment. Returns { authorization_url, access_code, reference }.
export const initializeTransaction = ({ email, amountKobo, reference, metadata }) =>
  call('POST', '/transaction/initialize', {
    email,
    amount: amountKobo,
    currency: 'NGN',
    reference,
    ...(env.PAYSTACK_CALLBACK_URL && { callback_url: env.PAYSTACK_CALLBACK_URL }),
    metadata,
  });

// Ask Paystack directly what happened to a payment. Returns { status, amount, currency, reference, ... }.
export const verifyTransaction = (reference) =>
  call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);

// Bank account → reusable recipient code for transfers.
export const createTransferRecipient = ({ name, accountNumber, bankCode }) =>
  call('POST', '/transferrecipient', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });

// Send money from our Paystack balance. The reference makes it idempotent on
// Paystack's side: re-sending the same reference never pays twice.
export const initiateTransfer = ({ amountKobo, recipientCode, reference, reason }) =>
  call('POST', '/transfer', {
    source: 'balance',
    amount: amountKobo,
    recipient: recipientCode,
    reference,
    reason,
    currency: 'NGN',
  });

// Webhook authenticity: Paystack signs the raw request body with HMAC-SHA512
// using our secret key, in the x-paystack-signature header.
export function isValidWebhookSignature(rawBody, signature) {
  if (!paystackEnabled() || !rawBody || typeof signature !== 'string') return false;
  const expected = createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
