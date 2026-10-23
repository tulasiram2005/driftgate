CREATE TABLE "JiraIntegration" (
  "projectId" TEXT NOT NULL PRIMARY KEY,
  "site" TEXT NOT NULL,
  "jiraProjectKey" TEXT NOT NULL,
  "issueTypeId" TEXT NOT NULL,
  "encryptedCredentials" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JiraIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "JiraIntegrationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JiraIntegrationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JiraIntegration"("projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JiraIntegrationEvent_projectId_createdAt_idx" ON "JiraIntegrationEvent"("projectId", "createdAt");
