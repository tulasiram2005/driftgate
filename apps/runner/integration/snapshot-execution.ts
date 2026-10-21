import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "../src/execute.js";
import { createStore } from "../src/storage.js";
import { parseJob } from "../src/schema.js";

// Fixed local demo fixture exercises the actual execution and evidence pipeline.
let fail = false;
const server = createServer((request, response) => {
  if (request.url === "/api/staging/products") {
    response.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        data: {
          flags: [],
          products: [
            {
              id: "demo",
              slug: "demo",
              name: "Demo",
              description: "Fixture",
              category: "Tops",
              priceCents: 1000,
              compareAtCents: null,
              image: "/demo.png",
              imageAlt: "Demo",
              featured: false,
              sizes: [{ label: "M", stock: 1 }],
            },
          ],
        },
      }),
    );
  } else if (request.url === "/staging/products/demo") {
    response
      .writeHead(fail ? 503 : 200, { "content-type": "text/html" })
      .end(
        '<!doctype html><html><head><title>Demo</title></head><body><div class="detail-info"><h1>Demo</h1></div><div class="detail-price"><span>INR 10.00</span></div><div class="detail-photo"><img src="/demo.png" alt="Demo"></div></body></html>',
      );
  } else response.writeHead(404).end();
});
const directory = await mkdtemp(join(tmpdir(), "snapshot-execution-"));
try {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3201, "127.0.0.1", resolve);
  });
  const store = await createStore({ RUNNER_EVIDENCE_DIR: directory }, true);
  const job = parseJob({
    version: 1,
    runId: "snapshot-demo",
    environment: "staging",
    targetId: "threadline",
    checks: ["snapshot"],
    matrix: [{ browser: "chromium", device: "desktop" }],
    retries: 0,
  });
  for (const failure of [false, true]) {
    fail = failure;
    const events: unknown[] = [];
    await execute(job, { origin: "http://127.0.0.1:3201", local: true }, store, async (event) => {
      events.push(event);
    });
    assert.equal(events.length, 2);
    const result = events[0] as {
      result: {
        status: string;
        snapshot?: { environment: string; products: unknown[] };
        attempts: { evidence: unknown[] }[];
      };
    };
    assert.equal(result.result.status, fail ? "failed" : "passed");
    assert.equal(result.result.attempts[0]?.evidence.length, 3);
    if (fail) assert.equal(result.result.snapshot, undefined);
    else {
      assert.equal(result.result.snapshot?.environment, "staging");
      assert.equal(result.result.snapshot?.products.length, 1);
    }
    assert.equal((events[1] as { status: string }).status, fail ? "failed" : "passed");
  }
  console.log(
    "PASS: snapshot execution emits bounded result payload and evidence; failed collection emits no snapshot",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
