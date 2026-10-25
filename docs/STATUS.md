# Phase status

## Phase 5 MVP closed; Phase 6 started (2026-10-25)

Final Quality Gates run 40217298526 passed every step on `0ef5409`. Live Jira
polling refreshed demo ticket KAN-1 and respected its next-poll interval.
See PHASE5_EXIT.md for evidence and limits. Hosted deployment and sustained
worker verification belong to Phase 7 under the delivery contract. The user
authorized continuing directly to Phase 6; product dashboard/polish is now active.
Older checkpoints below describe earlier states and are historical.

## Cross-browser Phase 5 verification (2026-10-25)

Quality Gates run 40215957794 passed 66 web browser tests and 24 demo browser
tests across Chromium, Firefox and WebKit. Release creation, run binding
persistence, PDF download, admin approval restrictions and empty audit-chain
verification passed. Release screenshots reviewed at 360/768/1280/1920 pixels.
Unit tests, SQL integration, production builds and runner fixtures passed.
The final dependency audit failed on Zod and body-parser advisories. Updated
Zod and its OpenAPI adapter, migrated record/resolver types, and refreshed
body-parser. Local typecheck, 195 API tests, 43 web tests and dependency audit
pass after the update. Full CI must pass again on this dependency revision.
Live scheduled Jira polling/recovery and hosted migrations remain unverified;
Phase 5 is not yet closed and Phase 6 has not started.

## Isolated CI verification (2026-10-25)

Saved Phase 5 changes are backed up on `codex/phase5-verification`, without
deploying main. First run 40190815496 passed typecheck, lint and migrations but
stopped at web function coverage (89.28%, required 90%). Added PDF download
success and failure tests; local web suite now passes 43 tests with 96.42%
function coverage. Browser and remaining CI gates still await a passing run.

## Release PDF export (2026-10-25)

Authenticated release report endpoint and download control are implemented.
Reports capture readiness, source references, defects and approval history in a
consistent database snapshot, excluding tokens and private download URLs. Export
limits reject oversized reports instead of silently omitting records. Synthetic
populated report rendered and inspected across eight pages. API tests: 195 PASS;
API/web typecheck, lint and production builds PASS. Browser connection briefly
worked for reading the workspace, then reported disabled before demo creation.
Download interaction, responsive screenshots, hosted migration and CI remain
NOT VERIFIED. Phase 5 implementation is substantially complete, but its exit
verification is not complete; Phase 6 has not started.

## Release sign-off and gate sequencing (2026-10-25)

Named project Approvers can sign eligible gates in STAGING, UAT, PREPROD, PROD
order. Required comments, server timestamps, evidence hashes and gate revisions
are persisted in a hash chain. Replaced or expired evidence invalidates current
approval; reapproving an earlier gate requires downstream approval again.
Serializable transactions reject conflicting approvals. The release screen
provides chain verification, current/stale states and historical reviewer details.

195 API tests, 41 web unit tests, API/web typecheck and lint, and API build passed.
Migration 24 applied to isolated test and explicitly approved demo databases.
Chromium still fails to launch with macOS MachPortRendezvous permission denial;
browser assertions and screenshots are NOT VERIFIED. The defect status board is
also implemented, with shared filters and existing audited transition controls;
rendered board verification is pending. Phase 5 remains open for PDF report and
browser/cloud/CI verification. Phases 6 and 7 follow.

## Visual difference review (2026-10-25)

Admin/Approver review now records ACCEPTED or REJECTED, a required reason,
reviewer identity and server timestamp. Each comparison accepts one decision;
concurrent or repeated reviews conflict. Changed baseline settings require a new
comparison. The UI exposes a review form and saved decision. Accepted differences
count toward readiness only while source/baseline validation still passes.

194 API tests passed, including permissions, concurrent reviews and readiness
updates; API/web typecheck and lint passed. Migration 23 applied to test and,
with explicit user approval, local demo databases. Browser review, cloud rollout,
sign-off, gate sequencing, PDF and defect board remain pending.

## Visual and accessibility readiness (2026-10-25)

