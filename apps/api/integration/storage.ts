import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { storage } from "../src/storage.js";
import { readConfig } from "../src/config.js";

// This destructive cleanup is restricted to a unique bucket on the local test service.
const endpoint = process.env.TEST_S3_ENDPOINT;
if (!endpoint || new URL(endpoint).hostname !== "127.0.0.1")
  throw new Error("TEST_S3_ENDPOINT must point to the isolated loopback storage service");
const Bucket = `driftgate-test-${randomUUID()}`;
const config = readConfig({
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused",
  JWT_SECRET: "unused-local-storage-test-secret-".repeat(2),
  S3_ENDPOINT: endpoint,
  S3_REGION: "us-east-1",
  S3_BUCKET: Bucket,
  S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY,
});
const client = new S3Client({
  endpoint,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID!,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
  },
});
const store = storage(config);
if (!store) throw new Error("Test storage credentials are required");
const Key = "manual/integration/screenshot.png";
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
await client.send(new CreateBucketCommand({ Bucket }));
try {
  assert.equal(await store.verify(Key, "image/png", bytes.length), false);
  const upload = await store.upload(Key, "image/png", bytes.length);
  assert.equal(new URL(upload).searchParams.get("X-Amz-Expires"), "300");
  const sent = await fetch(upload, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: bytes,
  });
  assert.equal(sent.status, 200, await sent.text());
  assert.equal(await store.verify(Key, "image/png", bytes.length), true);
  assert.equal(await store.verify(Key, "image/png", bytes.length + 1), false);
  assert.equal(await store.verify(Key, "image/jpeg", bytes.length), false);
  const download = await store.download(Key);
  assert.equal(new URL(download).searchParams.get("X-Amz-Expires"), "300");
  const received = await fetch(download);
  assert.equal(received.status, 200);
  assert.deepEqual(Buffer.from(await received.arrayBuffer()), bytes);
  console.log("PASS: signed PUT/GET, 300s expiry, exact bytes, missing/mismatched metadata");
  const unsigned = new URL(download);
  unsigned.search = "";
  const unsignedStatus = (await fetch(unsigned)).status;
  const tampered = new URL(download);
  tampered.searchParams.set("X-Amz-Signature", "0".repeat(64));
  const tamperedStatus = (await fetch(tampered)).status;
  if (process.env.TEST_S3_EMULATOR === "1") {
    console.log(
      `NOT VERIFIED: provider security (emulator unsigned=${unsignedStatus}, tampered=${tamperedStatus})`,
    );
  } else {
    assert.equal(unsignedStatus, 403);
    assert.equal(tamperedStatus, 403);
    console.log("PASS: private bucket and tampered signature rejection");
  }
} finally {
  await client.send(new DeleteObjectCommand({ Bucket, Key }));
  await client.send(new DeleteBucketCommand({ Bucket }));
  client.destroy();
}
