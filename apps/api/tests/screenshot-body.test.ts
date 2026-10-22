import { expect, it } from "vitest";
import { readScreenshotBody } from "../src/storage.js";

async function* chunks(...values: number[][]) {
  for (const value of values) yield Uint8Array.from(value);
}
it("reads exact screenshot bytes across chunks", async () => {
  expect(await readScreenshotBody(chunks([1, 2], [3]), 3, new AbortController().signal)).toEqual(
    Buffer.from([1, 2, 3]),
  );
});
it("rejects excess, truncated and invalid sizes", async () => {
  const signal = new AbortController().signal;
  await expect(readScreenshotBody(chunks([1, 2]), 1, signal)).rejects.toThrow("exceeds");
  await expect(readScreenshotBody(chunks([1]), 2, signal)).rejects.toThrow("truncated");
  for (const size of [0, -1, 1.5, 16 * 1024 * 1024 + 1, NaN])
    await expect(readScreenshotBody(chunks(), size, signal)).rejects.toThrow("Invalid");
});
it("aborts stalled reads and closes the iterator", async () => {
  const controller = new AbortController();
  let closed = false;
  const body = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise<IteratorResult<Uint8Array>>(() => {}),
        return: async () => {
          closed = true;
          return { done: true as const, value: undefined };
        },
      };
    },
  };
  const result = readScreenshotBody(body, 1, controller.signal);
  controller.abort();
  await expect(result).rejects.toThrow("aborted");
  expect(closed).toBe(true);
});
it("rejects an already aborted read", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(readScreenshotBody(chunks([1]), 1, controller.signal)).rejects.toThrow();
});
