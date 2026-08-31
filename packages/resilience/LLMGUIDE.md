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
  .withRetry({ maxAttempts: 3, baseDelay: 100 })
  .withCircuitBreaker({ failureThreshold: 5 })
  .withBulkhead({ maxConcurrency: 10, queueCapacity: 50 })
  .build();

const result = await policy.execute(() => externalService.call(payload));
```

## Key API

### Patterns

| Export                             | Kind      | Description                                                                                                                               |
| ---------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CircuitBreaker`                   | class     | Three-state breaker (Closed / Open / Half-Open) with thresholds                                                                           |
| `CircuitBreakerOpenError`          | error     | Thrown when execution attempted while breaker is Open                                                                                     |
| `CircuitBreakerHalfOpenLimitError` | error     | Thrown when HALF_OPEN already has `halfOpenMaxProbes` probes in flight (extends `CircuitBreakerOpenError`)                                |
| `CircuitBreakerState`              | enum      | `Closed`, `Open`, `HalfOpen`                                                                                                              |
| `RetryPolicy`                      | class     | Exponential backoff retry with optional jitter                                                                                            |
| `MaxRetriesExceededError`          | error     | Thrown when retry budget is exhausted                                                                                                     |
| `Bulkhead`                         | class     | Concurrency limiter with optional queue                                                                                                   |
| `BulkheadRejectedException`        | error     | Thrown when both active and queue are saturated                                                                                           |
| `TimeoutError`                     | error     | Thrown by `TimeoutStrategy` when deadline exceeded                                                                                        |
| `OperationCancelledError`          | error     | Thrown when operation is cancelled mid-flight via context                                                                                 |
| `ResiliencePolicyBuilder`          | class     | Fluent builder for composing strategies                                                                                                   |
| `ResilienceStrategy`               | interface | `execute<T>(fn): Promise<T>`                                                                                                              |
| `CompositeResilienceStrategy`      | class     | Chains multiple strategies into one                                                                                                       |
| `RetryStrategy`                    | class     | Strategy wrapper around RetryPolicy                                                                                                       |
| `CircuitBreakerStrategy`           | class     | Strategy wrapper around CircuitBreaker                                                                                                    |
| `BulkheadStrategy`                 | class     | Strategy wrapper around Bulkhead                                                                                                          |
| `TimeoutStrategy`                  | class     | Reject promise after N ms                                                                                                                 |
| `DefaultResilienceContext`         | class     | Carries cancel signal + correlation ID through strategies                                                                                 |
| `CompensationStack`                | class     | In-process LIFO stack pairing a resource acquisition (outside a DB transaction) with its undo — see "Compensating for side effects" below |
| `runCompensated(stack, fn)`        | function  | Runs `fn` against a `CompensationStack`; unwinds it on failure, leaves it armed on success                                                |
| `CompensationFailure`              | type      | `{ label, error }` — one compensation that itself failed while unwinding                                                                  |
| `CompensationOutcome<TError>`      | type      | `{ cause, compensationFailures }` — unconditional failure shape returned by `runCompensated`                                              |

### Decorators (method-level)

| Export                                      | Kind      | Description                                                                      |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| `RetryDecorator(opts?)`                     | decorator | `@RetryDecorator({ maxAttempts: 3 })` on a method                                |
| `CircuitBreakerDecorator(opts?)`            | decorator | `@CircuitBreakerDecorator({ name, failureThreshold })`                           |
| `BulkheadDecorator(opts?)`                  | decorator | `@BulkheadDecorator({ maxConcurrency: 10 })`                                     |
| `TimeoutDecorator(opts?)`                   | decorator | `@TimeoutDecorator({ timeout: 2000 })`                                           |
| `ResilienceDecorator(opts?)`                | decorator | Composite — apply all four with one decorator                                    |
| `getResilienceConfig(instance, methodName)` | function  | Read back the static decorator config for a decorated method                     |
| `getResilienceMetrics(target)`              | function  | Deprecated alias of `getResilienceConfig` — despite the name, no runtime metrics |
| `RetryDecoratorConfig`                      | type      | Decorator options                                                                |
| `CircuitBreakerDecoratorConfig`             | type      | Decorator options                                                                |
| `BulkheadDecoratorConfig`                   | type      | Decorator options                                                                |
| `TimeoutDecoratorConfig`                    | type      | Decorator options                                                                |
| `CompositeResilienceConfig`                 | type      | Composite decorator options                                                      |
| `ResilienceDecoratorConfig`                 | type      | Generic config base                                                              |

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
    timeout: 2000,
    retry: { maxAttempts: 3, baseDelay: 100 },
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

**By default `RetryPolicy`/`@RetryDecorator` retries every thrown error.**
`retryableErrors` is optional — leave it unset and _any_ failure (including a
validation error unrelated to transient infrastructure) triggers a retry. Set
`retryableErrors` explicitly whenever the wrapped operation is not provably
idempotent:

```typescript
const retry = new RetryPolicy({
  ...RetryPolicy.defaultConfig(),
  retryableErrors: error =>
    error.name === 'ECONNRESET' || error.name === 'TimeoutError',
});
```

### Decorator policy scope: per-instance by default

`@CircuitBreakerDecorator`/`@BulkheadDecorator`/`@RetryDecorator`/`@ResilienceDecorator`
build a **separate policy per decorated instance** (`this`), lazily on first
call. A circuit breaker tripped by one instance no longer silently affects every
other instance of the same class.

If you deliberately want one shared breaker/bulkhead/retry state across every
instance of a class (e.g. protecting a shared connection pool), opt in with
`scope: 'shared'` — this restores the previous "one policy for the whole class"
behavior:

