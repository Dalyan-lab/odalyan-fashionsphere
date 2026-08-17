-- Bascule de la devise de référence : EUR -> XOF (franc CFA).
--
-- Les montants déjà en base ont été saisis en euros. Les laisser tels quels
-- ferait passer un produit de 11,99 € à 11,99 F. On les convertit au taux fixe
-- de la zone franc (1 EUR = 655,957 XOF, parité garantie par accord monétaire,
-- donc pas de risque de dérive comme avec un taux flottant).
--
-- Le franc CFA n'a pas de subdivision : on arrondit à l'unité.
-- Cette migration ne s'exécute qu'une fois ; les colonnes sans indicateur de
-- devise (variantes, lignes de commande, frais de livraison) sont converties
-- inconditionnellement, ce qui n'est correct qu'à ce titre.

-- Produits (portent leur propre devise)
UPDATE "ProductVariant" v
   SET "priceOverride" = ROUND(v."priceOverride" * 655.957)
  FROM "Product" p
 WHERE v."productId" = p."id" AND p."currency" = 'EUR' AND v."priceOverride" IS NOT NULL;

UPDATE "Product" SET "price" = ROUND("price" * 655.957), "currency" = 'XOF' WHERE "currency" = 'EUR';

-- Lignes de commande, avant les commandes elles-mêmes (le filtre lit leur devise)
UPDATE "OrderItem" i
   SET "unitPrice" = ROUND(i."unitPrice" * 655.957)
  FROM "Order" o
 WHERE i."orderId" = o."id" AND o."currency" = 'EUR';

UPDATE "Order"
   SET "totalAmount"    = ROUND("totalAmount" * 655.957),
       "shippingAmount" = ROUND("shippingAmount" * 655.957),
       "platformAmount" = ROUND("platformAmount" * 655.957),
       "sellerAmount"   = ROUND("sellerAmount" * 655.957),
       "currency"       = 'XOF'
 WHERE "currency" = 'EUR';

UPDATE "OrderGroup" SET "totalAmount" = ROUND("totalAmount" * 655.957), "currency" = 'XOF' WHERE "currency" = 'EUR';
UPDATE "Payment"    SET "amount"      = ROUND("amount" * 655.957),      "currency" = 'XOF' WHERE "currency" = 'EUR';
UPDATE "Payout"     SET "amount"      = ROUND("amount" * 655.957),      "currency" = 'XOF' WHERE "currency" = 'EUR';

UPDATE "CreditPurchase"
   SET "amount" = ROUND("amount" * 655.957),
       "discountEur" = ROUND("discountEur" * 655.957),
       "currency" = 'XOF'
 WHERE "currency" = 'EUR';

UPDATE "SubscriptionPayment"
   SET "amount" = ROUND("amount" * 655.957),
       "discountEur" = ROUND("discountEur" * 655.957),
       "currency" = 'XOF'
 WHERE "currency" = 'EUR';

-- Frais de livraison de la boutique : aucune colonne de devise, ils étaient en
-- euros par définition.
UPDATE "Shop"
   SET "shippingFee"      = ROUND("shippingFee" * 655.957),
       "freeShippingFrom" = ROUND("freeShippingFrom" * 655.957)
 WHERE "shippingFee" IS NOT NULL OR "freeShippingFrom" IS NOT NULL;

UPDATE "ShippingRate" SET "fee" = ROUND("fee" * 655.957);

-- Réductions des codes promo à montant fixe (la colonne garde son nom hérité).
UPDATE "Coupon" SET "amountOffEur" = ROUND("amountOffEur" * 655.957) WHERE "amountOffEur" IS NOT NULL;
UPDATE "CouponRedemption" SET "amountOffEur" = ROUND("amountOffEur" * 655.957) WHERE "amountOffEur" IS NOT NULL;
