# @vytches-ddd/resilience

<!-- LLM-METADATA
Package: @vytches-ddd/resilience
Category: Infrastructure
Purpose: Resilience patterns including circuit breakers, retry policies, bulkheads, and timeout strategies for fault-tolerant applications
Dependencies: @vytches-ddd/core, @vytches-ddd/logging
Complexity: High
DDD Patterns: Resilience Patterns, Circuit Breaker, Retry, Bulkhead, Timeout
Integration Points: @vytches-ddd/cqrs, @vytches-ddd/messaging, @vytches-ddd/repositories, @vytches-ddd/domain-services
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fresilience.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fresilience)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade resilience patterns for building fault-tolerant distributed
> systems**

Comprehensive resilience framework with circuit breakers, retry policies,
bulkheads, and timeout strategies. Designed for high-availability systems
requiring robust error handling and fault tolerance. Includes comprehensive
observability and metrics collection.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Circuit Breaker Pattern](#circuit-breaker-pattern)
- [Retry Pattern](#retry-pattern)
- [Bulkhead Pattern](#bulkhead-pattern)
- [Timeout Strategy](#timeout-strategy)
- [Resilience Strategies](#resilience-strategies)
- [Decorators](#decorators)
- [Observability](#observability)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/resilience

# yarn
yarn add @vytches-ddd/resilience

# pnpm
pnpm add @vytches-ddd/resilience
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches-ddd/core @vytches-ddd/logging
```

## ✨ Key Features

### Resilience Patterns

- **Circuit Breaker**: Three-state circuit breaker (CLOSED/OPEN/HALF_OPEN) with
  automatic recovery
- **Retry Policy**: Exponential backoff with jitter and configurable retry
  conditions
- **Bulkhead Pattern**: Resource isolation with concurrency limits and queue
  management
- **Timeout Strategy**: Operation timeouts with AbortSignal integration

### Advanced Features

- **Strategy Composition**: Combine multiple resilience patterns via
  CompositeResilienceStrategy
- **Fluent Policy Builder**: Chainable pattern configuration with
  ResiliencePolicyBuilder
- **Resilience Context**: Correlation tracking, attempt counting, and metadata
  propagation
- **Decorator System**: Method decorators for applying resilience patterns

### Enterprise Quality

- **Comprehensive Observability**: Metrics collection, event bus, and multiple
  export formats
- **Zero Dependencies**: Pure TypeScript implementation with no external runtime
  dependencies
- **Type Safety**: Full TypeScript support with strict typing and generic
  constraints
- **Performance**: Optimized for high-throughput scenarios with minimal overhead

## 🎯 Core Concepts

### Resilience Context

The resilience context provides execution context and metadata for resilience
operations:

```typescript
// Core resilience context interface
interface ResilienceContext {
  correlationId: string;
  attemptNumber: number;
  startTime: Date;
  timeout?: AbortSignal;
  metadata: Record<string, unknown>;

  withTimeout(timeoutMs: number): ResilienceContext;
  withAttempt(attempt: number): ResilienceContext;
  withMetadata(metadata: Record<string, unknown>): ResilienceContext;
}
```

### Circuit Breaker States

Circuit breakers maintain state to prevent cascading failures:

```typescript
enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  recoveryTimeout: number; // Time before attempting recovery
  successThreshold: number; // Successes needed to close
  timeout: number; // Operation timeout
  name?: string; // Circuit breaker name
}
```

### Retry Configuration

Retry policies support various backoff strategies:

```typescript
interface RetryConfig {
  maxAttempts: number; // Maximum retry attempts
  baseDelay: number; // Base delay between retries
  maxDelay: number; // Maximum delay cap
  backoffMultiplier: number; // Exponential backoff multiplier
  jitter: boolean; // Add randomness to delays
  retryableErrors?: (error: Error) => boolean; // Custom retry logic
}
```

### Bulkhead Configuration

Bulkheads provide resource isolation and concurrency control:

```typescript
interface BulkheadConfig {
  maxConcurrency: number; // Maximum concurrent operations
  queueCapacity: number; // Queue size for waiting operations
  timeout?: number; // Queue timeout
  name?: string; // Bulkhead name
}
```

## 🚀 Quick Start

### Basic Circuit Breaker

```typescript
import { CircuitBreaker, CircuitBreakerState } from '@vytches-ddd/resilience';

// Create circuit breaker
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 60000, // Try recovery after 1 minute
  successThreshold: 3, // Close after 3 successful attempts
  timeout: 30000, // 30 second operation timeout
  name: 'external-service',
});

// Use circuit breaker
const context = new DefaultResilienceContext();

try {
  const result = await circuitBreaker.execute(async ctx => {
    // Your operation here
    return await externalService.getData();
  }, context);

  console.log('Operation succeeded:', result);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log('Circuit breaker is open, failing fast');
  } else {
    console.error('Operation failed:', error);
  }
}
```

### Basic Retry Policy

```typescript
import { RetryPolicy, MaxRetriesExceededError } from '@vytches-ddd/resilience';

// Create retry policy
const retryPolicy = new RetryPolicy({
  maxAttempts: 3,
  baseDelay: 1000, // 1 second base delay
  maxDelay: 10000, // 10 second max delay
  backoffMultiplier: 2, // Exponential backoff
  jitter: true, // Add randomness
  retryableErrors: error => error.name === 'NetworkError',
});

// Use retry policy
try {
  const result = await retryPolicy.execute(async ctx => {
    console.log(`Attempt ${ctx.attemptNumber}`);
    return await unstableOperation();
  }, context);

  console.log('Operation succeeded:', result);
} catch (error) {
  if (error instanceof MaxRetriesExceededError) {
    console.log(`Failed after ${error.attempts} attempts`);
  }
}
```

### Basic Bulkhead

```typescript
import { Bulkhead, BulkheadRejectedException } from '@vytches-ddd/resilience';

// Create bulkhead
const bulkhead = new Bulkhead({
  maxConcurrency: 10, // Max 10 concurrent operations
  queueCapacity: 50, // Queue up to 50 waiting operations
  timeout: 5000, // 5 second queue timeout
  name: 'database-operations',
});

// Use bulkhead
try {
  const result = await bulkhead.execute(async ctx => {
    return await databaseOperation();
  }, context);

  console.log('Operation completed:', result);
} catch (error) {
  if (error instanceof BulkheadRejectedException) {
    console.log('Request rejected by bulkhead');
  }
}
```

## 🔧 Circuit Breaker Pattern

### Advanced Circuit Breaker Usage

```typescript
import { CircuitBreaker, CircuitBreakerState } from '@vytches-ddd/resilience';

class PaymentServiceCircuitBreaker {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      successThreshold: 2,
      timeout: 15000,
      name: 'payment-service',
    });
  }

  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    const context = new DefaultResilienceContext().withMetadata({
      operation: 'processPayment',
      paymentId: paymentData.id,
      amount: paymentData.amount,
    });

    return await this.circuitBreaker.execute(async ctx => {
      // Call external payment service
      const response = await fetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData),
        signal: ctx.timeout, // Use context timeout
      });

      if (!response.ok) {
        throw new Error(`Payment failed: ${response.status}`);
      }

      return await response.json();
    }, context);
  }

  getMetrics(): CircuitBreakerMetrics {
    return this.circuitBreaker.getMetrics();
  }

  getState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }
}
```

### Circuit Breaker with Custom Error Handling

```typescript
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from '@vytches-ddd/resilience';

