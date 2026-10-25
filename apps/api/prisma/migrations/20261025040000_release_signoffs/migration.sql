ALTER TABLE "Release" ADD COLUMN "approvalRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "ReleaseSignoff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT NOT NULL REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
  "environment" TEXT NOT NULL CHECK ("environment" IN ('STAGING', 'UAT', 'PREPROD', 'PROD')),
  "gateRevision" INTEGER NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "approverName" TEXT NOT NULL,
  "comment" TEXT NOT NULL CHECK (length(trim("comment")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "precedingGateSignoffId" TEXT,
  "previousHash" TEXT,
  "hash" TEXT NOT NULL,
  UNIQUE ("releaseId", "sequence")
);
