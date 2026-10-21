import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { collectThreadlineSnapshot } from "../src/snapshot.js";
import { compareEnvironments } from "../src/drift.js";
import { runCheck } from "../src/catalog.js";

// Fully intercepted demo fixture: no external or local server traffic is allowed.
const browser = await chromium.launch();
let scenario:
  "normal" | "missing-metadata" | "malformed-metadata" | "duplicate-metadata" | "failed-page" =
  "normal";
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, "http://127.0.0.1:3201");
    if (url.pathname.startsWith("/api/")) {
      await route.fulfill({
        json: {
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
                sizes: [{ label: "M", stock: 2 }],
              },
            ],
          },
        },
      });
    } else if (url.pathname === "/demo.png") {
      await route.fulfill({ status: 404, body: "Missing demo image" });
    } else if (/^\/(staging|uat)\/products\/demo$/.test(url.pathname)) {
      if (scenario === "failed-page") {
        await route.fulfill({ status: 503, body: "Demo page unavailable" });
        return;
      }
      const changed = url.pathname.startsWith("/uat/");
      const metadata = {
        "@type": "Product",
        name: "Demo",
        sku: "demo",
        offers: {
          "@type": "Offer",
          price: "10.00",
          priceCurrency: "INR",
          availability: "InStock",
          url: url.pathname,
        },
      };
      const script = `<script type="application/ld+json">${scenario === "malformed-metadata" ? "{" : JSON.stringify(metadata)}</script>`;
      const scripts =
        scenario === "missing-metadata"
          ? ""
          : scenario === "duplicate-metadata"
            ? script + script
            : script;
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head>
        <title>Demo product</title><link rel="canonical" href="${url.href}">
        ${scripts}</head><body>
        <div class="detail-info"><h1>Demo</h1></div>
        <div class="detail-price"><span>INR ${changed ? "12.00" : "10.00"}</span></div>
        <div class="detail-photo"><img src="/demo.png" alt="Demo"></div></body></html>`,
      });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  const before = await collectThreadlineSnapshot(page, "staging");
  const after = await collectThreadlineSnapshot(page, "uat");
  assert.equal(before.products[0]?.image.status, 404);
  assert.equal(before.products[0]?.image.width, 0);
  assert.equal(before.products[0]?.jsonLd?.sku, "demo");
  assert.equal(page.listenerCount("response"), 0);
  const findings = compareEnvironments(before, after);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.field, "price");
  assert.equal(findings[0]?.after, 1200);
  scenario = "missing-metadata";
  const missing = await collectThreadlineSnapshot(page, "uat");
  assert.equal(missing.products[0]?.jsonLd, null);
  assert.ok(compareEnvironments(before, missing).some((finding) => finding.field === "jsonLd"));
  for (const failure of ["malformed-metadata", "duplicate-metadata", "failed-page"] as const) {
    scenario = failure;
    await assert.rejects(collectThreadlineSnapshot(page, "staging"));
    assert.equal(page.listenerCount("response"), 0);
  }
  scenario = "normal";
  const dispatched = await runCheck(page, "snapshot", "http://127.0.0.1:3201", "staging");
  assert.equal(dispatched?.products.length, 1);
  assert.equal(dispatched?.environment, "staging");
  await assert.rejects(runCheck(page, "snapshot", "https://example.com", "staging"), /isolated/);
  console.log(
    "PASS: demo snapshot collection detects price/metadata drift, rejects malformed or failed pages, cleans listeners and recovers",
  );
} finally {
  await browser.close();
}
