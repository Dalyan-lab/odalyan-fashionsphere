-- Suivi de livraison côté commande.
-- Tous les champs sont facultatifs : les commandes existantes restent valides
-- et le vendeur les renseigne au moment de l'expédition.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Délai de livraison annoncé par la boutique.
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "deliveryDaysMin" INTEGER;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "deliveryDaysMax" INTEGER;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "deliveryNote" TEXT;
