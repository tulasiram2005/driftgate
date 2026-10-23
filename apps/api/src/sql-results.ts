import { z } from "zod";
import type { Express, RequestHandler } from "express";
import { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { checkThreadlineDatabase, type SqlAssertionResult } from "./sql-checks.js";

const id = z.string().min(1).max(100);
export const sqlRunBody = z
  .object({ environment: z.enum(["staging", "uat", "preprod", "prod"]) })
  .strict();
export type SqlExecutor = (environment: string) => Promise<SqlAssertionResult[]>;

function executor(config: Config): SqlExecutor | undefined {
  const url = config.THREADLINE_READONLY_DATABASE_URL;
  if (!url) return;
  return async (environment) => {
    const reader = new PrismaClient({ datasources: { db: { url } } });
    try {
      return await checkThreadlineDatabase(reader, environment);
    } finally {
      await reader.$disconnect();
    }
  };
}

export function mountSqlResults(
  app: Express,
  db: PrismaClient,
  config: Config,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
  injected?: SqlExecutor,
) {
  const base = "/api/v1/projects/:projectId/sql-checks";
  const execute = injected ?? executor(config);
  let busy = false;
  app.post(base, guard(true), async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const body = sqlRunBody.parse(req.body);
    if (!execute || config.THREADLINE_SQL_PROJECT_ID !== projectId)
      return fail(
        503,
        "NOT_CONFIGURED",
        "Read-only SQL checks are not configured for this project",
      );
    if (busy) return fail(429, "BUSY", "A SQL check is running. Please retry.");
    busy = true;
    const started = performance.now();
    try {
      let results: SqlAssertionResult[] = [];
      let status = "ERROR";
      let errorCode: string | null = null;
      try {
        results = await execute(body.environment);
        status = results.some((result) => result.status === "FAIL") ? "FAIL" : "PASS";
      } catch {
        // Database errors can contain credentials or customer data. Persist only a fixed code.
        errorCode = "SQL_CHECK_UNAVAILABLE";
      }
      const data = await db.sqlCheckRun.create({
        data: {
          projectId,
          environment: body.environment,
          status,
          results: results.map((result) => ({ ...result })),
          errorCode,
          createdBy: res.locals.userId as string,
          durationMs: Math.min(2147483647, Math.max(0, Math.round(performance.now() - started))),
        },
      });
      res.json({ data });
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
      !(await db.sqlCheckRun.findFirst({ where: { id: query.cursor, projectId } }))
    )
      return fail(404, "NOT_FOUND", "SQL result cursor not found");
    const rows = await db.sqlCheckRun.findMany({
      where: { projectId },
      orderBy: { id: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
}
