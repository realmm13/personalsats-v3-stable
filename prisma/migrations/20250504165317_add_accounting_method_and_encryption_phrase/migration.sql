/*
  Warnings:

  - You are about to drop the column `encryptionPhrase` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "encryptionPhrase",
ADD COLUMN     "accountingMethod" TEXT NOT NULL DEFAULT 'HIFO';
