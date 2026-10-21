import { Prisma, type PrismaClient } from "../generated/client/index.js";
import { z } from "zod";

const environmentSchema = z.enum(["staging", "uat", "preprod", "prod"]);
const lineSchema = z.object({
  productId: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().positive().safe(),
  unitPriceCents: z.number().int().nonnegative().safe(),
  lineTotalCents: z.number().int().nonnegative().safe(),
});
const linesSchema = z.array(lineSchema).min(1).max(100);
export interface OrderCheckRow {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  items: unknown;
}
export function orderIsConsistent(order: OrderCheckRow): boolean {
  const parsed = linesSchema.safeParse(order.items);
  if (!parsed.success) return false;
  const amounts = [order.subtotalCents, order.discountCents, order.taxCents, order.totalCents];
  if (amounts.some((n) => !Number.isSafeInteger(n) || n < 0)) return false;
  const subtotal = parsed.data.reduce((sum, line) => sum + BigInt(line.lineTotalCents), 0n);
  return (
    parsed.data.every(
      (line) => BigInt(line.quantity) * BigInt(line.unitPriceCents) === BigInt(line.lineTotalCents),
    ) &&
    subtotal === BigInt(order.subtotalCents) &&
    order.discountCents <= order.subtotalCents &&
    subtotal - BigInt(order.discountCents) + BigInt(order.taxCents) === BigInt(order.totalCents)
  );
}

export interface SqlAssertionResult {
  check: "nonnegative-stock" | "order-totals" | "orphan-order-items";
  status: "PASS" | "FAIL";
  violations: number;
}

/** Fixed Threadline assertions. No user SQL, identifiers or connection URLs are accepted. */
export async function checkThreadlineDatabase(
  db: PrismaClient,
  environment: string,
): Promise<SqlAssertionResult[]> {
  const selected = environmentSchema.parse(environment);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1000ms'`;
      const roles = await tx.$queryRaw<{ unsafe: boolean }[]>`
      SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
        OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
        OR has_schema_privilege(current_user, 'public', 'CREATE')) AS unsafe
      FROM pg_roles r WHERE rolname = current_user`;
      if (roles.length !== 1 || roles[0]?.unsafe)
        throw new Error("SQL checks require a dedicated read-only role");
      const privileges = await tx.$queryRaw<{ unsafe: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND (pg_get_userbyid(c.relowner) = current_user
            OR has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      ) AS unsafe`;
      if (privileges[0]?.unsafe !== false) throw new Error("SQL role has write privileges");
      const stock = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM public."ProductSize" WHERE environment = ${selected} AND stock < 0`;
      const orders = await tx.$queryRaw<OrderCheckRow[]>`
      SELECT "subtotalCents", "discountCents", "taxCents", "totalCents", items
      FROM public."SandboxOrder" WHERE environment = ${selected} ORDER BY id LIMIT 10001`;
      if (orders.length > 10000)
        throw new Error("SQL check order limit exceeded; no partial pass is reported");
      const orphans = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM public."SandboxOrder" o
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) item
      WHERE o.environment = ${selected} AND NOT EXISTS (
        SELECT 1 FROM public."ProductSize" s WHERE s.environment = o.environment
          AND s."productId" = item->>'productId' AND s.label = item->>'size')`;
      const result = (
        check: SqlAssertionResult["check"],
        count: bigint | number,
      ): SqlAssertionResult => {
        const violations = Number(count);
        if (!Number.isSafeInteger(violations))
          throw new Error("SQL result exceeds safe count range");
        return { check, status: violations === 0 ? "PASS" : "FAIL", violations };
      };
      return [
        result("nonnegative-stock", stock[0]!.count),
        result("order-totals", orders.filter((order) => !orderIsConsistent(order)).length),
        result("orphan-order-items", orphans[0]!.count),
      ];
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 3000,
      timeout: 20000,
    },
  );
}
