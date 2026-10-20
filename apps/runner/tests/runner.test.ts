import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJob, resultStatus, type Attempt } from "../src/schema.js";
import { allowedRequest, networkConfig, publicAddress, robotsAllows } from "../src/network.js";
import { callback, signature } from "../src/callback.js";
import { createStore, safeKey } from "../src/storage.js";
const job = {
  version: 1,
  runId: "run_1",
  environment: "staging",
  targetId: "threadline",
  checks: ["catalogue"],
  matrix: [{ browser: "chromium", device: "desktop" }],
  retries: 1,
};
test("relay reads owner-only spool as the unprivileged runner identity", async () => {
  const dockerfile = await readFile(new URL("../docker/Dockerfile", import.meta.url), "utf8");
  const relay = dockerfile.split("AS relay\n")[1];
  assert.ok(relay);
  assert.match(relay, /^USER 1001:1001$/m);
  const compose = await readFile(new URL("../docker/compose.yml", import.meta.url), "utf8");
  const relayService = compose.split("  relay:\n")[1];
  assert.match(relayService, /cap_drop: \[ALL\]/);
  assert.match(relayService, /spool:\/spool:ro/);
});
test("strict declarative job rejects executable fields, duplicates, unsupported cells and bounds", () => {
  assert.equal(parseJob(job).runId, "run_1");
  for (const patch of [
    { script: "alert(1)" },
    { targetId: "other" },
    { checks: ["eval"] },
    { checks: ["cart", "cart"] },
    { matrix: [job.matrix[0], job.matrix[0]] },
    { matrix: [{ browser: "chromium", device: "desktop", url: "https://evil.test" }] },
    { retries: 3 },
    { runId: "../escape" },
    { environment: "unknown" },
  ])
    assert.throws(() => parseJob({ ...job, ...patch }));
});
test("local origin is fixed and production remains disabled even with asserted egress", async () => {
  const env = {
    RUNNER_MODE: "local-isolated",
    RUNNER_LOCAL_ISOLATED: "1",
    RUNNER_TARGET_ORIGIN: "http://127.0.0.1:3201",
  };
  assert.equal((await networkConfig(env)).local, true);
  await assert.rejects(networkConfig({ ...env, RUNNER_TARGET_ORIGIN: "http://127.0.0.1:3100" }));
  await assert.rejects(networkConfig({ ...env, RUNNER_LOCAL_ISOLATED: "0" }));
  await assert.rejects(
    networkConfig({
      RUNNER_MODE: "production",
      RUNNER_TARGET_ORIGIN: "https://example.com",
      RUNNER_EGRESS_ENFORCED: "1",
    }),
    /disabled/,
  );
});
test("subrequests are same-origin read-only, public IP policy rejects special addresses", () => {
  const origin = "https://threadline.example";
  for (const url of [
    "http://threadline.example",
    "https://evil.example",
    "https://threadline.example:444",
    "https://u:p@threadline.example",
    "file:///etc/passwd",
    "http://169.254.169.254",
  ])
    assert.equal(allowedRequest(url, "GET", origin), false);
  assert.equal(allowedRequest(`${origin}/staging`, "GET", origin), true);
  assert.equal(allowedRequest(`${origin}/api/staging/checkout`, "POST", origin), false);
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "100.64.0.1",
    "198.18.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "224.1.1.1",
    "192.88.99.1",
  ])
    assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("robots fails closed on restrictions and unknown syntax", () => {
  assert.equal(robotsAllows("User-agent: *\nAllow: /"), true);
  assert.equal(
    robotsAllows("User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml"),
    true,
  );
  for (const text of [
    "",
    "User-agent: *\nDisallow: /admin",
    "User-agent: *\nCrawl-delay: 10",
    "User-agent: other\nAllow: /",
  ])
    assert.equal(robotsAllows(text), false);
});
test("status preserves final failure and flaky attempt history", () => {
  const make = (status: "passed" | "failed"): Attempt => ({
    attempt: 1,
    status,
    durationMs: 1,
    evidence: [],
  });
  assert.equal(resultStatus([make("passed")]), "passed");
  assert.equal(resultStatus([make("failed"), make("passed")]), "flaky");
  assert.equal(resultStatus([make("failed"), make("failed")]), "failed");
  assert.throws(() => resultStatus([]));
});
test("callbacks sign exact raw bytes and reuse event during bounded retries", async () => {
  const secret = "x".repeat(32);
  assert.equal(
    signature(secret, "100", "{}"),
    `sha256=${createHmac("sha256", secret).update("100.{}").digest("hex")}`,
  );
  const bodies: string[] = [];
  const send: typeof fetch = async (_url, init) => {
    const body = String(init?.body);
    bodies.push(body);
    const headers = init?.headers as Record<string, string>;
    assert.equal(
      headers["x-runner-signature"],
      signature(secret, headers["x-runner-timestamp"]!, body),
    );
    assert.equal(init?.redirect, "error");
    return new Response(null, { status: bodies.length < 3 ? 503 : 200 });
  };
  await callback("https://api.example/callback", secret, { eventId: "stable" }, false, send);
  assert.equal(bodies.length, 3);
  assert.equal(new Set(bodies).size, 1);
  await assert.rejects(callback("http://api.example", secret, {}, false, send));
  let calls = 0;
  await assert.rejects(
    callback("https://api.example", secret, {}, false, async () => {
      calls++;
      return new Response(null, { status: 401 });
    }),
  );
  assert.equal(calls, 1);
});
test("local evidence adapter writes bytes and rejects traversal keys", async () => {
  const directory = await mkdtemp(join(tmpdir(), "runner-test-"));
  try {
    const source = join(directory, "source.png");
    await writeFile(source, "evidence");
    const store = await createStore({ RUNNER_EVIDENCE_DIR: join(directory, "output") }, true);
    const key = "runs/run_1/chromium-desktop/cart/1/screenshot.png";
    const evidence = await store.put(source, key, "screenshot");
    assert.equal(evidence.size, 8);
    assert.equal(await readFile(join(directory, "output", key), "utf8"), "evidence");
    for (const key of [
      "../secret.png",
      "runs/../../secret.png",
      "/absolute.png",
      "runs/a/evil.exe",
    ])
      assert.throws(() => safeKey(key));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("remote evidence transport requires HTTPS except for the exact Docker test host", async () => {
  await assert.rejects(
    createStore({ RUNNER_S3_BUCKET: "evidence", RUNNER_S3_ENDPOINT: "http://storage.test" }, false),
    /S3 configuration required/,
  );
  await assert.rejects(
    createStore(
      {
        RUNNER_S3_BUCKET: "evidence",
        RUNNER_S3_ENDPOINT: "http://127.0.0.1:59000",
        RUNNER_S3_LOCAL_TEST: "1",
      },
      false,
    ),
    /S3 configuration required/,
  );
  assert.ok(
    await createStore(
      {
        RUNNER_S3_BUCKET: "evidence",
        RUNNER_S3_ENDPOINT: "http://host.docker.internal:59000",
        RUNNER_S3_LOCAL_TEST: "1",
      },
      false,
    ),
  );
  assert.ok(
    await createStore(
      { RUNNER_S3_BUCKET: "evidence", RUNNER_S3_ENDPOINT: "https://storage.test" },
      false,
    ),
  );
});
