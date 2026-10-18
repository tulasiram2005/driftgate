# Ink and Signal

Phase 0 delivers a reference screen, not a working release dashboard. Every readiness, gate, matrix and evidence example is labeled demo. Real product data arrives in subsequent phases.

## Tokens

Dark ink surfaces use neutral near-black tones, warm-white text and a lime action accent. Green, red, amber, blue and violet distinguish statuses alongside icons and labels. The light theme uses paper surfaces and darker status colors for legibility. All styles reference CSS tokens in `apps/web/src/app/tokens.css`.

Instrument Serif handles display samples, Hanken Grotesk the interface, and JetBrains Mono data. Fonts are bundled through next/font at build time. Spacing follows a four-pixel rhythm. Controls use six-pixel corners; dialogs use twelve. Sections remain unframed and separated with rules.

## Interaction

Theme preference is persisted locally, with a dark fallback when storage is unavailable. The command dialog filters sections. Native dialogs provide modal focus handling and Escape dismissal. The synthetic evidence comparison uses a labeled native range input. Icon controls have accessible names and hover titles. Reduced motion removes staggered animation and smooth scrolling.

## Verification scope

Browser tests cover 360, 768, 1280 and 1920 pixel widths in both themes, document overflow, theme persistence, keyboard focus, dialogs, search, the comparison slider and automated WCAG checks. See METRICS.md for actual results. Automated checks do not replace a full human accessibility audit. Cloud deployment, captured traces, real scores and defect workflows are outside Phase 0.
