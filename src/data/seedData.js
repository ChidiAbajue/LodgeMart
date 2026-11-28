export const CAMPUS_ZONES = [
  {
    id: 'ifite',
    name: 'UNIZIK – Ifite',
    hubs: ['Dynamo Junction', 'School Gate'],
  },
  {
    id: 'tempsite',
    name: 'UNIZIK – Tempsite',
    hubs: ['Aroma Junction', 'School Gate'],
  },
];

export const ALL_HUBS = ['Dynamo Junction', 'School Gate', 'Aroma Junction'];

// One evening batch, Monday–Saturday (decision 2026-11-28). Mirrors the API's
// batch slot; the live app reads slots from GET /api/catalog.
export const BATCH_SLOTS = [
  {
    id: 'evening',
    label: 'Evening Delivery',
    time: '5:00 PM – 6:30 PM',
    cutoff: '3:00 PM',
    badge: 'Mon – Sat',
  },
];

// The daily rhythm shown on the landing page.
export const BATCH_SCHEDULE = [
  { time: '3:00 PM → 3:00 PM', title: 'Orders open', body: 'Order any time from 3 PM the day before. Cancel freely until the cutoff.' },
  { time: '3:00 PM', title: 'Cutoff', body: 'The batch goes to the vendors to pack. Orders can no longer be cancelled.' },
  { time: '4:00 PM', title: 'Rider collects', body: 'Stalls finish packing; one rider picks up every tagged bag.' },
  { time: '5:00 PM', title: 'Pickup on campus', body: 'Collect at your junction hub with your 4-digit PIN.' },
];

export const DELIVERY_FEE = 350;
export const MONNIFY_FEE_PER_ORDER = 50;
export const RIDER_COMMISSION = 150;
export const INITIAL_WALLET_BALANCE = 50000;
export const VIRTUAL_ACCOUNT_INFO = '8012345678 — Moniepoint MFB';

export function calculateDeliveryFee(cart, products) {
  if (!cart || cart.length === 0) {
    return { baseFee: 0, bulkSurcharge: 0, totalFee: 0, itemsSubtotal: 0, bulkCount: 0 };
  }

  let itemsSubtotal = 0;
  let bulkCount = 0;

  cart.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    itemsSubtotal += product.studentPrice * item.qty;
    if (product.isBulkItem) {
      bulkCount += item.qty;
    }
  });

  if (itemsSubtotal === 0) {
    return { baseFee: 0, bulkSurcharge: 0, totalFee: 0, itemsSubtotal: 0, bulkCount: 0 };
  }

  let baseFee = 350;
  if (itemsSubtotal > 10000) {
    const extraBrackets = Math.floor((itemsSubtotal - 10001) / 10000);
    baseFee = 600 + extraBrackets * 250;
  }

  const bulkSurcharge = bulkCount * 250;
  return {
    baseFee,
    bulkSurcharge,
    totalFee: baseFee + bulkSurcharge,
    itemsSubtotal,
    bulkCount,
  };
}

export const SANDBOX_ACCOUNTS = [
  {
    email: 'chinedu.unizik@gmail.com',
    password: 'password123',
    role: 'student',
    name: 'Chinedu Okafor',
    subtitle: 'Student — UNIZIK Ifite',
    campusZone: 'UNIZIK – Ifite',
    pickupHub: 'Dynamo Junction',
    homeRoute: '/shop',
  },
  {
    email: 'ogaemeka@lodgemart.ng',
    password: 'password123',
    role: 'vendor',
    vendorId: 'v-emeka',
    name: 'Oga Emeka',
    subtitle: 'Vendor — Eke Awka (Stall B-14)',
    homeRoute: '/vendor',
  },
  {
    email: 'tunde.dispatch@lodgemart.ng',
    password: 'password123',
    role: 'rider',
    name: 'Tunde Bakare',
    subtitle: 'Rider — Ifite Route',
    homeRoute: '/rider',
  },
  {
    email: 'ops@lodgemart.ng',
    password: 'password123',
    role: 'admin',
    name: 'Amaka Nwosu',
    subtitle: 'Admin — LodgeMart Ops',
    homeRoute: '/admin',
  },
];

