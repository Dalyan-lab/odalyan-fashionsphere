-- Rayons Amazon suivis automatiquement (découverte des meilleures ventes).
CREATE TABLE IF NOT EXISTS "TrendWatch" (
  "id"          TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "marketplace" TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "topN"        INTEGER NOT NULL DEFAULT 10,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"   TIMESTAMP(3),
  "lastCount"   INTEGER,
  "lastError"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrendWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrendWatch_marketplace_category_key" ON "TrendWatch"("marketplace", "category");
CREATE INDEX IF NOT EXISTS "TrendWatch_active_idx" ON "TrendWatch"("active");
