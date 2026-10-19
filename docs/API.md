# API

Status: Threadline API plus DriftGate Phase 2 authentication, projects, test cases, suites and manual runs are implemented locally. Automated runs and sign-off remain future work.

## Threadline demo API

These public sandbox routes accept environments `staging`, `uat`, `preprod`, and `prod`. They handle fictional products and simulated orders only. They do not accept payments or personal details. Responses use `Cache-Control: no-store`.

| Method | Path                               | Result                                                           |
| ------ | ---------------------------------- | ---------------------------------------------------------------- |
| GET    | `/api/:environment/products`       | `{data:{products,flags}}`                                        |
| GET    | `/api/:environment/products/:slug` | `{data:{product,flags}}`                                         |
| GET    | `/api/:environment/config`         | `{data:{environment,flags}}`                                     |
| POST   | `/api/:environment/quote`          | `{data:{items,subtotalCents,discountCents,taxCents,totalCents}}` |
| POST   | `/api/:environment/checkout`       | `{data:{orderId,totalCents,status:"SIMULATED"}}`                 |

Quote request example (checkout adds `idempotencyKey`, 8-128 letters, digits, underscores or hyphens):

```json
{ "items": [{ "productId": "shirt", "size": "S", "quantity": 1 }], "coupons": ["WELCOME10"] }
```

JSON bodies are limited to 16 KiB, 20 cart lines and quantities 1-10 per product/size. Valid coupons are `WELCOME10` and `SAVE20`. Baseline rejects stacking; the deliberate coupon flag enables it. Totals use integer minor units. Checkout uses a serializable transaction and conditional stock updates. The same environment/key and payload replays its receipt; changing the payload returns 409.

Errors: `{error:{code,message}}`. Statuses: 400 invalid body/coupon/cart, 404 missing environment/product, 409 stock/idempotency conflict, 503 unavailable database/configuration or the intentional empty-cart fault. Internal exceptions are not exposed. See BUG_BANK.md for intentionally faulty environments. DriftGate scanning detection remains future scope.

## DriftGate Phase 2

Generated Zod/OpenAPI is at `/openapi.json`, with Swagger at `/docs`. `/health` is liveness; `/ready` runs a database query. Errors are `{error:{code,message}}`; successful JSON responses are `{data:...}`. Collections support `cursor` and `limit` (1-200), with `nextCursor` outside `data`. Test case search also accepts `search` and `priority`.

Authentication uses `Authorization: Bearer <accessToken>` except the four auth routes. Login/register return `{data:{user:{id,name,email},accessToken}}` and set an HttpOnly SameSite=Strict refresh cookie. `/auth/refresh` rotates it. `/auth/logout` revokes it. No password or token hashes are returned. Login is limited to 10 attempts/minute, registration to 20, refresh to 60; limits apply per client address. The local proxy preserves neither trust nor authority from arbitrary forwarded IP headers.

| Method     | /api/v1 path                                       | Access               | Body / response                                                               |
| ---------- | -------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| POST       | /auth/register                                     | Public               | name, email, password (12-128 chars); session response                        |
| POST       | /auth/login                                        | Public               | email, password; session response                                             |
| POST       | /auth/refresh                                      | Cookie               | No body; rotated session response                                             |
| POST       | /auth/logout                                       | Cookie               | No body; `{data:{loggedOut:true}}`                                            |
| GET/POST   | /projects                                          | Authenticated        | List own projects / create `{name,description?}` with ADMIN membership        |
| GET        | /projects/:projectId                               | Member               | Project and current role                                                      |
| GET/POST   | /projects/:projectId/members                       | Member / ADMIN       | List users and roles / `{email,role}` where role is QA, DEVELOPER or APPROVER |
| GET/POST   | /projects/:projectId/requirements                  | Member / QA or ADMIN | List / create `{title,description?}`                                          |
| GET/POST   | /projects/:projectId/cases                         | Member / QA or ADMIN | List / create test case below                                                 |
| PUT/DELETE | /projects/:projectId/cases/:caseId                 | QA or ADMIN          | Full replacement as new version / archive without deleting run evidence       |
| GET        | /projects/:projectId/cases/:caseId/versions        | Member               | Immutable snapshots, newest first                                             |
| GET        | /projects/:projectId/cases.csv                     | Member               | CSV attachment, up to 5000 active cases                                       |
| POST       | /projects/:projectId/cases/import                  | QA or ADMIN          | `{csv:string}`, 1-200 validated rows imported atomically                      |
| GET        | /projects/:projectId/coverage                      | Member               | Requirements with linked active cases, up to 1000 requirements                |
| GET/POST   | /projects/:projectId/suites                        | Member / QA or ADMIN | List / `{name,caseIds:string[]}` (1-200 unique cases from same project)       |
| GET/POST   | /projects/:projectId/runs                          | Member / QA or ADMIN | List with results / `{suiteId,environment,browser,device}`                    |
| PUT        | /projects/:projectId/runs/:runId/results/:resultId | QA or ADMIN          | `{status,notes?}`; status PASS, FAIL, BLOCKED or SKIPPED                      |

Test case body:

```json
{
  "title": "Checkout receipt",
  "description": "Demo storefront check",
  "priority": "HIGH",
  "type": "MANUAL",
  "tags": ["sanity"],
  "requirementId": null,
  "steps": [{ "action": "Place a demo order", "expected": "A simulated receipt appears" }]
}
```

Case success returns the above data plus id, projectId, version, archived and createdAt. A run snapshots current case titles, steps and versions with result status NOT_RUN; editing or archiving a case never rewrites those snapshots. Environments are STAGING, UAT, PREPROD, PROD. Manual run creation is limited to 30/minute. Idempotent automated dispatch is Phase 3.

Errors: 400 INVALID_INPUT/INVALID_CSV, 401 UNAUTHORIZED/INVALID_CREDENTIALS/SESSION_EXPIRED, 403 FORBIDDEN/ORIGIN_DENIED, 404 NOT_FOUND (also for nonmembers), 409 CONFLICT/VERSION_CONFLICT/ARCHIVED_CASE/ADMIN_PROTECTED, 429 RATE_LIMITED, 503 UNAVAILABLE. Invalid JSON and oversized bodies return sanitized errors. CORS is an exact-origin allowlist and state-changing cross-site requests are rejected.

Update this document from the actual route contracts in each phase; include method, auth, body, success/error examples and validation details.
