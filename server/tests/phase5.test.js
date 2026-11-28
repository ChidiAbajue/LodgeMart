import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { parseEnv } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { expireStalePendingOrders } from '../src/services/orderService.js';
import { signParams } from '../src/services/photoService.js';

const app = createApp();
const TEST_DOMAIN = '@phase5.test';
const N = 100;
const SECRET = process.env.PAYSTACK_SECRET_KEY; // fake key from .env.test
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday' };

// ---------------------------------------------------------------------------
// Fake Paystack: every call the server makes to Paystack lands here.
const paystack = {
  calls: [],
  initFails: false,
  verify: {}, // reference -> transaction data
  transferStatus: 'success', // 'success' | 'pending' | 'otp' | 'error'
};
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const fakeFetch = vi.fn(async (url, opts = {}) => {
  const path = new URL(url).pathname;
  const body = opts.body ? JSON.parse(opts.body) : undefined;
  paystack.calls.push({ path, body, auth: opts.headers?.Authorization });
  if (path === '/transaction/initialize') {
    if (paystack.initFails) return json(500, { status: false, message: 'Paystack is down' });
    return json(200, { status: true, data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, reference: body.reference } });
  }
  if (path.startsWith('/transaction/verify/')) {
    const ref = decodeURIComponent(path.split('/').pop());
    return json(200, { status: true, data: paystack.verify[ref] ?? { reference: ref, status: 'abandoned' } });
  }
  if (path === '/transferrecipient') {
    return json(200, { status: true, data: { recipient_code: `RCP_${body.bank_code}_${body.account_number}` } });
  }
  if (path === '/transfer') {
    if (paystack.transferStatus === 'error') return json(400, { status: false, message: 'Insufficient balance' });
    return json(200, { status: true, data: { status: paystack.transferStatus, reference: body.reference } });
  }
  return json(404, { status: false, message: 'unknown' });
});
const transferCalls = () => paystack.calls.filter((c) => c.path === '/transfer');

// Send a webhook exactly as Paystack would: raw JSON body + HMAC-SHA512 signature.
function webhook(payload, { secret = SECRET, signature } = {}) {
  const raw = JSON.stringify(payload);
  const sig = signature ?? createHmac('sha512', secret).update(raw).digest('hex');
  return request(app).post('/api/payments/paystack/webhook')
    .set('Content-Type', 'application/json').set('x-paystack-signature', sig).send(raw);
}
const chargeSuccess = (order, overrides = {}) =>
  webhook({ event: 'charge.success', data: { reference: order.paymentRef, status: 'success', amount: order.totalKobo, currency: 'NGN', ...overrides } });

// ---------------------------------------------------------------------------
let inventorySnapshot, vendorSnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const stock = async (vendorId, productId) =>
  (await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId, productId } } })).stockQty;
const wallet = async (who) => (await prisma.user.findUnique({ where: { id: ids[who] } })).walletBalanceKobo;
const orderRow = (id) => prisma.order.findUnique({ where: { id } });
const cardOrder = (who = 'ada', items = [{ productId: 'sku-rice', qty: 1 }]) =>
  request(app).post('/api/orders').set(as(who)).send({ ...BASE, items, paymentMethod: 'PAYSTACK' });

async function clearKeys() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}
// Pickups for payout tests live in 2024 so they never mix with real batches.
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
const vendorBalance = async (id) => (await prisma.vendor.findUnique({ where: { id } })).payoutBalanceKobo;

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  vi.stubGlobal('fetch', fakeFetch);
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
  paystack.calls = [];
  paystack.initFails = false;
  paystack.verify = {};
  paystack.transferStatus = 'success';
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: { payoutBalanceKobo: v.payoutBalanceKobo, paystackRecipientCode: v.paystackRecipientCode, bankCode: v.bankCode },
    });
  }
  // Payout tests: start with no outstanding payouts from other tests.
  await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2025-01-01T00:00:00Z') } } });
  await prisma.user.updateMany({ where: { id: { in: [ids.ada, ids.bayo] } }, data: { walletBalanceKobo: 0 } });
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { studentId: { in: [ids.ada, ids.bayo] } }, select: { id: true } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2025-01-01T00:00:00Z') } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: { payoutBalanceKobo: v.payoutBalanceKobo, paystackRecipientCode: v.paystackRecipientCode, bankCode: v.bankCode },
    });
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  vi.unstubAllGlobals();
  await prisma.$disconnect();
  await redis.quit();
});