Collectors now use saved automated accessibility matrix results and screenshot
comparisons. Accessibility requires coverage in every recorded cell and rejects
unfinished, failed or flaky runs. Visual evidence requires ready screenshots and
approved active baselines matching check/browser/device/environment, with current
ignore revisions. Zero differences count as reviewed; changed pixels do not.
Policy mvp-2 explicitly blocks unreviewed visual differences even at score 90.

194 API tests passed; typecheck and lint passed. Explicit visual-difference review,
sign-off, sequencing, PDF, defect board and browser/cloud verification remain.
This increment does not establish Phase 5 completion or authorize a release.

## Drift evidence collection (2026-10-25)

Release readiness now reads the latest saved comparison for each snapshot of
selected runs. Every selected run needs snapshot coverage. Missing baseline
snapshots, changed expected-rule revisions and malformed finding counts leave
drift unavailable. Unexpected findings reduce the drift score. Freshness uses
the oldest source timestamp, and the evidence hash includes comparison inputs.
Visual-review and accessibility collection remain pending; gates still cannot
pass this partial collector. No cloud deployment or browser verification yet.

## Release readiness collection, first increment (2026-10-25)

Readiness API and per-gate Check readiness control now read selected runs, current
high-priority cases and project defects in a repeatable-read transaction. Missing
runs, changed environments, old case versions, flaky/failing results and source
limits fail closed. Source dates are preserved conservatively; evaluation does
not refresh old evidence. The hash includes release/gate revision and result data.

Drift, visual and accessibility collectors are still missing and explicitly
returned as unavailable. No release can pass this partial collector. Sign-off,
gate sequencing and PDF remain pending. Browser appearance is NOT VERIFIED.

## Jira encryption-key rotation (2026-10-25)

Offline dry-run/apply utility and operator runbook added. Connected credentials
and audit events rotate atomically, disconnected rows are skipped, and settings
revisions increase. Invalid keys, corrupt envelopes and unconfirmed maintenance
prevent application. Synthetic local tests cover dry-run immutability, successful
rotation, deliberate reversal and rollback. No real key or cloud secret changed.

191 API tests passed; API typecheck and lint passed. Full build, CI and real
maintenance rotation remain NOT VERIFIED. See JIRA_KEY_ROTATION.md. Phase 5
release gates, sign-off/PDF and remaining verification are still pending.

## Jira disconnect (2026-10-25)

Admin-only disconnect now erases saved encrypted credentials, retains metadata,
ticket links and audit history, and increments the settings revision. Reconnection
requires fresh credentials with the current revision. Verification, export, manual
sync and scheduled polling reject disconnected settings. The UI offers an explicit
confirmation and explains that already-sent requests may finish and the Atlassian
token is not revoked. No real connection was disconnected during verification.

187 API tests and 41 web unit tests passed, plus API/web typecheck and lint.
Migration 22 applied to local test and demo databases. Chromium verification was
blocked before assertions by macOS MachPortRendezvous permission error 1100.
Cloud migration, browser screenshots and CI for these changes remain NOT VERIFIED.

## Optional Jira polling (2026-10-25)

Implemented bounded status polling in the existing worker, disabled by default.
Durable leases prevent overlapping workers; revision checks protect manual sync
and settings replacement. Linked tickets only, GET requests only, no QA state
changes. Failures back off from 30 minutes to six hours. Successful checks recur
after 15 minutes, in batches of five per worker tick.

185 API tests passed; API TypeScript and lint passed. Migration 21 applied to the
isolated test database and local demo database. Cloud migration, live scheduled
Jira polling, latest browser recovery checks and CI remain NOT VERIFIED. No
worker was started and no cloud settings or paid services were changed.

## Interrupted Jira export recovery (2026-10-24)

- PENDING exports become eligible for verified existing-ticket recovery after five
  minutes, measured server-side. GET exposes canReconcile; refreshing the defect
  updates UI eligibility. Recent pending exports remain protected.
- Recovery still verifies the original site/project and exact defect reference.
  Original export success/failure writes now compare state and revision, so late
  completion cannot overwrite a recovered link or reopen its review state.
- Full API suite: 176 tests passed, including late success and late failure races.
  API/web TypeScript and lint passed. Browser coverage added for stale pending
  eligibility; execution and screenshots remain NOT VERIFIED.
- No real Jira ticket, credentials or cloud service changed. Scheduled polling,
  integration lifecycle, release gates/sign-off/reports and Phase 5 exit checks remain.

