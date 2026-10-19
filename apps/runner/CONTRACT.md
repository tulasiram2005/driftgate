# Runner API contract v1

Job JSON (strict keys; no executable code, selectors, scripts, or supplied URLs):

```json
{
  "version": 1,
  "runId": "run_123",
  "environment": "staging",
  "targetId": "threadline",
  "checks": ["catalogue", "product", "cart"],
  "matrix": [{ "browser": "chromium", "device": "desktop" }],
  "retries": 1
}
```

Environment enum: staging, uat, preprod, prod. Check enum: catalogue, product,
cart. Browser enum: chromium, firefox, webkit. Device enum: desktop, mobile.
Mobile uses a fixed 390x844 touch viewport (Firefox has no isMobile emulation).
Maximum 9 unique matrix cells, 3 unique checks, retries 0..2. IDs match
`[A-Za-z0-9_-]{1,80}`. Only targetId `threadline` is accepted.

Callback POST uses operator-configured RUNNER_CALLBACK_URL (never job input).
Content-Type application/json. Headers: X-Runner-Timestamp (Unix seconds),
X-Runner-Signature (`sha256=` plus lowercase hex HMAC-SHA256 of
`${timestamp}.${rawBody}` using RUNNER_CALLBACK_SECRET, minimum 32 bytes).

```json
{
  "version": 1,
  "eventId": "uuid",
  "runId": "run_123",
  "type": "result",
  "result": {
    "checkId": "catalogue",
    "browser": "chromium",
    "device": "desktop",
    "status": "flaky",
    "attempts": [
      {
        "attempt": 1,
        "status": "failed",
        "durationMs": 100,
        "error": "Assertion failed",
        "evidence": []
      },
      {
        "attempt": 2,
        "status": "passed",
        "durationMs": 100,
        "evidence": [
          {
            "kind": "screenshot",
            "key": "runs/run_123/chromium-desktop/catalogue/2/screenshot.png",
            "contentType": "image/png",
            "size": 123
          }
        ]
      }
    ]
  }
}
```

Result status: passed, failed, flaky. Attempt status: passed, failed. Evidence
kind: screenshot, video, trace; keys are private S3 object keys, not public URLs.
Completion: `{"version":1,"eventId":"uuid","runId":"run_123","type":"completed","status":"passed","resultCount":3}`.
Completion status: passed, failed (any failed), flaky (no failed, some flaky).
Infrastructure errors exit nonzero without a completed event; API should time out
unfinished runs. API must authorize run ownership at dispatch, compare raw-body
HMAC in constant time, enforce +/-300 second timestamp window, and transactionally
deduplicate eventId per run. Callback retries reuse identical body/eventId but sign
with the current timestamp. Accept duplicate deliveries with 2xx. Persist results
and publish SSE only once. API owns replay protection and run-state transitions.

Configuration is server-owned. RUNNER_TARGET_ORIGIN selects one exact origin.
Production execution is currently DISABLED in code until audited isolation is
available. The future policy requires HTTPS port 443, exact RUNNER_ALLOWED_HOST, public DNS answers,
RUNNER_EGRESS_PROXY, and RUNNER_EGRESS_ENFORCED=1. Deployment must deny all direct
browser egress (including UDP/QUIC/WebRTC), force proxy DNS resolution, reject
private/reserved addresses on every connection and redirect, and enforce the same
exact hostname allowlist there. The flag is an operator assertion, not verification
of that infrastructure. Runner is NOT independently SSRF safe. Proxy deployment
and rebinding/subrequest penetration tests remain deployment prerequisites.
Browser routing denies foreign origins, writes, service workers and WebSockets;
requests are bounded, throttled, and robots.txt must explicitly allow the origin
root for User-agent * (conservative subset, fail closed).

Local mode requires RUNNER_MODE=local-isolated and
RUNNER_LOCAL_ISOLATED=1. Only http://127.0.0.1:3201 is accepted. Run in a dedicated
network namespace/container with only the fixed demo target reachable, no host
network, cloud credentials, or production secrets. It cannot be selected by a job.
Local evidence uses RUNNER_EVIDENCE_DIR; production requires S3 configuration.
Callback destination is independently operator-trusted and must use HTTPS in
production; callback redirects are refused. Storage/callback are control-plane
traffic and must not be reachable by the browser sandbox.

Scope: Phase 3 fixed checks only; axe, Lighthouse, drift and visual comparisons
belong to Phase 4. Workflow expects a base64 encoded job, with all other settings
from repository variables/secrets. Lockfile update is required by the parent before
frozen CI installation, since this task may edit only the runner manifest.
