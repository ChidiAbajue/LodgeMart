import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { parseEnv } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { expireStalePendingOrders } from '../src/services/orderService.js';
import { signParams } from '../src/services/photoService.js';
import { monnify, payOnMonnify, signWebhook } from './fakeMonnify.js';

// Monnify (by Moniepoint): bank-transfer checkout, wallet virtual accounts,
// signed webhooks and instant vendor payouts. Monnify is faked (tests/fakeMonnify.js).
const app = createApp();
const TEST_DOMAIN = '@phase5.test';
const N = 100;
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday' };

let inventorySnapshot, vendorSnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const stock = async (vendorId, productId) =>
  (await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId, productId } } })).stockQty;
const wallet = async (who) => (await prisma.user.findUnique({ where: { id: ids[who] } })).walletBalanceKobo;
const orderRow = (id) => prisma.order.findUnique({ where: { id } });
const transferOrder = (who = 'ada', items = [{ productId: 'sku-rice', qty: 1 }]) =>
  request(app).post('/api/orders').set(as(who)).send({ ...BASE, items, paymentMethod: 'BANK_TRANSFER' });
const vendorBalance = async (id) => (await prisma.vendor.findUnique({ where: { id } })).payoutBalanceKobo;
const transferCalls = () => monnify.calls.filter((c) => c.path === '/api/v2/disbursements/single');

// Send a webhook exactly as Monnify does: raw JSON + monnify-signature.
function webhook(payload, { secret, signature } = {}) {
  const raw = JSON.stringify(payload);
  return request(app).post('/api/payments/monnify/webhook')
    .set('Content-Type', 'application/json')
    .set('monnify-signature', signature ?? signWebhook(raw, secret))
    .send(raw);
}
const paidEvent = (transactionReference) => ({ eventType: 'SUCCESSFUL_TRANSACTION', eventData: { transactionReference } });

async function clearKeys() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}
let payoutDay = 0;
async function makePickup(vendorId, payoutKobo, status = 'PENDING') {
  return prisma.stallPickup.create({
    data: {
      vendorId, riderId: ids.rider, batchSlotId: 'midday', payoutKobo, payoutStatus: status,
      batchDate: new Date(Date.UTC(2024, 0, 1 + payoutDay++)),
      photoUrl: 'https://res.cloudinary.com/lodgemart-test/image/upload/v1/lodgemart/stall-pickups/x.jpg',
    },
  });
}
const pickupRow = (id) => prisma.stallPickup.findUnique({ where: { id } });

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  vendorSnapshot = await prisma.vendor.findMany();
  const passwordHash = await hashPassword('longenough1');
  for (const key of ['ada', 'bayo']) {
    const u = await prisma.user.create({
      data: { name: `Test ${key}`, email: `${key}${TEST_DOMAIN}`, passwordHash, role: 'STUDENT', walletBalanceKobo: 0 },
    });
    tokens[key] = signToken(u);
    ids[key] = u.id;
  }
  for (const [key, email] of [['rider', 'tunde.dispatch@lodgemart.ng'], ['emeka', 'ogaemeka@lodgemart.ng'], ['admin', 'ops@lodgemart.ng']]) {
    const u = await prisma.user.findUnique({ where: { email } });
    tokens[key] = signToken(u);
    ids[key] = u.id;
  }
});