## Jira recovery screen (2026-10-24)

- Defects now offer Link existing Jira ticket to project administrators only for
  REVIEW_REQUIRED exports. The dialog displays the original target and submits
  the candidate key and saved revision to the recovery API. Failures retain the
  dialog; success refreshes the saved link/status. PENDING remains read-only.
- Web TypeScript, lint and 41 unit tests passed. Added isolated browser fixtures
  for failure then success, role/state restrictions, accessibility and four widths
  in both themes. All three attempted Chromium cases were blocked at launch by
  macOS MachPort permissions; new screenshots and browser assertions NOT VERIFIED.
- No live Jira ticket was changed. PENDING recovery, scheduled polling and the
  remaining Phase 5 work are still pending.

## Jira uncertain-export recovery API (2026-10-24)

- Added admin-only reconciliation of REVIEW_REQUIRED exports to an existing Jira
  ticket. Checks original site/project, exact defect reference, saved revision and
  current configuration. Uses GET only; never retries external issue creation.
- Saves recovered link/status and actor audit event transactionally. Concurrent
  recovery has one winner, and QA state/history are unchanged.
- API TypeScript/lint and 174 tests passed. Jira requests in these regression
  tests are mocked; no real ticket or credential was changed for recovery testing.
- Reconciliation UI, interrupted PENDING recovery, polling and remaining Phase 5
  release/sign-off/report work are still pending. No cloud migration was needed.

## Jira saved-settings clarity (2026-10-24)

- Saved integrations now display non-secret target details instead of an empty
  credential replacement form. Edit Jira settings opens the form explicitly;
  cancel unmounts draft credentials, and successful saves return to the summary.
- Browser regression coverage includes cancel/reopen and revision-conflict recovery.
  Web TypeScript, lint and 41 unit tests passed. Browser checks remain NOT VERIFIED:
  in-app control reported disabled and Chromium was denied macOS MachPort registration.
- This does not invalidate the earlier live Jira export/sync evidence. Scheduled
  polling, reconciliation and the remaining Phase 5 features are still pending.

## Live Jira happy-path verification (2026-10-24)

- The user configured credentials privately in the local app. Browser access now
  works through the in-app browser, superseding the earlier disabled-browser note.
- Created a clearly labelled synthetic case, suite, failed manual result and S4
  defect in DriftGate Demo. Export through the app created Jira ticket KAN-1.
- Manual status sync returned To Do at 19:41:21 IST. The defect stayed NEW and
  its QA history was unchanged. Reopening the defect retained the link and status.
- This verifies the local API against real Jira, not cloud deployment, scheduled
  polling, uncertain-export recovery or complete cross-browser coverage.
- Phase 5 remains in progress. See REMAINING_WORK.md for current outstanding scope.

## Local browser blocker investigation (2026-10-24)

- Webpack production build passed, including TypeScript and static page generation.
  Added build:compat and dev:compat scripts without changing the default CI build.
- Webpack development initially hit EMFILE file-watcher limits. With
  WATCHPACK_POLLING=true, the homepage served HTTP 200. Test servers were stopped
  after verification; no production settings or security protections changed.
- Installed the pinned Playwright Chromium, Firefox and WebKit binaries in
  /tmp/driftgate-playwright. Chromium still cannot launch in this tool session:
  macOS MachPortRendezvous bootstrap_check_in permission denied (1100).
- In-app browser also reports local browser use disabled. Local rendered UI,
  screenshots and browser assertions remain NOT VERIFIED. Use GitHub Quality Gates
  for browser verification; do not disable macOS protections to bypass the restriction.

## Phase 5 manual Jira status sync (2026-10-24)

- Added admin-triggered status sync with persisted Jira status and last-checked time.
  Project members can read the saved snapshot. Jira Done never changes QA state.
- Concurrent updates use revision checks; failed requests preserve the last snapshot.
  Changed target sites/projects are rejected before sending credentials.
- Migration 20261024020000_jira_status_sync applied to isolated local test DB only.
- API: 170 tests passed. Web: 41 unit tests passed. Both typechecks and lints passed.
- Browser scenario extended for sync, but NOT VERIFIED locally: production build
  failed on port-binding EPERM and dev server failed starting an FSEvent stream.
