/*
  Warnings:

  - A unique constraint covering the columns `[salesOrderNo]` on the table `PurchaseImportBatch` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PurchaseImportBatch" ADD COLUMN     "salesOrderNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseImportBatch_salesOrderNo_key" ON "PurchaseImportBatch"("salesOrderNo");
