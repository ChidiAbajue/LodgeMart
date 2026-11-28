import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { quoteDelivery } from '../src/utils/deliveryFee.js';
import { routeBasket } from '../src/services/routingService.js';
import { toDateString } from '../src/utils/batchDate.js';

// Chidi's updated business rules: tiered delivery fee + bulk surcharge,
// junction-kiosk fallback after a 20-minute hub wait, Priority Supplier Tier,
// "Missing item" tag + replacement credit, delegate shown on the rider screen.
const app = createApp();
const TEST_DOMAIN = '@phase8.test';
const N = 100;
const PHOTO = 'https://res.cloudinary.com/lodgemart-test/image/upload/v1/lodgemart/stall-pickups/s.jpg';
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday', paymentMethod: 'WALLET' };

let inventorySnapshot, vendorSnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
let dayCounter = 0;
const freshDate = () => toDateString(new Date(Date.UTC(2022, 0, 1 + dayCounter++)));

async function clearKeys() {
  const keys = [...(await redis.keys('rl:*')), ...(await redis.keys('pin:fail:*'))];
  if (keys.length) await redis.del(...keys);
}
const place = (items, who = 'ada') => request(app).post('/api/orders').set(as(who)).send({ ...BASE, items });
async function orderAt(date, items) {
  const res = await place(items);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  await prisma.order.update({ where: { id: res.body.order.id }, data: { batchDate: new Date(`${date}T00:00:00Z`) } });
  return res.body.order;
}
async function readyAtHub(items = [{ productId: 'sku-rice', qty: 1 }]) {
  const date = freshDate();
  const order = await orderAt(date, items);
  for (const v of new Set(order.items.map((i) => i.vendor.id))) {
    await request(app).post('/api/rider/stall-pickups').set(as('rider')).send({ vendorId: v, batchDate: date, batchSlotId: 'midday', photoUrl: PHOTO });
  }
  await request(app).post('/api/rider/hub-arrivals').set(as('rider')).send({ hubId: 'dynamo-junction', batchDate: date, batchSlotId: 'midday' });
  return { date, order };
}
const kiosk = (orderId) => request(app).post('/api/rider/kiosk-drop').set(as('rider')).send({ orderId });

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  vendorSnapshot = await prisma.vendor.findMany();
  const passwordHash = await hashPassword('longenough1');
  const u = await prisma.user.create({
    data: { name: 'Test Ada', email: `ada${TEST_DOMAIN}`, passwordHash, role: 'STUDENT', walletBalanceKobo: 1_000_000 * N },
  });
  tokens.ada = signToken(u);
  ids.ada = u.id;
  for (const [key, email] of [['rider', 'tunde.dispatch@lodgemart.ng'], ['admin', 'ops@lodgemart.ng'], ['emeka', 'ogaemeka@lodgemart.ng']]) {
    const s = await prisma.user.findUnique({ where: { email } });
    tokens[key] = signToken(s);
    ids[key] = s.id;
  }
});

