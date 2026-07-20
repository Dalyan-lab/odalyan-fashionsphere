-- Vidéo à publier (TikTok, Reels…). Prioritaire sur l'image quand présente.
ALTER TABLE "ScheduledPost" ADD COLUMN "videoUrl" TEXT;
