ALTER TABLE "Run" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "runId" TEXT,
  ADD COLUMN "browser" TEXT, ADD COLUMN "device" TEXT;
ALTER TABLE "EnvironmentSnapshot" DROP CONSTRAINT "EnvironmentSnapshot_source_check";
ALTER TABLE "EnvironmentSnapshot" ADD CONSTRAINT "EnvironmentSnapshot_source_check" CHECK (
  ("source" = 'MANUAL_IMPORT' AND "runId" IS NULL AND "browser" IS NULL AND "device" IS NULL)
  OR ("source" = 'RUNNER' AND "runId" IS NOT NULL
    AND "browser" IS NOT NULL AND "browser" IN ('chromium','firefox','webkit')
    AND "device" IS NOT NULL AND "device" IN ('desktop','mobile'))
);
CREATE UNIQUE INDEX "EnvironmentSnapshot_runId_browser_device_key"
  ON "EnvironmentSnapshot"("runId", "browser", "device");
ALTER TABLE "EnvironmentSnapshot" ADD CONSTRAINT "EnvironmentSnapshot_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE FUNCTION reject_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Environment snapshots are immutable';
END;
$$;
CREATE TRIGGER "EnvironmentSnapshot_immutable" BEFORE UPDATE ON "EnvironmentSnapshot"
  FOR EACH ROW WHEN (OLD."source" = 'RUNNER') EXECUTE FUNCTION reject_snapshot_update();
