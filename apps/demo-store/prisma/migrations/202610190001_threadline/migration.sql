CREATE TABLE "Product" (
  "environment" TEXT NOT NULL CHECK ("environment" IN ('staging','uat','preprod','prod')),
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT NOT NULL, "category" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL CHECK ("priceCents" >= 0),
  "compareAtCents" INTEGER CHECK ("compareAtCents" >= 0),
  "image" TEXT NOT NULL, "imageAlt" TEXT NOT NULL, "featured" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("environment", "id")
);
CREATE UNIQUE INDEX "Product_environment_slug_key" ON "Product"("environment", "slug");
CREATE TABLE "ProductSize" (
  "environment" TEXT NOT NULL, "productId" TEXT NOT NULL, "label" TEXT NOT NULL,
  "stock" INTEGER NOT NULL CHECK ("stock" >= 0),
  PRIMARY KEY ("environment", "productId", "label"),
  FOREIGN KEY ("environment", "productId") REFERENCES "Product"("environment", "id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE TABLE "SandboxOrder" (
  "id" TEXT PRIMARY KEY, "environment" TEXT NOT NULL CHECK ("environment" IN ('staging','uat','preprod','prod')),
  "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL CHECK ("subtotalCents" >= 0),
  "discountCents" INTEGER NOT NULL CHECK ("discountCents" >= 0 AND "discountCents" <= "subtotalCents"),
  "taxCents" INTEGER NOT NULL CHECK ("taxCents" >= 0),
  "totalCents" INTEGER NOT NULL CHECK ("totalCents" = "subtotalCents" - "discountCents" + "taxCents"),
  "status" TEXT NOT NULL DEFAULT 'SIMULATED' CHECK ("status" = 'SIMULATED'),
  "items" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SandboxOrder_environment_idempotencyKey_key" ON "SandboxOrder"("environment", "idempotencyKey");
CREATE INDEX "SandboxOrder_environment_createdAt_idx" ON "SandboxOrder"("environment", "createdAt");
