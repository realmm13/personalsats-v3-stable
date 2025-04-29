-- CreateTable
CREATE TABLE "price_history" (
    "timestamp" TIMESTAMP(3) NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("timestamp")
);
