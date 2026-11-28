-- Monnify replaces Paystack; Chidi's new business rules (tiered delivery fee + bulk
-- surcharge, junction-kiosk fallback, priority supplier tier, replacement credit).
-- Hand-written: the payment enum is RENAMED (Prisma's generated version recreates the
-- type, which would fail on existing rows).

-- Order status: not collected within the hub dwell window → left at partnered kiosk
ALTER TYPE "OrderStatus" ADD VALUE 'LEFT_AT_KIOSK';

-- Payment method: PAYSTACK → BANK_TRANSFER (Monnify one-time transfer)
ALTER TYPE "PaymentMethod" RENAME VALUE 'PAYSTACK' TO 'BANK_TRANSFER';

ALTER TABLE "Order"
  ADD COLUMN "bulkSurchargeKobo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leftAtKioskAt" TIMESTAMP(3),
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "replacementCredit" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Order_providerRef_key" ON "Order"("providerRef");

ALTER TABLE "Product" ADD COLUMN "isBulkItem" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN "virtualAccountBank" TEXT,
  ADD COLUMN "virtualAccountName" TEXT,
  ADD COLUMN "virtualAccountNumber" TEXT;

-- Paystack recipient codes are no longer used (Monnify pays bank code + account directly)
ALTER TABLE "Vendor" DROP COLUMN "paystackRecipientCode",
  ADD COLUMN "priorityTier" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WalletFunding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletFunding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletFunding_transactionReference_key" ON "WalletFunding"("transactionReference");
CREATE INDEX "WalletFunding_userId_idx" ON "WalletFunding"("userId");
ALTER TABLE "WalletFunding" ADD CONSTRAINT "WalletFunding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase lock-down applies to new tables too (see lock_down_direct_table_access)
ALTER TABLE "WalletFunding" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "WalletFunding" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "WalletFunding" FROM authenticated;
  END IF;
END $$;
