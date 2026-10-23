# Bounded broken-link check

Select `broken-links` in an automated Threadline run. Existing run results,
attempt history, screenshots, video and traces retain its outcome; no new
database migration is required for this check.

The runner collects catalogue anchors, deduplicates destinations without their
fragments, and probes only HTTP(S) URLs in the exact origin and selected
environment path. External links, other environments, mail links and fragments
are excluded. Credential-bearing or malformed URLs fail validation.

Limits: 100 anchors, 20 unique destinations, sequential navigation, 3 seconds
per destination, and the existing context request budget/rate policy. Destination
assets are blocked. Requests fall through to the context security policy;
redirects are denied, including redirects to private addresses. No arbitrary
URL or script input is introduced. Production execution remains disabled until
the existing audited egress requirement is satisfied.

Non-2xx responses, navigation failures, timeouts and denied redirects produce a
failed check with counts. These mean broken or unavailable, not necessarily a
permanent 404. The trace contains the navigation evidence. An empty in-scope
link set or an exceeded limit fails rather than silently claiming success.

Scope is catalogue links, not a recursive whole-site crawl. Soft-404 HTML pages
returning HTTP 200 are not detected. This check does not add link differences to
the environment snapshot comparison table.

Unit scope/limit tests pass locally. Browser fixtures cover clean destinations,
a seeded 404 and a denied off-origin redirect. Local browser execution is blocked
by macOS MachPort permission; these new fixtures remain NOT VERIFIED until CI.
