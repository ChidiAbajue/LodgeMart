import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { toDateString } from '../src/utils/batchDate.js';

// 3-layer price-spike safeguard (Act 3 of Chidi's story) + admin vendor goods view.
const app = createApp();
const TEST_DOMAIN = '@phase9.test';
const N = 100;
const PHOTO = 'https://res.cloudinary.com/lodgemart-test/image/upload/v1/lodgemart/stall-pickups/s.jpg';
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'midday', paymentMethod: 'WALLET' };

let inventorySnapshot, vendorSnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
let dayCounter = 0;
const freshDate = () => toDateString(new Date(Date.UTC(2021, 0, 1 + dayCounter++)));
const stock = async (vendorId, productId) =>
  (await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId, productId } } })).stockQty;
const wallet = async () => (await prisma.user.findUnique({ where: { id: ids.ada } })).walletBalanceKobo;
const itemRow = (id) => prisma.orderItem.findUnique({ where: { id } });
const orderRow = (id) => prisma.order.findUnique({ where: { id } });

async function clearKeys() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}
async function orderAt(date, items) {
  const res = await request(app).post('/api/orders').set(as('ada')).send({ ...BASE, items });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  await prisma.order.update({ where: { id: res.body.order.id }, data: { batchDate: new Date(`${date}T00:00:00Z`) } });
  return res.body.order;
}
const item = (order, productId) => order.items.find((i) => i.productId === productId);
const reportAsVendor = (who, body) => request(app).post('/api/vendor/price-change').set(as(who)).send({ batchSlotId: 'midday', ...body });

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
  for (const [key, email] of [['rider', 'tunde.dispatch@lodgemart.ng'], ['admin', 'ops@lodgemart.ng'], ['emeka', 'ogaemeka@lodgemart.ng'], ['ngozi', 'mamangozi@lodgemart.ng']]) {
    const s = await prisma.user.findUnique({ where: { email } });
    tokens[key] = signToken(s);
    ids[key] = s.id;
  }
});
async function restore() {
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty, wholesalePriceKobo: row.wholesalePriceKobo },
    });
  }
  for (const v of vendorSnapshot) {
    await prisma.vendor.update({
      where: { id: v.id },
      data: { ratingScore: v.ratingScore, priorityTier: v.priorityTier, payoutBalanceKobo: v.payoutBalanceKobo },
    });
  }
}
beforeEach(async () => {
  await clearKeys();
  await restore();
  await prisma.user.update({ where: { id: ids.ada }, data: { walletBalanceKobo: 1_000_000 * N } });
});
afterAll(async () => {
  const orders = await prisma.order.findMany({ where: { studentId: ids.ada }, select: { id: true } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await prisma.stallPickup.deleteMany({ where: { batchDate: { lt: new Date('2022-01-01T00:00:00Z') } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  await restore();
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ===========================================================================
describe('layer 1: small rise (≤ ₦150) is absorbed by LodgeMart', () => {
  it('vendor is paid the new price; the student pays nothing extra', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-rice', qty: 2 }]);
    const before = await wallet();
    const res = await reportAsVendor('emeka', { productId: 'sku-rice', batchDate: date, newWholesalePriceKobo: 4850 * N });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ absorbed: 1, reassigned: 0, refunded: 0, absorbedKobo: 2 * 150 * N });
    expect(await itemRow(item(order, 'sku-rice').id)).toMatchObject({ wholesaleCostKobo: 4850 * N, priceAdjustmentKobo: 300 * N });
    expect(await wallet()).toBe(before);
    expect((await orderRow(order.id)).totalKobo).toBe(order.totalKobo);

    // The stall payout uses the new price.
    const pickup = await request(app).post('/api/rider/stall-pickups').set(as('rider'))
      .send({ vendorId: 'v-emeka', batchDate: date, batchSlotId: 'midday', photoUrl: PHOTO });
    expect(pickup.body.payoutKobo).toBe(2 * 4850 * N);
  });

  it('a price drop changes nothing already ordered, but future orders use it', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-garri', qty: 1 }]);
    const res = await reportAsVendor('emeka', { productId: 'sku-garri', batchDate: date, newWholesalePriceKobo: 2000 * N });
    expect(res.body.unchanged).toBe(1);
    expect((await itemRow(item(order, 'sku-garri').id)).wholesaleCostKobo).toBe(2450 * N);
    const inv = await prisma.vendorInventory.findUnique({ where: { vendorId_productId: { vendorId: 'v-emeka', productId: 'sku-garri' } } });
    expect(inv.wholesalePriceKobo).toBe(2000 * N);
  });
});

describe('layer 2: big rise switches to another verified trader at the locked price', () => {
  it('moves the line item to Brother Chidi and returns Emeka\'s stock', async () => {
    await prisma.vendor.update({ where: { id: 'v-chidi' }, data: { ratingScore: 4.0 } }); // now verified (≥ 3.5★)
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-rice', qty: 1 }, { productId: 'sku-oil', qty: 1 }]);
    expect(item(order, 'sku-rice').vendor.id).toBe('v-emeka');

    const res = await reportAsVendor('emeka', { productId: 'sku-rice', batchDate: date, newWholesalePriceKobo: 5200 * N });
    expect(res.body).toMatchObject({ reassigned: 1, refunded: 0 });
    expect(res.body.items[0]).toMatchObject({ result: 'REASSIGNED', toVendorId: 'v-chidi' });
    const rice = await itemRow(item(order, 'sku-rice').id);
    expect(rice).toMatchObject({ vendorId: 'v-chidi', wholesaleCostKobo: 4650 * N, reassignedFromVendorId: 'v-emeka', vendorPacked: false });
    expect(await stock('v-emeka', 'sku-rice')).toBe(45); // back on Emeka's shelf
    expect(await stock('v-chidi', 'sku-rice')).toBe(19);
    expect((await orderRow(order.id)).requiresBagMerge).toBe(true); // rice (Chidi) + oil (Emeka)

    const chidiItems = await prisma.orderItem.count({ where: { orderId: order.id, vendorId: 'v-chidi' } });
    expect(chidiItems).toBe(1);
  });

  it('never moves items to a stall the rider has already left', async () => {
    await prisma.vendor.update({ where: { id: 'v-chidi' }, data: { ratingScore: 4.0 } });
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-rice', qty: 1 }]);
    // Chidi was already collected from in this batch (a stall pickup exists).
    await prisma.stallPickup.create({
      data: { vendorId: 'v-chidi', riderId: ids.rider, batchSlotId: 'midday', batchDate: new Date(`${date}T00:00:00Z`), photoUrl: PHOTO, payoutKobo: 0 },
    });
    const res = await reportAsVendor('emeka', { productId: 'sku-rice', batchDate: date, newWholesalePriceKobo: 5200 * N });
    expect(res.body.refunded).toBe(1);
    expect((await itemRow(item(order, 'sku-rice').id)).vendorId).toBe('v-emeka');
  });
});

describe('layer 3: no trader at the locked price → refund the line item to the wallet', () => {
  it('refunds just that item; the rest of the order carries on', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-beans', qty: 1 }, { productId: 'sku-garri', qty: 1 }]);
    const before = await wallet();
    const res = await reportAsVendor('ngozi', { productId: 'sku-beans', batchDate: date, newWholesalePriceKobo: 6000 * N });
    expect(res.body).toMatchObject({ refunded: 1, refundedKobo: 6100 * N });
    expect(await wallet()).toBe(before + 6100 * N);
    const beans = await itemRow(item(order, 'sku-beans').id);
    expect(beans.refundedAt).not.toBeNull();
    expect(await stock('v-ngozi', 'sku-beans')).toBe(30);
    const row = await orderRow(order.id);
    expect(row.status).toBe('ORDER_PLACED');
    expect(row.requiresBagMerge).toBe(false); // only Emeka's garri is left

    // Refunded items drop out of the vendor's packing list and the rider's run.
    const ngoziItems = await request(app).get(`/api/vendor/items?batchDate=${date}`).set(as('ngozi'));
    expect(ngoziItems.body.items).toHaveLength(0);
    expect((await request(app).post('/api/rider/stall-pickups').set(as('rider'))
      .send({ vendorId: 'v-ngozi', batchDate: date, batchSlotId: 'midday', photoUrl: PHOTO })).body.error.code).toBe('NOTHING_TO_COLLECT');
    const emeka = await request(app).post('/api/rider/stall-pickups').set(as('rider'))
      .send({ vendorId: 'v-emeka', batchDate: date, batchSlotId: 'midday', photoUrl: PHOTO });
    expect(emeka.body.ordersInTransit).toBe(1); // everything still due has been collected

    const mine = await request(app).get(`/api/orders/${order.id}`).set(as('ada'));
    expect(mine.body.order.items.find((i) => i.productId === 'sku-beans').refundKobo).toBe(6100 * N);
  });

  it('if every item is refunded, the delivery fee comes back too and the order closes', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-beans', qty: 1 }]);
    const before = await wallet();
    await reportAsVendor('ngozi', { productId: 'sku-beans', batchDate: date, newWholesalePriceKobo: 6000 * N });
    expect(await wallet()).toBe(before + order.totalKobo);
    expect(await orderRow(order.id)).toMatchObject({ status: 'CANCELLED', refundKobo: order.totalKobo });
  });

  it('cancelling after a partial refund never refunds the same item twice', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-beans', qty: 1 }, { productId: 'sku-garri', qty: 1 }]);
    const before = await wallet();
    await reportAsVendor('ngozi', { productId: 'sku-beans', batchDate: date, newWholesalePriceKobo: 6000 * N });
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(res.status).toBe(200);
    expect(await wallet()).toBe(before + order.totalKobo - 200 * N); // total back, minus the ₦200 fee, once
    expect(await stock('v-ngozi', 'sku-beans')).toBe(30);
    expect(await stock('v-emeka', 'sku-garri')).toBe(60);
  });
});

