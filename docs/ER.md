# Data model

## Implemented Threadline schema

The separate Threadline database has migration `202610190001_threadline` under `apps/demo-store/prisma/migrations`. Products and sizes are scoped by environment. Orders store an immutable JSON line-item snapshot, integer totals, request hash and a unique environment/idempotency-key pair. Seeding creates missing records without resetting stock or deleting orders.

```mermaid
erDiagram
  Product ||--o{ ProductSize : sizes
  Product {
    string environment PK
    string id PK
    string slug "unique with environment"
    int priceCents
  }
  ProductSize {
    string environment PK,FK
    string productId PK,FK
    string label PK
    int stock
  }
  SandboxOrder {
    string id PK
    string environment
    string idempotencyKey "unique with environment"
    string requestHash
    json items
    int totalCents
    datetime createdAt
  }
```

## Implemented DriftGate Phase 2 schema

Migration `apps/api/prisma/migrations/202610190002_phase2` creates the separate QA database. Users have project-scoped Member roles and hashed refresh Sessions. Projects own Requirements, TestCases, Suites and Runs. TestCase changes append immutable CaseVersion snapshots. Results snapshot test title, steps and version so later edits/archives preserve run evidence. Steps are ordered JSON and suite case IDs are a validated array in this first implementation; database-level join/step normalization is tracked before the runner phase.

```mermaid
erDiagram
  User ||--o{ Session : authenticates
  User ||--o{ Member : joins
  Project ||--o{ Member : authorizes
  Project ||--o{ Requirement : defines
  Project ||--o{ TestCase : owns
  Requirement |o--o{ TestCase : covered_by
  TestCase ||--o{ CaseVersion : versions
  Project ||--o{ Suite : groups
  Project ||--o{ Run : records
  Suite ||--o{ Run : executes
  Run ||--o{ Result : snapshots
```

## Future relationships

The expanded model below includes later-phase evidence, defects, integrations and release approval. It is a target model, not evidence of deployed services.

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
