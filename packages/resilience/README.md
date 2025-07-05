# @vytches-ddd/resilience

Enterprise-grade resilience patterns for TypeScript applications with zero
external dependencies. Built for Domain-Driven Design architectures with
comprehensive observability and type safety.

## Features

🔥 **Zero External Dependencies** - Pure TypeScript implementation  
🛡️ **Enterprise Resilience Patterns** - Circuit Breaker, Retry, Bulkhead,
Timeout  
📊 **Advanced Observability** - Metrics, events, exporters (Prometheus, JSON,
CSV)  
🎯 **Type Safety** - Full TypeScript generics and strict typing  
🏗️ **DDD Integration** - Built for Domain-Driven Design architectures  
⚡ **High Performance** - Async/await native, no blocking operations  
🎨 **Decorator Support** - Individual and composite pattern decorators  
🧪 **Comprehensive Testing** - 57 tests with functional error handling

## Installation

```bash
npm install @vytches-ddd/resilience
```

## Quick Start

### Basic Circuit Breaker

```typescript
import {
  CircuitBreaker,
  DefaultResilienceContext,
} from '@vytches-ddd/resilience';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 30000,
  successThreshold: 3,
  timeout: 10000,
  name: 'payment-service',
});

const context = DefaultResilienceContext.create();

try {
  const result = await circuitBreaker.execute(async ctx => {
    return await paymentService.processPayment(orderId);
  }, context);
} catch (error) {
  console.error('Payment failed:', error);
}
```

### Fluent Policy Builder

```typescript
import { ResiliencePolicyBuilder } from '@vytches-ddd/resilience';

const policy = ResiliencePolicyBuilder.create()
  .withCircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 30000,
    successThreshold: 3,
    timeout: 10000,
  })
  .withRetry({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  })
  .withBulkhead({
    maxConcurrency: 10,
    queueCapacity: 50,
  })
  .withTimeout(30000)
  .build();

const result = await policy.execute(async ctx => {
  return await externalService.call(data);
}, context);
```

### Decorator Usage

```typescript
import {
  CircuitBreakerDecorator,
  RetryDecorator,
  ResilienceDecorator,
} from '@vytches-ddd/resilience';

class PaymentService {
  // Individual pattern decorator
  @CircuitBreakerDecorator({
    failureThreshold: 5,
    recoveryTimeout: 30000,
    successThreshold: 3,
    name: 'payment-gateway',
  })
  async processPayment(orderId: string): Promise<PaymentResult> {
    return await this.paymentGateway.charge(orderId);
  }

  // Composite resilience decorator
  @ResilienceDecorator({
    name: 'order-processing',
    timeout: 30000,
    bulkhead: {
      maxConcurrency: 10,
      queueCapacity: 50,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      backoffMultiplier: 2,
    },
  })
  async processOrder(order: Order): Promise<OrderResult> {
    return await this.orderProcessor.process(order);
  }
}
```

## Resilience Patterns

### Circuit Breaker

Protects against cascading failures by monitoring failure rates and preventing
calls when a threshold is reached.

```typescript
import { CircuitBreaker } from '@vytches-ddd/resilience';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 30000, // Try recovery after 30s
  successThreshold: 3, // Close after 3 successes in half-open
  timeout: 10000, // Individual operation timeout
  name: 'external-api',
});

// States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
```

### Retry with Exponential Backoff

Handles transient failures with configurable retry strategies.

```typescript
import { RetryPolicy } from '@vytches-ddd/resilience';

const retryPolicy = new RetryPolicy({
  maxAttempts: 3,
  baseDelay: 1000, // Start with 1s delay
  maxDelay: 30000, // Max 30s delay
  backoffMultiplier: 2, // Double delay each retry
  jitter: true, // Add randomness
  retryableErrors: error => error.message.includes('timeout'),
});
```

### Bulkhead (Resource Isolation)

Isolates resources to prevent resource exhaustion.

```typescript
import { Bulkhead } from '@vytches-ddd/resilience';

const bulkhead = new Bulkhead({
  maxConcurrency: 10, // Max 10 concurrent operations
  queueCapacity: 50, // Queue up to 50 operations
  timeout: 60000, // Queue timeout
  name: 'report-generation',
});
```

### Timeout

Enforces operation time limits with AbortSignal integration.

```typescript
import { ResiliencePolicyBuilder } from '@vytches-ddd/resilience';

const policy = ResiliencePolicyBuilder.create()
  .withTimeout(5000) // 5 second timeout
  .build();
```

