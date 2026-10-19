ALTER TABLE "Run" ALTER COLUMN "suiteId" DROP NOT NULL;
ALTER TABLE "Run" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'MANUAL', ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING', ADD COLUMN "dispatch" TEXT NOT NULL DEFAULT 'LOCAL', ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Run_projectId_idempotencyKey_key" ON "Run"("projectId", "idempotencyKey");
ALTER TABLE "Result" ADD COLUMN "browser" TEXT NOT NULL DEFAULT 'Chromium', ADD COLUMN "device" TEXT NOT NULL DEFAULT 'Desktop', ADD COLUMN "flaky" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Result" SET "browser" = "Run"."browser", "device" = "Run"."device" FROM "Run" WHERE "Result"."runId" = "Run"."id";
DROP INDEX "Result_runId_caseId_key";
CREATE UNIQUE INDEX "Result_runId_caseId_browser_device_key" ON "Result"("runId", "caseId", "browser", "device");
CREATE TABLE "ResultAttempt" (
 "id" TEXT PRIMARY KEY, "resultId" TEXT NOT NULL REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "number" INTEGER NOT NULL CHECK ("number" BETWEEN 1 AND 3), "status" TEXT NOT NULL, "durationMs" INTEGER NOT NULL CHECK ("durationMs" >= 0), "error" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ResultAttempt_resultId_number_key" ON "ResultAttempt"("resultId", "number");
CREATE TABLE "Evidence" (
 "id" TEXT PRIMARY KEY, "resultId" TEXT NOT NULL REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "key" TEXT NOT NULL, "kind" TEXT NOT NULL, "contentType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL CHECK ("sizeBytes" > 0), "ready" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Evidence_key_key" ON "Evidence"("key");
CREATE INDEX "Evidence_resultId_id_idx" ON "Evidence"("resultId", "id");
CREATE TABLE "DispatchOutbox" (
 "id" TEXT PRIMARY KEY, "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMP(3), "lastError" TEXT
);
CREATE UNIQUE INDEX "DispatchOutbox_runId_key" ON "DispatchOutbox"("runId");
CREATE INDEX "DispatchOutbox_status_availableAt_idx" ON "DispatchOutbox"("status", "availableAt");
CREATE TABLE "CallbackReceipt" (
 "id" TEXT PRIMARY KEY, "bodyHash" TEXT NOT NULL, "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CallbackReceipt_runId_idx" ON "CallbackReceipt"("runId");
CREATE TABLE "RunEvent" (
 "id" SERIAL PRIMARY KEY, "runId" TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "data" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RunEvent_runId_id_idx" ON "RunEvent"("runId", "id");
