import { readFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Evidence } from "./schema.js";
export interface EvidenceStore {
  put(path: string, key: string, kind: Evidence["kind"]): Promise<Evidence>;
}
const contentTypes = { screenshot: "image/png", video: "video/webm", trace: "application/zip" };
export function safeKey(key: string): void {
  if (!/^runs\/[A-Za-z0-9_/-]+\.(png|webm|zip)$/.test(key) || key.includes(".."))
    throw new Error("Invalid evidence key");
}
export async function createStore(env: NodeJS.ProcessEnv, local: boolean): Promise<EvidenceStore> {
  if (local) {
    const root = resolve(env.RUNNER_EVIDENCE_DIR ?? "runner-evidence");
    return {
      async put(path, key, kind) {
        safeKey(key);
        const destination = resolve(root, key);
        if (!destination.startsWith(root + sep)) throw new Error("Invalid evidence destination");
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(path, destination);
        return { kind, key, contentType: contentTypes[kind], size: (await readFile(path)).length };
      },
    };
  }
  if (
    !env.RUNNER_S3_BUCKET ||
    !env.RUNNER_S3_ENDPOINT ||
    new URL(env.RUNNER_S3_ENDPOINT).protocol !== "https:"
  )
    throw new Error("S3 configuration required");
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    endpoint: env.RUNNER_S3_ENDPOINT,
    forcePathStyle: true,
    region: env.RUNNER_S3_REGION ?? "auto",
    maxAttempts: 3,
  });
  return {
    async put(path, key, kind) {
      safeKey(key);
      const body = await readFile(path);
      if (body.length > 100 * 1024 * 1024) throw new Error("Evidence too large");
      await client.send(
        new PutObjectCommand({
          Bucket: env.RUNNER_S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentTypes[kind],
        }),
        { abortSignal: AbortSignal.timeout(30000) },
      );
      return { kind, key, contentType: contentTypes[kind], size: body.length };
    },
  };
}
