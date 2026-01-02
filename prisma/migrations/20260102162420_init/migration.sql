-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "packaging" TEXT,
    "orderMultiple" INTEGER NOT NULL DEFAULT 1,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "supplier" TEXT,
    "supplierSku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "onOrder" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feeder" (
    "id" TEXT NOT NULL,
    "feederNo" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "Feeder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeederAssignment" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "feederId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "FeederAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_partNumber_idx" ON "Part"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_partId_key" ON "Inventory"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "Feeder_feederNo_key" ON "Feeder"("feederNo");

-- CreateIndex
CREATE INDEX "FeederAssignment_partId_active_idx" ON "FeederAssignment"("partId", "active");

-- CreateIndex
CREATE INDEX "FeederAssignment_feederId_active_idx" ON "FeederAssignment"("feederId", "active");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeederAssignment" ADD CONSTRAINT "FeederAssignment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeederAssignment" ADD CONSTRAINT "FeederAssignment_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "Feeder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
