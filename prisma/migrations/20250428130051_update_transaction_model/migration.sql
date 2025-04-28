-- DropIndex
DROP INDEX "BitcoinTransaction_userId_idx";

-- AlterTable
ALTER TABLE "BitcoinTransaction" ADD COLUMN     "asset" TEXT NOT NULL DEFAULT 'BTC',
ADD COLUMN     "counterparty" TEXT,
ADD COLUMN     "exchangeTxId" TEXT,
ADD COLUMN     "feeAsset" TEXT,
ADD COLUMN     "priceAsset" TEXT DEFAULT 'USD';

-- CreateIndex
CREATE INDEX "BitcoinTransaction_userId_timestamp_idx" ON "BitcoinTransaction"("userId", "timestamp");
