// Business rules from the prototype (src/data/seedData.js, LodgeMartContext.jsx).
// All money in kobo (₦1 = 100 kobo).
export const DELIVERY_FEE_KOBO = 350_00; // ₦350
export const RIDER_COMMISSION_KOBO = 150_00; // ₦150 (Phase 4)
export const CANCELLATION_FEE_KOBO = 200_00; // ₦200

// Vendors rated below this are not routed any orders.
export const MIN_VENDOR_RATING = 3.5;

// Africa/Lagos is UTC+1 all year (no daylight saving).
export const LAGOS_UTC_OFFSET_MINUTES = 60;
