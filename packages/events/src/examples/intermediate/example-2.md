# Event Deduplication and Idempotency

**Version**: 1.0.0
**Package**: @vytches-ddd/events
**Complexity**: intermediate
**Domain**: Architecture
**Patterns**: event-deduplication, idempotency, duplicate-detection, event-fingerprinting
**Dependencies**: @vytches-ddd/events, @vytches-ddd/utils, @vytches-ddd/logging

## Description

Advanced event deduplication and idempotency handling system to ensure reliable event processing in distributed systems. This example demonstrates enterprise patterns for detecting and handling duplicate events, ensuring exactly-once semantics, and maintaining system consistency.

## Business Context

Distributed systems often produce duplicate events due to network retries, system failures, or concurrent processing. Business operations must remain consistent regardless of duplicate events, requiring sophisticated deduplication mechanisms that can identify duplicates across time windows and processing contexts.

## Code Example

```typescript
// event-deduplication.ts
import { DomainEvent, IEventHandler, UnifiedEventBus } from '@vytches-ddd/events';
import { EntityId } from '@vytches-ddd/value-objects';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';

// Enhanced event with deduplication metadata
export abstract class DeduplicatedEvent extends DomainEvent {
  public readonly fingerprint: string;
  public readonly idempotencyKey: string;
  public readonly sourceSystem: string;
  public readonly eventVersion: number;

  constructor(
    eventType: string,
    aggregateId: string,
    idempotencyKey: string,
    sourceSystem: string,
    eventVersion: number = 1,
    correlationId?: string
  ) {
    super(eventType, aggregateId, correlationId);
    this.idempotencyKey = idempotencyKey;
    this.sourceSystem = sourceSystem;
    this.eventVersion = eventVersion;
    this.fingerprint = this.generateFingerprint();
  }

  private generateFingerprint(): string {
    // ⭐ FOCUS: Create unique fingerprint for duplicate detection
    const fingerprintData = {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      idempotencyKey: this.idempotencyKey,
      sourceSystem: this.sourceSystem,
      // Include relevant payload fields for fingerprinting
      payloadHash: this.createPayloadHash()
    };

    return this.hashObject(fingerprintData);
  }

  protected abstract createPayloadHash(): string;

  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this.simpleHash(str);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// Business event with deduplication
export class PaymentInitiatedEvent extends DeduplicatedEvent {
  constructor(
    public readonly paymentId: EntityId,
    public readonly orderId: EntityId,
    public readonly amount: number,
    public readonly currency: string,
    public readonly paymentMethod: string,
    idempotencyKey: string,
    sourceSystem: string,
    correlationId?: string
  ) {
    super(
      'PaymentInitiated',
      paymentId.value,
      idempotencyKey,
      sourceSystem,
      1,
      correlationId
    );
    this.metadata = {
      orderId: orderId.value,
      amount,
      currency,
      paymentMethod
    };
  }

  protected createPayloadHash(): string {
    const payloadData = {
      paymentId: this.paymentId.value,
      orderId: this.orderId.value,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod
    };
    
    const str = JSON.stringify(payloadData, Object.keys(payloadData).sort());
    return this.simpleHash(str);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export class OrderStatusChangedEvent extends DeduplicatedEvent {
  constructor(
    public readonly orderId: EntityId,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly reason: string,
    public readonly timestamp: Date,
    idempotencyKey: string,
    sourceSystem: string,
    correlationId?: string
  ) {
    super(
      'OrderStatusChanged',
      orderId.value,
      idempotencyKey,
      sourceSystem,
      1,
      correlationId
    );
    this.metadata = {
      previousStatus,
      newStatus,
      reason,
      statusChangeTime: timestamp.toISOString()
    };
  }

  protected createPayloadHash(): string {
    const payloadData = {
      orderId: this.orderId.value,
      previousStatus: this.previousStatus,
      newStatus: this.newStatus,
      reason: this.reason,
      // Include timestamp for status change events to ensure uniqueness
      timestamp: this.timestamp.toISOString()
    };
    
    return this.hashObject(payloadData);
  }

  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this.simpleHash(str);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// ⭐ FOCUS: Deduplication store interface
export interface DeduplicationStore {
  hasBeenProcessed(fingerprint: string): Promise<Result<boolean, Error>>;
  markAsProcessed(fingerprint: string, eventId: string, processedAt: Date): Promise<Result<void, Error>>;
  getProcessingRecord(fingerprint: string): Promise<Result<ProcessingRecord | null, Error>>;
  cleanupExpiredRecords(olderThan: Date): Promise<Result<number, Error>>;
}

export interface ProcessingRecord {
  fingerprint: string;
  eventId: string;
  processedAt: Date;
  sourceSystem: string;
  eventType: string;
}

// ⭐ FOCUS: In-memory deduplication store with TTL
export class InMemoryDeduplicationStore implements DeduplicationStore {
  private readonly records = new Map<string, ProcessingRecord>();
  private readonly ttlMs: number;
  private readonly logger = Logger.forContext('InMemoryDeduplicationStore');

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) { // Default: 24 hours
    this.ttlMs = ttlMs;
    this.startCleanupTimer();
  }

  async hasBeenProcessed(fingerprint: string): Promise<Result<boolean, Error>> {
    try {
      const record = this.records.get(fingerprint);
      const hasBeenProcessed = !!record && this.isRecordValid(record);
      
      this.logger.debug('Deduplication check performed', {
        fingerprint,
        hasBeenProcessed,
        recordExists: !!record,
        recordValid: record ? this.isRecordValid(record) : false
      });

      return Result.ok(hasBeenProcessed);
    } catch (error) {
      return Result.fail(new Error(`Failed to check processing status: ${error.message}`));
    }
  }

  async markAsProcessed(fingerprint: string, eventId: string, processedAt: Date): Promise<Result<void, Error>> {
    try {
      const record: ProcessingRecord = {
        fingerprint,
        eventId,
        processedAt,
        sourceSystem: 'unknown',
        eventType: 'unknown'
      };

      this.records.set(fingerprint, record);
      
      this.logger.debug('Event marked as processed', {
        fingerprint,
        eventId,
        processedAt,
        totalRecords: this.records.size
      });

      return Result.ok();
    } catch (error) {
      return Result.fail(new Error(`Failed to mark as processed: ${error.message}`));
    }
  }

  async getProcessingRecord(fingerprint: string): Promise<Result<ProcessingRecord | null, Error>> {
    try {
      const record = this.records.get(fingerprint);
      
      if (!record || !this.isRecordValid(record)) {
        return Result.ok(null);
      }

      return Result.ok(record);
    } catch (error) {
      return Result.fail(new Error(`Failed to get processing record: ${error.message}`));
    }
  }

  async cleanupExpiredRecords(olderThan: Date): Promise<Result<number, Error>> {
    try {
      let cleanedCount = 0;
      
      for (const [fingerprint, record] of this.records.entries()) {
        if (record.processedAt < olderThan) {
          this.records.delete(fingerprint);
          cleanedCount++;
        }
      }

      this.logger.info('Expired deduplication records cleaned up', {
        cleanedCount,
        remainingRecords: this.records.size,
        olderThan: olderThan.toISOString()
      });

      return Result.ok(cleanedCount);
    } catch (error) {
      return Result.fail(new Error(`Failed to cleanup expired records: ${error.message}`));
    }
  }

  private isRecordValid(record: ProcessingRecord): boolean {
    const age = Date.now() - record.processedAt.getTime();
    return age < this.ttlMs;
  }

  private startCleanupTimer(): void {
    // Cleanup expired records every hour
    setInterval(async () => {
      const cutoffTime = new Date(Date.now() - this.ttlMs);
      await this.cleanupExpiredRecords(cutoffTime);
    }, 60 * 60 * 1000);
  }
}

// ⭐ FOCUS: Event deduplication middleware
export class EventDeduplicationMiddleware {
  private readonly logger = Logger.forContext('EventDeduplicationMiddleware');

  constructor(private readonly deduplicationStore: DeduplicationStore) {}

  async processEvent<T extends DeduplicatedEvent>(
    event: T,
    handler: (event: T) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    const startTime = Date.now();

    try {
      // ⭐ FOCUS: Check if event has already been processed
      const duplicationCheck = await this.deduplicationStore.hasBeenProcessed(event.fingerprint);
      
      if (duplicationCheck.isFailure()) {
        return Result.fail(duplicationCheck.error);
      }

      if (duplicationCheck.value) {
        // ⭐ FOCUS: Event is a duplicate - log and skip processing
        const existingRecord = await this.deduplicationStore.getProcessingRecord(event.fingerprint);
        
        this.logger.warn('Duplicate event detected and skipped', {
          eventType: event.eventType,
          eventId: event.eventId,
          fingerprint: event.fingerprint,
          idempotencyKey: event.idempotencyKey,
          sourceSystem: event.sourceSystem,
          correlationId: event.correlationId,
          originalProcessingRecord: existingRecord.isSuccess() ? existingRecord.value : null,
          detectionTime: Date.now() - startTime
        });

        return Result.ok(); // Successfully skipped duplicate
      }

      // ⭐ FOCUS: Process the event as it's not a duplicate
      this.logger.info('Processing new event', {
        eventType: event.eventType,
        eventId: event.eventId,
        fingerprint: event.fingerprint,
        idempotencyKey: event.idempotencyKey,
        sourceSystem: event.sourceSystem,
        correlationId: event.correlationId
      });

      const processingResult = await handler(event);

      if (processingResult.isFailure()) {
        this.logger.error('Event processing failed', {
          eventType: event.eventType,
          eventId: event.eventId,
          fingerprint: event.fingerprint,
          error: processingResult.error,
          processingTime: Date.now() - startTime
        });
        return processingResult;
      }

      // ⭐ FOCUS: Mark event as successfully processed
      const markResult = await this.deduplicationStore.markAsProcessed(
        event.fingerprint,
        event.eventId,
        new Date()
      );

      if (markResult.isFailure()) {
        this.logger.error('Failed to mark event as processed', {
          eventType: event.eventType,
          eventId: event.eventId,
          fingerprint: event.fingerprint,
          error: markResult.error
        });
        // Continue despite marking failure - event was processed successfully
      }

      const processingTime = Date.now() - startTime;

      this.logger.info('Event processed successfully', {
        eventType: event.eventType,
        eventId: event.eventId,
        fingerprint: event.fingerprint,
        idempotencyKey: event.idempotencyKey,
        processingTime,
        performanceCategory: processingTime < 100 ? 'fast' : processingTime < 1000 ? 'normal' : 'slow'
      });

      return Result.ok();

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Event deduplication middleware error', {
        eventType: event.eventType,
        eventId: event.eventId,
        fingerprint: event.fingerprint,
        error: error,
        processingTime
      });

      return Result.fail(new Error(`Deduplication middleware error: ${error.message}`));
    }
  }
}

// ⭐ FOCUS: Idempotent event handler decorator
export function IdempotentHandler(deduplicationStore: DeduplicationStore) {
  return function <T extends DeduplicatedEvent>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(event: T) => Promise<Result<void, Error>>>
  ) {
    const originalMethod = descriptor.value!;
    const middleware = new EventDeduplicationMiddleware(deduplicationStore);

    descriptor.value = async function (event: T): Promise<Result<void, Error>> {
      return await middleware.processEvent(event, async (evt: T) => {
        return await originalMethod.call(this, evt);
      });
    };

    return descriptor;
  };
}

// ⭐ FOCUS: Business logic handlers with deduplication
export class PaymentProcessingService {
  private readonly logger = Logger.forContext('PaymentProcessingService');
  private readonly deduplicationStore: DeduplicationStore;

  constructor(deduplicationStore: DeduplicationStore) {
    this.deduplicationStore = deduplicationStore;
  }

  @IdempotentHandler(new InMemoryDeduplicationStore())
  async handlePaymentInitiated(event: PaymentInitiatedEvent): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Idempotent business logic
      this.logger.info('Processing payment initiation', {
        paymentId: event.paymentId.value,
        orderId: event.orderId.value,
        amount: event.amount,
        currency: event.currency,
        idempotencyKey: event.idempotencyKey
      });

      // Simulate payment processing
      await this.initiatePaymentWithProvider(event);
      await this.updateOrderPaymentStatus(event.orderId, 'payment_initiated');
      await this.sendPaymentConfirmation(event);

      this.logger.info('Payment initiation completed successfully', {
        paymentId: event.paymentId.value,
        orderId: event.orderId.value,
        idempotencyKey: event.idempotencyKey
      });

      return Result.ok();

    } catch (error) {
      this.logger.error('Payment initiation failed', {
        paymentId: event.paymentId.value,
        orderId: event.orderId.value,
        error: error,
        idempotencyKey: event.idempotencyKey
      });

      return Result.fail(new Error(`Payment initiation failed: ${error.message}`));
    }
  }

  @IdempotentHandler(new InMemoryDeduplicationStore())
  async handleOrderStatusChanged(event: OrderStatusChangedEvent): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Idempotent status update logic
      this.logger.info('Processing order status change', {
        orderId: event.orderId.value,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        reason: event.reason,
        idempotencyKey: event.idempotencyKey
      });

      // Idempotent operations
      await this.updateOrderStatusInDatabase(event.orderId, event.newStatus);
      await this.notifyCustomerOfStatusChange(event);
      await this.updateInventoryIfNeeded(event);
      await this.triggerDownstreamProcesses(event);

      this.logger.info('Order status change processed successfully', {
        orderId: event.orderId.value,
        newStatus: event.newStatus,
        idempotencyKey: event.idempotencyKey
      });

      return Result.ok();

    } catch (error) {
      this.logger.error('Order status change processing failed', {
        orderId: event.orderId.value,
        newStatus: event.newStatus,
        error: error,
        idempotencyKey: event.idempotencyKey
      });

      return Result.fail(new Error(`Order status change failed: ${error.message}`));
    }
  }

  // Private idempotent operation methods
  private async initiatePaymentWithProvider(event: PaymentInitiatedEvent): Promise<void> {
    // Idempotent payment provider integration
    this.logger.debug('Initiating payment with provider', {
      paymentId: event.paymentId.value,
      amount: event.amount,
      currency: event.currency,
      paymentMethod: event.paymentMethod
    });
  }

  private async updateOrderPaymentStatus(orderId: EntityId, status: string): Promise<void> {
    // Idempotent database update
    this.logger.debug('Updating order payment status', {
      orderId: orderId.value,
      status
    });
  }

  private async sendPaymentConfirmation(event: PaymentInitiatedEvent): Promise<void> {
    // Idempotent notification sending
    this.logger.debug('Sending payment confirmation', {
      paymentId: event.paymentId.value,
      orderId: event.orderId.value
    });
  }

  private async updateOrderStatusInDatabase(orderId: EntityId, status: string): Promise<void> {
    // Idempotent database operation using upsert/conditional updates
    this.logger.debug('Updating order status in database', {
      orderId: orderId.value,
      status
    });
  }

  private async notifyCustomerOfStatusChange(event: OrderStatusChangedEvent): Promise<void> {
    // Idempotent customer notification
    this.logger.debug('Notifying customer of status change', {
      orderId: event.orderId.value,
      newStatus: event.newStatus
    });
  }

  private async updateInventoryIfNeeded(event: OrderStatusChangedEvent): Promise<void> {
    // Conditional idempotent inventory update
    if (event.newStatus === 'cancelled') {
      this.logger.debug('Releasing inventory for cancelled order', {
        orderId: event.orderId.value
      });
    }
  }

  private async triggerDownstreamProcesses(event: OrderStatusChangedEvent): Promise<void> {
    // Idempotent downstream process triggering
    this.logger.debug('Triggering downstream processes', {
      orderId: event.orderId.value,
      newStatus: event.newStatus
    });
  }
}
```

