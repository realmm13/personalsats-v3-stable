/*
  Warnings:

  - Added the required column `wallet` to the `BitcoinTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BitcoinTransaction" ADD COLUMN     "fee" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "wallet" TEXT NOT NULL;
