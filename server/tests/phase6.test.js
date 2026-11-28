import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { planRating } from '../src/services/ratingService.js';

const app = createApp();
const TEST_DOMAIN = '@phase6.test';
const N = 100;
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday', paymentMethod: 'WALLET' };

let inventorySnapshot, vendorSnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const vendorRow = (id) => prisma.vendor.findUnique({ where: { id } });

async function clearKeys() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}
async function placeOrder(items, who = 'ada') {
  const res = await request(app).post('/api/orders').set(as(who)).send({ ...BASE, items });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.order;
}
// A collected order, ready to rate.
async function collectedOrder(items, who = 'ada') {
  const order = await placeOrder(items, who);
  await prisma.order.update({ where: { id: order.id }, data: { status: 'COLLECTED', collectedAt: new Date() } });
  return order;
}
const rate = (order, body, who = 'ada') => request(app).post(`/api/orders/${order.id}/rating`).set(as(who)).send(body);
const itemOf = (order, productId) => order.items.find((i) => i.productId === productId);

async function restoreVendors() {
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: {
        ratingScore: v.ratingScore, ratingCount: v.ratingCount, isActive: v.isActive,
        bankName: v.bankName, bankCode: v.bankCode, bankAccountNumber: v.bankAccountNumber,
        paystackRecipientCode: v.paystackRecipientCode,
      },
    });
  }
}

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  vendorSnapshot = await prisma.vendor.findMany();
  const passwordHash = await hashPassword('longenough1');
  for (const key of ['ada', 'bayo']) {
    const u = await prisma.user.create({
      data: { name: `Test ${key}`, email: `${key}${TEST_DOMAIN}`, passwordHash, role: 'STUDENT', walletBalanceKobo: 1_000_000 * N },
    });
    tokens[key] = signToken(u);
    ids[key] = u.id;
  }
  for (const [key, email] of [['admin', 'ops@lodgemart.ng'], ['emeka', 'ogaemeka@lodgemart.ng'], ['rider', 'tunde.dispatch@lodgemart.ng'], ['chinedu', 'chinedu.unizik@gmail.com']]) {
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
  await restoreVendors();
});

afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { studentId: { in: [ids.ada, ids.bayo] } }, select: { id: true } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  const staff = await prisma.user.findMany({ where: { email: { endsWith: TEST_DOMAIN } }, select: { vendorId: true } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  const createdVendorIds = staff.map((s) => s.vendorId).filter(Boolean);
  await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  await restoreVendors();
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ===========================================================================
describe('rating rules (unit, from the prototype)', () => {
  const items = [
    { id: 'rice', vendorId: 'v-emeka' },
    { id: 'garri', vendorId: 'v-emeka' },
    { id: 'beans', vendorId: 'v-ngozi' },
  ];
  it('4–5 stars credit every item and every stall', () => {
    const { itemUpdates, vendorScores } = planRating(items, 4, []);
    expect(itemUpdates.map((u) => u.itemRating)).toEqual([4, 4, 4]);
    expect(Object.fromEntries(vendorScores)).toEqual({ 'v-emeka': 4, 'v-ngozi': 4 });
  });
  it('1–3 stars only hit the flagged item and its stall; others get 5', () => {
    const { itemUpdates, vendorScores } = planRating(items, 2, [{ itemId: 'beans', issueTag: 'Weevils/Dusty' }]);
    expect(itemUpdates).toEqual([
      { id: 'rice', itemRating: 5, issueTag: null },
      { id: 'garri', itemRating: 5, issueTag: null },
      { id: 'beans', itemRating: 2, issueTag: 'Weevils/Dusty' },
    ]);
    expect(Object.fromEntries(vendorScores)).toEqual({ 'v-emeka': 5, 'v-ngozi': 2 });
  });
  it('a stall with one flagged and one good item gets the low score (once)', () => {
    const { vendorScores } = planRating(items, 1, [{ itemId: 'garri', issueTag: 'Short Measure' }]);
    expect(vendorScores.get('v-emeka')).toBe(1);
  });
  it('flags are ignored for 4–5 stars', () => {
    const { itemUpdates } = planRating(items, 5, [{ itemId: 'rice', issueTag: 'Damaged Pack' }]);
    expect(itemUpdates[0]).toEqual({ id: 'rice', itemRating: 5, issueTag: null });
  });
});

describe('rating an order', () => {
  it('4 stars on a two-stall order updates both stalls\' running averages', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 1 }]);
    const res = await rate(order, { stars: 4 });
    expect(res.status).toBe(200);
    expect(await vendorRow('v-emeka')).toMatchObject({ ratingCount: 25 });
    expect(Number((await vendorRow('v-emeka')).ratingScore)).toBe(4.77); // (4.8×24 + 4) / 25
    expect(Number((await vendorRow('v-ngozi')).ratingScore)).toBe(4.57); // (4.6×19 + 4) / 20
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row.ratedAt).not.toBeNull();
  });

  it('2 stars flagging the beans only penalises Mama Ngozi', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 1 }]);
    const res = await rate(order, { stars: 2, flaggedItems: [{ itemId: itemOf(order, 'sku-beans').id, issueTag: 'Weevils/Dusty' }] });
    expect(res.status).toBe(200);
    expect(Number((await vendorRow('v-emeka')).ratingScore)).toBe(4.81); // (4.8×24 + 5) / 25
    expect(Number((await vendorRow('v-ngozi')).ratingScore)).toBe(4.47); // (4.6×19 + 2) / 20
    const beans = await prisma.orderItem.findUnique({ where: { id: itemOf(order, 'sku-beans').id } });
    expect(beans).toMatchObject({ itemRating: 2, issueTag: 'Weevils/Dusty' });
  });

  it('1–3 stars without flagging an item is refused (prototype bug fix) and changes nothing', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    const res = await rate(order, { stars: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FLAG_REQUIRED');
    expect((await prisma.order.findUnique({ where: { id: order.id } })).ratedAt).toBeNull();
    expect((await vendorRow('v-emeka')).ratingCount).toBe(24);
  });

  it('rejects unknown tags, foreign items, bad star values', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    const other = await collectedOrder([{ productId: 'sku-garri', qty: 1 }]);
    const riceId = itemOf(order, 'sku-rice').id;
    expect((await rate(order, { stars: 2, flaggedItems: [{ itemId: riceId, issueTag: 'Bad vibes' }] })).status).toBe(400);
    const foreign = await rate(order, { stars: 2, flaggedItems: [{ itemId: itemOf(other, 'sku-garri').id, issueTag: 'Short Measure' }] });
    expect(foreign.body.error.code).toBe('INVALID_ITEM');
    for (const stars of [0, 6, 4.5, '5']) expect((await rate(order, { stars })).status).toBe(400);
  });

  it('only collected orders can be rated', async () => {
    const order = await placeOrder([{ productId: 'sku-rice', qty: 1 }]);
    const res = await rate(order, { stars: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_COLLECTED');
  });

  it('only once — even when submitted twice at the same time', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    const results = await Promise.all([rate(order, { stars: 5 }), rate(order, { stars: 5 })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await vendorRow('v-emeka')).ratingCount).toBe(25);
  });

  it('two different orders rated at once both count (no lost update)', async () => {
    const a = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    const b = await collectedOrder([{ productId: 'sku-garri', qty: 1 }], 'bayo');
    await Promise.all([rate(a, { stars: 5 }), rate(b, { stars: 5 }, 'bayo')]);
    const emeka = await vendorRow('v-emeka');
    expect(emeka.ratingCount).toBe(26);
    expect(Number(emeka.ratingScore)).toBeCloseTo((4.8 * 24 + 10) / 26, 1);
  });

  it("another student can't rate my order", async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    // 404 before any other check, so a stranger can't even learn the order exists.
    expect((await rate(order, { stars: 1, flaggedItems: [] }, 'bayo')).status).toBe(404);
    expect((await rate(order, { stars: 5 }, 'bayo')).status).toBe(404);
  });

  it('a stall that drops below 3.5★ stops receiving orders', async () => {
    await prisma.vendor.update({ where: { id: 'v-emeka' }, data: { ratingScore: 3.6, ratingCount: 1 } });
    const order = await collectedOrder([{ productId: 'sku-oil', qty: 1 }]);
    await rate(order, { stars: 1, flaggedItems: [{ itemId: itemOf(order, 'sku-oil').id, issueTag: 'Damaged Pack' }] });
    expect(Number((await vendorRow('v-emeka')).ratingScore)).toBe(2.3);
    const res = await request(app).post('/api/orders').set(as('ada')).send({ ...BASE, items: [{ productId: 'sku-oil', qty: 1 }] });
    expect(res.status).toBe(409); // Emeka was the only oil stall
  });

  it('the vendor sees flagged items, but not who flagged them', async () => {
    const order = await collectedOrder([{ productId: 'sku-rice', qty: 1 }]);
    await rate(order, { stars: 2, flaggedItems: [{ itemId: itemOf(order, 'sku-rice').id, issueTag: 'Short Measure' }] });
    const res = await request(app).get('/api/vendor/feedback').set(as('emeka'));
    expect(res.status).toBe(200);
    expect(res.body.feedback[0]).toMatchObject({ itemRating: 2, issueTag: 'Short Measure', orderLabel: `#${order.orderNumber}` });
    const text = JSON.stringify(res.body);
    for (const leak of ['Test ada', TEST_DOMAIN, 'studentId']) expect(text).not.toContain(leak);
  });
});