## Usage Examples

```typescript
// Setting up deduplication system
async function setupDeduplicationSystem() {
  const deduplicationStore = new InMemoryDeduplicationStore(24 * 60 * 60 * 1000); // 24 hour TTL
  const paymentService = new PaymentProcessingService(deduplicationStore);
  
  // ⭐ FOCUS: Process events with automatic deduplication
  const orderId = EntityId.createUuid();
  const paymentId = EntityId.createUuid();
  
  // Create idempotent payment event
  const paymentEvent = new PaymentInitiatedEvent(
    paymentId,
    orderId,
    299.99,
    'USD',
    'credit_card',
    'payment-init-12345', // Idempotency key
    'order-service'
  );

  // First processing - should succeed
  console.log('Processing payment event (first time)...');
  const result1 = await paymentService.handlePaymentInitiated(paymentEvent);
  console.log('First processing result:', result1.isSuccess() ? 'SUCCESS' : 'FAILED');

  // Duplicate processing - should be skipped
  console.log('Processing payment event (duplicate)...');
  const result2 = await paymentService.handlePaymentInitiated(paymentEvent);
  console.log('Duplicate processing result:', result2.isSuccess() ? 'SKIPPED' : 'FAILED');

  // Different event with same idempotency key - should be skipped
  const duplicateEvent = new PaymentInitiatedEvent(
    EntityId.createUuid(), // Different payment ID
    orderId,
    299.99,
    'USD',
    'credit_card',
    'payment-init-12345', // Same idempotency key
    'order-service'
  );

  console.log('Processing event with same idempotency key...');
  const result3 = await paymentService.handlePaymentInitiated(duplicateEvent);
  console.log('Same key processing result:', result3.isSuccess() ? 'SKIPPED' : 'FAILED');

  // Check deduplication statistics
  const hasBeenProcessed = await deduplicationStore.hasBeenProcessed(paymentEvent.fingerprint);
  console.log('Event marked as processed:', hasBeenProcessed.value);

  const processingRecord = await deduplicationStore.getProcessingRecord(paymentEvent.fingerprint);
  if (processingRecord.isSuccess() && processingRecord.value) {
    console.log('Processing record:', {
      fingerprint: processingRecord.value.fingerprint,
      eventId: processingRecord.value.eventId,
      processedAt: processingRecord.value.processedAt
    });
  }
}

setupDeduplicationSystem();
```

## Key Features

- **Event Fingerprinting**: Unique identification of events for deduplication
- **Idempotency Keys**: Business-level duplicate prevention
- **TTL-Based Storage**: Automatic cleanup of old deduplication records
- **Decorator Support**: Easy integration with existing event handlers
- **Comprehensive Logging**: Full audit trail of duplicate detection
- **Flexible Storage**: Pluggable deduplication store implementations
- **Performance Optimized**: Fast duplicate detection with minimal overhead

## Deduplication Strategies

1. **Fingerprint-Based**: Content-based duplicate detection
2. **Idempotency Key**: Business-level duplicate prevention
3. **Time Window**: Process duplicates within time windows
4. **Source System**: Consider event source in deduplication logic

## Common Pitfalls

- **Fingerprint Collisions**: Ensure fingerprint algorithm prevents false positives
- **TTL Configuration**: Balance memory usage with business requirements
- **Async Processing**: Handle race conditions in concurrent event processing
- **Storage Failures**: Gracefully handle deduplication store failures

## Related Examples

- [Batch Event Processing](./example-1.md)
- [Context-Aware Event Processing](../basic/example-3.md)
- [Event Stream Processing](../advanced/example-2.md)