beforeEach(async () => {
  await clearKeys();
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({ where: { id: v.id }, data: { payoutBalanceKobo: v.payoutBalanceKobo, bankCode: v.bankCode } });
  }
  await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2025-01-01T00:00:00Z') } } });
  await prisma.user.updateMany({ where: { id: { in: [ids.ada, ids.bayo] } }, data: { walletBalanceKobo: 0, virtualAccountNumber: null } });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { studentId: { in: [ids.ada, ids.bayo] } }, select: { id: true } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await prisma.walletFunding.deleteMany({ where: { userId: { in: [ids.ada, ids.bayo] } } });
  await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2025-01-01T00:00:00Z') } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({ where: { id: v.id }, data: { payoutBalanceKobo: v.payoutBalanceKobo, bankCode: v.bankCode } });
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ===========================================================================
describe('env safety', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db', REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'x'.repeat(32), CLIENT_URL: 'http://a.com',
  };
  const keys = { MONNIFY_SECRET_KEY: 'secretvalue123', MONNIFY_CONTRACT_CODE: '1234567890' };
  it('refuses LIVE Monnify keys or the live API outside production, without echoing secrets', () => {
    expect(() => parseEnv({ ...base, ...keys, MONNIFY_API_KEY: 'MK_PROD_ABC' })).toThrow(/LIVE Monnify/);
    expect(() => parseEnv({ ...base, ...keys, MONNIFY_API_KEY: 'MK_TEST_ABC', MONNIFY_BASE_URL: 'https://api.monnify.com' })).toThrow(/LIVE Monnify/);
    try { parseEnv({ ...base, ...keys, MONNIFY_API_KEY: 'MK_PROD_ABC' }); } catch (e) { expect(e.message).not.toContain('secretvalue123'); }
    const prod = { ...base, NODE_ENV: 'production', CLIENT_URL: 'https://a.com', JWT_SECRET: 'y'.repeat(48), DATABASE_SSL: 'require', CLOUDINARY_URL: 'cloudinary://k:s@c' };
    expect(parseEnv({ ...prod, ...keys, MONNIFY_API_KEY: 'MK_PROD_ABC', MONNIFY_BASE_URL: 'https://api.monnify.com' }).monnify.baseUrl).toBe('https://api.monnify.com');
    expect(() => parseEnv({ ...prod, ...keys, MONNIFY_API_KEY: 'MK_PROD_ABC' })).toThrow(/MONNIFY_BASE_URL/); // live key, sandbox URL
  });
  it('needs all three credentials together, in the right formats', () => {
    expect(() => parseEnv({ ...base, MONNIFY_API_KEY: 'MK_TEST_ABC' })).toThrow(/together/);
    expect(() => parseEnv({ ...base, ...keys, MONNIFY_API_KEY: 'sk_test_wrongprovider' })).toThrow(/MONNIFY_API_KEY/);
    expect(() => parseEnv({ ...base, CLOUDINARY_URL: 'https://cloudinary.com' })).toThrow(/CLOUDINARY_URL/);
    expect(parseEnv({ ...base }).monnify).toBeNull();
  });
});