```typescript
class GatewayClient {
  @CircuitBreakerDecorator({
    name: 'gateway',
    failureThreshold: 5,
    scope: 'shared',
  })
  async call(payload: Payload): Promise<Response> {
    return gatewayApi.send(payload);
  }
}
```

If you want the sharing without giving up per-instance isolation for everything
else, share the _instance_ instead (one `GatewayClient` used by all callers), or
build a single named policy with `ResiliencePolicyBuilder` and call it directly
rather than through the decorator.

### Circuit breaker HALF_OPEN probe gating

Once `recoveryTimeout` elapses, the breaker enters HALF_OPEN and every caller
that arrives is a candidate "recovery probe" against the downstream. By default
only **one** probe is allowed in flight at a time — extra concurrent callers are
rejected with `CircuitBreakerHalfOpenLimitError` (which
`extends CircuitBreakerOpenError`, so existing
`instanceof CircuitBreakerOpenError` handling still works) instead of all
reaching the downstream at once. Raise the limit with `halfOpenMaxProbes` if the
downstream can safely absorb more than one concurrent probe:

```typescript
new CircuitBreaker({
  name: 'payments',
  failureThreshold: 5,
  recoveryTimeout: 30_000,
  successThreshold: 2,
  timeout: 5_000,
  halfOpenMaxProbes: 3,
});
```

A probe holds its slot for its entire execution, including any `Retry` composed
inside the same circuit breaker (retry runs _inside_ the breaker in
`CompositeResilienceStrategy`) — so full recovery can take noticeably longer
than `recoveryTimeout` alone suggests when a probe itself retries with backoff.

### Compensating for side effects outside the transaction (try-confirm-cancel)

**No durability.** `CompensationStack` is in-process, in-memory only — nothing
here is persisted. If the process dies mid-flight, whatever was already pushed
onto the stack is lost with it and its compensation never runs. There is no
durable log, no persistence, and no recovery after a restart. This is not a saga
implementation; if the flow needs to survive a process crash, that is a separate
concern this primitive does not attempt to solve.

Reservations, calls into another bounded context, and external API side effects
happen outside the database transaction — the transaction rolls itself back on
failure, these do not, so the caller has to undo them by hand.
`CompensationStack.acquire` runs the acquisition and files its undo in a single
call, so there is no path through this API where a resource gets acquired
without a compensation also being on file:

```typescript
import { CompensationStack, runCompensated } from '@vytches/ddd-resilience';

const stack = CompensationStack.create();
const outcome = await runCompensated(stack, async s => {
  const reservationId = await s.acquire(
    'inventory-reservation',
    () => inventoryClient.reserve(orderId, items),
    id => inventoryClient.release(id)
  );
  return placeOrder(orderId, reservationId);
});

if (outcome.isFailure) {
  const { cause, compensationFailures } = outcome.error;
  logger.error('order placement failed', cause);
  if (compensationFailures.length > 0) {
    logger.error('cleanup also failed', compensationFailures);
  }
}
```

On failure, `stack.unwind()` runs every registered compensation
most-recently-acquired first, one at a time — sequential `await`s, never
`Promise.all`. A compensation that itself throws is recorded as a
`CompensationFailure` and does not stop the rest of the unwind. The resulting
failure shape is unconditional: `cause` (the original error) plus
`compensationFailures` (possibly empty) are always both present — a failed
cleanup is reported alongside the real error, never in place of it. `unwind()`
is idempotent by latching its first run's promise, so concurrent or repeated
calls (including two `await`s racing on the same instance) all resolve to that
one run instead of compensating twice.

On success, the stack is left **armed** — neither `acquire` nor `runCompensated`
clears it. That is deliberate: a caller whose own database transaction commits
after this flow completes, then has to roll back later for an unrelated reason,
can still call `stack.unwind()` on this same instance from that later hook and
get a real, first-time run. `runCompensated` takes the stack as a parameter
rather than creating one internally for the same reason — the caller keeps a
reference to unwind again from outside the call.

**What this does not enforce.** Nothing here prevents you from acquiring a
resource through a call that bypasses `acquire` and forgetting to register its
compensation — the inseparability guarantee only covers calls that go through
`CompensationStack.acquire`. Nor does it check that the `compensate` function
you pass actually reverses what `acquire` did; that correspondence is on the
caller. The primitive also takes no transaction argument and reaches for no
request-scoped context of its own — it does not manage a transaction boundary,
and there is no `AsyncLocalStorage` or CQRS-pipeline integration in this
version. Neither timeouts nor retries are applied around a compensation call;
compose the `compensate` function with this package's own `RetryPolicy` or
`TimeoutStrategy` if a cleanup call itself needs either.

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
- **Do not assume `retryableErrors` defaults to "transient errors only"** — it
  defaults to retrying everything. Set it explicitly for non-idempotent work.
- **Do not assume `scope: 'shared'` on a decorator is the default** — it isn't.
  Per-instance policies are the default (`scope: 'instance'`); opt into
  `'shared'` deliberately, only when you actually want cross-instance sharing.
- **Do not assume `CompensationStack` survives a process crash** — it is
  in-memory only. If the process dies mid-flight, whatever was pushed is lost
  and never compensated; pair it with your own durable saga/outbox if the flow
  needs to survive a restart.
- **Do not acquire a resource outside `CompensationStack.acquire`** and expect
  it to be covered — only acquisitions that go through `acquire` get an undo
  filed automatically. A side effect performed any other way is invisible to
  `unwind()`.
- **Do not call `Promise.all` on multiple compensations yourself** — `unwind()`
  already runs them sequentially, LIFO; racing them concurrently outside the
  stack can let one compensation's rejection go unobserved as an unhandled
  rejection instead of a reported `CompensationFailure`.
