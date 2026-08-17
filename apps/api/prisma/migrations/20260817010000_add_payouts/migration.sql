-- Registre des reversements aux vendeurs.

DO $$ BEGIN
  CREATE TYPE "PayoutMethod" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coordonnées de reversement et commission négociée, par boutique.
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payoutMethod" "PayoutMethod";
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payoutOperator" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payoutNumber" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payoutHolderName" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);

CREATE TABLE IF NOT EXISTS "Payout" (
  "id"          TEXT NOT NULL,
  "reference"   TEXT NOT NULL,
  "amount"      DECIMAL(10,2) NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'EUR',
  "status"      "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "method"      "PayoutMethod",
  "destination" TEXT,
  "transferRef" TEXT,
  "note"        TEXT,
  "shopId"      TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt"      TIMESTAMP(3),
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_reference_key" ON "Payout"("reference");
CREATE INDEX IF NOT EXISTS "Payout_shopId_idx" ON "Payout"("shopId");
CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status");

DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Répartition figée sur la commande + rattachement au versement.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,4);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platformAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sellerAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "payoutId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_payoutId_idx" ON "Order"("payoutId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
