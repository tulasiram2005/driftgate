import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { validSignature, validEvidenceKey } from "../src/execution.js";
import { runnerEnvironment } from "../src/sandbox.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
)
  throw new Error("Execution tests require isolated local driftgate_test database");
const db = new PrismaClient({ datasources: { db: { url } } });
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-api-secret-".repeat(4),
  RUNNER_CALLBACK_SECRET: "runner-test-secret-".repeat(3),
  REDIS_URL: "redis://127.0.0.1:6379",
  RUNNER_CALLBACK_URL: "http://api:4100/api/v1/runner/callback",
});
let verified = false;
const store = {
  upload: async (key: string) => `https://storage.test/upload/${key}`,
  download: async (key: string) => `https://storage.test/download/${key}`,
  verify: async () => verified,
};
const app = createApp(db, config, store);
const users: string[] = [];
const sessions: string[] = [];
let owner = "",
  outsider = "",
  reader = "",
  project = "",
  runId = "";
let manualRun = "",
  manualResult = "";
const base = () => `/api/v1/projects/${project}`;
const body = {
  environment: "STAGING",
  checks: ["catalogue"],
  matrix: [{ browser: "chromium", device: "desktop" }],
};
async function user() {
  const id = randomUUID(),
    sid = randomUUID();
  users.push(id);
  sessions.push(sid);
  await db.user.create({
    data: { id, name: "Execution test", email: `${id}@example.test`, passwordHash: "unused" },
  });
  await db.session.create({
    data: { id: sid, userId: id, tokenHash: "unused", expiresAt: new Date(Date.now() + 60000) },
  });
  return new SignJWT({ sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuer("driftgate")
    .setAudience("driftgate-web")
    .setExpirationTime("1m")
    .sign(new TextEncoder().encode(config.JWT_SECRET));
}
const auth = (token = owner) => ({ Authorization: `Bearer ${token}` });
function callback(payload: unknown, timestamp = String(Math.floor(Date.now() / 1000))) {
  const raw = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", config.RUNNER_CALLBACK_SECRET!).update(`${timestamp}.${raw}`).digest("hex")}`;
  return request(app)
    .post("/api/v1/runner/callback")
    .set("Content-Type", "application/json")
    .set("X-Runner-Timestamp", timestamp)
    .set("X-Runner-Signature", signature)
    .send(raw);
}
const resultEvent = (run: string, overrides = {}) => ({
  version: 1,
  eventId: randomUUID(),
  runId: run,
  type: "result",
  result: {
    checkId: "catalogue",
    browser: "chromium",
    device: "desktop",
    status: "passed",
    attempts: [{ attempt: 1, status: "passed", durationMs: 20, evidence: [] }],
    ...overrides,
  },
});
beforeAll(async () => {
  owner = await user();
  outsider = await user();
  reader = await user();
  const p = await db.project.create({
    data: {
      name: "Phase 3 test",
      members: {
        create: [
          { userId: users[0]!, role: "ADMIN" },
          { userId: users[2]!, role: "DEVELOPER" },
        ],
      },
    },
  });
  project = p.id;
  const suite = await db.suite.create({ data: { projectId: project, name: "Manual" } });
  const run = await db.run.create({
    data: {
      projectId: project,
      suiteId: suite.id,
      environment: "UAT",
      browser: "Chromium",
      device: "Desktop",
      results: { create: { caseId: "manual", title: "Manual", version: 1, steps: [] } },
    },
    include: { results: true },
  });
  manualRun = run.id;
  manualResult = run.results[0]!.id;
});
afterAll(async () => {
  if (project) await db.project.deleteMany({ where: { id: project } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe("automated execution", () => {
  it("persists runner snapshots atomically with immutable provenance and replay protection", async () => {
    const snapshot = {
      environment: "staging",
      origin: "http://127.0.0.1:3201",
      locale: "en-IN",
      productCount: 0,
      products: [],
    };
    const created = await request(app)
      .post(`${base()}/automated-runs`)
      .set(auth())
      .set("Idempotency-Key", randomUUID())
      .send({ ...body, checks: ["snapshot"] });
    expect(created.status).toBe(200);
    const id = created.body.data.id as string;
    const event = resultEvent(id, { checkId: "snapshot", snapshot });
    for (const result of [
      { ...event.result, snapshot: undefined },
      { ...event.result, snapshot: { ...snapshot, environment: "uat" } },
      { ...event.result, snapshot: { ...snapshot, source: "RUNNER" } },
      {
        ...event.result,
        status: "failed",
        attempts: [{ attempt: 1, status: "failed", durationMs: 1, evidence: [] }],
      },
      {
        ...event.result,
        attempts: [
          {
            attempt: 1,
            status: "passed",
            durationMs: 1,
            evidence: [{ kind: "screenshot", key: "foreign", contentType: "image/png", size: 1 }],
          },
        ],
      },
    ])
      expect((await callback({ ...event, result })).status).toBe(400);
    expect(await db.environmentSnapshot.count({ where: { runId: id } })).toBe(0);
    expect(await db.resultAttempt.count({ where: { result: { runId: id } } })).toBe(0);
    const responses = await Promise.all([callback(event), callback(event)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect((await callback({ ...event, eventId: randomUUID() })).status).toBe(409);
    expect(
      (
        await callback({
          ...event,
          result: { ...event.result, snapshot: { ...snapshot, environment: "prod" } },
        })
      ).status,
    ).toBe(409);
    const rows = await db.environmentSnapshot.findMany({ where: { runId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "RUNNER",
      createdBy: users[0],
      browser: "chromium",
      device: "desktop",
      environment: "staging",
      snapshot,
    });
    await expect(
      db.environmentSnapshot.update({
        where: { id: rows[0]!.id },
        data: { source: "MANUAL_IMPORT", runId: null, browser: null, device: null },
      }),
    ).rejects.toThrow();
    await expect(
      db.environmentSnapshot.create({ data: { ...rows[0]!, id: randomUUID() } }),
    ).rejects.toThrow();
    const manual = await request(app)
      .post(`${base()}/snapshots`)
      .set(auth())
      .send({ label: "Demo comparison", snapshot: { ...snapshot, environment: "uat" } });
    expect(manual.status).toBe(200);
    const mixed = await request(app)
      .post(`${base()}/comparisons`)
      .set(auth())
      .send({ beforeId: rows[0]!.id, afterId: manual.body.data.id });
    expect(mixed.status).toBe(200);
    expect(mixed.body.data.source).toBe("MANUAL_IMPORT");
    const nextRun = await request(app)
      .post(`${base()}/automated-runs`)
      .set(auth())
      .set("Idempotency-Key", randomUUID())
      .send({ ...body, environment: "UAT", checks: ["snapshot"] });
    expect(nextRun.status).toBe(200);
    expect(
      (
        await callback(
          resultEvent(nextRun.body.data.id, {
            checkId: "snapshot",
            snapshot: { ...snapshot, environment: "uat" },
            status: "flaky",
            attempts: [
              { attempt: 1, status: "failed", durationMs: 1, evidence: [] },
              { attempt: 2, status: "passed", durationMs: 1, evidence: [] },
            ],
          }),
        )
      ).status,
    ).toBe(200);
    const second = await db.environmentSnapshot.findFirstOrThrow({
      where: { runId: nextRun.body.data.id },
    });
    const comparison = await request(app)
      .post(`${base()}/comparisons`)
      .set(auth())
      .send({ beforeId: rows[0]!.id, afterId: second.id });
    expect(comparison.status).toBe(200);
    expect(comparison.body.data.source).toBe("RUNNER");
    expect(
      (
        await request(app)
          .post(`${base()}/snapshots`)
          .set(auth())
          .send({ label: "Spoof", snapshot, source: "RUNNER", runId: id })
      ).status,
    ).toBe(400);
    expect((await callback(resultEvent(id, { snapshot }))).status).toBe(400);
  });
  it("creates matrix and outbox atomically, persists one run for concurrent idempotent requests", async () => {
    const key = randomUUID();
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post(`${base()}/automated-runs`)
          .set(auth())
          .set("Idempotency-Key", key)
          .send(body),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses[0]!.body.data.id).toBe(responses[1]!.body.data.id);
    runId = responses[0]!.body.data.id;
    expect(responses[0]!.body.data.results).toHaveLength(1);
    expect(responses[0]!.body.data).not.toHaveProperty("requestHash");
    expect(responses[0]!.body.data).not.toHaveProperty("idempotencyKey");
    expect(responses[0]!.body.data).not.toHaveProperty("outbox");
    expect(await db.dispatchOutbox.count({ where: { runId } })).toBe(1);
    expect(
      (
        await request(app)
          .post(`${base()}/automated-runs`)
          .set(auth())
          .set("Idempotency-Key", key)
          .send({ ...body, retries: 2 })
      ).status,
    ).toBe(409);
  });
  it("accepts web limit200, separates manual list and hides dispatch internals", async () => {
    const auto = await request(app).get(`${base()}/automated-runs?limit=200`).set(auth());
    expect(auto.status).toBe(200);
    expect(auto.body.data.map((r: { id: string }) => r.id)).toContain(runId);
    const manual = await request(app).get(`${base()}/runs?limit=200`).set(auth());
    expect(manual.status).toBe(200);
    expect(manual.body.data.map((r: { id: string }) => r.id)).toEqual([manualRun]);
    expect(JSON.stringify([auto.body, manual.body])).not.toMatch(
      /requestHash|idempotencyKey|payload|tokenHash/,
    );
  });
  it("denies unauthenticated, nonmember and read-only writes across execution and evidence", async () => {
    const evidence = `/runs/${manualRun}/results/${manualResult}/evidence`;
    for (const suffix of [
      "/automated-runs",
      `/runs/${runId}`,
      `/runs/${runId}/events`,
      `${evidence}/missing/url`,
    ]) {
      expect((await request(app).get(`${base()}${suffix}`)).status).toBe(401);
      expect((await request(app).get(`${base()}${suffix}`).set(auth(outsider))).status).toBe(404);
    }
    for (const suffix of ["/automated-runs", evidence, `${evidence}/missing/complete`]) {
      expect(
        (await request(app).post(`${base()}${suffix}`).set(auth(outsider)).send(body)).status,
      ).toBe(404);
      expect(
        (await request(app).post(`${base()}${suffix}`).set(auth(reader)).send(body)).status,
      ).toBe(403);
    }
  });
  it("rejects missing keys, duplicate cells and foreign suite references", async () => {
    expect(
      (await request(app).post(`${base()}/automated-runs`).set(auth()).send(body)).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${base()}/automated-runs`)
          .set(auth())
          .set("Idempotency-Key", randomUUID())
          .send({ ...body, matrix: [...body.matrix, ...body.matrix] })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${base()}/automated-runs`)
          .set(auth())
          .set("Idempotency-Key", randomUUID())
          .send({ ...body, suiteId: "foreign" })
      ).status,
    ).toBe(404);
  });
  it("rejects tampered raw bytes, expired signatures and out-of-matrix result", async () => {
    expect(
      validSignature(
        Buffer.from("{} "),
        String(Math.floor(Date.now() / 1000)),
        `sha256=${createHmac("sha256", config.RUNNER_CALLBACK_SECRET!)
          .update(`${Math.floor(Date.now() / 1000)}.{}`)
          .digest("hex")}`,
        config.RUNNER_CALLBACK_SECRET!,
      ),
    ).toBe(false);
    expect((await callback(resultEvent(runId), "1000000000")).status).toBe(401);
    expect(
      (await request(app).post("/api/v1/runner/callback").send(resultEvent(runId))).status,
    ).toBe(401);
    expect((await callback(resultEvent(runId, { browser: "webkit" }))).status).toBe(400);
    expect(await db.callbackReceipt.count({ where: { runId } })).toBe(0);
  });
  it("rejects evidence outside dispatched prefix and inconsistent attempt history atomically", async () => {
    const attempts = [
      {
        attempt: 1,
        status: "passed",
        durationMs: 10,
        evidence: [
          {
            kind: "screenshot",
            key: `runs/other/chromium-desktop/catalogue/1/screenshot.png`,
            contentType: "image/png",
            size: 100,
          },
        ],
      },
    ];
    expect((await callback(resultEvent(runId, { attempts }))).status).toBe(400);
    expect((await callback(resultEvent(runId, { status: "flaky" }))).status).toBe(400);
    expect(await db.resultAttempt.count({ where: { result: { runId } } })).toBe(0);
  });
  it("persists flaky attempts, evidence and event once and rejects conflicting replay", async () => {
    const e = resultEvent(runId, {
      status: "flaky",
      attempts: [
        { attempt: 1, status: "failed", durationMs: 10, error: "First assertion", evidence: [] },
        {
          attempt: 2,
          status: "passed",
          durationMs: 20,
          evidence: [
            {
              kind: "screenshot",
              key: `runs/${runId}/chromium-desktop/catalogue/2/screenshot.png`,
              contentType: "image/png",
              size: 123,
            },
          ],
        },
      ],
    });
    expect((await callback(e)).status).toBe(200);
    expect((await callback(e)).status).toBe(200);
    expect((await callback({ ...e, result: { ...e.result, status: "failed" } })).status).toBe(409);
    expect(await db.resultAttempt.count({ where: { result: { runId } } })).toBe(2);
    expect(await db.runEvent.count({ where: { runId } })).toBe(2);
    const detail = await request(app).get(`${base()}/runs/${runId}`).set(auth());
    expect(detail.body.data.results[0].flaky).toBe(true);
    expect(detail.body.data.results[0].evidence).toHaveLength(1);
  });
  it("validates completion and blocks subsequent state changes", async () => {
    const complete = {
      version: 1,
      eventId: randomUUID(),
      runId,
      type: "completed",
      status: "flaky",
      resultCount: 1,
    };
    expect((await callback({ ...complete, status: "passed" })).status).toBe(400);
    expect((await callback(complete)).status).toBe(200);
    expect((await callback(complete)).status).toBe(200);
    expect((await callback(resultEvent(runId))).status).toBe(409);
    expect((await db.run.findUniqueOrThrow({ where: { id: runId } })).status).toBe("FLAKY");
    const result = await db.result.findFirstOrThrow({ where: { runId } });
    expect(
      (
        await request(app)
          .put(`${base()}/runs/${runId}/results/${result.id}`)
          .set(auth())
          .send({ status: "FAIL" })
      ).status,
    ).toBe(404);
  });
  it("reserves and verifies manual screenshots before authorized signed download", async () => {
    const path = `${base()}/runs/${manualRun}/results/${manualResult}/evidence`;
    const reserved = await request(app)
      .post(path)
      .set(auth())
      .send({ contentType: "image/png", sizeBytes: 123 });
    expect(reserved.status).toBe(200);
    expect(reserved.body.data.uploadUrl).toContain("https://storage.test/upload/manual/");
    const id = reserved.body.data.evidence.id;
    expect((await request(app).get(`${path}/${id}/url`).set(auth())).status).toBe(409);
    expect((await request(app).post(`${path}/${id}/complete`).set(auth())).status).toBe(409);
    verified = true;
    expect((await request(app).post(`${path}/${id}/complete`).set(auth())).status).toBe(200);
    expect(
      (await request(app).get(`${path}/${id}/url`).set(auth(reader))).body.data.expiresIn,
    ).toBe(300);
    expect((await request(app).get(`${path}/${id}/url`).set(auth(outsider))).status).toBe(404);
    await db.evidence.update({ where: { id }, data: { key: "manual/foreign/secret.png" } });
    expect((await request(app).get(`${path}/${id}/url`).set(auth())).status).toBe(404);
  });
  it("resumes authenticated SSE from persisted event cursor", async () => {
    const event = await db.runEvent.findFirstOrThrow({ where: { runId }, orderBy: { id: "asc" } });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const abort = new AbortController();
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}${base()}/runs/${runId}/events`,
        { headers: { ...auth(), "Last-Event-ID": String(event.id) }, signal: abort.signal },
      );
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const reader = response.body!.getReader();
      const chunk = await reader.read();
      const text = new TextDecoder().decode(chunk.value);
      expect(text).toContain("event: run");
      expect(text).not.toContain(`id: ${event.id}\n`);
      abort.abort();
      await reader.cancel().catch(() => undefined);
    } finally {
      abort.abort();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("limits child environment and validates evidence filenames", () => {
    const env = runnerEnvironment(config, "e30=");
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("JWT_SECRET");
    expect(env).not.toHaveProperty("GITHUB_TOKEN");
    expect(env.RUNNER_CALLBACK_URL).toBe(config.RUNNER_CALLBACK_URL);
    expect(
      validEvidenceKey(
        `runs/${runId}/chromium-desktop/catalogue/1/../screenshot.png`,
        runId,
        "chromium",
        "desktop",
        "catalogue",
        1,
        "screenshot",
      ),
    ).toBe(false);
  });
  it("rewrites loopback object storage only for the isolated local relay", () => {
    const local = readConfig({
      DATABASE_URL: config.DATABASE_URL,
      JWT_SECRET: config.JWT_SECRET,
      S3_ENDPOINT: "http://127.0.0.1:59000",
      RUNNER_CALLBACK_SECRET: config.RUNNER_CALLBACK_SECRET,
      RUNNER_CALLBACK_URL: config.RUNNER_CALLBACK_URL,
    });
    const env = runnerEnvironment(local, "e30=");
    expect(env.RUNNER_S3_ENDPOINT).toBe("http://host.docker.internal:59000/");
    expect(env.RUNNER_S3_LOCAL_TEST).toBe("1");
  });
});
