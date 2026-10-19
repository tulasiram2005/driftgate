# Threadline bug bank

Phase 1 provides 15 independently switchable demo defects. Staging is clean by default. All currency fields named `*Cents` are integer INR minor units (paise); the names preserve the API contract. The 8.25% tax is a fictional test rate, not tax guidance. Orders are SIMULATED and collect no payment details or PII.

## Deterministic environments

| Environment | Default flags                                                                  |
| ----------- | ------------------------------------------------------------------------------ |
| staging     | none                                                                           |
| uat         | missingAlt, mobileImageBroken, priceMismatch, couponStacking, stockMismatch    |
| preprod     | webkitCheckoutHidden, wrongCanonical, missingJsonLd, taxRounding, emptyCart500 |
| prod        | staleBadge, missingProduct, brokenImage, brokenLink, wrongProductTitle         |

`THREADLINE_BUG_FLAGS` replaces the defaults across all environments served by that process. Unset, empty, or whitespace uses defaults. `none` disables every flag. Otherwise use comma-separated exact names. Unknown names, mixed `none`, and empty comma entries fail with 503 `INVALID_BUG_FLAGS`. Duplicates are removed. `/api/{environment}/config` returns the effective string array. Separate deployment processes can supply different overrides.

## Reproduction bank

Compare each scenario with staging using no override, or run the same environment once with `none` and once with only the named flag. IDs, slugs and sizes are stable across environments. Each flag has one independent behavior; no other flag is required.

| Flag                 | Owner    | Exact trigger                                     | Clean expected result                      | Flagged result / detection                                                                                                             |
| -------------------- | -------- | ------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| missingAlt           | API + UI | Shirt image on catalogue or everyday-shirt detail | Meaningful white cotton T-shirt alt        | API alt becomes empty; UI omits alt attributes. Inspect DOM / axe.                                                                     |
| mobileImageBroken    | UI       | Product images at viewport <=600px                | Asset loads                                | Picture source points at seeded-mobile-missing.jpg. Inspect image request failure.                                                     |
| webkitCheckoutHidden | UI       | Nonempty cart, WebKit small viewport              | Place demo order button visible            | Seeded CSS hides checkout control. Browser visibility assertion.                                                                       |
| wrongCanonical       | UI       | Catalogue or product page metadata                | Canonical matches current environment/path | Canonical points to /prod/incorrect-product. Inspect link rel=canonical.                                                               |
| missingJsonLd        | UI       | Product detail                                    | Product JSON-LD present                    | Product schema omitted. Inspect script type=application/ld+json.                                                                       |
| staleBadge           | UI       | Featured catalogue card or product detail         | Discount derived from prices               | 50% off label despite canonical amounts. Compare badge calculation.                                                                    |
| missingProduct       | API      | List products, city-tote detail, or bag quote     | Backpack available                         | List omits bag; detail/quote returns 404 PRODUCT_NOT_FOUND.                                                                            |
| priceMismatch        | API      | everyday-shirt display then quote shirt M x1      | Display and quote both 3999                | Display 4499; quote canonical unit price 3999.                                                                                         |
| couponStacking       | API      | Shirt M x1 with WELCOME10 and SAVE20              | 400 COUPON_STACKING                        | Combined 30% discount, 1200 minor units.                                                                                               |
| stockMismatch        | API      | Shirt L displayed then quoted                     | Stock 0 and purchase refused               | Display stock 5; quote/checkout still returns 409 OUT_OF_STOCK.                                                                        |
| taxRounding          | API      | Shirt M x1 with no coupons                        | Tax 330, total 4329                        | Tax truncated to 329, total 4328.                                                                                                      |
| emptyCart500         | API      | POST quote/checkout with items:[] and coupons:[]  | 400 EMPTY_CART                             | 503 SIMULATED_EMPTY_CART_FAILURE. Legacy flag name retained; HTTP 503 follows agreed status contract. Checkout also needs a valid key. |
| brokenImage          | API      | utility-jacket image                              | /products/jacket.jpg loads                 | /products/missing-jacket.jpg fails.                                                                                                    |
| brokenLink           | UI       | Click sneakers catalogue photo                    | daily-sneakers detail                      | unavailable-piece route gives not-found state.                                                                                         |
| wrongProductTitle    | API + UI | weekend-dress detail                              | Occasion Dress title                       | API title Utility Jacket; UI also injects incorrect document title. Compare stored/displayed title.                                    |

## Baseline and persistence

Six illustrative demo products: white cotton T-shirt, dark cropped denim trousers, red long occasion dress, black biker jacket, navy backpack, red running shoe. Stable slugs are everyday-shirt, tailored-trousers, weekend-dress, utility-jacket, city-tote, daily-sneakers. Images are local `/products/{shirt,trousers,dress,jacket,bag,sneakers}.jpg`. Photo provenance belongs to docs/ASSETS.md; these are fictional products without real sales or brand affiliation.

PostgreSQL composite product/size keys and order idempotency keys include environment. Seed upserts insert missing products/sizes and preserve existing product edits, inventory and orders. Reseeding never resets or wipes data. Flags transform API presentation/calculation; persisted product records retain the clean baseline.

Cart bodies are strict Zod objects: up to 20 rows, each quantity 1..10, aggregate duplicate product/size quantity <=10, at most two recognized coupons. WELCOME10 and SAVE20 are case-sensitive. Duplicate coupon codes count only once. Unknown fields including client totals are rejected. JSON bodies are bounded to 16 KiB. Empty carts return 400 except the explicit defect. Unknown products return 404, unknown sizes 400, insufficient stock 409.

Checkout recomputes integer totals from PostgreSQL within a serializable transaction, conditionally decrements available stock, and inserts the sandbox order atomically. Retries use a canonical cart hash and environment-scoped 8..128 character idempotency key. Same key/cart returns the original order even when stock is now exhausted; a changed cart returns 409. Concurrent conflicts retry up to four times, then return CHECKOUT_BUSY. No negative stock or partial order is permitted by injected defects. Duplicate cart rows and coupon ordering are normalized before hashing.

## Parent integration commands

Dependencies: prisma and @prisma/client 6.19.0, zod 3.25.76, tsx 4.20.6, Vitest and TypeScript. Existing parent scripts `db:migrate` (prisma migrate deploy), `db:seed` (tsx prisma/seed.ts), and `test` (vitest run) match the implementation. Generate Prisma client before typechecking/testing. Run commands from apps/demo-store via the approved pnpm wrapper/filter.

`DATABASE_URL` is the dedicated Threadline PostgreSQL database, never the future DriftGate application database. `TEST_DATABASE_URL` is optional for normal unit tests but required for database integration evidence. Its URL database path must end in `_test`; any other supplied name fails the integration suite immediately. Apply the same migration to that database using `DATABASE_URL=$TEST_DATABASE_URL` before tests. Tests create unique fixtures and clean up only their own generated IDs/orders in afterAll, never wipe tables or delete baseline products, and disconnect their client. Do not put credentials in tracked files.

Tests: `tests/engine.test.ts` covers baseline, all nine API defects, totals, flags, bounds and stock; `tests/http.test.ts` covers envelopes, sanitization and body limits; `tests/database.integration.test.ts` covers non-destructive seed, canonical totals, environment isolation, atomic rejection, concurrent idempotency, conflicting requests and oversell prevention. Integration is explicitly skipped when its URL is absent. UI/browser verification belongs to the parent/Astra workstream. DriftGate detection rates and false positives remain unmeasured until the runner phase executes.