// ===========================================================================
describe('env safety', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db', REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'x'.repeat(32), CLIENT_URL: 'http://a.com',
  };
  it('refuses a LIVE Paystack key outside production, without echoing it', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'development', PAYSTACK_SECRET_KEY: 'sk_live_abc123' }))
      .toThrow(/LIVE key/);
    try { parseEnv({ ...base, PAYSTACK_SECRET_KEY: 'sk_live_abc123' }); } catch (e) { expect(e.message).not.toContain('abc123'); }
    expect(parseEnv({ ...base, NODE_ENV: 'production', PAYSTACK_SECRET_KEY: 'sk_live_abc123' }).PAYSTACK_SECRET_KEY).toBe('sk_live_abc123');
  });
  it('validates key and Cloudinary URL formats', () => {
    expect(() => parseEnv({ ...base, PAYSTACK_SECRET_KEY: 'pk_test_wrongkind' })).toThrow(/PAYSTACK_SECRET_KEY/);
    expect(() => parseEnv({ ...base, CLOUDINARY_URL: 'https://cloudinary.com' })).toThrow(/CLOUDINARY_URL/);
    expect(parseEnv({ ...base, CLOUDINARY_URL: 'cloudinary://k:s@my-cloud' }).cloudinary).toEqual({ apiKey: 'k', apiSecret: 's', cloudName: 'my-cloud' });
  });
});

// ===========================================================================
describe('card checkout (Paystack)', () => {
  it('holds stock, leaves the wallet alone, hides the PIN, and returns a checkout URL', async () => {
    const res = await cardOrder();
    expect(res.status).toBe(201);
    const { order, payment } = res.body;
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.pickupPin).toBeUndefined();
    expect(order.paymentMethod).toBe('PAYSTACK');
    expect(payment).toEqual({ provider: 'PAYSTACK', reference: order.paymentRef, authorizationUrl: `https://checkout.paystack.com/${order.paymentRef}` });
    expect(await stock('v-emeka', 'sku-rice')).toBe(44);
    expect(await wallet('ada')).toBe(0);

    const init = paystack.calls.find((c) => c.path === '/transaction/initialize');
    expect(init.body).toMatchObject({ email: `ada${TEST_DOMAIN}`, amount: order.totalKobo, currency: 'NGN', reference: order.paymentRef });
    expect(init.auth).toBe(`Bearer ${SECRET}`);
  });

  it('if Paystack is down: 502 and the held stock is released immediately', async () => {
    paystack.initFails = true;
    const res = await cardOrder();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('Paystack is down'); // provider details stay in our logs
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
    const last = await prisma.order.findFirst({ where: { studentId: ids.ada }, orderBy: { createdAt: 'desc' } });
    expect(last.status).toBe('CANCELLED');
  });

  it('unpaid orders are invisible to vendors and riders', async () => {
    const { order } = (await cardOrder()).body;
    const items = await request(app).get('/api/vendor/items').set(as('emeka'));
    expect(items.body.items.some((i) => i.order.id === order.id)).toBe(false);
  });

  it('cancelling an unpaid order is free and returns the stock', async () => {
    const { order } = (await cardOrder()).body;
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(res.body).toMatchObject({ status: 'CANCELLED', refundKobo: 0, cancellationFeeKobo: 0 });
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
    expect(await wallet('ada')).toBe(0);
  });
});

