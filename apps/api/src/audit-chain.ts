import { createHash } from "node:crypto";
import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1).max(100);
const payloadSchema = z
  .object({
    projectId: id,
    releaseId: id,
    gateId: id,
    actorId: id,
    actorName: z.string().trim().min(1).max(100),
    action: z.enum(["APPROVED", "REVOKED"]),
    comment: z.string().trim().min(1).max(4000),
    timestamp: z.string().datetime(),
    policyVersion: z.literal("mvp-1"),
    evidenceHash: hash,
    gateRevision: z.number().int().nonnegative(),
  })
  .strict();
export type AuditPayload = z.infer<typeof payloadSchema>;
const recordSchema = z
  .object({
    version: z.literal(1),
    sequence: z.number().int().positive(),
    previousHash: hash.nullable(),
    payload: payloadSchema,
    hash,
  })
  .strict();
export type AuditRecord = z.infer<typeof recordSchema>;

function digest(sequence: number, previousHash: string | null, payload: AuditPayload) {
  // Fixed field order and a format domain separate this chain from other hashes.
  const fields = [
    "driftgate-signoff-v1",
    sequence,
    previousHash,
    payload.projectId,
    payload.releaseId,
    payload.gateId,
    payload.actorId,
    payload.actorName,
    payload.action,
    payload.comment,
    payload.timestamp,
    payload.policyVersion,
    payload.evidenceHash,
    payload.gateRevision,
  ];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

/** Caller must authorize the approver and serialize persistence; this is not an authorization API. */
export function appendAuditRecord(input: unknown, previous: AuditRecord | null): AuditRecord {
  const payload = payloadSchema.parse(input);
  const prior = previous === null ? null : recordSchema.parse(previous);
  if (
    prior &&
    (prior.hash !== digest(prior.sequence, prior.previousHash, prior.payload) ||
      prior.payload.projectId !== payload.projectId ||
      prior.payload.releaseId !== payload.releaseId)
  )
    throw new Error("Invalid audit predecessor");
  if (prior && Date.parse(payload.timestamp) < Date.parse(prior.payload.timestamp))
    throw new Error("Audit timestamps must be ordered");
  const sequence = (prior?.sequence ?? 0) + 1;
  const previousHash = prior?.hash ?? null;
  return {
    version: 1,
    sequence,
    previousHash,
    payload,
    hash: digest(sequence, previousHash, payload),
  };
}

/** A separately retained head detects tail truncation; a chain alone cannot prove completeness. */
export function verifyAuditChain(
  input: unknown,
  expected: {
    projectId: string;
    releaseId: string;
    count: number;
    headHash: string | null;
  },
) {
  const parsed = z.array(recordSchema).safeParse(input);
  if (!parsed.success) return { valid: false, reason: "INVALID_RECORD" } as const;
  if (parsed.data.length !== expected.count)
    return { valid: false, reason: "COUNT_MISMATCH" } as const;
  let previous: AuditRecord | null = null;
  for (const [index, record] of parsed.data.entries()) {
    if (
      record.payload.projectId !== expected.projectId ||
      record.payload.releaseId !== expected.releaseId
    )
      return { valid: false, reason: "SCOPE_MISMATCH" } as const;
    if (record.sequence !== index + 1 || record.previousHash !== (previous?.hash ?? null))
      return { valid: false, reason: "BROKEN_LINK" } as const;
    if (record.hash !== digest(record.sequence, record.previousHash, record.payload))
      return { valid: false, reason: "HASH_MISMATCH" } as const;
    if (previous && Date.parse(record.payload.timestamp) < Date.parse(previous.payload.timestamp))
      return { valid: false, reason: "TIME_ORDER" } as const;
    previous = record;
  }
  if ((previous?.hash ?? null) !== expected.headHash)
    return { valid: false, reason: "HEAD_MISMATCH" } as const;
  return { valid: true, count: parsed.data.length, headHash: previous?.hash ?? null } as const;
}
