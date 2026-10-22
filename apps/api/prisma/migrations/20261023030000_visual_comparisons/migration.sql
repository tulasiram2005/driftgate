CREATE TABLE "VisualComparison" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "baselineId" TEXT NOT NULL REFERENCES "VisualBaseline"("id") ON DELETE RESTRICT,
  "evidenceId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "width" INTEGER NOT NULL CHECK ("width" > 0),
  "height" INTEGER NOT NULL CHECK ("height" > 0),
  "changedPixels" INTEGER NOT NULL CHECK ("changedPixels" >= 0),
  "comparedPixels" INTEGER NOT NULL CHECK ("comparedPixels" > 0 AND "changedPixels" <= "comparedPixels"),
  "diffKey" TEXT NOT NULL UNIQUE
);
CREATE INDEX "VisualComparison_projectId_id_idx" ON "VisualComparison"("projectId", "id");
