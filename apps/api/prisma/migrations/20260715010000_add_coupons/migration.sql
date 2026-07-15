-- Codes promo (coupons) appliqués au paiement (crédits, puis abonnement plus tard)

ALTER TABLE "CreditPurchase" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "CreditPurchase" ADD COLUMN "discountEur" DECIMAL(10,2);

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "percentOff" INTEGER,
    "amountOffEur" DECIMAL(10,2),
    "appliesTo" TEXT NOT NULL DEFAULT 'credits',
    "maxRedemptions" INTEGER,
    "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "amountOffEur" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_couponId_shopId_key" ON "CouponRedemption"("couponId", "shopId");
CREATE INDEX "CouponRedemption_shopId_idx" ON "CouponRedemption"("shopId");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
