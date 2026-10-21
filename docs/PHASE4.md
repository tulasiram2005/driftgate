# Phase 4 implementation checkpoint

This phase is in progress, not complete.

## Implemented

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
No screenshots or user-interface completion are claimed in this checkpoint.

## Remaining

- Collect and persist actual rendered/API snapshots, broken-link observations,
  findings and expected-difference rules with project authorization.
- Comparison and review screens with responsive/accessibility verification.
- Pixel comparisons, ignore regions, scoped baselines and approval/rejection.
- Read-only SQL assertions with a dedicated least-privilege database role.
- End-to-end real-store and bug-bank detection measurements.
- Performance budgets deferred under the agreed MVP cut.

The existing hosted Phase 3 success is not evidence that these new checks have
passed against the deployed store. Jira and release sign-off are Phase 5.
