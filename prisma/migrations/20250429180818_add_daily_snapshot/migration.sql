-- CreateTable
CREATE TABLE "DailySnapshot" (
    "date" TIMESTAMP(3) NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "DailySnapshot_userId_date_idx" ON "DailySnapshot"("userId", "date");
