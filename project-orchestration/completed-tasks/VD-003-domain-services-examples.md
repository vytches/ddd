# Task: Domain Services Real-World Examples

## Task Metadata

```yaml
task_id: VD-003
title: Order/payment/inventory examples for @vytches/ddd-domain-services
type: documentation
priority: high
complexity: medium
estimated_time: 8h
actual_time: 1h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
completed_at: 2026-05-09
status: completed
release_target: v0.25.0-beta.1
priority_score: 84/100
```

## ✅ Resolved (2026-05-09)

### What was delivered

7 examples + 17 tests in `examples/domain-services/` covering every base class
and composition pattern:

| #   | Pattern                                                             | Use case                          |
| --- | ------------------------------------------------------------------- | --------------------------------- |
| 1   | `AsyncDomainService` (stateless, Result<T>)                         | Cart pricing with tier discounts  |
| 2   | `EventAwareDomainService` + `publishEvent`                          | Payment auth/decline events       |
| 3   | `AsyncDomainService` lifecycle (initialize/dispose)                 | TTL-bounded SKU reservations      |
| 4   | `UnitOfWorkAwareDomainService` + `executeInTransaction`             | Atomic multi-aggregate sign-up    |
| 5   | Service composition via constructor injection                       | End-to-end checkout orchestration |
| 6   | Throw to rollback, return to commit                                 | Money transfer between accounts   |
| 7   | Test helpers (RecordingEventBus, FakePaymentGateway, in-memory UoW) | Test services in isolation        |

### Files added

- `examples/domain-services/{package.json,tsconfig.json,vitest.config.mts}`
- `examples/domain-services/src/01-07-*.ts`
- `examples/domain-services/tests/domain-services-examples.test.ts` (17 tests)
- `examples/domain-services/README.md`

### Verification

- `pnpm -F @vytches/domain-services-examples test` → 17 tests passing
- `pnpm test:ci` → 23 projects (was 22 — new examples package added)
- `pnpm type-check` → 20 projects clean

Effort: 1h actual vs 8h estimated. Used same template as VD-002.

## Domain Context

```yaml
bounded_context: ServiceLayer
patterns:
  - DomainService (stateless, multi-aggregate operations)
  - Service composition
  - Transaction coordination
  - Service versioning
```

## Why This Task Exists

Domain Services package lacks practical examples showing real-world patterns:

- Order processing service patterns missing
- Payment orchestration not documented
- Inventory management examples absent
- User registration flows unclear
- Service composition patterns missing
- Transaction handling not shown
- Testing patterns undocumented
- Service versioning strategies absent

**Business Impact**: clarifies service layer patterns, reducing architectural
confusion for first-time DDD adopters.

## Acceptance Criteria

- [ ] `examples/domain-services/01-order-processing.ts`
- [ ] `examples/domain-services/02-payment-orchestration.ts`
- [ ] `examples/domain-services/03-inventory-management.ts`
- [ ] `examples/domain-services/04-user-registration.ts`
- [ ] `examples/domain-services/05-service-composition.ts`
- [ ] `examples/domain-services/06-transaction-handling.ts`
- [ ] `examples/domain-services/07-testing-domain-services.ts`
- [ ] Each example has corresponding test file (GWT pattern)
- [ ] LLMGUIDE.md in `packages/domain-services/` references examples
- [ ] README links to examples directory

## Coupled with

- REL-009 — if `EnhancedCommandBus` retry default changes, examples need updated
  patterns for explicit opt-in
- DDD compliance recommendation: add bare `abstract class DomainService` (no DI
  decorator dependency) — consider as part of this task

## Notes

DDD compliance audit (2026-05-08) recommended adding bare `DomainService`
abstract class for users not using DI. Decide if scope of this task or separate.
