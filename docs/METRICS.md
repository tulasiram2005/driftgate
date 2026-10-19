# Measured evidence

## Phase 3 local checkpoint (2026-10-20)

Frozen install, typecheck, lint, unit/integration tests and production build passed.
Full browser regression: DriftGate 24/24 and Threadline 18/18 passed. New automated
results were checked at 360, 768, 1280 and 1920 pixels, including screenshots and
automated accessibility checks. See [PHASE3.md](PHASE3.md) for separate fixture,
actual runner evidence and explicit remaining integration gates. Hosted storage,
GitHub runner execution and deployment are not claimed by these local results.

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
