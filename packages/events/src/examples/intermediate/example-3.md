# Event Middleware and Pipeline Processing

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: intermediate
**Domain**: Architecture **Patterns**: event-middleware, pipeline-processing,
cross-cutting-concerns, event-transformation **Dependencies**:
@vytches/ddd-events, @vytches/ddd-utils, @vytches/ddd-logging

## Description

Advanced event middleware system for implementing cross-cutting concerns in
event processing pipelines. This example demonstrates how to build sophisticated
middleware chains for logging, validation, transformation, and monitoring of
domain events throughout their lifecycle.

## Business Context

Enterprise applications need consistent handling of cross-cutting concerns
across all event processing. This includes security validation, performance
monitoring, data transformation, audit logging, and error handling that must be
applied uniformly regardless of the specific business event being processed.

## Code Example

```typescript
// event-middleware.ts
import { DomainEvent, UnifiedEventBus } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

// ⭐ FOCUS: Middleware interface definition
export interface EventMiddleware {
  process(
    event: DomainEvent,
    next: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>>;
  order: number; // Execution order
  name: string;
}

// ⭐ FOCUS: Event pipeline processor
export class EventPipeline {
  private readonly middlewares: EventMiddleware[] = [];
  private readonly logger = Logger.forContext('EventPipeline');

  addMiddleware(middleware: EventMiddleware): void {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => a.order - b.order);

    this.logger.info('Middleware added to pipeline', {
      middleware: middleware.name,
      order: middleware.order,
      totalMiddlewares: this.middlewares.length,
    });
  }

  async process(
    event: DomainEvent,
    handler: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    let index = 0;

    const executeNext = async (
      currentEvent: DomainEvent
    ): Promise<Result<void, Error>> => {
      if (index >= this.middlewares.length) {
        // ⭐ FOCUS: Execute final handler after all middleware
        return await handler(currentEvent);
      }

      const middleware = this.middlewares[index++];

      try {
        return await middleware.process(currentEvent, executeNext);
      } catch (error) {
        this.logger.error('Middleware execution failed', {
          middleware: middleware.name,
          error: error.message,
          eventType: currentEvent.eventType,
        });
        return Result.fail(
          new Error(`Middleware ${middleware.name} failed: ${error.message}`)
        );
      }
    };

    return await executeNext(event);
  }

  getMiddlewareChain(): string[] {
    return this.middlewares.map(m => `${m.name} (order: ${m.order})`);
  }
}

// ⭐ FOCUS: Logging middleware
export class LoggingMiddleware implements EventMiddleware {
  public readonly order = 10;
  public readonly name = 'LoggingMiddleware';
  private readonly logger = Logger.forContext('LoggingMiddleware');

  async process(
    event: DomainEvent,
    next: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    const startTime = Date.now();

    this.logger.info('Event processing started', {
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      timestamp: event.timestamp.toISOString(),
      correlationId: event.correlationId,
    });

    try {
      const result = await next(event);
      const duration = Date.now() - startTime;

      if (result.isSuccess()) {
        this.logger.info('Event processing completed successfully', {
          eventType: event.eventType,
          eventId: event.eventId,
          duration,
          status: 'success',
        });
      } else {
        this.logger.error('Event processing failed', {
          eventType: event.eventType,
          eventId: event.eventId,
          duration,
          error: result.error.message,
          status: 'failed',
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Event processing threw exception', {
        eventType: event.eventType,
        eventId: event.eventId,
        duration,
        error: error.message,
        status: 'exception',
      });

      return Result.fail(
        new Error(`Event processing failed: ${error.message}`)
      );
    }
  }
}

// ⭐ FOCUS: Validation middleware
export class ValidationMiddleware implements EventMiddleware {
  public readonly order = 20;
  public readonly name = 'ValidationMiddleware';
  private readonly logger = Logger.forContext('ValidationMiddleware');

  async process(
    event: DomainEvent,
    next: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    // ⭐ FOCUS: Basic event structure validation
    const validationErrors = this.validateEventStructure(event);

    if (validationErrors.length > 0) {
      const errorMessage = `Event validation failed: ${validationErrors.join(', ')}`;

      this.logger.error('Event validation failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        errors: validationErrors,
      });

      return Result.fail(new Error(errorMessage));
    }

    // ⭐ FOCUS: Business rule validation
    const businessValidationResult = await this.validateBusinessRules(event);

    if (businessValidationResult.isFailure()) {
      this.logger.error('Business validation failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: businessValidationResult.error.message,
      });

      return businessValidationResult;
    }

    this.logger.debug('Event validation passed', {
      eventType: event.eventType,
      eventId: event.eventId,
    });

    return await next(event);
  }

  private validateEventStructure(event: DomainEvent): string[] {
    const errors: string[] = [];

    if (!event.eventId) {
      errors.push('Event ID is required');
    }

    if (!event.eventType) {
      errors.push('Event type is required');
    }

    if (!event.aggregateId) {
      errors.push('Aggregate ID is required');
    }

    if (!event.timestamp) {
      errors.push('Timestamp is required');
    } else if (event.timestamp > new Date()) {
      errors.push('Timestamp cannot be in the future');
    }

    // ⭐ FOCUS: Event age validation
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - event.timestamp.getTime() > maxAge) {
      errors.push('Event is too old');
    }

    return errors;
  }

  private async validateBusinessRules(
    event: DomainEvent
  ): Promise<Result<void, Error>> {
    // ⭐ FOCUS: Event-specific business validation
    switch (event.eventType) {
      case 'OrderCreated':
        return this.validateOrderCreated(event as any);
      case 'PaymentProcessed':
        return this.validatePaymentProcessed(event as any);
      case 'InventoryReserved':
        return this.validateInventoryReserved(event as any);
      default:
        return Result.ok(); // No specific validation needed
    }
  }

  private validateOrderCreated(event: any): Result<void, Error> {
    if (!event.customerId) {
      return Result.fail(
        new Error('Customer ID is required for OrderCreated event')
      );
    }

    if (!event.totalAmount || event.totalAmount <= 0) {
      return Result.fail(new Error('Order must have positive total amount'));
    }

    if (!event.items || event.items.length === 0) {
      return Result.fail(new Error('Order must contain at least one item'));
    }

    return Result.ok();
  }

  private validatePaymentProcessed(event: any): Result<void, Error> {
    if (!event.paymentId) {
      return Result.fail(new Error('Payment ID is required'));
    }

    if (!event.orderId) {
      return Result.fail(new Error('Order ID is required for payment'));
    }

    if (!['completed', 'failed', 'pending'].includes(event.status)) {
      return Result.fail(new Error('Invalid payment status'));
    }

    return Result.ok();
  }

  private validateInventoryReserved(event: any): Result<void, Error> {
    if (!event.reservationId) {
      return Result.fail(new Error('Reservation ID is required'));
    }

    if (!event.items || event.items.length === 0) {
      return Result.fail(new Error('Reservation must contain items'));
    }

    return Result.ok();
  }
}

// ⭐ FOCUS: Transformation middleware
export class TransformationMiddleware implements EventMiddleware {
  public readonly order = 30;
  public readonly name = 'TransformationMiddleware';
  private readonly logger = Logger.forContext('TransformationMiddleware');

  async process(
    event: DomainEvent,
    next: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Apply transformations based on event type
      const transformedEvent = await this.transformEvent(event);

      this.logger.debug('Event transformation applied', {
        eventType: event.eventType,
        eventId: event.eventId,
        transformationsApplied: this.getAppliedTransformations(
          event,
          transformedEvent
        ),
      });

      return await next(transformedEvent);
    } catch (error) {
      this.logger.error('Event transformation failed', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error.message,
      });

      return Result.fail(
        new Error(`Event transformation failed: ${error.message}`)
      );
    }
  }

  private async transformEvent(event: DomainEvent): Promise<DomainEvent> {
    let transformedEvent = { ...event };

    // ⭐ FOCUS: Add standard metadata
    transformedEvent = await this.addStandardMetadata(transformedEvent);

    // ⭐ FOCUS: Normalize data formats
    transformedEvent = await this.normalizeDataFormats(transformedEvent);

    // ⭐ FOCUS: Enrich with contextual data
    transformedEvent = await this.enrichWithContextualData(transformedEvent);

    return transformedEvent;
  }

  private async addStandardMetadata(event: DomainEvent): Promise<DomainEvent> {
    // ⭐ FOCUS: Add processing metadata
    if (!event.metadata) {
      event.metadata = {};
    }

    event.metadata = {
      ...event.metadata,
      processedAt: new Date().toISOString(),
      processingVersion: '1.0.0',
      schemaVersion: '2.0',
      source: 'event-processing-pipeline',
    };

    return event;
  }

  private async normalizeDataFormats(event: DomainEvent): Promise<DomainEvent> {
    // ⭐ FOCUS: Normalize common data formats
    if (
      event.metadata?.timestamp &&
      typeof event.metadata.timestamp === 'string'
    ) {
      event.metadata.timestamp = new Date(
        event.metadata.timestamp
      ).toISOString();
    }

    // Normalize currency codes
    if (
      event.metadata?.currency &&
      typeof event.metadata.currency === 'string'
    ) {
      event.metadata.currency = event.metadata.currency.toUpperCase();
    }

    // Normalize email addresses
    if (event.metadata?.email && typeof event.metadata.email === 'string') {
      event.metadata.email = event.metadata.email.toLowerCase().trim();
    }

    return event;
  }

  private async enrichWithContextualData(
    event: DomainEvent
  ): Promise<DomainEvent> {
    // ⭐ FOCUS: Add contextual enrichment
    if (event.eventType === 'OrderCreated') {
      // Enrich order events with customer context
      event.metadata = {
        ...event.metadata,
        customerSegment: await this.getCustomerSegment(event.aggregateId),
        orderPriority: this.calculateOrderPriority(event as any),
      };
    }

    if (event.eventType === 'PaymentProcessed') {
      // Enrich payment events with risk assessment
      event.metadata = {
        ...event.metadata,
        riskScore: await this.calculateRiskScore(event as any),
        paymentRegion: this.determinePaymentRegion(event as any),
      };
    }

    return event;
  }

  private async getCustomerSegment(customerId: string): Promise<string> {
    // Mock customer segment lookup
    const segments = ['bronze', 'silver', 'gold', 'platinum'];
    return segments[Math.floor(Math.random() * segments.length)];
  }

  private calculateOrderPriority(event: any): string {
    const amount = event.metadata?.totalAmount || 0;

    if (amount > 1000) return 'high';
    if (amount > 500) return 'medium';
    return 'low';
  }

  private async calculateRiskScore(event: any): Promise<number> {
    // Mock risk calculation
    return Math.random();
  }

  private determinePaymentRegion(event: any): string {
    // Mock region determination
    const regions = ['US', 'EU', 'APAC', 'LATAM'];
    return regions[Math.floor(Math.random() * regions.length)];
  }

  private getAppliedTransformations(
    original: DomainEvent,
    transformed: DomainEvent
  ): string[] {
    const transformations: string[] = [];

    if (
      JSON.stringify(original.metadata) !== JSON.stringify(transformed.metadata)
    ) {
      transformations.push('metadata_enrichment');
    }

    return transformations;
  }
}

// ⭐ FOCUS: Performance monitoring middleware
export class PerformanceMiddleware implements EventMiddleware {
  public readonly order = 40;
  public readonly name = 'PerformanceMiddleware';
  private readonly logger = Logger.forContext('PerformanceMiddleware');
  private readonly metrics = new Map<
    string,
    { count: number; totalTime: number; maxTime: number; minTime: number }
  >();

  async process(
    event: DomainEvent,
    next: (event: DomainEvent) => Promise<Result<void, Error>>
  ): Promise<Result<void, Error>> {
    const startTime = performance.now();
    const memoryBefore = this.getMemoryUsage();

    try {
      const result = await next(event);

      const duration = performance.now() - startTime;
      const memoryAfter = this.getMemoryUsage();
      const memoryDelta = memoryAfter - memoryBefore;

      // ⭐ FOCUS: Update performance metrics
      this.updateMetrics(event.eventType, duration);

      // ⭐ FOCUS: Log performance data
      this.logger.info('Event performance metrics', {
        eventType: event.eventType,
        eventId: event.eventId,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        memoryDelta,
        success: result.isSuccess(),
        performanceCategory: this.categorizePerformance(duration),
      });

      // ⭐ FOCUS: Alert on slow events
      if (duration > 5000) {
        // 5 seconds
        this.logger.warn('Slow event processing detected', {
          eventType: event.eventType,
          eventId: event.eventId,
          duration,
          threshold: 5000,
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.logger.error('Event processing failed with performance data', {
        eventType: event.eventType,
        eventId: event.eventId,
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  private updateMetrics(eventType: string, duration: number): void {
    const existing = this.metrics.get(eventType) || {
      count: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Number.MAX_VALUE,
    };

    existing.count++;
    existing.totalTime += duration;
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.minTime = Math.min(existing.minTime, duration);

    this.metrics.set(eventType, existing);
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};

    this.metrics.forEach((metrics, eventType) => {
      report[eventType] = {
        eventCount: metrics.count,
        averageTime:
          Math.round((metrics.totalTime / metrics.count) * 100) / 100,
        maxTime: Math.round(metrics.maxTime * 100) / 100,
        minTime: Math.round(metrics.minTime * 100) / 100,
        totalProcessingTime: Math.round(metrics.totalTime * 100) / 100,
      };
    });

    return report;
  }
}

// ⭐ FOCUS: Enhanced event bus with middleware support
export class MiddlewareEnabledEventBus extends UnifiedEventBus {
  private readonly pipeline: EventPipeline;
  private readonly logger = Logger.forContext('MiddlewareEnabledEventBus');

  constructor() {
    super();
    this.pipeline = new EventPipeline();
    this.setupDefaultMiddleware();
  }

  private setupDefaultMiddleware(): void {
    // ⭐ FOCUS: Add default middleware in order
    this.pipeline.addMiddleware(new LoggingMiddleware());
    this.pipeline.addMiddleware(new ValidationMiddleware());
    this.pipeline.addMiddleware(new TransformationMiddleware());
    this.pipeline.addMiddleware(new PerformanceMiddleware());
  }

  addMiddleware(middleware: EventMiddleware): void {
    this.pipeline.addMiddleware(middleware);
  }

  async publish(event: DomainEvent): Promise<Result<void, Error>> {
    // ⭐ FOCUS: Process through middleware pipeline before publishing
    return await this.pipeline.process(event, async processedEvent => {
      return await super.publish(processedEvent);
    });
  }

  async publishMany(events: DomainEvent[]): Promise<Result<void, Error>> {
    try {
      // ⭐ FOCUS: Process each event through pipeline
      const results = await Promise.allSettled(
        events.map(event => this.publish(event))
      );

      const failures = results.filter(r => r.status === 'rejected');

      if (failures.length > 0) {
        const errorMessages = failures.map(
          f => (f as PromiseRejectedResult).reason.message
        );
        return Result.fail(
          new Error(`Bulk publish failed: ${errorMessages.join(', ')}`)
        );
      }

      return Result.ok();
    } catch (error) {
      this.logger.error('Bulk event publishing failed', {
        error: error.message,
        eventCount: events.length,
      });
      return Result.fail(new Error(`Bulk publish error: ${error.message}`));
    }
  }

  getMiddlewareChain(): string[] {
    return this.pipeline.getMiddlewareChain();
  }
}
```