class ResilientApiClient {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 60000,
      successThreshold: 1,
      timeout: 10000,
      name: 'api-client',
    });
  }

  async makeRequest<T>(endpoint: string, options: RequestOptions): Promise<T> {
    const context = new DefaultResilienceContext().withMetadata({
      endpoint,
      method: options.method,
    });

    try {
      return await this.circuitBreaker.execute(async ctx => {
        const response = await fetch(endpoint, {
          ...options,
          signal: ctx.timeout,
        });

        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        if (!response.ok) {
          throw new Error(`Client error: ${response.status}`);
        }

        return await response.json();
      }, context);
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        // Return cached data or default response
        return await this.getFallbackResponse<T>(endpoint);
      }
      throw error;
    }
  }

  private async getFallbackResponse<T>(endpoint: string): Promise<T> {
    // Implement fallback logic (cache, default values, etc.)
    return {} as T;
  }
}
```

## 🔄 Retry Pattern

### Exponential Backoff with Jitter

```typescript
import { RetryPolicy } from '@vytches-ddd/resilience';

const retryPolicy = new RetryPolicy({
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: error => {
    // Only retry on specific errors
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      (error.name === 'HttpError' && error.status >= 500)
    );
  },
});

// Usage with comprehensive error handling
async function fetchWithRetry(url: string): Promise<any> {
  const context = new DefaultResilienceContext().withMetadata({
    url,
    operation: 'fetch',
  });

  try {
    return await retryPolicy.execute(async ctx => {
      console.log(`Attempt ${ctx.attemptNumber} for ${url}`);

      const response = await fetch(url, {
        signal: ctx.timeout,
      });

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}`, response.status);
      }

      return await response.json();
    }, context);
  } catch (error) {
    if (error instanceof MaxRetriesExceededError) {
      console.error(`Failed to fetch ${url} after ${error.attempts} attempts`);
      throw new Error(`Persistent failure: ${error.lastError.message}`);
    }
    throw error;
  }
}
```

### Retry with Custom Backoff Strategy

```typescript
import { RetryPolicy } from '@vytches-ddd/resilience';

class CustomRetryPolicy extends RetryPolicy {
  constructor(config: RetryConfig) {
    super(config);
  }

  protected calculateDelay(attempt: number): number {
    // Custom backoff calculation
    const baseDelay = this.config.baseDelay;
    const multiplier = this.config.backoffMultiplier;

    // Fibonacci-like backoff
    let delay = baseDelay;
    for (let i = 1; i < attempt; i++) {
      delay = delay * multiplier;
    }

    // Apply jitter if enabled
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.min(delay, this.config.maxDelay);
  }
}

// Usage
const customRetry = new CustomRetryPolicy({
  maxAttempts: 4,
  baseDelay: 500,
  maxDelay: 20000,
  backoffMultiplier: 1.5,
  jitter: true,
});
```

## 🚪 Bulkhead Pattern

### Resource Isolation

```typescript
import { Bulkhead, BulkheadMetrics } from '@vytches-ddd/resilience';

class DatabaseBulkhead {
  private readBulkhead: Bulkhead;
  private writeBulkhead: Bulkhead;

  constructor() {
    // Separate bulkheads for read and write operations
    this.readBulkhead = new Bulkhead({
      maxConcurrency: 50,
      queueCapacity: 100,
      timeout: 10000,
      name: 'database-reads',
    });

    this.writeBulkhead = new Bulkhead({
      maxConcurrency: 20,
      queueCapacity: 50,
      timeout: 15000,
      name: 'database-writes',
    });
  }

  async executeRead<T>(operation: () => Promise<T>): Promise<T> {
    const context = new DefaultResilienceContext().withMetadata({
      operationType: 'read',
    });

    return await this.readBulkhead.execute(async ctx => {
      return await operation();
    }, context);
  }

  async executeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const context = new DefaultResilienceContext().withMetadata({
      operationType: 'write',
    });

    return await this.writeBulkhead.execute(async ctx => {
      return await operation();
    }, context);
  }

  getMetrics(): { read: BulkheadMetrics; write: BulkheadMetrics } {
    return {
      read: this.readBulkhead.getMetrics(),
      write: this.writeBulkhead.getMetrics(),
    };
  }
}
```

### Priority Queue Implementation

```typescript
import { Bulkhead } from '@vytches-ddd/resilience';

class PriorityBulkhead extends Bulkhead {
  private highPriorityQueue: QueuedTask[] = [];
  private normalPriorityQueue: QueuedTask[] = [];

  async executeWithPriority<T>(
    operation: (context: ResilienceContext) => Promise<T>,
    context: ResilienceContext,
    priority: 'high' | 'normal' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = {
        operation,
        context,
        resolve,
        reject,
        startTime: Date.now(),
        priority,
      };

      if (priority === 'high') {
        this.highPriorityQueue.push(task);
      } else {
        this.normalPriorityQueue.push(task);
      }

      this.processNextTask();
    });
  }

  private processNextTask(): void {
    if (this.activeTasks < this.config.maxConcurrency) {
      // Process high priority tasks first
      const task =
        this.highPriorityQueue.shift() || this.normalPriorityQueue.shift();

      if (task) {
        this.executeTask(task);
      }
    }
  }
}
```

## 🏗️ Resilience Strategies

### Composite Resilience Strategy

```typescript
import {
  CompositeResilienceStrategy,
  CircuitBreakerStrategy,
  RetryStrategy,
  BulkheadStrategy,
} from '@vytches-ddd/resilience';

// Create composite strategy
const compositeStrategy = new CompositeResilienceStrategy([
  new CircuitBreakerStrategy({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 30000,
    name: 'external-api',
  }),
  new RetryStrategy({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  }),
  new BulkheadStrategy({
    maxConcurrency: 10,
    queueCapacity: 50,
    timeout: 5000,
    name: 'api-calls',
  }),
]);

// Execute with all strategies
const result = await compositeStrategy.execute(async ctx => {
  return await externalApiCall();
}, context);
```

### Fluent Policy Builder

```typescript
import { ResiliencePolicyBuilder } from '@vytches-ddd/resilience';

// Build policy with fluent API
const policy = ResiliencePolicyBuilder.create()
  .withCircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 30000,
    successThreshold: 2,
    timeout: 15000,
    name: 'payment-service',
  })
  .withRetry({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: error => error.name === 'NetworkError',
  })
  .withBulkhead({
    maxConcurrency: 5,
    queueCapacity: 20,
    timeout: 10000,
    name: 'payment-operations',
  })
  .withTimeout(25000)
  .build();

// Use the policy
const result = await policy.execute(async ctx => {
  return await complexOperation();
}, context);
```

## 🎨 Decorators

### Method Decorators

```typescript
import {
  CircuitBreakerDecorator,
  RetryDecorator,
  BulkheadDecorator,
  TimeoutDecorator,
} from '@vytches-ddd/resilience';

class PaymentService {
  @CircuitBreakerDecorator({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 30000,
    name: 'payment-processing',
  })
  @RetryDecorator({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  })
  @BulkheadDecorator({
    maxConcurrency: 10,
    queueCapacity: 50,
    timeout: 15000,
    name: 'payment-bulkhead',
  })
  @TimeoutDecorator(30000)
  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    // Method implementation
    return await this.externalPaymentService.process(paymentData);
  }

  @CircuitBreakerDecorator({
    failureThreshold: 3,
    recoveryTimeout: 30000,
    successThreshold: 2,
    timeout: 10000,
    name: 'payment-validation',
  })
  async validatePayment(paymentData: PaymentData): Promise<boolean> {
    return await this.externalValidationService.validate(paymentData);
  }
}
```

### Class-Level Decorators

```typescript
import { ResilienceDecorator } from '@vytches-ddd/resilience';

@ResilienceDecorator({
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 30000,
    name: 'user-service',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },
  bulkhead: {
    maxConcurrency: 20,
    queueCapacity: 100,
    timeout: 15000,
    name: 'user-operations',
  },
})
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // All methods automatically get resilience patterns
    return await this.externalUserService.create(userData);
  }

  async updateUser(userId: string, userData: UserData): Promise<User> {
    return await this.externalUserService.update(userId, userData);
  }
}
```

## 📊 Observability

### Metrics Collection

```typescript
import {
  GlobalMetricRegistry,
  CircuitBreakerMetricCollector,
  RetryMetricCollector,
  BulkheadMetricCollector,
} from '@vytches-ddd/resilience';

// Setup metrics collection
const metricRegistry = GlobalMetricRegistry.getInstance();

// Register collectors
metricRegistry.register(new CircuitBreakerMetricCollector());
metricRegistry.register(new RetryMetricCollector());
metricRegistry.register(new BulkheadMetricCollector());

// Create instrumented circuit breaker
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000,
  successThreshold: 3,
  timeout: 30000,
  name: 'instrumented-service',
});

// Execute operation (metrics automatically collected)
await circuitBreaker.execute(async ctx => {
  return await operationWithMetrics();
}, context);

// Get metrics
const metrics = metricRegistry.getMetrics();
console.log('Circuit Breaker Metrics:', metrics.circuitBreaker);
console.log('Retry Metrics:', metrics.retry);
console.log('Bulkhead Metrics:', metrics.bulkhead);
```

### Custom Metrics Export

```typescript
import {
  JsonMetricExporter,
  PrometheusMetricExporter,
  CsvMetricExporter,
  CompositeMetricExporter,
} from '@vytches-ddd/resilience';

// Create exporters
const jsonExporter = new JsonMetricExporter('./metrics.json');
const prometheusExporter = new PrometheusMetricExporter('./metrics.prom');
const csvExporter = new CsvMetricExporter('./metrics.csv');

// Composite exporter
const compositeExporter = new CompositeMetricExporter([
  jsonExporter,
  prometheusExporter,
  csvExporter,
]);

// Export metrics
const registry = GlobalMetricRegistry.getInstance();
await compositeExporter.export(registry.getMetrics());
```

### Event Bus Integration

```typescript
import {
  GlobalObservabilityEventBus,
  ObservabilityEventListener,
} from '@vytches-ddd/resilience';

// Create event listener
const eventListener: ObservabilityEventListener = {
  onEvent: event => {
    console.log(`Resilience Event: ${event.type}`, event.data);

    // Send to monitoring system
    if (event.type === 'circuit-breaker-opened') {
      alerting.sendAlert({
        level: 'warning',
        message: `Circuit breaker ${event.data.name} opened`,
        timestamp: event.timestamp,
      });
    }
  },
};

// Register listener
const eventBus = GlobalObservabilityEventBus.getInstance();
eventBus.subscribe(eventListener);
```

## 🔗 Integration Patterns

### CQRS Integration

```typescript
import { CommandHandler, QueryHandler } from '@vytches-ddd/cqrs';
import { ResilienceDecorator } from '@vytches-ddd/resilience';

@CommandHandler(ProcessPaymentCommand)
@ResilienceDecorator({
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 30000,
    name: 'payment-command',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },
})
class ProcessPaymentHandler {
  async execute(command: ProcessPaymentCommand): Promise<void> {
    // Command handling with automatic resilience
    await this.paymentService.processPayment(command.paymentData);
  }
}

@QueryHandler(GetUserQuery)
@ResilienceDecorator({
  circuitBreaker: {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    successThreshold: 2,
    timeout: 10000,
    name: 'user-query',
  },
  bulkhead: {
    maxConcurrency: 50,
    queueCapacity: 200,
    timeout: 5000,
    name: 'user-queries',
  },
})
class GetUserHandler {
  async execute(query: GetUserQuery): Promise<User> {
    return await this.userRepository.findById(query.userId);
  }
}
```

### Repository Integration

```typescript
import { IBaseRepository } from '@vytches-ddd/repositories';
import { ResilienceDecorator } from '@vytches-ddd/resilience';

@ResilienceDecorator({
  circuitBreaker: {
    failureThreshold: 10,
    recoveryTimeout: 60000,
    successThreshold: 5,
    timeout: 30000,
    name: 'user-repository',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: error => error.name === 'DatabaseConnectionError',
  },
  bulkhead: {
    maxConcurrency: 30,
    queueCapacity: 100,
    timeout: 20000,
    name: 'database-operations',
  },
})
class UserRepository extends IBaseRepository<User> {
  async findById(id: EntityId): Promise<User | null> {
    // Database operations with automatic resilience
    return await this.database.findUserById(id);
  }

  async save(user: User): Promise<void> {
    await this.database.saveUser(user);
  }
}
```

### Domain Services Integration

```typescript
import { DomainService } from '@vytches-ddd/domain-services';
import { ResilienceDecorator } from '@vytches-ddd/resilience';

@DomainService('paymentValidationService')
@ResilienceDecorator({
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    successThreshold: 3,
    timeout: 15000,
    name: 'payment-validation',
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
  },
})
class PaymentValidationService {
  async validatePaymentMethod(
    paymentMethod: PaymentMethod
  ): Promise<ValidationResult> {
    // External validation service call with resilience
    return await this.externalValidationService.validate(paymentMethod);
  }

  async checkFraudRisk(transaction: Transaction): Promise<FraudRiskResult> {
    return await this.fraudDetectionService.analyze(transaction);
  }
}
```

## 🧪 Testing

### Circuit Breaker Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '@vytches-ddd/resilience';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let context: ResilienceContext;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      successThreshold: 2,
      timeout: 5000,
      name: 'test-circuit',
    });
    context = new DefaultResilienceContext();
  });

  describe('normal operation', () => {
    it('should execute successfully when closed', async () => {
      const [error, result] = await safeRun(
        async () => await circuitBreaker.execute(async () => 'success', context)
      );

      expect(error).toBeUndefined();
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should track successful operations', async () => {
      await circuitBreaker.execute(async () => 'success', context);
      await circuitBreaker.execute(async () => 'success', context);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(0);
    });
  });

  describe('failure handling', () => {
    it('should open circuit after failure threshold', async () => {
      // Generate failures to exceed threshold
      for (let i = 0; i < 3; i++) {
        const [error] = await safeRun(
          async () =>
            await circuitBreaker.execute(async () => {
              throw new Error(`Failure ${i + 1}`);
            }, context)
        );
        expect(error).toBeInstanceOf(Error);
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should fail fast when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await safeRun(
          async () =>
            await circuitBreaker.execute(async () => {
              throw new Error('Failure');
            }, context)
        );
      }

      // Should fail fast
      const [openError] = await safeRun(
        async () =>
          await circuitBreaker.execute(
            async () => 'should not execute',
            context
          )
      );

      expect(openError).toBeInstanceOf(CircuitBreakerOpenError);
      expect(openError?.message).toContain(
        "Circuit breaker 'test-circuit' is open"
      );
    });
  });

  describe('recovery', () => {
    it('should transition to half-open after recovery timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await safeRun(
          async () =>
            await circuitBreaker.execute(async () => {
              throw new Error('Failure');
            }, context)
        );
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should attempt recovery
      const [error] = await safeRun(
        async () =>
          await circuitBreaker.execute(async () => 'recovery attempt', context)
      );

      expect(error).toBeUndefined();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });
});
```

### Retry Policy Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { RetryPolicy, MaxRetriesExceededError } from '@vytches-ddd/resilience';

describe('RetryPolicy', () => {
  let retryPolicy: RetryPolicy;
  let context: ResilienceContext;

  beforeEach(() => {
    retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false,
    });
    context = new DefaultResilienceContext();
  });

  describe('successful operations', () => {
    it('should execute successfully on first attempt', async () => {
      const [error, result] = await safeRun(
        async () => await retryPolicy.execute(async () => 'success', context)
      );

      expect(error).toBeUndefined();
      expect(result).toBe('success');
    });

    it('should retry and succeed on second attempt', async () => {
      let attemptCount = 0;

      const [error, result] = await safeRun(
        async () =>
          await retryPolicy.execute(async ctx => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new Error('First attempt fails');
            }
            return 'success on retry';
          }, context)
      );

      expect(error).toBeUndefined();
      expect(result).toBe('success on retry');
      expect(attemptCount).toBe(2);
    });
  });

  describe('failure handling', () => {
    it('should exhaust all retries and fail', async () => {
      const [retryError] = await safeRun(
        async () =>
          await retryPolicy.execute(async () => {
            throw new Error('Persistent failure');
          }, context)
      );

      expect(retryError).toBeInstanceOf(MaxRetriesExceededError);
      expect(retryError?.attempts).toBe(3);
      expect(retryError?.lastError.message).toBe('Persistent failure');
    });

    it('should respect custom retry conditions', async () => {
      const conditionalRetry = new RetryPolicy({
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: false,
        retryableErrors: error => error.name === 'RetryableError',
      });

      const [nonRetryableError] = await safeRun(
        async () =>
          await conditionalRetry.execute(async () => {
            const error = new Error('Non-retryable');
            error.name = 'NonRetryableError';
            throw error;
          }, context)
      );

      expect(nonRetryableError).toBeInstanceOf(Error);
      expect(nonRetryableError?.name).toBe('NonRetryableError');
    });
  });
});
```

