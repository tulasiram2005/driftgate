# Phase status

## Latest checkpoint: seeded accessibility verification added (2026-10-23)

- Quality Gates 39898325492 and CodeQL 39898325437 passed for fd90276.
- Added actual Threadline staging accessibility control and UAT missing-alt
  detection to the three-browser suite. Typecheck and scoped lint pass;
  execution of this new browser case is pending CI.
- All five Phase 4 feature groups are implemented. Remaining closure work is
  manual screenshot review, hosted visual comparison round-trip, dedicated
  cloud read-only SQL configuration and final seeded-defect verification.
- Phase 5 has not started. No temporary cloud worker was restarted.

## Latest checkpoint: seeded link detection verified (2026-10-23)

- Quality Gates run 39897482199 passed for ec01402, including the real Threadline
  staging/prod broken-link test in all configured browser engines and runner fixtures.
- Added missing GET/PUT expected-rules endpoints to generated OpenAPI with a
  regression assertion. Full API suite passed 93 tests; the focused API suite
  passed 15 tests after adding the documentation assertion.
- Public hosted OpenAPI responds HTTP 200 and lists Phase 4 comparison/SQL routes.
  This confirms route publication, not authenticated end-to-end feature success.
- Screenshot artifact download from the earlier successful run timed out at 90s;
  manual screenshot review remains NOT VERIFIED.
- Cloud SQL binding and hosted visual round-trip remain pending. Phase 5 not started.

## Latest checkpoint: cloud schema updated (2026-10-23)

- Applied all 11 pending Phase 4 Prisma migrations to the existing dedicated
  Neon driftgate database through its direct connection. No reset or data wipe.
- Hosted API readiness still returns HTTP 200 after migration.
- Fixed combined saved/one-off rule validation: more than 100 applied rules now
  returns 400 before database persistence, rather than violating a database constraint.
- API suite passes 93 tests. Browser run 39897482199 remains in progress.
- Dedicated cloud SQL read-only connection/project binding is not configured.
  Hosted visual round-trip, screenshot review and final seeded-defect verification
  remain pending. Phase 5 has not started.

## Latest checkpoint: client-rendered missing products (2026-10-23)

- Found and fixed a link-check blind spot: Threadline serves an HTTP 200 shell
  for unknown product slugs. Product links now also probe the fixed product-data
  endpoint through the existing browser routing policy.
- Local runner tests: 41 passed. Runner and storefront typechecks passed.
- Added actual seeded-store verification for clean staging versus prod brokenLink
  in Chromium, Firefox and WebKit. Execution remains NOT VERIFIED until CI runs.
- Cloud migration, screenshot review and remaining seeded-defect verification
  are still pending. Phase 5 has not started.

## Latest checkpoint: bounded link detection (2026-10-23)

- Added `broken-links` to the runner, API contracts and automated-run selector.
  It checks up to 20 catalogue destinations within the selected environment,
  rejects redirects and reports non-2xx/timeouts through existing run results.
  See BROKEN_LINKS.md for limitations; this is not a recursive crawl or snapshot diff.
- Local checks: 40 runner tests, 92 API tests, runner/web typechecks and scoped lint pass.
- Previous commit 91fb61b passed hosted Quality Gates run 39896580106 and CodeQL.
  This verifies the previous rules/SQL browser fixtures and hover-contrast correction.
- Local browser fixture retry still fails at Chromium launch with macOS MachPort
  permission denied. New broken-link browser fixtures are NOT VERIFIED.
- Phase 4 still needs final browser/cloud verification and demonstration against
  the actual seeded bugs. Phase 5 has not started.

## Latest checkpoint: reusable rules (2026-10-23)

- Project-wide environment-pair expected rules now persist with revision conflict protection.
  Comparisons automatically apply matching rules and retain immutable rule snapshots.
  The editor loads and replaces saved rules. See EXPECTED_RULES.md.
- Local migration applied; API 92/92 tests, web 40/40 unit tests, API build,
  web typecheck and scoped lint passed.
- Previous CI 39895526675 reached all three browsers: SQL screen accessibility
  failed due to primary-button hover contrast. Shared hover colors corrected;
  rerun still required. Other web browser cases passed in that run.
- New rules browser fixture and cloud migration remain NOT VERIFIED.
  Broken-link detection and final browser/cloud verification remain pending.
  Phase 5 has not started.

## Earlier checkpoints

## Latest checkpoint: SQL result history (2026-10-23)

- Fixed read-only SQL assertions now have project-bound execution, persisted
  PASS/FAIL/ERROR results and a workspace history screen.
