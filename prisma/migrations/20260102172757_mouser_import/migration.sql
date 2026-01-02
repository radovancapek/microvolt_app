-- CreateTable
CREATE TABLE "PurchaseImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseImportLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "partNumberRaw" TEXT NOT NULL,
    "partId" TEXT,
    "qty" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseImportLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseImportLine_batchId_idx" ON "PurchaseImportLine"("batchId");

-- AddForeignKey
ALTER TABLE "PurchaseImportLine" ADD CONSTRAINT "PurchaseImportLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PurchaseImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseImportLine" ADD CONSTRAINT "PurchaseImportLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
