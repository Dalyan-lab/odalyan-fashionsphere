-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "aiCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditsRenewedAt" TIMESTAMP(3);
