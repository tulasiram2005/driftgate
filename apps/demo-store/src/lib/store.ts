import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getDb } from "./db";
import { calculateQuote, normalizeCart, type Cart } from "./cart";
import { StoreError } from "./errors";
import { getFlags, type BugFlag, type Environment } from "./flags";
import { presentProducts, type Product } from "./products";

type Reader = Pick<Prisma.TransactionClient, "product">;
async function readProducts(db: Reader, environment: Environment): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: { environment },
    include: { sizes: { orderBy: { label: "asc" } } },
    orderBy: { id: "asc" },
  });
  return rows.map(({ environment: _environment, sizes, ...product }) => ({
    ...product,
    sizes: sizes.map(({ label, stock }) => ({ label, stock })),
  }));
}
export async function getProducts(
  environment: Environment,
  flags: readonly BugFlag[] = getFlags(environment),
  db = getDb(),
) {
  return presentProducts(await readProducts(db, environment), flags);
}
export async function getProduct(
  environment: Environment,
  slug: string,
  flags: readonly BugFlag[] = getFlags(environment),
  db = getDb(),
) {
  const product = (await getProducts(environment, flags, db)).find((p) => p.slug === slug);
  if (!product) throw new StoreError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  return product;
}
export async function quote(
  environment: Environment,
  cart: Cart,
  flags: readonly BugFlag[] = getFlags(environment),
  db = getDb(),
) {
  return calculateQuote(cart, await readProducts(db, environment), flags);
}
function receipt(order: { id: string; totalCents: number }) {
  return { orderId: order.id, totalCents: order.totalCents, status: "SIMULATED" as const };
}
export async function checkout(
  environment: Environment,
  input: Cart & { idempotencyKey: string },
  flags: readonly BugFlag[] = getFlags(environment),
  db: PrismaClient = getDb(),
) {
  const cart = normalizeCart(input);
  const requestHash = createHash("sha256").update(JSON.stringify(cart)).digest("hex");
  const key = { environment, idempotencyKey: input.idempotencyKey };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.sandboxOrder.findUnique({
            where: { environment_idempotencyKey: key },
          });
          if (existing) {
            if (existing.requestHash !== requestHash)
              throw new StoreError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "This key was already used for a different cart.",
              );
            return receipt(existing);
          }
          const totals = calculateQuote(cart, await readProducts(tx, environment), flags);
          for (const item of totals.items) {
            const updated = await tx.productSize.updateMany({
              where: {
                environment,
                productId: item.productId,
                label: item.size,
                stock: { gte: item.quantity },
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count !== 1)
              throw new StoreError(409, "OUT_OF_STOCK", "Requested quantity is unavailable.");
          }
          const order = await tx.sandboxOrder.create({
            data: {
              ...key,
              requestHash,
              ...totals,
              items: totals.items as unknown as Prisma.InputJsonValue,
            },
          });
          return receipt(order);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      )
        continue;
      throw error;
    }
  }
  throw new StoreError(
    409,
    "CHECKOUT_BUSY",
    "Checkout was busy. Retry with the same idempotency key.",
  );
}
