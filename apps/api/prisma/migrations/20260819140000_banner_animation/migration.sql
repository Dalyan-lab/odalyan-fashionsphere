-- Animation native de l'image de fond, en remplacement d'un export vidéo.

ALTER TABLE "MarketplaceBanner"
  ADD COLUMN IF NOT EXISTS "animation" TEXT NOT NULL DEFAULT 'none';
