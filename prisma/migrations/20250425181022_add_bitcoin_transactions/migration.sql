-- CreateTable
CREATE TABLE "BitcoinTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BitcoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BitcoinTransaction_userId_idx" ON "BitcoinTransaction"("userId");

-- AddForeignKey
ALTER TABLE "BitcoinTransaction" ADD CONSTRAINT "BitcoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
