import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkout, getProducts, quote } from "../src/lib/store";
import { seedProducts } from "../prisma/seed-data";
import { productSeeds } from "../src/lib/products";

const url = process.env.TEST_DATABASE_URL;
if (url && !/^\/[^/]+_test$/.test(new URL(url).pathname))
  throw new Error("TEST_DATABASE_URL database name must end in _test.");
describe.skipIf(!url)("PostgreSQL integration (dedicated test database only)", () => {
  let db: PrismaClient;
  const id = `test_${randomUUID()}`;
  const cart = { items: [{ productId: id, size: "M", quantity: 1 }], coupons: [] };
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: url! } } });
    await seedProducts(db);
    for (const environment of ["staging", "uat"]) {
      const { sizes: _sizes, ...product } = productSeeds[0]!;
      expect(_sizes.length).toBeGreaterThan(0);
      await db.product.create({
        data: {
          ...product,
          id,
          slug: id,
          environment,
          sizes: {
            create: [
              { label: "M", stock: 2 },
              { label: "L", stock: 0 },
            ],
          },
        },
      });
    }
  });
  afterAll(async () => {
    if (!db) return;
    try {
      const orders = await db.sandboxOrder.findMany({
        where: { environment: { in: ["staging", "uat"] } },
      });
      const owned = orders.filter(
        (order) =>
          Array.isArray(order.items) &&
          order.items.some(
            (item) =>
              item !== null &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              item.productId === id,
          ),
      );
      await db.sandboxOrder.deleteMany({ where: { id: { in: owned.map((order) => order.id) } } });
      await db.productSize.deleteMany({
        where: { productId: id, environment: { in: ["staging", "uat"] } },
      });
      await db.product.deleteMany({ where: { id, environment: { in: ["staging", "uat"] } } });
    } finally {
      await db.$disconnect();
    }
  });
  it("preserves stock and orders across repeated seeding", async () => {
    const before = await db.productSize.findMany({
      orderBy: [{ environment: "asc" }, { productId: "asc" }, { label: "asc" }],
    });
    const orders = await db.sandboxOrder.count();
    await seedProducts(db);
    expect(
      await db.productSize.findMany({
        orderBy: [{ environment: "asc" }, { productId: "asc" }, { label: "asc" }],
      }),
    ).toEqual(before);
    expect(await db.sandboxOrder.count()).toBe(orders);
  });
  it("returns products without internal fields and canonical quote totals", async () => {
    const products = await getProducts("staging", [], db);
    expect(products.find((p) => p.id === id)).not.toHaveProperty("environment");
    expect(await quote("staging", cart, [], db)).toMatchObject({ totalCents: 4329 });
  });
  it("rolls back a multi-item cart when a size is unavailable", async () => {
    await expect(
      checkout(
        "staging",
        {
          ...cart,
          items: [...cart.items, { productId: id, size: "L", quantity: 1 }],
          idempotencyKey: randomUUID(),
        },
        [],
        db,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await db.productSize.findUniqueOrThrow({
          where: {
            environment_productId_label: { environment: "staging", productId: id, label: "M" },
          },
        })
      ).stock,
    ).toBe(2);
  });
  it("deduplicates concurrent retries, rejects changed payloads, isolates environments and prevents overselling", async () => {
    const idempotencyKey = randomUUID();
    const results = await Promise.all([
      checkout("staging", { ...cart, idempotencyKey }, [], db),
      checkout("staging", { ...cart, idempotencyKey }, [], db),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.sandboxOrder.count({ where: { environment: "staging", idempotencyKey } })).toBe(
      1,
    );
    await expect(
      checkout("staging", { ...cart, coupons: ["WELCOME10"], idempotencyKey }, [], db),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const other = await checkout("uat", { ...cart, idempotencyKey }, [], db);
    expect(other.orderId).not.toBe(results[0]?.orderId);
    const competing = await Promise.allSettled([
      checkout("staging", { ...cart, idempotencyKey: randomUUID() }, [], db),
      checkout("staging", { ...cart, idempotencyKey: randomUUID() }, [], db),
    ]);
    expect(competing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await db.productSize.findUniqueOrThrow({
          where: {
            environment_productId_label: { environment: "staging", productId: id, label: "M" },
          },
        })
      ).stock,
    ).toBe(0);
    expect(await checkout("staging", { ...cart, idempotencyKey }, [], db)).toEqual(results[0]);
    const order = await db.sandboxOrder.findUniqueOrThrow({
      where: { environment_idempotencyKey: { environment: "staging", idempotencyKey } },
    });
    expect(order.totalCents).toBe(order.subtotalCents - order.discountCents + order.taxCents);
    expect(order.status).toBe("SIMULATED");
  });
});