- Remaining Jira scope: scheduled polling, uncertain-export reconciliation,
  disconnect/key rotation, live credentials and cloud migration/verification.
  Phase 5 is still in progress; phases 6 and 7 are not skipped.

## Phase 5 initial Jira defect export (2026-10-24)

- Added admin-confirmed defect export, persisted ticket links and immutable target
  site metadata. A unique reservation before the remote request prevents duplicate
  creation from concurrent/repeated requests. Network failures remain REVIEW_REQUIRED;
  crash-interrupted reservations remain PENDING. Neither is automatically retried.
- Added export confirmation and linked/pending/review states in defect details.
  Reproduction snapshot text is sent; evidence files are not uploaded.
- Applied migration 20261024010000_jira_defect_export to isolated local test DB only.
  Full API tests: 169 passed; API build/lint and web TypeScript passed.
- Remaining: uncertain-export reconciliation, status syncing, live Jira tests,
  browser verification of export UI and cloud migration. No real Jira tickets created.

## Phase 5 hosted browser follow-up (2026-10-24)

- Inspected hosted quality run 40039791436: 48 web browser checks passed; three
  failed on an ambiguous alert selector in the Jira encryption-unavailable test.
- Narrowed that assertion to the Jira warning without removing the check or
  weakening the expected message. Hosted rerun pending.
- Jira configuration, access-check and revision-reset browser flows passed in
  all three browser engines. This is mocked Jira transport, not live verification.

## Phase 5 Jira access check (2026-10-24)

- Added admin-only POST verification of saved credentials: authenticated active
  identity, matching project/non-subtask issue type, browse/create permissions.
  Remote calls are GET-only and never create an issue.
- Rejects stale settings before and after the check; errors exclude credentials.
  UI shows a per-view timestamped access result, resets on settings replacement,
  and explicitly does not claim successful issue creation. No persistent verified flag.
- Full API suite: 167 passed; API build/lint and web TypeScript/lint passed.
- Real Jira verification, browser checks, export/reconciliation, status syncing,
  hosted migration and Free-plan confirmation remain pending. Phase 5 continues.

## Phase 5 Jira settings screen (2026-10-24)

- Added admin-only Integrations navigation and Jira configuration form, unavailable
  state when server encryption is missing, revision-conflict reload and explicit
  saved-but-not-verified status. Credentials clear after each save attempt and are
  excluded from React Query mutation caches and browser storage.
- Web unit tests: 41 passed; web TypeScript and lint passed.
- Added three mocked browser scenarios for save/conflict recovery, unavailable
  encryption and non-admin access, including responsive screenshots and axe checks.
  These browser scenarios are NOT VERIFIED locally: production build failed on
  restricted port binding; development preview failed on macOS FSEvent startup.
- Still pending: live connection verification, defect export/reconciliation,
  polling, cloud migration and confirmed Free-plan status. Phase 5 is not complete.

## Phase 5 persisted Jira configuration (2026-10-24)

- Added project-admin-only settings GET/PUT, encrypted credential persistence,
  transactional audit metadata and revision conflicts including simultaneous saves.
- API responses exclude both credentials and ciphertext. Missing encryption keys
  fail closed; non-admin members and outsiders cannot read or write settings.
- Migration 20261024000000_jira_integration applied to isolated local test DB only.
- Full API suite: 157 passed; API build/TypeScript and lint passed. An initial
  rerun could not reach the local DB before network permission was renewed.
- No live credentials, external Jira issues or cloud migrations were created.
  Settings UI, defect export/deduplication, polling and live verification remain pending.

## Phase 5 Jira client (2026-10-24)

- Added a server-side Jira REST v3 client for issue creation with plain-text ADF
  and status reads. Validates Atlassian HTTPS origins and project-specific issue
  keys, refuses redirects, applies a 15-second deadline and caps responses at 64 KiB.
- Errors exclude remote bodies and network diagnostics. Creation has no automatic
  retry because an uncertain response can still represent a successfully created issue.
- Uses email plus an unscoped personal API token for this direct-site adapter;
  scoped tokens/OAuth gateway support is not implemented. No credentials configured.
- 34 focused tests passed across client and encryption, plus API TypeScript/lint.
  Requests were mocked; no live Jira issues created and no cloud deployment changed.
