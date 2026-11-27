-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'VENDOR', 'RIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'ORDER_PLACED', 'PACKED_AT_MARKET', 'RIDER_IN_TRANSIT', 'READY_AT_HUB', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'PAYSTACK');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "walletBalanceKobo" INTEGER NOT NULL DEFAULT 0,
    "defaultZoneId" TEXT,
    "defaultHubId" TEXT,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CampusZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneHub" (
    "zoneId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,

    CONSTRAINT "ZoneHub_pkey" PRIMARY KEY ("zoneId","hubId")
);

-- CreateTable
CREATE TABLE "BatchSlot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "cutoffTime" TEXT NOT NULL,
    "badge" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BatchSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "studentPriceKobo" INTEGER NOT NULL,
    "kioskComparePriceKobo" INTEGER NOT NULL,
    "emoji" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "stallNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "ratingScore" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "payoutBalanceKobo" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInventory" (
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "wholesalePriceKobo" INTEGER NOT NULL,
    "stockQty" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInventory_pkey" PRIMARY KEY ("vendorId","productId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "batchSlotId" TEXT NOT NULL,
    "batchDate" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDER_PLACED',
    "pickupPin" TEXT NOT NULL,
    "delegateName" TEXT,
    "delegatePhone" TEXT,
    "requiresBagMerge" BOOLEAN NOT NULL DEFAULT false,
    "subtotalKobo" INTEGER NOT NULL,
    "deliveryFeeKobo" INTEGER NOT NULL,
    "totalKobo" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "deliveredTo" TEXT,
    "collectedAt" TIMESTAMP(3),
    "ratedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundKobo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "studentPriceKobo" INTEGER NOT NULL,
    "wholesaleCostKobo" INTEGER NOT NULL,
    "vendorPacked" BOOLEAN NOT NULL DEFAULT false,
    "riderPickedUp" BOOLEAN NOT NULL DEFAULT false,
    "stallPickupId" TEXT,
    "itemRating" INTEGER,
    "issueTag" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallPickup" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "batchSlotId" TEXT NOT NULL,
    "batchDate" DATE NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutKobo" INTEGER NOT NULL,
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "transferRef" TEXT,

    CONSTRAINT "StallPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubArrival" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "batchSlotId" TEXT NOT NULL,
    "batchDate" DATE NOT NULL,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubArrival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderEarning" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_vendorId_key" ON "User"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "CampusZone_name_key" ON "CampusZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_name_key" ON "Hub"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentRef_key" ON "Order"("paymentRef");

-- CreateIndex
CREATE INDEX "Order_studentId_idx" ON "Order"("studentId");

-- CreateIndex
CREATE INDEX "Order_batchDate_batchSlotId_status_idx" ON "Order"("batchDate", "batchSlotId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_vendorId_riderPickedUp_idx" ON "OrderItem"("vendorId", "riderPickedUp");

-- CreateIndex
CREATE UNIQUE INDEX "StallPickup_transferRef_key" ON "StallPickup"("transferRef");

-- CreateIndex
CREATE UNIQUE INDEX "StallPickup_vendorId_batchSlotId_batchDate_key" ON "StallPickup"("vendorId", "batchSlotId", "batchDate");

-- CreateIndex
CREATE UNIQUE INDEX "HubArrival_hubId_batchSlotId_batchDate_key" ON "HubArrival"("hubId", "batchSlotId", "batchDate");

-- CreateIndex
CREATE UNIQUE INDEX "RiderEarning_orderId_key" ON "RiderEarning"("orderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultZoneId_fkey" FOREIGN KEY ("defaultZoneId") REFERENCES "CampusZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultHubId_fkey" FOREIGN KEY ("defaultHubId") REFERENCES "Hub"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneHub" ADD CONSTRAINT "ZoneHub_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CampusZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneHub" ADD CONSTRAINT "ZoneHub_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInventory" ADD CONSTRAINT "VendorInventory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInventory" ADD CONSTRAINT "VendorInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CampusZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_batchSlotId_fkey" FOREIGN KEY ("batchSlotId") REFERENCES "BatchSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_stallPickupId_fkey" FOREIGN KEY ("stallPickupId") REFERENCES "StallPickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallPickup" ADD CONSTRAINT "StallPickup_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallPickup" ADD CONSTRAINT "StallPickup_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallPickup" ADD CONSTRAINT "StallPickup_batchSlotId_fkey" FOREIGN KEY ("batchSlotId") REFERENCES "BatchSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubArrival" ADD CONSTRAINT "HubArrival_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubArrival" ADD CONSTRAINT "HubArrival_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubArrival" ADD CONSTRAINT "HubArrival_batchSlotId_fkey" FOREIGN KEY ("batchSlotId") REFERENCES "BatchSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderEarning" ADD CONSTRAINT "RiderEarning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
