# Phase status

| Phase | Scope                                                       | State                                     |
| ----- | ----------------------------------------------------------- | ----------------------------------------- |
| 0     | Tooling, CI skeleton, tokens and preview                    | Locally verified; hosted CI pending       |
| 1     | Threadline and bug bank                                     | Locally verified; hosted CI pending       |
| 2     | API, database, RBAC, test cases, manual execution           | Implemented; local gates pass; CI pending |
| 3     | Runner, storage, live results, Actions execution            | Not started                               |
| 4     | Drift, visual regression, contract/SQL/accessibility checks | Not started                               |
| 5     | Defects, Jira, gates, sign-off, PDF                         | Not started                               |
| 6     | Dashboard and motion polish                                 | Outside MVP                               |
| 7     | Deployment and measured demo                                | Separate follow-up after MVP              |

Optional AI, notifications and performance budgets are deferred for MVP. Public repository: https://github.com/tulasiram2005/driftgate. Cloud deployment is pending. Account-specific no-card storage availability needs confirmation.

The user requests a stop after each completed phase. Do not begin Phase 3 without continue.

Phase 2 includes account sessions, project roles, requirements/coverage, versioned cases, CSV transfer, suites, manual results and notes. Screenshot uploads and automated execution are Phase 3. Step/suite join normalization is tracked in PHASE2.md before runner integration. Actual devices and hosted services are not verified.
