-- Publication automatique réelle sur les réseaux : jetons OAuth + résultats par réseau

ALTER TABLE "SocialConnection" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "SocialConnection" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "SocialConnection" ADD COLUMN "externalId" TEXT;
ALTER TABLE "SocialConnection" ADD COLUMN "scope" TEXT;
ALTER TABLE "SocialConnection" ADD COLUMN "simulated" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ScheduledPost" ADD COLUMN "results" JSONB;
ALTER TABLE "ScheduledPost" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScheduledPost" ADD COLUMN "lastError" TEXT;
