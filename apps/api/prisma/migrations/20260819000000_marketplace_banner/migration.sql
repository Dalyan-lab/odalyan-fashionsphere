-- Bandeau de tête de la marketplace, programmable depuis l'administration.

CREATE TABLE IF NOT EXISTS "MarketplaceBanner" (
  "id"        TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "subtitle"  TEXT,
  "badge"     TEXT,
  "tone"      TEXT NOT NULL DEFAULT 'PROMO',
  "ctaLabel"  TEXT,
  "ctaUrl"    TEXT,
  "imageUrl"  TEXT,
  "videoUrl"  TEXT,
  "theme"     TEXT NOT NULL DEFAULT 'violet',
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "startsAt"  TIMESTAMP(3),
  "endsAt"    TIMESTAMP(3),
  "priority"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceBanner_pkey" PRIMARY KEY ("id")
);

-- La sélection du bandeau à afficher filtre sur `active` puis trie sur
-- `priority` : c'est exactement cet index.
CREATE INDEX IF NOT EXISTS "MarketplaceBanner_active_priority_idx"
  ON "MarketplaceBanner"("active", "priority");
