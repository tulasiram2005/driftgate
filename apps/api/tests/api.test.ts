import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
) {
  throw new Error(
    "Use TEST_API_DATABASE_URL pointing to an isolated local /driftgate_test database. Refusing other databases.",
  );
}
const db = new PrismaClient({ datasources: { db: { url } } });
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-only-not-a-production-secret-".repeat(3),
  API_CORS_ORIGINS: "http://127.0.0.1:3100",
});
const app = createApp(db, config);
const suffix = randomUUID();
const email = (name: string) => `${name}-${suffix}@example.test`;
const password = "LongTestPassword123!";
let a = "";
let b = "";
let adminId = "";
let otherId = "";
let project = "";
let requirement = "";
let caseId = "";
let suite = "";
let run = "";
let result = "";
let firstCookie = "";
const path = (tail = "") => `/api/v1/projects/${project}${tail}`;
const auth = (token = a) => ({ Authorization: `Bearer ${token}` });
const body = {
  title: "Checkout keeps stock accurate",
  priority: "HIGH",
  type: "MANUAL",
  tags: ["sanity"],
  steps: [{ action: "Place a demo order", expected: "Stock decreases once" }],
};

beforeAll(async () => {
  await db.$connect();
  const reg = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "QA owner", email: email("owner"), password });
  expect(reg.status).toBe(200);
  a = reg.body.data.accessToken;
  adminId = reg.body.data.user.id;
  firstCookie = String(reg.headers["set-cookie"]?.[0]).split(";")[0]!;
  const other = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "Other user", email: email("other"), password });
  expect(other.status).toBe(200);
  b = other.body.data.accessToken;
  otherId = other.body.data.user.id;
});
afterAll(async () => {
  if (project) await db.project.deleteMany({ where: { id: project } });
  await db.user.deleteMany({ where: { id: { in: [adminId, otherId].filter(Boolean) } } });
  await db.$disconnect();
});

