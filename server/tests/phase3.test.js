import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { routeBasket } from '../src/services/routingService.js';
import { batchDateFor } from '../src/utils/batchDate.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';

const app = createApp();
const TEST_DOMAIN = '@phase3.test';
const N = 100; // kobo per naira
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday', paymentMethod: 'WALLET' };

let inventorySnapshot, vendorSnapshot;
const students = {}; // name -> { id, token }

// Test students are created directly (one bcrypt hash, tokens signed directly):
// the login/register flow itself is covered by phase2.test.js. Keeps setup fast.
let testPasswordHash;
async function makeStudent(key) {
  testPasswordHash ??= await hashPassword('longenough1');
  const user = await prisma.user.create({
    data: { name: `Test ${key}`, email: `${key}${TEST_DOMAIN}`, passwordHash: testPasswordHash, role: 'STUDENT' },
  });
  students[key] = { id: user.id, token: signToken(user) };
}
const auth = (key) => ({ Authorization: `Bearer ${students[key].token}` });
const setWallet = (key, kobo) => prisma.user.update({ where: { id: students[key].id }, data: { walletBalanceKobo: kobo } });
const wallet = async (key) => (await prisma.user.findUnique({ where: { id: students[key].id } })).walletBalanceKobo;
const stock = async (vendorId, productId) =>
  (await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId, productId } } })).stockQty;
const setStock = (vendorId, productId, stockQty) =>
  prisma.vendorInventory.update({ where: { vendorId_productId: { vendorId, productId } }, data: { stockQty } });
const placeOrder = (key, items, extra = {}) =>
  request(app).post('/api/orders').set(auth(key)).send({ ...BASE, items, ...extra });

async function clearRateLimits() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  await clearRateLimits();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  vendorSnapshot = await prisma.vendor.findMany({ select: { id: true, ratingScore: true, isActive: true, priorityTier: true } });
  for (const key of ['ada', 'bayo', 'rich']) await makeStudent(key);
});

// Every test starts from the seeded stock + ratings and a known wallet.
beforeEach(async () => {
  await clearRateLimits();
  for (const row of inventorySnapshot) await setStock(row.vendorId, row.productId, row.stockQty);
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({ where: { id: v.id }, data: { ratingScore: v.ratingScore, isActive: v.isActive, priorityTier: v.priorityTier } });
  }
  await setWallet('ada', 50_000 * N);
  await setWallet('bayo', 50_000 * N);
  await setWallet('rich', 1_000_000 * N);
});

afterAll(async () => {
  const ids = Object.values(students).map((s) => s.id);
  await prisma.order.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  for (const row of inventorySnapshot) await setStock(row.vendorId, row.productId, row.stockQty);
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({ where: { id: v.id }, data: { ratingScore: v.ratingScore, isActive: v.isActive, priorityTier: v.priorityTier } });
  }
  // Put the order-number sequence back so seeded numbering (#4083 next) is unchanged.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearRateLimits();
  await prisma.$disconnect();
  await redis.quit();
});

// ---------------------------------------------------------------------------
describe('routing algorithm (unit)', () => {
  const vendor = (id, rating, inv) => ({
    id,
    rating,
    inventory: new Map(Object.entries(inv).map(([p, [price, qty]]) => [p, { wholesalePriceKobo: price, stockQty: qty }])),
  });
  const emeka = vendor('v-emeka', 4.8, { rice: [4700, 45], garri: [2450, 60] });
  const ngozi = vendor('v-ngozi', 4.6, { beans: [5500, 30] });
  const cheap = vendor('v-cheap', 4.0, { rice: [3000, 50] });

  it('prefers a single stop when one vendor has everything', () => {
    const r = routeBasket([{ productId: 'rice', qty: 1 }, { productId: 'garri', qty: 2 }], [ngozi, cheap, emeka]);
    expect(r.assignments.map((a) => a.vendorId)).toEqual(['v-emeka', 'v-emeka']);
    expect(r.assignments[1].wholesaleCostKobo).toBe(2450);
  });

  it('single stop beats a split, even if the split would be higher rated', () => {
    const both = vendor('v-both', 4.0, { rice: [5000, 10], beans: [6000, 10] });
    const r = routeBasket([{ productId: 'rice', qty: 1 }, { productId: 'beans', qty: 1 }], [emeka, ngozi, both]);
    expect(r.assignments.map((a) => a.vendorId)).toEqual(['v-both', 'v-both']);
  });

  it('splits by rating first, ignoring a cheaper lower-rated vendor', () => {
    const r = routeBasket([{ productId: 'rice', qty: 1 }, { productId: 'beans', qty: 1 }], [cheap, ngozi, emeka]);
    expect(r.assignments.map((a) => a.vendorId)).toEqual(['v-emeka', 'v-ngozi']);
  });

  it('on equal rating, the cheaper wholesale price wins', () => {
    const twin = vendor('v-twin', 4.8, { rice: [4500, 10] });
    const r = routeBasket([{ productId: 'rice', qty: 1 }, { productId: 'beans', qty: 1 }], [emeka, twin, ngozi]);
    expect(r.assignments[0]).toMatchObject({ vendorId: 'v-twin', wholesaleCostKobo: 4500 });
  });

  it('falls back to the next vendor when the best one lacks quantity', () => {
    const r = routeBasket([{ productId: 'rice', qty: 50 }], [emeka, vendor('v-big', 4.0, { rice: [5000, 100] })]);
    expect(r.assignments[0].vendorId).toBe('v-big');
  });

  it('reports the line nobody can fill', () => {
    expect(routeBasket([{ productId: 'rice', qty: 1 }, { productId: 'milo', qty: 1 }], [emeka, ngozi]))
      .toEqual({ ok: false, productId: 'milo' });
  });
});

