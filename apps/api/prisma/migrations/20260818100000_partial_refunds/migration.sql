-- Remboursements partiels : plusieurs remboursements par commande, suivis
-- article par article.

ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "shippingShare" DECIMAL(10,2) NOT NULL DEFAULT 0;
-- Les remboursements existants portaient tous la commande entière : `true` est
-- la bonne valeur pour eux, et c'est aussi celle du schéma par défaut.
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "full" BOOLEAN NOT NULL DEFAULT true;

-- L'unicité par commande disparaît : c'est désormais le cumul des quantités
-- rendues qui empêche de rembourser deux fois la même unité.
DROP INDEX IF EXISTS "Refund_orderId_key";
CREATE INDEX IF NOT EXISTS "Refund_orderId_idx" ON "Refund"("orderId");

CREATE TABLE IF NOT EXISTS "RefundItem" (
  "id"          TEXT NOT NULL,
  "quantity"    INTEGER NOT NULL,
  "amount"      DECIMAL(10,2) NOT NULL,
  "refundId"    TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RefundItem_refundId_idx" ON "RefundItem"("refundId");
CREATE INDEX IF NOT EXISTS "RefundItem_orderItemId_idx" ON "RefundItem"("orderItemId");

DO $$ BEGIN
  ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refundId_fkey"
    FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
