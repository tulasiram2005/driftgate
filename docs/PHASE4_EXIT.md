# Phase 4 exit checklist

The delivery contract places full deployment and the complete measured bug-bank
demonstration in Phase 7. They must not silently expand the Phase 4 exit gate.
Performance budgets are excluded by the approved MVP scope.

## Implemented and supported by recorded checks

- Environment snapshots, pairwise drift findings and reusable expected rules.
- Approved active visual baselines, persisted pixel differences and saved masks.
- API contract and accessibility runner checks.
- Restricted-role SQL assertions, stored results and results screen.
- Bounded same-environment broken-link detection, including missing product data.
- Hosted visual API/private-storage round-trip with synthetic PNGs and cleanup.
- Cloud application schema migrations.

See METRICS.md for individual runs and limitations. These statements do not mean
every seeded defect is detected or that all hosted workflows are production-ready.

## Completed Phase 4 gate

- Quality Gates 39929634240 and CodeQL 39929634248 passed for dff31ef.
  Previous Chromium probe-close timeouts are resolved in this full browser run.
- Visual review completed for baseline approval, comparison results, saved
  regions, SQL results, expected rules and findings at 360/768/1280/1920.
  Evidence comes from successful run 39898325492; it is fixture-driven UI
  verification, not proof of real-device or live-cloud UI behavior.
- Final verification results and limitations recorded in STATUS.md/METRICS.md.

Phase 5 may start after those gates pass and the user authorizes the next phase.
It covers defects, Jira, release gates, hash-chained sign-off and PDF reports.

## Explicit Phase 7 deployment follow-up

- Provision the separate cloud Threadline database, restricted SQL role and
  project binding; verify live SQL execution through the hosted API.
- Complete deployment of all services and the full bug-bank detection matrix.
- Resolve always-on worker availability within the free-only constraint.

The temporary worker remains stopped. No paid resource is authorized.
