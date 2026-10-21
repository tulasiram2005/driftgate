import { z } from "zod";
import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "../generated/client/index.js";

const text = z.string().max(4096);
const amount = z.union([z.number().int().nonnegative().safe(), z.string().min(1).max(100)]);
const product = z
  .object({
    id: z.string().trim().min(1).max(200),
    priceCents: amount,
    compareAtCents: amount.nullable(),
    currency: z.literal("INR"),
    sizes: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(100),
            stock: z.number().int().nonnegative().safe(),
          })
          .strict(),
      )
      .max(100),
    discountPercent: z.number().min(0).max(100).nullable(),
    badge: text.nullable(),
    image: z
      .object({
        status: z.number().int().min(100).max(599).nullable(),
        width: z.number().int().nonnegative().safe().nullable(),
        height: z.number().int().nonnegative().safe().nullable(),
      })
      .strict(),
    title: text.nullable(),
    canonical: text.nullable(),
    jsonLd: z
      .object({
        "@context": text.optional(),
        "@type": z.literal("Product"),
        name: text,
        description: text.optional(),
        image: text.optional(),
        sku: text,
        offers: z
          .object({
            "@type": z.literal("Offer"),
            price: text,
            priceCurrency: z.literal("INR"),
            availability: text,
            url: text,
          })
          .strict(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const snapshotBody = z
  .object({
    label: z.string().trim().min(1).max(120),
    snapshot: z
      .object({
        environment: z.enum(["staging", "uat", "preprod", "prod"]),
        origin: z.literal("http://127.0.0.1:3201"),
        locale: z.literal("en-IN"),
        productCount: z.number().int().min(0).max(20),
        products: z.array(product).max(20),
      })
      .strict()
      .superRefine((s, ctx) => {
        if (
          s.productCount !== s.products.length ||
          new Set(s.products.map((p) => p.id)).size !== s.products.length ||
          s.products.some(
            (p) => new Set(p.sizes.map((size) => size.label.toUpperCase())).size !== p.sizes.length,
          )
        )
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Snapshot counts and identities must be consistent",
          });
      }),
  })
  .strict();
const listing = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().min(1).max(100).optional(),
  })
  .strict();
const metadata = {
  id: true,
  projectId: true,
  label: true,
  environment: true,
  source: true,
  createdBy: true,
  createdAt: true,
} as const;

export function mountSnapshots(
  app: Express,
  db: PrismaClient,
  guard: (write?: boolean) => RequestHandler,
  fail: (status: number, code: string, message: string) => never,
) {
  const base = "/api/v1/projects/:projectId/snapshots";
  const id = (value: unknown) => z.string().min(1).max(100).parse(value);
  const limit = rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: { code: "RATE_LIMITED", message: "Too many imports. Try again later." } });
    },
  });
  app.post(base, guard(true), limit, async (req, res) => {
    const body = snapshotBody.parse(req.body);
    res.json({
      data: await db.environmentSnapshot.create({
        data: {
          projectId: id(req.params.projectId),
          label: body.label,
          environment: body.snapshot.environment,
          source: "MANUAL_IMPORT",
          createdBy: res.locals.userId as string,
          snapshot: JSON.parse(JSON.stringify(body.snapshot)),
        },
      }),
    });
  });
  app.get(base, guard(), async (req, res) => {
    const query = listing.parse(req.query);
    const projectId = id(req.params.projectId);
    if (
      query.cursor &&
      !(await db.environmentSnapshot.findFirst({
        where: { id: query.cursor, projectId },
        select: { id: true },
      }))
    )
      fail(404, "NOT_FOUND", "Snapshot cursor not found");
    const rows = await db.environmentSnapshot.findMany({
      where: { projectId },
      select: metadata,
      take: query.limit + 1,
      orderBy: { id: "asc" },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json({
      data: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    });
  });
  app.get(`${base}/:snapshotId`, guard(), async (req, res) => {
    const row = await db.environmentSnapshot.findFirst({
      where: { id: id(req.params.snapshotId), projectId: id(req.params.projectId) },
    });
    if (!row) fail(404, "NOT_FOUND", "Snapshot not found");
    res.json({ data: row });
  });
}