## 🎯 Best Practices

### Circuit Breaker Configuration

1. **Set Appropriate Thresholds**: Configure failure thresholds based on your
   system's tolerance
2. **Monitor Circuit State**: Implement monitoring and alerting for circuit
   breaker state changes
3. **Design Fallbacks**: Always have fallback mechanisms when circuits are open
4. **Test Recovery**: Regularly test circuit breaker recovery mechanisms
5. **Use Meaningful Names**: Name circuit breakers descriptively for better
   monitoring

### Retry Strategy

1. **Exponential Backoff**: Use exponential backoff with jitter to prevent
   thundering herd
2. **Limit Retry Attempts**: Set reasonable maximum retry attempts to avoid
   infinite loops
3. **Classify Errors**: Only retry on transient errors, not permanent failures
4. **Monitor Retry Patterns**: Track retry success rates and adjust policies
   accordingly
5. **Consider Business Impact**: Balance retry attempts with business
   requirements

### Bulkhead Design

1. **Resource Isolation**: Separate bulkheads for different resource types
2. **Queue Management**: Configure appropriate queue sizes and timeouts
3. **Priority Handling**: Implement priority queues for critical operations
4. **Capacity Planning**: Size bulkheads based on expected load and resource
   capacity
5. **Graceful Degradation**: Handle bulkhead rejection gracefully

### Observability

1. **Comprehensive Metrics**: Collect detailed metrics for all resilience
   patterns
2. **Real-time Monitoring**: Set up real-time dashboards and alerting
3. **Correlation Tracking**: Use correlation IDs for distributed tracing
4. **Performance Impact**: Monitor the performance impact of resilience patterns
5. **Business Metrics**: Track business-relevant metrics alongside technical
   ones

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run resilience-specific tests
pnpm test:packages:resilience
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
