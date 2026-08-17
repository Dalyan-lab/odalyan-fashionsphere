-- Frais de livraison : tarif de base par boutique + zones qui le remplacent.

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "shippingFee" DECIMAL(10,2);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "freeShippingFrom" DECIMAL(10,2);

-- Part livraison de la commande, isolée du calcul de commission.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(10,2);

CREATE TABLE IF NOT EXISTS "ShippingRate" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "cities"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fee"       DECIMAL(10,2) NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "shopId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShippingRate_shopId_idx" ON "ShippingRate"("shopId");

DO $$ BEGIN
  ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
