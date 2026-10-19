import { PrismaClient } from "@prisma/client";
import { seedProducts } from "./seed-data";

const db = new PrismaClient();
seedProducts(db)
  .then(() => console.log("Threadline demo products seeded without resetting existing data."))
  .catch(() => {
    console.error("Threadline seed failed. Check database availability and migrations.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
