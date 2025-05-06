/*
  Warnings:

  - You are about to drop the column `encryptionSalt` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BitcoinTransaction" ADD COLUMN     "encryptionError" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "encryptionKeyId" TEXT,
ADD COLUMN     "encryptionNonce" TEXT,
ADD COLUMN     "encryptionVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "encryptionSalt";
