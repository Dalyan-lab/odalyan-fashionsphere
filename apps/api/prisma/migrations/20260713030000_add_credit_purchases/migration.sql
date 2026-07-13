-- Crédits IA achetés en supplément (report permanent, non réinitialisés au mois)
ALTER TABLE "Shop" ADD COLUMN "aiCreditsExtra" INTEGER NOT NULL DEFAULT 0;

-- Recharges de crédits via Paystack
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "providerRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPurchase_providerRef_key" ON "CreditPurchase"("providerRef");
CREATE INDEX "CreditPurchase_shopId_idx" ON "CreditPurchase"("shopId");

ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
