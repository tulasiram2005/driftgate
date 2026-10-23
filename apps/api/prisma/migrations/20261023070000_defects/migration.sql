CREATE TABLE "Defect" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "resultId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "reproduction" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Defect_projectId_resultId_key" ON "Defect"("projectId", "resultId");
CREATE INDEX "Defect_projectId_id_idx" ON "Defect"("projectId", "id");
CREATE TABLE "DefectEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "defectId" TEXT NOT NULL REFERENCES "Defect"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DefectEvent_defectId_createdAt_idx" ON "DefectEvent"("defectId", "createdAt");
