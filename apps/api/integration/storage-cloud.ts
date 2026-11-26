import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { storage } from "../src/storage.js";
import { readConfig } from "../src/config.js";

const config = readConfig({
  ...process.env,
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
  JWT_SECRET: "unused-cloud-storage-test-secret-".repeat(2),
});
assert.ok(config.S3_ENDPOINT?.startsWith("https://"), "HTTPS storage endpoint required");
const store = storage(config);
assert.ok(store, "Storage credentials required");
const client = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
  },
});
const Key = `verification/${randomUUID()}/pixel.png`;
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
try {
  assert.equal(await store.verify(Key, "image/png", bytes.length), false);
  const upload = await store.upload(Key, "image/png", bytes.length);
  assert.equal(new URL(upload).searchParams.get("X-Amz-Expires"), "300");
  const sent = await fetch(upload, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(sent.status, 200, `Upload status ${sent.status}`);
  assert.equal(await store.verify(Key, "image/png", bytes.length), true);
  assert.equal(await store.verify(Key, "image/png", bytes.length + 1), false);
  assert.equal(await store.verify(Key, "image/jpeg", bytes.length), false);
  const download = await store.download(Key);
  assert.equal(new URL(download).searchParams.get("X-Amz-Expires"), "300");
  const received = await fetch(download, { signal: AbortSignal.timeout(30000) });
  assert.equal(received.status, 200);
  assert.deepEqual(Buffer.from(await received.arrayBuffer()), bytes);
  console.log("PASS: signed PUT/GET, 300s expiry, exact bytes, metadata validation");
  const unsigned = new URL(download);
  unsigned.search = "";
  const tampered = new URL(download);
  tampered.searchParams.set("X-Amz-Signature", "0".repeat(64));
  for (const [name, url] of [
    ["unsigned", unsigned],
    ["tampered", tampered],
  ] as const) {
    const result = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.equal(result.status, 403, `${name} access must be forbidden`);
    console.log(`PASS: ${name} request rejected with ${result.status}`);
  }
} finally {
  // Delete only this run's uniquely named object, never the existing bucket.
  await client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key }));
  client.destroy();
  console.log("PASS: verification object removed");
}