- API suite: 91/91; web unit suite: 40/40; real isolated SQL integration passes.
  API/web builds and scoped lint pass. Local SQL-result migration applied.
- Hosted run 39868253087 was cancelled during browser installation. Browser
  checks were skipped, not passed. Current browser fixtures and cloud migrations
  remain NOT VERIFIED.
- Visual comparison, saved ignore regions and SQL-results UI are implemented
  locally. Reusable project expected-difference rules, broken-link detection and
  final browser/cloud verification remain pending. Phase 5 has not started.

## Latest checkpoint: saved ignore regions (2026-10-23)

- Approved baselines now store reusable rectangle regions with revisions and
  editor/time metadata. ADMIN/APPROVER edit them from Inspect baseline.
- Comparison execution applies the saved regions and records the exact regions,
  revision and ignored-pixel count. Later changes do not alter historical results.
- Bounds, full-image masks, overlapping regions, permissions and stale updates
  are checked. API regression 89/89 and runner 38/38 pass; web typecheck,
  scoped lint and API build pass. Local test migration applied.
- Current hosted check for 030dec1 passed through production build but was still
  installing browser engines when checked. New browser fixtures and cloud
  migrations remain NOT VERIFIED. SQL-results UI/persistence, reusable project
  rules and broken-link detection remain pending. Phase 5 has not started.

## Latest checkpoint (2026-10-23): persisted visual comparisons

- Implemented approved active baseline selection, bounded PNG comparison,
  private difference upload, saved comparison metrics, protected downloads,
  automated-evidence comparison action and paginated results with image preview.
- API integration uses real PNGs and the isolated PostgreSQL database with
  in-memory private storage: 88 API tests pass. Runner 38 tests and web 40 tests
  pass. API build, web production build (webpack), web typecheck and scoped lint
  pass. Local migration 20261023030000 applied successfully.
- Browser fixture expanded for results, downloads, image rendering, accessibility
  and four widths. NOT VERIFIED: macOS denies Chromium MachPort startup.
  Cloud migration and real cloud comparison round trip remain NOT VERIFIED.
- Item 1 is implemented, not fully externally verified. Items 2-5 remain pending:
  persisted ignore regions, persisted SQL outcomes/UI, reusable project rules,
  and broken-link detection. Final verification remains pending; Phase 5 has not
  started. Historical checkpoints below describe earlier states.

Private screenshot reader checkpoint: bounded server-side evidence reads added
for the upcoming comparison endpoint. API regression 85/85, build and lint pass.
This is a storage prerequisite, not completed visual comparison execution.

Active baseline checkpoint (2026-10-23): scoped activation API and UI implemented.
Only ADMIN/APPROVER can activate approved candidates. Database uniqueness and
serializable replacement preserve one active baseline per exact scope. Local
API tests pass 80/80; API build and web typecheck pass. Browser tests, cloud
migration and end-to-end visual execution are not yet verified. Persisted diffs,
ignore-region persistence, SQL outcomes/UI, reusable rules, broken-link checks
and final verification remain Phase 4 work. Phase 5 has not started.

## Current summary (2026-10-22)

- Baseline review UI: proposal from automated screenshot evidence, paginated
  candidate list and role-aware approval/rejection form implemented. API lists
  expose evidence navigation metadata but never storage keys. Web typecheck,
  lint and 40 unit tests passed; API 79 tests and build passed. Local Next build
  is blocked by sandbox port binding. New browser fixture and screenshot review
  are NOT VERIFIED. API revision a426795 passed Quality Gates 39827414205 and
  CodeQL 39827414218. Active baseline selection/diff persistence remain pending.
- Baseline candidate persistence and one-way ADMIN/APPROVER review API added.
  Scope derives from automated evidence; tests cover roles and competing reviews.
  Local API suite: 79/79 pass; build/lint pass. Local test migration only.
  Active baseline selection, persisted visual diffs and review UI remain pending.
- PNG comparison adapter now decodes bounded browser screenshots and emits a
  PNG difference image. Runner tests pass 38/38 and build passes. Baseline
  persistence, reviewer workflow and browser integration remain unfinished.
- Visual comparison engine added with five regression tests; runner tests 33/33,
  build and lint pass. Baseline persistence, PNG integration and review UI remain.
- Phases 0-3: implementation and recorded local/hosted checks are available below.
  The hosted runner happy path and private evidence downloads were verified;
  the temporary cloud-connected worker remains stopped.
- Phase 4: in progress. Snapshot collection/persistence, saved comparisons,
  per-comparison expected-difference rules, contract/accessibility checks and
  restricted SQL assertions are implemented. This is not phase completion.
