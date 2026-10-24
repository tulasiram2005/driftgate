import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
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
  throw new Error("Isolated local driftgate_test database required");
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
const projects: string[] = [];
const runs: string[] = [];
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (project = projects[0]) => `/api/v1/projects/${project}/releases`;

it("collects authoritative readiness and blocks missing, stale or changed evidence", async () => {
  const release = (await request(app).post(path()).set(auth()).send({ name: "Demo readiness" }))
    .body.data;
  const target = `${path()}/${release.id}/gates/STAGING/readiness`;
  expect((await request(app).get(target)).status).toBe(401);
  expect((await request(app).get(target).set(auth("OUTSIDER"))).status).toBe(404);
  const empty = (await request(app).get(target).set(auth("APPROVER"))).body.data;
  expect(empty).toMatchObject({ eligible: false, score: null, gateRevision: 0 });
  const testCase = await db.testCase.create({
    data: {
      projectId: projects[0]!,
      title: "Demo critical",
      priority: "HIGH",
      type: "FUNCTIONAL",
      tags: [],
    },
  });
  await db.result.create({
    data: {
      runId: runs[0]!,
      caseId: testCase.id,
      title: "Demo critical",
      version: 1,
      steps: [],
      status: "PASS",
    },
  });
  await request(app)
    .put(`${path()}/${release.id}/gates/STAGING/runs`)
    .set(auth())
    .send({ revision: 0, runIds: [runs[0]] });
  const read = async () => (await request(app).get(target).set(auth())).body.data;
  const passed = await read();
  expect(passed.evidence.criticalTests).toMatchObject({ passed: 1, total: 1 });
  expect(passed).toMatchObject({
    eligible: false,
    score: null,
    notCollected: ["drift", "visual", "accessibility"],
  });
  await db.testCase.update({ where: { id: testCase.id }, data: { version: 2 } });
  const changed = await read();
  expect(changed.evidence.criticalTests.passed).toBe(0);
  expect(changed.evidenceHash).not.toBe(passed.evidenceHash);
  const original = await db.run.findUniqueOrThrow({ where: { id: runs[0] } });
  await db.run.update({
    where: { id: runs[0] },
    data: { createdAt: new Date(Date.now() - 86400001) },
  });
  expect((await read()).components[0].reason).toBe("STALE_EVIDENCE");
  await db.run.update({ where: { id: runs[0] }, data: { environment: "UAT" } });
  expect((await read()).sourceProblems).toContain("RUN_MISSING_OR_ENVIRONMENT_CHANGED");
  await db.run.update({
    where: { id: runs[0] },
    data: { environment: original.environment, createdAt: original.createdAt },
  });
});
beforeAll(async () => {
  for (const role of ["ADMIN", "QA", "DEVELOPER", "APPROVER", "OUTSIDER"]) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo release tester",
        email: `release-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  for (const name of ["Demo release project", "Demo other project"]) {
    const response = await request(app).post("/api/v1/projects").set(auth()).send({ name });
    expect(response.status).toBe(200);
    projects.push(response.body.data.id);
  }
  for (const role of ["QA", "DEVELOPER", "APPROVER"] as const)
    await db.member.create({ data: { projectId: projects[0]!, userId: users[role]!.id, role } });
  for (const [projectId, environment] of [
    [projects[0]!, "STAGING"],
    [projects[0]!, "uat"],
    [projects[1]!, "STAGING"],
  ]) {
    const run = await db.run.create({
      data: {
        projectId: projectId!,
        environment: environment!,
        browser: "Chromium",
        device: "Desktop",
      },
    });
    runs.push(run.id);
  }
});
afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: projects } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
  await db.$disconnect();
});
it("creates four ordered gates atomically, with strict role and project isolation", async () => {
  const body = { name: "Demo release" };
  expect((await request(app).post(path()).send(body)).status).toBe(401);
  expect((await request(app).post(path()).set(auth("OUTSIDER")).send(body)).status).toBe(404);
  for (const role of ["DEVELOPER", "APPROVER"])
    expect((await request(app).post(path()).set(auth(role)).send(body)).status).toBe(403);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, score: 100 })
    ).status,
  ).toBe(400);
  const response = await request(app).post(path()).set(auth("QA")).send(body);
  expect(response.status).toBe(200);
  const release = response.body.data;
  expect(release.gates.map((gate: { environment: string }) => gate.environment)).toEqual([
    "STAGING",
    "UAT",
    "PREPROD",
    "PROD",
  ]);
  expect(
    release.gates.every(
      (gate: { revision: number; runIds: string[] }) =>
        gate.revision === 0 && gate.runIds.length === 0,
    ),
  ).toBe(true);
  expect((await request(app).get(`${path()}/${release.id}`).set(auth("APPROVER"))).status).toBe(
    200,
  );
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}/${release.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}?cursor=${release.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect((await request(app).get(path()).set(auth("OUTSIDER"))).status).toBe(404);
  expect((await request(app).get(path()).set(auth())).body.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: release.id })]),
  );
});
it("binds only same-project/environment runs and rejects stale concurrent edits", async () => {
  const release = (await request(app).post(path()).set(auth()).send({ name: "Demo gate binding" }))
    .body.data;
  const target = `${path()}/${release.id}/gates/STAGING/runs`;
  const update = (runIds: string[], revision = 0, role = "QA") =>
    request(app).put(target).set(auth(role)).send({ runIds, revision });
  for (const ids of [[runs[1]!], [runs[2]!], ["missing"], [runs[0]!, runs[0]!]])
    expect((await update(ids)).status).toBe(400);
  expect((await update([], 0, "APPROVER")).status).toBe(403);
  expect((await update([], 0, "DEVELOPER")).status).toBe(403);
  const results = await Promise.all([update([runs[0]!]), update([runs[0]!])]);
  expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  const data = (await request(app).get(`${path()}/${release.id}`).set(auth())).body.data;
  expect(data.gates[0]).toMatchObject({ revision: 1, runIds: [runs[0]] });
  expect((await update([], 0)).status).toBe(409);
  expect((await update([], 1)).body.data).toMatchObject({ revision: 2, runIds: [] });
  const uat = await request(app)
    .put(`${path()}/${release.id}/gates/UAT/runs`)
    .set(auth())
    .send({ revision: 0, runIds: [runs[1]] });
  expect(uat.status).toBe(200);
  expect(
    (
      await request(app)
        .put(`${path(projects[1])}/${release.id}/gates/STAGING/runs`)
        .set(auth())
        .send({ revision: 0, runIds: [] })
    ).status,
  ).toBe(404);
});
