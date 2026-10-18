# ADR 0002: Explicit lint plugins

Status: accepted for Phase 0, 2026-10-18.

The initial dependency audit found GHSA-vfj7-8cjw-p6xm in braces, reached through eslint-config-next, the Next lint plugin and fast-glob. The advisory has no published patched version.

Use explicit ESLint TypeScript, React, React Hooks and JSX accessibility recommended rules, plus formatting integration. Do not suppress the security audit or fabricate a patched version. This omits Next-specific lint rules; the Next production build and browser suite remain separate checks. Revisit the preset once its dependency chain is patched.

ESLint 9.39.5 and TypeScript 5.9.3 are pinned for plugin compatibility. ESLint 9 is deprecated upstream, so track migration to ESLint 10 when the React/accessibility plugins support it. Vitest and its coverage provider use matching 5.0.5 versions.

Source: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
