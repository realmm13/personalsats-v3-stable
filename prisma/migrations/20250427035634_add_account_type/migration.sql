-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
