import { z } from "zod";

const projectKey = z.string().regex(/^[A-Z][A-Z0-9_]{1,19}$/);
const issueKey = z.string().regex(/^[A-Z][A-Z0-9_]{1,19}-[1-9][0-9]*$/);
const issue = z.object({ id: z.string().regex(/^\d+$/), key: issueKey });
const status = issue.extend({
  fields: z.object({
    status: z.object({
      id: z.string().regex(/^\d+$/),
      name: z.string().min(1).max(255),
      statusCategory: z.object({ key: z.enum(["new", "indeterminate", "done"]) }),
    }),
  }),
});

export function jiraSiteOrigin(value: string): string {
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net\/?$/.test(value)) {
    throw new Error("Jira site must be an HTTPS Atlassian Cloud site origin");
  }
  return new URL(value).origin;
}

export class JiraRequestError extends Error {
  constructor(
    public readonly code: "AUTH" | "RATE_LIMIT" | "REJECTED" | "UNAVAILABLE" | "INVALID_RESPONSE",
  ) {
    super(`Jira request failed: ${code}`);
    this.name = "JiraRequestError";
  }
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new JiraRequestError("INVALID_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new JiraRequestError("INVALID_RESPONSE");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    reader.releaseLock();
  }
}

/** Server-side personal integration using an unscoped Atlassian API token. */
export function createJiraClient(
  config: { site: string; email: string; token: string; projectKey: string; issueTypeId: string },
  transport: typeof fetch = fetch,
) {
  const origin = jiraSiteOrigin(config.site);
  const project = projectKey.parse(config.projectKey);
  const type = z.string().regex(/^\d+$/).parse(config.issueTypeId);
  const email = z.string().email().max(254).parse(config.email);
  // Validate credentials without including their contents in validation errors.
  if (!config.token || config.token.length > 16384 || /[\r\n]/.test(config.token)) {
    throw new Error("Invalid Jira API token");
  }
  const authorization = `Basic ${Buffer.from(`${email}:${config.token}`).toString("base64")}`;
  async function request(path: string, method: "GET" | "POST", body?: unknown) {
    try {
      const response = await transport(`${origin}/rest/api/3/${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new JiraRequestError(
          [401, 403].includes(response.status)
            ? "AUTH"
            : response.status === 429
              ? "RATE_LIMIT"
              : response.status >= 500
                ? "UNAVAILABLE"
                : "REJECTED",
        );
      }
      return await boundedJson(response);
    } catch (error) {
      if (error instanceof JiraRequestError) throw error;
      // Network errors can contain URLs/headers. Never propagate their raw diagnostics.
      throw new JiraRequestError("UNAVAILABLE");
    }
  }
  function checked<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new JiraRequestError("INVALID_RESPONSE");
    return parsed.data;
  }
  function assertProject(key: string) {
    if (!key.startsWith(`${project}-`)) throw new JiraRequestError("INVALID_RESPONSE");
  }
  return {
    async createIssue(input: { summary: string; description: string }) {
      const summary = z.string().trim().min(1).max(255).parse(input.summary);
      const description = z.string().min(1).max(16000).parse(input.description);
      // Plain text ADF prevents user-provided markup from becoming executable document nodes.
      const data = checked(
        issue,
        await request("issue", "POST", {
          fields: {
            project: { key: project },
            issuetype: { id: type },
            summary,
            description: {
              type: "doc",
              version: 1,
              content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
            },
          },
        }),
      );
      assertProject(data.key);
      return { ...data, url: `${origin}/browse/${data.key}` };
    },
    async getIssueStatus(key: string) {
      issueKey.parse(key);
      assertProject(key);
      const data = checked(
        status,
        await request(`issue/${encodeURIComponent(key)}?fields=status`, "GET"),
      );
      if (data.key !== key) throw new JiraRequestError("INVALID_RESPONSE");
      return { key: data.key, ...data.fields.status };
    },
  };
}
