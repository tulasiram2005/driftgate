import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Config } from "./config.js";

export interface EvidenceStorage {
  writeScreenshot?(key: string, body: Buffer): Promise<void>;
  readScreenshot?(key: string, expectedSize: number): Promise<Buffer>;
  upload(key: string, contentType: string, size: number): Promise<string>;
  download(key: string): Promise<string>;
  verify(key: string, contentType: string, size: number): Promise<boolean>;
}
export function storage(config: Config): EvidenceStorage | undefined {
  if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) return;
  const client = new S3Client({
    // Upload bodies arrive later from the browser, so no checksum can be computed here.
    requestChecksumCalculation: "WHEN_REQUIRED",
    region: config.S3_REGION,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
    forcePathStyle: Boolean(config.S3_ENDPOINT),
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
  const Bucket = config.S3_BUCKET;
  return {
    async writeScreenshot(Key, Body) {
      if (!Body.length || Body.length > MAX_SCREENSHOT_BYTES)
        throw new Error("Invalid screenshot size");
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body,
          ContentType: "image/png",
          ContentLength: Body.length,
        }),
        {
          abortSignal: AbortSignal.timeout(15000),
        },
      );
    },
    async readScreenshot(Key, expectedSize) {
      if (
        !Number.isSafeInteger(expectedSize) ||
        expectedSize < 1 ||
        expectedSize > MAX_SCREENSHOT_BYTES
      )
        throw new Error("Invalid screenshot size");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const object = await client.send(new GetObjectCommand({ Bucket, Key }), {
          abortSignal: controller.signal,
        });
        if (
          object.ContentType !== "image/png" ||
          object.ContentLength !== expectedSize ||
          !object.Body
        )
          throw new Error("Stored screenshot metadata does not match evidence");
        return await readScreenshotBody(
          object.Body as AsyncIterable<Uint8Array>,
          expectedSize,
          controller.signal,
        );
      } finally {
        controller.abort();
        clearTimeout(timer);
      }
    },
    upload: (Key, ContentType, ContentLength) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength }), {
        expiresIn: 300,
      }),
    download: (Key) =>
      getSignedUrl(
        client,
        new GetObjectCommand({ Bucket, Key, ResponseContentDisposition: "attachment" }),
        { expiresIn: 300 },
      ),
    async verify(Key, contentType, size) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
        return head.ContentLength === size && head.ContentType === contentType;
      } catch (error) {
        if (
          error instanceof Error &&
          "$metadata" in error &&
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
        )
          return false;
        throw error;
      }
    },
  };
}

const MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;

export async function readScreenshotBody(
  body: AsyncIterable<Uint8Array>,
  expectedSize: number,
  signal: AbortSignal,
): Promise<Buffer> {
  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 1 ||
    expectedSize > MAX_SCREENSHOT_BYTES
  )
    throw new Error("Invalid screenshot size");
  signal.throwIfAborted();
  const iterator = body[Symbol.asyncIterator]();
  const output = Buffer.alloc(expectedSize);
  let size = 0;
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Screenshot read aborted"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    while (true) {
      const chunk = await Promise.race([iterator.next(), cancelled]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > expectedSize) throw new Error("Screenshot body exceeds recorded size");
      output.set(chunk.value, size - chunk.value.byteLength);
    }
    if (size !== expectedSize) throw new Error("Screenshot body is truncated");
    return output;
  } finally {
    signal.removeEventListener("abort", abort);
    // Do not wait for a stalled stream's return; the storage caller aborts transport.
    void iterator.return?.().catch(() => {});
  }
}
