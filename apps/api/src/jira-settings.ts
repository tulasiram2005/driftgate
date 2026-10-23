import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { createJiraClient, JiraRequestError, jiraSiteOrigin } from "./jira-client.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-secrets.js";

export const jiraVerifyBody = z.object({ revision: z.number().int().min(1) }).strict();

export const jiraSettingsBody = z
  .object({
    site: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          jiraSiteOrigin(value);
          return true;
        } catch {
          return false;
        }
      }, "Use an HTTPS Atlassian Cloud site origin"),
    jiraProjectKey: z.string().regex(/^[A-Z][A-Z0-9_]{1,19}$/),
    issueTypeId: z.string().regex(/^\d+$/).max(30),
    email: z.string().email().max(254),
    token: z
      .string()
      .min(1)
      .max(12000)
      .regex(/^[\x21-\x7e]+$/, "Invalid token"),
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict();

const publicFields = {
  projectId: true,
  site: true,
  jiraProjectKey: true,
  issueTypeId: true,
  revision: true,
  updatedAt: true,
} as const;

export function mountJiraSettings(
  app: Express,
  db: PrismaClient,
  config: Config,
  guard: (write?: boolean, admin?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const path = "/api/v1/projects/:projectId/integrations/jira";
  app.post(`${path}/verify`, guard(false, true), async (req, res) => {
    const key = config.INTEGRATION_ENCRYPTION_KEY;
    if (!key) return fail(503, "NOT_CONFIGURED", "Integration encryption is not configured");
    const input = jiraVerifyBody.safeParse(req.body);
    if (!input.success) return fail(400, "INVALID_INPUT", "Invalid verification request");
    const projectId = z.string().min(1).max(100).parse(req.params.projectId);
    const saved = await db.jiraIntegration.findUnique({ where: { projectId } });
    if (!saved) return fail(404, "NOT_FOUND", "Save Jira settings before checking access");
    if (saved.revision !== input.data.revision)
      return fail(409, "CONFLICT", "Jira settings changed; reload before checking access");
    try {
      const credentials = z
        .object({ email: z.string().email(), token: z.string().min(1) })
        .parse(
          JSON.parse(decryptIntegrationSecret(saved.encryptedCredentials, key, projectId, "jira")),
        );
      await createJiraClient({
        ...credentials,
        site: saved.site,
        projectKey: saved.jiraProjectKey,
        issueTypeId: saved.issueTypeId,
      }).verifyAccess();
    } catch (error) {
      const code = error instanceof JiraRequestError ? error.code : "UNAVAILABLE";
      return fail(
        502,
        `JIRA_${code}`,
        {
          AUTH: "Jira credentials or project permissions were rejected",
          REJECTED: "Jira project or issue type is unavailable",
          RATE_LIMIT: "Jira rate limit reached. Try again later",
          INVALID_RESPONSE: "Jira returned an unexpected response",
          UNAVAILABLE: "Unable to check Jira access. Check server configuration and try again",
        }[code],
      );
    }
    const current = await db.jiraIntegration.findUnique({
      where: { projectId },
      select: { revision: true },
    });
    if (current?.revision !== saved.revision)
      return fail(
        409,
        "CONFLICT",
        "Jira settings changed during verification; reload and check again",
      );
    res.json({
      data: {
        revision: saved.revision,
        checkedAt: new Date().toISOString(),
        status: "ACCESS_CONFIRMED",
      },
    });
  });
  app.get(path, guard(false, true), async (req, res) => {
    const projectId = z.string().min(1).max(100).parse(req.params.projectId);
    const data = await db.jiraIntegration.findUnique({
      where: { projectId },
      select: publicFields,
    });
    res.json({ data, available: Boolean(config.INTEGRATION_ENCRYPTION_KEY) });
  });
  app.put(path, guard(false, true), async (req, res) => {
    const key = config.INTEGRATION_ENCRYPTION_KEY;
    if (!key) return fail(503, "NOT_CONFIGURED", "Integration encryption is not configured");
    const projectId = z.string().min(1).max(100).parse(req.params.projectId);
    // Fixed error avoids reflecting unknown property names or credential values.
    const parsed = jiraSettingsBody.safeParse(req.body);
    if (!parsed.success) return fail(400, "INVALID_INPUT", "Invalid Jira settings");
    const { email, token, revision, site, ...settings } = parsed.data;
    const encryptedCredentials = encryptIntegrationSecret(
      JSON.stringify({ email, token }),
      key,
      projectId,
      "jira",
    );
    const data = await db.$transaction(async (tx) => {
      const values = { ...settings, site: jiraSiteOrigin(site), encryptedCredentials };
      if (revision === 0) {
        await tx.jiraIntegration.create({ data: { projectId, ...values } });
      } else {
        const changed = await tx.jiraIntegration.updateMany({
          where: { projectId, revision },
          data: { ...values, revision: { increment: 1 } },
        });
        if (changed.count !== 1)
          return fail(409, "CONFLICT", "Jira settings changed; refresh before saving");
      }
      await tx.jiraIntegrationEvent.create({
        data: {
          projectId,
          actorId: res.locals.userId as string,
          revision: revision + 1,
          action: revision === 0 ? "CONFIGURED" : "REPLACED",
        },
      });
      return tx.jiraIntegration.findUniqueOrThrow({ where: { projectId }, select: publicFields });
    });
    res.json({ data });
  });
}
