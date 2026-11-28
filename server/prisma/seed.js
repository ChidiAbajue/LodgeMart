// Loads the prototype's sample data (src/data/seedData.js) into Postgres.
// Prices converted from naira to kobo. Safe to re-run: it wipes and reloads.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
// Same TLS setting as the app (DATABASE_SSL: off | require | verify + DATABASE_CA_CERT).
const ssl = process.env.DATABASE_SSL === 'require'
  ? { rejectUnauthorized: false }
  : process.env.DATABASE_SSL === 'verify'
    ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
    : undefined;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ...(ssl && { ssl }) }),
});
const k = (naira) => naira * 100; // naira -> kobo

// Two modes:
//   SEED_MODE=sample (default)  — WIPES the database and loads the prototype's sample
//                                 data incl. sandbox logins (password123). Dev/test only.
//   SEED_MODE=reference         — production-safe: only adds missing campus zones, hubs,
//                                 batch slots and products. Never deletes or overwrites.
const MODE = process.env.SEED_MODE || 'sample';
if (!['sample', 'reference'].includes(MODE)) throw new Error(`Unknown SEED_MODE "${MODE}"`);
if (process.env.NODE_ENV === 'production' && MODE !== 'reference') {
  console.error('Refusing to run the sample seed in production (it wipes data and creates demo logins).');
  console.error('Use SEED_MODE=reference for zones/hubs/slots/products, and npm run create-admin for the first admin.');
  process.exit(1);
}

// Demo password for the sandbox accounts only. Real users register with their own.
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'password123';
export const BCRYPT_ROUNDS = 12;

const zones = [
  { id: 'ifite', name: 'UNIZIK – Ifite', hubs: ['dynamo-junction', 'school-gate'] },
  { id: 'tempsite', name: 'UNIZIK – Tempsite', hubs: ['aroma-junction', 'school-gate'] },
];
const hubs = [
  { id: 'dynamo-junction', name: 'Dynamo Junction' },
  { id: 'school-gate', name: 'School Gate' },
  { id: 'aroma-junction', name: 'Aroma Junction' },
];
const slots = [
  { id: 'early', label: 'Early Bird', startTime: '07:30', endTime: '08:00', cutoffTime: '06:45', badge: 'Pre-Lecture', sortOrder: 1 },
  { id: 'midday', label: 'Midday Break', startTime: '13:00', endTime: '14:00', cutoffTime: '12:15', badge: 'Most Popular', sortOrder: 2 },
  { id: 'evening', label: 'Evening Hostel', startTime: '17:30', endTime: '18:30', cutoffTime: '16:45', badge: 'After Class', sortOrder: 3 },
];
const products = [
  ['sku-rice', 'Local Parboiled Rice', '1 Paint Bucket (4kg)', 'Grains & Staples', 5200, 6800, '🍚'],
  ['sku-garri', 'Ijebu White Garri', '1 Paint Bucket (3.5kg)', 'Grains & Staples', 2800, 3700, '🥣'],
  ['sku-beans', 'Olo Honey Beans', '1 Paint Bucket (4kg)', 'Grains & Staples', 6100, 7900, '🫘'],
  ['sku-indomie', 'Indomie Chicken (70g)', '1 Carton (40 Packs)', 'Noodles & Pasta', 8400, 10800, '🍜'],
  ['sku-oil', 'Devon King’s Veg Oil', '1 Litre Bottle', 'Cooking Oils', 2650, 3500, '🫗'],
  ['sku-spaghetti', 'Golden Penny Spaghetti', 'Pack of 5 (500g)', 'Noodles & Pasta', 4300, 5600, '🍝'],
  ['sku-milo', 'Milo + Peak Milk Refill', 'Twin Combo (400g + 350g)', 'Provisions', 5900, 7600, '☕'],
  ['sku-detergent', 'Ariel Washing Powder', '900g Family Pack', 'Hostel Essentials', 2100, 2800, '🧼'],
];
// Oversized items (+₦250 delivery each): full cartons / big sacks (Chidi's update).
const BULK_ITEMS = new Set(['sku-indomie']);
const vendors = [
  {
    id: 'v-emeka', name: 'Oga Emeka', stallNumber: 'Stall B-14', bankName: 'GTBank', bankCode: '058', bankAccountNumber: '0123456789',
    ratingScore: 4.8, ratingCount: 24, priorityTier: true,
    inventory: { 'sku-rice': [4700, 45], 'sku-garri': [2450, 60], 'sku-oil': [2350, 40], 'sku-spaghetti': [3900, 35] },
  },
  {
    id: 'v-ngozi', name: 'Mama Ngozi', stallNumber: 'Stall C-08', bankName: 'Access Bank', bankCode: '044', bankAccountNumber: '9876543210',
    ratingScore: 4.6, ratingCount: 19, priorityTier: true,
    inventory: { 'sku-beans': [5500, 30], 'sku-indomie': [7750, 25], 'sku-milo': [5350, 28], 'sku-detergent': [1800, 50] },
  },
  {
    id: 'v-chidi', name: 'Brother Chidi', stallNumber: 'Stall A-03', bankName: 'Zenith Bank', bankCode: '057', bankAccountNumber: '5566778899',
    ratingScore: 3.4, ratingCount: 10,
    inventory: { 'sku-rice': [4650, 20], 'sku-garri': [2400, 20] },
  },
];
const users = [
  { email: 'chinedu.unizik@gmail.com', name: 'Chinedu Okafor', role: 'STUDENT', walletBalanceKobo: k(50000), defaultZoneId: 'ifite', defaultHubId: 'dynamo-junction' },
  { email: 'ogaemeka@lodgemart.ng', name: 'Oga Emeka', role: 'VENDOR', vendorId: 'v-emeka' },
  { email: 'mamangozi@lodgemart.ng', name: 'Mama Ngozi', role: 'VENDOR', vendorId: 'v-ngozi' },
  { email: 'tunde.dispatch@lodgemart.ng', name: 'Tunde Bakare', role: 'RIDER' },
  { email: 'ops@lodgemart.ng', name: 'Amaka Nwosu', role: 'ADMIN' },
];

