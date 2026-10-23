import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const envelope = z
  .object({
    version: z.literal(1),
    iv: z.string().regex(/^[a-f0-9]{24}$/),
    tag: z.string().regex(/^[a-f0-9]{32}$/),
    ciphertext: z
      .string()
      .min(2)
      .max(32768)
      .regex(/^(?:[a-f0-9]{2})+$/),
  })
  .strict();

function keyBytes(key: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error("Integration encryption key must be 32 bytes encoded as hex");
  }
  return Buffer.from(key, "hex");
}

function context(projectId: string, provider: string): Buffer {
  if (!projectId || !provider) throw new Error("Integration context is required");
  // Authenticated context prevents moving a valid ciphertext to another tenant/provider.
  return Buffer.from(JSON.stringify(["driftgate-integration", 1, projectId, provider]));
}

export function encryptIntegrationSecret(
  secret: string,
  key: string,
  projectId: string,
  provider: string,
): string {
  if (!secret || Buffer.byteLength(secret) > 16384) {
    throw new Error("Integration secret must contain between 1 and 16384 bytes");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(context(projectId, provider));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  });
}

export function decryptIntegrationSecret(
  encrypted: string,
  key: string,
  projectId: string,
  provider: string,
): string {
  const bytes = keyBytes(key);
  const aad = context(projectId, provider);
  try {
    if (encrypted.length > 33000) throw new Error("Invalid envelope");
    const data = envelope.parse(JSON.parse(encrypted));
    const decipher = createDecipheriv("aes-256-gcm", bytes, Buffer.from(data.iv, "hex"));
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(data.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(data.ciphertext, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Never expose ciphertext, tokens, or parser diagnostics through API errors/logs.
    throw new Error("Unable to decrypt integration secret");
  }
}
