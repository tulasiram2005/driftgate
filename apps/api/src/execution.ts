import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { PrismaClient } from "../generated/client/index.js";
import type { Config } from "./config.js";
import { automatedRunBody, callbackBody, screenshotBody } from "./execution-contracts.js";
import { storage, type EvidenceStorage } from "./storage.js";

type Fail = (status: number, code: string, message: string) => never;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function validSignature(
  raw: Buffer,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest(),
  );
}
export function validEvidenceKey(
  key: string,
  runId: string,
  browser: string,
  device: string,
  checkId: string,
  attempt: number,
  kind: string,
) {
  const filename = { screenshot: "screenshot.png", video: "video.webm", trace: "trace.zip" }[kind];
  return (
    filename !== undefined &&
    key === `runs/${runId}/${browser}-${device}/${checkId}/${attempt}/${filename}`
  );
}
const detail = {
  results: {
    orderBy: { id: "asc" as const },
    include: {
      attempts: { orderBy: { number: "asc" as const } },
      evidence: { orderBy: { id: "asc" as const } },
    },
  },
};
export function publicRun<T extends { requestHash: string | null; idempotencyKey: string | null }>(
  run: T,
) {
  const { requestHash: _hash, idempotencyKey: _key, ...value } = run;
  void _hash;
  void _key;
  return value;
}

