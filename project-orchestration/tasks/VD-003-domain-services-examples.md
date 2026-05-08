# Task: Domain Services Real-World Examples

## Task Metadata

```yaml
task_id: VD-003
title: Order/payment/inventory examples for @vytches/ddd-domain-services
type: documentation
priority: high
complexity: medium
estimated_time: 8h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
priority_score: 84/100
```

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

- REL-009 — if `EnhancedCommandBus` retry default changes, examples need
  updated patterns for explicit opt-in
- DDD compliance recommendation: add bare `abstract class DomainService` (no DI
  decorator dependency) — consider as part of this task

## Notes

DDD compliance audit (2026-05-08) recommended adding bare `DomainService`
abstract class for users not using DI. Decide if scope of this task or separate.
