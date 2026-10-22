ALTER TABLE "VisualBaseline"
  ADD COLUMN "ignoreRegions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "ignoreRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("ignoreRevision" >= 0),
  ADD COLUMN "ignoreUpdatedBy" TEXT,
  ADD COLUMN "ignoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "VisualComparison"
  ADD COLUMN "ignoreRegions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "ignoreRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("ignoreRevision" >= 0),
  ADD COLUMN "ignoredPixels" INTEGER NOT NULL DEFAULT 0 CHECK ("ignoredPixels" >= 0);
