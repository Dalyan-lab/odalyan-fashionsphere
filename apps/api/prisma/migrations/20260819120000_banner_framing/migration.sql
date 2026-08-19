-- Hauteur et cadrage du bandeau : une vidéo 16:9 dans un bandeau large perd
-- plus de la moitié de sa hauteur, il faut pouvoir choisir ce qui survit.

ALTER TABLE "MarketplaceBanner"
  ADD COLUMN IF NOT EXISTS "height" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "MarketplaceBanner"
  ADD COLUMN IF NOT EXISTS "mediaPosition" TEXT NOT NULL DEFAULT 'center';
