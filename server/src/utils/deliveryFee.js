import { DELIVERY_FEE } from '../config/business.js';

// Delivery fee for a basket, mirroring calculateDeliveryFee() in the prototype
// (src/data/seedData.js) in integer kobo. The server's result is final; the
// frontend uses the same rules (sent in GET /api/catalog) only to preview it.
//   lines: [{ qty, product: { studentPriceKobo, isBulkItem } }]
export function quoteDelivery(lines) {
  const subtotalKobo = lines.reduce((s, l) => s + l.product.studentPriceKobo * l.qty, 0);
  const bulkCount = lines.reduce((s, l) => s + (l.product.isBulkItem ? l.qty : 0), 0);
  if (subtotalKobo === 0) {
    return { subtotalKobo: 0, baseFeeKobo: 0, bulkSurchargeKobo: 0, deliveryFeeKobo: 0, bulkCount: 0 };
  }

  let baseFeeKobo = DELIVERY_FEE.standardKobo;
  if (subtotalKobo > DELIVERY_FEE.standardMaxBasketKobo) {
    // Prototype: 600 + floor((naira − 10,001) / 10,000) × 250
    const over = subtotalKobo - DELIVERY_FEE.standardMaxBasketKobo - 100; // ₦10,001 in kobo
    const extraBrackets = Math.max(0, Math.floor(over / DELIVERY_FEE.bracketSizeKobo));
    baseFeeKobo = DELIVERY_FEE.largeKobo + extraBrackets * DELIVERY_FEE.perExtraBracketKobo;
  }
  const bulkSurchargeKobo = bulkCount * DELIVERY_FEE.bulkItemSurchargeKobo;
  return { subtotalKobo, baseFeeKobo, bulkSurchargeKobo, deliveryFeeKobo: baseFeeKobo + bulkSurchargeKobo, bulkCount };
}
