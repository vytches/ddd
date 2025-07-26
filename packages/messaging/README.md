# @vytches/ddd-messaging

<!-- LLM-METADATA
Package: @vytches/ddd-messaging
Category: Integration
Purpose: Outbox pattern and Saga orchestration for reliable message delivery and long-running business processes
Dependencies: @vytches/ddd-core, @vytches/ddd-events, @vytches/ddd-logging
Complexity: High
DDD Patterns: Outbox Pattern, Saga Pattern, Message Passing, Event-Driven Architecture
Integration Points: @vytches/ddd-events, @vytches/ddd-repositories, @vytches/ddd-logging, @vytches/ddd-di
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-messaging.svg)](https://badge.fury.io/js/%40vytches%2Fddd-messaging)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade messaging patterns with outbox pattern and saga
> orchestration for reliable message delivery**

Complete messaging solution with outbox pattern for reliable message delivery,
saga orchestration for long-running business processes, and comprehensive
middleware support. Designed for distributed systems requiring guaranteed
message delivery and complex workflow orchestration.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Outbox Pattern](#outbox-pattern)
- [Saga Pattern](#saga-pattern)
- [Message Processing](#message-processing)
- [Middleware](#middleware)
- [Error Handling](#error-handling)
- [Monitoring](#monitoring)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-messaging

# yarn
yarn add @vytches/ddd-messaging

# pnpm
pnpm add @vytches/ddd-messaging
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches/ddd-core @vytches/ddd-events @vytches/ddd-logging
```

## ✨ Key Features

### Outbox Pattern

- **Reliable Delivery**: Guaranteed message delivery with transactional outbox
- **Priority Processing**: Configurable message priorities
  (LOW/NORMAL/HIGH/CRITICAL)
- **Delayed Messages**: Support for scheduled message processing
- **Batch Operations**: Efficient bulk message handling

### Saga Orchestration

- **Long-running Processes**: Complete saga orchestration for complex business
  workflows
- **Compensation Logic**: Automatic compensation for failed transactions
- **State Management**: Persistent saga state with optimistic concurrency
  control
- **Correlation Support**: Event correlation for distributed process tracking

### Enterprise Features

- **Middleware Pipeline**: Extensible message processing pipeline
- **Retry Logic**: Configurable retry policies with exponential backoff
- **Circuit Breaker**: Fault tolerance with circuit breaker pattern
- **Monitoring**: Comprehensive metrics and observability

## 🎯 Core Concepts

### Outbox Pattern

The outbox pattern ensures reliable message delivery by storing messages in a
transactional outbox:

```typescript
// Message interface
interface IOutboxMessage<T = unknown> {
  id: string;
  messageType: string;
  payload: T;
  metadata: Record<string, unknown>;
  status: MessageStatus;
  attempts: number;
  createdAt: Date;
  processAfter?: Date;
  priority?: MessagePriority;
  lastError?: string;
}

// Message statuses
enum MessageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

// Priority levels
enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

### Saga Pattern

Sagas orchestrate long-running business processes with compensation support:

```typescript
// Saga interface
interface ISaga {
  readonly sagaId: string;
  readonly sagaType: string;
  readonly status: SagaStatus;
  readonly state: ISagaState;

  handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult>;
  compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult>;
  canHandle(event: IExtendedDomainEvent): boolean;
  getCorrelationData(): Record<string, unknown>;
}

// Saga statuses
enum SagaStatus {
  STARTED = 'STARTED',
  EXECUTING = 'EXECUTING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  CANCELLED = 'CANCELLED',
  TIMED_OUT = 'TIMED_OUT',
}
```

## 🚀 Quick Start

### Basic Outbox Usage

```typescript
import {
  OutboxService,
  OutboxProcessor,
  OutboxMessageFactory,
  MessagePriority,
} from '@vytches/ddd-messaging';

// Create outbox service
const outboxService = new OutboxService({
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 100,
});

// Create and store a message
const messageFactory = new OutboxMessageFactory();
const message = messageFactory.createMessage({
  messageType: 'OrderCreated',
  payload: { orderId: '123', customerId: '456' },
  priority: MessagePriority.HIGH,
  metadata: { source: 'OrderService' },
});

await outboxService.storeMessage(message);

// Process messages
const processor = new OutboxProcessor(outboxService, {
  processingInterval: 5000,
  maxConcurrency: 10,
});

await processor.start();
```

### Basic Saga Usage

```typescript
import {
  BaseSaga,
  SagaOrchestrator,
  InMemorySagaRepository,
  Saga,
  SagaEventHandler,
} from '@vytches/ddd-messaging';

// Define a saga
@Saga('OrderProcessingSaga')
class OrderProcessingSaga extends BaseSaga {
  constructor(sagaId: string, correlationId: string) {
    super(
      {
        sagaId,
        sagaType: 'OrderProcessingSaga',
        status: SagaStatus.STARTED,
        currentStep: 'ProcessPayment',
        stepData: {},
        compensationData: {},
        correlationId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        timeoutAt: undefined,
        version: 1,
      },
      'OrderProcessingSaga'
    );
  }

  @SagaEventHandler('OrderCreated')
  async handleOrderCreated(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Process order creation
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: { orderId: event.payload.orderId },
    });

    return {
      success: true,
      commands: [{ type: 'ProcessPayment', payload: event.payload }],
      events: [{ eventType: 'PaymentRequested', payload: event.payload }],
    };
  }

  @SagaEventHandler('PaymentProcessed')
  async handlePaymentProcessed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Process payment completion
    this.updateState({
      currentStep: 'ReserveInventory',
      stepData: { ...this.state.stepData, paymentId: event.payload.paymentId },
    });

    return {
      success: true,
      commands: [{ type: 'ReserveInventory', payload: event.payload }],
      completesSaga: false,
    };
  }

  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (stepName) {
      case 'ProcessPayment':
        return await this.refundPayment(context);
      case 'ReserveInventory':
        return await this.releaseInventory(context);
      default:
        return { success: true };
    }
  }

  canHandle(event: IExtendedDomainEvent): boolean {
    return ['OrderCreated', 'PaymentProcessed', 'InventoryReserved'].includes(
      event.eventType
    );
  }

  private async refundPayment(
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Implement refund logic
    return { success: true };
  }

  private async releaseInventory(
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Implement inventory release logic
    return { success: true };
  }
}
```

### Saga Orchestration

```typescript
import {
  SagaOrchestrator,
  InMemorySagaRepository,
} from '@vytches/ddd-messaging';

// Setup saga infrastructure
const sagaRepository = new InMemorySagaRepository();
const orchestrator = new SagaOrchestrator(sagaRepository, {
  maxConcurrentExecutions: 50,
  enableMetrics: true,
  enableAutoRetry: true,
});

// Register saga definition
const orderSagaDefinition = {
  sagaType: 'OrderProcessingSaga',
  displayName: 'Order Processing Workflow',
  description: 'Handles complete order processing with compensation',
  startEvents: ['OrderCreated'],
  defaultTimeout: 3600000, // 1 hour
  maxInstances: 100,
  steps: [],
  createInstance: async (event, context) =>
    new OrderProcessingSaga(generateId(), event.correlationId || generateId()),
  getCorrelationData: event => ({ orderId: event.payload.orderId }),
  validate: () => [],
};

orchestrator.registerSagaDefinition(orderSagaDefinition);

// Process events
const event = createOrderCreatedEvent();
const context = {
  correlationId: 'order-123',
  userId: 'user-456',
  metadata: {},
  timestamp: new Date(),
};

const results = await orchestrator.processEvent(event, context);
```

## 📦 Outbox Pattern

### Message Creation

```typescript
import { OutboxMessageFactory, MessagePriority } from '@vytches/ddd-messaging';

const factory = new OutboxMessageFactory();

// Create immediate message
const message = factory.createMessage({
  messageType: 'UserRegistered',
  payload: { userId: '123', email: 'user@example.com' },
  priority: MessagePriority.HIGH,
  metadata: { source: 'UserService' },
});

// Create delayed message
const delayedMessage = factory.createMessage({
  messageType: 'SendWelcomeEmail',
  payload: { userId: '123' },
  processAfter: new Date(Date.now() + 60000), // 1 minute delay
});

// Create batch of messages
const messages = factory.createBatch([
  { messageType: 'Event1', payload: { data: 'test1' } },
  { messageType: 'Event2', payload: { data: 'test2' } },
  { messageType: 'Event3', payload: { data: 'test3' } },
]);
```

### Custom Message Handler

```typescript
import { IOutboxMessageHandler, IOutboxMessage } from '@vytches/ddd-messaging';

class EmailMessageHandler implements IOutboxMessageHandler {
  async handle(message: IOutboxMessage): Promise<void> {
    switch (message.messageType) {
      case 'SendWelcomeEmail':
        await this.sendWelcomeEmail(message.payload);
        break;
      case 'SendPasswordResetEmail':
        await this.sendPasswordResetEmail(message.payload);
        break;
      default:
        throw new Error(`Unknown message type: ${message.messageType}`);
    }
  }

  private async sendWelcomeEmail(payload: any): Promise<void> {
    // Email sending logic
    console.log('Sending welcome email to:', payload.email);
  }

  private async sendPasswordResetEmail(payload: any): Promise<void> {
    // Password reset email logic
    console.log('Sending password reset email to:', payload.email);
  }
}
```

### Processing Configuration

```typescript
import { OutboxProcessor, OutboxService } from '@vytches/ddd-messaging';

const processor = new OutboxProcessor(outboxService, {
  processingInterval: 5000, // Process every 5 seconds
  maxConcurrency: 10, // Process up to 10 messages concurrently
  maxRetries: 3, // Retry failed messages up to 3 times
  retryDelay: 1000, // Wait 1 second between retries
  batchSize: 100, // Process 100 messages per batch
  enableMetrics: true, // Enable performance metrics
  errorHandler: (error, message) => {
    console.error('Message processing failed:', error);
  },
});

await processor.start();
```

## 🎭 Saga Pattern

### Saga Definition

```typescript
import {
  BaseSaga,
  SagaDefinition,
  SagaStep,
  SagaStatus,
} from '@vytches/ddd-messaging';

const orderProcessingDefinition = new SagaDefinition({
  sagaType: 'OrderProcessingSaga',
  displayName: 'Order Processing Workflow',
  description:
    'Comprehensive order processing with payment, inventory, and shipping',
  startEvents: ['OrderCreated'],
  defaultTimeout: 3600000,
  maxInstances: 1000,
  steps: [
    new SagaStep({
      name: 'ProcessPayment',
      displayName: 'Process Payment',
      compensatable: true,
      timeout: 30000,
      triggerEvents: ['OrderCreated'],
      completionEvents: ['PaymentProcessed', 'PaymentFailed'],
    }),
    new SagaStep({
      name: 'ReserveInventory',
      displayName: 'Reserve Inventory',
      compensatable: true,
      timeout: 15000,
      triggerEvents: ['PaymentProcessed'],
      completionEvents: ['InventoryReserved', 'InventoryNotAvailable'],
    }),
    new SagaStep({
      name: 'ArrangeShipping',
      displayName: 'Arrange Shipping',
      compensatable: true,
      timeout: 60000,
      triggerEvents: ['InventoryReserved'],
      completionEvents: ['ShippingArranged', 'ShippingFailed'],
    }),
  ],
});
```

### Saga State Management

```typescript
class OrderProcessingSaga extends BaseSaga {
  protected updateState(updates: Partial<ISagaState>): void {
    this._state = {
      ...this._state,
      ...updates,
      updatedAt: new Date(),
      version: this._state.version + 1,
    };
  }

  protected addCompensationData(
    stepName: string,
    data: Record<string, unknown>
  ): void {
    this._state.compensationData[stepName] = data;
  }

  protected getCompensationData(
    stepName: string
  ): Record<string, unknown> | undefined {
    return this._state.compensationData[stepName];
  }

  protected markCompleted(): void {
    this.updateState({
      status: SagaStatus.COMPLETED,
      currentStep: 'COMPLETED',
    });
  }

  protected markFailed(error: string, step: string): void {
    this.updateState({
      status: SagaStatus.FAILED,
      error: {
        message: error,
        step,
        timestamp: new Date(),
      },
    });
  }
}
```

### Saga Repository

```typescript
import { InMemorySagaRepository } from '@vytches/ddd-messaging';

// Create repository with configuration
const repository = new InMemorySagaRepository({
  enableOptimisticLocking: true,
  enableAuditLog: true,
  retentionPolicy: {
    completedAfterDays: 30,
    compensatedAfterDays: 60,
    failedAfterDays: 90,
  },
});

// Save saga state
await repository.save(sagaInstance);

// Find sagas by correlation
const relatedSagas = await repository.findByCorrelation({
  orderId: 'order-123',
});

// Find timed out sagas
const timedOutSagas = await repository.findTimedOut(new Date());

// Query sagas with criteria
const queryResult = await repository.query({
  sagaType: 'OrderProcessingSaga',
  status: [SagaStatus.STARTED, SagaStatus.EXECUTING],
  createdBetween: { start: yesterday, end: today },
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

## 🔧 Middleware

### Built-in Middleware

```typescript
import {
  RetryMiddleware,
  CircuitBreakerMiddleware,
  PerformanceMonitoringMiddleware,
  SecurityMiddleware,
} from '@vytches/ddd-messaging';

// Retry middleware
const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryCondition: error => error.code === 'TRANSIENT_ERROR',
});

// Circuit breaker middleware
const circuitBreakerMiddleware = new CircuitBreakerMiddleware({
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoredServices: ['payment-service', 'inventory-service'],
});

// Performance monitoring
const performanceMiddleware = new PerformanceMonitoringMiddleware({
  enableMetrics: true,
  slowExecutionThreshold: 5000,
  memoryUsageTracking: true,
});

// Security middleware
const securityMiddleware = new SecurityMiddleware({
  validateCorrelationId: true,
  requireAuthentication: true,
  allowedOrigins: ['order-service', 'payment-service'],
});
```

### Custom Middleware

```typescript
import { BaseSagaMiddleware } from '@vytches/ddd-messaging';

class AuditMiddleware extends BaseSagaMiddleware {
  async execute(
    saga: ISaga,
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext,
    next: () => Promise<ISagaActionResult>
  ): Promise<ISagaActionResult> {
    // Pre-execution audit
    await this.auditService.logSagaExecution({
      sagaId: saga.sagaId,
      sagaType: saga.sagaType,
      eventType: event.eventType,
      correlationId: context.correlationId,
      timestamp: new Date(),
    });

    try {
      const result = await next();

      // Post-execution audit
      await this.auditService.logSagaResult({
        sagaId: saga.sagaId,
        success: result.success,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // Error audit
      await this.auditService.logSagaError({
        sagaId: saga.sagaId,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }
}
```

## 🏥 Error Handling

### Saga Error Handling

```typescript
import {
  SagaError,
  SagaExecutionError,
  SagaCompensationError,
} from '@vytches/ddd-messaging';

class OrderProcessingSaga extends BaseSaga {
  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      return await this.processEvent(event, context);
    } catch (error) {
      if (error instanceof SagaExecutionError) {
        // Handle execution errors
        this.markFailed(error.message, this.state.currentStep);

        if (error.requiresCompensation) {
          return await this.startCompensation(context);
        }
      }

      throw error;
    }
  }

  private async startCompensation(
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({ status: SagaStatus.COMPENSATING });

    // Execute compensation in reverse order
    const completedSteps = this.getCompletedSteps();

    for (const step of completedSteps.reverse()) {
      try {
        await this.compensateStep(step, context);
      } catch (compensationError) {
        throw new SagaCompensationError(
          `Compensation failed for step ${step}`,
          { step, originalError: compensationError }
        );
      }
    }

    this.updateState({ status: SagaStatus.COMPENSATED });

    return { success: true };
  }
}
```

### Outbox Error Handling

```typescript
import { OutboxProcessor } from '@vytches/ddd-messaging';

const processor = new OutboxProcessor(outboxService, {
  errorHandler: async (error, message) => {
    console.error(`Failed to process message ${message.id}:`, error);

    // Custom error handling logic
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Reschedule message for later
      message.processAfter = new Date(Date.now() + 60000);
      await outboxService.updateMessage(message);
    } else if (error.code === 'PERMANENT_FAILURE') {
      // Move to dead letter queue
      await deadLetterService.store(message, error);
    }
  },
  deadLetterHandler: async (message, error) => {
    // Handle messages that exceed retry limit
    await deadLetterService.store(message, error);
    await notificationService.notifyAdmins({
      type: 'DEAD_LETTER_MESSAGE',
      messageId: message.id,
      error: error.message,
    });
  },
});
```

## 📊 Monitoring

### Saga Metrics

```typescript
import { SagaOrchestrator } from '@vytches/ddd-messaging';

const orchestrator = new SagaOrchestrator(repository, {
  enableMetrics: true,
  metricsConfig: {
    collectExecutionTimes: true,
    collectMemoryUsage: true,
    collectCorrelationStats: true,
  },
});

// Get comprehensive statistics
const stats = await orchestrator.getStatistics();
console.log('Saga Statistics:', {
  totalInstances: stats.totalInstances,
  activeInstances: stats.activeInstances,
  completedInstances: stats.completedInstances,
  failedInstances: stats.failedInstances,
  averageExecutionTime: stats.averageExecutionTime,
  memoryUsage: stats.memoryUsage,
});

// Get metrics by saga type
const typeMetrics = await orchestrator.getMetricsBySagaType(
  'OrderProcessingSaga'
);
console.log('Order Processing Metrics:', {
  instanceCount: typeMetrics.instanceCount,
  successRate: typeMetrics.successRate,
  averageSteps: typeMetrics.averageSteps,
  compensationRate: typeMetrics.compensationRate,
});
```

### Performance Monitoring

```typescript
import { PerformanceMonitoringMiddleware } from '@vytches/ddd-messaging';

const performanceMiddleware = new PerformanceMonitoringMiddleware({
  enableMetrics: true,
  slowExecutionThreshold: 5000,
  memoryUsageTracking: true,
  customMetrics: {
    trackCorrelationCounts: true,
    trackEventProcessingTimes: true,
    trackCompensationRates: true,
  },
});

// Get performance metrics
const metrics = performanceMiddleware.getMetrics();
console.log('Performance Metrics:', {
  totalExecutions: metrics.totalExecutions,
  averageExecutionTime: metrics.averageExecutionTime,
  slowExecutions: metrics.slowExecutions,
  memoryUsage: metrics.memoryUsage,
  errorRate: metrics.errorRate,
});
```

## 🔗 Integration Patterns

### Event-Driven Integration

```typescript
import { EventBusOutboxHandler } from '@vytches/ddd-messaging';
import { UnifiedEventBus } from '@vytches/ddd-events';

// Integrate outbox with event bus
const eventBus = new UnifiedEventBus();
const outboxHandler = new EventBusOutboxHandler(eventBus);

// Register handler for specific message types
outboxHandler.registerHandler('DomainEvent', async message => {
  const domainEvent = message.payload;
  await eventBus.publish(domainEvent);
});

// Process outbox messages through event bus
const processor = new OutboxProcessor(outboxService, {
  messageHandler: outboxHandler,
});
```

### Repository Integration

```typescript
import { OutboxService } from '@vytches/ddd-messaging';
import { IBaseRepository } from '@vytches/ddd-repositories';

class OrderRepository extends IBaseRepository<OrderAggregate> {
  constructor(
    private outboxService: OutboxService,
    eventDispatcher: IEventDispatcher
  ) {
    super(eventDispatcher);
  }

  async save(order: OrderAggregate): Promise<void> {
    // Save aggregate
    await super.save(order);

    // Store events in outbox for reliable delivery
    const events = order.getUncommittedEvents();

    for (const event of events) {
      const message = OutboxMessageFactory.fromDomainEvent(event);
      await this.outboxService.storeMessage(message);
    }
  }
}
```

### CQRS Integration

```typescript
import { CommandHandler, QueryHandler } from '@vytches/ddd-cqrs';
import { SagaOrchestrator } from '@vytches/ddd-messaging';

@CommandHandler(ProcessOrderCommand)
class ProcessOrderHandler {
  constructor(private sagaOrchestrator: SagaOrchestrator) {}

  async execute(command: ProcessOrderCommand): Promise<void> {
    // Create order processing saga
    const event = new OrderCreatedEvent(command.orderData);
    const context = {
      correlationId: command.correlationId,
      userId: command.userId,
      metadata: { source: 'OrderService' },
      timestamp: new Date(),
    };

    await this.sagaOrchestrator.processEvent(event, context);
  }
}
```

## 🧪 Testing

### Saga Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { OrderProcessingSaga } from '../src/order-processing-saga';
import { SagaStatus } from '@vytches/ddd-messaging';

describe('OrderProcessingSaga', () => {
  let saga: OrderProcessingSaga;
  let context: ISagaExecutionContext;

  beforeEach(() => {
    saga = new OrderProcessingSaga('saga-123', 'correlation-456');
    context = {
      correlationId: 'correlation-456',
      userId: 'user-123',
      metadata: {},
      timestamp: new Date(),
    };
  });

  describe('handleOrderCreated', () => {
    it('should transition to payment processing', async () => {
      const event = createOrderCreatedEvent();

      const [error, result] = await safeRun(
        async () => await saga.handleEvent(event, context)
      );

      expect(error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(saga.state.currentStep).toBe('ProcessPayment');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('ProcessPayment');
    });

    it('should handle invalid event gracefully', async () => {
      const invalidEvent = createInvalidEvent();

      const [error] = await safeRun(
        async () => await saga.handleEvent(invalidEvent, context)
      );

      expect(error).toBeInstanceOf(SagaEventProcessingError);
      expect(error?.message).toContain('Cannot handle event');
    });
  });

  describe('compensation', () => {
    it('should execute compensation for completed steps', async () => {
      // Setup saga with completed payment step
      saga.updateState({
        currentStep: 'ReserveInventory',
        stepData: { paymentId: 'payment-123' },
        compensationData: {
          ProcessPayment: { paymentId: 'payment-123' },
        },
      });

      const [error, result] = await safeRun(
        async () => await saga.compensate('ProcessPayment', context)
      );

      expect(error).toBeUndefined();
      expect(result.success).toBe(true);
    });
  });
});
```

### Outbox Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  OutboxService,
  OutboxMessageFactory,
  MessageStatus,
} from '@vytches/ddd-messaging';

describe('OutboxService', () => {
  let service: OutboxService;
  let factory: OutboxMessageFactory;

  beforeEach(() => {
    service = new OutboxService();
    factory = new OutboxMessageFactory();
  });

  describe('storeMessage', () => {
    it('should store message successfully', async () => {
      const message = factory.createMessage({
        messageType: 'TestEvent',
        payload: { data: 'test' },
      });

      const [error] = await safeRun(
        async () => await service.storeMessage(message)
      );

      expect(error).toBeUndefined();

      const stored = await service.getMessageById(message.id);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe(MessageStatus.PENDING);
    });

    it('should handle duplicate message IDs', async () => {
      const message = factory.createMessage({
        messageType: 'TestEvent',
        payload: { data: 'test' },
      });

      await service.storeMessage(message);

      const [duplicateError] = await safeRun(
        async () => await service.storeMessage(message)
      );

      expect(duplicateError).toBeInstanceOf(OutboxError);
      expect(duplicateError?.message).toContain('already exists');
    });
  });

  describe('processMessages', () => {
    it('should process pending messages', async () => {
      const messages = [
        factory.createMessage({
          messageType: 'Event1',
          payload: { data: '1' },
        }),
        factory.createMessage({
          messageType: 'Event2',
          payload: { data: '2' },
        }),
      ];

      for (const message of messages) {
        await service.storeMessage(message);
      }

      const processed = await service.processPendingMessages();
      expect(processed).toBe(2);
    });
  });
});
```

## 🎯 Best Practices

### Saga Design

1. **Keep Sagas Focused**: Each saga should handle a single business process
2. **Design for Compensation**: Always plan compensation logic during design
3. **Use Correlation IDs**: Properly correlate events and commands
4. **Handle Timeouts**: Set appropriate timeouts for long-running processes
5. **Monitor Saga Health**: Implement comprehensive monitoring and alerting

### Message Design

1. **Idempotent Operations**: Design message handlers to be idempotent
2. **Small Message Payloads**: Keep message payloads small and focused
3. **Structured Metadata**: Use consistent metadata structure
4. **Priority Classification**: Properly classify message priorities
5. **Error Context**: Include sufficient context for error handling

### Performance Optimization

1. **Batch Processing**: Process messages in batches when possible
2. **Connection Pooling**: Use connection pooling for database operations
3. **Async Processing**: Leverage async processing for better throughput
4. **Resource Management**: Properly manage resources and connections
5. **Monitoring**: Continuously monitor performance metrics

### Error Handling

1. **Graceful Degradation**: Design for graceful failure handling
2. **Retry Logic**: Implement appropriate retry strategies
3. **Dead Letter Queues**: Use dead letter queues for failed messages
4. **Compensation Patterns**: Implement proper compensation patterns
5. **Alerting**: Set up proper alerting for critical failures

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run messaging-specific tests
pnpm test:packages:messaging
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
