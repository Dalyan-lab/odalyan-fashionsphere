-- Statistiques par publication et par réseau, rafraîchies depuis l'API de chaque réseau.
CREATE TABLE "PostInsight" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "externalId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "postId" TEXT NOT NULL,

    CONSTRAINT "PostInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostInsight_postId_idx" ON "PostInsight"("postId");

CREATE UNIQUE INDEX "PostInsight_postId_network_key" ON "PostInsight"("postId", "network");

ALTER TABLE "PostInsight" ADD CONSTRAINT "PostInsight_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "ScheduledPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
