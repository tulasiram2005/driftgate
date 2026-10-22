# Visual comparisons

An ADMIN or QA selects **Compare with baseline** beside ready automated
screenshot evidence. The API selects the active approved baseline matching the
project, environment, browser, device, check and viewport. Comparing the baseline
to itself is rejected.

## API

- POST /api/v1/projects/:projectId/visual-comparisons accepts only evidenceId.
- GET /api/v1/projects/:projectId/visual-comparisons returns cursor-paginated
  metrics and baseline labels, without private storage keys.
- GET /api/v1/projects/:projectId/visual-comparisons/:comparisonId/url issues
  a short-lived private difference URL for project members.

The shared PNG engine uses pixelmatch threshold 0.1 with antialiasing differences
included. A zero changed-pixel count means no detected changes; nonzero results
are observations, not automatic release approval or rejection. API processes
allow only one comparison at a time, returning a retryable 429 while busy.
Screenshots are bounded to 16 MiB and eight million pixels, and must match the
runner viewport (desktop 1280x900 or mobile 390x844).

Original screenshots remain unchanged. Difference PNGs live under a
server-generated private visual/project/UUID key. Records retain baseline and
new screenshot IDs, actor, timestamp, dimensions and pixel counts. The web
baseline workspace shows persisted results and fetches private preview/download
URLs on demand.

## Verification and limits

Local API integration verifies actual PNG decoding, exact changed counts,
database persistence, permissions, missing or mismatched evidence, corrupt PNGs,
storage failures and recovery. Storage is injected in memory in these tests;
these are not cloud-storage round-trip tests.

The migration is applied to the isolated local test database only. Cloud
migration and real hosted visual comparison remain unverified. Browser tests
currently cannot launch in the macOS sandbox. Ignore-region persistence is not
implemented; comparisons currently use all pixels. A database failure after a
successful object upload can leave an unreferenced private difference object;
storage lifecycle cleanup is not yet implemented.
