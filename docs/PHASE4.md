# Phase 4 implementation checkpoint

This phase is in progress, not complete.

## Implemented

- Internal fixed-origin Threadline snapshot collector combines rendered prices,
  badges, image response status/dimensions, title, canonical and validated
  Product JSON-LD with catalogue stock data. Limits: 20 products, 1 MiB parsed
  catalogue, 32 KiB metadata, 10-second individual navigation/readiness waits.
  It requires the existing restricted runner page; it is not exposed via HTTP
  or wired into dispatch yet. Unknown image status remains null, not assumed 200.
  Production external scanning remains disabled. Browser fixture verification
  passed in CI on `d18f677`, including failure cleanup and recovery; runner unit
  tests pass 28/28. Persistence and comparison screens remain pending.

- Fixed Threadline SQL assertions and operator CLI: negative stock, order/line
  arithmetic and missing product-size references. Only a dedicated SELECT-only
  account with no role membership, schema-create access or public-table write
  privileges is accepted. Each check runs in a read-only repeatable-read
  transaction with statement/lock/transaction timeouts. Orders are bounded to
  10,000; exceeding this limit reports an error, not a partial pass. No arbitrary
  SQL or credentials are accepted from HTTP clients. See SQL_CHECKS.md.

- Pure bounded environment snapshot comparison: monetary normalization without
  currency conversion, product counts, presence, sizes/stock, discounts, badge,
  image observations, title, canonical and Product JSON-LD. Findings retain
  before/after values, severity and explicitly matched expected differences.
- Fixed Threadline `api-contract` check validates product response fields,
  nonnegative integer prices/stock and unique identities with Zod.
- Fixed Threadline `accessibility` check scans the catalogue with axe-core for
  WCAG 2 A/AA and WCAG 2.1 AA tags. Failures preserve rule IDs, not DOM snippets.
- Both checks use the existing browser route restrictions, signed result flow,
  screenshot/video/trace evidence and authenticated result retrieval. Existing
  default checks remain unchanged. They can be explicitly requested via
  `POST /api/v1/projects/:projectId/automated-runs` in its `checks` array.

## Verification

Runner tests: 23 passed, including 12 drift comparisons and malformed inputs.
API tests: 32 passed against isolated local `driftgate_test` only.
API and runner production builds and lint passed.
Browser fixture test at `apps/runner/integration/quality.ts` checks both clean
and seeded-failure responses. Local Chromium launch was blocked by the app
sandbox; GitHub CI includes this test. Its result must be recorded separately.
Hosted follow-up: revision `0a7a315` fixed the fixture to create an explicit
browser context, as required by axe. [Quality Gates run 39543108410](https://github.com/tulasiram2005/driftgate/actions/runs/39543108410)
passed, including the runner quality fixtures, full browser/accessibility suite,
typecheck, lint, tests, build and dependency audit. [CodeQL run 39543108381](https://github.com/tulasiram2005/driftgate/actions/runs/39543108381)
also passed. This verifies the clean and seeded-failure fixtures in CI, not
real-store bug-bank detection for the new checks.
No screenshots or user-interface completion are claimed in this checkpoint.

## Remaining

- Collect and persist actual rendered/API snapshots, broken-link observations,
  findings and expected-difference rules with project authorization.
- Comparison and review screens with responsive/accessibility verification.
- Pixel comparisons, ignore regions, scoped baselines and approval/rejection.
- Persist SQL outcomes and connect them to authorized run results/UI; configure
  a dedicated deployed-store read-only role when cloud verification is needed.
- End-to-end real-store and bug-bank detection measurements.
- Performance budgets deferred under the agreed MVP cut.

The existing hosted Phase 3 success is not evidence that these new checks have
passed against the deployed store. Jira and release sign-off are Phase 5.