// ===========================================================================
describe('Paystack webhook', () => {
  it('rejects missing, wrong-secret and tampered signatures', async () => {
    const { order } = (await cardOrder()).body;
    const payload = { event: 'charge.success', data: { reference: order.paymentRef, status: 'success', amount: order.totalKobo, currency: 'NGN' } };
    expect((await request(app).post('/api/payments/paystack/webhook').send(payload)).status).toBe(401);
    expect((await webhook(payload, { secret: 'sk_test_attackerGuess' })).status).toBe(401);
    // Valid signature for a cheaper amount, then swap the body: must fail.
    const sig = createHmac('sha512', SECRET).update(JSON.stringify({ ...payload, data: { ...payload.data, amount: 1 } })).digest('hex');
    expect((await webhook(payload, { signature: sig })).status).toBe(401);
    expect((await orderRow(order.id)).status).toBe('PENDING_PAYMENT');
  });

  it('valid charge.success marks the order paid and reveals the PIN to its owner', async () => {
    const { order } = (await cardOrder()).body;
    const res = await chargeSuccess(order);
    expect(res.status).toBe(200);
    const row = await orderRow(order.id);
    expect(row.status).toBe('ORDER_PLACED');
    expect(row.paidAt).not.toBeNull();
    const mine = await request(app).get(`/api/orders/${order.id}`).set(as('ada'));
    expect(mine.body.order.pickupPin).toMatch(/^\d{4}$/);
  });

  it('duplicate / parallel deliveries are applied once', async () => {
    const { order } = (await cardOrder()).body;
    const results = await Promise.all([1, 2, 3].map(() => chargeSuccess(order)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const row = await orderRow(order.id);
    expect(row.status).toBe('ORDER_PLACED');
    expect(await wallet('ada')).toBe(0);
  });

  it('never marks paid when the amount or currency is wrong', async () => {
    const { order } = (await cardOrder()).body;
    await chargeSuccess(order, { amount: order.totalKobo - 100 });
    await chargeSuccess(order, { currency: 'USD' });
    await chargeSuccess(order, { status: 'failed' });
    expect((await orderRow(order.id)).status).toBe('PENDING_PAYMENT');
  });

  it('payment arriving after cancellation is refunded to the wallet in full, once', async () => {
    const { order } = (await cardOrder()).body;
    await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    await Promise.all([chargeSuccess(order), chargeSuccess(order)]);
    expect(await wallet('ada')).toBe(order.totalKobo);
    const row = await orderRow(order.id);
    expect(row).toMatchObject({ status: 'CANCELLED', refundKobo: order.totalKobo });
  });

  it('cancel racing a payment never leaves the student out of pocket', async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.user.update({ where: { id: ids.ada }, data: { walletBalanceKobo: 0 } });
      const { order } = (await cardOrder()).body;
      const [cancel] = await Promise.all([
        request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada')),
        chargeSuccess(order),
      ]);
      const row = await orderRow(order.id);
      const w = await wallet('ada');
      if (row.status === 'CANCELLED') {
        // Either cancelled unpaid then refunded in full late, or paid then cancelled with the ₦200 fee.
        expect([order.totalKobo, order.totalKobo - 200 * N]).toContain(w);
      } else {
        expect(row.status).toBe('ORDER_PLACED');
        expect(cancel.status).toBe(409);
        expect(w).toBe(0);
      }
    }
  });

  it('acknowledges unknown references and event types without changing anything', async () => {
    expect((await webhook({ event: 'charge.success', data: { reference: 'lm-ps-nope', status: 'success', amount: 1, currency: 'NGN' } })).status).toBe(200);
    expect((await webhook({ event: 'subscription.create', data: {} })).status).toBe(200);
  });
});

describe('verify-payment (student checks with Paystack directly)', () => {
  it('confirms a successful payment even if the webhook never came', async () => {
    const { order } = (await cardOrder()).body;
    paystack.verify[order.paymentRef] = { reference: order.paymentRef, status: 'success', amount: order.totalKobo, currency: 'NGN' };
    const res = await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ORDER_PLACED');
    expect(res.body.order.pickupPin).toMatch(/^\d{4}$/);
  });

  it('leaves it pending when Paystack says not paid; other students get 404', async () => {
    const { order } = (await cardOrder()).body;
    const res = await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('ada'));
    expect(res.body.order.status).toBe('PENDING_PAYMENT');
    expect((await request(app).post(`/api/orders/${order.id}/verify-payment`).set(as('bayo'))).status).toBe(404);
  });
});

