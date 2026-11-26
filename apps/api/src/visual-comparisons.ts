import { randomUUID } from "node:crypto";
import { z } from "zod";
import { compareScreenshots } from "@driftgate/drift/visual-png";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import type { EvidenceStorage } from "./storage.js";
import { ignoreRegionsSchema } from "./visual-baselines.js";

const id = z.string().min(1).max(100);
export const visualComparisonBody = z.object({ evidenceId: id }).strict();
export const visualReviewBody = z
  .object({
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    comment: z.string().trim().min(1).max(2000),
  })
  .strict();
export function mountVisualComparisons(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
  storage?: EvidenceStorage,
) {
  const base = "/api/v1/projects/:projectId/visual-comparisons";
  app.post(`${base}/:comparisonId/review`, guard(), async (req, res) => {
    if (!["ADMIN", "APPROVER"].includes(res.locals.role as string))
      return fail(403, "FORBIDDEN", "An Admin or Approver must review visual differences");
    const projectId = id.parse(req.params.projectId);
    const comparisonId = id.parse(req.params.comparisonId);
    const body = visualReviewBody.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const found = await tx.visualComparison.findFirst({
        where: { id: comparisonId, projectId },
        include: { baseline: true },
      });
      if (!found) return fail(404, "NOT_FOUND", "Comparison not found");
      if (
        !found.baseline.active ||
        found.baseline.status !== "APPROVED" ||
        found.ignoreRevision !== found.baseline.ignoreRevision
      )
        return fail(
          409,
          "STALE_COMPARISON",
          "Baseline settings changed; compare again before reviewing",
        );
      const changed = await tx.visualComparison.updateMany({
        where: { id: comparisonId, projectId, reviewDecision: null },
        data: {
          reviewDecision: body.decision,
          reviewComment: body.comment,
          reviewedBy: res.locals.userId as string,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        return fail(
          409,
          "CONFLICT",
          "Comparison already reviewed; create a new comparison for another decision",
        );
      return tx.visualComparison.findUniqueOrThrow({
        where: { id: comparisonId },
        omit: { diffKey: true },
      });
    });
    res.json({ data });
  });
  // Bound memory-heavy decoding to one in-flight comparison per API process.
  let busy = false;
  app.post(base, guard(true), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const body = visualComparisonBody.parse(req.body);
    if (!storage?.readScreenshot || !storage.writeScreenshot)
      return fail(503, "UNAVAILABLE", "Screenshot comparison storage is unavailable");
    if (busy) return fail(429, "BUSY", "Another screenshot comparison is running. Please retry.");
    busy = true;
    try {
      const current = await db.evidence.findFirst({
        where: {
          id: body.evidenceId,
          ready: true,
          kind: "screenshot",
          contentType: "image/png",
          result: { run: { projectId, mode: "AUTOMATED" } },
        },
        include: { result: { include: { run: true } } },
      });
      if (!current) return fail(404, "NOT_FOUND", "Ready automated screenshot not found");
      const { result } = current;
      if (!["desktop", "mobile"].includes(result.device))
        return fail(400, "INVALID_INPUT", "Unknown runner viewport");
      const width = result.device === "mobile" ? 390 : 1280;
      const height = result.device === "mobile" ? 844 : 900;
      const baseline = await db.visualBaseline.findFirst({
        where: {
          projectId,
          active: true,
          status: "APPROVED",
          environment: result.run.environment,
          browser: result.browser,
          device: result.device,
          checkId: result.caseId,
          viewportWidth: width,
          viewportHeight: height,
        },
        include: { evidence: true },
      });
      if (!baseline)
        return fail(409, "NO_BASELINE", "Approve and activate a matching baseline first");
      if (baseline.evidenceId === current.id)
        return fail(400, "INVALID_INPUT", "Select a new screenshot, not the baseline itself");
      if (!baseline.evidence.ready) return fail(409, "CONFLICT", "Baseline evidence is not ready");
      let before: Buffer;
      let after: Buffer;
      try {
        before = await storage.readScreenshot(baseline.evidence.key, baseline.evidence.sizeBytes);
        after = await storage.readScreenshot(current.key, current.sizeBytes);
      } catch {
        return fail(502, "STORAGE_ERROR", "Screenshot evidence could not be read. Please retry.");
      }
      let comparison: ReturnType<typeof compareScreenshots>;
      try {
        comparison = compareScreenshots(
          before,
          after,
          ignoreRegionsSchema.parse(baseline.ignoreRegions),
        );
        if (comparison.width !== width || comparison.height !== height)
          throw new Error("Viewport mismatch");
      } catch {
        return fail(
          422,
          "INVALID_SCREENSHOT",
          "Screenshots must be valid PNGs matching the baseline viewport",
        );
      }
      const diffKey = `visual/${projectId}/${randomUUID()}.png`;
      try {
        await storage.writeScreenshot(diffKey, comparison.diffPng);
      } catch {
        return fail(502, "STORAGE_ERROR", "Difference image could not be saved. Please retry.");
      }
      const saved = await db.visualComparison.create({
        data: {
          projectId,
          baselineId: baseline.id,
          evidenceId: current.id,
          createdBy: res.locals.userId as string,
          width,
          height,
          changedPixels: comparison.changedPixels,
          comparedPixels: comparison.comparedPixels,
          ignoreRegions: baseline.ignoreRegions as {
            x: number;
            y: number;
            width: number;
            height: number;
          }[],
          ignoreRevision: baseline.ignoreRevision,
          ignoredPixels: comparison.ignoredPixels,
          diffKey,
        },
        omit: { diffKey: true },
      });
      res.json({ data: saved });
    } finally {
      busy = false;
    }
  });
  app.get(base, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const query = z
      .object({ cursor: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) })
      .strict()
      .parse(req.query);
    if (
      query.cursor &&
      !(await db.visualComparison.findFirst({ where: { projectId, id: query.cursor } }))
    )
      return fail(404, "NOT_FOUND", "Comparison cursor not found");
    const rows = await db.visualComparison.findMany({
      where: { projectId },
      omit: { diffKey: true },
      include: { baseline: { select: { label: true, browser: true, environment: true } } },
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/:comparisonId/url`, guard(), async (req, res) => {
    const found = await db.visualComparison.findFirst({
      where: { projectId: id.parse(req.params.projectId), id: id.parse(req.params.comparisonId) },
    });
    if (!found) return fail(404, "NOT_FOUND", "Comparison not found");
    if (!storage) return fail(503, "UNAVAILABLE", "Evidence storage is unavailable");
    res.set("Cache-Control", "no-store");
    res.json({ data: { url: await storage.download(found.diffKey) } });
  });
}
