import type { PrismaClient } from "@prisma/client";
import { environments } from "../src/lib/flags";
import { productSeeds } from "../src/lib/products";

export async function seedProducts(db: PrismaClient) {
  for (const environment of environments) {
    for (const { sizes, ...product } of productSeeds) {
      await db.$transaction(async (tx) => {
        await tx.product.upsert({
          where: { environment_id: { environment, id: product.id } },
          create: { environment, ...product },
          update: {},
        });
        for (const size of sizes) {
          await tx.productSize.upsert({
            where: {
              environment_productId_label: {
                environment,
                productId: product.id,
                label: size.label,
              },
            },
            create: { environment, productId: product.id, ...size },
            update: {},
          });
        }
      });
    }
  }
}