describe('unpaid order expiry', () => {
  it('releases stock for card orders older than the TTL; fresh ones are kept', async () => {
    const old = (await cardOrder()).body.order;
    const fresh = (await cardOrder('bayo', [{ productId: 'sku-garri', qty: 1 }])).body.order;
    await prisma.order.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });

    expect(await expireStalePendingOrders()).toBe(1);
    expect((await orderRow(old.id)).status).toBe('CANCELLED');
    expect((await orderRow(fresh.id)).status).toBe('PENDING_PAYMENT');
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
    expect(await expireStalePendingOrders()).toBe(0); // idempotent
  });
});

// ===========================================================================
describe('vendor payouts', () => {
  const run = () => request(app).post('/api/admin/payouts/run').set(as('admin'));

  it('admin only', async () => {
    for (const who of ['ada', 'emeka', 'rider']) {
      expect((await request(app).post('/api/admin/payouts/run').set(as(who))).status).toBe(403);
      expect((await request(app).get('/api/admin/payouts').set(as(who))).status).toBe(403);
    }
  });

  it('pays pending pickups, credits the vendor once, reuses the saved recipient', async () => {
    const p1 = await makePickup('v-emeka', 7150 * N);
    const p2 = await makePickup('v-emeka', 1000 * N);
    const before = await vendorBalance('v-emeka');

    const res = await run();
    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.status)).toEqual(['PAID', 'PAID']);
    expect(await vendorBalance('v-emeka')).toBe(before + 8150 * N);
    expect(paystack.calls.filter((c) => c.path === '/transferrecipient')).toHaveLength(1);
    expect((await prisma.vendor.findUnique({ where: { id: 'v-emeka' } })).paystackRecipientCode).toBe('RCP_058_0123456789');
    const t = transferCalls()[0].body;
    expect(t).toMatchObject({ source: 'balance', amount: 7150 * N, recipient: 'RCP_058_0123456789', currency: 'NGN' });
    expect(t.reference).toMatch(/^lm-payout-[0-9a-f-]{36}$/);

    for (const p of [p1, p2]) expect((await prisma.stallPickup.findUnique({ where: { id: p.id } })).payoutStatus).toBe('PAID');
    expect((await run()).body.attempted).toBe(0); // nothing left
    expect(await vendorBalance('v-emeka')).toBe(before + 8150 * N);
  });

  it('pending transfer completes via transfer.success webhook, applied once', async () => {
    paystack.transferStatus = 'pending';
    const p = await makePickup('v-emeka', 500 * N);
    const before = await vendorBalance('v-emeka');
    expect((await run()).body.results[0].status).toBe('PROCESSING');
    const { transferRef } = await prisma.stallPickup.findUnique({ where: { id: p.id } });

    const evt = { event: 'transfer.success', data: { reference: transferRef, amount: 500 * N } };
    await Promise.all([webhook(evt), webhook(evt)]);
    expect((await prisma.stallPickup.findUnique({ where: { id: p.id } })).payoutStatus).toBe('PAID');
    expect(await vendorBalance('v-emeka')).toBe(before + 500 * N);
    expect((await run()).body.attempted).toBe(0); // PROCESSING/PAID are never re-sent
  });

  it('failed transfer can be retried with a NEW reference', async () => {
    paystack.transferStatus = 'pending';
    const p = await makePickup('v-emeka', 300 * N);
    await run();
    const first = (await prisma.stallPickup.findUnique({ where: { id: p.id } })).transferRef;
    await webhook({ event: 'transfer.failed', data: { reference: first, reason: 'Account closed' } });
    let row = await prisma.stallPickup.findUnique({ where: { id: p.id } });
    expect(row).toMatchObject({ payoutStatus: 'FAILED', payoutFailureReason: 'Account closed' });

    paystack.transferStatus = 'success';
    await run();
    row = await prisma.stallPickup.findUnique({ where: { id: p.id } });
    expect(row.payoutStatus).toBe('PAID');
    expect(row.payoutAttempts).toBe(2);
    expect(row.transferRef).not.toBe(first);
  });

  it('a reversal after payment un-credits the vendor once', async () => {
    const p = await makePickup('v-emeka', 200 * N);
    const before = await vendorBalance('v-emeka');
    await run();
    const { transferRef } = await prisma.stallPickup.findUnique({ where: { id: p.id } });
    const evt = { event: 'transfer.reversed', data: { reference: transferRef } };
    await webhook(evt);
    await webhook(evt);
    expect((await prisma.stallPickup.findUnique({ where: { id: p.id } })).payoutStatus).toBe('FAILED');
    expect(await vendorBalance('v-emeka')).toBe(before);
  });

  it('OTP-required, provider errors and missing bank details are recorded as FAILED', async () => {
    paystack.transferStatus = 'otp';
    await makePickup('v-emeka', 100 * N);
    expect((await run()).body.results[0]).toMatchObject({ status: 'FAILED', reason: 'OTP_REQUIRED' });

    paystack.transferStatus = 'error';
    const res = await run();
    expect(res.body.results[0]).toMatchObject({ status: 'FAILED', reason: 'Insufficient balance' });

    await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2025-01-01T00:00:00Z') } } });
    await prisma.vendor.update({ where: { id: 'v-ngozi' }, data: { bankCode: null, paystackRecipientCode: null } });
    await makePickup('v-ngozi', 100 * N);
    paystack.transferStatus = 'success';
    expect((await run()).body.results[0]).toMatchObject({ status: 'FAILED', reason: 'Vendor has no bank code on file' });
  });

  it('two admins running payouts at once never pay a pickup twice', async () => {
    const pickups = await Promise.all([1, 2, 3].map(() => makePickup('v-emeka', 100 * N)));
    await Promise.all([run(), run(), run()]);
    const refs = transferCalls().map((c) => c.body.reference);
    expect(refs).toHaveLength(3);
    for (const p of pickups) expect((await prisma.stallPickup.findUnique({ where: { id: p.id } })).payoutStatus).toBe('PAID');
  });

  it('admin can list payouts by status', async () => {
    await makePickup('v-emeka', 100 * N);
    const res = await request(app).get('/api/admin/payouts?status=PENDING').set(as('admin'));
    expect(res.status).toBe(200);
    expect(res.body.payouts.every((p) => p.payoutStatus === 'PENDING')).toBe(true);
    expect((await request(app).get('/api/admin/payouts?status=STOLEN').set(as('admin'))).status).toBe(400);
  });
});

