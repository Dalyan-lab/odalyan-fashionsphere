-- Remboursements, avec reprise de la part vendeur.

DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Refund" (
  "id"              TEXT NOT NULL,
  "reference"       TEXT NOT NULL,
  "status"          "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "amount"          DECIMAL(10,2) NOT NULL,
  "sellerShare"     DECIMAL(10,2) NOT NULL,
  "platformShare"   DECIMAL(10,2) NOT NULL,
  "reason"          TEXT NOT NULL,
  "decisionNote"    TEXT,
  "decidedAt"       TIMESTAMP(3),
  "settledPayoutId" TEXT,
  "orderId"         TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_reference_key" ON "Refund"("reference");
-- Un seul remboursement par commande : les remboursements partiels
-- demanderaient un suivi ligne à ligne.
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_orderId_key" ON "Refund"("orderId");
CREATE INDEX IF NOT EXISTS "Refund_status_idx" ON "Refund"("status");
CREATE INDEX IF NOT EXISTS "Refund_settledPayoutId_idx" ON "Refund"("settledPayoutId");

DO $$ BEGIN
  ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
