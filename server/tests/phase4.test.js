import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { batchDateFor, isPastCutoff, toDateString } from '../src/utils/batchDate.js';

const app = createApp();
// Students never see which stall supplied an item (blind ratings), so tests read it from the DB.
const vendorIdsOf = async (orderId) => (await prisma.orderItem.findMany({ where: { orderId } })).map((i) => i.vendorId);

const TEST_DOMAIN = '@phase4.test';
const N = 100;
const PHOTO = 'https://res.cloudinary.com/lodgemart-test/image/upload/v1/lodgemart/stall-pickups/stall.jpg'; // .env.test cloud
// Test batches live in Jan 2025 (in the past → after cutoff), one date per test.
let dayCounter = 0;
const freshDate = () => toDateString(new Date(Date.UTC(2025, 0, 1 + dayCounter++)));

let inventorySnapshot, vendorBalances;
const tokens = {};
const ids = {};

async function tokenFor(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  ids[email] = user.id;
  return signToken(user);
}
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

async function clearKeys() {
  const keys = [...(await redis.keys('rl:*')), ...(await redis.keys('pin:fail:*'))];
  if (keys.length) await redis.del(...keys);
}

// Place a real order through the API, then move it into a test batch.
// `beforeLock` runs while the batch is still open (e.g. cancel, which is only
// allowed before the cutoff).
async function orderFor(date, items, { hubId = 'dynamo-junction', who = 'ada', beforeLock } = {}) {
  const res = await request(app).post('/api/orders').set(as(who)).send({
    items, zoneId: 'ifite', hubId, batchSlotId: 'evening', paymentMethod: 'WALLET',
  });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  if (beforeLock) await beforeLock(res.body.order);
  await prisma.order.update({ where: { id: res.body.order.id }, data: { batchDate: new Date(`${date}T00:00:00Z`) } });
  return res.body.order;
}
const cancelAs = (who) => (order) => request(app).post(`/api/orders/${order.id}/cancel`).set(as(who));
const pickup = (date, vendorId, who = 'rider') =>
  request(app).post('/api/rider/stall-pickups').set(as(who))
    .send({ vendorId, batchDate: date, batchSlotId: 'evening', photoUrl: PHOTO });
const arrive = (date, hubId = 'dynamo-junction') =>
  request(app).post('/api/rider/hub-arrivals').set(as('rider')).send({ hubId, batchDate: date, batchSlotId: 'evening' });
const handover = (orderId, pin) =>
  request(app).post('/api/rider/handover').set(as('rider')).send({ orderId, pin });
const orderRow = (id) => prisma.order.findUnique({ where: { id }, include: { items: true } });

async function readyOrder(items = [{ productId: 'sku-rice', qty: 1 }]) {
  const date = freshDate();
  const order = await orderFor(date, items);
  const vendors = new Set(await vendorIdsOf(order.id));
  for (const v of vendors) expect((await pickup(date, v)).status).toBe(201);
  expect((await arrive(date)).status).toBe(200);
  return { date, order };
}

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  vendorBalances = await prisma.vendor.findMany({ select: { id: true, payoutBalanceKobo: true } });
  const passwordHash = await hashPassword('longenough1');
  for (const key of ['ada', 'bayo']) {
    const u = await prisma.user.create({
      data: { name: `Test ${key}`, email: `${key}${TEST_DOMAIN}`, passwordHash, role: 'STUDENT', walletBalanceKobo: 1_000_000 * N },
    });
    tokens[key] = signToken(u);
    ids[key] = u.id;
  }
  tokens.rider = await tokenFor('tunde.dispatch@lodgemart.ng');
  tokens.emeka = await tokenFor('ogaemeka@lodgemart.ng');
  tokens.ngozi = await tokenFor('mamangozi@lodgemart.ng');
  tokens.admin = await tokenFor('ops@lodgemart.ng');
});

beforeEach(async () => {
  await clearKeys();
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty, wholesalePriceKobo: row.wholesalePriceKobo },
    });
  }
});

