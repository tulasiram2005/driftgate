import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { Prisma, PrismaClient, ReleaseSignoff } from "../generated/client/index.js";
import { collectReleaseReadiness } from "./release-readiness.js";
import { renderReleaseReport } from "./release-report.js";

const environments = ["STAGING", "UAT", "PREPROD", "PROD"] as const;
const id = z.string().min(1).max(100);
export const signoffBody = z
  .object({
    gateRevision: z.number().int().nonnegative(),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
    comment: z.string().trim().min(1).max(2000),
  })
  .strict();

export function signoffHash(record: Omit<ReleaseSignoff, "hash">): string {
  // Explicit field order makes verification independent of database object ordering.
  return createHash("sha256")
    .update(
      JSON.stringify([
        "driftgate-release-signoff-v1",
        record.id,
        record.releaseId,
        record.sequence,
        record.environment,
        record.gateRevision,
        record.evidenceHash,
        record.policyVersion,
        record.approverId,
        record.approverName,
        record.comment,
        record.createdAt.toISOString(),
        record.precedingGateSignoffId,
        record.previousHash,
      ]),
    )
    .digest("hex");
}

export function verifySignoffs(records: ReleaseSignoff[], expectedCount: number) {
  let previousHash: string | null = null;
  for (const [index, record] of records.entries()) {
    if (
      record.sequence !== index + 1 ||
      record.previousHash !== previousHash ||
      record.hash !== signoffHash(record)
    )
      return { valid: false, count: records.length, firstInvalidSequence: index + 1 };
    previousHash = record.hash;
  }
  return {
    valid: records.length === expectedCount,
    count: records.length,
    firstInvalidSequence: records.length === expectedCount ? null : records.length + 1,
  };
}

export async function collectApprovals(
  tx: Prisma.TransactionClient,
  projectId: string,
  releaseId: string,
) {
  const release = await tx.release.findFirst({ where: { id: releaseId, projectId } });
  if (!release) return null;
  const records = await tx.releaseSignoff.findMany({
    where: { releaseId },
    orderBy: { sequence: "asc" },
    take: 1001,
  });
  const verification = verifySignoffs(records, release.approvalRevision);
  let precedingId: string | null = null;
  let precedingValid = true;
  const gates = [];
  for (const environment of environments) {
    const readiness = await collectReleaseReadiness(tx, projectId, releaseId, environment);
    const signoff =
      [...records].reverse().find((record) => record.environment === environment) ?? null;
    const current: boolean =
      verification.valid &&
      precedingValid &&
      !!signoff &&
      !!readiness &&
      readiness.eligible &&
      signoff.evidenceHash === readiness.evidenceHash &&
      signoff.gateRevision === readiness.gateRevision &&
      signoff.precedingGateSignoffId === precedingId;
    gates.push({ environment, readiness, signoff, current, precedingValid });
    precedingId = signoff?.id ?? null;
    precedingValid = current;
  }
  return { verification, gates, records, revision: release.approvalRevision };
}

export function mountReleaseSignoffs(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const base = "/api/v1/projects/:projectId/releases/:releaseId";
  app.get(`${base}/report.pdf`, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const releaseId = id.parse(req.params.releaseId);
    const input = await db.$transaction(
      async (tx) => {
        const release = await tx.release.findFirst({
          where: { id: releaseId, projectId },
          include: { project: { select: { name: true } } },
        });
        if (!release) return fail(404, "NOT_FOUND", "Release not found");
        const approvals = await collectApprovals(tx, projectId, releaseId);
        if (!approvals) return fail(404, "NOT_FOUND", "Release not found");
        const defects = await tx.defect.findMany({
          where: { projectId },
          orderBy: { id: "asc" },
          take: 1001,
          select: { id: true, title: true, severity: true, status: true },
        });
        const references = approvals.gates.reduce(
          (total, gate) =>
            total +
            Object.values(gate.readiness?.evidence ?? {}).reduce(
              (count, source) =>
                count +
                (source && typeof source === "object" && "sourceIds" in source
                  ? source.sourceIds.length
                  : 0),
              0,
            ),
          0,
        );
        if (defects.length > 1000 || approvals.records.length > 200 || references > 4000)
          return fail(
            422,
            "REPORT_LIMIT",
            "Release exceeds PDF export limits; use the in-app evidence and audit views",
          );
        return {
          name: release.name,
          projectName: release.project.name,
          releaseId,
          generatedAt: new Date(),
          approvals,
          defects,
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
    const pdf = await renderReleaseReport(input);
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="driftgate-release.pdf"',
        "Cache-Control": "no-store",
      })
      .send(pdf);
  });
  app.get(`${base}/signoffs`, guard(), async (req, res) => {
    const data = await db.$transaction(
      (tx) => collectApprovals(tx, id.parse(req.params.projectId), id.parse(req.params.releaseId)),
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
    if (!data) return fail(404, "NOT_FOUND", "Release not found");
    res.json({ data });
  });
  app.post(`${base}/gates/:environment/signoff`, guard(), async (req, res) => {
    if (res.locals.role !== "APPROVER")
      return fail(403, "FORBIDDEN", "A project Approver must sign off");
    const projectId = id.parse(req.params.projectId);
    const releaseId = id.parse(req.params.releaseId);
    const environment = z.enum(environments).parse(req.params.environment);
    const body = signoffBody.parse(req.body);
    try {
      const data = await db.$transaction(
        async (tx) => {
          const state = await collectApprovals(tx, projectId, releaseId);
          if (!state) return fail(404, "NOT_FOUND", "Release not found");
          if (!state.verification.valid)
            return fail(409, "INVALID_CHAIN", "Release audit verification failed");
          if (state.records.length >= 1000)
            return fail(409, "AUDIT_LIMIT", "Release approval history limit reached");
          const gate = state.gates.find((item) => item.environment === environment)!;
          if (!gate.precedingValid)
            return fail(409, "PREVIOUS_GATE", "Earlier gates require current approvals");
          if (!gate.readiness?.eligible)
            return fail(409, "NOT_READY", "Release gate does not meet its exit criteria");
          if (
            body.gateRevision !== gate.readiness.gateRevision ||
            body.evidenceHash !== gate.readiness.evidenceHash
          )
            return fail(409, "STALE_EVIDENCE", "Evidence changed; check readiness again");
          if (gate.current)
            return fail(409, "ALREADY_APPROVED", "This evidence already has a current approval");
          const approver = await tx.user.findUniqueOrThrow({
            where: { id: res.locals.userId as string },
          });
          const preceding = state.gates[environments.indexOf(environment) - 1];
          const record = {
            id: randomUUID(),
            releaseId,
            sequence: state.revision + 1,
            environment,
            gateRevision: body.gateRevision,
            evidenceHash: body.evidenceHash,
            policyVersion: gate.readiness.policyVersion,
            approverId: approver.id,
            approverName: approver.name,
            comment: body.comment,
            createdAt: new Date(),
            precedingGateSignoffId: preceding?.signoff?.id ?? null,
            previousHash: state.records.at(-1)?.hash ?? null,
          };
          // A shared revision serializes concurrent approvals without automatic retries.
          await tx.release.update({
            where: { id: releaseId },
            data: { approvalRevision: { increment: 1 } },
          });
          return tx.releaseSignoff.create({ data: { ...record, hash: signoffHash(record) } });
        },
        { isolationLevel: "Serializable", timeout: 15000 },
      );
      res.json({ data });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2034")
        return fail(409, "CONFLICT", "Release evidence changed; refresh before signing");
      throw error;
    }
  });
}
