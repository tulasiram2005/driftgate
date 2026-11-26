import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "../generated/client/index.js";
import { readConfig } from "../src/config.js";
import { encryptIntegrationSecret } from "../src/integration-secrets.js";
import { pollJiraStatuses } from "../src/jira-polling.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const config = readConfig({
  DATABASE_URL: url,
  JWT_SECRET: "test-only-".repeat(6),
  INTEGRATION_ENCRYPTION_KEY: "ab".repeat(32),
  JIRA_POLLING_ENABLED: "1",
});
let projectId: string;
let defectId: string;
const response = () =>
  Response.json({
    id: "1",
    key: "KAN-1",
    fields: {
      status: { id: "3", name: "Done", statusCategory: { key: "done" } },
    },
  });
const record = () => db.jiraDefectExport.findUniqueOrThrow({ where: { defectId } });

it("skips disconnected projects while preserving linked tickets", async () => {
  await db.jiraIntegration.update({
    where: { projectId },
    data: { connected: false, encryptedCredentials: "" },
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await pollJiraStatuses(db, config);
  expect(fetch).not.toHaveBeenCalled();
  expect(await record()).toMatchObject({ state: "LINKED", issueKey: "KAN-1", syncRevision: 0 });
});
beforeEach(async () => {
  projectId = randomUUID();
  defectId = randomUUID();
  await db.project.create({
    data: {
      id: projectId,
      name: "Demo Jira polling",
      jiraIntegration: {
        create: {
          site: "https://demo.atlassian.net",
          jiraProjectKey: "KAN",
          issueTypeId: "10011",
          encryptedCredentials: encryptIntegrationSecret(
            JSON.stringify({ email: "demo@example.test", token: "demo-token" }),
            config.INTEGRATION_ENCRYPTION_KEY!,
            projectId,
            "jira",
          ),
        },
      },
      defects: {
        create: {
          id: defectId,
          resultId: randomUUID(),
          title: "Demo",
          severity: "S4",
          reproduction: {},
          createdBy: "demo",
          jiraExport: {
            create: {
              site: "https://demo.atlassian.net",
              jiraProjectKey: "KAN",
              integrationRevision: 1,
              createdBy: "demo",
              state: "LINKED",
              issueKey: "KAN-1",
            },
          },
        },
      },
    },
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.project.delete({ where: { id: projectId } });
});
afterAll(() => db.$disconnect());

it("is disabled by default and refuses to poll without encryption", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    readConfig({ DATABASE_URL: url, JWT_SECRET: "test-only-".repeat(6) }).JIRA_POLLING_ENABLED,
  ).toBe(false);
  await pollJiraStatuses(db, { ...config, JIRA_POLLING_ENABLED: false });
  await pollJiraStatuses(db, { ...config, INTEGRATION_ENCRYPTION_KEY: undefined });
  expect(fetch).not.toHaveBeenCalled();
});
it("claims once across workers and preserves QA state", async () => {
  const fetch = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetch);
  await Promise.all([pollJiraStatuses(db, config), pollJiraStatuses(db, config)]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]).toEqual(
    expect.arrayContaining([expect.objectContaining({ method: "GET" })]),
  );
  expect(await record()).toMatchObject({
    jiraStatusName: "Done",
    syncRevision: 1,
    pollLease: null,
    pollFailures: 0,
  });
  expect((await db.defect.findUniqueOrThrow({ where: { id: defectId } })).status).toBe("NEW");
  await pollJiraStatuses(db, config);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(["PENDING", "REVIEW_REQUIRED"])("never retries creation for %s", async (state) => {
  await db.jiraDefectExport.update({ where: { defectId }, data: { state } });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await pollJiraStatuses(db, config);
  expect(fetch).not.toHaveBeenCalled();
});
it("backs off rate limits without storing remote response text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("secret remote text", { status: 429 })),
  );
  const start = Date.now();
  await pollJiraStatuses(db, config);
  const saved = await record();
  expect(saved).toMatchObject({
    pollError: "RATE_LIMIT",
    pollFailures: 1,
    syncRevision: 0,
    pollLease: null,
  });
  expect(saved.nextPollAt.getTime()).toBeGreaterThanOrEqual(start + 30 * 60 * 1000);
});
it("does not send credentials to a replacement project", async () => {
  await db.jiraIntegration.update({ where: { projectId }, data: { jiraProjectKey: "OTHER" } });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await pollJiraStatuses(db, config);
  expect(fetch).not.toHaveBeenCalled();
  expect((await record()).pollError).toBe("REJECTED");
});
it.each(["manual", "settings"])("discards a response after a %s change", async (change) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (change === "manual")
        await db.jiraDefectExport.update({
          where: { defectId },
          data: { syncRevision: 1, jiraStatusName: "In Progress" },
        });
      else await db.jiraIntegration.update({ where: { projectId }, data: { revision: 2 } });
      return response();
    }),
  );
  await pollJiraStatuses(db, config);
  expect((await record()).jiraStatusName).toBe(change === "manual" ? "In Progress" : null);
  expect((await record()).pollLease).toBeNull();
});
it("recovers expired leases but skips active leases", async () => {
  const fetch = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetch);
  await db.jiraDefectExport.update({
    where: { defectId },
    data: { pollLease: "old", pollLeaseUntil: new Date(Date.now() + 60000) },
  });
  await pollJiraStatuses(db, config);
  expect(fetch).not.toHaveBeenCalled();
  await db.jiraDefectExport.update({ where: { defectId }, data: { pollLeaseUntil: new Date(0) } });
  await pollJiraStatuses(db, config);
  expect(fetch).toHaveBeenCalledTimes(1);
});