- Current revision `db6655e`: hosted typecheck, lint, unit tests, restricted SQL
  integration and production build passed. CodeQL run `39823620132` passed.
  Quality Gates run `39823619939` is still running; browser checks and screenshot
  visual review are not yet verified for this revision.
- Remaining Phase 4 work includes reusable project rules, visual baselines and
  review, persisted SQL outcomes/UI, broken-link observations and measured demo
  coverage. New Phase 4 cloud migrations and hosted flows remain unverified.
- Phase 5 (Jira, defects, release gates, sign-off and PDF) has not started.
  Final deployment/demo verification is separate. Free-only constraints remain.

## Historical checkpoints

The entries below record the state at each checkpoint. Pending statements in an
older entry may be superseded by a newer entry or the current summary above.

Expected-difference UI checkpoint: comparison screen now includes bounded rule
entry/removal and displays saved reasons. Changing either snapshot clears draft
rules. Browser coverage includes saving expectations, preserving severity,
removal, accessibility and four viewport widths. Web unit tests (40) and lint
pass; local production build is blocked by sandbox port binding. Hosted browser
checks and visual screenshot review remain pending. Reusable project-wide rule
management is not implemented.

Expected-difference API checkpoint (2026-10-22): comparisons accept bounded,
reasoned field/product rules scoped to their selected environment pair. Rules
are saved with each comparison; expected findings retain severity and remain
visible/countable. API tests pass 76/76 and build passes. Migration applied only
to isolated local driftgate_test. Rule-entry UI, reusable project rules and
cloud migration are still pending. Phase 4 remains in progress.

Verified automated snapshot checkpoint: revision b7b1b28 passed Quality Gates
39616600346 and CodeQL 39616600351. Browser/accessibility checks, snapshot
collection and execution fixtures, restricted SQL integration, unit tests,
build, lint and dependency audit all passed. This supersedes the failed and
cancelled runs recorded below. Cloud schema migration and hosted snapshot runs
remain unverified; Phase 4 is not complete.

Automated snapshot ingestion checkpoint (2026-10-21): optional snapshot checks
now collect through the restricted runner, emit data with signed results and
persist run-bound RUNNER snapshots transactionally. Failed collection omits the
snapshot. The automated-run form exposes snapshot/contract/accessibility options
without changing defaults. New schema migrations are local-only; cloud schema
and hosted execution of this check remain NOT VERIFIED. Phase 4 remains in
progress, including visual baselines, expected-difference management and SQL
result persistence. See SNAPSHOTS.md for provenance and bounds.

Hosted comparison UI verification (2026-10-21): revision a53318d passed Quality
Gates 39580843879 and CodeQL 39580843562. This includes the new manual snapshot
import/compare/findings flow in Chromium, Firefox and WebKit, accessibility and
horizontal-overflow assertions at 360, 768, 1280 and 1920 pixels. Screenshot
visual review remains pending. Cloud schema deployment and remaining Phase 4
features are not implied by this CI result.

Comparison UI checkpoint (2026-10-21): snapshot import, distinct-environment
selectors, paginated history and findings dialog are implemented with role-aware
controls and manual-import provenance. Web unit tests pass 40/40; lint and
production build pass. New three-browser end-to-end coverage includes four
viewport widths and accessibility assertions. Local browser launch is blocked
by macOS permissions; hosted execution and screenshot review remain pending.
Backend revision ab6729d passed Quality Gates 39576130846 and CodeQL 39576130903.
Phase 4 remains incomplete; automated ingestion, visual baselines, persisted SQL
results and cloud migrations are still pending.

Saved comparison checkpoint (2026-10-21): server-computed immutable comparisons
between project-owned snapshots now have create/list/detail endpoints. Distinct
environments are required; source is MANUAL_IMPORT, never automated evidence.
The runner and API share the existing comparison engine through @driftgate/drift.
Local tests: 73 API and 28 runner passed; API/runner builds and API/shared lint
passed. Cloud migrations, automated ingestion and comparison UI remain pending.

Snapshot storage checkpoint (2026-10-21): immutable manual-import persistence
and authenticated project-scoped create/list/detail API added. ADMIN/QA writes,
member reads, bounded pagination, strict input validation, server-owned provenance
and import rate limiting are implemented. Local test migration applied only to
driftgate_test. API tests pass 58/58, typecheck/build/lint pass. Cloud migration,
automated snapshot ingestion, saved comparisons and comparison UI remain pending.
See SNAPSHOTS.md. No new cloud services or paid resources were created.

