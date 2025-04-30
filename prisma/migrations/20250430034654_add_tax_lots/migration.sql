-- AlterTable
ALTER TABLE "BitcoinTransaction" ADD COLUMN     "isTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transferFromWallet" TEXT,
ADD COLUMN     "transferToWallet" TEXT;

-- CreateTable
CREATE TABLE "TaxLot" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "costBasisUsd" DOUBLE PRECISION NOT NULL,
    "closedAt" TIMESTAMP(3),
    "proceedsUsd" DOUBLE PRECISION,
    "gainUsd" DOUBLE PRECISION,
    "term" TEXT,

    CONSTRAINT "TaxLot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaxLot" ADD CONSTRAINT "TaxLot_txId_fkey" FOREIGN KEY ("txId") REFERENCES "BitcoinTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
