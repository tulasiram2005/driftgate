import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { Prisma, PrismaClient } from "../generated/client/index.js";
import { defectMetrics } from "./defect-metrics.js";

const id = z.string().min(1).max(100);
const status = z.enum(["NEW", "OPEN", "IN_PROGRESS", "FIXED", "RETEST", "CLOSED", "REOPENED"]);
export const defectBody = z
  .object({
    resultId: id,
    severity: z.enum(["S1", "S2", "S3", "S4"]),
  })
  .strict();
export const defectTransitionBody = z
  .object({
    status,
    revision: z.number().int().nonnegative(),
    comment: z.string().trim().min(1).max(4000),
  })
  .strict();
const transitions: Record<string, string[]> = {
  NEW: ["OPEN"],
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["FIXED"],
  FIXED: ["RETEST"],
  RETEST: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS"],
};

export function mountDefects(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const base = "/api/v1/projects/:projectId/defects";
  app.post(base, guard(true), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const body = defectBody.parse(req.body);
    const result = await db.result.findFirst({
      where: { id: body.resultId, run: { projectId } },
      include: {
        run: true,
        attempts: { where: { status: "FAIL" }, orderBy: { number: "desc" }, take: 1 },
        evidence: { where: { ready: true }, select: { id: true } },
      },
    });
    if (!result) return fail(404, "NOT_FOUND", "Test result not found");
    if (result.status !== "FAIL")
      return fail(409, "NOT_FAILED", "Only failed results can create defects");
    const actorId = res.locals.userId as string;
    // Snapshot reproduction details rather than mutable test-case definitions or signed URLs.
    const data = await db.defect.upsert({
      where: { projectId_resultId: { projectId, resultId: result.id } },
      update: {},
      create: {
        projectId,
        resultId: result.id,
        title: result.title,
        severity: body.severity,
        createdBy: actorId,
        reproduction: {
          runId: result.runId,
          caseId: result.caseId,
          version: result.version,
          steps: result.steps,
          actual: result.notes || result.attempts[0]?.error || "Failed without additional notes",
          environment: result.run.environment,
          browser: result.browser,
          device: result.device,
          evidenceIds: result.evidence.map((evidence) => evidence.id),
        },
        events: {
          create: { toStatus: "NEW", comment: "Created from failed test result", actorId },
        },
      },
    });
    res.json({ data });
  });
  app.get(base, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const query = z
      .object({
        cursor: id.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        status: status.optional(),
        severity: z.enum(["S1", "S2", "S3", "S4"]).optional(),
        search: z.string().trim().max(200).optional(),
      })
      .strict()
      .parse(req.query);
    const where: Prisma.DefectWhereInput = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
    };
    if (query.cursor && !(await db.defect.findFirst({ where: { ...where, id: query.cursor } })))
      return fail(404, "NOT_FOUND", "Defect cursor not found");
    const rows = await db.defect.findMany({
      where,
      orderBy: { id: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/metrics`, guard(), async (req, res) => {
    res.json({ data: await defectMetrics(db, id.parse(req.params.projectId)) });
  });
  app.get(`${base}/:defectId`, guard(), async (req, res) => {
    const data = await db.defect.findFirst({
      where: { id: id.parse(req.params.defectId), projectId: id.parse(req.params.projectId) },
      include: { events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!data) return fail(404, "NOT_FOUND", "Defect not found");
    res.json({ data });
  });
  app.post(`${base}/:defectId/transitions`, guard(), async (req, res) => {
    const body = defectTransitionBody.parse(req.body);
    const role = res.locals.role as string;
    if (!["ADMIN", "QA", "DEVELOPER"].includes(role))
      return fail(403, "FORBIDDEN", "This role cannot update defects");
    if (role === "DEVELOPER" && !["IN_PROGRESS", "FIXED"].includes(body.status))
      return fail(403, "FORBIDDEN", "QA must verify and close defects");
    const data = await db.$transaction(async (tx) => {
      const defect = await tx.defect.findFirst({
        where: { id: id.parse(req.params.defectId), projectId: id.parse(req.params.projectId) },
      });
      if (!defect) return fail(404, "NOT_FOUND", "Defect not found");
      if (defect.revision !== body.revision)
        return fail(409, "CONFLICT", "Defect changed; refresh before updating");
      if (!transitions[defect.status]?.includes(body.status))
        return fail(409, "INVALID_TRANSITION", "Invalid defect status transition");
      const updated = await tx.defect.updateMany({
        where: { id: defect.id, revision: body.revision },
        data: { status: body.status, revision: { increment: 1 } },
      });
      if (updated.count !== 1)
        return fail(409, "CONFLICT", "Defect changed; refresh before updating");
      await tx.defectEvent.create({
        data: {
          defectId: defect.id,
          fromStatus: defect.status,
          toStatus: body.status,
          comment: body.comment,
          actorId: res.locals.userId as string,
        },
      });
      return tx.defect.findUniqueOrThrow({ where: { id: defect.id } });
    });
    res.json({ data });
  });
}