## Usage Examples

```typescript
// Advanced event processing setup
import {
  MiddlewareEnabledEventBus,
  EventPipeline,
  LoggingMiddleware,
} from './event-middleware';

async function setupAdvancedEventProcessing() {
  const eventBus = new MiddlewareEnabledEventBus();

  // ⭐ FOCUS: Custom middleware for specific business needs
  class SecurityMiddleware implements EventMiddleware {
    public readonly order = 15; // Between logging and validation
    public readonly name = 'SecurityMiddleware';

    async process(
      event: DomainEvent,
      next: (event: DomainEvent) => Promise<Result<void, Error>>
    ): Promise<Result<void, Error>> {
      // Security checks
      if (this.containsSensitiveData(event)) {
        this.sanitizeEvent(event);
      }

      if (!this.isAuthorized(event)) {
        return Result.fail(new Error('Unauthorized event'));
      }

      return await next(event);
    }

    private containsSensitiveData(event: DomainEvent): boolean {
      const eventStr = JSON.stringify(event).toLowerCase();
      const sensitivePatterns = ['ssn', 'credit', 'password', 'token'];
      return sensitivePatterns.some(pattern => eventStr.includes(pattern));
    }

    private sanitizeEvent(event: DomainEvent): void {
      // Remove or mask sensitive data
      if (event.metadata) {
        Object.keys(event.metadata).forEach(key => {
          if (
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token')
          ) {
            event.metadata[key] = '[REDACTED]';
          }
        });
      }
    }

    private isAuthorized(event: DomainEvent): boolean {
      // Mock authorization check
      return true;
    }
  }

  // ⭐ FOCUS: Add custom middleware
  eventBus.addMiddleware(new SecurityMiddleware());

  // ⭐ FOCUS: Setup event handlers
  eventBus.subscribe('OrderCreated', async event => {
    console.log('Processing order:', event.aggregateId);
    // Business logic here
  });

  eventBus.subscribe('PaymentProcessed', async event => {
    console.log('Processing payment:', event.eventId);
    // Payment handling logic
  });

  // ⭐ FOCUS: Process events through middleware pipeline
  const orderEvent = new OrderCreatedEvent(
    EntityId.createUuid(),
    EntityId.createUuid(),
    1500,
    'USD',
    [{ productId: EntityId.createUuid(), quantity: 2, price: 750 }]
  );

  const result = await eventBus.publish(orderEvent);
  if (result.isSuccess()) {
    console.log('Event processed successfully through middleware pipeline');
  }

  // ⭐ FOCUS: View middleware chain
  console.log('Middleware chain:', eventBus.getMiddlewareChain());

  // ⭐ FOCUS: Get performance report
  const performanceMiddleware = eventBus.pipeline?.middlewares?.find(
    m => m.name === 'PerformanceMiddleware'
  ) as PerformanceMiddleware;
  if (performanceMiddleware) {
    console.log(
      'Performance report:',
      performanceMiddleware.getPerformanceReport()
    );
  }
}

setupAdvancedEventProcessing();
```

