# Threadline local environments

Threadline is a fictional fashion storefront used as a controlled QA target. It has no real payments, shipping or customer accounts. Checkout creates only a simulated order. The environment called `prod` is also a demo, not a live retail service.

## Start locally

Requires Node 22, pnpm 10.18.3 and Docker. Commands run from the repository root. These public passwords belong only to loopback-bound local demo containers; never reuse them on deployed databases.

```sh
pnpm install --frozen-lockfile
docker compose -f compose.threadline.yml up -d --wait
export DATABASE_URL=postgresql://threadline:local-demo-only@127.0.0.1:55432/threadline TEST_DATABASE_URL=postgresql://threadline:local-test-only@127.0.0.1:55433/threadline_test
pnpm --filter @driftgate/demo-store db:migrate
DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter @driftgate/demo-store db:migrate
pnpm --filter @driftgate/demo-store db:seed
pnpm test
pnpm build
pnpm --filter @driftgate/demo-store dev
```

On this workstation use the pnpm wrapper from README.md if the global launcher is unavailable. Open `http://localhost:3200/staging`. Other routes are `/uat`, `/preprod` and `/prod`. Each environment has isolated products, sizes, stock and orders within the dedicated Threadline database. The four path configurations can be tested on one local server; this does not mean four cloud deployments exist.

## Configuration

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Dedicated Threadline PostgreSQL connection. Never point it at Orbit or DriftGate's future operational database. |
| TEST_DATABASE_URL | Separate test connection with database name ending `_test`. Used by integration tests. |
| THREADLINE_BUG_FLAGS | Omit or leave blank for environment defaults; `none` disables all seeded defects; comma-separated known names enables only those defects. Server-side setting, not a public mutation endpoint. |
| THREADLINE_BASE_URL | Optional existing server for browser tests; omit to let Playwright start the built app. |
| PW_TEST_CONNECT_WS_ENDPOINT | Optional remote Playwright browser server for sandboxed environments. |

See BUG_BANK.md for individual flags, affected environments and reproduction steps. Never use a defective environment as the reference for clean accessibility or totals assertions. Seeded bug checks verify the fixture behavior; they do not measure the future DriftGate runner's detection rate.

## Persistence and cleanup

The demo database uses a named Docker volume. The test database uses temporary memory-backed storage. Stopping the containers without deleting volumes preserves demo data. Do not use `down -v` unless you intend to delete the demo database. Product seeding is idempotent; it must not erase orders or silently restore stock sold through simulated checkout.

No cloud credentials, Jira token or storage account is required for this phase. Deployment remains a later phase.
