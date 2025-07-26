# Advanced Event Handling Implementation

**Focus**: Advanced event handling with context filtering and batch processing  
**Domain**: Multi-Tenant E-commerce Platform  
**Complexity**: Intermediate  
**Dependencies**: @vytches/ddd-events, @vytches/ddd-di, @vytches/ddd-utils

## Business Context

This example demonstrates advanced event handling features for a multi-tenant
e-commerce platform:

- Context-aware event filtering for tenant isolation
- Batch event processing for performance optimization
- Event middleware pipeline for cross-cutting concerns
- Complex event routing based on business rules

## Implementation

```typescript
// tenant-order-events.ts
import { DomainEvent, IntegrationEvent } from '@vytches/ddd-events';
import { OrderItem, TenantContext, Customer } from '../types'; // ALWAYS import from app

// Enhanced domain events with tenant context
export class TenantOrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly items: OrderItem[],
    public readonly orderType: 'standard' | 'premium' | 'wholesale'
  ) {
    super('TenantOrderCreated', {
      tenantId,
      orderId,
      customerId,
      totalAmount,
      items,
      orderType,
    });

    // Set event context for filtering
    this.setEventContext(`tenant-${tenantId}`);
  }
}

export class BulkOrderProcessedEvent extends IntegrationEvent {
  constructor(
    public readonly tenantId: string,
    public readonly batchId: string,
    public readonly processedOrders: string[],
    public readonly failedOrders: string[],
    public readonly totalAmount: number
  ) {
    super('BulkOrderProcessed', {
      tenantId,
      batchId,
      processedOrders,
      failedOrders,
      totalAmount,
    });

    this.setEventContext(`tenant-${tenantId}`);
  }
}

export class InventoryThresholdReachedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly currentStock: number,
    public readonly thresholdLevel: number,
    public readonly severity: 'low' | 'critical'
  ) {
    super('InventoryThresholdReached', {
      tenantId,
      productId,
      currentStock,
      thresholdLevel,
      severity,
    });

    this.setEventContext(`tenant-${tenantId}`);
  }
}

// advanced-event-bus.ts
import {
  UnifiedEventBus,
  UniversalEventDispatcher,
  EventHandler,
} from '@vytches/ddd-events';
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

// ⭐ Advanced Event Bus with Context Filtering
@DomainService('advancedEventBus', {
  lifetime: ServiceLifetime.Singleton,
  context: 'EventManagement',
})
export class AdvancedEventBus extends UnifiedEventBus {
  private logger = Logger.forContext('AdvancedEventBus');
  private batchProcessor: BatchEventProcessor;
  private contextFilters: Map<string, EventContextFilter> = new Map();

  constructor() {
    super();
    this.batchProcessor = new BatchEventProcessor(this);
    this.initializeContextFilters();
  }

  // Context-aware event publishing
  async publishWithContext(
    event: any,
    context: TenantContext
  ): Promise<Result<void, Error>> {
    try {
      // Apply tenant-specific context
      event.setEventContext(`tenant-${context.tenantId}`);
      event.setMetadata({
        ...event.metadata,
        tenantId: context.tenantId,
        userId: context.userId,
        correlationId: context.correlationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Publishing event with context', {
        eventType: event.eventType,
        tenantId: context.tenantId,
        eventContext: event.eventContext,
      });

      return await this.publish(event);
    } catch (error) {
      this.logger.error('Failed to publish event with context', {
        eventType: event.eventType,
        tenantId: context.tenantId,
        error: error.message,
      });

      return Result.failure(
        new Error(`Context publishing failed: ${error.message}`)
      );
    }
  }

  // Batch event publishing for performance
  async publishBatch(
    events: any[],
    context: TenantContext
  ): Promise<Result<void, Error>> {
    try {
      this.logger.info('Publishing batch of events', {
        batchSize: events.length,
        tenantId: context.tenantId,
      });

      // Apply context to all events
      const contextualEvents = events.map(event => {
        event.setEventContext(`tenant-${context.tenantId}`);
        event.setMetadata({
          ...event.metadata,
          tenantId: context.tenantId,
          batchId: `batch-${Date.now()}`,
          timestamp: new Date().toISOString(),
        });
        return event;
      });

      return await this.publishMany(contextualEvents);
    } catch (error) {
      this.logger.error('Failed to publish event batch', {
        batchSize: events.length,
        tenantId: context.tenantId,
        error: error.message,
      });

      return Result.failure(
        new Error(`Batch publishing failed: ${error.message}`)
      );
    }
  }

  // Subscribe with context filtering
  subscribeWithContext(
    eventType: string,
    handler: (event: any) => Promise<void>,
    contextPattern: string | RegExp
  ): void {
    const filteredHandler = async (event: any) => {
      // Apply context filtering
      if (this.matchesContext(event.eventContext, contextPattern)) {
        await handler(event);
      }
    };

    this.subscribe(eventType, filteredHandler);
  }

  private initializeContextFilters(): void {
    // Premium tenant filter
    this.contextFilters.set(
      'premium',
      new EventContextFilter({
        allowedContexts: [/^tenant-premium-/],
        priority: 'high',
        description: 'Premium tenant events',
      })
    );

    // Standard tenant filter
    this.contextFilters.set(
      'standard',
      new EventContextFilter({
        allowedContexts: [/^tenant-std-/],
        priority: 'medium',
        description: 'Standard tenant events',
      })
    );

    // Admin context filter
    this.contextFilters.set(
      'admin',
      new EventContextFilter({
        allowedContexts: [/^admin-/, /^system-/],
        priority: 'high',
        description: 'Administrative events',
      })
    );
  }

  private matchesContext(
    eventContext: string,
    pattern: string | RegExp
  ): boolean {
    if (typeof pattern === 'string') {
      return eventContext === pattern;
    }
    return pattern.test(eventContext);
  }
}

// Event context filter utility
class EventContextFilter {
  constructor(
    private config: {
      allowedContexts: (string | RegExp)[];
      priority: 'low' | 'medium' | 'high';
      description: string;
    }
  ) {}

  matches(context: string): boolean {
    return this.config.allowedContexts.some(pattern => {
      if (typeof pattern === 'string') {
        return context === pattern;
      }
      return pattern.test(context);
    });
  }
}

// batch-event-processor.ts
export class BatchEventProcessor {
  private logger = Logger.forContext('BatchEventProcessor');
  private eventBuffer: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds

  constructor(private eventBus: UnifiedEventBus) {}

  async addToBatch(tenantId: string, event: any): Promise<void> {
    const batchKey = `tenant-${tenantId}`;

    if (!this.eventBuffer.has(batchKey)) {
      this.eventBuffer.set(batchKey, []);
    }

    const batch = this.eventBuffer.get(batchKey)!;
    batch.push(event);

    this.logger.debug('Event added to batch', {
      tenantId,
      batchSize: batch.length,
      eventType: event.eventType,
    });

    // Process batch if size threshold reached
    if (batch.length >= this.BATCH_SIZE) {
      await this.processBatch(batchKey);
    } else {
      // Set timer for timeout-based processing
      this.resetBatchTimer(batchKey);
    }
  }

  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.eventBuffer.get(batchKey);
    if (!batch || batch.length === 0) return;

    try {
      this.logger.info('Processing event batch', {
        batchKey,
        batchSize: batch.length,
      });

      // Clear batch and timer
      this.eventBuffer.set(batchKey, []);
      this.clearBatchTimer(batchKey);

      // Process events in batch
      const results = await Promise.allSettled(
        batch.map(event => this.eventBus.publish(event))
      );

      // Log batch processing results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.info('Batch processing completed', {
        batchKey,
        successful,
        failed,
        totalEvents: batch.length,
      });

      // Emit batch processed event
      const tenantId = batchKey.replace('tenant-', '');
      const batchEvent = new BulkOrderProcessedEvent(
        tenantId,
        `batch-${Date.now()}`,
        batch.slice(0, successful).map(e => e.payload.orderId),
        batch.slice(successful).map(e => e.payload.orderId),
        batch.reduce((sum, e) => sum + (e.payload.totalAmount || 0), 0)
      );

      await this.eventBus.publish(batchEvent);
    } catch (error) {
      this.logger.error('Batch processing failed', {
        batchKey,
        error: error.message,
      });
    }
  }

  private resetBatchTimer(batchKey: string): void {
    this.clearBatchTimer(batchKey);

    const timer = setTimeout(() => {
      this.processBatch(batchKey);
    }, this.BATCH_TIMEOUT);

    this.batchTimers.set(batchKey, timer);
  }

  private clearBatchTimer(batchKey: string): void {
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }
  }
}

// advanced-event-handlers.ts
import {
  TenantOrderCreatedEvent,
  BulkOrderProcessedEvent,
  InventoryThresholdReachedEvent,
} from './tenant-order-events';

// ⭐ Context-aware event handlers
@EventHandler(TenantOrderCreatedEvent, {
  eventContext: /^tenant-premium-/,
})
export class PremiumOrderCreatedHandler {
  private logger = Logger.forContext('PremiumOrderCreatedHandler');

  async handle(event: TenantOrderCreatedEvent): Promise<void> {
    this.logger.info('Processing premium order', {
      tenantId: event.tenantId,
      orderId: event.orderId,
      orderType: event.orderType,
    });

    // Premium customer benefits
    await this.applyPremiumBenefits(event);
    await this.prioritizeShipping(event);
    await this.assignPremiumSupport(event);
  }

  private async applyPremiumBenefits(
    event: TenantOrderCreatedEvent
  ): Promise<void> {
    this.logger.info('Applying premium benefits', {
      tenantId: event.tenantId,
      orderId: event.orderId,
    });

    // Apply premium discounts, free shipping, etc.
  }

  private async prioritizeShipping(
    event: TenantOrderCreatedEvent
  ): Promise<void> {
    this.logger.info('Prioritizing shipping for premium order', {
      tenantId: event.tenantId,
      orderId: event.orderId,
    });

    // Priority shipping queue
  }

  private async assignPremiumSupport(
    event: TenantOrderCreatedEvent
  ): Promise<void> {
    this.logger.info('Assigning premium support', {
      tenantId: event.tenantId,
      orderId: event.orderId,
    });

    // Assign dedicated support representative
  }
}

@EventHandler(TenantOrderCreatedEvent, {
  eventContext: /^tenant-std-/,
})
export class StandardOrderCreatedHandler {
  private logger = Logger.forContext('StandardOrderCreatedHandler');

  async handle(event: TenantOrderCreatedEvent): Promise<void> {
    this.logger.info('Processing standard order', {
      tenantId: event.tenantId,
      orderId: event.orderId,
      orderType: event.orderType,
    });

    // Standard order processing
    await this.processStandardOrder(event);
    await this.scheduleRegularShipping(event);
  }

  private async processStandardOrder(
    event: TenantOrderCreatedEvent
  ): Promise<void> {
    this.logger.info('Processing standard order', {
      tenantId: event.tenantId,
      orderId: event.orderId,
    });

    // Standard order processing logic
  }

  private async scheduleRegularShipping(
    event: TenantOrderCreatedEvent
  ): Promise<void> {
    this.logger.info('Scheduling regular shipping', {
      tenantId: event.tenantId,
      orderId: event.orderId,
    });

    // Regular shipping queue
  }
}

@EventHandler(BulkOrderProcessedEvent)
export class BulkOrderAnalyticsHandler {
  private logger = Logger.forContext('BulkOrderAnalyticsHandler');

  async handle(event: BulkOrderProcessedEvent): Promise<void> {
    this.logger.info('Processing bulk order analytics', {
      tenantId: event.tenantId,
      batchId: event.batchId,
      processedCount: event.processedOrders.length,
      failedCount: event.failedOrders.length,
    });

    // Analytics and reporting
    await this.updateTenantMetrics(event);
    await this.generatePerformanceReport(event);

    // Alert on high failure rates
    if (event.failedOrders.length > event.processedOrders.length * 0.1) {
      await this.alertHighFailureRate(event);
    }
  }

  private async updateTenantMetrics(
    event: BulkOrderProcessedEvent
  ): Promise<void> {
    // Update tenant-specific metrics
  }

  private async generatePerformanceReport(
    event: BulkOrderProcessedEvent
  ): Promise<void> {
    // Generate performance analytics
  }

  private async alertHighFailureRate(
    event: BulkOrderProcessedEvent
  ): Promise<void> {
    this.logger.warn('High failure rate detected', {
      tenantId: event.tenantId,
      batchId: event.batchId,
      failureRate:
        event.failedOrders.length /
        (event.processedOrders.length + event.failedOrders.length),
    });
  }
}

@EventHandler(InventoryThresholdReachedEvent)
export class InventoryAlertHandler {
  private logger = Logger.forContext('InventoryAlertHandler');

  async handle(event: InventoryThresholdReachedEvent): Promise<void> {
    this.logger.warn('Inventory threshold reached', {
      tenantId: event.tenantId,
      productId: event.productId,
      currentStock: event.currentStock,
      severity: event.severity,
    });

    if (event.severity === 'critical') {
      await this.handleCriticalInventory(event);
    } else {
      await this.handleLowInventory(event);
    }
  }

  private async handleCriticalInventory(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    // Critical inventory actions
    await this.triggerEmergencyRestocking(event);
    await this.notifySuppliers(event);
    await this.alertManagement(event);
  }

  private async handleLowInventory(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    // Low inventory actions
    await this.scheduleRestocking(event);
    await this.notifyPurchasing(event);
  }

  private async triggerEmergencyRestocking(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    this.logger.info('Triggering emergency restocking', {
      tenantId: event.tenantId,
      productId: event.productId,
    });
  }

  private async notifySuppliers(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    this.logger.info('Notifying suppliers', {
      tenantId: event.tenantId,
      productId: event.productId,
    });
  }

  private async alertManagement(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    this.logger.warn('Alerting management about critical inventory', {
      tenantId: event.tenantId,
      productId: event.productId,
    });
  }

  private async scheduleRestocking(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    this.logger.info('Scheduling restocking', {
      tenantId: event.tenantId,
      productId: event.productId,
    });
  }

  private async notifyPurchasing(
    event: InventoryThresholdReachedEvent
  ): Promise<void> {
    this.logger.info('Notifying purchasing department', {
      tenantId: event.tenantId,
      productId: event.productId,
    });
  }
}
```

