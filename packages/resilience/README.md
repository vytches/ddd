# @vytches/ddd-resilience

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-resilience.svg)](https://badge.fury.io/js/%40vytches%2Fddd-resilience)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Circuit breaker, retry, bulkhead, and timeout patterns for fault-tolerant domain services**

## Installation

```bash
pnpm add @vytches/ddd-resilience
```

## What's included

### Resilience patterns

| Export | Kind | Description |
|--------|------|-------------|
| `CircuitBreaker` | class | Tracks failures and opens the circuit after a threshold |
| `CircuitBreakerState` | enum | `CLOSED \| OPEN \| HALF_OPEN` |
| `CircuitBreakerOpenError` | class | Thrown when an operation is attempted while the circuit is open |
| `RetryPolicy` | class | Executes an operation with configurable retry and backoff |
| `MaxRetriesExceededError` | class | Thrown when all retry attempts are exhausted |
| `Bulkhead` | class | Limits concurrent execution slots |
| `BulkheadRejectedException` | class | Thrown when all slots are occupied |

### Composite strategies

| Export | Kind | Description |
|--------|------|-------------|
| `ResiliencePolicyBuilder` | class | Fluent builder for combining strategies |
| `CompositeResilienceStrategy` | class | Runs multiple strategies in sequence |
| `CircuitBreakerStrategy` | class | Strategy wrapper around `CircuitBreaker` |
| `RetryStrategy` | class | Strategy wrapper around `RetryPolicy` |
| `BulkheadStrategy` | class | Strategy wrapper around `Bulkhead` |
| `TimeoutStrategy` | class | Strategy that cancels operations exceeding a deadline |
| `ResilienceStrategy` | interface | Base strategy contract |

### Core context

| Export | Kind | Description |
|--------|------|-------------|
| `DefaultResilienceContext` | class | Holds cancellation token and execution metadata |
| `TimeoutError` | class | Thrown when an operation exceeds its timeout |
| `OperationCancelledError` | class | Thrown when an operation is cancelled |

### Decorators

| Export | Kind | Description |
|--------|------|-------------|
| `ResilienceDecorator` | decorator (alias `Resilience`) | Apply composite resilience to a method |
| `CircuitBreakerDecorator` | decorator (alias `CircuitBreaker`) | Apply circuit breaker to a method |
| `RetryDecorator` | decorator (alias `Retry`) | Apply retry policy to a method |
| `BulkheadDecorator` | decorator (alias `Bulkhead`) | Apply bulkhead limiting to a method |
| `TimeoutDecorator` | decorator (alias `Timeout`) | Apply timeout to a method |
| `getResilienceMetrics(instance)` | function | Returns metrics from all resilience decorators on an instance |

### Decorator configuration interfaces

| Export | Kind | Description |
|--------|------|-------------|
| `ResilienceDecoratorConfig` | interface | Full composite config |
| `CircuitBreakerDecoratorConfig` | interface | Circuit breaker decorator options |
| `RetryDecoratorConfig` | interface | Retry decorator options |
| `BulkheadDecoratorConfig` | interface | Bulkhead decorator options |
| `TimeoutDecoratorConfig` | interface | Timeout decorator options |
| `CompositeResilienceConfig` | interface | Options for combining multiple strategies |

### Observability

| Export | Kind | Description |
|--------|------|-------------|
| `GlobalMetricRegistry` | object | Singleton metric registry |
| `DefaultMetricRegistry` | class | Default implementation |
| `GlobalObservabilityEventBus` | object | Singleton event bus for observability |
| `DefaultObservabilityEventBus` | class | Default implementation |
| `MetricRegistry` | interface | Registry contract |
| `MetricCollector` | interface | Collector contract |
| `MetricExporter` | interface | Exporter contract |
| `Metric` | interface | Individual metric shape |
| `MetricType` | type | `'counter' \| 'gauge' \| 'histogram' \| 'timer'` |
| `CircuitBreakerMetricCollector` | class | Collects circuit breaker metrics |
| `RetryMetricCollector` | class | Collects retry metrics |
| `BulkheadMetricCollector` | class | Collects bulkhead metrics |
| `TimeoutMetricCollector` | class | Collects timeout metrics |
| `PrometheusMetricExporter` | class | Exports metrics in Prometheus format |
| `JsonMetricExporter` | class | Exports metrics as JSON |
| `CsvMetricExporter` | class | Exports metrics as CSV |
| `TextMetricExporter` | class | Exports metrics as plain text |
| `CompositeMetricExporter` | class | Combines multiple exporters |
| `MetricExporterFactory` | class | Creates exporters by type |
| `ObservabilityEventFactory` | class | Creates observability events |

## Quick start

### Circuit breaker

```typescript
import { CircuitBreaker, CircuitBreakerOpenError } from '@vytches/ddd-resilience';

const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30_000 });

try {
  const result = await breaker.execute(() => externalService.fetchData());
} catch (err) {
  if (err instanceof CircuitBreakerOpenError) {
    // circuit is open — use fallback
  }
}
```

### Retry policy

```typescript
import { RetryPolicy } from '@vytches/ddd-resilience';

const retry = new RetryPolicy({ maxAttempts: 3, delay: 1_000, backoff: 'exponential' });
const result = await retry.execute(() => fetchFromApi());
```

### Decorators

```typescript
import { ResilienceDecorator, CircuitBreakerDecorator, RetryDecorator } from '@vytches/ddd-resilience';

class PaymentService {
  @ResilienceDecorator({
    circuitBreaker: { failureThreshold: 5, resetTimeout: 30_000 },
    retry: { maxAttempts: 3, delay: 500 },
    timeout: { ms: 10_000 },
  })
  async charge(amount: number): Promise<void> {
    await gateway.charge(amount);
  }
}
```

### Composite strategy via builder

```typescript
import { ResiliencePolicyBuilder } from '@vytches/ddd-resilience';

const policy = new ResiliencePolicyBuilder()
  .withCircuitBreaker({ failureThreshold: 3 })
  .withRetry({ maxAttempts: 2 })
  .withTimeout({ ms: 5_000 })
  .build();

await policy.execute(() => riskyOperation());
```

## Package boundaries

`@vytches/ddd-resilience` depends on:
- `@vytches/ddd-logging` — internal logging

## License

MIT
