# Data model

Status: planned relationships. Prisma schema, indexes and migrations are due in Phase 2. This diagram is not evidence of a deployed database.

```mermaid
erDiagram
  users ||--o{ project_memberships : joins
  projects ||--o{ project_memberships : grants
  projects ||--o{ environments : contains
  projects ||--o{ requirements : defines
  requirements }o--o{ test_cases : covers
  test_cases ||--o{ test_case_versions : versions
  test_case_versions ||--o{ test_steps : orders
  suites }o--o{ test_case_versions : includes
  environments ||--o{ runs : executes
  runs ||--o{ results : records
  test_case_versions ||--o{ results : tested_as
  results ||--o{ evidence : attaches
  results ||--o{ defects : raises
  defects ||--o{ defect_events : transitions
  projects ||--o{ releases : schedules
  releases ||--o{ gates : requires
  gates ||--o{ signoffs : decides
  users ||--o{ signoffs : approves
  environments ||--o{ drift_snapshots : captures
  drift_snapshots ||--o{ drift_findings : compares
  environments ||--o{ visual_baselines : maintains
  projects ||--o{ audit_log : audits
  projects ||--o{ integrations : connects
```

The implementation must resolve many-to-many edges with explicit join tables and index foreign keys and query cursors. Store currency as decimal or integer minor units, timestamps as UTC instants, and environment timezones as validated IANA names. Hash-chaining is tamper-evident, not a claim of tamper-proof storage.
