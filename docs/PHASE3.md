# Phase 3 verification checkpoint

Measured locally on 2026-10-19 and 2026-10-20 (Asia/Kolkata).

## Implemented

- Relational test steps and suite membership with migrations and preserved external API shapes.
- Automated runs, idempotent creation, durable dispatch outbox, matrix results and retry history.
- Timestamped HMAC callbacks with replay protection and ownership-protected result APIs.
- Authenticated resumable SSE and live browser results, with polling fallback.
- Manual evidence reservation/completion and authorized short-lived download URLs behind S3 storage.
- Fixed Threadline Playwright checks, private screenshots, traces and video, and isolated Docker execution.
- GitHub workflow configured for the same isolated bundled demo and a separate credential-bearing relay.

## Executed checks

| Check                                        | Result                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Frozen lockfile install                      | PASS                                                                                                                        |
| Workspace typecheck and lint                 | PASS                                                                                                                        |
| Workspace unit/integration tests             | PASS: tooling 21, API 26, web 38, runner 7, storefront 34                                                                   |
| Workspace production build                   | PASS (storefront reused a previously successful build cache)                                                                |
| Full browser regression                      | PASS: DriftGate 24, Threadline 18, Chromium/Firefox/WebKit                                                                  |
| New result UI at 360/768/1280/1920px         | PASS: overflow/accessibility checks and screenshot inspection                                                               |
| Runner deterministic fixture                 | PASS: 12 real-browser results, flaky retry, evidence byte signatures, signed HTTP callbacks and rejected foreign subrequest |
| Actual isolated Threadline, Chromium desktop | PASS: catalogue/product/cart plus 9 nonempty evidence files with matching sizes                                             |

The UI test uses explicitly synthetic signed result callbacks to verify persistence and live updates, not a queue worker. The runner fixture is distinct from the actual Threadline run. API coverage currently includes app/config/contracts, not the new execution/storage/worker modules; do not generalize that percentage to Phase 3.

## Bugs found and fixed

The streaming response now observes response closure and uses `Cache-Control: no-store, no-transform`. Without no-transform, the Next proxy buffered live events. The local HTTP UI uses secure random bytes for idempotency keys rather than requiring randomUUID in an insecure context. The pinned Playwright image uses pwuser UID/GID 1001; the original home tmpfs owner 1000 prevented Firefox from launching. A direct isolated Firefox launch passes with the corrected ownership.

The corrected isolated actual-Threadline matrix passed on 2026-10-20: 18/18 checks
across Chromium, Firefox and WebKit, desktop and mobile emulation. All 54 evidence
files were nonempty and matched their recorded sizes. The completion event reported
passed with resultCount 18. Temporary Docker services were removed successfully.

## Remaining gates

- Verify BullMQ dispatch, relay upload and authenticated evidence download together against configured private storage.
- Verify GitHub workflow dispatch against a publicly reachable API. Workflow configuration alone is not execution evidence.
- Hosted bucket/API are not configured; user requested local verification first on 2026-10-20.
- External production scanning remains disabled until its separate network isolation policy is implemented and validated. GitHub's bundled demo execution does not imply deployed-environment scanning works.
- Recheck hosted CI after publishing this checkpoint. No cloud deployment or physical-device verification is claimed.

## Local runner

From the repository root, set RUNNER_JOB_BASE64 to a base64 JSON v1 job described in apps/runner/CONTRACT.md, then run `sh apps/runner/docker/run-local.sh`.

With no callback configured, it writes private evidence and ordered callback JSON to a temporary directory printed on completion. Inspect the final completed event: process exit success alone does not mean assertions passed. Docker Compose removes its temporary services after execution. Do not expose the evidence directory publicly.

The GitHub runner requires repository variables RUNNER_CALLBACK_URL, RUNNER_S3_ENDPOINT, RUNNER_S3_BUCKET and optionally RUNNER_S3_REGION, plus secrets RUNNER_CALLBACK_SECRET, RUNNER_S3_ACCESS_KEY_ID and RUNNER_S3_SECRET_ACCESS_KEY. Set these through the provider settings, never in tracked files. The API and relay must share the callback signing secret and bucket.
