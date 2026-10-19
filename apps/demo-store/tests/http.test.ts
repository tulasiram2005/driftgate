import { expect, it } from "vitest";
import { readBody, respond } from "../src/lib/http";
import { cartSchema } from "../src/lib/cart";
const context = { params: Promise.resolve({ environment: "staging" }) };
it("returns data and disables caching", async () => {
  const response = await respond(context, async () => ({ ok: true }));
  expect(await response.json()).toEqual({ data: { ok: true } });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("sanitizes unexpected failures and validates environment", async () => {
  const response = await respond(context, async () => {
    throw new Error("secret database password");
  });
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("password");
  expect(
    (await respond({ params: Promise.resolve({ environment: "unknown" }) }, async () => null))
      .status,
  ).toBe(404);
});
it("maps Zod errors into the error contract", async () => {
  const response = await respond(context, async () => cartSchema.parse({ items: "bad" }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
});
it("rejects malformed, oversized and non-JSON requests", async () => {
  for (const body of ["{", " ".repeat(16385)])
    await expect(
      readBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  await expect(
    readBody(new Request("http://localhost", { method: "POST", body: "{}" })),
  ).rejects.toMatchObject({ status: 400 });
});