## Key Features

- **Context-Aware Filtering**: Events are filtered based on tenant context
  patterns
- **Batch Processing**: Automatic batching of events for performance
  optimization
- **Multi-Tenant Support**: Tenant isolation through event context
- **Advanced Event Routing**: Different handlers for different tenant types
- **Performance Monitoring**: Batch processing metrics and failure rate
  monitoring
- **Timeout Management**: Automatic batch processing on timeout

## Usage Example

```typescript
// Usage in multi-tenant service
export class TenantOrderService {
  constructor(
    private eventBus: AdvancedEventBus,
    private orderRepository: OrderRepository
  ) {}

  async createOrder(
    tenantContext: TenantContext,
    customerId: string,
    items: OrderItem[]
  ): Promise<Result<OrderAggregate, Error>> {
    try {
      // Create order aggregate
      const order = OrderAggregate.create(customerId, items);

      // Create tenant-specific event
      const orderEvent = new TenantOrderCreatedEvent(
        tenantContext.tenantId,
        order.id,
        customerId,
        order.totalAmount,
        items,
        tenantContext.tier === 'premium' ? 'premium' : 'standard'
      );

      // Publish with tenant context
      await this.eventBus.publishWithContext(orderEvent, tenantContext);

      // Save order (additional events may be published)
      const saveResult = await this.orderRepository.save(order);

      return saveResult;
    } catch (error) {
      return Result.failure(
        new Error(`Failed to create order: ${error.message}`)
      );
    }
  }

  async processBulkOrders(
    tenantContext: TenantContext,
    orders: OrderData[]
  ): Promise<Result<void, Error>> {
    try {
      // Create events for batch processing
      const events = orders.map(
        orderData =>
          new TenantOrderCreatedEvent(
            tenantContext.tenantId,
            orderData.id,
            orderData.customerId,
            orderData.totalAmount,
            orderData.items,
            'standard'
          )
      );

      // Publish batch of events
      await this.eventBus.publishBatch(events, tenantContext);

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        new Error(`Bulk processing failed: ${error.message}`)
      );
    }
  }
}
```

## Common Pitfalls

- **Context Leakage**: Ensure proper tenant isolation in event contexts
- **Batch Size Tuning**: Monitor and adjust batch sizes based on performance
- **Handler Ordering**: Be aware of handler execution order in multi-tenant
  scenarios
- **Memory Management**: Monitor memory usage with large event batches
- **Error Isolation**: Ensure tenant errors don't affect other tenants