## Key Features

- **Middleware Pipeline**: Ordered execution of cross-cutting concerns
- **Comprehensive Logging**: Detailed event processing audit trails
- **Data Validation**: Structural and business rule validation
- **Event Transformation**: Data normalization and enrichment
- **Performance Monitoring**: Real-time metrics and alerting
- **Security Integration**: Data sanitization and authorization
- **Extensible Architecture**: Easy to add custom middleware

## Middleware Benefits

1. **Separation of Concerns**: Cross-cutting logic separated from business logic
2. **Reusability**: Middleware components can be reused across different events
3. **Composability**: Mix and match middleware based on requirements
4. **Testability**: Each middleware component can be tested independently
5. **Maintainability**: Changes to cross-cutting concerns isolated to middleware

## Performance Considerations

- **Middleware Order**: Place expensive operations later in pipeline
- **Async Processing**: Use async/await for non-blocking middleware
- **Memory Management**: Monitor memory usage in transformation middleware
- **Caching**: Cache expensive lookups in enrichment middleware

## Common Pitfalls

- **Middleware Order**: Incorrect ordering can cause validation or security
  issues
- **Error Propagation**: Ensure errors are properly handled and logged
- **Performance Impact**: Monitor cumulative impact of middleware chain
- **Memory Leaks**: Clean up resources in middleware components

## Related Examples

- [Batch Event Processing](./example-1.md)
- [Event Deduplication and Idempotency](./example-2.md)
- [Context-Aware Event Processing](../basic/example-3.md)
