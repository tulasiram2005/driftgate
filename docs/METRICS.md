# Measured evidence

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