// ===========================================================================
describe('admin: access', () => {
  it('every admin endpoint is ADMIN-only', async () => {
    for (const who of ['ada', 'emeka', 'rider']) {
      for (const [method, path] of [
        ['get', '/api/admin/summary'], ['get', '/api/admin/orders'], ['get', '/api/admin/users'],
        ['post', '/api/admin/users'], ['get', '/api/admin/vendors'], ['patch', `/api/admin/vendors/v-emeka`],
      ]) {
        expect((await request(app)[method](path).set(as(who)).send({})).status).toBe(403);
      }
    }
  });
});

describe('admin: staff accounts', () => {
  const create = (body) => request(app).post('/api/admin/users').set(as('admin')).send(body);
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

  it('creates a rider who can log in and use the rider portal', async () => {
    const res = await create({ role: 'RIDER', name: 'Kelechi Rider', email: `kelechi${TEST_DOMAIN}`, password: 'rider-pass-123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'RIDER', email: `kelechi${TEST_DOMAIN}` });
    const session = await login(`kelechi${TEST_DOMAIN}`, 'rider-pass-123');
    expect((await request(app).get('/api/rider/earnings').set('Authorization', `Bearer ${session.body.token}`)).status).toBe(200);
  });

  it('creates a vendor with a new stall that appears in their portal', async () => {
    const res = await create({
      role: 'VENDOR', name: 'Iya Bisi', email: `bisi${TEST_DOMAIN}`, password: 'vendor-pass-123',
      vendor: { stallNumber: 'Stall D-02', bankName: 'UBA', bankCode: '033', bankAccountNumber: '1234567890' },
    });
    expect(res.status).toBe(201);
    expect(res.body.user.vendorId).toMatch(/^v-/);
    const session = await login(`bisi${TEST_DOMAIN}`, 'vendor-pass-123');
    const dash = await request(app).get('/api/vendor/dashboard').set('Authorization', `Bearer ${session.body.token}`);
    expect(dash.body.vendor).toMatchObject({ name: 'Iya Bisi', stallNumber: 'Stall D-02', market: 'Eke Awka', bankCode: '033', ratingScore: 5 });
  });

  it.each([
    ['students (public sign-up only)', { role: 'STUDENT' }],
    ['vendor without stall details', { role: 'VENDOR' }],
    ['rider with stall details', { role: 'RIDER', vendor: { stallNumber: 'X', bankName: 'B', bankCode: '058', bankAccountNumber: '1234567890' } }],
    ['short password', { role: 'RIDER', password: 'short' }],
    ['bad account number', { role: 'VENDOR', vendor: { stallNumber: 'X', bankName: 'B', bankCode: '058', bankAccountNumber: '123' } }],
  ])('rejects %s', async (_l, override) => {
    const res = await create({ name: 'Some Body', email: `x${Math.random()}${TEST_DOMAIN}`, password: 'long-enough-pass', ...override });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    const res = await create({ role: 'RIDER', name: 'Dup Rider', email: 'tunde.dispatch@lodgemart.ng', password: 'long-enough-pass' });
    expect(res.status).toBe(409);
  });

  it('disabling an account cuts off their existing session immediately', async () => {
    const created = await create({ role: 'RIDER', name: 'Short Stay', email: `short${TEST_DOMAIN}`, password: 'rider-pass-123' });
    const session = await login(`short${TEST_DOMAIN}`, 'rider-pass-123');
    const off = await request(app).patch(`/api/admin/users/${created.body.user.id}`).set(as('admin')).send({ isActive: false });
    expect(off.status).toBe(200);
    expect((await request(app).get('/api/rider/earnings').set('Authorization', `Bearer ${session.body.token}`)).status).toBe(401);
    expect((await request(app).patch(`/api/admin/users/${ids.admin}`).set(as('admin')).send({ isActive: false })).body.error.code)
      .toBe('CANNOT_DISABLE_SELF');
  });

  it('lists users by role without password hashes', async () => {
    const res = await request(app).get('/api/admin/users?role=VENDOR').set(as('admin'));
    expect(res.body.users.every((u) => u.role === 'VENDOR')).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

describe('admin: vendors', () => {
  it('changing bank details forgets the old Paystack recipient', async () => {
    await prisma.vendor.update({ where: { id: 'v-emeka' }, data: { paystackRecipientCode: 'RCP_old' } });
    const res = await request(app).patch('/api/admin/vendors/v-emeka').set(as('admin'))
      .send({ bankName: 'Opay', bankCode: '999992', bankAccountNumber: '8012345678' });
    expect(res.status).toBe(200);
    expect(res.body.vendor).toMatchObject({ bankName: 'Opay', bankAccountNumber: '8012345678' });
    expect((await vendorRow('v-emeka')).paystackRecipientCode).toBeNull();
  });

  it('switching a vendor off removes them from routing; validation and 404s', async () => {
    await request(app).patch('/api/admin/vendors/v-emeka').set(as('admin')).send({ isActive: false });
    const res = await request(app).post('/api/orders').set(as('ada')).send({ ...BASE, items: [{ productId: 'sku-oil', qty: 1 }] });
    expect(res.status).toBe(409);
    expect((await request(app).patch('/api/admin/vendors/v-emeka').set(as('admin')).send({})).status).toBe(400);
    expect((await request(app).patch('/api/admin/vendors/v-emeka').set(as('admin')).send({ ratingScore: 5 })).status).toBe(400);
    expect((await request(app).patch('/api/admin/vendors/v-nobody').set(as('admin')).send({ isActive: true })).status).toBe(404);
  });

  it('lists vendors with their login', async () => {
    const res = await request(app).get('/api/admin/vendors').set(as('admin'));
    expect(res.body.vendors.find((v) => v.id === 'v-emeka').user.email).toBe('ogaemeka@lodgemart.ng');
  });
});

describe('admin: summary and orders', () => {
  it('adds up sales, margin, refunds and fees for a date range', async () => {
    const day = '2023-05-01';
    const at = { batchDate: new Date(`${day}T00:00:00Z`) };
    const kept = await placeOrder([{ productId: 'sku-rice', qty: 2 }]); // 2 × (5200 − 4700) margin
    const cancelled = await placeOrder([{ productId: 'sku-garri', qty: 1 }]);
    await request(app).post(`/api/orders/${cancelled.id}/cancel`).set(as('ada'));
    await prisma.order.updateMany({ where: { id: { in: [kept.id, cancelled.id] } }, data: at });

    const res = await request(app).get(`/api/admin/summary?from=${day}&to=${day}`).set(as('admin'));
    expect(res.status).toBe(200);
    const { orders, money } = res.body;
    expect(orders.byStatus).toEqual({ ORDER_PLACED: 1, CANCELLED: 1 });
    expect(money.salesKobo).toBe(kept.totalKobo);
    expect(money.deliveryFeesKobo).toBe(350 * N);
    expect(money.itemMarginKobo).toBe(2 * (5200 - 4700) * N);
    expect(money.refundsKobo).toBe(cancelled.totalKobo - 200 * N);
    expect(money.cancellationFeesKobo).toBe(200 * N);
    expect(money.grossProfitKobo).toBe(2 * 500 * N + 350 * N + 200 * N);
    expect(res.body.vendors.find((v) => v.id === 'v-chidi').receivesOrders).toBe(false); // 3.4★
  });

  it('lists all orders for admins without pickup PINs, filterable and paged', async () => {
    await placeOrder([{ productId: 'sku-garri', qty: 1 }]);
    const res = await request(app).get('/api/admin/orders?status=ORDER_PLACED&page=1').set(as('admin'));
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(res.body.orders.every((o) => o.status === 'ORDER_PLACED')).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('pickupPin');
    expect((await request(app).get('/api/admin/orders?status=LOST').set(as('admin'))).status).toBe(400);
  });
});