afterAll(async () => {
  const studentIds = [ids.ada, ids.bayo];
  const testOrders = await prisma.order.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } });
  const orderIds = testOrders.map((o) => o.id);
  const jan2025 = { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2025-03-01T00:00:00Z') };
  await prisma.riderEarning.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.stallPickup.deleteMany({ where: { batchDate: jan2025 } });
  await prisma.hubArrival.deleteMany({ where: { batchDate: jan2025 } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty, wholesalePriceKobo: row.wholesalePriceKobo },
    });
  }
  for (const v of vendorBalances) await prisma.vendor.update({ where: { id: v.id }, data: { payoutBalanceKobo: v.payoutBalanceKobo } });
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ---------------------------------------------------------------------------
describe('cutoff helper (unit)', () => {
  const slot = { cutoffTime: '12:15' };
  it('past days are open, future days closed, today depends on Lagos time', () => {
    expect(isPastCutoff(slot, new Date('2026-11-26T00:00:00Z'), new Date('2026-11-27T08:00:00Z'))).toBe(true);
    expect(isPastCutoff(slot, new Date('2026-11-28T00:00:00Z'), new Date('2026-11-27T20:00:00Z'))).toBe(false);
    expect(isPastCutoff(slot, new Date('2026-11-27T00:00:00Z'), new Date('2026-11-27T11:00:00Z'))).toBe(false); // 12:00 Lagos
    expect(isPastCutoff(slot, new Date('2026-11-27T00:00:00Z'), new Date('2026-11-27T11:30:00Z'))).toBe(true); // 12:30 Lagos
  });
});