## Context Propagation

All patterns support context propagation for correlation IDs, metadata, and
tracing.

```typescript
import { DefaultResilienceContext } from '@vytches-ddd/resilience';

const context = DefaultResilienceContext.create({
  correlationId: 'req-123',
  metadata: {
    userId: 'user-456',
    operation: 'payment-processing',
    source: 'web-api',
  },
});

// Context is passed through all resilience operations
const result = await policy.execute(async ctx => {
  console.log('Correlation ID:', ctx.correlationId);
  console.log('User ID:', ctx.metadata.userId);
  return await service.call();
}, context);
```

## Observability & Metrics

### Metric Collection

```typescript
import {
  CircuitBreakerMetricCollector,
  DefaultMetricRegistry,
  GlobalMetricRegistry,
} from '@vytches-ddd/resilience';

// Create and register collectors
const cbCollector = new CircuitBreakerMetricCollector('payment-cb', {
  service: 'payment',
  environment: 'production',
});

const registry = GlobalMetricRegistry.getInstance();
registry.register(cbCollector);

// Record metrics
cbCollector.recordExecution(true, 150);
cbCollector.recordStateChange('OPEN', 'CLOSED');

// Collect all metrics
const metrics = registry.collectAll();
```

### Metric Export Formats

```typescript
import {
  MetricExporterFactory,
  PrometheusMetricExporter,
  JsonMetricExporter,
} from '@vytches-ddd/resilience';

// Export to Prometheus format
const prometheusExporter = new PrometheusMetricExporter();
const prometheusOutput = prometheusExporter.export(metrics);

// Export to JSON
const jsonExporter = new JsonMetricExporter(true); // pretty print
const jsonOutput = jsonExporter.export(metrics);

// Using factory
const csvExporter = MetricExporterFactory.create('csv', {
  includeHeaders: true,
});
const csvOutput = csvExporter.export(metrics);
```

**Example Prometheus output:**

```
# HELP resilience_execution_total Total executions
# TYPE resilience_execution_total counter
resilience_execution_total{pattern="circuit_breaker",instance="payment-cb",service="payment"} 150 1640995200000

# HELP resilience_execution_duration_avg Average execution duration
# TYPE resilience_execution_duration_avg histogram
resilience_execution_duration_avg{pattern="circuit_breaker",instance="payment-cb"} 145.5 1640995200000
```

### Event-Driven Observability

```typescript
import {
  GlobalObservabilityEventBus,
  ObservabilityEventFactory,
} from '@vytches-ddd/resilience';

const eventBus = GlobalObservabilityEventBus.getInstance();

// Subscribe to specific events
eventBus.subscribe('resilience.circuit_breaker.state_change', event => {
  console.log(
    `Circuit breaker ${event.source} changed from ${event.data.oldState} to ${event.data.newState}`
  );
});

// Subscribe to all events
eventBus.subscribeAll(event => {
  if (event.severity === 'error') {
    alerting.sendAlert(event);
  }
});

// Emit custom events
const event = ObservabilityEventFactory.createCircuitBreakerStateChangeEvent(
  'payment-service',
  'CLOSED',
  'OPEN',
  { failureCount: 5 }
);

await eventBus.emit(event);
```

### Real-time Monitoring Dashboard

```typescript
import {
  GlobalMetricRegistry,
  TextMetricExporter,
  GlobalObservabilityEventBus,
} from '@vytches-ddd/resilience';

class ResilienceMonitor {
  private registry = GlobalMetricRegistry.getInstance();
  private eventBus = GlobalObservabilityEventBus.getInstance();
  private textExporter = new TextMetricExporter();

  start() {
    // Real-time event monitoring
    this.eventBus.subscribeAll(event => {
      this.logEvent(event);
    });

    // Periodic metrics reporting
    setInterval(() => {
      this.reportMetrics();
    }, 30000); // Every 30 seconds
  }

  private logEvent(event: ObservabilityEvent) {
    console.log(
      `[${new Date(event.timestamp).toISOString()}] ${event.source}: ${event.eventType} (${event.severity})`
    );
  }

  private reportMetrics() {
    const metrics = this.registry.collectAll();
    const report = this.textExporter.export(metrics);
    console.log(report);
  }
}

const monitor = new ResilienceMonitor();
monitor.start();
```

## Integration with External Systems

### Prometheus Integration

