import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { decodeScreenshot } from "@driftgate/drift/visual-png";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("An isolated local driftgate_test database is required");
const db = new PrismaClient({ datasources: { db: { url } } });
const objects = new Map<string, Buffer>();
let failWrite = false;
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-only-secret-".repeat(5),
  API_CORS_ORIGINS: "http://127.0.0.1:3100",
});
const app = createApp(db, config, {
  upload: async () => "https://example.test/upload",
  download: async () => "https://example.test/private-difference",
  verify: async () => true,
  readScreenshot: async (key, size) => {
    const body = objects.get(key);
    if (!body || body.length !== size) throw new Error("Missing screenshot");
    return body;
  },
  writeScreenshot: async (key, body) => {
    if (failWrite) throw new Error("Demo storage outage");
    objects.set(key, body);
  },
});
const users: Record<string, { id: string; token: string }> = {};
let projectId = "";
let baselineId = "";
let sourceId = "";
let currentId = "";
let runId = "";
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = () => `/api/v1/projects/${projectId}/visual-comparisons`;
const compare = (evidenceId = currentId, role = "ADMIN") =>
  request(app).post(path()).set(auth(role)).send({ evidenceId });
function png(changed: boolean, width = 1280) {
  const p = new PNG({ width, height: 900 });
  p.data.fill(255);
  if (changed) p.data.fill(0, 0, 3);
  return PNG.sync.write(p);
}
beforeAll(async () => {
  for (const role of ["ADMIN", "DEVELOPER", "OUTSIDER"]) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo comparison",
        email: `visual-compare-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  const project = await request(app)
    .post("/api/v1/projects")
    .set(auth())
    .send({ name: "Demo comparison integration" });
  projectId = project.body.data.id;
  await db.member.create({ data: { projectId, userId: users.DEVELOPER!.id, role: "DEVELOPER" } });
  const run = await db.run.create({
    data: {
      projectId,
      environment: "STAGING",
      browser: "matrix",
      device: "matrix",
      mode: "AUTOMATED",
    },
  });
  runId = run.id;
  const result = await db.result.create({
    data: {
      runId,
      caseId: "catalogue",
      title: "Demo",
      version: 1,
      steps: [],
      browser: "chromium",
      device: "desktop",
    },
  });
  for (const changed of [false, true]) {
    const key = `runs/${runId}/chromium-desktop/catalogue/${randomUUID()}.png`;
    const body = png(changed);
    objects.set(key, body);
    const evidence = await db.evidence.create({
      data: {
        resultId: result.id,
        key,
        kind: "screenshot",
        contentType: "image/png",
        sizeBytes: body.length,
        ready: true,
      },
    });
    if (changed) currentId = evidence.id;
    else sourceId = evidence.id;
  }
  const baseline = await db.visualBaseline.create({
    data: {
      projectId,
      evidenceId: sourceId,
      label: "Demo approved",
      environment: "STAGING",
      browser: "chromium",
      device: "desktop",
      checkId: "catalogue",
      viewportWidth: 1280,
      viewportHeight: 900,
      createdBy: users.ADMIN!.id,
      status: "APPROVED",
      reviewedBy: users.ADMIN!.id,
      reviewedAt: new Date(),
      reviewComment: "Demo approval",
      active: true,
      activatedBy: users.ADMIN!.id,
      activatedAt: new Date(),
    },
  });
  baselineId = baseline.id;
});
afterAll(async () => {
  await db.visualComparison.deleteMany({ where: { projectId } });
  await db.visualBaseline.deleteMany({ where: { projectId } });
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((u) => u.id) } } });
  await db.$disconnect();
});
it("compares real PNGs, persists exact metrics and protects private difference access", async () => {
  const response = await compare();
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    baselineId,
    evidenceId: currentId,
    changedPixels: 1,
    comparedPixels: 1280 * 900,
    width: 1280,
    height: 900,
  });
  expect(response.body.data.diffKey).toBeUndefined();
  const record = await db.visualComparison.findUniqueOrThrow({
    where: { id: response.body.data.id },
  });
  expect(decodeScreenshot(objects.get(record.diffKey)!).width).toBe(1280);
  const list = await request(app).get(path()).set(auth("DEVELOPER"));
  expect(list.status).toBe(200);
  expect(list.body.data[0].baseline.label).toBe("Demo approved");
  expect(list.body.data[0].diffKey).toBeUndefined();
  const download = `${path()}/${record.id}/url`;
  expect((await request(app).get(download).set(auth("DEVELOPER"))).body.data.url).toBe(
    "https://example.test/private-difference",
  );
  expect((await request(app).get(download).set(auth("OUTSIDER"))).status).toBe(404);
  expect((await compare(currentId, "DEVELOPER")).status).toBe(403);
  expect((await compare(currentId, "OUTSIDER")).status).toBe(404);
  expect((await request(app).get(`${path()}?cursor=missing`).set(auth())).status).toBe(404);
});
it("requires new ready automated evidence and an active matching scope", async () => {
  expect((await compare(sourceId)).status).toBe(400);
  expect((await compare("missing")).status).toBe(404);
  await db.evidence.update({ where: { id: currentId }, data: { ready: false } });
  expect((await compare()).status).toBe(404);
  await db.evidence.update({ where: { id: currentId }, data: { ready: true } });
  await db.run.update({ where: { id: runId }, data: { environment: "UAT" } });
  expect((await compare()).status).toBe(409);
  await db.run.update({ where: { id: runId }, data: { environment: "STAGING", mode: "MANUAL" } });
  expect((await compare()).status).toBe(404);
  await db.run.update({ where: { id: runId }, data: { mode: "AUTOMATED" } });
  await db.visualBaseline.update({ where: { id: baselineId }, data: { active: false } });
  expect((await compare()).status).toBe(409);
  await db.visualBaseline.update({ where: { id: baselineId }, data: { active: true } });
});
it("does not save successful records for storage failures or invalid PNGs and recovers", async () => {
  const count = await db.visualComparison.count({ where: { projectId } });
  failWrite = true;
  expect((await compare()).status).toBe(502);
  failWrite = false;
  const evidence = await db.evidence.findUniqueOrThrow({ where: { id: currentId } });
  const original = objects.get(evidence.key)!;
  for (const body of [Buffer.from("invalid"), png(true, 1279)]) {
    objects.set(evidence.key, body);
    await db.evidence.update({ where: { id: currentId }, data: { sizeBytes: body.length } });
    expect((await compare()).status).toBe(422);
  }
  objects.delete(evidence.key);
  expect((await compare()).status).toBe(502);
  expect(await db.visualComparison.count({ where: { projectId } })).toBe(count);
  objects.set(evidence.key, original);
  await db.evidence.update({ where: { id: currentId }, data: { sizeBytes: original.length } });
  expect((await compare()).status).toBe(200);
});
