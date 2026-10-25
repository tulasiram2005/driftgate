import { z } from "zod";
import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "../generated/client/index.js";
import { collectReleaseReadiness } from "./release-readiness.js";
import { mountReleaseSignoffs } from "./release-signoffs.js";

const id = z.string().min(1).max(100);
const environments = ["STAGING", "UAT", "PREPROD", "PROD"] as const;
export const releaseBody = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const gateRunsBody = z
  .object({
    revision: z.number().int().nonnegative(),
    runIds: z
      .array(id)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate run IDs"),
  })
  .strict();

export function mountReleases(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  mountReleaseSignoffs(app, db, guard, fail);
  const base = "/api/v1/projects/:projectId/releases";
  const include = { gates: { orderBy: { position: "asc" as const } } };
  app.get(`${base}/:releaseId/gates/:environment/readiness`, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const releaseId = id.parse(req.params.releaseId);
    const environment = z.enum(environments).parse(req.params.environment);
    const data = await db.$transaction(
      (tx) => collectReleaseReadiness(tx, projectId, releaseId, environment),
      { isolationLevel: "RepeatableRead" },
    );
    if (!data) return fail(404, "NOT_FOUND", "Release gate not found");
    res.json({ data });
  });
  app.post(base, guard(true), async (req, res) => {
    const body = releaseBody.parse(req.body);
    const data = await db.release.create({
      data: {
        projectId: id.parse(req.params.projectId),
        name: body.name,
        createdBy: res.locals.userId as string,
        gates: { create: environments.map((environment, position) => ({ environment, position })) },
      },
      include,
    });
    res.json({ data });
  });
  app.get(base, guard(), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const query = z
      .object({ cursor: id.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) })
      .strict()
      .parse(req.query);
    if (query.cursor && !(await db.release.findFirst({ where: { id: query.cursor, projectId } })))
      return fail(404, "NOT_FOUND", "Release cursor not found");
    const rows = await db.release.findMany({
      where: { projectId },
      orderBy: { id: "desc" },
      include,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/:releaseId`, guard(), async (req, res) => {
    const data = await db.release.findFirst({
      where: { id: id.parse(req.params.releaseId), projectId: id.parse(req.params.projectId) },
      include,
    });
    if (!data) return fail(404, "NOT_FOUND", "Release not found");
    res.json({ data });
  });
  app.put(`${base}/:releaseId/gates/:environment/runs`, guard(true), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const releaseId = id.parse(req.params.releaseId);
    const environment = z.enum(environments).parse(req.params.environment);
    const body = gateRunsBody.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const gate = await tx.releaseGate.findFirst({
        where: { releaseId, environment, release: { projectId } },
      });
      if (!gate) return fail(404, "NOT_FOUND", "Release gate not found");
      // Persist references, never a supplied score or approval. Readiness must re-read sources.
      const runs = await tx.run.findMany({
        where: { projectId, id: { in: body.runIds } },
        select: { environment: true },
      });
      if (
        runs.length !== body.runIds.length ||
        runs.some((run) => run.environment.toUpperCase() !== environment)
      )
        return fail(400, "INVALID_RUNS", "Runs must belong to this project and gate environment");
      const updated = await tx.releaseGate.updateMany({
        where: { id: gate.id, revision: body.revision },
        data: { runIds: [...body.runIds].sort(), revision: { increment: 1 } },
      });
      if (updated.count !== 1)
        return fail(409, "CONFLICT", "Gate changed; refresh before updating");
      return tx.releaseGate.findUniqueOrThrow({ where: { id: gate.id } });
    });
    res.json({ data });
  });
}
