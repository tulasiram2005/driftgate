import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLinks, linkTargets } from "../src/links.js";
import type { Page } from "@playwright/test";
const origin = "http://127.0.0.1:3201";
test("HTTP 200 product shells are checked against fixed product data and missing products fail", async () => {
  for (const status of [200, 404]) {
    const visited: string[] = [];
    let closed = false;
    const probe = {
      route: async () => {},
      goto: async (url: string, options: { waitUntil: string; timeout: number }) => {
        assert.equal(options.waitUntil, "domcontentloaded");
        assert.equal(options.timeout, 3000);
        visited.push(url);
        return { status: () => (url.includes("/api/") ? status : 200) };
      },
      close: async () => {
        closed = true;
      },
    };
    const page = {
      locator: () => ({ evaluateAll: async () => [`${origin}/staging/products/demo`] }),
      context: () => ({ newPage: async () => probe }),
    } as unknown as Page;
    if (status === 200) await checkLinks(page, origin, "staging");
    else await assert.rejects(checkLinks(page, origin, "staging"), /1 of 1/);
    assert.deepEqual(visited, [
      `${origin}/staging/products/demo`,
      `${origin}/api/staging/products/demo`,
    ]);
    assert.equal(closed, true);
  }
});
test("links stay in the exact origin and environment, deduplicate and ignore fragments", () => {
  assert.deepEqual(
    linkTargets(
      [
        "/staging/products/shirt#size",
        "/staging/products/shirt",
        "#top",
        "/prod/cart",
        "/staging-other",
        "https://example.test/staging",
        "mailto:a@example.test",
        "http://127.0.0.1:3202/staging",
        "/staging/../prod/cart",
      ],
      origin,
      "staging",
    ),
    [`${origin}/staging/products/shirt`],
  );
});
test("links reject invalid, credential-bearing and oversized input without fetching", () => {
  for (const hrefs of [
    ["http://[invalid"],
    ["http://secret:secret@127.0.0.1:3201/staging"],
    Array(101).fill("/staging"),
    Array.from({ length: 21 }, (_, i) => `/staging/p${i}`),
  ])
    assert.throws(() => linkTargets(hrefs, origin, "staging"));
});
