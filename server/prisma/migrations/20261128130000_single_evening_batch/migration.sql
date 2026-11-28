-- One evening delivery batch, Monday–Saturday (decision 2026-11-28).
-- Orders 3 PM → 3 PM; cutoff 3 PM (batch goes to vendors, cancelling stops);
-- stalls packed by 4 PM; campus pickup from 5 PM.
ALTER TABLE "BatchSlot" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "BatchSlot"
   SET "label" = 'Evening Delivery', "startTime" = '17:00', "endTime" = '18:30',
       "cutoffTime" = '15:00', "badge" = 'Mon – Sat', "sortOrder" = 1
 WHERE "id" = 'evening';

-- Old slots stay for order history but take no new orders.
UPDATE "BatchSlot" SET "isActive" = false, "badge" = 'Retired', "sortOrder" = "sortOrder" + 7
 WHERE "id" IN ('early', 'midday');
