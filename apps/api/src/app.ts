import { createHash, randomBytes, randomUUID } from "node:crypto";
import express from "express";
import type { ErrorRequestHandler, Request, RequestHandler } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import swaggerUi from "swagger-ui-express";
import { Prisma } from "../generated/client/index.js";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { mountSnapshots, snapshotBody } from "./snapshots.js";
import { mountComparisons, comparisonBody, savedRulesBody } from "./comparisons.js";
import { mountVisualBaselines, ignoreRegionsBody } from "./visual-baselines.js";
import {
  mountVisualComparisons,
  visualComparisonBody,
  visualReviewBody,
} from "./visual-comparisons.js";
import { storage } from "./storage.js";
import { mountSqlResults, sqlRunBody, type SqlExecutor } from "./sql-results.js";
import { mountDefects, defectBody, defectTransitionBody } from "./defects.js";
import { mountJiraSettings, jiraSettingsBody, jiraVerifyBody } from "./jira-settings.js";
import { mountJiraExport, jiraExportBody, jiraReconcileBody } from "./jira-export.js";
import { mountReleases, releaseBody, gateRunsBody } from "./releases.js";
import { signoffBody } from "./release-signoffs.js";
import { mountCallback, mountExecution, publicRun } from "./execution.js";
import { automatedRunBody, callbackBody, screenshotBody } from "./execution-contracts.js";
import type { EvidenceStorage } from "./storage.js";
import {
  credentials,
  registration,
  projectBody,
  requirementBody,
  caseBody,
  suiteBody,
  runBody,
  resultBody,
  memberBody,
  listQuery,
} from "./contracts.js";

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const publicUser = { id: true, name: true, email: true } as const;
const caseInclude = {
  steps: { orderBy: { position: "asc" as const }, select: { action: true, expected: true } },
};
const suiteInclude = { members: { orderBy: { position: "asc" as const } } };
const stepCreates = (steps: z.infer<typeof caseBody>["steps"]) =>
  steps.map((step, position) => ({ ...step, position }));
function suiteResponse<T extends { members: { caseId: string }[] }>(suite: T) {
  const { members, ...row } = suite;
  return { ...row, caseIds: members.map((member) => member.caseId) };
}
function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}
const param = (req: Request, key: string) => z.string().min(1).max(100).parse(req.params[key]);
const pageArgs = (req: Request) => {
  const q = listQuery.parse(req.query);
  return {
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" as const },
  };
};
function page<T extends { id: string }>(req: Request, rows: T[]) {
  const limit = listQuery.parse(req.query).limit;
  return {
    data: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
  };
}

