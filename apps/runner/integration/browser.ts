import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "../src/execute.js";
import { createStore } from "../src/storage.js";
import { callback, signature } from "../src/callback.js";
import { parseJob } from "../src/schema.js";

// Deterministic Threadline-markup fixture, not the actual Next.js storefront.
// Compose exercises the real store; this harness tests runner/browser behavior.
let failFirstProduct = true;
let hostile = false;
const received: Record<string, unknown>[] = [];
const secret = "integration-only-secret-32-bytes-long";
const server = createServer(async (request, response) => {
  if (request.url === "/callback" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    assert.equal(
      request.headers["x-runner-signature"],
      signature(secret, String(request.headers["x-runner-timestamp"]), body),
    );
    received.push(JSON.parse(body));
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }
  if (request.url === "/staging/products/everyday-shirt" && failFirstProduct) {
    failFirstProduct = false;
    response.writeHead(500).end("Deliberate first-attempt failure");
    return;
  }
  const paths: Record<string, string> = {
    "/staging":
      '<input type="search" aria-label="Search products">' +
      '<div class="product-photo">Demo product</div>'.repeat(6),
    "/staging/products/everyday-shirt":
      '<section class="detail-info"><h1>Everyday shirt</h1></section><button>Add to cart</button><button>S</button>',
    "/staging/cart": "<p>Your cart is empty.</p><button disabled>Place demo order</button>",
  };
  const html = paths[request.url ?? ""];
  response.writeHead(html ? 200 : 404, { "content-type": "text/html" });
  response.end(
    `<!doctype html><html><body>${html ?? "Not found"}${hostile ? '<script>fetch("http://127.0.0.1:9/forbidden").catch(()=>{})</script>' : ""}</body></html>`,
  );
});
const directory = await mkdtemp(join(tmpdir(), "runner-browser-integration-"));
try {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3201, "127.0.0.1", resolve);
  });
  const store = await createStore({ RUNNER_EVIDENCE_DIR: directory }, true);
  const job = parseJob({
    version: 1,
    runId: "integration",
    environment: "staging",
    targetId: "threadline",
    checks: ["catalogue", "product", "cart"],
    matrix: [
      { browser: "chromium", device: "desktop" },
      { browser: "chromium", device: "mobile" },
      { browser: "firefox", device: "desktop" },
      { browser: "webkit", device: "mobile" },
    ],
    retries: 1,
  });
  await execute(job, { origin: "http://127.0.0.1:3201", local: true }, store, (event) =>
    callback("http://127.0.0.1:3201/callback", secret, event, true),
  );
  assert.equal(received.length, 13);
  assert.equal(received.at(-1)?.status, "flaky");
  let flaky = 0;
  for (const event of received.filter((event) => event.type === "result")) {
    const result = event.result as {
      status: string;
      attempts: { evidence: { key: string; kind: string; size: number }[] }[];
    };
    assert.notEqual(result.status, "failed");
    if (result.status === "flaky") {
      flaky++;
      assert.equal(result.attempts.length, 2);
    }
    for (const attempt of result.attempts) {
      assert.deepEqual(attempt.evidence.map((e) => e.kind).sort(), [
        "screenshot",
        "trace",
        "video",
      ]);
      for (const evidence of attempt.evidence) {
        const bytes = await readFile(join(directory, evidence.key));
        assert.equal(bytes.length, evidence.size);
        assert.ok(bytes.length > 0);
        if (evidence.kind === "screenshot")
          assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        if (evidence.kind === "trace") assert.equal(bytes.subarray(0, 2).toString(), "PK");
        if (evidence.kind === "video")
          assert.equal(bytes.subarray(0, 4).toString("hex"), "1a45dfa3");
      }
    }
  }
  assert.equal(flaky, 1);
  hostile = true;
  received.length = 0;
  await execute(
    { ...job, runId: "hostile", checks: ["catalogue"], matrix: [job.matrix[0]!], retries: 0 },
    { origin: "http://127.0.0.1:3201", local: true },
    store,
    (event) => callback("http://127.0.0.1:3201/callback", secret, event, true),
  );
  assert.equal(received.at(-1)?.status, "failed");
  console.log(
    "PASS: 12 real-browser fixture results, retry/flaky history, PNG/WebM/trace bytes, signed HTTP callbacks, denied foreign subrequest",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
