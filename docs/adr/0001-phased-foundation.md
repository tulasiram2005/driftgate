# ADR 0001: Isolated, phased foundation

Status: accepted for Phase 0.

DriftGate lives in its own repository and does not modify Orbit. The user requested the exact pnpm/Turborepo, Next.js, Express, Prisma and Playwright stack and a stop after each phase. We therefore scaffold only the tooling and design preview before building the demo store.

Phase 0 is runnable without credentials. Planned documentation is explicitly labelled. External scanning, auth and data operations are not simulated as working features. Deployment remains Phase 7 and is outside the phases 0-5 MVP cut.

Use Supabase Storage as the preferred candidate for a no-card free evidence bucket, subject to current signup verification. Keep the S3-compatible interface so R2 remains possible without changing application code. No provider signup or paid plan is authorized by this decision.
