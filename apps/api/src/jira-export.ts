import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { createJiraClient, JiraRequestError } from "./jira-client.js";
import { decryptIntegrationSecret } from "./integration-secrets.js";

export const jiraExportBody = z.object({ revision: z.number().int().nonnegative() }).strict();
export const jiraReconcileBody = jiraExportBody.extend({
  issueKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,19}-[1-9][0-9]*$/),
});

function canReconcile(record: { state: string; createdAt: Date }, now = Date.now()) {
  return (
    record.state === "REVIEW_REQUIRED" ||
    (record.state === "PENDING" && now - record.createdAt.getTime() >= 5 * 60 * 1000)
  );
}

export function mountJiraExport(
  app: Express,
  db: PrismaClient,
  config: Config,
  guard: (write?: boolean, admin?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const path = "/api/v1/projects/:projectId/defects/:defectId/jira";
  app.post([`${path}/sync`, `${path}/reconcile`], guard(false, true), async (req, res) => {
    const reconcile = req.path.endsWith("/reconcile");
    const recovery = reconcile ? jiraReconcileBody.parse(req.body) : null;
    const input = recovery ?? jiraExportBody.parse(req.body);
    const projectId = String(req.params.projectId);
    const defect = await db.defect.findFirst({
      where: { id: String(req.params.defectId), projectId },
      include: { jiraExport: true },
    });
    if (!defect) return fail(404, "NOT_FOUND", "Defect not found");
    const record = defect.jiraExport;
    if (reconcile && (!record || !canReconcile(record)))
      return fail(
        409,
        "NOT_REVIEWABLE",
        "Export must need review or have been pending for at least five minutes",
      );
    if (!reconcile && (!record || record.state !== "LINKED" || !record.issueKey))
      return fail(409, "NOT_LINKED", "A confirmed Jira ticket is required");
    if (!record) return fail(409, "NOT_LINKED", "A Jira export is required");
    if (record.syncRevision !== input.revision)
      return fail(409, "CONFLICT", "Jira status changed; reload before syncing");
    const key = config.INTEGRATION_ENCRYPTION_KEY;
    if (!key) return fail(503, "NOT_CONFIGURED", "Integration encryption is not configured");
    const integration = await db.jiraIntegration.findUnique({ where: { projectId } });
    if (!integration?.connected)
      return fail(409, "NOT_CONFIGURED", "Configure Jira before syncing");
    // Never use credentials from a replacement site to read the original ticket.
    if (integration.site !== record.site || integration.jiraProjectKey !== record.jiraProjectKey)
      return fail(409, "TARGET_CHANGED", "Jira settings no longer match this ticket");
    let client: ReturnType<typeof createJiraClient>;
    try {
      const credentials = z
        .object({ email: z.string().email(), token: z.string().min(1) })
        .parse(
          JSON.parse(
            decryptIntegrationSecret(integration.encryptedCredentials, key, projectId, "jira"),
          ),
        );
      client = createJiraClient({
        ...credentials,
        site: integration.site,
        projectKey: integration.jiraProjectKey,
        issueTypeId: integration.issueTypeId,
      });
    } catch {
      return fail(503, "NOT_CONFIGURED", "Jira credentials could not be loaded");
    }
    let status: Awaited<ReturnType<typeof client.getIssueStatus>>;
    try {
      status = recovery
        ? await client.verifyExport(recovery.issueKey, defect.id)
        : await client.getIssueStatus(record.issueKey!);
    } catch (error) {
      const code = error instanceof JiraRequestError ? error.code : "UNAVAILABLE";
      return fail(
        502,
        `JIRA_${code}`,
        reconcile
          ? "Jira ticket could not be verified for this defect; the export remains unchanged"
          : "Jira status could not be refreshed; the last saved status is unchanged",
      );
    }
    const current = await db.jiraIntegration.findUnique({ where: { projectId } });
    if (!current || current.revision !== integration.revision)
      return fail(409, "CONFLICT", "Jira settings changed; retry with the current settings");
    // Compare-and-set prevents a slower concurrent response overwriting a saved snapshot.
    // QA transitions and their audit history are deliberately untouched.
    const updated = await db.$transaction(async (tx) => {
      const updated = await tx.jiraDefectExport.updateMany({
        where: {
          defectId: defect.id,
          syncRevision: input.revision,
          state: record.state,
        },
        data: {
          ...(reconcile
            ? {
                state: "LINKED" as const,
                issueKey: status.key,
                issueUrl: `${record.site}/browse/${status.key}`,
                errorCode: null,
              }
            : {}),
          jiraStatusId: status.id,
          jiraStatusName: status.name,
          jiraStatusCategory: status.statusCategory.key,
          statusSyncedAt: new Date(),
          syncRevision: { increment: 1 },
        },
      });
      if (reconcile && updated.count)
        await tx.jiraIntegrationEvent.create({
          data: {
            projectId,
            actorId: res.locals.userId as string,
            revision: integration.revision,
            action: `RECONCILED:${defect.id}:${status.key}`,
          },
        });
      return updated;
    });
    if (!updated.count) return fail(409, "CONFLICT", "Jira status changed; reload before syncing");
    return res.json({
      data: await db.jiraDefectExport.findUniqueOrThrow({ where: { defectId: defect.id } }),
    });
  });
  app.get(path, guard(), async (req, res) => {
    const defect = await db.defect.findFirst({
      where: { id: String(req.params.defectId), projectId: String(req.params.projectId) },
      include: { jiraExport: true },
    });
    if (!defect) return fail(404, "NOT_FOUND", "Defect not found");
    res.json({
      data: defect.jiraExport
        ? {
            ...defect.jiraExport,
            canReconcile: canReconcile(defect.jiraExport),
          }
        : null,
    });
  });
  app.post(path, guard(false, true), async (req, res) => {
    const input = jiraExportBody.parse(req.body);
    const projectId = String(req.params.projectId);
    const defect = await db.defect.findFirst({
      where: { id: String(req.params.defectId), projectId },
      include: { jiraExport: true },
    });
    if (!defect) return fail(404, "NOT_FOUND", "Defect not found");
    // Existing reservations are never retried automatically, including after a process crash.
    if (defect.jiraExport) return res.json({ data: defect.jiraExport });
    if (defect.revision !== input.revision)
      return fail(409, "CONFLICT", "Defect changed; reload before exporting");
    const key = config.INTEGRATION_ENCRYPTION_KEY;
    if (!key) return fail(503, "NOT_CONFIGURED", "Integration encryption is not configured");
    const integration = await db.jiraIntegration.findUnique({ where: { projectId } });
    if (!integration?.connected)
      return fail(409, "NOT_CONFIGURED", "Configure Jira before exporting");
    let client: ReturnType<typeof createJiraClient>;
    try {
      const credentials = z
        .object({ email: z.string().email(), token: z.string().min(1) })
        .parse(
          JSON.parse(
            decryptIntegrationSecret(integration.encryptedCredentials, key, projectId, "jira"),
          ),
        );
      client = createJiraClient({
        ...credentials,
        site: integration.site,
        projectKey: integration.jiraProjectKey,
        issueTypeId: integration.issueTypeId,
      });
    } catch {
      return fail(503, "NOT_CONFIGURED", "Jira credentials could not be loaded");
    }
    const summary = defect.title.trim().slice(0, 255) || "DriftGate defect";
    const description =
      `DriftGate defect: ${defect.id}\nSeverity: ${defect.severity}\n\nReproduction snapshot:\n${JSON.stringify(defect.reproduction, null, 2)}`.slice(
        0,
        16000,
      );
    // Unique reservation is committed before the external side effect. Competing callers
    // may read its state but cannot send a second create request.
    const reservation = await db.jiraDefectExport.createMany({
      data: {
        defectId: defect.id,
        site: integration.site,
        jiraProjectKey: integration.jiraProjectKey,
        integrationRevision: integration.revision,
        createdBy: res.locals.userId as string,
      },
      skipDuplicates: true,
    });
    if (reservation.count === 0)
      return res.json({
        data: await db.jiraDefectExport.findUniqueOrThrow({ where: { defectId: defect.id } }),
      });
    try {
      const issue = await client.createIssue({ summary, description });
      // A recovered link wins over late completion of the original request.
      await db.jiraDefectExport.updateMany({
        where: { defectId: defect.id, state: "PENDING", syncRevision: 0 },
        data: { state: "LINKED", issueKey: issue.key, issueUrl: issue.url },
      });
      return res.json({
        data: await db.jiraDefectExport.findUniqueOrThrow({ where: { defectId: defect.id } }),
      });
    } catch (error) {
      // A lost response (or failed local save) may still mean a ticket exists in Jira.
      const errorCode = error instanceof JiraRequestError ? error.code : "UNAVAILABLE";
      await db.jiraDefectExport.updateMany({
        where: { defectId: defect.id, state: "PENDING", syncRevision: 0 },
        data: { state: "REVIEW_REQUIRED", errorCode },
      });
      const data = await db.jiraDefectExport.findUniqueOrThrow({ where: { defectId: defect.id } });
      return res.status(data.state === "LINKED" ? 200 : 202).json({ data });
    }
  });
}