describe("phase 2 end-to-end API", () => {
  it("rejects bad configuration and wildcard CORS before startup", () => {
    expect(() => readConfig({ DATABASE_URL: "invalid", JWT_SECRET: "short" })).toThrow();
    expect(() =>
      readConfig({ DATABASE_URL: url, JWT_SECRET: config.JWT_SECRET, API_CORS_ORIGINS: "*" }),
    ).toThrow();
  });
  it("sets HttpOnly refresh cookie and never exposes password/token hashes", async () => {
    const r = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: email("owner"), password });
    expect(r.status).toBe(200);
    expect(String(r.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(r.headers["set-cookie"])).toContain("SameSite=Strict");
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash/);
    expect((await db.user.findUniqueOrThrow({ where: { id: adminId } })).passwordHash).toMatch(
      /^\$argon2id/,
    );
  });
  it("creates a project with an ADMIN membership", async () => {
    const r = await request(app)
      .post("/api/v1/projects")
      .set(auth())
      .send({ name: "Demo fashion QA" });
    expect(r.status).toBe(200);
    expect(r.body.data.role).toBe("ADMIN");
    project = r.body.data.id;
  });
  it("creates a linked requirement, test case, suite and snapshotted run", async () => {
    const req = await request(app)
      .post(path("/requirements"))
      .set(auth())
      .send({ title: "Orders decrement stock once" });
    expect(req.status).toBe(200);
    requirement = req.body.data.id;
    const c = await request(app)
      .post(path("/cases"))
      .set(auth())
      .send({ ...body, requirementId: requirement });
    expect(c.status).toBe(200);
    caseId = c.body.data.id;
    const s = await request(app)
      .post(path("/suites"))
      .set(auth())
      .send({ name: "Sanity", caseIds: [caseId] });
    expect(s.status).toBe(200);
    suite = s.body.data.id;
    const r = await request(app)
      .post(path("/runs"))
      .set(auth())
      .send({ suiteId: suite, environment: "UAT", browser: "WebKit", device: "Desktop" });
    expect(r.status).toBe(200);
    run = r.body.data.id;
    result = r.body.data.results[0].id;
    expect(r.body.data.results[0]).toMatchObject({
      title: body.title,
      version: 1,
      status: "NOT_RUN",
    });
  });
  it("saves manual results and preserves historical test versions", async () => {
    expect(
      (
        await request(app)
          .put(path(`/runs/${run}/results/${result}`))
          .set(auth())
          .send({ status: "FAIL", notes: "Demo stock mismatch; steps reproduced" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(path(`/cases/${caseId}`))
          .set(auth())
          .send({ ...body, title: "Updated title", requirementId: requirement })
      ).body.data.version,
    ).toBe(2);
    const history = await request(app)
      .get(path(`/cases/${caseId}/versions`))
      .set(auth());
    expect(history.body.data.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(history.body.data[1].snapshot.title).toBe(body.title);
    const runs = await request(app).get(path("/runs")).set(auth());
    expect(runs.body.data[0].results[0]).toMatchObject({
      title: body.title,
      version: 1,
      status: "FAIL",
    });
  });
  it("exposes requirement traceability and paginates/filter cases", async () => {
    const coverage = await request(app).get(path("/coverage")).set(auth());
    expect(coverage.body.data[0].cases[0].id).toBe(caseId);
    const cases = await request(app)
      .get(path("/cases?search=Updated&priority=HIGH&limit=1"))
      .set(auth());
    expect(cases.status).toBe(200);
    expect(cases.body.data).toHaveLength(1);
    expect((await request(app).get(path("/cases?limit=-1")).set(auth())).status).toBe(400);
  });
  it("enforces the authorization matrix for unauthenticated and unrelated users", async () => {
    const routes: ["get" | "post" | "put" | "delete", string, object?][] = [
      ["get", path()],
      ["get", path("/members")],
      ["post", path("/members"), { email: email("other"), role: "QA" }],
      ["get", path("/requirements")],
      ["post", path("/requirements"), { title: "Attack" }],
      ["get", path("/cases")],
      ["post", path("/cases"), body],
      ["put", path(`/cases/${caseId}`), body],
      ["delete", path(`/cases/${caseId}`)],
      ["get", path(`/cases/${caseId}/versions`)],
      ["get", path("/cases.csv")],
      ["post", path("/cases/import"), { csv: "bad" }],
      ["get", path("/coverage")],
      ["get", path("/suites")],
      ["post", path("/suites"), { name: "Attack", caseIds: [caseId] }],
      ["get", path("/runs")],
      [
        "post",
        path("/runs"),
        { suiteId: suite, environment: "PROD", browser: "Chromium", device: "Desktop" },
      ],
      ["put", path(`/runs/${run}/results/${result}`), { status: "PASS" }],
    ];
    for (const [method, url, payload] of routes) {
      let unauth = request(app)[method](url);
      if (payload) unauth = unauth.send(payload);
      expect((await unauth).status, `unauth ${method} ${url}`).toBe(401);
      let other = request(app)[method](url).set(auth(b));
      if (payload) other = other.send(payload);
      expect((await other).status, `outsider ${method} ${url}`).toBe(404);
    }
    expect((await request(app).get("/api/v1/projects").set(auth(b))).body.data).toEqual([]);
    expect((await request(app).get("/api/v1/projects")).status).toBe(401);
    expect((await request(app).post("/api/v1/projects").send({ name: "X" })).status).toBe(401);
  });
  it("permits QA writes and only ADMIN can assign project roles", async () => {
    expect(
      (
        await request(app)
          .post(path("/members"))
          .set(auth())
          .send({ email: email("other"), role: "QA" })
      ).status,
    ).toBe(200);
    expect((await request(app).get(path("/cases")).set(auth(b))).status).toBe(200);
    expect(
      (
        await request(app)
          .post(path("/requirements"))
          .set(auth(b))
          .send({ title: "QA requirement" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(path("/members"))
          .set(auth(b))
          .send({ email: email("owner"), role: "QA" })
      ).status,
    ).toBe(403);
    for (const role of ["DEVELOPER", "APPROVER"]) {
      expect(
        (
          await request(app)
            .post(path("/members"))
            .set(auth())
            .send({ email: email("other"), role })
        ).status,
      ).toBe(200);
      expect((await request(app).get(path("/runs")).set(auth(b))).status).toBe(200);
      expect((await request(app).post(path("/cases")).set(auth(b)).send(body)).status).toBe(403);
      expect(
        (
          await request(app)
            .put(path(`/runs/${run}/results/${result}`))
            .set(auth(b))
            .send({ status: "PASS" })
        ).status,
      ).toBe(403);
    }
  });
  it("rejects cross-project requirements and unknown suite cases", async () => {
    expect(
      (
        await request(app)
          .post(path("/cases"))
          .set(auth())
          .send({ ...body, requirementId: "missing" })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path("/suites"))
          .set(auth())
          .send({ name: "Invalid", caseIds: ["missing"] })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .put(path(`/runs/${run}/results/missing`))
          .set(auth())
          .send({ status: "PASS" })
      ).status,
    ).toBe(404);
  });
  it("round trips CSV and rejects malformed imports atomically", async () => {
    const csv = await request(app).get(path("/cases.csv")).set(auth());
    expect(csv.status).toBe(200);
    expect(
      (await request(app).post(path("/cases/import")).set(auth()).send({ csv: csv.text })).body.data
        .imported,
    ).toBe(1);
    const count = await db.testCase.count({ where: { projectId: project } });
    expect(
      (
        await request(app)
          .post(path("/cases/import"))
          .set(auth())
          .send({ csv: 'title,steps\nBroken,"not JSON"' })
      ).status,
    ).toBe(400);
    expect(await db.testCase.count({ where: { projectId: project } })).toBe(count);
  });
  it("rotates refresh tokens, rejects replay and revokes old access sessions", async () => {
    const r = await request(app).post("/api/v1/auth/refresh").set("Cookie", firstCookie);
    expect(r.status).toBe(200);
    expect((await request(app).get(path()).set(auth())).status).toBe(401);
    expect(
      (await request(app).post("/api/v1/auth/refresh").set("Cookie", firstCookie)).status,
    ).toBe(401);
    a = r.body.data.accessToken;
    const cookie = String(r.headers["set-cookie"]?.[0]).split(";")[0]!;
    expect((await request(app).post("/api/v1/auth/logout").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get(path()).set(auth())).status).toBe(401);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: email("owner"), password });
    expect(login.status).toBe(200);
    a = login.body.data.accessToken;
  });
  it("rejects expired JWTs, untrusted origins and invalid result status", async () => {
    const expired = await new SignJWT({ sid: "irrelevant" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(adminId)
      .setIssuer("driftgate")
      .setAudience("driftgate-web")
      .setExpirationTime(1)
      .sign(new TextEncoder().encode(config.JWT_SECRET));
    expect((await request(app).get(path()).set(auth(expired))).status).toBe(401);
    expect(
      (await request(app).post("/api/v1/auth/refresh").set("Origin", "https://evil.example"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(path(`/runs/${run}/results/${result}`))
          .set(auth())
          .send({ status: "FAKE" })
      ).status,
    ).toBe(400);
  });
  it("archives cases without rewriting previous run evidence", async () => {
    expect(
      (
        await request(app)
          .delete(path(`/cases/${caseId}`))
          .set(auth())
      ).status,
    ).toBe(200);
    const cases = await request(app).get(path("/cases")).set(auth());
    expect(cases.body.data.some((c: { id: string }) => c.id === caseId)).toBe(false);
    expect(
      (
        await request(app)
          .post(path("/runs"))
          .set(auth())
          .send({ suiteId: suite, environment: "UAT", browser: "Chromium", device: "Desktop" })
      ).status,
    ).toBe(409);
    expect(
      (await request(app).get(path("/runs")).set(auth())).body.data[0].results[0].version,
    ).toBe(1);
  });
  it("serves Zod-derived OpenAPI and rate limits rapid bad login attempts", async () => {
    const spec = await request(app).get("/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.paths["/api/v1/projects/{projectId}/cases"]).toBeTruthy();
    const isolated = createApp(db, config);
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const r = await request(isolated)
        .post("/api/v1/auth/login")
        .send({ email: email("owner"), password: "WrongPassword123!" });
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash/);
      last = r.status;
    }
    expect(last).toBe(429);
  });
});