- Pending: admin-only configuration/persistence, export deduplication and uncertain
  outcome reconciliation, defect issue links, polling, UI, live verification and
  Free-plan confirmation. This is not a completed integration.

## Phase 5 Jira setup and credential foundation (2026-10-24)

- Jira software project DriftGate exists on ramtulasi062005.atlassian.net,
  project key KAN, board 2. User screenshot confirms the board loads. Support
  remains separate. The Jira subscription plan has not yet been verified.
- Added versioned AES-256-GCM credential encryption with random nonces and
  authenticated project/provider context, strict envelopes and redacted failures.
- Focused encryption tests: 12 passed. API TypeScript and lint passed.
- This helper is not yet connected to persistence or API routes. Admin-only
  credential configuration, issue creation/linking, polling, UI and live verification
  remain pending. No real token was requested, stored or transmitted in this step.
- Board: https://ramtulasi062005.atlassian.net/jira/software/projects/KAN/boards/2

## Phase 5 release screens (2026-10-23)

- Added release history, creation, ordered environment gates and run-selection
  dialogs for QA/Admin. Other project members can inspect saved releases.
- Selection includes manual and automated runs for the matching environment,
  preserves unavailable references for explicit removal and caps bindings at 100.
- Writes include the gate revision; conflicts offer refresh instead of overwriting.
  The UI explicitly marks readiness unevaluated and sign-off absent.
- Web lint, production build/TypeScript and 40 existing web unit tests passed.
  New real-API browser coverage and screenshot review are pending hosted execution.
- Trusted readiness collection, gate criteria, persistent sign-off, Jira and PDF
  reporting remain unfinished. No phase-completion claim is made.

## Hosted verification blocker (2026-10-23)

- Quality Gates run 39979148539 passed typecheck, lint, unit tests, restricted
  SQL integration and production build, then exhausted its 25-minute budget
  downloading browser system packages from the Azure Ubuntu mirror.
- Browser tests did not execute; cancelled runs are not passing evidence.
- CI now pins Ubuntu 24.04, uses the official Ubuntu archive mirror and bounds
  package network waits and browser setup steps. All browser coverage is retained.
- Verified by Quality Gates 39998074072 at bd44616: all steps passed. Browser
  system dependencies took 54 seconds and browser engines 12 seconds.
- Web E2E: 39 passed; demo-store E2E: 24 passed. Defect creation, search/filtering,
  project metrics and persisted transitions passed in Chromium, Firefox and WebKit.
- CodeQL 39998074017 passed. Phase 5 implementation remains in progress.

## Phase 5 defect aging and resolution metrics (2026-10-23)

- Added project-wide aggregate API and responsive summary for open/closed defects,
  open S1 count, oldest open age, mean time to closure and valid resolution sample.
- Mean time is creation to latest closure for currently closed defects. Reopened
  defects and invalid/missing closure history are excluded; absent samples are null.
- API tests: 118 passed. Browser metrics/screenshot assertions added; execution
  and manual review remain NOT VERIFIED pending hosted CI.
- Defect board, Jira, release readiness integration, persisted sign-off and reports
  remain pending. All phases, including Phase 6 polish, remain required.

## Phase 5 project-wide defect filters (2026-10-23)

- Added server-side title search, status and severity filters before pagination,
  including cursor validation against the active filter set.
- Connected filter controls, search submission, clear filters and no-match state
  in the Defects screen. Query keys isolate each filter combination.
- API regression suite passes 117 tests with added combined-filter, case-insensitive,
  cursor-mismatch and invalid-input assertions. API/web typechecks and web lint pass.
- Extended real-API browser test for severity no-match, clear and search. Its new
  browser assertions and screenshot review remain NOT VERIFIED pending hosted CI.
- Defect board and aging/MTTR remain pending, as do connected release readiness,
  persistent sign-off, Jira integration and PDF reports. Phase 6 will not be skipped.

## Phase 5 audit-chain foundation (2026-10-23)

- Implemented versioned sign-off payload hashing and chain verification, with
  project/release scope, ordered sequence, evidence/revision binding and retained
  head/count checks. See SIGNOFF.md for threat-model limits.
