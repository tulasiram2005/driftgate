import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PNG } from "pngjs";
import { PrismaClient } from "../generated/client/index.js";
import { readConfig } from "../src/config.js";
import { storage } from "../src/storage.js";

// Explicit opt-in: this creates and removes only uniquely identified demo fixtures.
assert.equal(process.env.VERIFY_HOSTED_VISUAL, "1", "Explicit cloud verification opt-in required");
const origin = "https://driftgate-api-s2pc.onrender.com";
const config = readConfig(process.env);
const database = new URL(config.DATABASE_URL);
assert.equal(database.pathname, "/driftgate");
assert.ok(database.hostname.endsWith(".neon.tech"));
assert.ok(config.S3_ENDPOINT?.startsWith("https://"));
const store = storage(config);
assert.ok(store?.writeScreenshot);
const db = new PrismaClient();
const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
  },
});
const marker = randomUUID();
const keys = new Set<string>();
let userId = "";
let projectId = "";
let token = "";
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(90000),
  });
  assert.equal(response.status, 200, `${method} ${path}: HTTP ${response.status}`);
  return (await response.json()).data;
}
try {
  const account = await api("/auth/register", "POST", {
    name: "Demo cloud visual verification",
    email: `visual-cloud-${marker}@example.test`,
    password: `Demo-${randomUUID()}!`,
  });
  userId = account.user.id;
  token = account.accessToken;
  const project = await api("/projects", "POST", { name: `Demo visual verification ${marker}` });
  projectId = project.id;
  // Prove that local cleanup credentials reference the same database as the hosted API.
  await db.project.findUniqueOrThrow({ where: { id: projectId } });
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
      title: "Demo synthetic PNG",
      version: 1,
      steps: [],
      browser: "chromium",
      device: "desktop",
    },
  });
  const evidenceIds: string[] = [];
  for (const changed of [false, true]) {
    const png = new PNG({ width: 1280, height: 900 });
    png.data.fill(255);
    if (changed) png.data.fill(0, 0, 3);
    const bytes = PNG.sync.write(png);
    const key = `verification/${marker}/${changed ? "current" : "baseline"}.png`;
    keys.add(key);
    await store.writeScreenshot(key, bytes);
    const evidence = await db.evidence.create({
      data: {
        resultId: result.id,
        key,
        kind: "screenshot",
        contentType: "image/png",
        sizeBytes: bytes.length,
        ready: true,
      },
    });
    evidenceIds.push(evidence.id);
  }
  const base = `/projects/${projectId}`;
  const baseline = await api(`${base}/visual-baselines`, "POST", {
    evidenceId: evidenceIds[0],
    label: "Demo synthetic baseline",
  });
  await api(`${base}/visual-baselines/${baseline.id}/review`, "POST", {
    status: "APPROVED",
    comment: "Temporary synthetic verification fixture",
  });
  await api(`${base}/visual-baselines/${baseline.id}/activate`, "POST");
  const comparison = await api(`${base}/visual-comparisons`, "POST", {
    evidenceId: evidenceIds[1],
  });
  assert.equal(comparison.changedPixels, 1);
  assert.equal(comparison.comparedPixels, 1280 * 900);
  assert.equal(comparison.diffKey, undefined);
  const link = await api(`${base}/visual-comparisons/${comparison.id}/url`);
  const download = await fetch(link.url, { signal: AbortSignal.timeout(30000) });
  assert.equal(download.status, 200);
  const diff = PNG.sync.read(Buffer.from(await download.arrayBuffer()));
  assert.equal(diff.width, 1280);
  assert.equal(diff.height, 900);
  const unsigned = new URL(link.url);
  unsigned.search = "";
  assert.equal((await fetch(unsigned, { signal: AbortSignal.timeout(30000) })).status, 403);
  await api(`${base}/visual-baselines/${baseline.id}/ignore-regions`, "PUT", {
    revision: 0,
    regions: [{ x: 0, y: 0, width: 1, height: 1 }],
  });
  const masked = await api(`${base}/visual-comparisons`, "POST", { evidenceId: evidenceIds[1] });
  assert.equal(masked.changedPixels, 0);
  assert.equal(masked.ignoredPixels, 1);
  assert.equal(masked.ignoreRevision, 1);
  console.log(
    "PASS: hosted baseline approval/activation, exact pixel diff, private download and saved ignore region",
  );
} catch {
  console.error("FAIL: hosted visual verification; credentials and response bodies withheld");
  process.exitCode = 1;
} finally {
  try {
    if (projectId) {
      const comparisons = await db.visualComparison.findMany({
        where: { projectId },
        select: { diffKey: true },
      });
      for (const comparison of comparisons) keys.add(comparison.diffKey);
    }
    for (const Key of keys)
      await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key }));
    if (projectId) {
      await db.visualComparison.deleteMany({ where: { projectId } });
      await db.visualBaseline.deleteMany({ where: { projectId } });
      await db.project.delete({ where: { id: projectId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    console.log("PASS: temporary verification records and objects removed");
  } catch {
    console.error(
      `Cleanup incomplete for verification ${marker}; retain this identifier for recovery`,
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
    s3.destroy();
  }
}
