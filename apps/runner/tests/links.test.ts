import { test } from "node:test";
import assert from "node:assert/strict";
import { linkTargets } from "../src/links.js";
const origin = "http://127.0.0.1:3201";
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
