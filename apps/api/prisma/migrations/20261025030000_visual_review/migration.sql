ALTER TABLE "VisualComparison"
 ADD COLUMN "reviewDecision" TEXT,
 ADD COLUMN "reviewedBy" TEXT,
 ADD COLUMN "reviewedAt" TIMESTAMP(3),
 ADD COLUMN "reviewComment" TEXT,
 ADD CONSTRAINT "visual_review_complete" CHECK (
   ("reviewDecision" IS NULL AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "reviewComment" IS NULL)
   OR ("reviewDecision" IN ('ACCEPTED', 'REJECTED') AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewComment" IS NOT NULL AND length(trim("reviewComment")) > 0)
 );
