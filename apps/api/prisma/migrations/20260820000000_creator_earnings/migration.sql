-- Registre des gains ViralAmazone, en francs CFA. Séparé des crédits IA :
-- les crédits s'achètent, les convertir en argent permettrait d'acheter puis
-- d'encaisser.

DO $$ BEGIN
  CREATE TYPE "CreatorEarningStatus" AS ENUM ('AVAILABLE', 'REQUESTED', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CreatorEarning" (
  "id"          TEXT NOT NULL,
  "shopId"      TEXT NOT NULL,
  "amount"      DECIMAL(10,2) NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'XOF',
  "status"      "CreatorEarningStatus" NOT NULL DEFAULT 'AVAILABLE',
  "kind"        TEXT NOT NULL,
  "note"        TEXT,
  "destination" TEXT,
  "transferRef" TEXT,
  "paidAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorEarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreatorEarning_shopId_status_idx" ON "CreatorEarning"("shopId", "status");

DO $$ BEGIN
  ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
