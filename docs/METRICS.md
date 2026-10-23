# Measured evidence

## SQL result persistence (2026-10-23)

- API: 91/91 passed after renewing network access. Earlier attempt could not
  reach the isolated database and is not counted as a product-test pass.
- Real Threadline read-only SQL integration passed: write denial, unsafe-role
  rejection, environment validation and seeded total/orphan defect detection.
- Web unit tests: 40/40. API build, web production build (webpack) and scoped
  API/web lint passed.
- Local migration 20261023050000_sql_check_results applied.
- GitHub 39868253087: cancelled during browser installation; browser and runner
  browser fixtures skipped. No new screenshot verification claimed.

## Saved ignore regions (2026-10-23)

- API 89/89 tests pass. New integration covers persistence/reuse, exact masked
  pixel counts, immutable comparison history, role restrictions, stale revisions,
  invalid coordinates and full-coverage rejection.
- Runner 38/38 tests pass after sharing the region-mask validator.
- API build, web typecheck and scoped lint pass.
- Migration 20261023040000_visual_ignore_regions applied to isolated local DB.
- UI browser fixture extended to save/reopen regions and capture four widths.
  Browser execution and cloud migration remain NOT VERIFIED.

## Persisted visual comparisons (2026-10-23)

- API regression: 88/88 passed, including actual PNG comparison and PostgreSQL
  persistence with injected in-memory evidence storage.
- Runner: 38/38 passed after sharing the comparison engine with the API.
- Web unit tests: 40/40 passed; web typecheck passed.
- API build and scoped API/runner/shared/web lint passed.
- Web production build: next build --webpack passed.
- Local migration 20261023030000_visual_comparisons applied to driftgate_test.
- Browser checks: NOT VERIFIED. Initial run lacked engines; after installation,
  Chromium failed before test execution with macOS MachPort permission denied.
- Cloud migration, hosted storage round trip and screenshot review NOT VERIFIED.

## Private screenshot reading (2026-10-23)

- API regression: 85/85 tests passed. Added exact/chunked read, truncation,
  excess bytes, invalid sizes, pre-aborted/stalled read and storage metadata tests.
- API build and lint passed. Reader is capped at 16 MiB, verifies recorded size
  and PNG content type, and aborts S3 transport after 15 seconds. It uses the
  server-configured bucket and key, not a client-supplied download URL.
- Storage test uses mocked S3 responses, not a live cloud read. Comparison
  endpoint and persisted difference results remain unimplemented.

## Active baseline checkpoint (2026-10-23)

- Isolated local migration passed. API regression: 80/80 tests passed.
- Tests verify role/ownership rejection, approved-only activation, unchanged
  repeat-activation metadata, exact-scope replacement and isolation from UAT.
- API build and web typecheck passed. Expanded browser fixtures cover approval,
  rejection and activation; execution and visual screenshot review remain pending.
- No cloud migration applied; no paid resource or temporary worker started.

## Baseline review UI checkpoint (2026-10-23)

- Web typecheck, lint and unit tests (40/40) passed. API tests (79/79) and
  production build passed, including a check that list responses omit storage keys.
- Added three-browser fixture coverage for candidate inspection, rejection,
  accessibility, screenshots and horizontal overflow at four viewport widths.
  Candidate responses are mocked; this is UI fixture coverage, not hosted
  storage or full-stack baseline verification. Execution remains pending.
- Local Next build fails because Turbopack cannot bind a port in the sandbox.
- Previous baseline API revision a426795 passed hosted Quality Gates 39827414205
  and CodeQL 39827414218. This does not verify the new UI changes.

## Visual baseline candidate API

- Isolated local driftgate_test migration applied successfully.
- API suite: 79/79 passed, including candidate permissions, server-owned scope,
  pending/manual evidence rejection, duplicate rejection, read access, missing
  cursors, required review comments and competing reviewer decisions (200/409).
- API production build and lint passed. Cloud migration, browser UI and hosted
  visual workflow remain NOT VERIFIED. See VISUAL_BASELINES.md.

## PNG comparison adapter (2026-10-22)

- Runner tests: 38/38 pass. Added PNG roundtrip/diff, ignore mask, corrupt CRC,
  truncation, byte/pixel limits, duplicate header and trailing-data tests.
- Runner build passed after correcting PNG writer typing; lint passed.
- Decoder accepts ordinary 8-bit non-interlaced RGB/RGBA screenshots only,
  capped at 16 MiB compressed and eight million pixels. Duplicate headers and
  animated PNG control chunks are rejected before decoding.
- No baseline persistence, reviewer workflow or hosted visual execution claim.

## Visual comparison engine (2026-10-22)

- Added pixelmatch 7.1.0 for decoded RGBA screenshot comparisons, with fixed
  perceptual threshold 0.1 and anti-alias differences included.
- Runner tests: 33/33 passed, including five visual comparison tests covering
  identical/changed pixels, nonmutation, overlapping ignore regions, correct
  denominator, malformed images, dimension mismatch and full-image mask rejection.