describe('access control', () => {
  it('only vendors reach /api/vendor and only riders reach /api/rider', async () => {
    expect((await request(app).get('/api/vendor/items').set(as('ada'))).status).toBe(403);
    expect((await request(app).get('/api/vendor/items').set(as('rider'))).status).toBe(403);
    expect((await request(app).get('/api/rider/earnings').set(as('emeka'))).status).toBe(403);
    expect((await request(app).get('/api/rider/earnings').set(as('ada'))).status).toBe(403);
    expect((await request(app).get('/api/rider/earnings')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('vendor: packing', () => {
  it("lists only my stall's items, without PINs or student details", async () => {
    const date = freshDate();
    await orderFor(date, [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 1 }]);
    const res = await request(app).get(`/api/vendor/items?batchDate=${date}`).set(as('emeka'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ product: { id: 'sku-rice' }, wholesaleCostKobo: 4700 * N, vendorPacked: false });
    const text = JSON.stringify(res.body);
    for (const leak of ['pickupPin', 'email', 'phone', 'Test ada']) expect(text).not.toContain(leak);
  });

  it('packing every item moves the order to PACKED_AT_MARKET; unpacking moves it back', async () => {
    const order = await orderFor(freshDate(), [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-garri', qty: 1 }]);
    const [a, b] = order.items.map((i) => i.id);
    const pack = (id, packed) => request(app).patch(`/api/vendor/items/${id}/packed`).set(as('emeka')).send({ packed });

    expect((await pack(a, true)).body.orderStatus).toBe('ORDER_PLACED');
    expect((await pack(b, true)).body.orderStatus).toBe('PACKED_AT_MARKET');
    expect((await orderRow(order.id)).status).toBe('PACKED_AT_MARKET');
    expect((await pack(b, false)).body.orderStatus).toBe('ORDER_PLACED');
  });

  it("can't pack another stall's item (404) or a cancelled order's item (409)", async () => {
    const order = await orderFor(freshDate(), [{ productId: 'sku-rice', qty: 1 }], { beforeLock: cancelAs('ada') });
    const itemId = order.items[0].id;
    expect((await request(app).patch(`/api/vendor/items/${itemId}/packed`).set(as('ngozi')).send({ packed: true })).status).toBe(404);
    const res = await request(app).patch(`/api/vendor/items/${itemId}/packed`).set(as('emeka')).send({ packed: true });
    expect(res.status).toBe(409);
  });
});

describe('vendor: inventory', () => {
  it('updates my own price and stock, which routing then uses', async () => {
    const res = await request(app).put('/api/vendor/inventory/sku-rice').set(as('emeka'))
      .send({ wholesalePriceKobo: 4800 * N, stockQty: 7 });
    expect(res.status).toBe(200);
    expect(res.body.inventory).toEqual({ productId: 'sku-rice', wholesalePriceKobo: 480000, stockQty: 7 });
    const chidi = await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId: 'v-chidi', productId: 'sku-rice' } } });
    expect(chidi.stockQty).toBe(20); // other stalls untouched
  });

  it('can add a product it did not stock before', async () => {
    const res = await request(app).put('/api/vendor/inventory/sku-milo').set(as('emeka')).send({ wholesalePriceKobo: 5000 * N, stockQty: 3 });
    expect(res.status).toBe(200);
    await prisma.vendorInventory.delete({ where: { vendorId_productId: { vendorId: 'v-emeka', productId: 'sku-milo' } } });
  });

  it.each([
    ['negative stock', { wholesalePriceKobo: 1000, stockQty: -1 }],
    ['fractional price', { wholesalePriceKobo: 10.5, stockQty: 1 }],
    ['extra fields', { wholesalePriceKobo: 1000, stockQty: 1, vendorId: 'v-ngozi' }],
  ])('rejects %s', async (_l, body) => {
    expect((await request(app).put('/api/vendor/inventory/sku-rice').set(as('emeka')).send(body)).status).toBe(400);
  });

  it('404 for an unknown product', async () => {
    expect((await request(app).put('/api/vendor/inventory/sku-nope').set(as('emeka')).send({ wholesalePriceKobo: 1, stockQty: 1 })).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('rider: manifest', () => {
  it('groups by stall and hub, shows the recipient (delegate) but never PINs or wholesale costs', async () => {
    const date = freshDate();
    const o1 = await orderFor(date, [{ productId: 'sku-rice', qty: 2 }, { productId: 'sku-beans', qty: 1 }]);
    await orderFor(date, [{ productId: 'sku-garri', qty: 1 }], { hubId: 'school-gate', who: 'bayo' });
    await request(app).post(`/api/orders/${o1.id}/delegate`).set(as('ada')).send({ name: 'Obinna Roommate', phone: '08035556666' });

    const res = await request(app).get(`/api/rider/manifest?batchDate=${date}&batchSlotId=evening`).set(as('rider'));
    expect(res.status).toBe(200);
    expect(res.body.batch).toMatchObject({ batchDate: date, pickupOpen: true });
    expect(res.body.stalls.map((s) => s.vendor.id).sort()).toEqual(['v-emeka', 'v-ngozi']);
    expect(res.body.stalls.find((s) => s.vendor.id === 'v-emeka').items).toHaveLength(2);
    const dynamo = res.body.hubs.find((h) => h.hub.id === 'dynamo-junction');
    expect(dynamo.orders[0]).toMatchObject({ id: o1.id, recipientName: 'Obinna Roommate (Delegate)', requiresBagMerge: true });
    const text = JSON.stringify(res.body);
    for (const leak of ['pickupPin', 'wholesale', 'email', '08035556666']) expect(text).not.toContain(leak);
  });

  it('validates the query', async () => {
    expect((await request(app).get('/api/rider/manifest?batchDate=tomorrow&batchSlotId=evening').set(as('rider'))).status).toBe(400);
  });
});

describe('rider: stall pickup', () => {
  it('collects only THIS batch (prototype bug fix) and pays the vendor 100% immediately', async () => {
    const dateA = freshDate();
    const dateB = freshDate();
    const a = await orderFor(dateA, [{ productId: 'sku-rice', qty: 2 }]);
    const b = await orderFor(dateB, [{ productId: 'sku-garri', qty: 1 }]);

    const balanceBefore = (await prisma.vendor.findUnique({ where: { id: 'v-emeka' } })).payoutBalanceKobo;
    const res = await pickup(dateA, 'v-emeka');
    expect(res.status).toBe(201);
    // Zero holdback: the (fake) Monnify transfer succeeds before the rider leaves the stall.
    expect(res.body).toMatchObject({ itemsCollected: 1, payoutKobo: 2 * 4700 * N, payoutStatus: 'PAID', ordersInTransit: 1 });

    expect((await orderRow(a.id)).status).toBe('RIDER_IN_TRANSIT');
    const untouched = await orderRow(b.id);
    expect(untouched.status).toBe('ORDER_PLACED');
    expect(untouched.items[0].riderPickedUp).toBe(false);

    const dash = await request(app).get('/api/vendor/dashboard').set(as('emeka'));
    expect(dash.body.vendor.payoutBalanceKobo).toBe(balanceBefore + 2 * 4700 * N);
    expect(dash.body.stallPickups[0]).toMatchObject({ batchDate: dateA, payoutStatus: 'PAID' });
  });

  it('pays the wholesale price at order time, even if the vendor changes it later', async () => {
    const date = freshDate();
    await orderFor(date, [{ productId: 'sku-rice', qty: 1 }]);
    await request(app).put('/api/vendor/inventory/sku-rice').set(as('emeka')).send({ wholesalePriceKobo: 9999 * N, stockQty: 40 });
    expect((await pickup(date, 'v-emeka')).body.payoutKobo).toBe(4700 * N);
  });

  it('one pickup (and payout) per stall per batch', async () => {
    const date = freshDate();
    await orderFor(date, [{ productId: 'sku-rice', qty: 1 }]);
    const results = await Promise.all([pickup(date, 'v-emeka'), pickup(date, 'v-emeka')]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.stallPickup.count({ where: { vendorId: 'v-emeka', batchDate: new Date(`${date}T00:00:00Z`) } })).toBe(1);
  });

  it('split order stays at the market until every stall is collected', async () => {
    const date = freshDate();
    const order = await orderFor(date, [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 1 }]);
    await pickup(date, 'v-emeka');
    expect((await orderRow(order.id)).status).toBe('ORDER_PLACED');
    await pickup(date, 'v-ngozi');
    expect((await orderRow(order.id)).status).toBe('RIDER_IN_TRANSIT');
  });

  it('refuses before the cutoff, with nothing to collect, and non-https photos', async () => {
    const tomorrow = toDateString(new Date(Date.now() + 2 * 86_400_000));
    expect((await pickup(tomorrow, 'v-emeka')).body.error.code).toBe('BEFORE_CUTOFF');
    expect((await pickup(freshDate(), 'v-emeka')).body.error.code).toBe('NOTHING_TO_COLLECT');
    const res = await request(app).post('/api/rider/stall-pickups').set(as('rider'))
      .send({ vendorId: 'v-emeka', batchDate: freshDate(), batchSlotId: 'evening', photoUrl: 'http://x.com/a.jpg' });
    expect(res.status).toBe(400);
  });

  it('skips cancelled orders', async () => {
    const date = freshDate();
    await orderFor(date, [{ productId: 'sku-rice', qty: 1 }], { beforeLock: cancelAs('ada') });
    expect((await pickup(date, 'v-emeka')).body.error.code).toBe('NOTHING_TO_COLLECT');
  });
});

describe('cancel vs pickup', () => {
  // Pickups only happen after the cutoff and cancelling stops at the cutoff,
  // so the two can never overlap: a locked order is refused before any refund.
  it('cannot cancel once the batch is with the vendors, before or after a stall pickup', async () => {
    const date = freshDate();
    const order = await orderFor(date, [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-beans', qty: 1 }]);
    const before = (await prisma.user.findUnique({ where: { id: ids.ada } })).walletBalanceKobo;
    const locked = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('BATCH_LOCKED');
    await pickup(date, 'v-emeka');
    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'))).body.error.code).toBe('BATCH_LOCKED');
    expect((await prisma.user.findUnique({ where: { id: ids.ada } })).walletBalanceKobo).toBe(before);
    expect((await orderRow(order.id)).status).not.toBe('CANCELLED');
  });
});

// ---------------------------------------------------------------------------
describe('rider: hub arrival', () => {
  it('makes in-transit orders for that hub ready; other hubs untouched; repeatable', async () => {
    const date = freshDate();
    const here = await orderFor(date, [{ productId: 'sku-rice', qty: 1 }]);
    const there = await orderFor(date, [{ productId: 'sku-garri', qty: 1 }], { hubId: 'school-gate', who: 'bayo' });
    await pickup(date, 'v-emeka');

    const res = await arrive(date);
    expect(res.body.ordersReady).toBe(1);
    expect((await orderRow(here.id)).status).toBe('READY_AT_HUB');
    expect((await orderRow(there.id)).status).toBe('RIDER_IN_TRANSIT');
    const again = await arrive(date);
    expect(again.status).toBe(200);
    expect(again.body.arrivedAt).toBe(res.body.arrivedAt);
  });
});

describe('rider: PIN handover', () => {
  it('right PIN collects once, pays ₦150 commission once, records the recipient', async () => {
    const { order } = await readyOrder();
    const wrong = await handover(order.id, order.pickupPin === '1234' ? '4321' : '1234');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details.attemptsLeft).toBe(4);

    const ok = await handover(order.id, order.pickupPin);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'COLLECTED', deliveredTo: 'Test ada', earnedKobo: 150 * N });

    const again = await handover(order.id, order.pickupPin);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_COLLECTED');
    expect(await prisma.riderEarning.count({ where: { orderId: order.id } })).toBe(1);

    const mine = await request(app).get(`/api/orders/${order.id}`).set(as('ada'));
    expect(mine.body.order).toMatchObject({ status: 'COLLECTED', deliveredTo: 'Test ada' });
  });

  it('delegate collects with the NEW pin; the old pin no longer works', async () => {
    const { order } = await readyOrder();
    const del = await request(app).post(`/api/orders/${order.id}/delegate`).set(as('ada')).send({ name: 'Obinna Roommate', phone: '08035556666' });
    if (del.body.pickupPin !== order.pickupPin) {
      expect((await handover(order.id, order.pickupPin)).status).toBe(400);
    }
    const ok = await handover(order.id, del.body.pickupPin);
    expect(ok.body.deliveredTo).toBe('Obinna Roommate (Delegate)');
  });

  it('refuses orders that are not at the hub yet', async () => {
    const order = await orderFor(freshDate(), [{ productId: 'sku-rice', qty: 1 }]);
    const res = await handover(order.id, order.pickupPin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_READY');
  });

  it('locks the order after 5 attempts — even the right PIN is refused', async () => {
    const { order } = await readyOrder();
    const wrongPin = order.pickupPin === '1111' ? '2222' : '1111';
    for (let i = 0; i < 5; i++) expect((await handover(order.id, wrongPin)).status).toBe(400);
    const locked = await handover(order.id, order.pickupPin);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('PIN_LOCKED');
    expect((await orderRow(order.id)).status).toBe('READY_AT_HUB');
  });

  it('parallel guesses cannot exceed the 5-attempt limit', async () => {
    const { order } = await readyOrder();
    const guesses = Array.from({ length: 12 }, (_, i) => String(1000 + i)).filter((p) => p !== order.pickupPin).slice(0, 10);
    const results = await Promise.all(guesses.map((p) => handover(order.id, p)));
    expect(results.filter((r) => r.status === 400)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
  });

  it('parallel correct submissions: exactly one wins, one commission', async () => {
    const { order } = await readyOrder();
    const results = await Promise.all([1, 2, 3].map(() => handover(order.id, order.pickupPin)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await prisma.riderEarning.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('rejects malformed PINs', async () => {
    const { order } = await readyOrder();
    for (const pin of ['123', '12345', 'abcd']) expect((await handover(order.id, pin)).status).toBe(400);
    expect((await orderRow(order.id)).status).toBe('READY_AT_HUB');
  });

  it('earnings add up', async () => {
    const before = (await request(app).get('/api/rider/earnings').set(as('rider'))).body;
    const { order } = await readyOrder();
    await handover(order.id, order.pickupPin);
    const after = (await request(app).get('/api/rider/earnings').set(as('rider'))).body;
    expect(after.totalKobo - before.totalKobo).toBe(150 * N);
    expect(after.deliveries - before.deliveries).toBe(1);
    expect(after.recent[0].orderLabel).toBe(`#${order.orderNumber}`);
  });
});

describe('batchDateFor sanity', () => {
  it('orders placed now never land in a batch whose pickup is already open', () => {
    const slot = { cutoffTime: '12:15' };
    const now = new Date();
    expect(isPastCutoff(slot, batchDateFor(slot, now), now)).toBe(false);
  });
});
