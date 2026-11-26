import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { PrismaClient } from "../generated/client/index.js";
import { rotateJiraKey } from "../src/jira-key-rotation.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../src/integration-secrets.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const oldKey = "ab".repeat(32),
  newKey = "cd".repeat(32);
const secret = JSON.stringify({ email: "demo@example.test", token: "demo-only-token" });
let ids: string[];
beforeEach(async () => {
  ids = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries())
    await db.project.create({
      data: {
        id,
        name: "Demo key rotation",
        jiraIntegration: {
          create: {
            site: "https://demo.atlassian.net",
            jiraProjectKey: "KAN",
            issueTypeId: "10011",
            connected: index !== 2,
            encryptedCredentials:
              index === 2 ? "" : encryptIntegrationSecret(secret, oldKey, id, "jira"),
          },
        },
      },
    });
});
afterEach(() => db.project.deleteMany({ where: { id: { in: ids } } }));
afterAll(() => db.$disconnect());
const rows = () =>
  db.jiraIntegration.findMany({ where: { projectId: { in: ids } }, orderBy: { projectId: "asc" } });

it("dry run verifies credentials without changing rows or audit history", async () => {
  const before = await rows();
  expect(await rotateJiraKey(db, { oldKey, newKey })).toEqual({ checked: 2, applied: false });
  expect(await rows()).toEqual(before);
  expect(await db.jiraIntegrationEvent.count({ where: { projectId: { in: ids } } })).toBe(0);
});
it("rotates connected credentials and audit revisions together, and supports a deliberate reverse rotation", async () => {
  await rotateJiraKey(db, { oldKey, newKey, apply: true, maintenanceConfirmed: true });
  for (const row of await rows()) {
    if (!row.connected) {
      expect(row.encryptedCredentials).toBe("");
      expect(row.revision).toBe(1);
      continue;
    }
    expect(decryptIntegrationSecret(row.encryptedCredentials, newKey, row.projectId, "jira")).toBe(
      secret,
    );
    expect(() =>
      decryptIntegrationSecret(row.encryptedCredentials, oldKey, row.projectId, "jira"),
    ).toThrow();
    expect(row.revision).toBe(2);
  }
  expect(
    await db.jiraIntegrationEvent.count({
      where: { projectId: { in: ids }, action: "KEY_ROTATED" },
    }),
  ).toBe(2);
  await rotateJiraKey(db, {
    oldKey: newKey,
    newKey: oldKey,
    apply: true,
    maintenanceConfirmed: true,
  });
  const row = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId: ids[0] } });
  expect(decryptIntegrationSecret(row.encryptedCredentials, oldKey, row.projectId, "jira")).toBe(
    secret,
  );
  expect(row.revision).toBe(3);
});
it("rolls back the whole rotation on a corrupted credential", async () => {
  await db.jiraIntegration.update({
    where: { projectId: ids[1] },
    data: { encryptedCredentials: "corrupt-demo-envelope" },
  });
  const before = await rows();
  await expect(
    rotateJiraKey(db, { oldKey, newKey, apply: true, maintenanceConfirmed: true }),
  ).rejects.toThrow();
  expect(await rows()).toEqual(before);
  expect(await db.jiraIntegrationEvent.count({ where: { projectId: { in: ids } } })).toBe(0);
});
it("rejects wrong keys, equivalent keys and apply without maintenance confirmation", async () => {
  const before = await rows();
  await expect(rotateJiraKey(db, { oldKey: "ef".repeat(32), newKey })).rejects.toThrow();
  await expect(rotateJiraKey(db, { oldKey, newKey: oldKey.toUpperCase() })).rejects.toThrow();
  await expect(rotateJiraKey(db, { oldKey, newKey: "bad" })).rejects.toThrow();
  await expect(rotateJiraKey(db, { oldKey, newKey, apply: true })).rejects.toThrow();
  expect(await rows()).toEqual(before);
});
