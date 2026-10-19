BEGIN;
CREATE TABLE "TestStep" (
  "caseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "expected" TEXT NOT NULL,
  PRIMARY KEY ("caseId", "position"),
  FOREIGN KEY ("caseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "TestStep" ("caseId", "position", "action", "expected")
SELECT c."id", (s.ordinality - 1)::INTEGER, s.value->>'action', s.value->>'expected'
FROM "TestCase" c CROSS JOIN LATERAL jsonb_array_elements(c."steps") WITH ORDINALITY s;
CREATE TABLE "SuiteCase" (
  "suiteId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  PRIMARY KEY ("suiteId", "caseId"),
  FOREIGN KEY ("suiteId") REFERENCES "Suite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("caseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuiteCase_suiteId_position_key" ON "SuiteCase"("suiteId", "position");
CREATE INDEX "SuiteCase_caseId_idx" ON "SuiteCase"("caseId");
INSERT INTO "SuiteCase" ("suiteId", "caseId", "position")
SELECT s."id", c.value, (c.ordinality - 1)::INTEGER
FROM "Suite" s CROSS JOIN LATERAL unnest(s."caseIds") WITH ORDINALITY c(value, ordinality);
ALTER TABLE "TestCase" DROP COLUMN "steps";
ALTER TABLE "Suite" DROP COLUMN "caseIds";
COMMIT;
