---
'@vytches/ddd-resilience': minor
'@vytches/ddd-cqrs': minor
'@vytches/ddd-policies': patch
'@vytches/ddd': minor
---

fix(resilience): correctness fixes for circuit-breaker HALF_OPEN probing and
decorator scope (VF-028)

**`@vytches/ddd-resilience`:**

- `CircuitBreakerConfig.halfOpenMaxProbes` (optional, default `1`) — caps the
  number of concurrent HALF_OPEN recovery probes. Extra callers over the limit
  are rejected with the new `CircuitBreakerHalfOpenLimitError` (extends
  `CircuitBreakerOpenError`) instead of all reaching the downstream at once.
- `CircuitBreakerHalfOpenLimitError` — thrown when a HALF_OPEN breaker is
  already at its probe limit.
- `BaseResilienceDecoratorConfig.scope` (optional, `'instance' | 'shared'`,
  default `'instance'`) — `@CircuitBreakerDecorator`/`@BulkheadDecorator`/
  `@RetryDecorator`/`@ResilienceDecorator` now build a separate resilience
  policy per decorated instance by default instead of sharing one policy (and
  its accumulated circuit-breaker/bulkhead state) across every instance of the
  class. Opt into the previous behavior with `scope: 'shared'`.

**`@vytches/ddd-cqrs`:**

- `BusRetryOptions` — named retry config shape shared by `EnhancedCommandBus`
  and `EnhancedQueryBus`'s `resilience.retry` option (`enabled`, `maxAttempts`,
  `baseDelay`, `maxDelay`, `backoffMultiplier`, `jitter`).
  `EnhancedQueryBus.resilience.retry` now accepts the same object shape as
  `EnhancedCommandBus` (previously boolean-only); `retry: true` remains a legacy
  alias for `{ enabled: true }` on both buses.
- `EnhancedCommandBus`/`EnhancedQueryBus` no longer hardcode `jitter: false`
  when building their internal retry strategy — retry delay jitter now defaults
  to `true` (matching `RetryPolicy.defaultConfig()`) and is configurable via
  `resilience.retry.jitter`.
- `EnhancedCommandBusOptions.resilience.circuitBreaker.halfOpenMaxAttempts`
  removed. It was accepted but never read by `setupResilience` — setting it had
  no effect. Removed without a `@deprecated` alias: this is a dead-field
  cleanup, not a behavior change, so no migration is needed.

**`@vytches/ddd-policies`:**

- `BusinessRuleValidatorAdapter.isSatisfiedBy()` no longer swallows a thrown
  validator error with zero diagnostics — it now logs via `internalLogger.warn`
  (specification name + sanitized error message) before returning `false`. No
  change to the returned contract.

**`@vytches/ddd`:**

- Re-exports the new `CircuitBreakerHalfOpenLimitError` (from
  `@vytches/ddd-resilience`) and `BusRetryOptions` type (from
  `@vytches/ddd-cqrs`) added above.

**Usage:**

```ts
import {
  CircuitBreakerDecorator,
  CircuitBreakerHalfOpenLimitError,
} from '@vytches/ddd';

class PaymentGateway {
  @CircuitBreakerDecorator({ halfOpenMaxProbes: 1 })
  async charge(amount: number) {
    /* ... */
  }
}

try {
  await gateway.charge(100);
} catch (err) {
  if (err instanceof CircuitBreakerHalfOpenLimitError) {
    // another probe is already in flight; back off
  }
}
```
