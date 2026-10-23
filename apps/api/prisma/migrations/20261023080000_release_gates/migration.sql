CREATE TABLE "Release" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Release_projectId_id_idx" ON "Release"("projectId", "id");
CREATE TABLE "ReleaseGate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT NOT NULL REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "environment" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "runIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);
CREATE UNIQUE INDEX "ReleaseGate_releaseId_environment_key" ON "ReleaseGate"("releaseId", "environment");
CREATE UNIQUE INDEX "ReleaseGate_releaseId_position_key" ON "ReleaseGate"("releaseId", "position");
