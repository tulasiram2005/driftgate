# QA workspace and API

Phase 2 implements local account registration/login, project membership, requirements, versioned test cases, CSV transfer, requirement coverage, suites and manual execution. The previous design preview lives at `/design`. The app at `/` uses real API data; no specimen metrics are shown as live results.

## Setup

Use Node 22 and pnpm 10.18.3. From the repository root:

```sh
pnpm install --frozen-lockfile
docker compose -f compose.driftgate.yml up -d --wait
cp apps/api/.env.example apps/api/.env
```

Replace JWT_SECRET in the ignored `apps/api/.env` with the output of `openssl rand -hex 48`. Never commit that file. Run migrations with the same database URL as the API:

```sh
DATABASE_URL=postgresql://driftgate:local-demo-only@127.0.0.1:55434/driftgate pnpm --filter @driftgate/api db:migrate
pnpm build
pnpm --filter @driftgate/api dev
```

In another terminal:

```sh
pnpm --filter @driftgate/web exec next dev --port 3100
```

Open http://localhost:3100 and register an account. Create a project, add a requirement, create a case with ordered steps, link it to the requirement, create a suite and start a manual run. Record a result and notes. Editing a case creates a new version without changing old run snapshots. CSV import/export uses headers `title,description,priority,type,tags,requirementId,steps`; `tags` and `steps` are JSON columns with proper CSV quoting. Export neutralizes spreadsheet formulas.

## Environment

| App         | Variable              | Purpose                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------- |
| API         | DATABASE_URL          | Separate DriftGate PostgreSQL connection, never the Threadline database    |
| API         | JWT_SECRET            | At least 48 characters; keep server-side and random                        |
| API         | API_CORS_ORIGINS      | Comma-separated exact origins without trailing slash; no wildcard          |
| API         | NODE_ENV              | development, test, or production; production enables Secure refresh cookie |
| API         | PORT                  | API listener port; default 4100                                            |
| API         | API_BIND_HOST         | Listener host; loopback by default, use 0.0.0.0 in a hosted container      |
| Web         | API_URL               | Rewrite target, default http://127.0.0.1:4100; set before build            |
| API tests   | TEST_API_DATABASE_URL | Local database named driftgate_test; other targets are refused             |
| Store tests | TEST_DATABASE_URL     | Separate Threadline database ending in _test                               |

Same-origin proxying is required for the web session cookie. Access tokens are memory-only; refresh tokens are opaque, hashed server-side and stored in HttpOnly cookies. Sessions rotate and logout revokes access to that session immediately. Membership is checked on every project operation; roles are enforced server-side even if controls are hidden in the UI.

ADMIN manages members, QA and ADMIN write test data and results, DEVELOPER and APPROVER read. Register a second account before adding it by email. Registration cannot set roles. Existing ADMIN membership cannot be demoted through the membership endpoint.

## Isolated tests

```sh
DATABASE_URL=postgresql://driftgate:local-test-only@127.0.0.1:55435/driftgate_test pnpm --filter @driftgate/api db:migrate
TEST_API_DATABASE_URL=postgresql://driftgate:local-test-only@127.0.0.1:55435/driftgate_test TEST_DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Threadline test migrations must also be applied as described in THREADLINE.md. Browser tests require the built API on 4100 and built web app on 3100. Run `pnpm --filter @driftgate/web test:e2e`; the test configuration starts the web server if no external URL is set. Tests use unique accounts and projects; run against the test database, never a hosted or demo database. The browser service adds simulated test records to that database.

Swagger UI is at http://127.0.0.1:4100/docs and the generated Zod/OpenAPI document is at `/openapi.json`.

## Remaining scope

Automated runners, screenshots/video upload, SSE, queue dispatch, drift detection, visual reviews, Jira, release gates, signed audit chains and cloud deployment remain later phases. Phase 2 manual evidence is notes. Steps and suite case identifiers currently use bounded JSON/arrays with application validation; explicit normalized join/step tables are tracked before the runner phase. Hosted CI and actual devices require separate verification.
