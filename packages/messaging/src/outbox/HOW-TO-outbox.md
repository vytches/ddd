# Outbox Pattern in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Outbox Pattern
- **Category**: Infrastructure Pattern
- **Purpose**: Ensure reliable message publishing in distributed systems
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What is the Outbox Pattern?

The Outbox Pattern ensures atomicity between database transactions and message publishing. Instead of directly publishing messages after database operations, messages are stored in an "outbox" table within the same transaction. A separate process then publishes these messages asynchronously.

**Core Benefit**: Prevents data inconsistency when database operations succeed but message publishing fails.

### Primary Use Cases

1. **Reliable Event Publishing**: Guarantee domain events are not lost
2. **Integration Events**: Safely communicate changes to external systems
3. **Asynchronous Communication**: Decouple message publishing from business transactions
4. **System Resilience**: Handle temporary failures in message infrastructure

## Core Components

### 1. IOutboxMessage Interface

```typescript
interface IOutboxMessage<T = any> {
  id: string;                    // Unique identifier
  messageType: string;           // Type for routing/handling
  payload: T;                    // Message content
  metadata: Record<string, any>; // Additional context
  status: MessageStatus;         // Processing state
  attempts: number;              // Retry counter
  createdAt: Date;              // Creation timestamp
  processAfter?: Date;          // Delayed processing
  priority?: MessagePriority;    // Processing order
  lastError?: string;           // Error information
}
```

### 2. Supporting Enums

```typescript
enum MessageStatus {
  PENDING = 'PENDING',       // Awaiting processing
  PROCESSING = 'PROCESSING', // Currently being processed
  PROCESSED = 'PROCESSED',   // Successfully completed
  FAILED = 'FAILED'         // Processing failed
}

enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### 3. OutboxMessageFactory

Factory for creating outbox messages with common patterns:

```typescript
class OutboxMessageFactory {
  static createMessage<T>(messageType: string, payload: T, options?: OutboxMessageOptions): IOutboxMessage<T>;
  static createDelayedMessage<T>(messageType: string, payload: T, delayMs: number, options?: OutboxMessageOptions): IOutboxMessage<T>;
  static createHighPriorityMessage<T>(messageType: string, payload: T, options?: OutboxMessageOptions): IOutboxMessage<T>;
  static createFromIntegrationEvent<T>(event: IntegrationEvent, options?: OutboxMessageOptions): IOutboxMessage<T>;
}
```

### 4. IOutboxRepository

Abstract interface for outbox persistence:

```typescript
abstract class IOutboxRepository {
  // Core operations
  abstract saveMessage<T>(message: IOutboxMessage<T>): Promise<string>;
  abstract saveBatch<T>(messages: IOutboxMessage<T>[]): Promise<string[]>;
  
  // Retrieval
  abstract getUnprocessedMessages(limit?: number, priorityOrder?: MessagePriority[]): Promise<IOutboxMessage[]>;
  abstract getById(id: string): Promise<IOutboxMessage | null>;
  
  // Status management
  abstract updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void>;
  abstract incrementAttempt(id: string): Promise<number>;
  
  // Maintenance
  abstract deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number>;
}
```

## Basic Usage Pattern

### 1. Saving Messages with Domain Operations

```typescript
class OrderService {
  async placeOrder(order: Order): Promise<void> {
    await this.unitOfWork.transaction(async () => {
      // Save domain changes
      await this.orderRepository.save(order);
      
      // Create outbox message in same transaction
      const outboxMessage = OutboxMessageFactory.createMessage(
        'OrderPlaced',
        { orderId: order.id, customerId: order.customerId, totalAmount: order.totalAmount }
      );
      
      await this.outboxRepository.saveMessage(outboxMessage);
    });
  }
}
```

### 2. Processing Outbox Messages

```typescript
class OutboxProcessor {
  async processMessages(): Promise<void> {
    const messages = await this.outboxRepository.getUnprocessedMessages(10);
    
    for (const message of messages) {
      try {
        await this.outboxRepository.updateStatus(message.id, MessageStatus.PROCESSING);
        await this.eventBus.publish(message.messageType, message.payload);
        await this.outboxRepository.updateStatus(message.id, MessageStatus.PROCESSED);
      } catch (error) {
        await this.handleFailure(message, error);
      }
    }
  }
  
  private async handleFailure(message: IOutboxMessage, error: Error): Promise<void> {
    const attempts = await this.outboxRepository.incrementAttempt(message.id);
    
    if (attempts >= 3) {
      await this.outboxRepository.updateStatus(message.id, MessageStatus.FAILED, error);
    } else {
      // Return to pending for retry
      await this.outboxRepository.updateStatus(message.id, MessageStatus.PENDING);
    }
  }
}
```

## Key Concepts

### Message States and Transitions

- **PENDING → PROCESSING**: Message picked up for processing
- **PROCESSING → PROCESSED**: Successful completion
- **PROCESSING → FAILED**: Final failure after retries
- **FAILED/PENDING → PROCESSING**: Retry attempt

### Priority Processing

Messages are processed based on priority (CRITICAL → HIGH → NORMAL → LOW). Critical business events (payments, security) should use higher priorities.

### Delayed Processing

Messages can be scheduled for future processing using `processAfter` field. Useful for reminders, scheduled tasks, or implementing delays between retries.

### Batch Operations

Multiple messages can be saved in a single transaction using `saveBatch()` for related events that must be published together.

## Best Practices

### 1. Transaction Boundaries

Always save outbox messages within the same transaction as domain changes:

```typescript
// Correct
await transaction(async () => {
  await saveOrder(order);
  await saveOutboxMessage(message);
});
```

### 2. Message Design

Messages should be self-contained with all necessary information. Avoid designs requiring additional lookups.

### 3. Idempotency

Ensure message handlers are idempotent - processing the same message multiple times should have the same effect as processing it once.

### 4. Error Handling

Implement retry logic with exponential backoff for transient errors. Distinguish between retriable and permanent failures.

### 5. Monitoring

Track key metrics:

- Pending messages count
- Processing time
- Failure rate
- Message age

## Performance Considerations

1. **Database Indexes**: Create indexes on status, priority, and processAfter fields
2. **Batch Processing**: Process messages in batches for better throughput
3. **Concurrent Processing**: Use database row locking (e.g., `FOR UPDATE SKIP LOCKED`)
4. **Cleanup**: Regularly delete old processed messages

## Integration with DomainTS

The Outbox Pattern integrates seamlessly with other DomainTS components:

- **Unit of Work**: Ensures messages are saved in the same transaction
- **Domain Events**: Automatically converted to outbox messages
- **Event Bus**: Publishes messages after successful processing
- **Repository Pattern**: Consistent data access patterns

## Conclusion

The Outbox Pattern provides reliable message publishing with:

- **Atomicity**: Database and message operations in single transaction
- **Reliability**: Guaranteed delivery with retry mechanisms
- **Flexibility**: Support for priorities, delays, and batch operations
- **Resilience**: Handles failures gracefully with configurable retries

This pattern is essential for maintaining consistency in distributed systems while ensuring reliable communication between services.
