import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";

const id = z.string().min(1).max(100);
const candidate = z.object({ evidenceId: id, label: z.string().trim().min(1).max(100) }).strict();
const review = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().trim().min(1).max(1000),
  })
  .strict();

export function mountVisualBaselines(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const base = "/api/v1/projects/:projectId/visual-baselines";
  app.post(`${base}/:baselineId/activate`, guard(), async (req, res) => {
    if (!["ADMIN", "APPROVER"].includes(res.locals.role as string))
      return fail(403, "FORBIDDEN", "An Admin or Approver must activate baselines");
    z.object({}).strict().parse(req.body);
    const projectId = id.parse(req.params.projectId);
    const baselineId = id.parse(req.params.baselineId);
    const data = await db.$transaction(
      async (tx) => {
        const found = await tx.visualBaseline.findFirst({ where: { id: baselineId, projectId } });
        if (!found) return fail(404, "NOT_FOUND", "Baseline not found");
        if (found.status !== "APPROVED")
          return fail(409, "CONFLICT", "Only approved baselines can be activated");
        if (found.active) return found;
        const { environment, browser, device, checkId, viewportWidth, viewportHeight } = found;
        await tx.visualBaseline.updateMany({
          where: {
            projectId,
            environment,
            browser,
            device,
            checkId,
            viewportWidth,
            viewportHeight,
            active: true,
          },
          data: { active: false },
        });
        return tx.visualBaseline.update({
          where: { id: baselineId },
          data: {
            active: true,
            activatedBy: res.locals.userId as string,
            activatedAt: new Date(),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    res.json({ data });
  });
  app.post(base, guard(true), async (req, res) => {
    const body = candidate.parse(req.body);
    const projectId = id.parse(req.params.projectId);
    const evidence = await db.evidence.findFirst({
      where: {
        id: body.evidenceId,
        ready: true,
        kind: "screenshot",
        contentType: "image/png",
        result: { run: { projectId, mode: "AUTOMATED" } },
      },
      include: { result: { include: { run: true } } },
    });
    if (!evidence) return fail(404, "NOT_FOUND", "Ready automated screenshot not found");
    const result = evidence.result;
    if (!["desktop", "mobile"].includes(result.device))
      return fail(400, "INVALID_INPUT", "Unknown runner viewport");
    const data = await db.visualBaseline.create({
      data: {
        projectId,
        evidenceId: evidence.id,
        label: body.label,
        environment: result.run.environment,
        browser: result.browser,
        device: result.device,
        checkId: result.caseId,
        createdBy: res.locals.userId as string,
        viewportWidth: result.device === "mobile" ? 390 : 1280,
        viewportHeight: result.device === "mobile" ? 844 : 900,
      },
    });
    res.json({ data });
  });
  app.get(base, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const query = z
      .object({ cursor: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) })
      .strict()
      .parse(req.query);
    if (
      query.cursor &&
      !(await db.visualBaseline.findFirst({ where: { id: query.cursor, projectId } }))
    )
      return fail(404, "NOT_FOUND", "Baseline cursor not found");
    const rows = await db.visualBaseline.findMany({
      where: { projectId },
      include: {
        evidence: {
          select: {
            id: true,
            kind: true,
            ready: true,
            sizeBytes: true,
            resultId: true,
            result: { select: { runId: true } },
          },
        },
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
  app.post(`${base}/:baselineId/review`, guard(), async (req, res) => {
    if (!["ADMIN", "APPROVER"].includes(res.locals.role as string))
      return fail(403, "FORBIDDEN", "An Admin or Approver must review baselines");
    const body = review.parse(req.body);
    const projectId = id.parse(req.params.projectId);
    const baselineId = id.parse(req.params.baselineId);
    const data = await db.$transaction(async (tx) => {
      const found = await tx.visualBaseline.findFirst({ where: { id: baselineId, projectId } });
      if (!found) return fail(404, "NOT_FOUND", "Baseline not found");
      const changed = await tx.visualBaseline.updateMany({
        where: { id: baselineId, projectId, status: "PENDING" },
        data: {
          status: body.status,
          reviewComment: body.comment,
          reviewedBy: res.locals.userId as string,
          reviewedAt: new Date(),
        },
      });
      if (!changed.count) return fail(409, "CONFLICT", "Baseline has already been reviewed");
      return tx.visualBaseline.findUniqueOrThrow({ where: { id: baselineId } });
    });
    res.json({ data });
  });
}
