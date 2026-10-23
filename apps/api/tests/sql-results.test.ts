import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { SqlAssertionResult } from "../src/sql-checks.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-only-secret-".repeat(5),
  API_CORS_ORIGINS: "http://127.0.0.1:3100",
});
let outcome: "PASS" | "FAIL" | "ERROR" = "PASS";
let calls = 0;
const app = createApp(db, config, undefined, async (environment) => {
  expect(environment).toBe("staging");
  calls++;
  if (outcome === "ERROR")
    throw new Error("postgresql://secret:credential@private.example:5432/db");
  return ["nonnegative-stock", "order-totals", "orphan-order-items"].map((check) => ({
    check: check as SqlAssertionResult["check"],
    status: outcome,
    violations: outcome === "FAIL" ? 1 : 0,
  })) as SqlAssertionResult[];
});
const users: Record<string, { id: string; token: string }> = {};
const projects: string[] = [];
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (projectId = projects[0]) => `/api/v1/projects/${projectId}/sql-checks`;
beforeAll(async () => {
  for (const role of ["ADMIN", "QA", "DEVELOPER", "OUTSIDER"]) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo SQL",
        email: `sql-results-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  for (const name of ["Demo configured SQL project", "Demo unconfigured project"]) {
    const response = await request(app).post("/api/v1/projects").set(auth()).send({ name });
    projects.push(response.body.data.id);
  }
  config.THREADLINE_SQL_PROJECT_ID = projects[0]!;
  await db.member.create({ data: { projectId: projects[0]!, userId: users.QA!.id, role: "QA" } });
  await db.member.create({
    data: { projectId: projects[0]!, userId: users.DEVELOPER!.id, role: "DEVELOPER" },
  });
});
afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: projects } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
  await db.$disconnect();
});
it("enforces membership, role, project binding and fixed request shape before execution", async () => {
  expect((await request(app).post(path()).send({ environment: "staging" })).status).toBe(401);
  expect(
    (await request(app).post(path()).set(auth("OUTSIDER")).send({ environment: "staging" })).status,
  ).toBe(404);
  expect(
    (await request(app).post(path()).set(auth("DEVELOPER")).send({ environment: "staging" }))
      .status,
  ).toBe(403);
  expect(
    (await request(app).post(path(projects[1])).set(auth()).send({ environment: "staging" }))
      .status,
  ).toBe(503);
  for (const body of [
    { environment: "other" },
    { environment: "staging", sql: "DELETE FROM products" },
    { environment: "staging", url: "postgresql://example.test/db" },
  ])
    expect((await request(app).post(path()).set(auth()).send(body)).status).toBe(400);
  expect(calls).toBe(0);
});
it("persists PASS, FAIL and sanitized ERROR outcomes and serves paginated project history", async () => {
  const ids: string[] = [];
  for (const selected of ["PASS", "FAIL", "ERROR"] as const) {
    outcome = selected;
    const response = await request(app)
      .post(path())
      .set(auth("QA"))
      .send({ environment: "staging" });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: selected,
      environment: "staging",
      createdBy: users.QA!.id,
    });
    expect(response.body.data.durationMs).toBeGreaterThanOrEqual(0);
    if (selected === "ERROR") {
      expect(response.body.data.results).toEqual([]);
      expect(response.body.data.errorCode).toBe("SQL_CHECK_UNAVAILABLE");
      expect(JSON.stringify(response.body)).not.toContain("credential");
    } else expect(response.body.data.results).toHaveLength(3);
    ids.push(response.body.data.id);
  }
  expect(await db.sqlCheckRun.count({ where: { projectId: projects[0] } })).toBe(3);
  const first = await request(app).get(`${path()}?limit=1`).set(auth("DEVELOPER"));
  expect(first.status).toBe(200);
  expect(first.body.data).toHaveLength(1);
  expect(first.body.nextCursor).toBeTruthy();
  const second = await request(app)
    .get(`${path()}?limit=1&cursor=${first.body.nextCursor}`)
    .set(auth());
  expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
  expect((await request(app).get(path()).set(auth("OUTSIDER"))).status).toBe(404);
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}?cursor=${ids[0]}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect((await request(app).get(path(projects[1])).set(auth())).body.data).toEqual([]);
  outcome = "PASS";
  expect(
    (await request(app).post(path()).set(auth()).send({ environment: "staging" })).body.data.status,
  ).toBe("PASS");
});