describe('batch date (unit)', () => {
  const midday = { cutoffTime: '12:15' };
  it('uses today before the cutoff (Lagos time)', () => {
    expect(batchDateFor(midday, new Date('2026-11-27T11:00:00Z')).toISOString()).toMatch(/^2026-11-27/); // 12:00 Lagos
  });
  it('rolls to tomorrow after the cutoff', () => {
    expect(batchDateFor(midday, new Date('2026-11-27T11:20:00Z')).toISOString()).toMatch(/^2026-11-28/); // 12:20 Lagos
  });
  it('handles the UTC/Lagos midnight boundary', () => {
    expect(batchDateFor(midday, new Date('2026-11-27T23:30:00Z')).toISOString()).toMatch(/^2026-11-28/); // 00:30 Lagos on the 28th
  });
});

// ---------------------------------------------------------------------------
describe('catalog', () => {
  it('is public and never leaks wholesale prices, stock or bank details', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(8);
    expect(res.body.zones.find((z) => z.id === 'ifite').hubs.map((h) => h.id).sort())
      .toEqual(['dynamo-junction', 'school-gate']);
    expect(res.body.batchSlots.map((s) => s.id)).toEqual(['early', 'midday', 'evening']);
    expect(res.body.batchSlots[0].nextBatchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.fees.cancellationFeeKobo).toBe(20000);
    expect(res.body.fees.deliveryFee).toMatchObject({ standardKobo: 35000, largeKobo: 60000, bulkItemSurchargeKobo: 25000 });
    expect(res.body.products.find((p) => p.id === 'sku-indomie').isBulkItem).toBe(true);
    const text = JSON.stringify(res.body);
    for (const secret of ['wholesale', 'stockQty', 'bankAccount', '0123456789']) expect(text).not.toContain(secret);
  });

  it('marks a product out of stock when only low-rated vendors carry it', async () => {
    await setStock('v-emeka', 'sku-rice', 0); // Brother Chidi (3.4★) still has 20
    const res = await request(app).get('/api/catalog');
    expect(res.body.products.find((p) => p.id === 'sku-rice').inStock).toBe(false);
    expect(res.body.products.find((p) => p.id === 'sku-garri').inStock).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('placing an order', () => {
  it('single-stop basket: server prices it, takes stock and wallet, issues a PIN', async () => {
    const res = await placeOrder('ada', [
      { productId: 'sku-rice', qty: 1 },
      { productId: 'sku-garri', qty: 1 },
      { productId: 'sku-oil', qty: 1 },
    ]);
    expect(res.status).toBe(201);
    const o = res.body.order;
    expect(o.status).toBe('ORDER_PLACED');
    expect(o.subtotalKobo).toBe((5200 + 2800 + 2650) * N);
    expect(o.deliveryFeeKobo).toBe(600 * N); // ₦10,650 basket → large-basket fee
    expect(o.totalKobo).toBe(11250 * N);
    expect(o.requiresBagMerge).toBe(false);
    expect(new Set(o.items.map((i) => i.vendor.id))).toEqual(new Set(['v-emeka']));
    expect(o.pickupPin).toMatch(/^\d{4}$/);
    expect(o.orderLabel).toBe(`#${o.orderNumber}`);
    expect(o.batchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(o)).not.toContain('wholesale');

    expect(await wallet('ada')).toBe((50_000 - 11_250) * N);
    expect(await stock('v-emeka', 'sku-rice')).toBe(44);
    expect(await stock('v-emeka', 'sku-oil')).toBe(39);
  });

  it('split basket across two stalls is flagged for bag merge', async () => {
    const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 2 }]);
    expect(res.status).toBe(201);
    expect(res.body.order.requiresBagMerge).toBe(true);
    const byProduct = Object.fromEntries(res.body.order.items.map((i) => [i.productId, i.vendor.id]));
    expect(byProduct).toEqual({ 'sku-rice': 'v-emeka', 'sku-beans': 'v-ngozi' });
    expect(res.body.order.totalKobo).toBe((5200 + 2 * 6100 + 600) * N);
  });

  it('never routes to vendors rated below 3.5', async () => {
    const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 46 }]); // Emeka 45, Chidi (3.4★) 20
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'OUT_OF_STOCK', details: { productId: 'sku-rice' } });
    expect(await stock('v-chidi', 'sku-rice')).toBe(20);
  });

  it('routes to a vendor once their rating qualifies (highest rating wins among non-priority)', async () => {
    await prisma.vendor.update({ where: { id: 'v-chidi' }, data: { ratingScore: 4.9 } });
    await prisma.vendor.update({ where: { id: 'v-emeka' }, data: { priorityTier: false } });
    const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-garri', qty: 1 }]);
    expect(res.status).toBe(201);
    expect(new Set(res.body.order.items.map((i) => i.vendor.id))).toEqual(new Set(['v-chidi']));
  });

  it('ignores deactivated vendors', async () => {
    await prisma.vendor.update({ where: { id: 'v-ngozi' }, data: { isActive: false } });
    expect((await placeOrder('ada', [{ productId: 'sku-beans', qty: 1 }])).status).toBe(409);
  });

  it('rejects client-supplied prices, totals or PINs', async () => {
    for (const extra of [{ totalKobo: 1 }, { pickupPin: '0000' }, { status: 'COLLECTED' }]) {
      const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }], extra);
      expect(res.status).toBe(400);
    }
    const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 1, studentPriceKobo: 1 }]);
    expect(res.status).toBe(400);
    expect(await wallet('ada')).toBe(50_000 * N);
  });

  it.each([
    ['empty basket', { items: [] }],
    ['zero qty', { items: [{ productId: 'sku-rice', qty: 0 }] }],
    ['fractional qty', { items: [{ productId: 'sku-rice', qty: 1.5 }] }],
    ['duplicate product lines', { items: [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-rice', qty: 1 }] }],
    ['unknown payment method', { paymentMethod: 'CASH' }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(app).post('/api/orders').set(auth('ada'))
      .send({ ...BASE, items: [{ productId: 'sku-rice', qty: 1 }], ...override });
    expect(res.status).toBe(400);
  });

  it('rejects a hub outside the chosen zone, and unknown products/slots', async () => {
    const items = [{ productId: 'sku-rice', qty: 1 }];
    expect((await placeOrder('ada', items, { hubId: 'aroma-junction' })).body.error.code).toBe('INVALID_HUB');
    expect((await placeOrder('ada', items, { batchSlotId: 'midnight' })).body.error.code).toBe('INVALID_BATCH_SLOT');
    expect((await placeOrder('ada', [{ productId: 'sku-caviar', qty: 1 }])).body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('insufficient wallet: 402 and nothing changes (transaction rolled back)', async () => {
    await setWallet('ada', 1000 * N);
    const res = await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }]);
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
    expect(await wallet('ada')).toBe(1000 * N);
  });

  it('only students can order', async () => {
    const vendor = await request(app).post('/api/auth/login').send({ email: 'ogaemeka@lodgemart.ng', password: 'password123' });
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${vendor.body.token}`)
      .send({ ...BASE, items: [{ productId: 'sku-rice', qty: 1 }] });
    expect(res.status).toBe(403);
  });
});

describe('concurrency (no overselling, no overspending)', () => {
  it('never sells more than the stock when orders race for the last items', async () => {
    await setStock('v-emeka', 'sku-oil', 3); // only vendor with oil
    const results = await Promise.all(
      Array.from({ length: 8 }, () => placeOrder('rich', [{ productId: 'sku-oil', qty: 1 }])),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(await stock('v-emeka', 'sku-oil')).toBe(0);
  });

  it('never lets parallel orders spend more than the wallet holds', async () => {
    await setWallet('bayo', (2650 + 350) * N); // exactly one bottle of oil
    const results = await Promise.all(
      Array.from({ length: 4 }, () => placeOrder('bayo', [{ productId: 'sku-oil', qty: 1 }])),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await wallet('bayo')).toBe(0);
    expect(await stock('v-emeka', 'sku-oil')).toBe(39);
  });
});

// ---------------------------------------------------------------------------
describe('my orders & ownership', () => {
  let adaOrder;
  beforeEach(async () => {
    adaOrder = (await placeOrder('ada', [{ productId: 'sku-garri', qty: 1 }])).body.order;
  });

  it('lists only my own orders', async () => {
    const res = await request(app).get('/api/orders').set(auth('bayo'));
    expect(res.status).toBe(200);
    expect(res.body.orders.find((o) => o.id === adaOrder.id)).toBeUndefined();
    const mine = await request(app).get('/api/orders').set(auth('ada'));
    expect(mine.body.orders[0].id).toBe(adaOrder.id);
    expect(mine.body.orders[0].pickupPin).toBe(adaOrder.pickupPin);
  });

  it("another student gets 404 for my order (can't even tell it exists)", async () => {
    for (const [method, path] of [
      ['get', `/api/orders/${adaOrder.id}`],
      ['post', `/api/orders/${adaOrder.id}/cancel`],
    ]) {
      const res = await request(app)[method](path).set(auth('bayo'));
      expect(res.status).toBe(404);
    }
    const del = await request(app).post(`/api/orders/${adaOrder.id}/delegate`).set(auth('bayo'))
      .send({ name: 'Thief Person', phone: '08030000000' });
    expect(del.status).toBe(404);
  });

  it('admin can view an order but never sees the pickup PIN', async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'ops@lodgemart.ng', password: 'password123' });
    const res = await request(app).get(`/api/orders/${adaOrder.id}`).set('Authorization', `Bearer ${admin.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.order.pickupPin).toBeUndefined();
  });

  it('rejects malformed order ids', async () => {
    expect((await request(app).get('/api/orders/not-a-uuid').set(auth('ada'))).status).toBe(400);
  });
});

describe('cancel', () => {
  it('refunds total minus ₦200 and restocks the vendor', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-rice', qty: 2 }])).body.order;
    expect(await stock('v-emeka', 'sku-rice')).toBe(43);
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(auth('ada'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', refundKobo: order.totalKobo - 200 * N, cancellationFeeKobo: 200 * N });
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
    expect(await wallet('ada')).toBe(50_000 * N - 200 * N);
  });

  it('refunds only once, even when cancel is sent twice at the same time', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }])).body.order;
    const results = await Promise.all([1, 2, 3].map(() =>
      request(app).post(`/api/orders/${order.id}/cancel`).set(auth('ada'))));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'ALREADY_CANCELLED')).toBe(true);
    expect(await wallet('ada')).toBe(50_000 * N - 200 * N);
    expect(await stock('v-emeka', 'sku-rice')).toBe(45);
  });

  it('is refused once the rider has picked up', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-rice', qty: 1 }])).body.order;
    await prisma.order.update({ where: { id: order.id }, data: { status: 'RIDER_IN_TRANSIT' } });
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(auth('ada'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_CANCEL');
  });
});

