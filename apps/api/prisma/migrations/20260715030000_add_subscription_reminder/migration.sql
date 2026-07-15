-- Dédoublonnage des rappels d'expiration d'abonnement
ALTER TABLE "Subscription" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
