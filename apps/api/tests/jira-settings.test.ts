import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { decryptIntegrationSecret } from "../src/integration-secrets.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const key = "ab".repeat(32);
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-only-secret-".repeat(5),
  INTEGRATION_ENCRYPTION_KEY: key,
});
const app = createApp(db, config);
const users: { id: string; token: string }[] = [];
let projectId: string;
const path = () => `/api/v1/projects/${projectId}/integrations/jira`;
const auth = (index = 0) => ({ Authorization: `Bearer ${users[index]!.token}` });
const body = {
  site: "https://example.atlassian.net",
  jiraProjectKey: "KAN",
  issueTypeId: "10011",
  email: "demo@example.com",
  token: "demo-token-not-real",
  revision: 0,
};
afterEach(() => vi.unstubAllGlobals());
beforeAll(async () => {
  for (let i = 0; i < 5; i++) {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo Jira tester",
        email: `jira-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(res.status).toBe(200);
    users.push({ id: res.body.data.user.id, token: res.body.data.accessToken });
  }
  const res = await request(app)
    .post("/api/v1/projects")
    .set(auth())
    .send({ name: "Demo Jira settings" });
  expect(res.status).toBe(200);
  projectId = res.body.data.id;
  await db.member.create({ data: { projectId, userId: users[1]!.id, role: "QA" } });
  await db.member.create({ data: { projectId, userId: users[3]!.id, role: "DEVELOPER" } });
  await db.member.create({ data: { projectId, userId: users[4]!.id, role: "APPROVER" } });
});
afterAll(async () => {
  if (projectId) await db.project.delete({ where: { id: projectId } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
});
it("requires authentication and project admin for reads and writes", async () => {
  expect((await request(app).get(path())).status).toBe(401);
  for (const [index, code] of [
    [1, 403],
    [2, 404],
    [3, 403],
    [4, 403],
  ]) {
    expect((await request(app).get(path()).set(auth(index))).status).toBe(code);
    expect((await request(app).put(path()).set(auth(index)).send(body)).status).toBe(code);
    expect(
      (await request(app).post(`${path()}/verify`).set(auth(index)).send({ revision: 1 })).status,
    ).toBe(code);
  }
  expect((await request(app).get(path()).set(auth())).body).toEqual({
    data: null,
    available: true,
  });
});
it("encrypts credentials, redacts responses, and records audit metadata", async () => {
  const res = await request(app).put(path()).set(auth()).send(body);
  expect(res.status).toBe(200);
  expect(res.body.data.revision).toBe(1);
  expect(JSON.stringify(res.body)).not.toContain(body.token);
  expect(res.body.data).not.toHaveProperty("encryptedCredentials");
  const row = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId } });
  expect(row.encryptedCredentials).not.toContain(body.token);
  expect(
    JSON.parse(decryptIntegrationSecret(row.encryptedCredentials, key, projectId, "jira")),
  ).toEqual({ email: body.email, token: body.token });
  const events = await db.jiraIntegrationEvent.findMany({ where: { projectId } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ actorId: users[0]!.id, revision: 1, action: "CONFIGURED" });
  const read = await request(app).get(path()).set(auth());
  expect(read.body.data).not.toHaveProperty("encryptedCredentials");
  expect(read.body.data).not.toHaveProperty("email");
});
it("rejects stale writes and prevents reusing a saved revision", async () => {
  expect((await request(app).put(path()).set(auth()).send(body)).status).toBe(409);
  const a = await request(app)
    .put(path())
    .set(auth())
    .send({ ...body, revision: 1 });
  const b = await request(app)
    .put(path())
    .set(auth())
    .send({ ...body, revision: 1 });
  expect(a.status).toBe(200);
  expect(b.status).toBe(409);
  expect(await db.jiraIntegrationEvent.count({ where: { projectId } })).toBe(2);
});
it("fails closed without encryption configuration and sanitizes invalid input", async () => {
  const unavailable = createApp(db, { ...config, INTEGRATION_ENCRYPTION_KEY: undefined });
  expect((await request(unavailable).put(path()).set(auth()).send(body)).status).toBe(503);
  const res = await request(app)
    .put(path())
    .set(auth())
    .send({ ...body, site: "http://localhost", "secret-in-key": "secret" });
  expect(res.status).toBe(400);
  expect(res.body.error.message).toBe("Invalid Jira settings");
});
it("allows only one simultaneous replacement and commits exactly one audit event", async () => {
  const current = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId } });
  const priorEvents = await db.jiraIntegrationEvent.count({ where: { projectId } });
  const send = (token: string) =>
    request(app)
      .put(path())
      .set(auth())
      .send({ ...body, token, revision: current.revision });
  const replies = await Promise.all([send("demo-first-token"), send("demo-second-token")]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db.jiraIntegrationEvent.count({ where: { projectId } })).toBe(priorEvents + 1);
  const saved = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId } });
  expect(saved.revision).toBe(current.revision + 1);
  const winner = replies[0]!.status === 200 ? "demo-first-token" : "demo-second-token";
  expect(
    JSON.parse(decryptIntegrationSecret(saved.encryptedCredentials, key, projectId, "jira")).token,
  ).toBe(winner);
});
it("checks saved credentials without exposing them, and rejects stale verification", async () => {
  const current = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId } });
  const send = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ accountId: "demo", active: true }))
    .mockResolvedValueOnce(
      Response.json({ key: "KAN", issueTypes: [{ id: "10011", subtask: false }] }),
    )
    .mockResolvedValueOnce(
      Response.json({
        permissions: {
          BROWSE_PROJECTS: { havePermission: true },
          CREATE_ISSUES: { havePermission: true },
        },
      }),
    );
  vi.stubGlobal("fetch", send);
  const stale = await request(app)
    .post(`${path()}/verify`)
    .set(auth())
    .send({ revision: current.revision + 1 });
  expect(stale.status).toBe(409);
  expect(send).not.toHaveBeenCalled();
  const result = await request(app)
    .post(`${path()}/verify`)
    .set(auth())
    .send({ revision: current.revision });
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({
    status: "ACCESS_CONFIRMED",
    revision: current.revision,
  });
  expect(JSON.stringify(result.body)).not.toContain(body.email);
  expect(result.body.data).not.toHaveProperty("token");
});
it("sanitizes verification failures and rejects configurations changed during a check", async () => {
  const current = await db.jiraIntegration.findUniqueOrThrow({ where: { projectId } });
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-token")));
  const failed = await request(app)
    .post(`${path()}/verify`)
    .set(auth())
    .send({ revision: current.revision });
  expect(failed.status).toBe(502);
  expect(failed.body.error.code).toBe("JIRA_UNAVAILABLE");
  expect(JSON.stringify(failed.body)).not.toContain("secret-token");
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ accountId: "demo", active: true }))
      .mockResolvedValueOnce(
        Response.json({ key: "KAN", issueTypes: [{ id: "10011", subtask: false }] }),
      )
      .mockImplementationOnce(async () => {
        await db.jiraIntegration.update({
          where: { projectId },
          data: { revision: { increment: 1 } },
        });
        return Response.json({
          permissions: {
            BROWSE_PROJECTS: { havePermission: true },
            CREATE_ISSUES: { havePermission: true },
          },
        });
      }),
  );
  const changed = await request(app)
    .post(`${path()}/verify`)
    .set(auth())
    .send({ revision: current.revision });
  expect(changed.status).toBe(409);
});
