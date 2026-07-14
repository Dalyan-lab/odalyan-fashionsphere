-- Système d'encouragement ViralAmazone (Couche 1) : clics, séries, niveaux, récompenses

CREATE TYPE "CreatorTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

ALTER TABLE "Shop" ADD COLUMN "totalClicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "currentStreakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "longestStreakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN "lastActivityDate" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "creatorTier" "CreatorTier" NOT NULL DEFAULT 'BRONZE';

CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AffiliateClick_shopId_createdAt_idx" ON "AffiliateClick"("shopId", "createdAt");
CREATE INDEX "AffiliateClick_scriptId_ipHash_createdAt_idx" ON "AffiliateClick"("scriptId", "ipHash", "createdAt");

ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_scriptId_fkey"
    FOREIGN KEY ("scriptId") REFERENCES "ViralScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RewardEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardEvent_shopId_key_key" ON "RewardEvent"("shopId", "key");
CREATE INDEX "RewardEvent_shopId_idx" ON "RewardEvent"("shopId");

ALTER TABLE "RewardEvent" ADD CONSTRAINT "RewardEvent_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