```typescript
import {
  PrometheusMetricExporter,
  GlobalMetricRegistry,
} from '@vytches-ddd/resilience';
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/metrics') {
    const registry = GlobalMetricRegistry.getInstance();
    const exporter = new PrometheusMetricExporter();
    const metrics = registry.collectAll();
    const output = exporter.export(metrics);

    res.setHeader('Content-Type', 'text/plain');
    res.end(output);
  }
});

server.listen(9090);
```

### Custom Alerting

```typescript
import { GlobalObservabilityEventBus } from '@vytches-ddd/resilience';

class AlertingService {
  constructor() {
    const eventBus = GlobalObservabilityEventBus.getInstance();

    // Alert on circuit breaker opening
    eventBus.subscribe('resilience.circuit_breaker.state_change', event => {
      if (event.data.newState === 'OPEN') {
        this.sendAlert({
          severity: 'critical',
          message: `Circuit breaker ${event.source} is now OPEN`,
          service: event.source,
        });
      }
    });

    // Alert on high failure rates
    eventBus.subscribe('resilience.execution', event => {
      if (!event.data.success) {
        this.trackFailure(event.source);
      }
    });
  }

  private async sendAlert(alert: Alert) {
    // Send to Slack, PagerDuty, etc.
  }
}
```

## Error Handling

The library uses functional error handling with the `safeRun` pattern:

```typescript
import { safeRun } from '@vytches-ddd/utils';

const [error, result] = await safeRun(async () => {
  return await policy.execute(async ctx => {
    return await riskyOperation();
  }, context);
});

if (error) {
  console.error('Operation failed:', error);
  return;
}

console.log('Operation succeeded:', result);
```

## Advanced Configuration

### Custom Context Provider

```typescript
import { ResilienceContext } from '@vytches-ddd/resilience';

class CustomResilienceContext implements ResilienceContext {
  constructor(
    public readonly correlationId: string,
    public readonly signal: AbortSignal,
    public readonly metadata: Record<string, unknown>,
    private readonly requestId: string
  ) {}

  withMetadata(metadata: Record<string, unknown>): ResilienceContext {
    return new CustomResilienceContext(
      this.correlationId,
      this.signal,
      { ...this.metadata, ...metadata },
      this.requestId
    );
  }

  withSignal(signal: AbortSignal): ResilienceContext {
    return new CustomResilienceContext(
      this.correlationId,
      signal,
      this.metadata,
      this.requestId
    );
  }
}
```

### Custom Metric Collectors

```typescript
import { MetricCollector, Metric } from '@vytches-ddd/resilience';

class CustomMetricCollector implements MetricCollector {
  private metrics: Metric[] = [];

  getName(): string {
    return 'custom-collector';
  }

  collect(): ReadonlyArray<Metric> {
    return [...this.metrics];
  }

  recordCustomMetric(name: string, value: number) {
    this.metrics.push({
      name: `custom_${name}`,
      type: 'gauge',
      labels: { source: 'custom' },
      value,
      timestamp: Date.now(),
    });
  }
}
```

## Performance Characteristics

- **Zero External Dependencies**: No third-party runtime dependencies
- **Memory Efficient**: Bounded memory usage with configurable history limits
- **High Throughput**: Optimized for high-concurrency scenarios
- **Type Safe**: Full TypeScript support with minimal runtime overhead
- **Async Native**: Built for modern async/await patterns

## Comparison with Other Libraries

| Feature            | @vytches-ddd/resilience  | .NET Polly | Java Resilience4j | Go hystrix-go |
| ------------------ | ------------------------ | ---------- | ----------------- | ------------- |
| Circuit Breaker    | ✅ Full implementation   | ✅         | ✅                | ✅            |
| Retry with Backoff | ✅ Exponential + Jitter  | ✅         | ✅                | ✅            |
| Bulkhead           | ✅ Resource isolation    | ✅         | ✅                | ✅            |
| Timeout            | ✅ AbortSignal support   | ✅         | ✅                | ✅            |
| Policy Composition | ✅ Fluent builder        | ✅         | ✅                | ⚠️            |
| Decorator Support  | ✅ TypeScript decorators | ✅         | ✅                | ❌            |
| Zero Dependencies  | ✅                       | ❌         | ❌                | ✅            |
| Type Safety        | ✅ Full TypeScript       | ✅         | ✅                | ✅            |
| Observability      | ✅ Rich metrics/events   | ✅         | ✅                | ⚠️            |
| DDD Integration    | ✅ Native support        | ❌         | ❌                | ❌            |

## Contributing

This package is part of the Vytches DDD monorepo. Please refer to the main
repository for contribution guidelines.

## License

MIT License - see LICENSE file for details.
