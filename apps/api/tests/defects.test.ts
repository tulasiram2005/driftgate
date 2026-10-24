import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { encryptIntegrationSecret } from "../src/integration-secrets.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const app = createApp(
  db,
  readConfig({
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_SECRET: "test-only-secret-".repeat(5),
    API_CORS_ORIGINS: "http://127.0.0.1:3100",
    INTEGRATION_ENCRYPTION_KEY: "ab".repeat(32),
  }),
);
const users: Record<string, { id: string; token: string }> = {};
const projects: string[] = [];
let resultId: string;
let passId: string;
let foreignId: string;
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (project = projects[0]) => `/api/v1/projects/${project}/defects`;
afterEach(() => vi.unstubAllGlobals());
beforeAll(async () => {
  for (const role of ["ADMIN", "QA", "DEVELOPER", "APPROVER", "OUTSIDER"]) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo defect tester",
        email: `defect-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  for (const name of ["Demo defects", "Demo isolated defects"]) {
    const response = await request(app).post("/api/v1/projects").set(auth()).send({ name });
    expect(response.status).toBe(200);
    projects.push(response.body.data.id);
  }
  for (const role of ["QA", "DEVELOPER", "APPROVER"] as const)
    await db.member.create({ data: { projectId: projects[0]!, userId: users[role]!.id, role } });
  for (const [index, projectId] of projects.entries()) {
    const run = await db.run.create({
      data: { projectId, environment: "uat", browser: "Chromium", device: "Desktop" },
    });
    for (const status of ["FAIL", "PASS"]) {
      const result = await db.result.create({
        data: {
          runId: run.id,
          caseId: randomUUID(),
          title: "Demo checkout",
          version: 2,
          steps: [{ action: "Submit order", expected: "Correct total" }],
          status,
          notes: "Incorrect total",
          browser: "Chromium",
          device: "Desktop",
        },
      });
      if (index === 0 && status === "FAIL") resultId = result.id;
      else if (index === 0) passId = result.id;
      else foreignId = result.id;
    }
  }
});
afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: projects } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
  await db.$disconnect();
});
it("rejects unauthorized, cross-project, non-failed and malformed defect creation", async () => {
  const body = { resultId, severity: "S1" };
  expect((await request(app).post(path()).send(body)).status).toBe(401);
  expect((await request(app).post(path()).set(auth("OUTSIDER")).send(body)).status).toBe(404);
  for (const role of ["DEVELOPER", "APPROVER"])
    expect((await request(app).post(path()).set(auth(role)).send(body)).status).toBe(403);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, resultId: foreignId })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, resultId: passId })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, severity: "urgent" })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, status: "CLOSED" })
    ).status,
  ).toBe(400);
});
it("captures automated failure details when manual notes are empty", async () => {
  await db.result.update({ where: { id: passId }, data: { status: "FAIL", notes: "" } });
  await db.resultAttempt.create({
    data: {
      resultId: passId,
      number: 1,
      status: "FAIL",
      durationMs: 10,
      error: "Demo assertion: total mismatch",
    },
  });
  const response = await request(app)
    .post(path())
    .set(auth())
    .send({ resultId: passId, severity: "S2" });
  expect(response.status).toBe(200);
  expect(response.body.data.reproduction.actual).toBe("Demo assertion: total mismatch");
});
it("snapshots reproduction once and enforces audited, revision-protected workflow", async () => {
  const create = () => request(app).post(path()).set(auth("QA")).send({ resultId, severity: "S1" });
  const first = await create();
  expect(first.status).toBe(200);
  const defect = first.body.data;
  expect(defect).toMatchObject({
    status: "NEW",
    revision: 0,
    severity: "S1",
    createdBy: users.QA!.id,
  });
  expect(defect.reproduction).toMatchObject({
    environment: "uat",
    actual: "Incorrect total",
    version: 2,
  });
  await db.result.update({ where: { id: resultId }, data: { notes: "Later notes" } });
  expect((await create()).body.data).toEqual(defect);
  const detail = `${path()}/${defect.id}`;
  const transition = (status: string, revision: number, role = "QA") =>
    request(app)
      .post(`${detail}/transitions`)
      .set(auth(role))
      .send({ status, revision, comment: "Demo verified change" });
  expect((await transition("CLOSED", 0)).status).toBe(409);
  expect((await transition("OPEN", 0, "APPROVER")).status).toBe(403);
  const simultaneous = await Promise.all([transition("OPEN", 0), transition("OPEN", 0)]);
  expect(simultaneous.map((response) => response.status).sort()).toEqual([200, 409]);
  expect((await transition("IN_PROGRESS", 0)).status).toBe(409);
  expect((await transition("IN_PROGRESS", 1, "DEVELOPER")).status).toBe(200);
  expect((await transition("FIXED", 2, "DEVELOPER")).status).toBe(200);
  expect((await transition("RETEST", 3, "DEVELOPER")).status).toBe(403);
  expect((await transition("RETEST", 3)).status).toBe(200);
  expect((await transition("CLOSED", 4)).status).toBe(200);
  expect((await transition("REOPENED", 5)).status).toBe(200);
  const history = await request(app).get(detail).set(auth("APPROVER"));
  expect(history.body.data.events).toHaveLength(7);
  expect(history.body.data.events.every((event: { actorId: string }) => event.actorId)).toBe(true);
  expect((await request(app).get(detail).set(auth("OUTSIDER"))).status).toBe(404);
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}/${defect.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}?cursor=${defect.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect((await request(app).get(`${path()}?limit=1`).set(auth())).body.data).toHaveLength(1);
  const filtered = await request(app)
    .get(`${path()}?status=REOPENED&severity=S1&search=CHECKOUT`)
    .set(auth());
  expect(filtered.status).toBe(200);
  expect(filtered.body.data.map((row: { id: string }) => row.id)).toEqual([defect.id]);
  expect((await request(app).get(`${path()}?status=CLOSED`).set(auth())).body.data).toEqual([]);
  expect(
    (await request(app).get(`${path()}?status=CLOSED&cursor=${defect.id}`).set(auth())).status,
  ).toBe(404);
  expect((await request(app).get(`${path()}?severity=S9`).set(auth())).status).toBe(400);
  expect((await request(app).get(`${path()}?status=invalid`).set(auth())).status).toBe(400);
  expect(
    (
      await request(app)
        .get(`${path()}?search=${"x".repeat(201)}`)
        .set(auth())
    ).status,
  ).toBe(400);
});

it("exports once under concurrent requests and preserves links across settings changes", async () => {
  const projectId = projects[0]!;
  await db.jiraIntegration.create({
    data: {
      projectId,
      site: "https://example.atlassian.net",
      jiraProjectKey: "KAN",
      issueTypeId: "10011",
      encryptedCredentials: encryptIntegrationSecret(
        JSON.stringify({ email: "demo@example.com", token: "demo-only-token" }),
        "ab".repeat(32),
        projectId,
        "jira",
      ),
    },
  });
  const defect = await db.defect.create({
    data: {
      projectId,
      resultId: "demo-export",
      title: "Demo defect",
      severity: "S2",
      createdBy: users.ADMIN!.id,
      reproduction: { actual: "Demo mismatch" },
    },
  });
  const endpoint = `${path()}/${defect.id}/jira`;
  const send = vi.fn<typeof fetch>().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return Response.json({ id: "123", key: "KAN-1" });
  });
  vi.stubGlobal("fetch", send);
  expect((await request(app).post(endpoint).send({ revision: 0 })).status).toBe(401);
  expect((await request(app).post(endpoint).set(auth("QA")).send({ revision: 0 })).status).toBe(
    403,
  );
  expect(
    (await request(app).post(endpoint).set(auth("OUTSIDER")).send({ revision: 0 })).status,
  ).toBe(404);
  expect((await request(app).post(endpoint).set(auth()).send({ revision: 1 })).status).toBe(409);
  expect(send).not.toHaveBeenCalled();
  const replies = await Promise.all(
    [0, 1].map(() => request(app).post(endpoint).set(auth()).send({ revision: 0 })),
  );
  expect(replies.every((reply) => reply.status === 200)).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  const saved = (await request(app).get(endpoint).set(auth("QA"))).body.data;
  expect(saved).toMatchObject({
    state: "LINKED",
    issueKey: "KAN-1",
    issueUrl: "https://example.atlassian.net/browse/KAN-1",
  });
  expect(JSON.stringify(saved)).not.toContain("demo-only-token");
  await db.jiraIntegration.update({
    where: { projectId },
    data: { site: "https://other.atlassian.net", revision: { increment: 1 } },
  });
  expect(
    (await request(app).post(endpoint).set(auth()).send({ revision: 0 })).body.data.issueUrl,
  ).toBe(saved.issueUrl);
  expect(send).toHaveBeenCalledTimes(1);
});
it("keeps ambiguous exports for review instead of retrying creation", async () => {
  const defect = await db.defect.create({
    data: {
      projectId: projects[0]!,
      resultId: "demo-ambiguous",
      title: "Demo ambiguous response",
      severity: "S2",
      createdBy: users.ADMIN!.id,
      reproduction: {},
    },
  });
  const endpoint = `${path()}/${defect.id}/jira`;
  const send = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-token"));
  vi.stubGlobal("fetch", send);
  const failed = await request(app).post(endpoint).set(auth()).send({ revision: 0 });
  expect(failed.status).toBe(202);
  expect(failed.body.data).toMatchObject({ state: "REVIEW_REQUIRED", errorCode: "UNAVAILABLE" });
  expect(JSON.stringify(failed.body)).not.toContain("secret-token");
  expect(
    (await request(app).post(endpoint).set(auth()).send({ revision: 0 })).body.data.state,
  ).toBe("REVIEW_REQUIRED");
  expect(send).toHaveBeenCalledTimes(1);
  expect((await request(app).get(endpoint).set(auth("OUTSIDER"))).status).toBe(404);
});

it("syncs Jira status without changing QA state and protects snapshots from errors and races", async () => {
  const projectId = projects[0]!;
  const defect = await db.defect.findFirstOrThrow({
    where: { projectId, resultId: "demo-export" },
  });
  const endpoint = `${path()}/${defect.id}/jira/sync`;
  const send = vi.fn<typeof fetch>().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return Response.json({
      id: "123",
      key: "KAN-1",
      fields: { status: { id: "3", name: "Done", statusCategory: { key: "done" } } },
    });
  });
  vi.stubGlobal("fetch", send);
  const sync = (revision = 0, role = "ADMIN") =>
    request(app).post(endpoint).set(auth(role)).send({ revision });
  expect((await request(app).post(endpoint).send({ revision: 0 })).status).toBe(401);
  expect((await sync(0, "QA")).status).toBe(403);
  expect((await sync(0, "OUTSIDER")).status).toBe(404);
  expect((await sync()).body.error.code).toBe("TARGET_CHANGED");
  expect(send).not.toHaveBeenCalled();
  await db.jiraIntegration.update({
    where: { projectId },
    data: { site: "https://example.atlassian.net", revision: { increment: 1 } },
  });
  const responses = await Promise.all([sync(), sync()]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const saved = responses.find((r) => r.status === 200)!.body.data;
  expect(saved).toMatchObject({
    jiraStatusName: "Done",
    jiraStatusCategory: "done",
    syncRevision: 1,
  });
  expect(saved.statusSyncedAt).toBeTruthy();
  expect(await db.defect.findUniqueOrThrow({ where: { id: defect.id } })).toMatchObject({
    status: "NEW",
    revision: 0,
  });
  expect(await db.defectEvent.count({ where: { defectId: defect.id } })).toBe(0);
  expect((await sync()).status).toBe(409);
  send.mockRejectedValueOnce(new Error("secret-token"));
  const failed = await sync(1);
  expect(failed.status).toBe(502);
  expect(JSON.stringify(failed.body)).not.toContain("secret-token");
  const read = await request(app).get(`${path()}/${defect.id}/jira`).set(auth("QA"));
  expect(read.body.data).toEqual(saved);
  send.mockImplementationOnce(async () => {
    await db.jiraIntegration.update({ where: { projectId }, data: { revision: { increment: 1 } } });
    return Response.json({
      id: "123",
      key: "KAN-1",
      fields: { status: { id: "1", name: "Open", statusCategory: { key: "new" } } },
    });
  });
  expect((await sync(1)).status).toBe(409);
  expect(
    (await db.jiraDefectExport.findUniqueOrThrow({ where: { defectId: defect.id } }))
      .jiraStatusName,
  ).toBe("Done");
});

it("aggregates project-wide aging and latest closure without counting reopened defects", async () => {
  const projectId = projects[1]!;
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const first = await db.defect.create({
    data: {
      projectId,
      resultId: "demo-metric-closed",
      title: "Demo closed",
      severity: "S2",
      status: "CLOSED",
      createdBy: users.ADMIN!.id,
      reproduction: {},
      createdAt,
      events: {
        create: [
          {
            actorId: users.ADMIN!.id,
            toStatus: "CLOSED",
            comment: "First close",
            createdAt: new Date("2026-01-01T01:00:00Z"),
          },
          {
            actorId: users.ADMIN!.id,
            toStatus: "CLOSED",
            comment: "Latest close",
            createdAt: new Date("2026-01-01T03:00:00Z"),
          },
        ],
      },
    },
  });
  await db.defect.create({
    data: {
      projectId,
      resultId: "demo-metric-reopened",
      title: "Demo reopened",
      severity: "S1",
      status: "REOPENED",
      createdBy: users.ADMIN!.id,
      reproduction: {},
      createdAt,
      events: {
        create: {
          actorId: users.ADMIN!.id,
          toStatus: "CLOSED",
          comment: "Earlier close",
          createdAt: new Date("2026-01-01T20:00:00Z"),
        },
      },
    },
  });
  await db.defect.create({
    data: {
      projectId,
      resultId: "demo-metric-no-history",
      title: "Demo missing history",
      severity: "S3",
      status: "CLOSED",
      createdBy: users.ADMIN!.id,
      reproduction: {},
      createdAt,
    },
  });
  const response = await request(app)
    .get(`${path(projectId)}/metrics`)
    .set(auth());
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    total: 3,
    open: 1,
    closed: 2,
    openS1: 1,
    meanResolutionHours: 3,
    resolvedWithHistory: 1,
  });
  expect(response.body.data.oldestOpenHours).toBeGreaterThan(0);
  expect(
    (
      await request(app)
        .get(`${path(projectId)}/metrics`)
        .set(auth("OUTSIDER"))
    ).status,
  ).toBe(404);
  expect((await request(app).get(`${path(projectId)}/metrics`)).status).toBe(401);
  await db.defect.update({ where: { id: first.id }, data: { status: "REOPENED" } });
  expect(
    (
      await request(app)
        .get(`${path(projectId)}/metrics`)
        .set(auth())
    ).body.data.meanResolutionHours,
  ).toBeNull();
  await db.defect.deleteMany({ where: { projectId } });
  expect(
    (
      await request(app)
        .get(`${path(projectId)}/metrics`)
        .set(auth())
    ).body.data,
  ).toMatchObject({
    total: 0,
    open: 0,
    closed: 0,
    oldestOpenHours: null,
    meanResolutionHours: null,
    resolvedWithHistory: 0,
  });
});
