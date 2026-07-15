-- Produits affiliés (importés d'un marketplace via ViralAmazone) : lien externe + provenance
ALTER TABLE "Product" ADD COLUMN "affiliateUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceMarketplace" TEXT;
