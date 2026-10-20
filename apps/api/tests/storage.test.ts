import { expect, test } from "vitest";
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
