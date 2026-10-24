ALTER TABLE "JiraDefectExport"
ADD COLUMN "jiraStatusId" TEXT,
ADD COLUMN "jiraStatusName" TEXT,
ADD COLUMN "jiraStatusCategory" TEXT,
ADD COLUMN "statusSyncedAt" TIMESTAMP(3),
ADD COLUMN "syncRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "JiraDefectExport" ADD CONSTRAINT "JiraDefectExport_status_category_check"
CHECK ("jiraStatusCategory" IN ('new', 'indeterminate', 'done'));
