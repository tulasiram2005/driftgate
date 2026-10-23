# Release readiness

Status: Phase 5 pure server-side evaluator implemented and unit-tested in
apps/api/src/readiness.ts. Persisted release/gate evidence collection, API/UI and
sign-off integration are pending. No project readiness metric has been measured.

The requested full score weights are critical test pass rate 40%, open S1/S2 defects 25%, unresolved drift 15%, reviewed visual diffs 10%, accessibility/performance budgets 10%. Any open S1 blocks sign-off regardless of score.

## MVP policy `mvp-1`

The evaluator accepts trusted server-collected evidence, never client-provided
passing counts. Each component requires source IDs and an observation timestamp.
The future collector must resolve those IDs within the same project/environment
and use actual source timestamps, not refresh an old check's age when reading it.

| Component          | Weight | Calculation                                          |
| ------------------ | ------ | ---------------------------------------------------- |
| Critical tests     | 40     | Passed / total                                       |
| Defects            | 25     | Full points only when no non-closed S1 or S2 exists  |
| Drift              | 15     | Full points only when unresolved findings equal zero |
| Visual differences | 10     | Reviewed / total                                     |
| Accessibility      | 10     | Passed / total                                       |

- Missing observations, future timestamps and observations older than 24 hours
  produce unknown components and a null overall score, never a fabricated pass.
- Zero critical/accessibility checks means unknown. A recorded visual comparison
  with zero differences receives full visual points; absence of a comparison does not.
- Non-closed includes Fixed and Retest. Only Closed clears the defect penalty.
- Open S1, any failed critical test or failed accessibility check is a hard block.
- Otherwise eligibility requires complete evidence and a score of at least 90.
  Partial visual review can meet this numeric policy; stricter per-gate exit
  criteria must be checked separately by the future gate service.
- Fractional scores are rounded down to two decimals. Unknown weights are not
  redistributed. Performance is explicitly returned as excluded, not passed.
- SHA-256 binds the versioned policy and validated evidence, including project,
  environment, source references and defect revisions. A hash is an integrity
  fingerprint, not an approval or proof that submitted evidence is authentic.
- This evaluator does not persist sign-offs or implement the audit chain.

Never claim the full policy passed from an MVP-only result.

Each sign-off binds the exact policy version, run IDs, unresolved findings, approver identity, comment, timestamp and prior audit hash. A changed test result or reopened defect must invalidate stale readiness before a new sign-off.