export const INITIAL_PRODUCTS = [
  {
    id: 'sku-rice',
    name: 'Local Parboiled Rice',
    unit: '1 Paint Bucket (4kg)',
    category: 'Grains & Staples',
    studentPrice: 5200,
    kioskComparePrice: 6800,
    emoji: '🍚',
  },
  {
    id: 'sku-garri',
    name: 'Ijebu White Garri',
    unit: '1 Paint Bucket (3.5kg)',
    category: 'Grains & Staples',
    studentPrice: 2800,
    kioskComparePrice: 3700,
    emoji: '🥣',
  },
  {
    id: 'sku-beans',
    name: 'Olo Honey Beans',
    unit: '1 Paint Bucket (4kg)',
    category: 'Grains & Staples',
    studentPrice: 6100,
    kioskComparePrice: 7900,
    emoji: '🫘',
  },
  {
    id: 'sku-indomie',
    name: 'Indomie Chicken (70g)',
    unit: '1 Carton (40 Packs)',
    category: 'Noodles & Pasta',
    studentPrice: 8400,
    kioskComparePrice: 10800,
    isBulkItem: true,
    emoji: '🍜',
  },
  {
    id: 'sku-oil',
    name: 'Devon King’s Veg Oil',
    unit: '1 Litre Bottle',
    category: 'Cooking Oils',
    studentPrice: 2650,
    kioskComparePrice: 3500,
    emoji: '🫗',
  },
  {
    id: 'sku-spaghetti',
    name: 'Golden Penny Spaghetti',
    unit: 'Pack of 5 (500g)',
    category: 'Noodles & Pasta',
    studentPrice: 4300,
    kioskComparePrice: 5600,
    emoji: '🍝',
  },
  {
    id: 'sku-milo',
    name: 'Milo + Peak Milk Refill',
    unit: 'Twin Combo (400g + 350g)',
    category: 'Provisions',
    studentPrice: 5900,
    kioskComparePrice: 7600,
    emoji: '☕',
  },
  {
    id: 'sku-detergent',
    name: 'Ariel Washing Powder',
    unit: '900g Family Pack',
    category: 'Hostel Essentials',
    studentPrice: 2100,
    kioskComparePrice: 2800,
    emoji: '🧼',
  },
];

export const INITIAL_VENDORS = [
  {
    id: 'v-emeka',
    name: 'Oga Emeka',
    market: 'Eke Awka',
    stallNumber: 'Stall B-14',
    bankAccount: '0123456789 • GTBank',
    ratingScore: 4.8,
    ratingCount: 24,
    priorityTier: true,
    walletBalance: 0,
    inventory: {
      'sku-rice': { wholesalePrice: 4700, stockQty: 45 },
      'sku-garri': { wholesalePrice: 2450, stockQty: 60 },
      'sku-oil': { wholesalePrice: 2350, stockQty: 40 },
      'sku-spaghetti': { wholesalePrice: 3900, stockQty: 35 },
    },
  },
  {
    id: 'v-ngozi',
    name: 'Mama Ngozi',
    market: 'Eke Awka',
    stallNumber: 'Stall C-08',
    bankAccount: '9876543210 • Access Bank',
    ratingScore: 4.6,
    ratingCount: 19,
    priorityTier: true,
    walletBalance: 0,
    inventory: {
      'sku-beans': { wholesalePrice: 5500, stockQty: 30 },
      'sku-indomie': { wholesalePrice: 7750, stockQty: 25 },
      'sku-milo': { wholesalePrice: 5350, stockQty: 28 },
      'sku-detergent': { wholesalePrice: 1800, stockQty: 50 },
    },
  },
  {
    id: 'v-chidi',
    name: 'Brother Chidi',
    market: 'Eke Awka',
    stallNumber: 'Stall A-03',
    bankAccount: '5566778899 • Zenith Bank',
    ratingScore: 3.4,
    ratingCount: 10,
    priorityTier: false,
    walletBalance: 0,
    inventory: {
      'sku-rice': { wholesalePrice: 4650, stockQty: 20 },
      'sku-garri': { wholesalePrice: 2400, stockQty: 20 },
    },
  },
];

export const INITIAL_ORDERS = [
  {
    id: '#4082',
    studentName: 'Chinedu Okafor',
    studentEmail: 'chinedu.unizik@gmail.com',
    campusZone: 'UNIZIK – Ifite',
    pickupHub: 'Dynamo Junction',
    batchSlot: 'Midday Break (1:00 PM – 2:00 PM)',
    status: 'Order Placed',
    pickupPin: '4829',
    delegateInfo: {
      name: '',
      phone: '',
      active: false,
    },
    requiresBagMerge: true,
    deliveryFee: 350,
    totalAmount: 14450,
    paymentMethod: 'LodgeMart Wallet',
    paymentRef: 'LM-WALLET-4082',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    deliveredTo: null,
    rated: false,
  },
];

export const INITIAL_ORDER_ITEMS = [
  {
    itemId: 'oi-4082-1',
    orderId: '#4082',
    productId: 'sku-rice',
    productName: 'Local Parboiled Rice',
    unit: '1 Paint Bucket (4kg)',
    qty: 1,
    studentPrice: 5200,
    wholesaleCost: 4700,
    assignedVendorId: 'v-emeka',
    vendorPacked: false,
    riderPickedUp: false,
    itemRating: null,
    issueTag: null,
  },
  {
    itemId: 'oi-4082-2',
    orderId: '#4082',
    productId: 'sku-garri',
    productName: 'Ijebu White Garri',
    unit: '1 Paint Bucket (3.5kg)',
    qty: 1,
    studentPrice: 2800,
    wholesaleCost: 2450,
    assignedVendorId: 'v-emeka',
    vendorPacked: false,
    riderPickedUp: false,
    itemRating: null,
    issueTag: null,
  },
  {
    itemId: 'oi-4082-3',
    orderId: '#4082',
    productId: 'sku-beans',
    productName: 'Olo Honey Beans',
    unit: '1 Paint Bucket (4kg)',
    qty: 1,
    studentPrice: 6100,
    wholesaleCost: 5500,
    assignedVendorId: 'v-ngozi',
    vendorPacked: false,
    riderPickedUp: false,
    itemRating: null,
    issueTag: null,
  },
];
