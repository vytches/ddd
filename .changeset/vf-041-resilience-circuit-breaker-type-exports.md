---
'@vytches/ddd-resilience': patch
'@vytches/ddd': patch
---

fix(resilience): export CircuitBreakerConfig and CircuitBreakerMetrics types
(VF-041)

**`@vytches/ddd-resilience`:**

- `CircuitBreakerConfig` and `CircuitBreakerMetrics` (both used by the
  already-public `CircuitBreaker` class — as its constructor parameter and its
  `getMetrics()` return type, respectively) are now exported as types from the
  package's top-level barrel. Previously a consumer constructing a
  `CircuitBreaker` directly, or typing a variable holding `getMetrics()`'s
  result, had no way to reference these types without duplicating the interfaces
  locally.

**`@vytches/ddd`:**

- Re-exports the same two types from `@vytches/ddd-resilience`, matching the
  existing pattern for the other resilience decorator config types
  (`RetryDecoratorConfig`, `BulkheadDecoratorConfig`,
  `CircuitBreakerDecoratorConfig`).

**Usage:**

```ts
import type { CircuitBreakerConfig, CircuitBreakerMetrics } from '@vytches/ddd';
import { CircuitBreaker } from '@vytches/ddd';

const config: CircuitBreakerConfig = {
  name: 'payment-gateway',
  failureThreshold: 5,
  resetTimeout: 30_000,
};

const breaker = new CircuitBreaker(config);
const metrics: CircuitBreakerMetrics = breaker.getMetrics();
```
