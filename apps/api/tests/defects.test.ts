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
const projects: string[] = [];
let resultId: string;
let passId: string;
let foreignId: string;
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (project = projects[0]) => `/api/v1/projects/${project}/defects`;
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
});