- Runner build and lint passed. Images are bounded to eight million pixels;
  at most 100 in-bounds integer ignore rectangles are accepted.
- PNG decoding, baseline storage/scope, reviewer approval/rejection and UI are
  not yet integrated. These unit results do not establish visual workflow readiness.

## Saved comparisons (2026-10-21)

- API: 73/73 tests passed against isolated local driftgate_test, including 15
  comparison tests for computed findings, roles, ownership, invalid inputs,
  immutable results, metadata-only pagination and foreign cursor rejection.
- Runner: 28/28 tests passed after sharing the unchanged comparison engine.
- API and runner production builds, API and shared-package lint: passed.
- Local comparison migration: passed. Cloud migrations and new hosted CI are
  not yet verified. GPT-6.1 Sol authored comparison tests; parent reviewed/run them.

## Phase 4 snapshot storage checkpoint (2026-10-21)

- Isolated local driftgate_test migration: passed, adding EnvironmentSnapshot.
- API tests: 58/58 passed, including 24 snapshot tests for roundtrip, provenance,
  metadata-only lists, pagination, permission checks, cross-project isolation,
  bounds, malformed inputs, rate limiting and immutable routes.
- API typecheck, production build and lint passed.
- New hosted CI and cloud migration are not yet verified. No UI was changed.
- GPT-6.1 Sol wrote the initial snapshot tests; parent reviewed and adjusted
  rate-limit isolation and added cursor/rate-limit regression coverage.

## Phase 4 snapshot collector checkpoint (2026-10-21)

