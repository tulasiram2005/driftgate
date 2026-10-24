import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { createJiraClient, JiraRequestError } from "./jira-client.js";
import { decryptIntegrationSecret } from "./integration-secrets.js";

export const jiraExportBody = z.object({ revision: z.number().int().nonnegative() }).strict();

export function mountJiraExport(
  app: Express,
  db: PrismaClient,
  config: Config,
  guard: (write?: boolean, admin?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const path = "/api/v1/projects/:projectId/defects/:defectId/jira";
  app.get(path, guard(), async (req, res) => {
    const defect = await db.defect.findFirst({
      where: { id: String(req.params.defectId), projectId: String(req.params.projectId) },
      include: { jiraExport: true },
    });
    if (!defect) return fail(404, "NOT_FOUND", "Defect not found");
    res.json({ data: defect.jiraExport });
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
    if (!integration) return fail(409, "NOT_CONFIGURED", "Configure Jira before exporting");
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
      const data = await db.jiraDefectExport.update({
        where: { defectId: defect.id },
        data: { state: "LINKED", issueKey: issue.key, issueUrl: issue.url },
      });
      return res.json({ data });
    } catch (error) {
      // A lost response (or failed local save) may still mean a ticket exists in Jira.
      const errorCode = error instanceof JiraRequestError ? error.code : "UNAVAILABLE";
      const data = await db.jiraDefectExport.update({
        where: { defectId: defect.id },
        data: { state: "REVIEW_REQUIRED", errorCode },
      });
      return res.status(202).json({ data });
    }
  });
}
