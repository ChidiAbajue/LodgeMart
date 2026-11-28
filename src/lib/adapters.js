// Turn API responses (integer kobo, enum statuses) into the shapes the screens
// use (naira numbers, friendly labels). The server stays the source of truth.

export const toNaira = (kobo) => (kobo ?? 0) / 100;

export const STATUS_LABELS = {
  PENDING_PAYMENT: 'Awaiting Transfer',
  ORDER_PLACED: 'Order Placed',
  PACKED_AT_MARKET: 'Packed at Market',
  RIDER_IN_TRANSIT: 'Rider In Transit',
  READY_AT_HUB: 'Ready at Hub',
  COLLECTED: 'Collected',
  LEFT_AT_KIOSK: 'Left at Junction Kiosk',
  CANCELLED: 'Cancelled',
};
export const statusLabel = (code) => STATUS_LABELS[code] || code;

export const PAYMENT_LABELS = {
  WALLET: 'LodgeMart Wallet (Monnify)',
  BANK_TRANSFER: 'Instant Bank Transfer (Monnify)',
};

const ROLE_HOME = { student: '/shop', vendor: '/vendor', rider: '/rider', admin: '/admin' };

export function adaptUser(u) {
  if (!u) return null;
  const role = u.role.toLowerCase();
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role,
    homeRoute: ROLE_HOME[role] || '/',
    vendorId: u.vendorId,
    walletBalance: toNaira(u.walletBalanceKobo),
    defaultZoneId: u.defaultZoneId,
    defaultHubId: u.defaultHubId,
  };
}

// "13:00" → "1:00 PM"
export function clock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function adaptSlot(s) {
  return {
    id: s.id,
    label: s.label,
    time: `${clock(s.startTime)} – ${clock(s.endTime)}`,
    cutoff: clock(s.cutoffTime),
    badge: s.badge,
    nextBatchDate: s.nextBatchDate,
  };
}

export function adaptProduct(p) {
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    category: p.category,
    emoji: p.emoji,
    studentPrice: toNaira(p.studentPriceKobo),
    kioskComparePrice: toNaira(p.kioskComparePriceKobo),
    isBulkItem: Boolean(p.isBulkItem),
    inStock: p.inStock !== false,
  };
}

export function adaptCatalog(c) {
  return {
    products: c.products.map(adaptProduct),
    zones: c.zones, // [{ id, name, hubs: [{ id, name }] }]
    slots: c.batchSlots.map(adaptSlot),
    feeRules: c.fees.deliveryFee, // kobo values, see quoteDelivery
    cancellationFee: toNaira(c.fees.cancellationFeeKobo),
  };
}

// Same rules as the server (server/src/utils/deliveryFee.js), for the basket
// preview only — the server recalculates at checkout.
export function quoteDelivery(lines, rules) {
  const subtotalKobo = lines.reduce((s, l) => s + Math.round(l.product.studentPrice * 100) * l.qty, 0);
  const bulkCount = lines.reduce((s, l) => s + (l.product.isBulkItem ? l.qty : 0), 0);
  if (!rules || subtotalKobo === 0) {
    return { subtotal: 0, baseFee: 0, bulkSurcharge: 0, deliveryFee: 0, bulkCount: 0, bracket: 'empty' };
  }
  let baseFeeKobo = rules.standardKobo;
  let bracket = 'standard';
  if (subtotalKobo > rules.standardMaxBasketKobo) {
    const over = subtotalKobo - rules.standardMaxBasketKobo - 100;
    const extra = Math.max(0, Math.floor(over / rules.bracketSizeKobo));
    baseFeeKobo = rules.largeKobo + extra * rules.perExtraBracketKobo;
    bracket = extra > 0 ? 'extra' : 'large';
  }
  const bulkKobo = bulkCount * rules.bulkItemSurchargeKobo;
  return {
    subtotal: toNaira(subtotalKobo),
    baseFee: toNaira(baseFeeKobo),
    bulkSurcharge: toNaira(bulkKobo),
    deliveryFee: toNaira(baseFeeKobo + bulkKobo),
    bulkCount,
    bracket,
  };
}

export function adaptOrder(o) {
  return {
    id: o.id,
    label: o.orderLabel,
    orderNumber: o.orderNumber,
    statusCode: o.status,
    status: statusLabel(o.status),
    pickupPin: o.pickupPin || null,
    delegateInfo: { name: o.delegateName || '', phone: o.delegatePhone || '', active: Boolean(o.delegateName) },
    campusZone: o.zone?.name,
    pickupHub: o.hub?.name,
    batchSlot: o.batchSlot ? `${o.batchSlot.label} (${clock(o.batchSlot.startTime)} – ${clock(o.batchSlot.endTime)})` : '',
    batchDate: o.batchDate,
    // After the 3 PM cutoff the batch is with the vendors: no more cancelling.
    batchLocked: Boolean(o.batchLocked),
    cutoff: clock(o.batchSlot?.cutoffTime),
    subtotal: toNaira(o.subtotalKobo),
    deliveryFee: toNaira(o.deliveryFeeKobo),
    bulkSurcharge: toNaira(o.bulkSurchargeKobo),
    totalAmount: toNaira(o.totalKobo),
    paymentMethodCode: o.paymentMethod,
    paymentMethod: PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod,
    deliveredTo: o.deliveredTo,
    rated: Boolean(o.ratedAt),
    replacementCredit: Boolean(o.replacementCredit),
    refundAmount: o.refundKobo != null ? toNaira(o.refundKobo) : null,
    createdAt: o.createdAt,
    items: (o.items || []).map((i) => ({
      itemId: i.id,
      productId: i.productId,
      productName: i.product?.name,
      unit: i.product?.unit,
      qty: i.qty,
      studentPrice: toNaira(i.studentPriceKobo),
      itemRating: i.itemRating,
      issueTag: i.issueTag,
      refunded: Boolean(i.refundedAt),
      refundAmount: i.refundKobo != null ? toNaira(i.refundKobo) : null,
    })),
  };
}

// Show a Lagos calendar date nicely: "2026-11-28" → "Sat 28 Nov".
export function prettyDate(ymd) {
  if (!ymd) return '';
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// Today's date in Lagos (UTC+1), as YYYY-MM-DD.
export function lagosToday() {
  return new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10);
}

// Seconds until the next batch cutoff (default 15:00 Lagos). No batch on Sunday,
// so from Saturday's cutoff the countdown runs to Monday 3 PM.
export function secondsToNextCutoff(cutoff = '15:00', now = Date.now()) {
  const [h, m] = cutoff.split(':').map(Number);
  const lagos = new Date(now + 60 * 60_000); // Lagos wall clock, read with UTC getters
  const target = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate(), h, m));
  if (target <= lagos) target.setUTCDate(target.getUTCDate() + 1);
  while (target.getUTCDay() === 0) target.setUTCDate(target.getUTCDate() + 1);
  return Math.max(0, Math.floor((target - lagos) / 1000));
}

// Naira string from kobo: 470000 → "₦4,700".
export const koboToNaira = (kobo) => `₦${Math.round((kobo ?? 0) / 100).toLocaleString('en-NG')}`;
