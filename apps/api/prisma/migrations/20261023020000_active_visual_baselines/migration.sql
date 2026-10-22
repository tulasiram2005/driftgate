ALTER TABLE "VisualBaseline" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "activatedBy" TEXT, ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "VisualBaseline" ADD CONSTRAINT "active_baseline_approved"
  CHECK (NOT "active" OR ("status" = 'APPROVED' AND "activatedBy" IS NOT NULL AND "activatedAt" IS NOT NULL));
CREATE UNIQUE INDEX "VisualBaseline_active_scope_key" ON "VisualBaseline"
  ("projectId", "environment", "browser", "device", "checkId", "viewportWidth", "viewportHeight")
  WHERE "active";
