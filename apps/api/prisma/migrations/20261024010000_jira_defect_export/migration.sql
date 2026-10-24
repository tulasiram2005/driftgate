CREATE TABLE "JiraDefectExport" (
  "defectId" TEXT NOT NULL,
  "site" TEXT NOT NULL,
  "jiraProjectKey" TEXT NOT NULL,
  "integrationRevision" INTEGER NOT NULL,
  "createdBy" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "issueKey" TEXT,
  "issueUrl" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JiraDefectExport_pkey" PRIMARY KEY ("defectId"),
  CONSTRAINT "JiraDefectExport_state_check" CHECK ("state" IN ('PENDING', 'LINKED', 'REVIEW_REQUIRED')),
  CONSTRAINT "JiraDefectExport_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
