# Read-only Threadline checks

This is an operator-side Phase 4 component, not yet a dashboard or cloud integration.
It reads the Threadline database, never the DriftGate application database.

Configure `THREADLINE_READONLY_DATABASE_URL` privately in the process environment
and set `SQL_CHECK_ENVIRONMENT` to staging, uat, preprod or prod. Then run:

```sh
pnpm --filter @driftgate/api check:sql
```

Output contains only check names, PASS/FAIL and violation counts. Exit 0 means
all assertions passed; 1 means a finding; 2 means the check could not complete.
Errors must not be interpreted as passing checks. Connection errors are redacted.

## Role requirements

An administrator must provision a separate login, not reuse the owner account.
Grant CONNECT to the Threadline database, USAGE on public, and SELECT on
`Product`, `ProductSize`, `SandboxOrder`. Do not grant schema CREATE, table
writes, role membership, superuser, replication, bypass-RLS, create-role or
create-database privileges. Public grants may also confer access; the checker
tests effective public-table privileges rather than relying on the role name.
The role is not exposed to the browser runner or any public client.

All queries are fixed and environment values are parameterized. Execution uses
READ ONLY and REPEATABLE READ, a 5-second statement timeout, 1-second lock timeout
and 20-second transaction timeout. No user-supplied SQL is executed.

Assertions cover nonnegative size stock, order totals after discount/tax,
line price times quantity, subtotal equality and missing product-size references.
Malformed order items fail the totals check. The check does not validate tax
policy, sales history or deleted-product retention policy. The demo model has
no customer relation, so orphan checking refers to order product-size references.

## Verification

`integration/sql-checks.ts` refuses any database other than local
`threadline_test`. It creates a random temporary SELECT-only role, verifies
write denial, refuses privileged and writable roles, inserts one uniquely named
demo order with inconsistent subtotal and a missing product reference, verifies
the exact increase in violations, then removes only its own fixture and role.
No existing orders or database constraints are removed.

```sh
TEST_DATABASE_URL='<local threadline_test admin URL>' pnpm --filter @driftgate/api exec tsx integration/sql-checks.ts
```

This integration passed locally on 2026-10-21. Negative-stock detection is a
defensive query; the current demo database already prevents negative stock with
a constraint. Cloud SQL verification and result persistence are still pending.