Verified revision `d18f677`: [Quality Gates 39546993585](https://github.com/tulasiram2005/driftgate/actions/runs/39546993585)
and [CodeQL 39546993724](https://github.com/tulasiram2005/driftgate/actions/runs/39546993724)
passed. The expanded Chromium fixture verifies rendered-price and missing-metadata
drift, broken-image observations, rejection of malformed/duplicate metadata and
failed navigation, response-listener cleanup and successful reuse after failure.
The first run on `d913338` failed because tsx injected __name into a nested
browser-evaluated function; removing that nested helper fixed the failure.
All workflow steps passed, including SQL integration, browser/accessibility
regression and dependency audit. These are fixture results, not a real-store
coverage or complete Phase 4 claim.

- Runner unit tests: 28/28 passed (five new snapshot parser tests).
- Runner typecheck, lint and production build: passed.
- Browser integration: NOT VERIFIED locally; Chromium bootstrap_check_in denied
  by macOS sandbox. CI includes a fully intercepted demo fixture for collection,
  broken-image observations, metadata and rendered-price comparison.
- No real storefront detection rate, persistent snapshot or end-to-end UI claim.

## Phase 4 SQL checkpoint (2026-10-21)

Revision `82390a0` passed hosted [Quality Gates 39543943816](https://github.com/tulasiram2005/driftgate/actions/runs/39543943816)
and [CodeQL 39543943740](https://github.com/tulasiram2005/driftgate/actions/runs/39543943740).
Quality Gates included the restricted SQL integration, browser/accessibility
regression, quality detection fixtures, build, tests, lint and dependency audit.

- `TEST_DATABASE_URL=<local threadline_test URL> node --import tsx integration/sql-checks.ts`
  from apps/api: PASS. Verified SELECT-only role execution, actual write denial,
  privileged/writable-role rejection, invalid environment rejection, and seeded
  order-total/orphan violation deltas. Temporary fixture/role cleanup completed.
- API regression: 34/34 tests passed against isolated `driftgate_test`.
- API typecheck, lint and production build passed.
- No cloud SQL check, dashboard result persistence or complete Phase 4 claim.

## Phase 4 initial checkpoint (2026-10-21)

CI follow-up: `0a7a315` passed Quality Gates run 39543108410 and CodeQL run 39543108381. The runner quality fixture's four clean/seeded-failure assertions
passed in Chromium. The initial run failed because the fixture used the implicit
browser.newPage context; it now uses browser.newContext followed by context.newPage.
The production runner already used explicit contexts. All quality workflow
steps passed, including browser/accessibility checks and dependency audit.

- `pnpm --filter @driftgate/runner test`: 23/23 pass.
- `TEST_API_DATABASE_URL=<isolated local driftgate_test URL> pnpm --filter @driftgate/api test`: 32/32 pass.
- API and runner `build` and `lint`: pass. Runner `typecheck`: pass.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/driftgate-browsers node --import tsx integration/quality.ts`
  from apps/runner: NOT VERIFIED locally; Chromium launch denied by macOS sandbox.
  A CI step runs the same clean/seeded-failure fixture test. No detection rate
  against the real bug bank is claimed. See PHASE4.md for remaining scope.

## Hosted runner permission correction (2026-10-21)

Hosted run 39516931241 successfully installed, built and tested the runner, but
failed in the evidence relay with EACCES reading /spool/001.json. The browser
writes owner-only files as UID 1001; the relay previously ran as root with all
capabilities dropped and could not override Linux ownership permissions.
The relay now uses UID/GID 1001 while retaining read-only mounts and dropped
capabilities. Runner tests pass 9/9; runner typecheck and lint pass. A Docker
check verified UID 1001 can read a mode-0600 file with all capabilities dropped.
Hosted retest succeeded on revision `9f6ca5c`:
https://github.com/tulasiram2005/driftgate/actions/runs/39517721256
Run `624af60c-d3a6-473e-824b-304da5c4f997` was created through the authenticated
Render API, dispatched by the temporary local worker through Upstash, and
executed on GitHub. The API persisted PASS with one passing Chromium desktop
catalogue result and three artifacts. Authorized downloads returned HTTP 200:
screenshot 629,484 bytes, trace 865,149 bytes, video 232,367 bytes. All three
matched stored sizes, used 300-second signed links and rejected unsigned GET
with HTTP 403. Elapsed-time expiry was not tested. This verifies one hosted
happy-path configuration, not every matrix combination or failure mode.

## Phase 3 local checkpoint (2026-10-20)

Frozen install, typecheck, lint, unit/integration tests and production build passed.
Full browser regression: DriftGate 24/24 and Threadline 18/18 passed. New automated
results were checked at 360, 768, 1280 and 1920 pixels, including screenshots and
automated accessibility checks. See [PHASE3.md](PHASE3.md) for separate fixture,
actual runner evidence and explicit remaining integration gates. Hosted storage,
GitHub runner execution and deployment are not claimed by these local results.

Local queue-to-storage integration passed on 2026-10-20. A run created through the
authenticated API moved through the durable outbox and BullMQ into the isolated
Threadline Chromium runner. The relay uploaded three artifacts and delivered signed
callbacks; the API persisted PASS with one result and one attempt. The authenticated
download endpoint returned a 300-second signed URL and 629,484 bytes, exactly matching
the stored metadata. LocalStack was used, so this does not verify a cloud provider's
private-bucket policy. API regression after the local transport changes: 30/30 tests.
Runner regression: 8/8 tests. API and runner typecheck and lint passed.

Final local regression after the integration fix: frozen install, workspace
typecheck, lint, 131 unit/integration tests and all four production builds passed.
Browser coverage passed 42/42 checks across Chromium, Firefox and WebKit: 18
Threadline storefront checks, 21 DriftGate workspace/design checks and 3 automated
matrix callback checks. Dependency audit reported no known vulnerabilities. The
first browser harness attempts used the wrong API port, omitted the fixed Docker
browser origin and used the Docker hostname from a host-side callback client. Those
environment errors were corrected and the affected suites rerun; no product rule or
assertion was disabled.

Corrected isolated actual-Threadline matrix: 18/18 checks passed across all three
engines and two viewport modes, with 54 nonempty evidence files whose byte lengths
matched the callback spool. This is browser emulation, not physical-device testing.

Failures found during verification: proxy buffering delayed SSE; Firefox could
not write its container home; initial renewed-session tests lacked network access.
The SSE header/response-close fixes pass all three browser engines; corrected
pwuser UID/GID 1001 passes isolated Firefox startup. Tests were rerun successfully
after local-network permission was restored.

## Phase 2 local verification (2026-10-19)

Node 22.19.0, pnpm 10.18.3. The existing Phase 1 changes were preserved and reverified before adding the Phase 2 API/workspace. Bulk UI implementation used a GPT-6.1 Sol subagent; API integration and verification were performed in the parent session. No Astra delegation was used.

| Gate                            | Observed result                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Frozen install                  | PASS after synchronizing newly added workspace dependencies into the lockfile                                       |
| Typecheck                       | PASS, four workspace tasks (some cached)                                                                            |
| Lint/format                     | PASS, four workspace tasks plus root tooling/formatting                                                             |
| Unit/integration                | PASS, 102 tests: 21 runtime, 33 web (8 contrast + 25 client), 34 storefront, 14 API integration                     |
| API coverage                    | 88.31% statements, 68.64% branches, 81.81% functions, 90.65% lines for app/config/contracts; bootstrap not measured |
| Web helper coverage             | 100% for contrast/client helpers; not whole-UI coverage                                                             |
| Production build                | PASS, all four workspace tasks                                                                                      |
| Dependency audit                | PASS, no known vulnerabilities found                                                                                |
| Store browser regression        | PASS, 18 tests across Chromium/Firefox/WebKit in 38.6s; no retries                                                  |
| QA workspace/browser regression | PASS, 21 tests across Chromium/Firefox/WebKit; no retries                                                           |
| Hosted CI / CodeQL              | PASS for implementation revision 186142e                                                                            |
| Deployment / real devices       | Not deployed / NOT VERIFIED                                                                                         |

Tests use separate `driftgate_test` (55435) and `threadline_test` (55433) databases. API tests refuse absent, remote or incorrectly named database URLs and delete only the records they created. Browser checks create uniquely named test accounts/projects in the test database. They never reset the demo database. The authorization matrix covers every protected nested endpoint against both unauthenticated requests and a nonmember; role tests cover ADMIN, QA, DEVELOPER and APPROVER. Additional assertions cover expired JWTs, refresh rotation/replay/logout, validation, rate limiting, CSV atomicity, immutable version history, and preserved run snapshots after edits/archives.

Commands, run from the repo root with the pinned npm wrapper (`npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm`):

```sh
docker compose -f compose.driftgate.yml up -d --wait
docker compose -f compose.threadline.yml up -d --wait
DATABASE_URL=postgresql://driftgate:local-test-only@127.0.0.1:55435/driftgate_test pnpm --filter @driftgate/api db:migrate
DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm --filter @driftgate/demo-store db:migrate
DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm --filter @driftgate/demo-store db:seed
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
TEST_API_DATABASE_URL=postgresql://driftgate:local-test-only@127.0.0.1:55435/driftgate_test TEST_DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm test
pnpm build
pnpm audit --audit-level=high
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:9333/ THREADLINE_BASE_URL=http://host.docker.internal:3201 pnpm --filter @driftgate/demo-store test:e2e
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:9333/ PLAYWRIGHT_BASE_URL=http://host.docker.internal:3100 pnpm --filter @driftgate/web test:e2e
```

Browser engines ran in the official Playwright 1.64.1 Docker server; API and built web/store servers ran locally. API origin allowlist included the fixed Docker demo hostname. The workspace browser suite exercises registration/login, project/requirement creation, multi-step cases, version history, search/filters, CSV export/import, suite creation, every manual result status with notes, delete confirmation cancellation, refresh restoration, role-specific controls and empty states. Axe assertions and horizontal-overflow checks cover 360/768/1280/1920px; screenshots of cases and manual execution were visually reviewed. These checks are not physical-device certification or a full human accessibility audit.

The first checks found a detached query observer after registration, ambiguous dropdown labels and remote-download handling in the harness. Session cache updates now preserve their observer, fields have explicit label/control/error associations, and the remote test uses saveAs. Screenshot review caught wrapping navigation/table labels; widths were adjusted. A lockfile mismatch and new uncovered client helper were corrected without lowering the existing web coverage threshold. No automated runner, Jira, drift detection, real sign-off, or cloud availability is claimed by these results.

Hosted run [39238134886](https://github.com/tulasiram2005/driftgate/actions/runs/39238134886) passed install, migrations, typecheck, lint, unit tests and build, but failed one of 21 workspace browser tests on WebKit theme repaint. The audit saw light backgrounds with previous dark-theme inherited foregrounds immediately after toggling. The workspace harness now waits for fonts and two animation frames and polls the complete accessibility result for up to five seconds, matching the established design-preview harness. No rules or violations are excluded. CodeQL passed for the same source revision. The pre-commit hook was also corrected to select app-specific ESLint configurations, then passed without disabling hooks.

Targeted local rerun after that correction: the full WebKit account/project/case/CSV/manual-execution flow passed in 20.1 seconds, including all accessibility assertions. Web typecheck and whole-workspace lint passed again. CI database health probes now name their actual database to avoid misleading connection errors in the service logs.

Final hosted verification for revision `186142e`: [Quality Gates run 39239313076](https://github.com/tulasiram2005/driftgate/actions/runs/39239313076) and [CodeQL run 39239312769](https://github.com/tulasiram2005/driftgate/actions/runs/39239312769) both passed. Downloaded job logs confirm 102 unit/integration tests, 18 storefront browser checks in 1.1 minutes, and 21 workspace browser checks in 2.2 minutes; dependency audit reported no known vulnerabilities. The preceding failed run remains recorded above for traceability.

## Phase 1 local verification (2026-10-19)

Node 22.19.0, pinned pnpm 10.18.3; commands use the same npm wrapper as Phase 0 below.

| Gate                                  | Result                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Frozen install                        | PASS, lockfile up to date                                                                                 |
| Typecheck                             | PASS, 4 workspace tasks                                                                                   |
| Lint                                  | PASS after fixing effect handling and scoped demo-alt annotation                                          |
| Build                                 | PASS, 4 workspace tasks; storefront rebuilt after HTTP checkout fix                                       |
| Unit/integration                      | PASS, 63 tests: 21 runtime, 8 contrast, 34 store including 4 PostgreSQL tests                             |
| Store helper coverage                 | 100% statements/lines/functions, 98.41% branches for cart, flags, products, errors; not full-app coverage |
| Store browsers                        | PASS, 18 tests in Chromium, Firefox and WebKit (30.6 seconds, no test retries)                            |
| Audit                                 | PASS, no known vulnerabilities found                                                                      |
| Hosted CI                             | Pending verification after push                                                                           |
| Deployment / DriftGate detection rate | NOT VERIFIED / not implemented                                                                            |

Store checks used a separate `threadline_test` database on port 55433, never the demo database. Integration fixtures clean up their own records; browser checkout leaves simulated test orders. Seeding does not erase data or replenish stock. Tests exercise concurrent idempotent checkout, changed-payload rejection, environment isolation, stock exhaustion, rollback, HTTP validation and seed preservation.

```sh
docker compose -f compose.threadline.yml up -d --wait
TEST_DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm test
TEST_DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm --filter @driftgate/demo-store exec vitest run --coverage
pnpm typecheck
pnpm lint
pnpm build
pnpm audit --audit-level=high
```

For remote-browser verification, the existing official Playwright 1.64.1 Docker server ran at `ws://127.0.0.1:9333/`. The built store ran with the test database on port 3201:

```sh
DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm --filter @driftgate/demo-store exec next start --hostname 0.0.0.0 --port 3201
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:9333/ THREADLINE_BASE_URL=http://host.docker.internal:3201 pnpm --filter @driftgate/demo-store test:e2e
```

All four catalogue widths (360, 768, 1280, 1920) and the receipt were visually reviewed. Tests cover dark/light axe checks, overflow, decoded images, search, environment APIs, product selection, cart, coupon and real simulated checkout response. They do not prove every possible UI state or physical-device behavior.

The first browser run found HTTP checkout failing because `crypto.randomUUID` was unavailable, plus premature WebKit image checks and a navigation load timeout. Checkout now uses `getRandomValues` with a regression test. Image assertions wait for actual loaded images after scrolling, and catalogue navigation waits for DOM content plus explicit visible/loaded assertions. The second run passed all 18 tests. No accessibility rules or deliberate faults were disabled.

Prisma was updated to 6.19.3 and its transitive `deepmerge-ts` overridden to 8.0.2 to clear dependency audit findings. Generation, build and database transactions passed with that override.

Do not treat design specimens as test results. No defect detection rate, runtime or coverage metric has been measured for the future platform.

## Phase 0

Measured locally on 2026-10-18 with Node 22.19.0 and pnpm 10.18.3. The following commands use the package-manager wrapper because this workstation's global pnpm launcher is broken:

```sh
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm install --frozen-lockfile
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm typecheck
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm lint
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm test
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm build
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm audit --audit-level=high
```

| Gate                                       | Observed result                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Frozen install                             | PASS: lockfile up to date, runtime guard and Husky setup complete                                                          |
| Typecheck                                  | PASS: three workspaces                                                                                                     |
| Lint                                       | PASS: formatting, tooling and three workspaces                                                                             |
| Unit tests                                 | PASS: 21 runtime policy tests and 8 contrast tests                                                                         |
| Coverage                                   | 100% statements, branches, functions and lines for the runtime guard and contrast helper only; not whole-platform coverage |
| Build                                      | PASS: three workspaces; web root statically prerendered                                                                    |
| Dependency audit                           | PASS: No known vulnerabilities found                                                                                       |
| Hosted CI, CodeQL and Dependabot execution | NOT VERIFIED: workflow definitions exist, no remote configured                                                             |

### Browser evidence

Native browser launch was blocked by this execution sandbox's macOS MachPort restrictions. Browsers instead ran in the official `mcr.microsoft.com/playwright:v1.64.1-noble` Docker image using the Playwright remote server, against the local production build. No test rules were disabled.

```sh
docker run -d --rm --init --name driftgate-phase0-browser -p 127.0.0.1:9333:9333 --user pwuser --workdir /home/pwuser mcr.microsoft.com/playwright:v1.64.1-noble npx -y playwright@1.64.1 run-server --port 9333 --host 0.0.0.0
```

In `apps/web`, start the built app in another terminal:

```sh
npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm exec next start --hostname 0.0.0.0 --port 3100
```

From the repository root:

```sh
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:9333/ PLAYWRIGHT_BASE_URL=http://host.docker.internal:3100 npm exec --cache /tmp/driftgate-npm-cache --yes --package=pnpm@10.18.3 -- pnpm test:e2e
docker stop driftgate-phase0-browser
```

Result: **15 browser tests passed** across Chromium, Firefox and WebKit. Each engine tested 360, 768, 1280 and 1920 pixel widths in dark and light themes, theme persistence, horizontal overflow and automated WCAG A/AA checks. Keyboard navigation, dialog focus restoration, section search and comparison slider also passed. No runtime page errors were observed in the interaction tests.

The initial run found four WebKit accessibility failures during theme repaint. Screenshots and computed styles confirmed correct settled colors. The test now waits for repaint and polls the full accessibility result for up to five seconds, without excluding violations. An unintended Tailwind `ring` utility outline was removed by renaming the custom chart class. The helper's unreachable fallback was replaced by typed channel/weight pairs after the coverage gate exposed it.

Screenshots of all four widths were visually reviewed; representative Chromium images are committed in `docs/screenshots`. HTML reports and other per-run artifacts remain ignored and are regenerated by tests. Automated accessibility is not a full human audit. Actual devices, hosted CI, cloud accounts and later-phase workflows remain NOT VERIFIED.

# Local storage follow-up: 2026-10-20

- GitHub run 39357398112: browser/accessibility checks passed (24 web + 18 storefront). Audit failed on transitive fast-xml-parser 5.2.5. Targeted SDK dependency override to 5.7.0: `pnpm audit` now reports "No known vulnerabilities found"; local storage round-trip passes again. Hosted CI for this dependency revision is pending.

- Follow-up CI diagnosis: run 39356944276 exposed the reserved `GITHUB_WORKFLOW` variable collision. Renamed the application setting to `RUNNER_GITHUB_WORKFLOW`. Regression suite: 28 API tests passed; API build passed; compiled startup with `GITHUB_WORKFLOW=Quality Gates` and GET `/ready` passed. Full workspace tests on the preceding upload fix passed (21 tooling, 27 API, 38 web, 7 runner, 34 storefront). Frozen install, lint and build passed (build reused two cached frontend tasks).

- `pnpm --filter @driftgate/api test`: 27 tests passed, including the new presigned-upload regression.
- `pnpm typecheck`: 4 tasks successful (3 cache hits).
- `TEST_S3_EMULATOR=1 TEST_S3_ENDPOINT=http://127.0.0.1:59000 TEST_S3_ACCESS_KEY_ID=test TEST_S3_SECRET_ACCESS_KEY=test pnpm --filter @driftgate/api test:storage`: signed PUT/GET, 300-second expiry, exact bytes and missing/mismatched metadata passed against local LocalStack 4.0.3. Test creates and removes a unique bucket. Provider authorization NOT VERIFIED: emulator returned 200 for both unsigned and tampered requests.
- Without `TEST_S3_EMULATOR=1`, the same test requires both unauthorized requests to return 403; that strict check failed on this emulator. Do not interpret the functional pass as storage security verification.
- GitHub Quality Gates run 39315968594: failed API readiness (curl exit 7), browser tests not reached. CodeQL run 39315968696 succeeded. This supersedes any assumption that the Phase 3 checkpoint has green CI.

# Comparison UI checkpoint: 2026-10-21

- Hosted follow-up for a53318d: Quality Gates 39580843879 and CodeQL 39580843562 succeeded. Browser/accessibility tests, runner fixtures, restricted SQL integration, dependency audit and all build/lint/unit gates passed. New comparison flow executed in Chromium, Firefox and WebKit at four viewport widths. Visual review of screenshots remains pending.

- Web unit tests: 40 passed, including cursor-page success and failure handling.
- Web lint and production build: passed.
- Local Chromium end-to-end launch: blocked by macOS bootstrap_check_in permission denial before test execution. No browser pass claimed.
- Backend revision ab6729d: Quality Gates 39576130846 and CodeQL 39576130903 both succeeded.
- New comparison browser tests and screenshot review: pending hosted execution.

# Automated snapshot ingestion: 2026-10-21

- Verified follow-up: b7b1b28 passed Quality Gates 39616600346 and CodeQL 39616600351, including runner snapshot execution success/failure fixtures and browser/accessibility tests. Cloud migrations and actual hosted snapshot dispatch remain NOT VERIFIED.

- CI follow-up: Quality Gates 39585169986 failed on an outdated completion-count assertion (46 was rejected before the sixth check was added). CodeQL 39585169942 passed. The corrected test checks the actual catalog-derived maximum and maximum plus one; all 74 API tests passed locally after this correction. Browser fixtures were skipped in that failed CI run and remain unverified for this change.

- API: 74 tests passed against isolated local driftgate_test. API build, typecheck and lint passed. New migrations applied locally only.
- Runner: 28 unit tests passed; build and lint passed. New snapshot execution fixture verifies successful payload/evidence and failure omission; hosted browser result pending.
- Web: 40 unit tests passed; typecheck, lint and production build passed. Existing default checks retained; optional snapshot, API-contract and accessibility choices added.
- Cloud migration and hosted snapshot collection remain NOT VERIFIED. Temporary cloud worker was not restarted.

# Expected-difference API: 2026-10-22

- Isolated local database migration passed; no cloud database changed.
- 76 API tests passed; API production build passed.
- Regression tests cover expected flags without dropping findings, saved reasons, unchanged older comparisons, unmatched product rules, duplicates, invalid scope and bounds.
- Hosted CI for this revision and rule-entry UI remain NOT VERIFIED.

# Expected-difference UI checkpoint

- Web unit tests: 40 passed; lint passed.
- Local production build: NOT VERIFIED, font network failure followed by Turbopack sandbox port-binding denial.
- Added three-browser rule editor/save/readback/removal coverage with accessibility and four-width screenshot assertions; hosted execution pending.

# 2026-10-23 reusable rules checkpoint

- Local isolated API database migration 20261023060000 applied successfully.
- API suite: 92 passed; web unit suite: 40 passed.
- API build, web typecheck, changed TypeScript file lint: passed.
- Prior hosted quality run 39895526675: SQL screen failed axe color contrast in
  Chromium, Firefox and WebKit. The remaining web browser tests passed.
- Corrected primary-button hover colors. New browser fixture and post-fix
  accessibility run are NOT VERIFIED at this checkpoint.

# 2026-10-23 bounded link detection checkpoint

- Commit 91fb61b: hosted Quality Gates run 39896580106 completed successfully;
  CodeQL run 39896580108 also passed. This supersedes the previous contrast failure.
- New link-check implementation: 40 runner unit tests and 92 API tests passed;
  runner/web typechecks and scoped lint passed.
- Local link browser fixture attempt failed before execution: Chromium MachPort
  bootstrap permission denied. No local browser pass is claimed for the new check.

# 2026-10-23 soft-404 detection checkpoint

- Runner suite: 41 tests passed, including mocked HTTP 200 product shells with
  successful and missing product-data responses and probe cleanup.
- Runner and demo-store typechecks passed.
- Added a real Threadline seeded brokenLink browser test across all configured
  engines. Not executed locally because browser launch remains blocked.
- Quality run 39897098854 for preceding commit 9943033 was still running when
  checked; no success claim is made for that run.

# 2026-10-23 cloud migration checkpoint

- Prisma migrate deploy applied 11 pending migrations to the existing Neon
  driftgate database, bringing it from 4 to 15 migrations without resetting data.
- Hosted `/ready`: HTTP 200 after deployment of the schema changes.
- API suite: 93 passed, including combined-rule-limit rejection and matching-rule override.
- Latest browser run 39897482199 was still in progress; not reported as passed.

# 2026-10-23 seeded link browser verification

- GitHub Quality Gates 39897482199: success for ec01402. Actual Threadline staging
  clean control and prod brokenLink detection ran in Chromium, Firefox and WebKit.
- Documentation update: full API suite 93 passed; after the added OpenAPI path
  assertion, focused API suite 15 passed.
- Hosted `/openapi.json`: HTTP 200 with Phase 4 route definitions.
- Screenshot archive retrieval timed out; no manual visual review is claimed.

# 2026-10-23 accessibility detection checkpoint

- Quality Gates 39898325492 and CodeQL 39898325437 succeeded for fd90276.
- Added a real seeded UAT missing-alt detection case with a clean staging
  control, configured for Chromium, Firefox and WebKit.
- Demo-store typecheck and scoped ESLint passed. The new browser case is
  pending hosted execution; these static checks do not establish detection.

# 2026-10-23 hosted visual round-trip

- Explicitly ran apps/api/integration/visual-cloud.ts against the existing
  hosted API and private S3-compatible storage using temporary demo fixtures.
- Approved and activated baseline through API. Comparing synthetic 1280x900
  PNGs persisted exactly 1 changed pixel out of 1,152,000.
- Signed difference download decoded to 1280x900; unsigned access returned 403.
- Saved 1x1 ignore region produced 0 changed pixels, 1 ignored pixel, revision 1.
- Cleanup removed temporary objects, comparisons, baseline, project and account.
- This verifies hosted API/storage integration, not a new browser capture or
  worker dispatch. Script ESLint passed.
- CI 39926164946: seeded missing-alt detection passed in all three engines;
  overall run failed on a 120s Chromium broken-link test timeout. No full pass claimed.

# 2026-10-23 Chromium timeout diagnosis

- CI 39927297310 repeated the Chromium timeout. Extracted Playwright trace:
  final navigation completed at approximately 4298ms; Page.close began at
  4299ms with no completion before the test timeout.
- Changed link probes to DOMContentLoaded, preserving the 3s limit, asset
  blocking and redirect validation. Runner unit suite: 41/41 passed; scoped lint
  passed. A hosted browser pass is still required.
- Reviewed comparison findings at 360/768/1280/1920 widths. Cloud SQL database
  inspection found postgres and driftgate only; no Threadline database yet.

# 2026-10-23 Phase 4 screenshot review

- Downloaded quality-evidence from successful run 39898325492 and visually
  inspected Chromium screenshots at 360, 768, 1280 and 1920 pixels.
- Reviewed baseline approval, visual results, ignore regions, SQL results,
  saved expected rules and comparison findings. No overlapping form content
  observed. Findings tables retain horizontal scrolling within their dialogs.
- These are fixture-driven UI screenshots. They do not establish real-device
  coverage or fresh production screenshot capture. Prior CI includes automated
  accessibility and behavior checks in Chromium, Firefox and WebKit.
- Full cloud SQL deployment and the complete bug-bank demonstration remain
  Phase 7 follow-up under the original delivery contract, not Phase 4 blockers.

# 2026-10-23 Phase 4 exit verification

- Quality Gates 39929634240: success for dff31ef. CodeQL 39929634248: success.
  Full pipeline includes browser suites and isolated runner fixtures.
- Re-ran integration/sql-checks.ts against local threadline_test: PASS for
  read-only execution, write denial, privileged/writable-role rejection,
  environment validation and seeded total/orphan detection. Cleanup completed.
- Phase 4 is complete within the approved MVP scope. This is not a zero-bug,
  full deployment, real-device or complete bug-bank detection claim.

# Phase 5 defect API checkpoint (2026-10-23)

- Local isolated driftgate_test migration: 20261023070000_defects applied.
- API typecheck and API lint: PASS.
- API test suite: 13 files, 96 tests PASS, including three new defect tests.
- Defect assertions cover membership/role denial, cross-project result/detail/
  cursor isolation, non-failed and malformed input rejection, idempotent create,
  immutable reproduction snapshots, automated failure detail fallback, legal
  transitions, developer closure denial and simultaneous revision conflicts.
- Existing configured coverage scope (app/config/contracts, not the new defect
  module): statements 91.71%, branches 71.66%, functions 86.66%, lines 93.52%.
- git diff --check: PASS. New cloud migration, hosted CI and UI/browser checks
  remain NOT VERIFIED. No cloud worker started or paid services provisioned.

# Phase 5 defect screens (2026-10-23)

- Web typecheck, lint and next build --webpack: PASS.
- Web unit tests: 3 files, 40 tests PASS (existing helper tests, not UI coverage).
- New e2e/defects.spec.ts uses real isolated test API data and includes 360/768/
  1280/1920 screenshots, axe checks and history persistence after reload.
- Local Chromium launch: NOT VERIFIED. Initial missing executable resolved by
  installing pinned Playwright Chromium in /tmp/driftgate-playwright; retry
  failed before test execution with MachPort registration permission denied.
- No new browser screenshots were produced; hosted CI/review pending.

# Phase 5 readiness evaluator (2026-10-23)

- Hosted Quality Gates 39971627029 and CodeQL 39971627252: SUCCESS for c2c430e.
- API suite: 14 files, 108 tests PASS, including 12 readiness policy tests.
- API typecheck and lint: PASS.
- Readiness tests cover all five missing/stale/future components, S1 states,
  S2/drift penalties, hard critical/accessibility failures, zero samples,
  deterministic evidence fingerprints and invalid counts/policy overrides.
- Existing coverage scope excludes the readiness module; no new coverage
  percentage is claimed for it. No real release readiness score was measured.
- Release collection/persistence/UI and sign-off remain pending. No paid resources
  created, cloud migration applied or temporary worker restarted in this checkpoint.

# Phase 5 release persistence checkpoint (2026-10-23)

- Local migration 20261023080000_release_gates: PASS after network permission grant.
- API typecheck/lint: PASS. API suite: 15 files, 110 tests PASS.
- New tests cover atomic ordered gates, membership/write restrictions, strict
  request shape, project isolation, cursor isolation, mismatched environment,
  missing/duplicate/foreign runs, concurrent revisions and removal of run bindings.
- No readiness approval endpoint exists yet. No hosted migration or worker restart
  performed; cloud verification remains pending.

# Phase 5 audit-chain primitives (2026-10-23)

- API typecheck and lint: PASS. API regression: 16 files, 117 tests PASS.
- Seven new audit-chain tests cover signed-field mutations, deletion/reordering/
  duplication, retained-head tail truncation, malformed payloads, cross-release
  append, tampered predecessors, backwards timestamps and deterministic hashing.
- No approval endpoint, persistent audit chain or sign-off UI is verified yet.
  Existing coverage scope does not include the new module; no percentage claimed.
- No cloud migration, worker restart or paid resource created.

# Phase 5 defect filtering (2026-10-23)

- API tests: 16 files, 117 tests PASS; filter assertions added to the existing
  defect workflow test. API and web typechecks, web lint: PASS.
- Combined status/severity/title search, case-insensitive lookup, unmatched cursor,
  invalid status/severity and overlong search were checked against isolated DB.
- Browser test extended, not executed locally due to previously established
  macOS browser-launch restriction. Updated UI screenshots remain NOT VERIFIED.

# Phase 5 defect metrics checkpoint (2026-10-23)

- API suite: 16 files, 118 tests PASS. New aggregate test verifies exact 3-hour
  latest closure, reopened exclusion, missing-history exclusion, no-sample nulls,
  empty project totals, authorization and cross-project isolation.
- Aggregation uses parameterized SQL over all project defects, not UI pagination.
  UTC timestamp arithmetic matches Prisma timestamp storage.
- Extended browser scenario for metrics visibility and four-width screenshots;
  new browser assertions and image review are NOT VERIFIED locally.
