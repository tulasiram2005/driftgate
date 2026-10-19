import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
extendZodWithOpenApi(z);

export const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const registration = credentials.extend({ name: z.string().trim().min(1).max(100) });
export const projectBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(4000).default(""),
  })
  .strict();
export const requirementBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).default(""),
  })
  .strict();
export const caseBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000).default(""),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    type: z.enum(["MANUAL", "AUTOMATED"]),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    requirementId: z.string().min(1).nullable().default(null),
    steps: z
      .array(
        z
          .object({
            action: z.string().trim().min(1).max(2000),
            expected: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const suiteBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    caseIds: z.array(z.string().min(1)).min(1).max(200),
  })
  .strict();
export const runBody = z
  .object({
    suiteId: z.string().min(1),
    environment: z.enum(["STAGING", "UAT", "PREPROD", "PROD"]),
    browser: z.string().trim().min(1).max(80),
    device: z.string().trim().min(1).max(80),
  })
  .strict();
export const resultBody = z
  .object({
    status: z.enum(["PASS", "FAIL", "BLOCKED", "SKIPPED"]),
    notes: z.string().max(10000).default(""),
  })
  .strict();
export const memberBody = z
  .object({ email: credentials.shape.email, role: z.enum(["QA", "DEVELOPER", "APPROVER"]) })
  .strict();
export const listQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().max(200).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});