export function createApp(
  db: PrismaClient,
  config: Config,
  evidenceStorage?: EvidenceStorage,
  sqlExecutor?: SqlExecutor,
) {
  const app = express();
  const key = new TextEncoder().encode(config.JWT_SECRET);
  const secure = config.NODE_ENV === "production";
  const cookieName = secure ? "__Host-driftgate-refresh" : "driftgate-refresh";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7 * 86400000,
  };
  const log = pino({
    level: config.NODE_ENV === "test" ? "silent" : "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "password",
        "passwordHash",
        "tokenHash",
      ],
      censor: "[REDACTED]",
    },
  });
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ logger: log }));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || config.API_CORS_ORIGINS.includes(origin)),
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(cookieParser());
  app.use((req, _res, next) => {
    const origin = req.get("origin");
    if (origin && !config.API_CORS_ORIGINS.includes(origin))
      return next(new ApiError(403, "ORIGIN_DENIED", "Origin is not allowed"));
    if (req.get("sec-fetch-site") === "cross-site" && req.method !== "GET")
      return next(new ApiError(403, "ORIGIN_DENIED", "Cross-site requests are not allowed"));
    next();
  });
  app.get("/health", (_req, res) => res.json({ data: { status: "ok", service: "driftgate-api" } }));
  app.get("/ready", async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ data: { status: "ready" } });
  });
  const registry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  function document(
    method: "get" | "post" | "put" | "delete",
    path: string,
    body?: z.ZodTypeAny,
    auth = true,
  ) {
    registry.registerPath({
      method,
      path: path.replace(/:([A-Za-z]+)/g, "{$1}"),
      summary: `${method.toUpperCase()} ${path}`,
      ...(auth ? { security: [{ bearerAuth: [] }] } : {}),
      ...(body
        ? {
            request: {
              body: { required: true, content: { "application/json": { schema: body } } },
            },
          }
        : {}),
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: z.object({ data: z.unknown(), nextCursor: z.string().nullable().optional() }),
            },
          },
        },
        400: { description: "Invalid input" },
        401: { description: "Authentication required" },
        403: { description: "Role denied" },
        404: { description: "Resource not found" },
        409: { description: "Conflict" },
        429: { description: "Rate limited" },
      },
    });
  }
  const authLimit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many attempts. Try again in a minute." },
      });
    },
  });
  const issue = async (
    res: express.Response,
    user: { id: string; name: string; email: string },
  ) => {
    const id = randomUUID();
    const refresh = `${id}.${randomBytes(48).toString("base64url")}`;
    await db.session.create({
      data: {
        id,
        userId: user.id,
        tokenHash: hash(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const accessToken = await new SignJWT({ sid: id })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("driftgate")
      .setAudience("driftgate-web")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);
    res
      .cookie(cookieName, refresh, cookieOptions)
      .set("Cache-Control", "no-store")
      .json({ data: { user, accessToken } });
  };
  const registrationLimit = rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many registrations. Try again later." },
      });
    },
  });
  app.post("/api/v1/auth/register", registrationLimit, async (req, res) => {
    const body = registration.parse(req.body);
    await issue(
      res,
      await db.user.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash: await argon2.hash(body.password, { type: argon2.argon2id }),
        },
        select: publicUser,
      }),
    );
  });
  document("post", "/api/v1/auth/register", registration, false);
  app.post("/api/v1/auth/login", authLimit, async (req, res) => {
    const body = credentials.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    const dummy =
      "$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$0b9Y8nzL4WAWTxJkAMRrsO7Q0BRS5ZzXVsn/V2E/3Ik";
    const valid = await argon2
      .verify(user?.passwordHash ?? dummy, body.password)
      .catch(() => false);
    if (!user || !valid) fail(401, "INVALID_CREDENTIALS", "Invalid email or password");
    await issue(res, { id: user.id, name: user.name, email: user.email });
  });
  document("post", "/api/v1/auth/login", credentials, false);
  const refreshLimit = rateLimit({
    windowMs: 60000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many session refreshes. Try again in a minute.",
        },
      });
    },
  });
  app.post("/api/v1/auth/refresh", refreshLimit, async (req, res) => {
    const token = z.string().max(200).safeParse(req.cookies[cookieName]);
    if (!token.success) fail(401, "SESSION_EXPIRED", "Please sign in again");
    const id = token.data.split(".")[0]!;
    const old = await db.session.findUnique({
      where: { id },
      include: { user: { select: publicUser } },
    });
    if (
      !old ||
      old.revokedAt ||
      old.expiresAt <= new Date() ||
      old.tokenHash !== hash(token.data)
    ) {
      res.clearCookie(cookieName, cookieOptions);
      fail(401, "SESSION_EXPIRED", "Please sign in again");
    }
    const changed = await db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (changed.count !== 1) fail(401, "SESSION_EXPIRED", "Please sign in again");
    await issue(res, old.user);
  });
  document("post", "/api/v1/auth/refresh", undefined, false);
  app.post("/api/v1/auth/logout", async (req, res) => {
    const token: unknown = req.cookies[cookieName];
    if (typeof token === "string")
      await db.session.updateMany({
        where: { id: token.split(".")[0] ?? "", tokenHash: hash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    res.clearCookie(cookieName, cookieOptions).json({ data: { loggedOut: true } });
  });
  document("post", "/api/v1/auth/logout", undefined, false);
  mountCallback(app, db, config, fail);
  document("post", "/api/v1/runner/callback", callbackBody, false);
  const authenticate: RequestHandler = async (req, res, next) => {
    try {
      const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
      if (!token) fail(401, "UNAUTHORIZED", "Please sign in");
      const { payload } = await jwtVerify(token, key, {
        issuer: "driftgate",
        audience: "driftgate-web",
        algorithms: ["HS256"],
      });
      const session = await db.session.findFirst({
        where: {
          id: String(payload.sid),
          userId: String(payload.sub),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) fail(401, "SESSION_EXPIRED", "Please sign in again");
      res.locals.userId = session.userId;
      res.locals.sessionId = session.id;
      res.locals.tokenExpiresAt = Number(payload.exp) * 1000;
      next();
    } catch (e) {
      next(e instanceof ApiError ? e : new ApiError(401, "UNAUTHORIZED", "Please sign in again"));
    }
  };
  app.use("/api/v1", authenticate, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const guard =
    (write = false, admin = false): RequestHandler =>
    async (req, res, next) => {
      const member = await db.member.findUnique({
        where: {
          projectId_userId: {
            projectId: param(req, "projectId"),
            userId: res.locals.userId as string,
          },
        },
      });
      if (!member) return next(new ApiError(404, "NOT_FOUND", "Project not found"));
      if ((admin && member.role !== "ADMIN") || (write && !["ADMIN", "QA"].includes(member.role)))
        return next(new ApiError(403, "FORBIDDEN", "Your project role does not allow this action"));
      res.locals.role = member.role;
      next();
    };
  app.get("/api/v1/projects", async (req, res) => {
    const rows = await db.project.findMany({
      where: { members: { some: { userId: res.locals.userId as string } } },
      include: {
        members: { where: { userId: res.locals.userId as string }, select: { role: true } },
      },
      ...pageArgs(req),
    });
    res.json(
      page(
        req,
        rows.map(({ members, ...p }) => ({ ...p, role: members[0]!.role })),
      ),
    );
  });
  document("get", "/api/v1/projects");
  app.post("/api/v1/projects", async (req, res) => {
    const data = await db.project.create({
      data: {
        ...projectBody.parse(req.body),
        members: { create: { userId: res.locals.userId as string, role: "ADMIN" } },
      },
    });
    res.json({ data: { ...data, role: "ADMIN" } });
  });
  document("post", "/api/v1/projects", projectBody);
  const base = "/api/v1/projects/:projectId";
  mountSnapshots(app, db, guard, fail);
  mountComparisons(app, db, guard, fail);
  mountVisualBaselines(app, db, guard, fail);
  mountSqlResults(app, db, config, guard, fail, sqlExecutor);
  mountDefects(app, db, guard, fail);
  mountJiraSettings(app, db, config, guard, fail);
  mountJiraExport(app, db, config, guard, fail);
  document("get", `${base}/defects/:defectId/jira`);
  document("post", `${base}/defects/:defectId/jira`, jiraExportBody);
  document("post", `${base}/defects/:defectId/jira/sync`, jiraExportBody);
  document("post", `${base}/defects/:defectId/jira/reconcile`, jiraReconcileBody);
  document("get", `${base}/integrations/jira`);
  document("post", `${base}/integrations/jira/verify`, jiraVerifyBody);
  document("post", `${base}/integrations/jira/disconnect`, jiraVerifyBody);
  document("put", `${base}/integrations/jira`, jiraSettingsBody);
  mountReleases(app, db, guard, fail);
  document("post", `${base}/releases`, releaseBody);
  document("get", `${base}/releases`);
  document("get", `${base}/releases/:releaseId`);
  document("put", `${base}/releases/:releaseId/gates/:environment/runs`, gateRunsBody);
  document("get", `${base}/releases/:releaseId/gates/:environment/readiness`);
  document("get", `${base}/releases/:releaseId/signoffs`);
  document("get", `${base}/releases/:releaseId/report.pdf`);
  document("post", `${base}/releases/:releaseId/gates/:environment/signoff`, signoffBody);
  document("post", `${base}/defects`, defectBody);
  document("get", `${base}/defects`);
  document("get", `${base}/defects/metrics`);
  document("get", `${base}/defects/:defectId`);
  document("post", `${base}/defects/:defectId/transitions`, defectTransitionBody);
  document("post", `${base}/sql-checks`, sqlRunBody);
  document("get", `${base}/sql-checks`);
  document("put", `${base}/visual-baselines/:baselineId/ignore-regions`, ignoreRegionsBody);
  mountVisualComparisons(app, db, guard, fail, evidenceStorage ?? storage(config));
  document("post", `${base}/visual-comparisons`, visualComparisonBody);
  document("post", `${base}/visual-comparisons/:comparisonId/review`, visualReviewBody);
  document("get", `${base}/visual-comparisons`);
  document("get", `${base}/visual-comparisons/:comparisonId/url`);
  document("post", `${base}/comparisons`, comparisonBody);
  document("get", `${base}/expected-rules`);
  document("put", `${base}/expected-rules`, savedRulesBody);
  document("get", `${base}/comparisons`);
  document("get", `${base}/comparisons/:comparisonId`);
  document("post", `${base}/snapshots`, snapshotBody);
  document("get", `${base}/snapshots`);
  document("get", `${base}/snapshots/:snapshotId`);
  mountExecution(app, db, config, guard, fail, evidenceStorage);
  document("post", `${base}/automated-runs`, automatedRunBody);
  document("get", `${base}/automated-runs`);
  document("get", `${base}/runs/:runId`);
  document("get", `${base}/runs/:runId/events`);
  const evidencePath = `${base}/runs/:runId/results/:resultId/evidence`;
  document("post", evidencePath, screenshotBody);
  document("post", `${evidencePath}/:evidenceId/complete`);
  document("get", `${evidencePath}/:evidenceId/url`);
  app.get(base, guard(), async (req, res) => {
    res.json({
      data: {
        ...(await db.project.findUniqueOrThrow({ where: { id: param(req, "projectId") } })),
        role: res.locals.role,
      },
    });
  });
  document("get", base);
  app.get(`${base}/members`, guard(), async (req, res) => {
    res.json({
      data: await db.member.findMany({
        where: { projectId: param(req, "projectId") },
        include: { user: { select: publicUser } },
      }),
    });
  });
  document("get", `${base}/members`);
  app.post(`${base}/members`, guard(false, true), async (req, res) => {
    const body = memberBody.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email }, select: publicUser });
    if (!user) fail(404, "NOT_FOUND", "User must register before they can join a project");
    const projectId = param(req, "projectId");
    const where = { projectId_userId: { projectId, userId: user.id } };
    if ((await db.member.findUnique({ where }))?.role === "ADMIN")
      fail(409, "ADMIN_PROTECTED", "The project owner cannot be demoted");
    res.json({
      data: await db.member.upsert({
        where,
        create: { projectId, userId: user.id, role: body.role },
        update: { role: body.role },
      }),
    });
  });
  document("post", `${base}/members`, memberBody);
  app.get(`${base}/requirements`, guard(), async (req, res) => {
    res.json(
      page(
        req,
        await db.requirement.findMany({
          where: { projectId: param(req, "projectId") },
          ...pageArgs(req),
        }),
      ),
    );
  });
  document("get", `${base}/requirements`);
  app.post(`${base}/requirements`, guard(true), async (req, res) => {
    res.json({
      data: await db.requirement.create({
        data: { ...requirementBody.parse(req.body), projectId: param(req, "projectId") },
      }),
    });
  });
  document("post", `${base}/requirements`, requirementBody);
  const validateRequirement = async (projectId: string, requirementId: string | null) => {
    if (
      requirementId &&
      !(await db.requirement.findFirst({ where: { id: requirementId, projectId } }))
    )
      fail(404, "NOT_FOUND", "Requirement not found in this project");
  };
  app.get(`${base}/cases`, guard(), async (req, res) => {
    const q = listQuery.parse(req.query);
    res.json(
      page(
        req,
        await db.testCase.findMany({
          include: caseInclude,
          where: {
            projectId: param(req, "projectId"),
            archived: false,
            ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
            ...(q.priority ? { priority: q.priority } : {}),
          },
          ...pageArgs(req),
        }),
      ),
    );
  });
  document("get", `${base}/cases`);
  app.post(`${base}/cases`, guard(true), async (req, res) => {
    const body = caseBody.parse(req.body);
    const projectId = param(req, "projectId");
    await validateRequirement(projectId, body.requirementId);
    const data = await db.$transaction(async (tx) => {
      const row = await tx.testCase.create({
        data: { ...body, projectId, steps: { create: stepCreates(body.steps) } },
        include: caseInclude,
      });
      await tx.caseVersion.create({
        data: {
          caseId: row.id,
          version: 1,
          snapshot: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    res.json({ data });
  });
  document("post", `${base}/cases`, caseBody);
  app.put(`${base}/cases/:caseId`, guard(true), async (req, res) => {
    const body = caseBody.parse(req.body);
    const projectId = param(req, "projectId");
    const id = param(req, "caseId");
    await validateRequirement(projectId, body.requirementId);
    const data = await db.$transaction(async (tx) => {
      const old = await tx.testCase.findFirst({ where: { id, projectId, archived: false } });
      if (!old) fail(404, "NOT_FOUND", "Test case not found");
      const { steps, ...fields } = body;
      const changed = await tx.testCase.updateMany({
        where: { id, projectId, version: old.version },
        data: { ...fields, version: { increment: 1 } },
      });
      if (!changed.count)
        fail(409, "VERSION_CONFLICT", "This case changed. Refresh and try again.");
      await tx.testStep.deleteMany({ where: { caseId: id } });
      await tx.testStep.createMany({
        data: stepCreates(steps).map((step) => ({ ...step, caseId: id })),
      });
      const row = await tx.testCase.findUniqueOrThrow({ where: { id }, include: caseInclude });
      await tx.caseVersion.create({
        data: {
          caseId: id,
          version: row.version,
          snapshot: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
        },
      });
      return row;
    });
    res.json({ data });
  });
  document("put", `${base}/cases/:caseId`, caseBody);
  app.delete(`${base}/cases/:caseId`, guard(true), async (req, res) => {
    const changed = await db.testCase.updateMany({
      where: { id: param(req, "caseId"), projectId: param(req, "projectId"), archived: false },
      data: { archived: true },
    });
    if (!changed.count) fail(404, "NOT_FOUND", "Test case not found");
    res.json({ data: { archived: true } });
  });
  document("delete", `${base}/cases/:caseId`);
  app.get(`${base}/cases/:caseId/versions`, guard(), async (req, res) => {
    const row = await db.testCase.findFirst({
      where: { id: param(req, "caseId"), projectId: param(req, "projectId") },
    });
    if (!row) fail(404, "NOT_FOUND", "Test case not found");
    res.json({
      data: await db.caseVersion.findMany({
        where: { caseId: row.id },
        orderBy: { version: "desc" },
      }),
    });
  });
  document("get", `${base}/cases/:caseId/versions`);
  app.get(`${base}/cases.csv`, guard(), async (req, res) => {
    const rows = await db.testCase.findMany({
      include: caseInclude,
      where: { projectId: param(req, "projectId"), archived: false },
      orderBy: { id: "asc" },
      take: 5000,
    });
    const csv = stringify(
      rows.map((r) => ({
        title: r.title,
        description: r.description,
        priority: r.priority,
        type: r.type,
        tags: JSON.stringify(r.tags),
        requirementId: r.requirementId ?? "",
        steps: JSON.stringify(r.steps),
      })),
      {
        header: true,
        columns: ["title", "description", "priority", "type", "tags", "requirementId", "steps"],
        escape_formulas: true,
      },
    );
    res.type("text/csv").attachment("driftgate-test-cases.csv").send(csv);
  });
  document("get", `${base}/cases.csv`);
  const csvBody = z.object({ csv: z.string().min(1).max(900000) }).strict();
  app.post(`${base}/cases/import`, guard(true), async (req, res) => {
    const body = csvBody.parse(req.body);
    const projectId = param(req, "projectId");
    let records: Record<string, string>[];
    try {
      records = parse(body.csv, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        max_record_size: 50000,
      }) as Record<string, string>[];
    } catch {
      fail(400, "INVALID_CSV", "CSV could not be parsed");
    }
    if (!records.length || records.length > 200)
      fail(400, "INVALID_CSV", "Import 1 to 200 rows at a time");
    const bodies = records.map((r) => {
      try {
        return caseBody.parse({
          ...r,
          tags: JSON.parse(r.tags || "[]"),
          steps: JSON.parse(r.steps || "[]"),
          requirementId: r.requirementId || null,
        });
      } catch {
        return fail(
          400,
          "INVALID_CSV",
          "CSV requires title, description, priority, type, JSON tags, requirementId and JSON steps columns",
        );
      }
    });
    for (const r of bodies) await validateRequirement(projectId, r.requirementId);
    const rows = await db.$transaction(async (tx) => {
      const created = [];
      for (const body of bodies) {
        const row = await tx.testCase.create({
          data: { ...body, projectId, steps: { create: stepCreates(body.steps) } },
          include: caseInclude,
        });
        await tx.caseVersion.create({
          data: {
            caseId: row.id,
            version: 1,
            snapshot: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue,
          },
        });
        created.push(row);
      }
      return created;
    });
    res.json({ data: { imported: rows.length } });
  });
  document("post", `${base}/cases/import`, csvBody);
  app.get(`${base}/coverage`, guard(), async (req, res) => {
    res.json({
      data: await db.requirement.findMany({
        where: { projectId: param(req, "projectId") },
        include: {
          cases: {
            where: { archived: false },
            select: { id: true, title: true, priority: true, version: true },
          },
        },
        take: 1000,
      }),
    });
  });
  document("get", `${base}/coverage`);
  app.get(`${base}/suites`, guard(), async (req, res) => {
    res.json(
      page(
        req,
        (
          await db.suite.findMany({
            where: { projectId: param(req, "projectId") },
            include: suiteInclude,
            ...pageArgs(req),
          })
        ).map(suiteResponse),
      ),
    );
  });
  document("get", `${base}/suites`);
  app.post(`${base}/suites`, guard(true), async (req, res) => {
    const body = suiteBody.parse(req.body);
    body.caseIds = [...new Set(body.caseIds)];
    const projectId = param(req, "projectId");
    if (
      (await db.testCase.count({
        where: { projectId, id: { in: body.caseIds }, archived: false },
      })) !== body.caseIds.length
    )
      fail(404, "NOT_FOUND", "Some cases do not belong to this project");
    res.json({
      data: suiteResponse(
        await db.suite.create({
          data: {
            name: body.name,
            projectId,
            members: { create: body.caseIds.map((caseId, position) => ({ caseId, position })) },
          },
          include: suiteInclude,
        }),
      ),
    });
  });
  document("post", `${base}/suites`, suiteBody);
  const runLimit = rateLimit({
    windowMs: 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: { code: "RATE_LIMITED", message: "Too many runs. Try again later." } });
    },
  });
  app.get(`${base}/runs`, guard(), async (req, res) => {
    res.json(
      page(
        req,
        (
          await db.run.findMany({
            where: { projectId: param(req, "projectId"), mode: "MANUAL" },
            include: { results: { orderBy: { id: "asc" } } },
            ...pageArgs(req),
          })
        ).map(publicRun),
      ),
    );
  });
  document("get", `${base}/runs`);
  app.post(`${base}/runs`, guard(true), runLimit, async (req, res) => {
    const body = runBody.parse(req.body);
    const projectId = param(req, "projectId");
    const data = await db.$transaction(async (tx) => {
      const suite = await tx.suite.findFirst({
        where: { id: body.suiteId, projectId },
        include: suiteInclude,
      });
      if (!suite) fail(404, "NOT_FOUND", "Suite not found");
      const caseIds = suite.members.map((member) => member.caseId);
      const cases = await tx.testCase.findMany({
        where: { projectId, id: { in: caseIds }, archived: false },
        include: caseInclude,
      });
      if (cases.length !== caseIds.length)
        fail(409, "ARCHIVED_CASE", "A suite case was archived. Create a new suite.");
      return tx.run.create({
        data: {
          ...body,
          projectId,
          results: {
            create: cases.map((c) => ({
              caseId: c.id,
              title: c.title,
              version: c.version,
              steps: c.steps as Prisma.InputJsonValue,
              browser: body.browser,
              device: body.device,
            })),
          },
        },
        include: { results: true },
      });
    });
    res.json({ data });
  });
  document("post", `${base}/runs`, runBody);
  app.put(`${base}/runs/:runId/results/:resultId`, guard(true), async (req, res) => {
    const body = resultBody.parse(req.body);
    const changed = await db.result.updateMany({
      where: {
        id: param(req, "resultId"),
        runId: param(req, "runId"),
        run: { projectId: param(req, "projectId") },
        AND: { run: { mode: "MANUAL" } },
      },
      data: body,
    });
    if (!changed.count) fail(404, "NOT_FOUND", "Result not found");
    res.json({
      data: await db.result.findUniqueOrThrow({ where: { id: param(req, "resultId") } }),
    });
  });
  document("put", `${base}/runs/:runId/results/:resultId`, resultBody);
  const openapi = () =>
    new OpenApiGeneratorV3(registry.definitions).generateDocument({
      openapi: "3.0.0",
      info: { title: "DriftGate API", version: "1.1.0" },
    });
  app.get("/openapi.json", (_req, res) => res.json(openapi()));
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, { swaggerOptions: { url: "/openapi.json" } }),
  );
  app.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "Resource not found")));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P2002", "P2034"].includes(error.code)) {
        res.status(409).json({
          error: {
            code: "CONFLICT",
            message: "This operation conflicts with an existing record. Refresh and retry.",
          },
        });
        return;
      }
      if (["P2025", "P2003"].includes(error.code)) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
        return;
      }
    }
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      ["entity.parse.failed", "entity.too.large"].includes(String(error.type))
    ) {
      res
        .status(400)
        .json({ error: { code: "INVALID_INPUT", message: "Invalid or oversized JSON body" } });
      return;
    }
    log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Request failed",
    );
    res.status(503).json({
      error: {
        code: "UNAVAILABLE",
        message: "Service is temporarily unavailable. Please retry.",
      },
    });
  };
  app.use(errors);
  return app;
}