// ===========================================================================
describe('who can report a price change', () => {
  it('a vendor only ever affects their own stall', async () => {
    const date = freshDate();
    const order = await orderAt(date, [{ productId: 'sku-beans', qty: 1 }]);
    const res = await reportAsVendor('emeka', { productId: 'sku-beans', batchDate: date, newWholesalePriceKobo: 9000 * N });
    expect(res.body).toMatchObject({ absorbed: 0, reassigned: 0, refunded: 0 }); // Emeka sold no beans in it
    expect((await itemRow(item(order, 'sku-beans').id)).refundedAt).toBeNull();
    expect((await reportAsVendor('emeka', { productId: 'sku-beans', batchDate: date, newWholesalePriceKobo: 9000 * N, vendorId: 'v-ngozi' })).status).toBe(400);
  });

  it('an admin can record it on a vendor\'s behalf; students and riders cannot', async () => {
    const date = freshDate();
    await orderAt(date, [{ productId: 'sku-rice', qty: 1 }]);
    const res = await request(app).post('/api/admin/vendors/v-emeka/price-change').set(as('admin'))
      .send({ productId: 'sku-rice', batchDate: date, batchSlotId: 'midday', newWholesalePriceKobo: 4800 * N });
    expect(res.body.absorbed).toBe(1);
    expect((await request(app).post('/api/vendor/price-change').set(as('ada')).send({})).status).toBe(403);
    expect((await request(app).post('/api/admin/vendors/v-emeka/price-change').set(as('rider')).send({})).status).toBe(403);
  });
});

describe('admin: onboarded vendors with their goods and prices', () => {
  it('lists every vendor with what they sell, wholesale price, stock and student price', async () => {
    const res = await request(app).get('/api/admin/vendors').set(as('admin'));
    const emeka = res.body.vendors.find((v) => v.id === 'v-emeka');
    expect(emeka.inventory.find((i) => i.productId === 'sku-rice')).toMatchObject({
      wholesalePriceKobo: 4700 * N, stockQty: 45, product: { name: 'Local Parboiled Rice', studentPriceKobo: 5200 * N },
    });
    const one = await request(app).get('/api/admin/vendors/v-ngozi').set(as('admin'));
    expect(one.body.vendor.inventory.map((i) => i.productId)).toContain('sku-beans');
    expect((await request(app).get('/api/admin/vendors/v-nobody').set(as('admin'))).status).toBe(404);
  });
});
