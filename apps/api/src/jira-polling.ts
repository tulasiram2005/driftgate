import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { createJiraClient, JiraRequestError } from "./jira-client.js";
import { decryptIntegrationSecret } from "./integration-secrets.js";

const interval = 15 * 60 * 1000;
const credentialsSchema = z.object({ email: z.string().email(), token: z.string().min(1) });

/** Read-only remote polling. No issue creation, QA transitions or credential logging. */
export async function pollJiraStatuses(db: PrismaClient, config: Config) {
  const key = config.INTEGRATION_ENCRYPTION_KEY;
  if (!config.JIRA_POLLING_ENABLED || !key) return;
  const due = () => ({
    state: "LINKED",
    issueKey: { not: null },
    defect: { project: { jiraIntegration: { is: { connected: true } } } },
    nextPollAt: { lte: new Date() },
    OR: [{ pollLeaseUntil: null }, { pollLeaseUntil: { lt: new Date() } }],
  });
  const rows = await db.jiraDefectExport.findMany({
    where: due(),
    orderBy: [{ nextPollAt: "asc" }, { defectId: "asc" }],
    take: 5,
    include: { defect: { select: { projectId: true } } },
  });
  for (const row of rows) {
    const lease = randomUUID();
    const claimed = await db.jiraDefectExport.updateMany({
      where: { ...due(), defectId: row.defectId, syncRevision: row.syncRevision },
      data: { pollLease: lease, pollLeaseUntil: new Date(Date.now() + 60000) },
    });
    if (!claimed.count) continue;
    const owned = { defectId: row.defectId, pollLease: lease };
    try {
      const projectId = row.defect.projectId;
      const saved = await db.jiraIntegration.findUnique({ where: { projectId } });
      if (
        !saved?.connected ||
        saved.site !== row.site ||
        saved.jiraProjectKey !== row.jiraProjectKey
      )
        throw new JiraRequestError("REJECTED");
      const credentials = credentialsSchema.parse(
        JSON.parse(decryptIntegrationSecret(saved.encryptedCredentials, key, projectId, "jira")),
      );
      const status = await createJiraClient({
        ...credentials,
        site: saved.site,
        projectKey: saved.jiraProjectKey,
        issueTypeId: saved.issueTypeId,
      }).getIssueStatus(row.issueKey!);
      // The relational predicate and revision guard discard stale results atomically.
      await db.jiraDefectExport.updateMany({
        where: {
          ...owned,
          state: "LINKED",
          syncRevision: row.syncRevision,
          defect: { project: { jiraIntegration: { is: { revision: saved.revision } } } },
        },
        data: {
          jiraStatusId: status.id,
          jiraStatusName: status.name,
          jiraStatusCategory: status.statusCategory.key,
          statusSyncedAt: new Date(),
          syncRevision: { increment: 1 },
          pollFailures: 0,
          pollError: null,
        },
      });
      await db.jiraDefectExport.updateMany({
        where: owned,
        data: { nextPollAt: new Date(Date.now() + interval) },
      });
    } catch (error) {
      const failures = Math.min(row.pollFailures + 1, 10);
      await db.jiraDefectExport.updateMany({
        where: owned,
        data: {
          pollFailures: failures,
          pollError: error instanceof JiraRequestError ? error.code : "UNAVAILABLE",
          nextPollAt: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, interval * 2 ** failures)),
        },
      });
    } finally {
      await db.jiraDefectExport.updateMany({
        where: owned,
        data: { pollLease: null, pollLeaseUntil: null },
      });
    }
  }
}
