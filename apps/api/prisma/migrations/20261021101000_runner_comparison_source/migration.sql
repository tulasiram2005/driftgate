ALTER TABLE "EnvironmentComparison" DROP CONSTRAINT "EnvironmentComparison_source_check";
ALTER TABLE "EnvironmentComparison" ADD CONSTRAINT "EnvironmentComparison_source_check"
  CHECK ("source" IN ('MANUAL_IMPORT', 'RUNNER'));