// ===========================================================================
describe('Instant Bank Transfer (Monnify checkout)', () => {
  it('holds stock, leaves the wallet alone, hides the PIN, and returns a one-time account for the exact amount', async () => {
    const res = await transferOrder();
    expect(res.status).toBe(201);
    const { order, payment } = res.body;
    expect(order).toMatchObject({ status: 'PENDING_PAYMENT', paymentMethod: 'BANK_TRANSFER' });
    expect(order.pickupPin).toBeUndefined();
    expect(payment).toMatchObject({
      provider: 'MONNIFY', reference: order.paymentRef, accountNumber: '5000123456',
      bankName: 'Moniepoint Microfinance Bank', amountKobo: order.totalKobo,
    });
    expect(new Date(payment.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(await stock('v-emeka', 'sku-rice')).toBe(44);
    expect(await wallet('ada')).toBe(0);

    const init = monnify.calls.find((c) => c.path === '/api/v1/merchant/transactions/init-transaction');
    expect(init.body).toMatchObject({
      amount: order.totalKobo / 100, currencyCode: 'NGN', contractCode: '1234567890',
      paymentReference: order.paymentRef, customerEmail: `ada${TEST_DOMAIN}`, paymentMethods: ['ACCOUNT_TRANSFER'],
    });
    expect(init.auth).toBe('Bearer fake-access-token');
    const login = monnify.calls.find((c) => c.path === '/api/v1/auth/login');
    expect(login.auth).toBe(`Basic ${Buffer.from(`${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`).toString('base64')}`);
  });

  it('if Monnify is down: 502 and the held stock is released immediately', async () => {
    monnify.initFails = true;
    const res = await transferOrder();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('Monnify is down'); // provider details stay in our logs
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
  });

  it('"I have sent the transfer" confirms once Monnify sees the money, then reveals the PIN', async () => {
    const { order } = (await transferOrder()).body;
    const early = await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    expect(early.body.order.status).toBe('PENDING_PAYMENT'); // nothing received yet

    payOnMonnify(order);
    const res = await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ORDER_PLACED');
    expect(res.body.order.pickupPin).toMatch(/^\d{4}$/);
    expect((await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('bayo'))).status).toBe(404);
  });

  it('never marks paid on a short payment', async () => {
    const { order } = (await transferOrder()).body;
    payOnMonnify(order, { amountKobo: order.totalKobo - 100, status: 'PARTIALLY_PAID' });
    await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    payOnMonnify(order, { amountKobo: order.totalKobo - 100, status: 'PAID' });
    await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    expect((await orderRow(order.id)).status).toBe('PENDING_PAYMENT');
  });

  it('unpaid orders are invisible to vendors, and cancelling one is free', async () => {
    const { order } = (await transferOrder()).body;
    const items = await request(app).get('/api/vendor/items').set(as('emeka'));
    expect(items.body.items.some((i) => i.order.id === order.id)).toBe(false);
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(res.body).toMatchObject({ status: 'CANCELLED', refundKobo: 0, cancellationFeeKobo: 0 });
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
  });

  it('unpaid orders expire after the TTL and give their stock back', async () => {
    const old = (await transferOrder()).body.order;
    const fresh = (await transferOrder('bayo', [{ productId: 'sku-garri', qty: 1 }])).body.order;
    await prisma.order.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await expireStalePendingOrders()).toBe(1);
    expect((await orderRow(old.id)).status).toBe('CANCELLED');
    expect((await orderRow(fresh.id)).status).toBe('PENDING_PAYMENT');
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
  });
});

// ===========================================================================
describe('Monnify webhook', () => {
  it('rejects missing, wrong-secret and tampered signatures', async () => {
    const { order } = (await transferOrder()).body;
    const ref = payOnMonnify(order);
    const payload = paidEvent(ref);
    expect((await request(app).post('/api/payments/monnify/webhook').send(payload)).status).toBe(401);
    expect((await webhook(payload, { secret: 'attacker-guess' })).status).toBe(401);
    const sig = signWebhook(JSON.stringify({ ...payload, eventType: 'SOMETHING_ELSE' }));
    expect((await webhook(payload, { signature: sig })).status).toBe(401);
    expect((await orderRow(order.id)).status).toBe('PENDING_PAYMENT');
  });

  it('a valid SUCCESSFUL_TRANSACTION is re-checked with Monnify before marking the order paid', async () => {
    const { order } = (await transferOrder()).body;
    const ref = monnify.byPaymentRef[order.paymentRef];
    // Webhook claims payment, but Monnify's own API says it's still pending → not paid.
    expect((await webhook(paidEvent(ref))).status).toBe(200);
    expect((await orderRow(order.id)).status).toBe('PENDING_PAYMENT');
    payOnMonnify(order);
    await webhook(paidEvent(ref));
    expect((await orderRow(order.id)).status).toBe('ORDER_PLACED');
  });

  it('duplicate / parallel deliveries are applied once', async () => {
    const { order } = (await transferOrder()).body;
    const ref = payOnMonnify(order);
    const results = await Promise.all([1, 2, 3].map(() => webhook(paidEvent(ref))));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await orderRow(order.id)).status).toBe('ORDER_PLACED');
  });

  it('payment arriving after cancellation is refunded to the wallet in full, once', async () => {
    const { order } = (await transferOrder()).body;
    await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    const ref = payOnMonnify(order);
    await Promise.all([webhook(paidEvent(ref)), webhook(paidEvent(ref))]);
    expect(await wallet('ada')).toBe(order.totalKobo);
    expect(await orderRow(order.id)).toMatchObject({ status: 'CANCELLED', refundKobo: order.totalKobo });
  });

  it('cancel racing a payment never leaves the student out of pocket', async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.user.update({ where: { id: ids.ada }, data: { walletBalanceKobo: 0 } });
      const { order } = (await transferOrder()).body;
      const ref = payOnMonnify(order);
      const [cancel] = await Promise.all([
        request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada')),
        webhook(paidEvent(ref)),
      ]);
      const row = await orderRow(order.id);
      const w = await wallet('ada');
      if (row.status === 'CANCELLED') {
        expect([order.totalKobo, order.totalKobo - 200 * N]).toContain(w);
      } else {
        expect(row.status).toBe('ORDER_PLACED');
        expect(cancel.status).toBe(409);
        expect(w).toBe(0);
      }
    }
  });

  it('acknowledges unknown references and event types without changing anything', async () => {
    expect((await webhook({ eventType: 'SETTLEMENT', eventData: {} })).status).toBe(200);
    expect((await webhook({ eventType: 'MANDATE_UPDATE' })).status).toBe(200);
  });
});

