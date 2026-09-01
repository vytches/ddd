# Task: Export CircuitBreakerConfig/CircuitBreakerMetrics from the resilience barrel

## Task Metadata

```yaml
task_id: VF-041
title:
  'resilience: export CircuitBreakerConfig and CircuitBreakerMetrics types from
  the package barrel (and from @vytches/ddd-enterprise)'
type: bug
priority: low
complexity: low
estimated_time: 30m
created_by: consumer-integration audit, 2026-08-23
created_at: 2026-08-23
status: done
completed_at: 2026-08-23
release_target: next minor — additive, non-breaking
package: '@vytches/ddd-resilience, @vytches/ddd-enterprise'
findings: []
```

## Why

A consumer-integration audit found that `CircuitBreaker` (the class) is a
top-level export of `packages/resilience`, but its constructor parameter type
(`CircuitBreakerConfig`) and its `getMetrics()` return type
(`CircuitBreakerMetrics`, both defined in
`packages/resilience/src/patterns/circuit-breaker.ts`) were never re-exported
from `packages/resilience/src/index.ts`. Every other decorator config
(`RetryDecoratorConfig`, `BulkheadDecoratorConfig`,
`CircuitBreakerDecoratorConfig`, …) was exported; these two were not.

Consequence for consumers: anyone constructing a `CircuitBreaker` directly (not
through the decorator) or typing a variable holding `getMetrics()`'s result had
no way to reference the type without either using `ReturnType<...>`/
`ConstructorParameters<...>` gymnastics or hand-rolling a local duplicate
interface. The audit found exactly the latter in the wild, with a code comment
noting the type "is not exported from @vytches/ddd package level."

Note: `packages/resilience/src/observability/metrics-interfaces.ts` also defines
an unrelated interface literally named `CircuitBreakerMetrics`
(`extends ResilienceMetrics`, used by the metric-collector subsystem). It was
never part of the top-level barrel's export list, so re-exporting the
`circuit-breaker.ts` type under the same bare name introduces no collision at
the package's public surface.

## Acceptance Criteria

1. [x] `packages/resilience/src/index.ts` re-exports `CircuitBreakerConfig` and
       `CircuitBreakerMetrics` as types from `./patterns/circuit-breaker`.
2. [x] `packages/enterprise/src/index.ts` re-exports the same two types from
       `@vytches/ddd-resilience`, matching the existing pattern for the other
       resilience decorator config types.
3. [x] No naming collision with `observability/metrics-interfaces.ts`'s distinct
       `CircuitBreakerMetrics` interface (confirmed: that type was never in the
       barrel export list).
4. [x] `type-check` passes for both `@vytches/ddd-resilience` and
       `@vytches/ddd-enterprise`.
5. [x] `@vytches/ddd-resilience` unit tests pass unchanged (110/110).
6. [x] `pnpm run validate:api:local` regenerates the `enterprise` api-report
       baseline with only additive entries (two new `export { ... }` /
       `import { ... }` lines); `pnpm run validate:api` (compare, read-only)
       passes against the regenerated baseline.

## Out of scope

- The `observability/metrics-interfaces.ts` `CircuitBreakerMetrics` type itself
  — it is a different, already-usable type for the metric-collector subsystem
  and was not part of this gap.
- Auditing the rest of `packages/resilience`'s barrel for other missing type
  exports — this task closes the one gap the audit actually found.

## References

- Found during a consumer-integration audit comparing an external NestJS
  application's hand-rolled infrastructure code against
  `@vytches/ddd-resilience`'s public surface (2026-08-23). The same audit
  confirmed the rest of the resilience decorator/strategy/observability API is
  already consumed directly from the library with no other duplication.

## Outcome (2026-08-23)

All six criteria met. `packages/resilience/src/index.ts` and
`packages/enterprise/src/index.ts` now both export `CircuitBreakerConfig` and
`CircuitBreakerMetrics` as types. `type-check` is green on both packages,
resilience's 110 unit tests pass unchanged, and `validate:api:local` /
`validate:api` confirm the `enterprise` api-report baseline changed by exactly
four lines (two `import` lines, two `export` lines) with no removals.
