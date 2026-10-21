import { expect, test } from "vitest";
import { orderIsConsistent } from "../src/sql-checks.js";

const order = {
  subtotalCents: 200,
  discountCents: 20,
  taxCents: 15,
  totalCents: 195,
  items: [{ productId: "demo", size: "S", quantity: 2, unitPriceCents: 100, lineTotalCents: 200 }],
};
test("SQL assertion validates line arithmetic and order adjustments", () => {
  expect(orderIsConsistent(order)).toBe(true);
  expect(orderIsConsistent({ ...order, totalCents: 200 })).toBe(false);
  expect(orderIsConsistent({ ...order, subtotalCents: 201 })).toBe(false);
  expect(orderIsConsistent({ ...order, discountCents: 201 })).toBe(false);
  expect(orderIsConsistent({ ...order, items: [{ ...order.items[0], quantity: 3 }] })).toBe(false);
});
test("SQL assertion fails closed on malformed or unbounded order data", () => {
  for (const items of [
    null,
    {},
    [],
    [{ ...order.items[0], quantity: -1 }],
    [{ ...order.items[0], unitPriceCents: "100" }],
    Array(101).fill(order.items[0]),
  ])
    expect(orderIsConsistent({ ...order, items })).toBe(false);
  expect(orderIsConsistent({ ...order, taxCents: NaN })).toBe(false);
});
