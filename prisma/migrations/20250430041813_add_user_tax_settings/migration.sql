-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountingMethod" TEXT NOT NULL DEFAULT 'FIFO',
ADD COLUMN     "jurisdiction" TEXT NOT NULL DEFAULT 'United States';
