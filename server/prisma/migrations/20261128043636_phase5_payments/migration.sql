-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "StallPickup" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "payoutAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payoutFailureReason" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "paystackRecipientCode" TEXT;
