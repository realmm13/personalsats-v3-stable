-- CreateTable
CREATE TABLE "DailyPrice" (
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyPrice_pkey" PRIMARY KEY ("date")
);