Latest verified code: `d18f677`. Quality Gates 39546993585 and CodeQL 39546993724
passed. Snapshot browser fixtures now verify rendered-price/metadata drift,
broken-image observations, missing metadata, malformed/duplicate metadata
rejection, failed navigation, listener cleanup and subsequent recovery. The
first snapshot CI failed on a transpiler helper inside page.evaluate; the fix
removes that nested helper. This supersedes the pending snapshot checks below.
Snapshot persistence, dispatch integration and comparison UI remain pending.

Snapshot collector checkpoint (2026-10-21): internal collection and five parser
tests added. Runner tests pass 28/28; typecheck, lint and build pass. Local
Chromium launch is blocked by macOS sandbox; CI fixture is pending verification.
Collector dispatch integration, persistence and UI are NOT complete. No cloud
settings changed and no worker restarted.

Latest verified code: `82390a0`, Quality Gates 39543943816 and CodeQL 39543943740
both passed, including the new restricted-role SQL integration. Phase 4 remains
in progress; this checkpoint is not complete-project verification.

Phase 4 SQL checkpoint (2026-10-21): fixed read-only assertions and an operator
CLI now exist, with real local restricted-role integration passing. API tests
pass 34/34, plus build/typecheck/lint. Cloud SQL setup, persistent outcomes and
UI integration are pending. See SQL_CHECKS.md. No cloud credentials or services
were changed; the temporary cloud worker remains stopped.

Current CI checkpoint (2026-10-21): revision `0a7a315` passes Quality Gates
39543108410 and CodeQL 39543108381. The Phase 4 quality browser fixture is now
verified on GitHub after correcting its browser context setup. Remaining Phase 4
features below are still pending; this is not a phase-completion claim.

Phase 4 started (2026-10-21): pure environment comparison logic plus fixed
`api-contract` and `accessibility` runner checks are implemented. The API accepts
these explicitly selected checks while preserving the original three-check default.
No new UI is exposed yet. Drift snapshot collection/persistence, comparison UI,
visual baselines/review, and least-privilege SQL assertions remain pending.
Performance budgets remain deferred for MVP. Phase 4 is NOT complete.
The user confirmed the temporary cloud worker stopped with SIGTERM and an empty
process lookup. No cloud worker was restarted for this development checkpoint.

Latest hosted verification (2026-10-21), superseding pending statements in the
historical checkpoints below: GitHub run 39517721256 passed on `9f6ca5c` after
fixing relay file ownership. The live API persisted PASS and three private
Supabase artifacts. All three authorized downloads matched stored sizes and
unsigned requests returned 403. See docs/METRICS.md for measured results.
GitHub dispatch, callbacks, Upstash queue and cloud evidence now have end-to-end
happy-path evidence. Worker hosting remains intentionally temporary and local;
there is no always-on free cloud worker. Tool policy blocked stopping that
temporary worker, and manual cleanup was requested. Phase 4/5 and broader
deployment readiness are not claimed complete by this verification.

Redis checkpoint (2026-10-21): created dedicated Upstash database `driftgate`
(`0b5ef742-40d4-4926-9876-33affbcac885`) in AWS Oregon (`us-west-2`).
The console confirms Free Tier, $0.00 cost, 500k monthly commands, 250 MB
storage and 10 GB bandwidth. TLS is enabled and eviction was left disabled.
No payment method or paid plan was added. The user approved private local
credential storage. The TLS connection is saved in ignored `.env.cloud` with
mode 0600; an authenticated Redis PING returned PONG. Callback URL, repository,
workflow filename and branch settings are configured. GitHub dispatch token
configuration is still pending. Worker dispatch and hosted workflow execution
remain NOT VERIFIED.

Hosted setup checkpoint (2026-10-20): all four API Prisma migrations applied
successfully to the dedicated Neon `driftgate` database using its direct endpoint.
GitHub Actions now contains `RUNNER_CALLBACK_SECRET`, `RUNNER_S3_ACCESS_KEY_ID`
and `RUNNER_S3_SECRET_ACCESS_KEY` as encrypted repository secrets. Variables
`RUNNER_CALLBACK_URL`, `RUNNER_S3_ENDPOINT`, `RUNNER_S3_BUCKET` and
`RUNNER_S3_REGION` were saved and verified in the repository settings.
Created Render service `srv-dbbqul8n74is739e6rcg` on plan `free`,
URL `https://driftgate-api-s2pc.onrender.com`, deploying revision `9a66f60`.
Initial deploy `dep-dbbqulgn74is739e6s9g` reached `live`.
An HTTPS request to `/ready` returned HTTP 200 and
`{"data":{"status":"ready"}}`. The callback signing secret is saved in GitHub.
Redis provisioning, local worker cloud configuration, and hosted workflow
execution remain pending. No paid worker was created.

