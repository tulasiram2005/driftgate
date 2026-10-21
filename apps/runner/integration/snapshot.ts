import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { collectThreadlineSnapshot } from "../src/snapshot.js";
import { compareEnvironments } from "../src/drift.js";

// Fully intercepted demo fixture: no external or local server traffic is allowed.
const browser = await chromium.launch();
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
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head>
        <title>Demo product</title><link rel="canonical" href="${url.href}">
        <script type="application/ld+json">${JSON.stringify(metadata)}</script></head><body>
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
  console.log(
    "PASS: demo snapshot collection captures broken images, metadata and rendered-price drift",
  );
} finally {
  await browser.close();
}
