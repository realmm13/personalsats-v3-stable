/*
  Warnings:

  - The primary key for the `DailySnapshot` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "DailySnapshot_userId_date_idx";

-- AlterTable
ALTER TABLE "DailySnapshot" DROP CONSTRAINT "DailySnapshot_pkey",
ADD CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("userId", "date");

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "proceedsUsd" DOUBLE PRECISION,
    "gainUsd" DOUBLE PRECISION,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "acquiredQty" DOUBLE PRECISION NOT NULL,
    "costPerUnitUsd" DOUBLE PRECISION NOT NULL,
    "remainingQty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_txId_fkey" FOREIGN KEY ("txId") REFERENCES "BitcoinTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_txId_fkey" FOREIGN KEY ("txId") REFERENCES "BitcoinTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySnapshot" ADD CONSTRAINT "DailySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
