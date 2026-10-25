import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import { compareEnvironments, type EnvironmentSnapshot } from "@driftgate/drift";
import { snapshotBody } from "./snapshots.js";
import { rateLimit } from "express-rate-limit";

const identifier = z.string().min(1).max(100);
const expectedRule = z
  .object({
    field: z.enum([
      "product",
      "productCount",
      "price",
      "compareAt",
      "currency",
      "size",
      "stock",
      "discountPercent",
      "badge",
      "image.status",
      "image.width",
      "image.height",
      "title",
      "canonical",
      "jsonLd",
    ]),
    productId: identifier.nullable(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .refine(
    (r) => (r.field === "productCount") === (r.productId === null),
    "Only productCount rules use a null product ID",
  );
export const comparisonBody = z
  .object({
    beforeId: identifier,
    afterId: identifier,
    expectedRules: z
      .array(expectedRule)
      .max(100)
      .default([])
      .refine(
        (rules) =>
          new Set(rules.map((r) => JSON.stringify([r.field, r.productId]))).size === rules.length,
        "Duplicate expected-difference rule",
      ),
  })
  .strict();
const queryBody = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: identifier.optional(),
  })
  .strict();
const environment = z.enum(["staging", "uat", "preprod", "prod"]);
export const savedRulesBody = z
  .object({
    revision: z.number().int().nonnegative(),
    environments: z.tuple([environment, environment]).refine(([a, b]) => a !== b),
    rules: comparisonBody.shape.expectedRules,
  })
  .strict();
const pairKey = (a: string, b: string) => [a, b].sort().join(":");
const ruleSets = z.record(z.string(), z.array(expectedRule).max(100));
export function mountComparisons(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const base = "/api/v1/projects/:projectId/comparisons";
  const rulesPath = "/api/v1/projects/:projectId/expected-rules";
  app.get(rulesPath, guard(), async (req, res) => {
    const project = await db.project.findUniqueOrThrow({
      where: { id: identifier.parse(req.params.projectId) },
    });
    res.json({ data: { revision: project.expectedRulesRevision, sets: project.expectedRuleSets } });
  });
  app.put(rulesPath, guard(true), async (req, res) => {
    const body = savedRulesBody.parse(req.body);
    const projectId = identifier.parse(req.params.projectId);
    const data = await db.$transaction(async (tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
      const sets = ruleSets.parse(project.expectedRuleSets);
      sets[pairKey(...body.environments)] = body.rules;
      const result = await tx.project.updateMany({
        where: { id: projectId, expectedRulesRevision: body.revision },
        data: {
          expectedRuleSets: JSON.parse(JSON.stringify(sets)),
          expectedRulesRevision: { increment: 1 },
        },
      });
      if (!result.count) fail(409, "CONFLICT", "Rules changed. Reload before saving.");
      return { revision: body.revision + 1, sets };
    });
    res.json({ data });
  });
  const limit = rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post(base, guard(true), limit, async (req, res) => {
    const body = comparisonBody.parse(req.body);
    const projectId = identifier.parse(req.params.projectId);
    const data = await db.$transaction(async (tx) => {
      const before = await tx.environmentSnapshot.findFirst({
        where: { id: body.beforeId, projectId },
      });
      const after = await tx.environmentSnapshot.findFirst({
        where: { id: body.afterId, projectId },
      });
      if (!before || !after) fail(404, "NOT_FOUND", "Snapshot not found in this project");
      if (before.environment === after.environment)
        fail(400, "INVALID_INPUT", "Choose distinct environments");
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
      const saved =
        ruleSets.parse(project.expectedRuleSets)[pairKey(before.environment, after.environment)] ??
        [];
      const merged = new Map(
        saved.map((rule) => [JSON.stringify([rule.field, rule.productId]), rule]),
      );
      for (const rule of body.expectedRules)
        merged.set(JSON.stringify([rule.field, rule.productId]), rule);
      const appliedRules = [...merged.values()];
      if (appliedRules.length > 100)
        fail(400, "INVALID_INPUT", "Combined saved and one-off rules exceed 100");
      let findings;
      try {
        const left = snapshotBody.parse({
          label: before.label,
          snapshot: before.snapshot,
        }).snapshot;
        const right = snapshotBody.parse({ label: after.label, snapshot: after.snapshot }).snapshot;
        // JSON roundtrip removes optional undefined properties before strict engine input.
        findings = compareEnvironments(
          JSON.parse(JSON.stringify(left)) as EnvironmentSnapshot,
          JSON.parse(JSON.stringify(right)) as EnvironmentSnapshot,
          appliedRules.map((rule) => ({
            ...rule,
            environments: [left.environment, right.environment] as const,
          })),
        );
      } catch {
        return fail(400, "INVALID_INPUT", "Snapshot contains values that cannot be compared");
      }
      return tx.environmentComparison.create({
        data: {
          projectId,
          beforeId: body.beforeId,
          afterId: body.afterId,
          expectedRules: JSON.parse(JSON.stringify(appliedRules)),
          rulesRevision: project.expectedRulesRevision,
          source:
            before.source === "RUNNER" && after.source === "RUNNER" ? "RUNNER" : "MANUAL_IMPORT",
          createdBy: res.locals.userId as string,
          findingCount: findings.length,
          findings: JSON.parse(JSON.stringify(findings)),
        },
      });
    });
    res.json({ data });
  });
  app.get(base, guard(), async (req, res) => {
    const projectId = identifier.parse(req.params.projectId);
    const query = queryBody.parse(req.query);
    if (
      query.cursor &&
      !(await db.environmentComparison.findFirst({
        where: { id: query.cursor, projectId },
        select: { id: true },
      }))
    )
      fail(404, "NOT_FOUND", "Comparison cursor not found");
    const rows = await db.environmentComparison.findMany({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        beforeId: true,
        afterId: true,
        source: true,
        createdBy: true,
        createdAt: true,
        findingCount: true,
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/:comparisonId`, guard(), async (req, res) => {
    const data = await db.environmentComparison.findFirst({
      where: {
        id: identifier.parse(req.params.comparisonId),
        projectId: identifier.parse(req.params.projectId),
      },
    });
    if (!data) fail(404, "NOT_FOUND", "Comparison not found");
    res.json({ data });
  });
}
