-- Panier multi-boutiques : un paiement, une commande par vendeur.

CREATE TABLE IF NOT EXISTS "OrderGroup" (
  "id"          TEXT NOT NULL,
  "reference"   TEXT NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'EUR',
  "customerId"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderGroup_reference_key" ON "OrderGroup"("reference");
CREATE INDEX IF NOT EXISTS "OrderGroup_customerId_idx" ON "OrderGroup"("customerId");

DO $$ BEGIN
  ALTER TABLE "OrderGroup" ADD CONSTRAINT "OrderGroup_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rattachement de la commande à son panier.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_groupId_idx" ON "Order"("groupId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "OrderGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le paiement porte désormais sur un panier. `orderId` devient facultatif :
-- les paiements antérieurs le conservent, et leur vérification continue de
-- fonctionner.
ALTER TABLE "Payment" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderGroupId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderGroupId_key" ON "Payment"("orderGroupId");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderGroupId_fkey"
    FOREIGN KEY ("orderGroupId") REFERENCES "OrderGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