Supabase storage checkpoint (2026-10-20): created `driftgate-evidence`
in the user-selected `tulasiram` Free organization. Project reference:
`zlcdlokljlcmhcigxdpr`, region `us-west-1`. The bucket is private; the user
approved a server-only S3 key, saved locally in ignored `.env.storage`.
Real-provider verification passed signed PUT/GET, 300-second URL expiry,
exact bytes, metadata validation, unsigned HTTP 403 and tampered HTTP 403.
The uniquely named test object was removed. No bucket deletion or paid
upgrade occurred. Deployment/GitHub secrets are not configured yet.
The user selected a local computer worker for hosted verification; it will
not run when that computer/process is stopped. Hosted API and workflow
dispatch remain NOT VERIFIED.

Cloud setup checkpoint (2026-10-20): created a separate Neon Free-plan project
`driftgate` (`calm-butterfly-66305552`) in `aws-us-west-2`, PostgreSQL 16,
with production branch/database requested at creation. Schema migration and
application connectivity remain NOT VERIFIED. No existing Orbit resources were
changed. Cloudflare R2 bucket listing returned HTTP 403, code 10042:
"Please enable R2 through the Cloudflare Dashboard." The connection already has
R2 read/write permissions; account activation, not reconnection, is required.
No bucket or public API was created in this checkpoint. The separate BullMQ
worker still needs a hosting decision within the free-only constraint.

Latest checkpoint: GitHub Quality Gates run 39358112421 and CodeQL run 39358112478 pass for revision `04bb7ab`. Local `pnpm audit` reports no known vulnerabilities. The local API-to-BullMQ-to-isolated-runner-to-evidence workflow now passes; hosted GitHub dispatch and real-provider storage enforcement remain unfinished.

CI startup diagnosis (2026-10-20): GitHub Actions supplies `GITHUB_WORKFLOW=Quality Gates`, conflicting with the runner filename validation. The application now uses `RUNNER_GITHUB_WORKFLOW` (default `runner.yml`). A regression test and compiled API startup with that CI environment pass; `/ready` returns `{"data":{"status":"ready"}}`. The updated API suite passes 28 tests. A fresh hosted CI run is still required.

| Phase | Scope                                                       | State                                                          |
| ----- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| 0     | Tooling, CI skeleton, tokens and preview                    | Locally and CI verified                                        |
| 1     | Threadline and bug bank                                     | Locally and CI verified                                        |
| 2     | API, database, RBAC, test cases, manual execution           | Core implemented; local and CI gates pass                      |
| 3     | Runner, storage, live results, Actions execution            | Local flow and hosted happy path verified                      |
| 4     | Drift, visual regression, contract/SQL/accessibility checks | In progress; comparison core and two runner checks implemented |
| 5     | Defects, Jira, gates, sign-off, PDF                         | Not started                                                    |
| 6     | Dashboard and motion polish                                 | Outside MVP                                                    |
| 7     | Deployment and measured demo                                | Separate follow-up after MVP                                   |

Optional AI, notifications and performance budgets are deferred for MVP. Public repository: https://github.com/tulasiram2005/driftgate. Cloud deployment is pending. Account-specific no-card storage availability needs confirmation.

The user requests a stop after each completed phase. Phase 4 was authorized by the latest continue request. Do not begin Phase 5 until Phase 4 is verified.

2026-10-20 local storage follow-up: corrected presigned browser uploads that incorrectly included an empty-body checksum. LocalStack round-trip, exact bytes, URL expiry and metadata checks pass. LocalStack accepts unsigned and tampered requests, so private-provider enforcement remains NOT VERIFIED. The strict storage check retains rejection assertions unless explicitly run with `TEST_S3_EMULATOR=1`. The local queue-to-storage integration then passed through API creation, durable outbox, BullMQ, isolated Chromium, relay upload, signed callbacks, persisted PASS state and an authorized 629,484-byte evidence download. Hosted GitHub execution remains pending.

Phase 2 includes account sessions, project roles, requirements/coverage, versioned cases, CSV transfer, suites, manual results and notes. Phase 3 adds normalized step/suite joins, automated result persistence, signed callbacks, authenticated SSE, private evidence interfaces and an isolated fixed-Threadline runner. Actual devices and hosted services are not verified. See PHASE3.md for measured checks and remaining work.

Implementation revision `186142e` passed [Quality Gates](https://github.com/tulasiram2005/driftgate/actions/runs/39239313076) and [CodeQL](https://github.com/tulasiram2005/driftgate/actions/runs/39239312769) on 2026-10-19. This records executed verification, not a guarantee against every possible defect.