- This is a tested primitive, not an approval API. Transactional storage,
  Approver authorization, trusted readiness collection and sign-off UI remain pending.
- Full delivery includes Phase 6 polish and Phase 7 verification/deployment;
  neither phase may be skipped under the latest user instruction.

Current consolidated scope and phase count: [REMAINING_WORK.md](REMAINING_WORK.md).
Older checkpoint notes below retain their historical pending statements.

## Phase 5 saved releases and gate bindings (2026-10-23)

- Release creation atomically saves four ordered environment gates. Paginated
  release history and details enforce project membership; writes require QA/Admin.
- Gate run bindings validate project and environment, reject duplicate IDs and
  protect concurrent edits with revisions. Bindings are references, not approvals.
- Local release_gates migration, API typecheck/lint and 110 API tests passed.
- Cloud migration and hosted checks for this checkpoint are not yet verified.
  Readiness evidence collection, release UI, sign-off, Jira, PDF and remaining
  defect scope are still pending. Phase 5 remains in progress.

## Phase 5 readiness evaluator checkpoint (2026-10-23)

- Quality Gates 39971627029 and CodeQL 39971627252 passed for c2c430e.
  This includes the new defect real-API browser scenario in hosted CI. Manual
  review of its screenshot artifacts remains pending.
- Added versioned mvp-1 readiness evaluator: explicit weights, missing/stale
  evidence handling, hard S1/critical/accessibility blocks, threshold and evidence
  fingerprint. Performance is explicitly excluded, not silently passed.
- Readiness is a tested server-side foundation only. Release/gate persistence,
  trusted evidence collection, readiness API/UI, hash chain and reports remain
  pending, along with Jira and the remaining defect-management scope.

## Phase 5 defect screens checkpoint (2026-10-23)

- Added Defects navigation, paginated list, reproduction detail, protected
  evidence links, actor/status history and revision-aware transition forms.
- Failed manual and automated results can create defects with a severity.
  Developer transitions are limited to in-progress/fixed; Approvers are read-only.
- Web typecheck, lint, 40 unit tests and production webpack build passed.
- Added a real-API browser scenario for failed-result creation, defect creation,
  persisted transition history, accessibility and four responsive screenshots.
- Browser execution is NOT VERIFIED: after installing the pinned browser locally,
  macOS denied Chromium MachPort registration before test execution. Hosted CI
  and screenshot review remain pending. No cloud worker was started.
- Still pending in Phase 5: defect board/filtering and aging/MTTR, Jira integration,
  release scoring/gates, hash-chained sign-off, PDF reports and full verification.

## Phase 5 started: defect API foundation (2026-10-23)

- Failed-result defect creation snapshots steps, expected outcomes, actual
  notes/failure details, environment, browser, device and protected evidence IDs.
- Duplicate creation reuses the existing defect. Project isolation, role checks,
  status transitions, revision conflicts and transactional actor/event history
  are implemented with API documentation and a local database migration.
- This is a backend checkpoint, not completion of Phase 5. Defect board/list UI,
  Jira encrypted integration and polling, aging/MTTR, release readiness scoring,
  named hash-chained sign-off and PDF reports remain pending.
- New cloud migration, hosted tests and browser verification are NOT VERIFIED.
  No worker was restarted and no paid resource was created.
- Phase 4 checkpoint fcfe582 has been pushed to GitHub.

## Phase 4 complete within approved MVP scope (2026-10-23)

- Quality Gates 39929634240 and CodeQL 39929634248 passed for dff31ef.
  The full browser rerun verifies the Chromium probe-close correction.
- Snapshot/drift comparisons, saved expected rules, visual baseline review,
  pixel differences, saved ignore regions, API/accessibility checks, SQL
  persistence/UI and bounded link detection are implemented and verified by
  the recorded local/CI checks. Screenshot review is complete at four widths.
- Re-ran local restricted-role SQL integration: write denial, privileged-role
  rejection and seeded total/orphan findings passed; temporary fixtures removed.
- Hosted visual API/storage verification passed with synthetic PNGs. This is
  not a claim of complete real-device or full bug-bank coverage.
- Full cloud SQL setup, all-service deployment and complete demo measurements
  remain Phase 7 work. Performance budgets are excluded from the MVP.