// ===========================================================================
describe('stall photo uploads (Cloudinary)', () => {
  it('rider gets a signed upload permission; the API secret is never sent', async () => {
    const res = await request(app).get('/api/rider/photo-upload-signature').set(as('rider'));
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe('https://api.cloudinary.com/v1_1/lodgemart-test/image/upload');
    const { signature, api_key: apiKey, ...params } = res.body.fields;
    expect(apiKey).toBe('111111111111111');
    expect(params.folder).toBe('lodgemart/stall-pickups');
    expect(signature).toBe(signParams(params, 'fake_test_secret'));
    expect(JSON.stringify(res.body)).not.toContain('fake_test_secret');
    expect((await request(app).get('/api/rider/photo-upload-signature').set(as('ada'))).status).toBe(403);
  });

  it('stall pickups only accept photos from our Cloudinary folder', async () => {
    for (const photoUrl of [
      'https://evil.example.com/lodgemart/stall-pickups/a.jpg',
      'https://res.cloudinary.com/someone-else/image/upload/v1/lodgemart/stall-pickups/a.jpg',
      'https://res.cloudinary.com/lodgemart-test/image/upload/v1/other-folder/a.jpg',
    ]) {
      const res = await request(app).post('/api/rider/stall-pickups').set(as('rider'))
        .send({ vendorId: 'v-emeka', batchDate: '2024-06-01', batchSlotId: 'midday', photoUrl });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHOTO');
    }
  });
});