export function mountCallback(app: Express, db: PrismaClient, config: Config, fail: Fail) {
  app.post("/api/v1/runner/callback", async (req, res) => {
    const raw = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (
      !config.RUNNER_CALLBACK_SECRET ||
      !raw ||
      !validSignature(
        raw,
        req.get("X-Runner-Timestamp") ?? "",
        req.get("X-Runner-Signature") ?? "",
        config.RUNNER_CALLBACK_SECRET,
      )
    )
      fail(401, "INVALID_SIGNATURE", "Invalid runner signature or timestamp");
    const body = callbackBody.parse(req.body);
    const bodyHash = digest(raw.toString("utf8"));
    await db.$transaction(async (tx) => {
      // Serialize callbacks for one run, including completion and concurrent retries.
      await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${body.runId} FOR UPDATE`;
      const run = await tx.run.findUnique({
        where: { id: body.runId },
        include: { results: { include: { attempts: true } }, outbox: true },
      });
      if (!run || run.mode !== "AUTOMATED") fail(404, "NOT_FOUND", "Automated run not found");
      const receipt = await tx.callbackReceipt.findUnique({ where: { id: body.eventId } });
      if (receipt) {
        if (receipt.runId !== run.id || receipt.bodyHash !== bodyHash)
          fail(409, "REPLAY_CONFLICT", "Event ID already used with different content");
        return;
      }
      if (!["QUEUED", "RUNNING"].includes(run.status))
        fail(409, "RUN_FINISHED", "Run no longer accepts callbacks");
      if (body.type === "result") {
        const r = body.result;
        const result = run.results.find(
          (v) => v.caseId === r.checkId && v.browser === r.browser && v.device === r.device,
        );
        if (!result) fail(400, "INVALID_CELL", "Result is outside the dispatched matrix");
        if (result.attempts.length) fail(409, "RESULT_FINISHED", "Result already recorded");
        const job = run.outbox?.payload as { retries?: number } | undefined;
        if (r.attempts.length > (job?.retries ?? 1) + 1)
          fail(400, "INVALID_ATTEMPTS", "Too many attempts");
        const last = r.attempts.at(-1)!;
        const expected =
          last.status === "failed" ? "failed" : r.attempts.length > 1 ? "flaky" : "passed";
        if (
          expected !== r.status ||
          r.attempts.some(
            (a, i) => a.attempt !== i + 1 || (i < r.attempts.length - 1 && a.status !== "failed"),
          )
        )
          fail(400, "INVALID_ATTEMPTS", "Attempt history does not match result");
        for (const a of r.attempts)
          for (const e of a.evidence) {
            const contentType = {
              screenshot: "image/png",
              video: "video/webm",
              trace: "application/zip",
            }[e.kind];
            if (
              !validEvidenceKey(e.key, run.id, r.browser, r.device, r.checkId, a.attempt, e.kind) ||
              e.contentType !== contentType
            )
              fail(400, "INVALID_EVIDENCE", "Evidence key or media type is outside this result");
          }
        await tx.result.update({
          where: { id: result.id },
          data: {
            status: r.status === "failed" ? "FAIL" : "PASS",
            flaky: r.status === "flaky",
            attempts: {
              create: r.attempts.map((a) => ({
                number: a.attempt,
                status: a.status === "passed" ? "PASS" : "FAIL",
                durationMs: a.durationMs,
                error: a.error ?? "",
              })),
            },
            evidence: {
              create: r.attempts.flatMap((a) =>
                a.evidence.map((e) => ({
                  key: e.key,
                  kind: e.kind,
                  contentType: e.contentType,
                  sizeBytes: e.size,
                  ready: true,
                })),
              ),
            },
          },
        });
        await tx.run.update({ where: { id: run.id }, data: { status: "RUNNING" } });
        await tx.runEvent.create({
          data: {
            runId: run.id,
            data: {
              resultId: result.id,
              status: r.status === "failed" ? "FAIL" : "PASS",
              flaky: r.status === "flaky",
            },
          },
        });
      } else {
        if (body.resultCount !== run.results.length || run.results.some((r) => !r.attempts.length))
          fail(409, "INCOMPLETE_RUN", "All matrix results must be recorded first");
        const expected = run.results.some((r) => r.status === "FAIL")
          ? "failed"
          : run.results.some((r) => r.flaky)
            ? "flaky"
            : "passed";
        if (expected !== body.status)
          fail(400, "INVALID_COMPLETION", "Completion does not match persisted results");
        const status = { passed: "PASS", failed: "FAIL", flaky: "FLAKY" }[body.status];
        await tx.run.update({ where: { id: run.id }, data: { status } });
        await tx.runEvent.create({ data: { runId: run.id, data: { status } } });
      }
      await tx.callbackReceipt.create({ data: { id: body.eventId, runId: run.id, bodyHash } });
    });
    res.json({ data: { accepted: true } });
  });
}

export function mountExecution(
  app: Express,
  db: PrismaClient,
  config: Config,
  guard: (write?: boolean) => RequestHandler,
  fail: Fail,
  injectedStorage?: EvidenceStorage,
) {
  const base = "/api/v1/projects/:projectId";
  const store = injectedStorage ?? storage(config);
  const id = (req: { params: Record<string, unknown> }, key: string) =>
    z.string().min(1).max(100).parse(req.params[key]);
  const ownedRun = async (req: { params: Record<string, unknown> }) => {
    const run = await db.run.findFirst({
      where: { id: id(req, "runId"), projectId: id(req, "projectId") },
      include: detail,
    });
    if (!run) fail(404, "NOT_FOUND", "Run not found");
    return run;
  };
  app.post(
    `${base}/automated-runs`,
    guard(true),
    rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }),
    async (req, res) => {
      const body = automatedRunBody.parse(req.body);
      const projectId = id(req, "projectId");
      const idempotencyKey = z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/)
        .parse(req.get("Idempotency-Key"));
      const requestHash = digest(JSON.stringify(body));
      const data = await db.$transaction(async (tx) => {
        // Project lock makes concurrent use of an idempotency key return the same run.
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
        const old = await tx.run.findUnique({
          where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
          include: detail,
        });
        if (old) {
          if (old.requestHash !== requestHash)
            fail(409, "IDEMPOTENCY_CONFLICT", "Key was already used with a different request");
          return old;
        }
        if (
          !config.RUNNER_CALLBACK_SECRET ||
          !config.REDIS_URL ||
          (body.dispatch === "GITHUB" && (!config.GITHUB_TOKEN || !config.GITHUB_REPOSITORY))
        )
          fail(503, "EXECUTION_UNAVAILABLE", "Execution service is not configured");
        if (body.suiteId && !(await tx.suite.findFirst({ where: { id: body.suiteId, projectId } })))
          fail(404, "NOT_FOUND", "Suite not found");
        const runId = randomUUID();
        const job = {
          version: 1,
          runId,
          environment: body.environment.toLowerCase(),
          targetId: "threadline",
          checks: body.checks,
          matrix: body.matrix,
          retries: body.retries,
        };
        const run = await tx.run.create({
          data: {
            id: runId,
            projectId,
            suiteId: body.suiteId ?? null,
            environment: body.environment,
            browser: "matrix",
            device: "matrix",
            mode: "AUTOMATED",
            status: "QUEUED",
            dispatch: body.dispatch,
            idempotencyKey,
            requestHash,
            results: {
              create: body.matrix.flatMap((c) =>
                body.checks.map((check) => ({
                  caseId: check,
                  title: check,
                  version: 1,
                  steps: [],
                  ...c,
                })),
              ),
            },
            outbox: { create: { payload: job } },
          },
          include: detail,
        });
        await tx.runEvent.create({ data: { runId, data: { status: "QUEUED" } } });
        return run;
      });
      res.json({ data: publicRun(data) });
    },
  );
  app.get(`${base}/automated-runs`, guard(), async (req, res) => {
    const q = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(req.query);
    const rows = await db.run.findMany({
      where: { projectId: id(req, "projectId"), mode: "AUTOMATED" },
      orderBy: { id: "asc" },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: detail,
    });
    res.json({
      data: rows.slice(0, q.limit).map(publicRun),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/runs/:runId`, guard(), async (req, res) =>
    res.json({ data: publicRun(await ownedRun(req)) }),
  );
  app.get(`${base}/runs/:runId/events`, guard(), async (req, res) => {
    const run = await ownedRun(req);
    let cursor = z.coerce
      .number()
      .int()
      .min(0)
      .max(2147483647)
      .parse(req.get("Last-Event-ID") ?? req.query.after ?? 0);
    const sessionId = res.locals.sessionId as string;
    const tokenExpiresAt = res.locals.tokenExpiresAt as number;
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    let closed = false;
    res.on("close", () => {
      closed = true;
    });
    try {
      while (!closed) {
        const [session, member] = await Promise.all([
          db.session.findFirst({
            where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
          }),
          db.member.findUnique({
            where: {
              projectId_userId: { projectId: run.projectId, userId: res.locals.userId as string },
            },
          }),
        ]);
        if (!session || !member || Date.now() >= tokenExpiresAt) break;
        const events = await db.runEvent.findMany({
          where: { runId: run.id, id: { gt: cursor } },
          orderBy: { id: "asc" },
          take: 100,
        });
        for (const event of events) {
          if (!res.write(`id: ${event.id}\nevent: run\ndata: ${JSON.stringify(event.data)}\n\n`)) {
            closed = true;
            break;
          }
          cursor = event.id;
        }
        if (!events.length) res.write(": heartbeat\n\n");
        if (!closed)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, 1000);
            function done() {
              clearTimeout(timer);
              res.off("close", done);
              resolve();
            }
            res.once("close", done);
          });
      }
    } catch {
      /* A disconnected stream must never write a JSON error response. */
    } finally {
      res.end();
    }
  });
  const evidenceBase = `${base}/runs/:runId/results/:resultId/evidence`;
  const ownedResult = async (req: { params: Record<string, unknown> }) => {
    const run = await ownedRun(req);
    const result = run.results.find((r) => r.id === id(req, "resultId"));
    if (!result) fail(404, "NOT_FOUND", "Result not found");
    return { run, result };
  };
  app.post(evidenceBase, guard(true), async (req, res) => {
    const { run, result } = await ownedResult(req);
    if (run.mode !== "MANUAL") fail(409, "AUTOMATED_RESULT", "Manual uploads require a manual run");
    const body = screenshotBody.parse(req.body);
    if (!store) fail(503, "STORAGE_UNAVAILABLE", "Evidence storage is not configured");
    const key = `manual/${run.id}/${result.id}/${randomUUID()}.${body.contentType === "image/png" ? "png" : "jpg"}`;
    const uploadUrl = await store.upload(key, body.contentType, body.sizeBytes);
    const evidence = await db.evidence.create({
      data: { resultId: result.id, key, kind: "screenshot", ...body },
    });
    res.json({ data: { evidence, uploadUrl, expiresIn: 300 } });
  });
  const ownedEvidence = async (req: { params: Record<string, unknown> }) => {
    const { run, result } = await ownedResult(req);
    const evidence = result.evidence.find((e) => e.id === id(req, "evidenceId"));
    if (
      !evidence ||
      !(
        evidence.key.startsWith(`manual/${run.id}/${result.id}/`) ||
        evidence.key.startsWith(
          `runs/${run.id}/${result.browser}-${result.device}/${result.caseId}/`,
        )
      )
    )
      fail(404, "NOT_FOUND", "Evidence not found");
    return evidence;
  };
  app.post(`${evidenceBase}/:evidenceId/complete`, guard(true), async (req, res) => {
    const e = await ownedEvidence(req);
    if (!store) fail(503, "STORAGE_UNAVAILABLE", "Evidence storage is not configured");
    if (!(await store.verify(e.key, e.contentType, e.sizeBytes)))
      fail(409, "UPLOAD_INCOMPLETE", "Uploaded size or media type does not match reservation");
    res.json({ data: await db.evidence.update({ where: { id: e.id }, data: { ready: true } }) });
  });
  app.get(`${evidenceBase}/:evidenceId/url`, guard(), async (req, res) => {
    const e = await ownedEvidence(req);
    if (!e.ready) fail(409, "UPLOAD_INCOMPLETE", "Evidence is not ready");
    if (!store) fail(503, "STORAGE_UNAVAILABLE", "Evidence storage is not configured");
    res.json({ data: { url: await store.download(e.key), expiresIn: 300 } });
  });
}
