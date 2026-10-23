# Persisted SQL checks

SQL checks in the project workspace execute the three existing fixed Threadline
assertions: nonnegative stock, order totals and orphan order items.

## Configuration

Set THREADLINE_READONLY_DATABASE_URL privately on the API and set
THREADLINE_SQL_PROJECT_ID to the single authorized DriftGate project ID.
The URL must use a dedicated SELECT-only role. Existing SQL validation rejects
privileged roles, role memberships, schema creation and table write privileges.
No URL, SQL text or table identifier is accepted from the browser.

These new settings have not been configured in the cloud. A project without
the binding returns NOT_CONFIGURED rather than running against another project's
database. Do not use the application's normal write-capable database credential.

## API and history

POST /api/v1/projects/:projectId/sql-checks accepts only environment:
staging, uat, preprod or prod. ADMIN and QA may execute. All project members can
read the paginated GET endpoint at the same path.

Each completed attempt records the actor, environment, timestamp, duration and
PASS/FAIL assertion counts. Database errors produce a persisted ERROR outcome
with SQL_CHECK_UNAVAILABLE and no raw error details or partial results.
Only one execution is allowed per API process at a time.

The UI offers environment selection, execution, history and assertion outcomes.
An ERROR is not a pass. Results are point-in-time checks, not ongoing monitoring.

## Verification

- API regression: 91 tests pass, including project binding, roles, strict input,
  PASS/FAIL/ERROR persistence, redaction, pagination and recovery.
- Real isolated Threadline read-only integration passes, including seeded
  order-total/orphan defects and rejection of write-capable roles.
- API build, web production build (webpack), scoped lint and 40 web tests pass.
- Browser fixture added for four widths and accessibility. Browser execution,
  screenshot review and hosted SQL configuration remain NOT VERIFIED.
