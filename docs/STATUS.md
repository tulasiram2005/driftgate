# Phase status

| Phase | Scope                                                       | State                                                             |
| ----- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 0     | Tooling, CI skeleton, tokens and preview                    | Locally and CI verified                                           |
| 1     | Threadline and bug bank                                     | Locally and CI verified                                           |
| 2     | API, database, RBAC, test cases, manual execution           | Core implemented; local and CI gates pass                         |
| 3     | Runner, storage, live results, Actions execution            | Local implementation verified in part; hosted integration pending |
| 4     | Drift, visual regression, contract/SQL/accessibility checks | Not started                                                       |
| 5     | Defects, Jira, gates, sign-off, PDF                         | Not started                                                       |
| 6     | Dashboard and motion polish                                 | Outside MVP                                                       |
| 7     | Deployment and measured demo                                | Separate follow-up after MVP                                      |

Optional AI, notifications and performance budgets are deferred for MVP. Public repository: https://github.com/tulasiram2005/driftgate. Cloud deployment is pending. Account-specific no-card storage availability needs confirmation.

The user requests a stop after each completed phase. Phase 3 is authorized and in progress; do not begin Phase 4 yet.

Phase 2 includes account sessions, project roles, requirements/coverage, versioned cases, CSV transfer, suites, manual results and notes. Phase 3 adds normalized step/suite joins, automated result persistence, signed callbacks, authenticated SSE, private evidence interfaces and an isolated fixed-Threadline runner. Actual devices and hosted services are not verified. See PHASE3.md for measured checks and remaining work.

Implementation revision `186142e` passed [Quality Gates](https://github.com/tulasiram2005/driftgate/actions/runs/39239313076) and [CodeQL](https://github.com/tulasiram2005/driftgate/actions/runs/39239312769) on 2026-10-19. This records executed verification, not a guarantee against every possible defect.
