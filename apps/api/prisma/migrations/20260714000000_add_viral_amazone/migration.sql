-- ViralAmazone Trend Machine : tracker de tendances Amazon + scripts viraux IA

CREATE TYPE "TrendTier" AS ENUM ('SUPER_NOVA', 'HOT_WOOD', 'SLOW_BURN');
CREATE TYPE "ScriptPlatform" AS ENUM ('TIKTOK', 'REELS', 'SHORTS');

-- Sub-tag de suivi interne pour le partage de revenu d'affiliation par vendeur
ALTER TABLE "Shop" ADD COLUMN "affiliateTrackingId" TEXT;
CREATE UNIQUE INDEX "Shop_affiliateTrackingId_key" ON "Shop"("affiliateTrackingId");

CREATE TABLE "AmazonProduct" (
    "id" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT,
    "productUrl" TEXT NOT NULL,
    "currentRank" INTEGER,
    "currentPrice" DECIMAL(12,2),
    "currency" TEXT,
    "reviewCount" INTEGER,
    "rating" DECIMAL(3,2),
    "lastCheckedAt" TIMESTAMP(3),
    "velocity3h" DOUBLE PRECISION,
    "velocity12h" DOUBLE PRECISION,
    "velocity24h" DOUBLE PRECISION,
    "trendTier" "TrendTier",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmazonProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AmazonProduct_asin_marketplace_key" ON "AmazonProduct"("asin", "marketplace");
CREATE INDEX "AmazonProduct_trendTier_idx" ON "AmazonProduct"("trendTier");
CREATE INDEX "AmazonProduct_category_idx" ON "AmazonProduct"("category");

CREATE TABLE "AmazonRankSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salesRank" INTEGER NOT NULL,
    "price" DECIMAL(12,2),
    "reviewCount" INTEGER,
    "rating" DECIMAL(3,2),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonRankSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AmazonRankSnapshot_productId_capturedAt_idx" ON "AmazonRankSnapshot"("productId", "capturedAt");

ALTER TABLE "AmazonRankSnapshot" ADD CONSTRAINT "AmazonRankSnapshot_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "AmazonProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ViralScript" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "platform" "ScriptPlatform" NOT NULL DEFAULT 'TIKTOK',
    "hook" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "affiliateUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViralScript_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ViralScript_shopId_idx" ON "ViralScript"("shopId");
CREATE INDEX "ViralScript_productId_idx" ON "ViralScript"("productId");

ALTER TABLE "ViralScript" ADD CONSTRAINT "ViralScript_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViralScript" ADD CONSTRAINT "ViralScript_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "AmazonProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
