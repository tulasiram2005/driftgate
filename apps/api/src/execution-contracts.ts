import { z } from "zod";
import { snapshotBody } from "./snapshots.js";

export const checks = [
  "catalogue",
  "product",
  "cart",
  "api-contract",
  "accessibility",
  "snapshot",
] as const;
export const cell = z
  .object({
    browser: z.enum(["chromium", "firefox", "webkit"]),
    device: z.enum(["desktop", "mobile"]),
  })
  .strict();
export const automatedRunBody = z
  .object({
    suiteId: z.string().min(1).max(80).optional(),
    checks: z
      .array(z.enum(checks))
      .min(1)
      .max(checks.length)
      .refine((a) => new Set(a).size === a.length, "Duplicate checks")
      .default(["catalogue", "product", "cart"]),
    environment: z.enum(["STAGING", "UAT", "PREPROD", "PROD"]),
    matrix: z
      .array(cell)
      .min(1)
      .max(9)
      .refine(
        (a) => new Set(a.map((c) => `${c.browser}/${c.device}`)).size === a.length,
        "Duplicate matrix cells",
      ),
    dispatch: z.enum(["LOCAL", "GITHUB"]).default("LOCAL"),
    retries: z.number().int().min(0).max(2).default(1),
  })
  .strict();
const evidence = z
  .object({
    kind: z.enum(["screenshot", "video", "trace"]),
    key: z.string().min(1).max(500),
    contentType: z.enum(["image/png", "video/webm", "application/zip"]),
    size: z
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024),
  })
  .strict();
export const callbackBody = z.discriminatedUnion("type", [
  z
    .object({
      version: z.literal(1),
      eventId: z.string().uuid(),
      runId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      type: z.literal("result"),
      result: z
        .object({
          checkId: z.enum(checks),
          ...cell.shape,
          status: z.enum(["passed", "failed", "flaky"]),
          snapshot: snapshotBody.shape.snapshot.optional(),
          attempts: z
            .array(
              z
                .object({
                  attempt: z.number().int().min(1).max(3),
                  status: z.enum(["passed", "failed"]),
                  durationMs: z.number().int().min(0).max(86400000),
                  error: z.string().max(10000).optional(),
                  evidence: z.array(evidence).max(10),
                })
                .strict(),
            )
            .min(1)
            .max(3),
        })
        .strict()
        .superRefine((r, ctx) => {
          const required = r.checkId === "snapshot" && r.status !== "failed";
          if (required !== (r.snapshot !== undefined))
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["snapshot"],
              message: "Snapshot is required only for successful snapshot results",
            });
        }),
    })
    .strict(),
  z
    .object({
      version: z.literal(1),
      eventId: z.string().uuid(),
      runId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      type: z.literal("completed"),
      status: z.enum(["passed", "failed", "flaky"]),
      resultCount: z
        .number()
        .int()
        .min(1)
        .max(checks.length * 9),
    })
    .strict(),
]);
export const screenshotBody = z
  .object({
    contentType: z.enum(["image/png", "image/jpeg"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
  })
  .strict();
