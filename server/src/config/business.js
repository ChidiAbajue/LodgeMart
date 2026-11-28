// Business rules from Chidi's prototype (src/data/seedData.js, LodgeMartContext.jsx).
// All money in kobo (₦1 = 100 kobo).

// Tiered delivery fee (calculateDeliveryFee in the prototype):
//   basket ₦1 – ₦10,000            → ₦350
//   basket ₦10,001 – ₦20,000       → ₦600
//   each further ₦10,000 bracket   → +₦250   (₦20,001–₦30,000 → ₦850, …)
//   every bulk item (isBulkItem)   → +₦250 each
export const DELIVERY_FEE = {
  standardKobo: 350_00,
  standardMaxBasketKobo: 10_000_00,
  largeKobo: 600_00,
  bracketSizeKobo: 10_000_00,
  perExtraBracketKobo: 250_00,
  bulkItemSurchargeKobo: 250_00,
};

export const RIDER_COMMISSION_KOBO = 150_00; // ₦150 per handed-over order
export const CANCELLATION_FEE_KOBO = 200_00; // ₦200
export const MONNIFY_FEE_PER_ORDER_KOBO = 50_00; // ₦50 flat bank-transfer fee (LodgeMart's cost)
export const PACKAGING_COST_PER_ORDER_KOBO = 70_00; // ~₦70 tagged bags per order (LodgeMart's cost)
// Price-spike safeguard: rises up to this per unit are absorbed by LodgeMart;
// bigger rises switch trader or refund the line item.
export const PRICE_SPIKE_ABSORB_LIMIT_KOBO = 150_00;

// Vendors rated below this are not routed any orders.
export const MIN_VENDOR_RATING = 3.5;
// Priority Supplier Tier: first pick in routing, only while rated at least this.
export const PRIORITY_MIN_RATING = 4.5;

// Rider waits this long at the hub before an uncollected bag may go to the kiosk.
export const HUB_DWELL_MINUTES = 20;

// Issue tags offered by the rating modal (src/components/ItemRatingModal.jsx).
export const ISSUE_TAGS = ['Short measure', 'Weevils / Dusty', 'Damaged pack', 'Missing item'];

// Africa/Lagos is UTC+1 all year (no daylight saving).
export const LAGOS_UTC_OFFSET_MINUTES = 60;
