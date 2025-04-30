/*
  Warnings:

  - You are about to drop the column `isTransfer` on the `BitcoinTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `transferFromWallet` on the `BitcoinTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `transferToWallet` on the `BitcoinTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `acquiredQty` on the `Lot` table. All the data in the column will be lost.
  - You are about to drop the column `costPerUnitUsd` on the `Lot` table. All the data in the column will be lost.
  - You are about to drop the column `accountingMethod` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `jurisdiction` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `TaxLot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `costBasisUsd` to the `Lot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `openedAt` to the `Lot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalAmount` to the `Lot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TaxLot" DROP CONSTRAINT "TaxLot_txId_fkey";

-- AlterTable
ALTER TABLE "BitcoinTransaction" DROP COLUMN "isTransfer",
DROP COLUMN "transferFromWallet",
DROP COLUMN "transferToWallet";

-- AlterTable
ALTER TABLE "Lot" DROP COLUMN "acquiredQty",
DROP COLUMN "costPerUnitUsd",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "costBasisUsd" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "gainUsd" DOUBLE PRECISION,
ADD COLUMN     "openedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "originalAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proceedsUsd" DOUBLE PRECISION,
ADD COLUMN     "term" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "accountingMethod",
DROP COLUMN "jurisdiction";

-- DropTable
DROP TABLE "TaxLot";

-- CreateIndex
CREATE INDEX "Lot_txId_idx" ON "Lot"("txId");