// Production-safe reference data: create what's missing, leave existing rows alone
// (so prices or names an admin has changed are never overwritten).
async function seedReference() {
  for (const h of hubs) await prisma.hub.upsert({ where: { id: h.id }, create: h, update: {} });
  for (const z of zones) {
    await prisma.campusZone.upsert({ where: { id: z.id }, create: { id: z.id, name: z.name }, update: {} });
    for (const hubId of z.hubs) {
      await prisma.zoneHub.upsert({ where: { zoneId_hubId: { zoneId: z.id, hubId } }, create: { zoneId: z.id, hubId }, update: {} });
    }
  }
  for (const s of slots) await prisma.batchSlot.upsert({ where: { id: s.id }, create: s, update: {} });
  for (const [id, name, unit, category, price, kiosk, emoji] of products) {
    await prisma.product.upsert({
      where: { id },
      create: { id, name, unit, category, emoji, studentPriceKobo: k(price), kioskComparePriceKobo: k(kiosk), isBulkItem: BULK_ITEMS.has(id) },
      update: {},
    });
  }
  console.log(`Reference seed complete: ${zones.length} zones, ${hubs.length} hubs, ${slots.length} slots, ${products.length} products (existing rows untouched)`);
}

async function main() {
  if (MODE === 'reference') return seedReference();

  // Wipe in dependency order.
  await prisma.$transaction([
    prisma.riderEarning.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.stallPickup.deleteMany(),
    prisma.hubArrival.deleteMany(),
    prisma.order.deleteMany(),
    prisma.user.deleteMany(),
    prisma.vendorInventory.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.product.deleteMany(),
    prisma.zoneHub.deleteMany(),
    prisma.campusZone.deleteMany(),
    prisma.hub.deleteMany(),
    prisma.batchSlot.deleteMany(),
  ]);

  await prisma.hub.createMany({ data: hubs });
  for (const z of zones) {
    await prisma.campusZone.create({
      data: { id: z.id, name: z.name, hubs: { create: z.hubs.map((hubId) => ({ hubId })) } },
    });
  }
  await prisma.batchSlot.createMany({ data: slots });
  await prisma.product.createMany({
    data: products.map(([id, name, unit, category, price, kiosk, emoji]) => ({
      id, name, unit, category, emoji, studentPriceKobo: k(price), kioskComparePriceKobo: k(kiosk),
      isBulkItem: BULK_ITEMS.has(id),
    })),
  });
  for (const v of vendors) {
    await prisma.vendor.create({
      data: {
        id: v.id, name: v.name, market: 'Eke Awka', stallNumber: v.stallNumber,
        bankName: v.bankName, bankCode: v.bankCode, bankAccountNumber: v.bankAccountNumber,
        ratingScore: v.ratingScore, ratingCount: v.ratingCount, priorityTier: v.priorityTier ?? false,
        inventory: {
          create: Object.entries(v.inventory).map(([productId, [price, qty]]) => ({
            productId, wholesalePriceKobo: k(price), stockQty: qty,
          })),
        },
      },
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const created = {};
  for (const u of users) {
    created[u.email] = await prisma.user.create({ data: { ...u, passwordHash } });
  }

  // Sample order #4082 from the prototype (split across Emeka and Ngozi).
  const items = [
    ['sku-rice', 'v-emeka', 5200, 4700],
    ['sku-garri', 'v-emeka', 2800, 2450],
    ['sku-beans', 'v-ngozi', 6100, 5500],
  ];
  const subtotal = items.reduce((s, [, , price]) => s + k(price), 0);
  const today = new Date(new Date().toISOString().slice(0, 10));
  await prisma.order.create({
    data: {
      orderNumber: 4082,
      studentId: created['chinedu.unizik@gmail.com'].id,
      zoneId: 'ifite',
      hubId: 'dynamo-junction',
      batchSlotId: 'midday',
      batchDate: today,
      status: 'ORDER_PLACED',
      pickupPin: '4829',
      requiresBagMerge: true,
      subtotalKobo: subtotal,
      deliveryFeeKobo: k(350),
      totalKobo: subtotal + k(350),
      paymentMethod: 'WALLET',
      paymentRef: 'LM-WALLET-4082',
      paidAt: new Date(),
      items: {
        create: items.map(([productId, vendorId, price, cost]) => ({
          productId, vendorId, qty: 1, studentPriceKobo: k(price), wholesaleCostKobo: k(cost),
        })),
      },
    },
  });
  // Next order number continues from #4083, as in the prototype.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), 4082, true)`;

  console.log('Seed complete: 2 zones, 3 hubs, 3 slots, 8 products, 3 vendors, 5 users, order #4082');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
