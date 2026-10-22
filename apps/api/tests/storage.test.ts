import { expect, test, vi } from "vitest";
import { S3Client } from "@aws-sdk/client-s3";
import { storage } from "../src/storage.js";
import { readConfig } from "../src/config.js";

test("presigns browser uploads without a checksum for an absent body", async () => {
  const config = readConfig({
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
    JWT_SECRET: "local-test-only-".repeat(4),
    S3_ENDPOINT: "https://storage.example.test",
    S3_REGION: "us-east-1",
    S3_BUCKET: "evidence",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
  });
  const url = new URL(await storage(config)!.upload("manual/test.png", "image/png", 68));
  expect(url.pathname).toBe("/evidence/manual/test.png");
  expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
  expect([...url.searchParams.keys()].some((key) => key.startsWith("x-amz-checksum-"))).toBe(false);
});

test("server screenshot read checks metadata and reads private object bytes", async () => {
  const config = readConfig({
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
    JWT_SECRET: "local-test-only-".repeat(4),
    S3_ENDPOINT: "https://storage.example.test",
    S3_REGION: "us-east-1",
    S3_BUCKET: "evidence",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
  });
  const mock = vi.spyOn(S3Client.prototype, "send");
  try {
    async function* body() {
      yield Buffer.from([1, 2, 3]);
    }
    mock.mockResolvedValue({ ContentType: "image/png", ContentLength: 3, Body: body() } as never);
    const store = storage(config)!;
    expect(await store.readScreenshot!("runs/demo.png", 3)).toEqual(Buffer.from([1, 2, 3]));
    mock.mockResolvedValue({ ContentType: "text/html", ContentLength: 3, Body: body() } as never);
    await expect(store.readScreenshot!("runs/demo.png", 3)).rejects.toThrow("metadata");
    mock.mockResolvedValue({ ContentType: "image/png", ContentLength: 4, Body: body() } as never);
    await expect(store.readScreenshot!("runs/demo.png", 3)).rejects.toThrow("metadata");
  } finally {
    mock.mockRestore();
  }
});