async function restore() {
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: { ratingScore: v.ratingScore, ratingCount: v.ratingCount, priorityTier: v.priorityTier, payoutBalanceKobo: v.payoutBalanceKobo },
    });
  }
}
beforeEach(async () => {
  await clearKeys();
  await restore();
});
afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { studentId: ids.ada }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const before2023 = { lt: new Date('2023-01-01T00:00:00Z') };
  await prisma.riderEarning.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.stallPickup.deleteMany({ where: { batchDate: before2023 } });
  await prisma.hubArrival.deleteMany({ where: { batchDate: before2023 } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  await restore();
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ===========================================================================
describe('tiered delivery fee (unit, matches calculateDeliveryFee in the prototype)', () => {
  const line = (naira, qty = 1, isBulkItem = false) => ({ qty, product: { studentPriceKobo: naira * N, isBulkItem } });
  const fee = (...lines) => quoteDelivery(lines).deliveryFeeKobo / N;
  it.each([
    [1, 350], [10_000, 350], // standard basket ₦1 – ₦10,000
    [10_001, 600], [20_000, 600], // large basket
    [20_001, 850], [30_000, 850], [30_001, 1100], // +₦250 per extra ₦10,000 bracket
  ])('₦%i basket → ₦%i', (basket, expected) => {
    expect(fee(line(basket))).toBe(expected);
  });
  it('adds ₦250 for every bulk item (per unit)', () => {
    expect(quoteDelivery([line(8400, 2, true), line(500)])).toMatchObject({
      subtotalKobo: 17_300 * N, baseFeeKobo: 600 * N, bulkSurchargeKobo: 500 * N, deliveryFeeKobo: 1100 * N, bulkCount: 2,
    });
  });
  it('empty basket costs nothing', () => {
    expect(quoteDelivery([])).toMatchObject({ deliveryFeeKobo: 0, subtotalKobo: 0 });
  });
});

describe('delivery fee at checkout', () => {
  it('charges the bulk surcharge for an Indomie carton and stores the breakdown', async () => {
    const res = await place([{ productId: 'sku-indomie', qty: 1 }, { productId: 'sku-oil', qty: 1 }]);
    expect(res.status).toBe(201);
    const o = res.body.order;
    expect(o.subtotalKobo).toBe((8400 + 2650) * N); // ₦11,050 → ₦600 base
    expect(o.bulkSurchargeKobo).toBe(250 * N);
    expect(o.deliveryFeeKobo).toBe(850 * N);
    expect(o.totalKobo).toBe((11_050 + 850) * N);
  });
});

// ===========================================================================
describe('Priority Supplier Tier', () => {
  const v = (id, rating, priority, price) => ({
    id, rating, priority, inventory: new Map([['rice', { wholesalePriceKobo: price, stockQty: 10 }]]),
  });
  it('priority vendors get first pick ahead of a higher-rated vendor (unit)', () => {
    const r = routeBasket([{ productId: 'rice', qty: 1 }], [v('v-top', 4.9, false, 4000), v('v-prio', 4.6, true, 4800)]);
    expect(r.assignments[0].vendorId).toBe('v-prio');
  });

  it('admin can only switch it on for vendors rated 4.5★ or more', async () => {
    const chidi = await request(app).patch('/api/admin/vendors/v-chidi').set(as('admin')).send({ priorityTier: true });
    expect(chidi.status).toBe(409);
    expect(chidi.body.error.code).toBe('NOT_ELIGIBLE');
    const off = await request(app).patch('/api/admin/vendors/v-ngozi').set(as('admin')).send({ priorityTier: false });
    expect(off.body.vendor.priorityTier).toBe(false);
    const on = await request(app).patch('/api/admin/vendors/v-ngozi').set(as('admin')).send({ priorityTier: true });
    expect(on.body.vendor.priorityTier).toBe(true);
    const list = await request(app).get('/api/admin/summary').set(as('admin'));
    expect(list.body.vendors.find((x) => x.id === 'v-emeka').priorityTier).toBe(true);
    const dash = await request(app).get('/api/vendor/dashboard').set(as('emeka'));
    expect(dash.body.vendor.priorityTier).toBe(true);
  });

  it('is lost automatically when a rating drops the vendor below 4.5★', async () => {
    await prisma.vendor.update({ where: { id: 'v-emeka' }, data: { ratingScore: 4.5, ratingCount: 1 } });
    const { order } = await readyAtHub();
    await request(app).post('/api/rider/handover').set(as('rider')).send({ orderId: order.id, pin: order.pickupPin });
    const rice = order.items.find((i) => i.productId === 'sku-rice');
    const res = await request(app).post(`/api/orders/${order.id}/rating`).set(as('ada'))
      .send({ stars: 2, flaggedItems: [{ itemId: rice.id, issueTag: 'Missing item' }] });
    expect(res.status).toBe(200);
    const emeka = await prisma.vendor.findUnique({ where: { id: 'v-emeka' } });
    expect(Number(emeka.ratingScore)).toBeLessThan(4.5);
    expect(emeka.priorityTier).toBe(false);
  });
});

// ===========================================================================
describe('ratings: "Missing item" + replacement credit', () => {
  it('flagging an item earns a replacement credit; a happy rating does not', async () => {
    const a = await readyAtHub();
    await request(app).post('/api/rider/handover').set(as('rider')).send({ orderId: a.order.id, pin: a.order.pickupPin });
    const flagged = await request(app).post(`/api/orders/${a.order.id}/rating`).set(as('ada'))
      .send({ stars: 1, flaggedItems: [{ itemId: a.order.items[0].id, issueTag: 'Missing item' }] });
    expect(flagged.body.replacementCredit).toBe(true);
    expect((await request(app).get(`/api/orders/${a.order.id}`).set(as('ada'))).body.order.replacementCredit).toBe(true);

    const b = await readyAtHub();
    await request(app).post('/api/rider/handover').set(as('rider')).send({ orderId: b.order.id, pin: b.order.pickupPin });
    const happy = await request(app).post(`/api/orders/${b.order.id}/rating`).set(as('ada')).send({ stars: 5 });
    expect(happy.body.replacementCredit).toBe(false);
  });

  it('old tag spellings are rejected', async () => {
    const { order } = await readyAtHub();
    await request(app).post('/api/rider/handover').set(as('rider')).send({ orderId: order.id, pin: order.pickupPin });
    const res = await request(app).post(`/api/orders/${order.id}/rating`).set(as('ada'))
      .send({ stars: 2, flaggedItems: [{ itemId: order.items[0].id, issueTag: 'Weevils/Dusty' }] });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
describe('hub dwell timer + junction kiosk fallback', () => {
  it('the manifest shows the 20-minute window and the delegate "for" the student', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-rice', qty: 1 }]);
    await request(app).post(`/api/orders/${order.id}/delegate`).set(as('ada')).send({ name: 'Obinna Okeke', phone: '08035556666' });
    await request(app).post('/api/rider/stall-pickups').set(as('rider')).send({ vendorId: 'v-emeka', batchDate: date, batchSlotId: 'midday', photoUrl: PHOTO });
    await request(app).post('/api/rider/hub-arrivals').set(as('rider')).send({ hubId: 'dynamo-junction', batchDate: date, batchSlotId: 'midday' });

    const res = await request(app).get(`/api/rider/manifest?batchDate=${date}&batchSlotId=midday`).set(as('rider'));
    const hub = res.body.hubs[0];
    expect(res.body.hubDwellMinutes).toBe(20);
    expect(new Date(hub.dwellEndsAt) - new Date(hub.arrivedAt)).toBe(20 * 60_000);
    expect(hub.orders[0]).toMatchObject({ studentName: 'Test Ada', delegateName: 'Obinna Okeke' });
    expect(JSON.stringify(res.body)).not.toContain('08035556666');
  });

  it('refuses the kiosk before the 20 minutes are up', async () => {
    const { order } = await readyAtHub();
    const res = await kiosk(order.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DWELL_NOT_OVER');
  });

  it('after the wait: the bag goes to the kiosk once, no rider commission, no PIN handover after', async () => {
    const { date, order } = await readyAtHub();
    await prisma.hubArrival.updateMany({
      where: { hubId: 'dynamo-junction', batchDate: new Date(`${date}T00:00:00Z`) },
      data: { arrivedAt: new Date(Date.now() - 21 * 60_000) },
    });
    const res = await kiosk(order.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'LEFT_AT_KIOSK', deliveredTo: 'Partnered Junction Kiosk' });
    expect((await kiosk(order.id)).status).toBe(409);
    expect((await request(app).post('/api/rider/handover').set(as('rider')).send({ orderId: order.id, pin: order.pickupPin })).status).toBe(409);
    expect(await prisma.riderEarning.count({ where: { orderId: order.id } })).toBe(0);

    const mine = await request(app).get(`/api/orders/${order.id}`).set(as('ada'));
    expect(mine.body.order).toMatchObject({ status: 'LEFT_AT_KIOSK', deliveredTo: 'Partnered Junction Kiosk' });
    expect(mine.body.order.leftAtKioskAt).toBeTruthy();
    // The student can still rate it once they've picked it up from the kiosk.
    expect((await request(app).post(`/api/orders/${order.id}/rating`).set(as('ada')).send({ stars: 5 })).status).toBe(200);
  });

  it('only orders waiting at the hub can go to the kiosk; riders only', async () => {
    const order = await orderAt(freshDate(), [{ productId: 'sku-rice', qty: 1 }]);
    expect((await kiosk(order.id)).body.error.code).toBe('NOT_AT_HUB');
    expect((await request(app).post('/api/rider/kiosk-drop').set(as('ada')).send({ orderId: order.id })).status).toBe(403);
  });
});
