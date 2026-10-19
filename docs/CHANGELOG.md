# Changelog

## Unreleased

- Phase 2: Express/Prisma API, Zod-derived OpenAPI, Argon2 login, rotating HttpOnly refresh sessions, project membership and RBAC.
- QA workspace with requirements, linked coverage, versioned test cases, atomic CSV import/export, suites and manual run/result notes. Prior run snapshots survive case edits and archival.
- Client memory-only access tokens, session recovery, pagination, error/loading/empty states and delete confirmation. Design preview moved to `/design`.
- Isolated API database and authorization/session/CSV integration tests, plus browser-client unit tests. Full measured results are tracked in METRICS.md.

- Phase 1: Threadline catalogue, product details, cart, coupons and simulated checkout; four isolated environment configurations and 15 deliberate demo defects.
- PostgreSQL migration and non-destructive seed; strict request validation, transaction-safe stock updates and idempotent checkout.
- Responsive storefront, themes, loading/error states and local cart persistence. Browser verification found and fixed checkout key generation on HTTP demo hosts.
- Public GitHub repository created. Hosted CI and deployment status are tracked separately in STATUS.md.

- Phase 0: independent pnpm/Turborepo repository with strict TypeScript, linting, formatting, hooks and CI/security workflow definitions.
- Ink and Signal tokens and responsive preview, persistent themes, accessible dialogs, command search and synthetic evidence comparison.
- Runtime and contrast unit tests; three-engine browser and automated accessibility checks.
- Setup, architecture, design, planned APIs/schema and phase tracking.
