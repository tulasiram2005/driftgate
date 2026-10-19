import { afterEach, expect, it, vi } from "vitest";
import { checkoutKey } from "../src/lib/checkout-key";

afterEach(() => vi.unstubAllGlobals());

it("creates an idempotency key when randomUUID is unavailable on HTTP", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.map((_, index) => index),
  });
  expect(checkoutKey()).toBe("000102030405060708090a0b0c0d0e0f");
});

it("uses distinct random keys for separate checkout attempts", () => {
  expect(checkoutKey()).toMatch(/^[a-f0-9]{32}$/);
  expect(checkoutKey()).not.toBe(checkoutKey());
});
