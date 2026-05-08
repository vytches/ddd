# Task: Policies V2 Advanced Examples

## Task Metadata

```yaml
task_id: VD-002
title: Comprehensive examples for Policies V2 (specifications, PolicyGroup, behaviors)
type: documentation
priority: high
complexity: medium
estimated_time: 10h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
priority_score: 85/100
```

## Domain Context

```yaml
bounded_context: PolicyEngine
patterns:
  - Specification
  - PolicyGroup (AND/OR composition)
  - Conditional policies
  - Event-driven policies
  - Retry / caching / temporal behaviors
```

## Why This Task Exists

`packages/policies` ships powerful primitives but lacks documented patterns:

- Basic specification usage not shown
- PolicyGroup for complex business rules undocumented
- Conditional policy patterns missing
- Event-driven policy examples absent
- Behaviors (retry, caching, temporal) not demonstrated
- Framework integration patterns unclear

**Business Impact**: 40% reduction in onboarding complexity for policy
implementation (from work-item analysis 2026-03-31).

## Acceptance Criteria

### Functional examples

- [ ] `examples/policies/01-basic-specification.ts` — single rule via
      `Specification.create`
- [ ] `examples/policies/02-policy-group-and-or.ts` — composing AND/OR rules
- [ ] `examples/policies/03-conditional-policy.ts` — rules that depend on context
- [ ] `examples/policies/04-event-driven-policy.ts` — policy that listens to
      domain events
- [ ] `examples/policies/05-retry-behavior.ts` — retry decorator + transient
      failure handling
- [ ] `examples/policies/06-cached-policy.ts` — TTL-based caching
- [ ] `examples/policies/07-temporal-policy.ts` — time-window-aware rules
- [ ] `examples/policies/08-real-world-shipping.ts` — end-to-end shipping
      eligibility (combines all primitives)

### Integration

- [ ] Each example: standalone, runnable, with passing test
- [ ] Each example: included in `pnpm test:examples`
- [ ] LLMGUIDE.md in `packages/policies/` references the examples
- [ ] README links to examples directory

## Coupled with

- REL-005 if API surface changes for `OrPolicyComposer` (violations aggregation)
- REL-009 fix #5 may change OR-policy contract — sync examples
