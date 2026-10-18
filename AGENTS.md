# DriftGate

Read this file at the start of every session. The full user specification is in docs/PROJECT_BRIEF.txt.

## Delivery contract

- Implement one phase at a time. Phase 0 is repository, tooling, CI skeleton, design tokens and token preview. Stop after each phase with evidence and wait for continue.
- MVP is phases 0 through 5. Skip optional AI, notifications and performance budgets for the MVP. Deployment and full demonstration remain a separate phase 7 deliverable, not implicitly complete at phase 5.
- Use GPT-6.1 Sol for bulk implementation and GPT-6 Astra for the design system or hard bugs when model-specific delegation is available. Report actual usage honestly.
- Free tiers only. Ask before any paid service. Never commit secrets or ask for tokens in chat.
- No em dash character in source, UI or documentation.
- Label demonstration data demo. Never report unexecuted tests or fabricated metrics. Record measured commands and results in docs/METRICS.md.
- Preserve unrelated user changes. Use apply_patch for manual edits. Conventional Commits at each phase boundary.

## Architecture and security

- pnpm workspaces and Turborepo, strict TypeScript. Next.js web and Threadline demo store; Express API; Prisma/PostgreSQL; BullMQ/Upstash; Playwright runner; SSE. Do not substitute the specified stack.
- Keep evidence storage behind an S3-compatible interface. Keep secrets server-side. Auth uses argon2 and JWT refresh/access tokens, RBAC and ownership checks.
- External testing is allowlist-only with public-IP validation, DNS checks, redirect revalidation, robots.txt and bounded requests. Private/loopback targets are never accepted by production scanners. Any future local demo runner must use an explicitly isolated fixed-target development design; do not silently relax production SSRF checks.
- Integration tokens encrypted. Runner callbacks timestamped, HMAC-signed and replay protected. SQL checks use a read-only DB role.

## UI

- Ink and Signal custom CSS tokens only. No default Tailwind color utilities or generic component kit.
- Dark default; accessible light theme; Instrument Serif, Hanken Grotesk and JetBrains Mono via next/font.
- Test actual rendered text contrast, keyboard focus, responsive layout and reduced motion. Never present a token preview as implemented product functionality.

## Commands and definition of done

- Node 22. Use the packageManager-pinned pnpm version.
- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm build
- pnpm test:e2e
- pnpm dev
- Update docs and evidence after each phase. Review screenshots at 360, 768, 1280 and 1920 pixels for new screens. Run local quality gates and CI when a remote exists. Explicitly mark unavailable CI or browser checks NOT VERIFIED.
- No silent TODOs: track unfinished scope in docs/STATUS.md. Never claim the entire application is done at a phase boundary.