// ===========================================================================
describe('LodgeMart Wallet (Monnify virtual account)', () => {
  it('creates the student\'s Moniepoint account once, with BVN or NIN that is never stored', async () => {
    expect((await request(app).get('/api/wallet').set(as('ada'))).body.virtualAccount).toBeNull();
    for (const bad of [{}, { bvn: '123' }, { bvn: '12345678901', nin: '12345678901' }]) {
      expect((await request(app).post('/api/wallet/virtual-account').set(as('ada')).send(bad)).status).toBe(400);
    }
    const res = await request(app).post('/api/wallet/virtual-account').set(as('ada')).send({ bvn: '22212345678' });
    expect(res.status).toBe(201);
    expect(res.body.virtualAccount).toEqual({ accountNumber: '8012345678', accountName: expect.any(String), bankName: 'Moniepoint Microfinance Bank' });
    const call = monnify.calls.find((c) => c.path === '/api/v2/bank-transfer/reserved-accounts');
    expect(call.body).toMatchObject({ accountReference: `lm-wallet-${ids.ada}`, bvn: '22212345678', preferredBanks: ['50515'], contractCode: '1234567890' });
    const row = await prisma.user.findUnique({ where: { id: ids.ada } });
    expect(JSON.stringify(row)).not.toContain('22212345678');

    await request(app).post('/api/wallet/virtual-account').set(as('ada')).send({ nin: '11122233344' });
    expect(monnify.calls.filter((c) => c.path === '/api/v2/bank-transfer/reserved-accounts')).toHaveLength(1); // only once
    expect((await request(app).get('/api/wallet').set(as('emeka'))).status).toBe(403); // students only
  });

  it('money sent to the virtual account is credited to the wallet exactly once', async () => {
    monnify.transactions['MNFY|RA|1'] = {
      transactionReference: 'MNFY|RA|1', paymentReference: 'MNFY|RA|1', paymentStatus: 'PAID', amountPaid: '5000.00', currency: 'NGN',
      product: { type: 'RESERVED_ACCOUNT', reference: `lm-wallet-${ids.ada}` },
    };
    await Promise.all([webhook(paidEvent('MNFY|RA|1')), webhook(paidEvent('MNFY|RA|1'))]);
    expect(await wallet('ada')).toBe(5000 * N);
    const res = await request(app).get('/api/wallet').set(as('ada'));
    expect(res.body).toMatchObject({ balanceKobo: 5000 * N, fundingAvailable: true });
    expect(res.body.recentFundings[0].amountKobo).toBe(5000 * N);
  });

  it('ignores funding for unknown accounts or unpaid transactions', async () => {
    monnify.transactions['MNFY|RA|2'] = {
      transactionReference: 'MNFY|RA|2', paymentStatus: 'PAID', amountPaid: '100.00', currency: 'NGN',
      product: { type: 'RESERVED_ACCOUNT', reference: 'lm-wallet-not-a-user' },
    };
    monnify.transactions['MNFY|RA|3'] = {
      transactionReference: 'MNFY|RA|3', paymentStatus: 'PENDING', amountPaid: '0', currency: 'NGN',
      product: { type: 'RESERVED_ACCOUNT', reference: `lm-wallet-${ids.ada}` },
    };
    await webhook(paidEvent('MNFY|RA|2'));
    await webhook(paidEvent('MNFY|RA|3'));
    expect(await wallet('ada')).toBe(0);
  });
});

