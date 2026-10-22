import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

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
  }),
);
const users: Record<string, { id: string; token: string }> = {};
let projectId = "";
let evidenceId = "";
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = () => `/api/v1/projects/${projectId}/visual-baselines`;
beforeAll(async () => {
  for (const role of ["ADMIN", "QA", "APPROVER", "DEVELOPER", "OUTSIDER"] as const) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: `Demo ${role}`,
        email: `visual-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  const project = await request(app)
    .post("/api/v1/projects")
    .set(auth())
    .send({ name: "Demo baseline tests" });
  projectId = project.body.data.id;
  for (const role of ["QA", "APPROVER", "DEVELOPER"] as const)
    await db.member.create({ data: { projectId, userId: users[role]!.id, role } });
  const run = await db.run.create({
    data: {
      projectId,
      environment: "STAGING",
      browser: "matrix",
      device: "matrix",
      mode: "AUTOMATED",
    },
  });
  const result = await db.result.create({
    data: {
      runId: run.id,
      caseId: "catalogue",
      title: "Demo",
      version: 1,
      steps: [],
      browser: "chromium",
      device: "desktop",
    },
  });
  const evidence = await db.evidence.create({
    data: {
      resultId: result.id,
      key: `demo/${randomUUID()}.png`,
      kind: "screenshot",
      contentType: "image/png",
      sizeBytes: 100,
      ready: true,
    },
  });
  evidenceId = evidence.id;
});
afterAll(async () => {
  await db.visualBaseline.deleteMany({ where: { projectId } });
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((u) => u.id) } } });
  await db.$disconnect();
});
it("requires membership and a write role, rejects client-defined scope", async () => {
  for (const [role, status] of [
    ["OUTSIDER", 404],
    ["DEVELOPER", 403],
    ["APPROVER", 403],
  ] as const)
    expect(
      (await request(app).post(path()).set(auth(role)).send({ evidenceId, label: "Demo" })).status,
    ).toBe(status);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ evidenceId, label: "Demo", environment: "PRODUCTION" })
    ).status,
  ).toBe(400);
  expect(
    (await request(app).post(path()).set(auth()).send({ evidenceId: "missing", label: "Demo" }))
      .status,
  ).toBe(404);
});
it("stores server-derived scope and permits exactly one reviewer decision", async () => {
  const response = await request(app)
    .post(path())
    .set(auth("QA"))
    .send({ evidenceId, label: "Demo baseline" });
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    environment: "STAGING",
    browser: "chromium",
    device: "desktop",
    viewportWidth: 1280,
    viewportHeight: 900,
    status: "PENDING",
  });
  const reviewPath = `${path()}/${response.body.data.id}/review`;
  const decision = { status: "APPROVED", comment: "Demo reviewed" };
  expect((await request(app).post(reviewPath).set(auth("QA")).send(decision)).status).toBe(403);
  expect((await request(app).post(reviewPath).set(auth("OUTSIDER")).send(decision)).status).toBe(
    404,
  );
  expect(
    (
      await request(app)
        .post(reviewPath)
        .set(auth("APPROVER"))
        .send({ ...decision, comment: " " })
    ).status,
  ).toBe(400);
  const responses = await Promise.all([
    request(app).post(reviewPath).set(auth("APPROVER")).send(decision),
    request(app)
      .post(reviewPath)
      .set(auth())
      .send({ status: "REJECTED", comment: "Demo competing review" }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const saved = await db.visualBaseline.findUniqueOrThrow({ where: { id: response.body.data.id } });
  expect(saved.reviewedAt).not.toBeNull();
  expect(saved.reviewedBy).not.toBeNull();
  expect(
    (await request(app).post(path()).set(auth()).send({ evidenceId, label: "Duplicate" })).status,
  ).toBe(409);
  const list = await request(app).get(path()).set(auth("DEVELOPER"));
  expect(list.status).toBe(200);
  expect(list.body.data).toHaveLength(1);
  expect(list.body.data[0].evidence.resultId).toBeTruthy();
  expect(list.body.data[0].evidence.result.runId).toBeTruthy();
  expect(list.body.data[0].evidence.key).toBeUndefined();
  expect((await request(app).get(path()).set(auth("OUTSIDER"))).status).toBe(404);
  expect((await request(app).get(`${path()}?cursor=missing`).set(auth())).status).toBe(404);
});
it("rejects pending evidence and evidence belonging to manual runs", async () => {
  await db.evidence.update({ where: { id: evidenceId }, data: { ready: false } });
  expect(
    (await request(app).post(path()).set(auth()).send({ evidenceId, label: "Demo" })).status,
  ).toBe(404);
  await db.evidence.update({ where: { id: evidenceId }, data: { ready: true } });
  await db.run.updateMany({ where: { projectId }, data: { mode: "MANUAL" } });
  expect(
    (await request(app).post(path()).set(auth()).send({ evidenceId, label: "Demo" })).status,
  ).toBe(404);
});

it("activates only approved candidates and replaces only the same scope", async () => {
  const seed = await db.visualBaseline.findFirstOrThrow({ where: { projectId } });
  async function create(environment: string, status = "APPROVED") {
    const source = await db.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    const evidence = await db.evidence.create({
      data: {
        resultId: source.resultId,
        key: `demo/${randomUUID()}.png`,
        kind: "screenshot",
        contentType: "image/png",
        ready: true,
        sizeBytes: 100,
      },
    });
    return db.visualBaseline.create({
      data: {
        projectId,
        evidenceId: evidence.id,
        label: "Demo activation",
        environment,
        browser: seed.browser,
        device: seed.device,
        checkId: seed.checkId,
        viewportWidth: seed.viewportWidth,
        viewportHeight: seed.viewportHeight,
        createdBy: users.ADMIN!.id,
        status,
        ...(status === "PENDING"
          ? {}
          : {
              reviewedBy: users.ADMIN!.id,
              reviewedAt: new Date(),
              reviewComment: "Demo reviewed",
            }),
      },
    });
  }
  const first = await create("STAGING");
  const second = await create("STAGING");
  const other = await create("UAT");
  const pending = await create("STAGING", "PENDING");
  const rejected = await create("STAGING", "REJECTED");
  const activate = (id: string, role = "ADMIN") =>
    request(app).post(`${path()}/${id}/activate`).set(auth(role)).send({});
  expect((await activate(first.id, "QA")).status).toBe(403);
  expect((await activate(first.id, "OUTSIDER")).status).toBe(404);
  expect((await activate("missing")).status).toBe(404);
  expect((await activate(pending.id)).status).toBe(409);
  expect((await activate(rejected.id)).status).toBe(409);
  expect((await activate(other.id)).status).toBe(200);
  const selected = await activate(first.id, "APPROVER");
  expect(selected.status).toBe(200);
  expect(selected.body.data.activatedBy).toBe(users.APPROVER!.id);
  const repeat = await activate(first.id);
  expect(repeat.body.data.activatedAt).toBe(selected.body.data.activatedAt);
  expect((await activate(second.id)).status).toBe(200);
  expect((await db.visualBaseline.findUniqueOrThrow({ where: { id: first.id } })).active).toBe(
    false,
  );
  expect((await db.visualBaseline.findUniqueOrThrow({ where: { id: other.id } })).active).toBe(
    true,
  );
  expect(
    await db.visualBaseline.count({ where: { projectId, environment: "STAGING", active: true } }),
  ).toBe(1);
});
