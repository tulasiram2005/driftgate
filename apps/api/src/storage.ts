import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Config } from "./config.js";

export interface EvidenceStorage {
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