// ===========================================================================
describe('vendor payouts (Monnify disbursements)', () => {
  const run = () => request(app).post('/api/admin/payouts/run').set(as('admin'));

  it('admin only', async () => {
    for (const who of ['ada', 'emeka', 'rider']) {
      expect((await request(app).post('/api/admin/payouts/run').set(as(who))).status).toBe(403);
    }
  });

  it('sends 100% of each pending payout from our wallet and credits the vendor once', async () => {
    const p1 = await makePickup('v-emeka', 7150 * N);
    const before = await vendorBalance('v-emeka');
    const res = await run();
    expect(res.body.results[0]).toMatchObject({ stallPickupId: p1.id, status: 'PAID' });
    expect(await vendorBalance('v-emeka')).toBe(before + 7150 * N);
    expect(transferCalls()[0].body).toMatchObject({
      amount: 7150, currency: 'NGN', destinationBankCode: '058', destinationAccountNumber: '0123456789',
      sourceAccountNumber: '9999999999',
    });
    expect(transferCalls()[0].body.reference).toMatch(/^lm-payout-[0-9a-f-]{36}$/);
    expect((await run()).body.attempted).toBe(0);
    expect(await vendorBalance('v-emeka')).toBe(before + 7150 * N);
  });

  it('an unclear outcome (timeout) is re-checked, NEVER re-sent', async () => {
    monnify.transferMode = 'timeout';
    const p = await makePickup('v-emeka', 500 * N);
    expect((await run()).body.results[0]).toMatchObject({ status: 'PROCESSING', reason: 'OUTCOME_UNKNOWN' });
    const { transferRef } = await pickupRow(p.id);

    // Monnify actually did send it. The next run asks, rather than sending again.
    monnify.transfers[transferRef] = 'SUCCESS';
    monnify.transferMode = 'SUCCESS';
    const res = await run();
    expect(res.body.results[0]).toMatchObject({ status: 'PAID', recheck: true });
    expect(transferCalls()).toHaveLength(1); // only the original attempt
  });

  it('awaiting OTP approval stays PROCESSING; the SUCCESSFUL_DISBURSEMENT webhook completes it once', async () => {
    monnify.transferMode = 'PENDING_AUTHORIZATION';
    const p = await makePickup('v-emeka', 300 * N);
    const before = await vendorBalance('v-emeka');
    expect((await run()).body.results[0].status).toBe('PROCESSING');
    const row = await pickupRow(p.id);
    expect(row.payoutFailureReason).toMatch(/OTP/);

    monnify.transfers[row.transferRef] = 'SUCCESS';
    const evt = { eventType: 'SUCCESSFUL_DISBURSEMENT', eventData: { reference: row.transferRef, amount: 300 } };
    await Promise.all([webhook(evt), webhook(evt)]);
    expect((await pickupRow(p.id)).payoutStatus).toBe('PAID');
    expect(await vendorBalance('v-emeka')).toBe(before + 300 * N);
  });

  it('a definite failure is retried with a NEW reference; a reversal un-credits once', async () => {
    monnify.transferMode = 'error';
    const p = await makePickup('v-emeka', 200 * N);
    expect((await run()).body.results[0]).toMatchObject({ status: 'FAILED', reason: 'Insufficient balance' });
    const first = (await pickupRow(p.id)).transferRef;

    monnify.transferMode = 'SUCCESS';
    const before = await vendorBalance('v-emeka');
    await run();
    const row = await pickupRow(p.id);
    expect(row).toMatchObject({ payoutStatus: 'PAID', payoutAttempts: 2 });
    expect(row.transferRef).not.toBe(first);

    monnify.transfers[row.transferRef] = 'REVERSED';
    const evt = { eventType: 'REVERSED_DISBURSEMENT', eventData: { reference: row.transferRef } };
    await webhook(evt);
    await webhook(evt);
    expect((await pickupRow(p.id)).payoutStatus).toBe('FAILED');
    expect(await vendorBalance('v-emeka')).toBe(before);
  });

  it('a forged disbursement webhook is ignored if Monnify says otherwise', async () => {
    monnify.transferMode = 'PENDING';
    const p = await makePickup('v-emeka', 100 * N);
    await run();
    const { transferRef } = await pickupRow(p.id);
    await webhook({ eventType: 'SUCCESSFUL_DISBURSEMENT', eventData: { reference: transferRef, amount: 100 } });
    expect((await pickupRow(p.id)).payoutStatus).toBe('PROCESSING'); // Monnify still says PENDING
  });

  it('vendors without bank details are skipped and flagged; concurrent runs pay once', async () => {
    await prisma.vendor.update({ where: { id: 'v-ngozi' }, data: { bankCode: null } });
    const n = await makePickup('v-ngozi', 100 * N);
    const pickups = await Promise.all([1, 2, 3].map(() => makePickup('v-emeka', 100 * N)));
    await Promise.all([run(), run(), run()]);
    expect((await pickupRow(n.id))).toMatchObject({ payoutStatus: 'PENDING', payoutFailureReason: 'Vendor has no bank details on file' });
    expect(transferCalls()).toHaveLength(3);
    for (const p of pickups) expect((await pickupRow(p.id)).payoutStatus).toBe('PAID');
  });
});

// ===========================================================================
describe('stall photo uploads (Cloudinary)', () => {
  it('rider gets a signed upload permission; the API secret is never sent', async () => {
    const res = await request(app).get('/api/rider/photo-upload-signature').set(as('rider'));
    expect(res.status).toBe(200);
    const { signature, api_key: apiKey, ...params } = res.body.fields;
    expect(apiKey).toBe('111111111111111');
    expect(signature).toBe(signParams(params, 'fake_test_secret'));
    expect(JSON.stringify(res.body)).not.toContain('fake_test_secret');
  });

  it('stall pickups only accept photos from our Cloudinary folder', async () => {
    const res = await request(app).post('/api/rider/stall-pickups').set(as('rider'))
      .send({ vendorId: 'v-emeka', batchDate: '2024-06-01', batchSlotId: 'midday', photoUrl: 'https://evil.example.com/lodgemart/stall-pickups/a.jpg' });
    expect(res.body.error.code).toBe('INVALID_PHOTO');
  });
});
