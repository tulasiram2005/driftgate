# Threadline execution worker

Read CONTRACT.md for API payloads and security prerequisites. CLI accepts a base64
JSON job in RUNNER_JOB_BASE64 or argv[2]. Environment configuration is trusted
operator input. No dependency installation is performed by the worker.

Local mode uses RUNNER_MODE=local-isolated, RUNNER_LOCAL_ISOLATED=1 and
RUNNER_TARGET_ORIGIN=http://127.0.0.1:3201. Isolation is an operator prerequisite:
run Threadline and runner in the same isolated network namespace, exposing no
other services. The callback and evidence store are trusted control-plane access.
Do not put production credentials in the browser container. Use docker/run-local.sh
to establish an isolated namespace for the bundled Threadline demo and database.
The local flag alone does not create isolation.

Direct callback mode requires RUNNER_CALLBACK_URL and RUNNER_CALLBACK_SECRET
(32+ bytes). Compose spools events and starts its separate relay after the browser
exits; without a callback URL it retains local evidence only.
RUNNER_EVIDENCE_DIR controls private local storage. Production S3 adapter uses
RUNNER_S3_ENDPOINT (HTTPS), RUNNER_S3_BUCKET, RUNNER_S3_REGION (default auto), and
the standard AWS credential provider chain. Keep evidence private, use narrow
prefix-scoped write credentials, encrypt storage and set lifecycle retention.
Evidence may contain storefront data. API should issue authorized short-lived
download links; the runner never creates public ACLs.

Production execution is disabled in code pending audited network isolation and
proxy implementation covering DNS rebinding, redirects, all subrequests and
non-HTTP browser traffic. The policy validator is defense in depth only.
runner.yml executes only the bundled isolated demo, not external production sites.
GitHub dispatch and hosted storage end-to-end execution are NOT VERIFIED.

Fixed catalogue check expects six product cards; product check inspects the
everyday-shirt detail; cart check views a fresh empty cart and disabled checkout.
No checkout, coupon or quote writes occur. Retries use fresh browser contexts and
retain every attempt. Evidence upload failures fail the job without completion.
Failed assertions report generic messages to avoid leaking page secrets; inspect
private trace evidence for diagnosis. API must time out infrastructure failures.

Validation commands: pnpm --filter @driftgate/runner typecheck, lint, test, build.
Install Playwright browser binaries separately after dependencies are installed.
Phase 4 accessibility, drift and performance checks are outside this catalog.
