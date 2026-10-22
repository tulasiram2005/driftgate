ALTER TABLE "EnvironmentComparison" ADD COLUMN "expectedRules" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "EnvironmentComparison" ADD CONSTRAINT "EnvironmentComparison_rules_array"
  CHECK (jsonb_typeof("expectedRules") = 'array' AND jsonb_array_length("expectedRules") <= 100);
