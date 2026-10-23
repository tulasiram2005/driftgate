# Reusable expected-difference rules

Project members can read `GET /api/v1/projects/:projectId/expected-rules`.
Admins and QA can replace an environment pair's rules using `PUT` on that path:
`{ revision, environments: ["staging", "prod"], rules: [{ field: "price", productId: "demo-shirt", reason: "Approved demo pricing" }] }`.

The server accepts only distinct supported environments, at most 100 unique field/product rules per pair, and a nonempty reason. Pairs match in either direction. Stale revisions return 409; reload before saving again. An empty rules array removes that pair's expectations. Other pairs remain intact.

Comparisons automatically apply saved rules for their pair. Per-comparison rules override a matching saved field/product rule. Findings remain visible, marked expected rather than removed. Every comparison stores the applied rules and project rules revision; later edits do not rewrite history.

The comparison editor provides load and save controls for the selected pair. Saving replaces that pair's complete set. Local API tests cover reuse, reversed pairs, isolation between pairs, permissions, invalid input, stale writes and historical preservation.

Cloud migration and browser verification of these new controls remain NOT VERIFIED.
