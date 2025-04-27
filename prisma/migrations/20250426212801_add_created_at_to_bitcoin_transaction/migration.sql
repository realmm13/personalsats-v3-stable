/*
  Warnings:

  - Added the required column `updatedAt` to the `BitcoinTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BitcoinTransaction" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "encryptedData" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "timestamp" DROP DEFAULT,
ALTER COLUMN "fee" DROP DEFAULT,
ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "wallet" DROP NOT NULL;
