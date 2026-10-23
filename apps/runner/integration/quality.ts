import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { runCheck } from "../src/catalog.js";

// Deterministic local fixtures verify detection, not real storefront coverage.
let invalid = false;
let redirect = false;
const server = createServer((request, response) => {
  if (request.url === "/staging/redirect") {
    response.writeHead(302, { location: "http://192.0.2.1/private" });
    response.end();
    return;
  }
  if (request.url === "/staging/missing") {
    response.writeHead(404);
    response.end("Demo missing page");
    return;
  }
  if (request.url === "/api/staging/products") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
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
              priceCents: invalid ? -1 : 100,
              compareAtCents: null,
              image: "/demo.jpg",
              imageAlt: "Demo",
              featured: false,
              sizes: [{ label: "S", stock: 1 }],
            },
          ],
        },
      }),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/html" });
  response.end(
    `<!doctype html><html lang="en"><head><title>Demo fixture</title></head><body><main><h1>Demo catalogue</h1><input type="search" aria-label="Search products"><a href="/staging/${redirect ? "redirect" : invalid ? "missing" : "product"}">Demo product</a>${invalid ? "<button></button>" : "<button>Search</button>"}</main></body></html>`,
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await runCheck(page, "api-contract", origin, "staging");
  await runCheck(page, "accessibility", origin, "staging");
  await runCheck(page, "broken-links", origin, "staging");
  invalid = true;
  await assert.rejects(runCheck(page, "api-contract", origin, "staging"), /catalogue contract/);
  await assert.rejects(runCheck(page, "accessibility", origin, "staging"), /button-name/);
  await assert.rejects(
    runCheck(page, "broken-links", origin, "staging"),
    /Broken or unavailable links: 1 of 1/,
  );
  redirect = true;
  await assert.rejects(
    runCheck(page, "broken-links", origin, "staging"),
    /Broken or unavailable links: 1 of 1/,
  );
  console.log(
    "PASS: Chromium API contract, axe and link checks accept clean fixtures and reject seeded failures and redirects (7 assertions)",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
