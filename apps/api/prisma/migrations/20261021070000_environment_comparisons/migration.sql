CREATE TABLE "EnvironmentComparison" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "beforeId" TEXT NOT NULL,
 "afterId" TEXT NOT NULL,
 "source" TEXT NOT NULL DEFAULT 'MANUAL_IMPORT' CHECK ("source" = 'MANUAL_IMPORT'),
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "findingCount" INTEGER NOT NULL CHECK ("findingCount" >= 0),
 "findings" JSONB NOT NULL,
 CHECK ("beforeId" <> "afterId")
);
CREATE INDEX "EnvironmentComparison_projectId_id_idx" ON "EnvironmentComparison"("projectId", "id");
