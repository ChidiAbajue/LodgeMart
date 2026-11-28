-- 3-layer price-spike safeguard on order line items (see services/priceSpikeService.js)
ALTER TABLE "OrderItem"
  ADD COLUMN "priceAdjustmentKobo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reassignedFromVendorId" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundKobo" INTEGER;
