-- CreateEnum
CREATE TYPE "GeneratedAssetType" AS ENUM ('MANNEQUIN', 'STUDIO_PHOTO', 'AD_VISUAL', 'AD_COPY', 'AVATAR');

-- CreateEnum
CREATE TYPE "GeneratedAssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "GeneratedAsset" (
    "id" TEXT NOT NULL,
    "type" "GeneratedAssetType" NOT NULL,
    "status" "GeneratedAssetStatus" NOT NULL DEFAULT 'READY',
    "provider" TEXT NOT NULL,
    "prompt" TEXT,
    "url" TEXT,
    "meta" JSONB,
    "ownerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedAsset_shopId_idx" ON "GeneratedAsset"("shopId");

-- CreateIndex
CREATE INDEX "GeneratedAsset_type_idx" ON "GeneratedAsset"("type");

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAsset" ADD CONSTRAINT "GeneratedAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