- Phase 5 is next; implementation has not started. See PHASE4_EXIT.md.

## Latest checkpoint: Chromium probe-close stall (2026-10-23)

- Run 39927297310 again timed out in Chromium; its trace shows the final probe
  navigation completed around 4.3s, then Page.close never returned before 120s.
- Probe navigation now waits for DOMContentLoaded instead of commit, retaining
  the 3s request timeout and existing routing/redirect restrictions. Hosted
  browser rerun is required before claiming this resolves the stall.
- Cloud SQL inspection confirms there is no Threadline database on the existing
  dedicated server yet. SQL documentation now reflects implemented persistence/UI.
- Reviewed comparison-findings screenshots at all four required widths; tables
  remain within a horizontal scroll container. Phase 5 has not started.

## Latest checkpoint: hosted visual verification passed (2026-10-23)

- Executed integration/visual-cloud.ts against the existing Render API, Neon
  database and private storage. Baseline proposal, approval, activation, exact
  one-pixel difference, private PNG download and saved ignore-region reuse passed.
- Fixtures were synthetic 1280x900 PNGs, not fresh browser captures. Temporary
  account, project, records and objects were removed. No worker was started.
- Reviewed saved-rule editor screenshots at 360/768/1280/1920; no content overlap
  found. SQL-results and ignore-region screenshots were reviewed previously.
- Run 39926164946 passed seeded missing-alt detection in all three engines but
  failed a Chromium broken-link timeout. Added bounded startup and named stages
  for diagnosis; this is not yet a verified timeout fix. CodeQL passed.
- Remaining: green browser rerun, remaining screenshot review, dedicated cloud
  read-only SQL binding/execution and final seeded-defect measurement. Phase 5
  has not started.

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

| Phase | Scope                                                       | State                                                  |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 0     | Tooling, CI skeleton, tokens and preview                    | Locally and CI verified                                |
| 1     | Threadline and bug bank                                     | Locally and CI verified                                |
| 2     | API, database, RBAC, test cases, manual execution           | Core implemented; local and CI gates pass              |
| 3     | Runner, storage, live results, Actions execution            | Local flow and hosted happy path verified              |
| 4     | Drift, visual regression, contract/SQL/accessibility checks | Complete within approved MVP scope; see PHASE4_EXIT.md |
| 5     | Defects, Jira, gates, sign-off, PDF                         | In progress; see REMAINING_WORK.md                     |
| 6     | Dashboard and motion polish                                 | Required after Phase 5; not started                    |
| 7     | Deployment and measured demo                                | Required; final deployment/verification pending        |

Optional AI, notifications and performance budgets are deferred for MVP. Public repository: https://github.com/tulasiram2005/driftgate. Some cloud infrastructure and private storage have been verified; full deployment and final-version verification remain Phase 7 work.

The user requests a stop after each completed phase. Phase 4 is closed and Phase 5 is authorized and in progress. Stop at the Phase 5 exit gate with evidence before proceeding to a later phase.

2026-10-20 local storage follow-up: corrected presigned browser uploads that incorrectly included an empty-body checksum. LocalStack round-trip, exact bytes, URL expiry and metadata checks pass. LocalStack accepts unsigned and tampered requests, so private-provider enforcement remains NOT VERIFIED. The strict storage check retains rejection assertions unless explicitly run with `TEST_S3_EMULATOR=1`. The local queue-to-storage integration then passed through API creation, durable outbox, BullMQ, isolated Chromium, relay upload, signed callbacks, persisted PASS state and an authorized 629,484-byte evidence download. Hosted GitHub execution remains pending.

Phase 2 includes account sessions, project roles, requirements/coverage, versioned cases, CSV transfer, suites, manual results and notes. Phase 3 adds normalized step/suite joins, automated result persistence, signed callbacks, authenticated SSE, private evidence interfaces and an isolated fixed-Threadline runner. Actual devices and hosted services are not verified. See PHASE3.md for measured checks and remaining work.

Implementation revision `186142e` passed [Quality Gates](https://github.com/tulasiram2005/driftgate/actions/runs/39239313076) and [CodeQL](https://github.com/tulasiram2005/driftgate/actions/runs/39239312769) on 2026-10-19. This records executed verification, not a guarantee against every possible defect.
