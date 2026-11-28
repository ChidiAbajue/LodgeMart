import { createHmac } from 'node:crypto';
import { vi } from 'vitest';
import { resetMonnifyToken } from '../src/services/monnifyClient.js';

// A fake Monnify API for tests. Installed for every test file (tests/setup.js),
// so tests NEVER reach the network. Field names follow Monnify's docs.
export const monnify = {
  calls: [],
  initFails: false,
  transferMode: 'SUCCESS', // SUCCESS | PENDING | PENDING_AUTHORIZATION | FAILED | error | timeout
  transactions: {}, // transactionReference -> Monnify transaction (what GET /v2/transactions returns)
  transfers: {}, // our reference -> current transfer status
  byPaymentRef: {}, // paymentReference -> transactionReference
  reset() {
    this.calls = [];
    this.initFails = false;
    this.transferMode = 'SUCCESS';
    this.transactions = {};
    this.transfers = {};
    this.byPaymentRef = {};
    resetMonnifyToken();
  },
};

let seq = 0;
const ok = (responseBody) => json(200, { requestSuccessful: true, responseMessage: 'success', responseCode: '0', responseBody });
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const fakeFetch = vi.fn(async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname !== 'monnify.mock.local') throw new TypeError(`Network disabled in tests: ${u.hostname}`);
  const path = u.pathname;
  const body = opts.body ? JSON.parse(opts.body) : undefined;
  monnify.calls.push({ path, body, auth: opts.headers?.Authorization, query: Object.fromEntries(u.searchParams) });

  if (path === '/api/v1/auth/login') return ok({ accessToken: 'fake-access-token', expiresIn: 3599 });

  if (path === '/api/v1/merchant/transactions/init-transaction') {
    if (monnify.initFails) return json(500, { requestSuccessful: false, responseMessage: 'Monnify is down' });
    const transactionReference = `MNFY|TEST|${++seq}`;
    monnify.byPaymentRef[body.paymentReference] = transactionReference;
    monnify.transactions[transactionReference] = {
      transactionReference, paymentReference: body.paymentReference, paymentStatus: 'PENDING',
      amountPaid: '0.00', totalPayable: String(body.amount), currency: 'NGN', product: { type: 'API_NOTIFICATION', reference: body.paymentReference },
    };
    return ok({ transactionReference, paymentReference: body.paymentReference, checkoutUrl: `https://sandbox.sdk.monnify.com/checkout/${seq}` });
  }

  if (path === '/api/v1/merchant/bank-transfer/init-payment') {
    const tx = monnify.transactions[body.transactionReference];
    return ok({
      accountNumber: '5000123456', accountName: 'LodgeMart Checkout', bankName: 'Moniepoint Microfinance Bank', bankCode: '50515',
      accountDurationSeconds: 2400, transactionReference: body.transactionReference, amount: Number(tx.totalPayable), fee: 0,
      totalPayable: Number(tx.totalPayable),
    });
  }

  if (path.startsWith('/api/v2/transactions/')) {
    const ref = decodeURIComponent(path.slice('/api/v2/transactions/'.length));
    const tx = monnify.transactions[ref];
    return tx ? ok(tx) : json(404, { requestSuccessful: false, responseMessage: 'Transaction not found' });
  }

  if (path === '/api/v2/bank-transfer/reserved-accounts') {
    return ok({
      accountReference: body.accountReference, accountName: body.accountName, currencyCode: 'NGN',
      accounts: [{ bankCode: '50515', bankName: 'Moniepoint Microfinance Bank', accountNumber: '8012345678', accountName: body.accountName }],
      status: 'ACTIVE',
    });
  }

  if (path === '/api/v2/disbursements/single') {
    if (monnify.transferMode === 'timeout') throw new TypeError('fetch failed (timeout)');
    if (monnify.transferMode === 'error') {
      return json(400, { requestSuccessful: false, responseCode: 'D02', responseMessage: 'Insufficient balance' });
    }
    monnify.transfers[body.reference] = monnify.transferMode;
    return ok({ amount: body.amount, reference: body.reference, status: monnify.transferMode });
  }

  if (path === '/api/v2/disbursements/single/summary') {
    const reference = u.searchParams.get('reference');
    const status = monnify.transfers[reference];
    return status ? ok({ reference, status }) : json(404, { requestSuccessful: false, responseMessage: 'Transfer not found' });
  }

  return json(404, { requestSuccessful: false, responseMessage: `unknown ${path}` });
});

// Mark a checkout as paid on "Monnify's side" (what the student's transfer does).
export function payOnMonnify(order, { amountKobo = order.totalKobo, status = 'PAID' } = {}) {
  const ref = monnify.byPaymentRef[order.paymentRef];
  Object.assign(monnify.transactions[ref], { paymentStatus: status, amountPaid: (amountKobo / 100).toFixed(2) });
  return ref;
}

// Sign a webhook body exactly as Monnify does.
export function signWebhook(raw, secret = process.env.MONNIFY_SECRET_KEY) {
  return createHmac('sha512', secret).update(raw).digest('hex');
}
