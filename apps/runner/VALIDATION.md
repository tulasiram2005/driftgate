# Phase 3 runner validation

Measured 2026-10-19, Node 22.19.0, existing dependencies supplied by parent:

- `node --import tsx --test tests/*.test.ts` from apps/runner: 7 passed, 0 failed.
- `node_modules/.bin/tsc --noEmit -p apps/runner/tsconfig.json`: passed.
- `node_modules/.bin/eslint apps/runner/src apps/runner/tests`: passed.
- `node_modules/.bin/tsc -p apps/runner/tsconfig.json`: passed.

The initial root-level test invocation could not resolve tsx. Running from the
runner package resolved its installed dependency and passed. pnpm commands were
blocked by Corepack cache filesystem permission; direct installed tool invocations
above completed. No dependencies were installed by this worker. No commit made.

Subsequent integrated checks are recorded in ../../docs/PHASE3.md. They include
real-browser fixture execution, actual Threadline Chromium checks, video/trace
generation and API callback persistence/SSE. Remote S3 uploads and GitHub Actions
runner execution remain NOT VERIFIED.
Unit tests cover actual signing/retry behavior with an injected transport and
filesystem evidence bytes, plus schema rejection and network policy boundaries.

Outstanding: production is deliberately disabled, awaiting validated deployment
egress isolation/proxy and rebinding/subrequest testing. Local isolation must be
provided by the operator; flags do not establish isolation. Parent owns lockfile
updates and project-wide status/metrics records, outside this worker's file scope.
