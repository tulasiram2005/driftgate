ALTER TABLE "JiraDefectExport"
  ADD COLUMN "nextPollAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "pollLease" TEXT,
  ADD COLUMN "pollLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "pollFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pollError" TEXT;
CREATE INDEX "JiraDefectExport_state_nextPollAt_idx" ON "JiraDefectExport"("state", "nextPollAt");
