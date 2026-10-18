# Release readiness

Status: product specification, scheduled for Phase 5. No readiness metric has been measured yet.

The requested full score weights are critical test pass rate 40%, open S1/S2 defects 25%, unresolved drift 15%, reviewed visual diffs 10%, accessibility/performance budgets 10%. Any open S1 blocks sign-off regardless of score.

Missing or stale checks must remain unknown, not silently pass. For the MVP, performance budgets are deferred; readiness must display that exclusion. Before implementation, define a versioned MVP policy that explicitly covers accessibility within the final 10% and records performance as not assessed. Never claim the full policy passed from an MVP-only result.

Each sign-off binds the exact policy version, run IDs, unresolved findings, approver identity, comment, timestamp and prior audit hash. A changed test result or reopened defect must invalidate stale readiness before a new sign-off.
