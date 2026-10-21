# Phase status

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
