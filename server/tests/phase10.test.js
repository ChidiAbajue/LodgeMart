import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redis, connectRedis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';
import { signToken } from '../src/services/tokenService.js';
import { batchDateFor, latestClosedBatchDate, toDateString } from '../src/utils/batchDate.js';

// One evening batch, Monday–Saturday (decision 2026-11-28, Chidi):
// orders 3 PM → 3 PM; at the 3 PM cutoff the batch goes to vendors and
// students can no longer cancel; vendors never see a batch before its cutoff.
const app = createApp();
const TEST_DOMAIN = '@phase10.test';
const N = 100;
const BASE = { zoneId: 'ifite', hubId: 'dynamo-junction', batchSlotId: 'evening', paymentMethod: 'WALLET' };

let inventorySnapshot;
const tokens = {};
const ids = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
let dayCounter = 0;
const freshDate = () => toDateString(new Date(Date.UTC(2020, 0, 1 + dayCounter++)));

async function clearKeys() {
  const keys = await redis.keys('rl:*');
  if (keys.length) await redis.del(...keys);
}
const place = async (items = [{ productId: 'sku-rice', qty: 1 }]) => {
  const res = await request(app).post('/api/orders').set(as('ada')).send({ ...BASE, items });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.order;
};
const moveTo = (order, date) =>
  prisma.order.update({ where: { id: order.id }, data: { batchDate: new Date(`${date}T00:00:00Z`) } });
const vendorItemIds = async (who) =>
  (await request(app).get('/api/vendor/items').set(as(who))).body.items.map((i) => i.order.id);

beforeAll(async () => {
  if (!process.env.REDIS_URL.endsWith('/1')) throw new Error('Tests must use Redis DB 1');
  await connectRedis();
  await clearKeys();
  inventorySnapshot = await prisma.vendorInventory.findMany();
  const u = await prisma.user.create({
    data: { name: 'Test ada', email: `ada${TEST_DOMAIN}`, passwordHash: await hashPassword('longenough1'), role: 'STUDENT', walletBalanceKobo: 1_000_000 * N },
  });
  tokens.ada = signToken(u);
  ids.ada = u.id;
  const emeka = await prisma.user.findUnique({ where: { email: 'ogaemeka@lodgemart.ng' } });
  tokens.emeka = signToken(emeka);
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { studentId: ids.ada } });
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  for (const row of inventorySnapshot) {
    await prisma.vendorInventory.update({
      where: { vendorId_productId: { vendorId: row.vendorId, productId: row.productId } },
      data: { stockQty: row.stockQty, wholesalePriceKobo: row.wholesalePriceKobo },
    });
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), (SELECT MAX("orderNumber") FROM "Order"), true)`;
  await clearKeys();
  await prisma.$disconnect();
  await redis.quit();
});

// ---------------------------------------------------------------------------
describe('batch calendar (unit)', () => {
  const evening = { cutoffTime: '15:00' };
  // 2026-11-27 is a Friday, 28 Saturday, 29 Sunday, 30 Monday. Lagos = UTC+1.
  it('before 3 PM joins today, after 3 PM joins tomorrow', () => {
    expect(toDateString(batchDateFor(evening, new Date('2026-11-27T13:59:00Z')))).toBe('2026-11-27'); // Fri 14:59
    expect(toDateString(batchDateFor(evening, new Date('2026-11-27T14:00:00Z')))).toBe('2026-11-28'); // Fri 15:00
  });
  it('skips Sunday: after Saturday\'s cutoff and all of Sunday go to Monday', () => {
    expect(toDateString(batchDateFor(evening, new Date('2026-11-28T13:00:00Z')))).toBe('2026-11-28'); // Sat 14:00
    expect(toDateString(batchDateFor(evening, new Date('2026-11-28T15:00:00Z')))).toBe('2026-11-30'); // Sat 16:00
    expect(toDateString(batchDateFor(evening, new Date('2026-11-29T09:00:00Z')))).toBe('2026-11-30'); // Sun 10:00
    expect(toDateString(batchDateFor(evening, new Date('2026-11-29T20:00:00Z')))).toBe('2026-11-30'); // Sun 21:00
  });
  it('latest batch sent to vendors: today after the cutoff, else yesterday', () => {
    expect(toDateString(latestClosedBatchDate(evening, new Date('2026-11-27T13:59:00Z')))).toBe('2026-11-26');
    expect(toDateString(latestClosedBatchDate(evening, new Date('2026-11-27T14:00:00Z')))).toBe('2026-11-27');
  });
});

describe('catalog and ordering', () => {
  it('offers only the evening batch, cutoff 3 PM, pickup from 5 PM', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.body.batchSlots).toHaveLength(1);
    expect(res.body.batchSlots[0]).toMatchObject({ id: 'evening', cutoffTime: '15:00', startTime: '17:00' });
    expect(new Date(`${res.body.batchSlots[0].nextBatchDate}T12:00:00Z`).getUTCDay()).not.toBe(0); // never Sunday
  });
  it('refuses the retired morning/midday slots', async () => {
    for (const batchSlotId of ['early', 'midday']) {
      const res = await request(app).post('/api/orders').set(as('ada')).send({ ...BASE, batchSlotId, items: [{ productId: 'sku-rice', qty: 1 }] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BATCH_SLOT');
    }
  });
});

describe('before the cutoff (batch open)', () => {
  it('the student can cancel, the order shows as not locked', async () => {
    const order = await place();
    expect(order.batchLocked).toBe(false);
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(res.status).toBe(200);
  });
  it('vendors cannot see or pack it yet', async () => {
    const order = await place();
    expect(await vendorItemIds('emeka')).not.toContain(order.id);
    const res = await request(app).patch(`/api/vendor/items/${order.items[0].id}/packed`).set(as('emeka')).send({ packed: true });
    expect(res.status).toBe(404);
  });
});

describe('after the cutoff (batch sent to vendors)', () => {
  it('vendors see it; the student can no longer cancel', async () => {
    const order = await place();
    await moveTo(order, freshDate());
    expect(await vendorItemIds('emeka')).toContain(order.id);
    const view = await request(app).get(`/api/orders/${order.id}`).set(as('ada'));
    expect(view.body.order.batchLocked).toBe(true);
    const before = (await prisma.user.findUnique({ where: { id: ids.ada } })).walletBalanceKobo;
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATCH_LOCKED');
    expect((await prisma.user.findUnique({ where: { id: ids.ada } })).walletBalanceKobo).toBe(before);
  });
  it('orders cancelled before the cutoff never reach the vendor', async () => {
    const order = await place();
    await request(app).post(`/api/orders/${order.id}/cancel`).set(as('ada'));
    await moveTo(order, freshDate());
    expect(await vendorItemIds('emeka')).not.toContain(order.id);
  });
});
