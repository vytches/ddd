# @vytches/ddd-resilience - LLM Guide

## Purpose

Production-grade resilience patterns for command handlers, integration calls,
and any I/O boundary: circuit breaker, retry with backoff, bulkhead (concurrency
limiting), timeout, and a composite strategy that chains them.

Includes a full **observability layer** — metric registry, Prometheus / JSON /
CSV exporters, and per-pattern collectors — plus method **decorators** for
zero-boilerplate adoption.

Designed to be opt-in — no default-on retries that could double-execute domain
commands.

## Quick Start

```typescript
import {
  CircuitBreaker,
  RetryPolicy,
  Bulkhead,
  ResiliencePolicyBuilder,
} from '@vytches/ddd-resilience';

// 1. Standalone circuit breaker
const breaker = new CircuitBreaker({
  name: 'payment-gateway',
  failureThreshold: 5,
  recoveryTimeout: 30_000,
});
await breaker.execute(() => paymentApi.charge(order));

// 2. Composed policy: timeout → retry → circuit breaker → bulkhead
const policy = new ResiliencePolicyBuilder()
  .withTimeout(5_000)
  .withRetry({ maxAttempts: 3, baseDelayMs: 100 })
  .withCircuitBreaker({ failureThreshold: 5 })
  .withBulkhead({ maxConcurrent: 10, maxQueue: 50 })
  .build();

const result = await policy.execute(() => externalService.call(payload));
```

## Key API

### Patterns

| Export                        | Kind      | Description                                                     |
| ----------------------------- | --------- | --------------------------------------------------------------- |
| `CircuitBreaker`              | class     | Three-state breaker (Closed / Open / Half-Open) with thresholds |
| `CircuitBreakerOpenError`     | error     | Thrown when execution attempted while breaker is Open           |
| `CircuitBreakerState`         | enum      | `Closed`, `Open`, `HalfOpen`                                    |
| `RetryPolicy`                 | class     | Exponential backoff retry with optional jitter                  |
| `MaxRetriesExceededError`     | error     | Thrown when retry budget is exhausted                           |
| `Bulkhead`                    | class     | Concurrency limiter with optional queue                         |
| `BulkheadRejectedException`   | error     | Thrown when both active and queue are saturated                 |
| `TimeoutError`                | error     | Thrown by `TimeoutStrategy` when deadline exceeded              |
| `OperationCancelledError`     | error     | Thrown when operation is cancelled mid-flight via context       |
| `ResiliencePolicyBuilder`     | class     | Fluent builder for composing strategies                         |
| `ResilienceStrategy`          | interface | `execute<T>(fn): Promise<T>`                                    |
| `CompositeResilienceStrategy` | class     | Chains multiple strategies into one                             |
| `RetryStrategy`               | class     | Strategy wrapper around RetryPolicy                             |
| `CircuitBreakerStrategy`      | class     | Strategy wrapper around CircuitBreaker                          |
| `BulkheadStrategy`            | class     | Strategy wrapper around Bulkhead                                |
| `TimeoutStrategy`             | class     | Reject promise after N ms                                       |
| `DefaultResilienceContext`    | class     | Carries cancel signal + correlation ID through strategies       |

### Decorators (method-level)

| Export                           | Kind      | Description                                            |
| -------------------------------- | --------- | ------------------------------------------------------ |
| `RetryDecorator(opts?)`          | decorator | `@RetryDecorator({ maxAttempts: 3 })` on a method      |
| `CircuitBreakerDecorator(opts?)` | decorator | `@CircuitBreakerDecorator({ name, failureThreshold })` |
| `BulkheadDecorator(opts?)`       | decorator | `@BulkheadDecorator({ maxConcurrent: 10 })`            |
| `TimeoutDecorator(opts?)`        | decorator | `@TimeoutDecorator({ ms: 2000 })`                      |
| `ResilienceDecorator(opts?)`     | decorator | Composite — apply all four with one decorator          |
| `getResilienceMetrics(target)`   | function  | Read accumulated metrics from a decorated class        |
| `RetryDecoratorConfig`           | type      | Decorator options                                      |
| `CircuitBreakerDecoratorConfig`  | type      | Decorator options                                      |
| `BulkheadDecoratorConfig`        | type      | Decorator options                                      |
| `TimeoutDecoratorConfig`         | type      | Decorator options                                      |
| `CompositeResilienceConfig`      | type      | Composite decorator options                            |
| `ResilienceDecoratorConfig`      | type      | Generic config base                                    |

### Observability & metrics

