CREATE TABLE "VisualBaseline" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "evidenceId" TEXT NOT NULL REFERENCES "Evidence"("id") ON DELETE RESTRICT,
  "label" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "browser" TEXT NOT NULL,
  "device" TEXT NOT NULL,
  "checkId" TEXT NOT NULL,
  "viewportWidth" INTEGER NOT NULL CHECK ("viewportWidth" > 0),
  "viewportHeight" INTEGER NOT NULL CHECK ("viewportHeight" > 0),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewComment" TEXT,
  CHECK (("status" = 'PENDING' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "reviewComment" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(trim("reviewComment")) > 0))
);
CREATE UNIQUE INDEX "VisualBaseline_projectId_evidenceId_key" ON "VisualBaseline"("projectId", "evidenceId");
CREATE INDEX "VisualBaseline_projectId_id_idx" ON "VisualBaseline"("projectId", "id");
