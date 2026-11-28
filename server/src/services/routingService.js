// Line-item routing — a pure function (no database), ported from createOrder()
// in the prototype (src/context/LodgeMartContext.jsx):
//   1. Single-stop preference: one vendor with stock for EVERY line, highest rating wins.
//   2. Split-stall fallback: per line, highest rating first, then lowest wholesale price.
//   3. Bag merge: flagged by the caller when 2+ distinct vendors are used.
// Tie-breaks (not in the prototype) make the result deterministic:
// single-stop → cheaper total wholesale, then vendor id; split → vendor id.
//
// lines:   [{ productId, qty }]
// vendors: [{ id, rating, inventory: Map<productId, { wholesalePriceKobo, stockQty }> }]
//          — callers pass only vendors eligible for routing (active, rating ≥ minimum).
// Returns { ok: true, assignments: [{ productId, qty, vendorId, wholesaleCostKobo }] }
//      or { ok: false, productId } for the first line no vendor can fill.
export function routeBasket(lines, vendors) {
  const canFill = (vendor, line) => (vendor.inventory.get(line.productId)?.stockQty ?? 0) >= line.qty;
  const cost = (vendor, line) => vendor.inventory.get(line.productId).wholesalePriceKobo;
  const assign = (vendor, line) => ({
    productId: line.productId,
    qty: line.qty,
    vendorId: vendor.id,
    wholesaleCostKobo: cost(vendor, line),
  });

  const singleStop = vendors
    .filter((v) => lines.every((line) => canFill(v, line)))
    .map((v) => ({ v, total: lines.reduce((sum, line) => sum + cost(v, line) * line.qty, 0) }))
    .sort((a, b) => b.v.rating - a.v.rating || a.total - b.total || a.v.id.localeCompare(b.v.id));

  if (singleStop.length > 0) {
    const vendor = singleStop[0].v;
    return { ok: true, assignments: lines.map((line) => assign(vendor, line)) };
  }

  const assignments = [];
  for (const line of lines) {
    const best = vendors
      .filter((v) => canFill(v, line))
      .sort((a, b) => b.rating - a.rating || cost(a, line) - cost(b, line) || a.id.localeCompare(b.id))[0];
    if (!best) return { ok: false, productId: line.productId };
    assignments.push(assign(best, line));
  }
  return { ok: true, assignments };
}