| Export                               | Kind      | Description                                        |
| ------------------------------------ | --------- | -------------------------------------------------- |
| `GlobalMetricRegistry`               | singleton | App-wide metric registry (`getInstance()`)         |
| `DefaultMetricRegistry`              | class     | Plain (non-global) registry                        |
| `MetricRegistry`                     | interface | Registry public contract                           |
| `MetricCollector`                    | interface | Collects metrics for one pattern                   |
| `CircuitBreakerMetricCollector`      | class     | Open/closed counts, failure rate, recovery latency |
| `RetryMetricCollector`               | class     | Attempts, retries, success-after-retry counts      |
| `BulkheadMetricCollector`            | class     | Active count, queue depth, rejections              |
| `TimeoutMetricCollector`             | class     | Timeout count, p50/p99 latency                     |
| `MetricExporter`                     | interface | Render registry to a wire format                   |
| `PrometheusMetricExporter`           | class     | Render to Prometheus text format                   |
| `JsonMetricExporter`                 | class     | Render to JSON                                     |
| `CsvMetricExporter`                  | class     | Render to CSV                                      |
| `TextMetricExporter`                 | class     | Render to plain text                               |
| `CompositeMetricExporter`            | class     | Run multiple exporters at once                     |
| `MetricExporterFactory`              | class     | Build exporter by name                             |
| `Metric`, `MetricType`               | types     | Metric model (counter / gauge / histogram / timer) |
| `MetricLabels`, `MetricValue`        | types     | Label set + value variants                         |
| `HistogramMetric`, `HistogramBucket` | types     | Histogram with bucket boundaries                   |
| `TimerMetric`                        | type      | Duration metric                                    |
| `ObservabilityEventBus`              | interface | Pub/sub for resilience events                      |
| `DefaultObservabilityEventBus`       | class     | Reference implementation                           |
| `GlobalObservabilityEventBus`        | singleton | App-wide event bus                                 |
| `ObservabilityEvent`                 | type      | Event shape (state change, threshold breach, ...)  |
| `ObservabilityEventListener`         | type      | `(event) => void` callback                         |
| `ObservabilityEventFactory`          | class     | Build canonical events                             |

## Patterns

### Decorate a method with the full stack

```typescript
import {
  ResilienceDecorator,
  getResilienceMetrics,
} from '@vytches/ddd-resilience';

class PaymentService {
  @ResilienceDecorator({
    timeout: { ms: 2000 },
    retry: { maxAttempts: 3, baseDelayMs: 100 },
    circuitBreaker: { name: 'payments', failureThreshold: 5 },
  })
  async charge(orderId: string, amount: number): Promise<void> {
    return paymentApi.charge(orderId, amount);
  }
}

// Inspect runtime metrics
const metrics = getResilienceMetrics(PaymentService);
console.log(metrics.charge.retries, metrics.charge.circuitBreaker.state);
```

### Emit Prometheus metrics from circuit breaker

```typescript
import {
  GlobalMetricRegistry,
  CircuitBreakerMetricCollector,
  PrometheusMetricExporter,
  CircuitBreaker,
} from '@vytches/ddd-resilience';

const breaker = new CircuitBreaker({ name: 'payments', failureThreshold: 5 });

const registry = GlobalMetricRegistry.getInstance();
registry.register(new CircuitBreakerMetricCollector(breaker));

// In your /metrics HTTP handler
const exporter = new PrometheusMetricExporter();
const text = exporter.export(registry.collect());
res.setHeader('Content-Type', 'text/plain; version=0.0.4').send(text);
```

### Idempotent retries only

Retries are safe **only when the operation is idempotent**. Domain commands
(e.g. `placeOrder`) are usually not. Wrap publish/projection/integration calls —
never raw command handlers.

```typescript
// SAFE: idempotent — sending an event with a deduplication ID
await retry.execute(() => bus.publish(event));

// UNSAFE: command handler — could create 2 orders
// await retry.execute(() => orderService.placeOrder(payload));
```

## Anti-Patterns

- **Do not retry domain command handlers** — most are not idempotent.
  At-most-once semantics is the safe default.
- **Do not set `failureThreshold` based on time only** — combine with a minimum
  sample size to avoid breaker flapping at low traffic.
- **Do not stack retries on retries** — if you retry inside the handler AND
  outside, you multiply load on the failing dependency.
- **Do not use timeout as the only resilience strategy** — without circuit
  breaker, a downstream outage will saturate your bulkhead within seconds.
- **Do not skip `MetricCollector` registration** when using decorators in
  production — without a registered collector, `getResilienceMetrics()` is empty
  and you lose visibility into failure modes.