describe('delegate pickup to a roommate', () => {
  it('sets the delegate and issues a fresh PIN', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-garri', qty: 1 }])).body.order;
    const res = await request(app).post(`/api/orders/${order.id}/delegate`).set(auth('ada'))
      .send({ name: '  Emeka Roommate ', phone: '08031112222' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ delegateName: 'Emeka Roommate', delegatePhone: '08031112222' });
    expect(res.body.pickupPin).toMatch(/^\d{4}$/);
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row.pickupPin).toBe(res.body.pickupPin);
  });

  it('is refused for collected or cancelled orders', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-garri', qty: 1 }])).body.order;
    await prisma.order.update({ where: { id: order.id }, data: { status: 'COLLECTED' } });
    const res = await request(app).post(`/api/orders/${order.id}/delegate`).set(auth('ada'))
      .send({ name: 'Late Roommate', phone: '08031112222' });
    expect(res.status).toBe(409);
  });

  it('validates the roommate details', async () => {
    const order = (await placeOrder('ada', [{ productId: 'sku-garri', qty: 1 }])).body.order;
    const res = await request(app).post(`/api/orders/${order.id}/delegate`).set(auth('ada'))
      .send({ name: '<b>x</b>', phone: '123' });
    expect(res.status).toBe(400);
  });
});

describe('rate limiting on order writes', () => {
  it('caps a user at 20 order writes per 10 minutes', async () => {
    for (let i = 0; i < 20; i++) await placeOrder('rich', [{ productId: 'sku-detergent', qty: 1 }]);
    const res = await placeOrder('rich', [{ productId: 'sku-detergent', qty: 1 }]);
    expect(res.status).toBe(429);
  });
});
