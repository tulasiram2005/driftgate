CREATE TABLE "EnvironmentSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_IMPORT',
    "createdBy" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvironmentSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnvironmentSnapshot_environment_check" CHECK ("environment" IN ('staging','uat','preprod','prod')),
    CONSTRAINT "EnvironmentSnapshot_source_check" CHECK ("source" = 'MANUAL_IMPORT')
);
CREATE INDEX "EnvironmentSnapshot_projectId_id_idx" ON "EnvironmentSnapshot"("projectId", "id");
ALTER TABLE "EnvironmentSnapshot" ADD CONSTRAINT "EnvironmentSnapshot_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
