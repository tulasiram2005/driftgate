CREATE TABLE "SqlCheckRun" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "environment" TEXT NOT NULL CHECK ("environment" IN ('staging', 'uat', 'preprod', 'prod')),
  "status" TEXT NOT NULL CHECK ("status" IN ('PASS', 'FAIL', 'ERROR')),
  "results" JSONB NOT NULL,
  "errorCode" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs" INTEGER NOT NULL CHECK ("durationMs" >= 0)
);
CREATE INDEX "SqlCheckRun_projectId_id_idx" ON "SqlCheckRun"("projectId", "id");
