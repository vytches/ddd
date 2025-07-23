# Projection with Capabilities - NestJS Manual Setup

**Version**: 1.0.0 **Package**: @vytches-ddd/projections + NestJS
**Complexity**: basic **Framework**: NestJS **Integration**: Manual setup with
capabilities **Dependencies**: @nestjs/common, @vytches-ddd/projections,
@vytches-ddd/events

## Description

NestJS service implementing projection with production-ready capabilities
(checkpoints, circuit breakers, dead letter queues) using manual setup. This
example demonstrates how to enhance projections with enterprise features for
reliable event processing.

## Business Context

E-commerce order management systems require robust projections that can handle
failures, recover from errors, and maintain data consistency even under high
load or when external services are unavailable.

## Service Implementation

```typescript
// order-summary-projection.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  ProjectionBase,
  EventHandler,
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
} from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { OrderData, OrderSummaryData } from '../types'; // From your application

@Injectable()
export class OrderSummaryProjectionService
  extends ProjectionBase<any>
  implements OnModuleInit, OnModuleDestroy
{
  private checkpointCapability: CheckpointCapability;
  private circuitBreakerCapability: CircuitBreakerCapability;
  private deadLetterCapability: DeadLetterCapability;

  constructor() {
    super('OrderSummaryProjection', 'v1.0');
    this.initializeProjection();
    this.setupCapabilities();
  }

  async onModuleInit(): Promise<void> {
    // Start capabilities when NestJS module initializes
    await this.startCapabilities();
    console.log(
      'Order Summary Projection Service with capabilities initialized'
    );
  }

  async onModuleDestroy(): Promise<void> {
    // Clean shutdown of capabilities
    await this.stopCapabilities();
    console.log('Order Summary Projection Service capabilities stopped');
  }

  private initializeProjection(): void {
    this.setState({
      orders: new Map<string, OrderSummaryData>(),
      dailySummaries: new Map<string, any>(),
      customerSummaries: new Map<string, any>(),
      stats: {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        processingErrors: 0,
        lastUpdated: new Date(),
      },
    });
  }

  // ⭐ FOCUS: Setup enterprise capabilities
  private setupCapabilities(): void {
    // Checkpoint capability for state recovery
    this.checkpointCapability = new CheckpointCapability({
      projectionName: this.projectionName,
      interval: 30000, // 30 seconds
      storage: 'memory', // In production, use persistent storage
      batchSize: 100,
      enableCompression: true,
    });

    // Circuit breaker for external service protection
    this.circuitBreakerCapability = new CircuitBreakerCapability({
      projectionName: this.projectionName,
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      enabled: true,
    });

    // Dead letter queue for failed events
    this.deadLetterCapability = new DeadLetterCapability({
      projectionName: this.projectionName,
      maxRetries: 3,
      retryDelay: 5000,
      deadLetterStorage: 'memory', // In production, use persistent storage
      enableRetryScheduling: true,
    });

    // Add capabilities to projection
    this.addCapability(this.checkpointCapability);
    this.addCapability(this.circuitBreakerCapability);
    this.addCapability(this.deadLetterCapability);
  }

  private async startCapabilities(): Promise<void> {
    try {
      await this.checkpointCapability.start();
      await this.circuitBreakerCapability.start();
      await this.deadLetterCapability.start();

      // Setup capability event handlers
      this.setupCapabilityHandlers();

      console.log('All projection capabilities started successfully');
    } catch (error) {
      console.error('Failed to start projection capabilities:', error);
      throw error;
    }
  }

  private async stopCapabilities(): Promise<void> {
    try {
      if (this.checkpointCapability) await this.checkpointCapability.stop();
      if (this.circuitBreakerCapability)
        await this.circuitBreakerCapability.stop();
      if (this.deadLetterCapability) await this.deadLetterCapability.stop();

      console.log('All projection capabilities stopped successfully');
    } catch (error) {
      console.error('Error stopping projection capabilities:', error);
    }
  }

  private setupCapabilityHandlers(): void {
    // Checkpoint events
    this.checkpointCapability.on('checkpointCreated', (checkpoint: any) => {
      console.log(
        `Checkpoint created for ${this.projectionName}: ${checkpoint.id}`
      );
    });

    this.checkpointCapability.on('checkpointRestored', (checkpoint: any) => {
      console.log(
        `Projection state restored from checkpoint: ${checkpoint.id}`
      );
      this.handleCheckpointRestored(checkpoint);
    });

    // Circuit breaker events
    this.circuitBreakerCapability.on('circuitOpened', () => {
      console.warn(`Circuit breaker opened for ${this.projectionName}`);
    });

    this.circuitBreakerCapability.on('circuitClosed', () => {
      console.log(`Circuit breaker closed for ${this.projectionName}`);
    });

    // Dead letter events
    this.deadLetterCapability.on('eventDeadLettered', (event: IDomainEvent) => {
      console.error(`Event sent to dead letter queue: ${event.eventId}`);
      this.handleDeadLetteredEvent(event);
    });

    this.deadLetterCapability.on(
      'eventRetried',
      (event: IDomainEvent, attempt: number) => {
        console.log(`Retrying event ${event.eventId}, attempt ${attempt}`);
      }
    );
  }

  // ✅ FOCUS: Enhanced event handlers with capabilities
  @EventHandler('OrderCreated')
  async onOrderCreated(event: IDomainEvent): Promise<void> {
    try {
      // Check circuit breaker before processing
      if (this.circuitBreakerCapability.isOpen()) {
        console.warn('Circuit breaker is open, skipping event processing');
        return;
      }

      const orderData = event.payload as OrderData;
      const currentState = this.getState();

      const orderSummary: OrderSummaryData = {
        orderId: orderData.orderId,
        customerId: orderData.customerId,
        totalAmount: orderData.totalAmount,
        itemCount: orderData.items?.length || 0,
        status: 'created',
        createdAt: new Date(event.timestamp),
        lastUpdated: new Date(),
      };

      // Update order summaries
      currentState.orders.set(orderSummary.orderId, orderSummary);

      // Update daily summary
      const dateKey = orderSummary.createdAt.toISOString().split('T')[0];
      const dailySummary = currentState.dailySummaries.get(dateKey) || {
        date: dateKey,
        orderCount: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
      };

      dailySummary.orderCount++;
      dailySummary.totalRevenue += orderSummary.totalAmount;
      dailySummary.averageOrderValue =
        dailySummary.totalRevenue / dailySummary.orderCount;
      currentState.dailySummaries.set(dateKey, dailySummary);

      // Update customer summary
      const customerSummary = currentState.customerSummaries.get(
        orderSummary.customerId
      ) || {
        customerId: orderSummary.customerId,
        orderCount: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
      };

      customerSummary.orderCount++;
      customerSummary.totalSpent += orderSummary.totalAmount;
      customerSummary.averageOrderValue =
        customerSummary.totalSpent / customerSummary.orderCount;
      customerSummary.lastOrderDate = orderSummary.createdAt;
      currentState.customerSummaries.set(
        orderSummary.customerId,
        customerSummary
      );

      // Update global stats
      currentState.stats.totalOrders = currentState.orders.size;
      currentState.stats.totalRevenue += orderSummary.totalAmount;
      currentState.stats.averageOrderValue =
        currentState.stats.totalRevenue / currentState.stats.totalOrders;
      currentState.stats.lastUpdated = new Date();

      this.setState(currentState);

      // Record successful processing with circuit breaker
      await this.circuitBreakerCapability.recordSuccess();

      console.log(
        `Order summary created: ${orderSummary.orderId} ($${orderSummary.totalAmount})`
      );
    } catch (error) {
      // Record failure with circuit breaker
      await this.circuitBreakerCapability.recordFailure();

      // Update error stats
      const currentState = this.getState();
      currentState.stats.processingErrors++;
      this.setState(currentState);

      console.error(
        `Error processing OrderCreated event ${event.eventId}:`,
        error
      );

      // Let the dead letter capability handle the retry logic
      throw error;
    }
  }

  @EventHandler('OrderStatusChanged')
  async onOrderStatusChanged(event: IDomainEvent): Promise<void> {
    try {
      if (this.circuitBreakerCapability.isOpen()) {
        console.warn('Circuit breaker is open, skipping event processing');
        return;
      }

      const statusData = event.payload;
      const currentState = this.getState();
      const orderSummary = currentState.orders.get(statusData.orderId);

      if (!orderSummary) {
        console.warn(`Order ${statusData.orderId} not found for status update`);
        return;
      }

      orderSummary.status = statusData.newStatus;
      orderSummary.lastUpdated = new Date();

      // Handle cancellation revenue adjustment
      if (
        statusData.newStatus === 'cancelled' &&
        orderSummary.status !== 'cancelled'
      ) {
        currentState.stats.totalRevenue -= orderSummary.totalAmount;
        currentState.stats.averageOrderValue =
          currentState.stats.totalRevenue / currentState.stats.totalOrders;

        // Update daily summary
        const dateKey = orderSummary.createdAt.toISOString().split('T')[0];
        const dailySummary = currentState.dailySummaries.get(dateKey);
        if (dailySummary) {
          dailySummary.totalRevenue -= orderSummary.totalAmount;
          dailySummary.averageOrderValue =
            dailySummary.totalRevenue / dailySummary.orderCount;
        }

        // Update customer summary
        const customerSummary = currentState.customerSummaries.get(
          orderSummary.customerId
        );
        if (customerSummary) {
          customerSummary.totalSpent -= orderSummary.totalAmount;
          customerSummary.averageOrderValue =
            customerSummary.totalSpent / customerSummary.orderCount;
        }
      }

      currentState.orders.set(orderSummary.orderId, orderSummary);
      currentState.stats.lastUpdated = new Date();
      this.setState(currentState);

      await this.circuitBreakerCapability.recordSuccess();

      console.log(
        `Order status updated: ${orderSummary.orderId} -> ${orderSummary.status}`
      );
    } catch (error) {
      await this.circuitBreakerCapability.recordFailure();

      const currentState = this.getState();
      currentState.stats.processingErrors++;
      this.setState(currentState);

      console.error(
        `Error processing OrderStatusChanged event ${event.eventId}:`,
        error
      );
      throw error;
    }
  }

  // ✅ FOCUS: Query methods with capability status
  getOrderSummary(orderId: string): OrderSummaryData | undefined {
    const state = this.getState();
    return state.orders.get(orderId);
  }

  getDailySummary(date: string): any | undefined {
    const state = this.getState();
    return state.dailySummaries.get(date);
  }

  getCustomerSummary(customerId: string): any | undefined {
    const state = this.getState();
    return state.customerSummaries.get(customerId);
  }

  getProjectionStats(): any {
    const state = this.getState();
    return {
      ...state.stats,
      capabilities: {
        checkpoints: {
          enabled: true,
          lastCheckpoint: this.checkpointCapability.getLastCheckpointTime(),
          checkpointCount: this.checkpointCapability.getCheckpointCount(),
        },
        circuitBreaker: {
          state: this.circuitBreakerCapability.getState(),
          failureCount: this.circuitBreakerCapability.getFailureCount(),
          successCount: this.circuitBreakerCapability.getSuccessCount(),
        },
        deadLetter: {
          deadLetterCount: this.deadLetterCapability.getDeadLetterCount(),
          retryQueueSize: this.deadLetterCapability.getRetryQueueSize(),
        },
      },
    };
  }

  getAllDailySummaries(): Array<any> {
    const state = this.getState();
    return Array.from(state.dailySummaries.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  getTopCustomers(limit: number = 10): Array<any> {
    const state = this.getState();
    return Array.from(state.customerSummaries.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  // ✅ FOCUS: Capability management methods
  async createManualCheckpoint(): Promise<void> {
    try {
      await this.checkpointCapability.createCheckpoint(this.getState());
      console.log('Manual checkpoint created successfully');
    } catch (error) {
      console.error('Failed to create manual checkpoint:', error);
      throw error;
    }
  }

  async restoreFromLatestCheckpoint(): Promise<void> {
    try {
      const checkpoint = await this.checkpointCapability.getLatestCheckpoint();
      if (checkpoint) {
        this.setState(checkpoint.state);
        console.log('State restored from latest checkpoint');
      } else {
        console.log('No checkpoint available for restoration');
      }
    } catch (error) {
      console.error('Failed to restore from checkpoint:', error);
      throw error;
    }
  }

  getCircuitBreakerStatus(): any {
    return {
      state: this.circuitBreakerCapability.getState(),
      isOpen: this.circuitBreakerCapability.isOpen(),
      failureCount: this.circuitBreakerCapability.getFailureCount(),
      successCount: this.circuitBreakerCapability.getSuccessCount(),
      lastFailureTime: this.circuitBreakerCapability.getLastFailureTime(),
    };
  }

  async processDeadLetterQueue(): Promise<number> {
    try {
      const processedCount =
        await this.deadLetterCapability.processDeadLetterQueue();
      console.log(`Processed ${processedCount} events from dead letter queue`);
      return processedCount;
    } catch (error) {
      console.error('Failed to process dead letter queue:', error);
      throw error;
    }
  }

  // ✅ FOCUS: Manual event processing with capabilities
  async processEvent(event: IDomainEvent): Promise<void> {
    try {
      // The capabilities will automatically handle failures, retries, etc.
      await this.handle(event);
    } catch (error) {
      console.error(`Failed to process event ${event.eventId}:`, error);
      // The error is automatically handled by capabilities (dead letter, circuit breaker)
      throw error;
    }
  }

  // Private capability event handlers
  private handleCheckpointRestored(checkpoint: any): void {
    console.log(
      `Projection state restored from checkpoint created at: ${checkpoint.createdAt}`
    );
    // Additional restoration logic if needed
  }

  private handleDeadLetteredEvent(event: IDomainEvent): void {
    console.error(
      `Event ${event.eventId} of type ${event.eventType} has been dead lettered after maximum retries`
    );

    // Update error statistics
    const currentState = this.getState();
    currentState.stats.processingErrors++;
    this.setState(currentState);

    // In production, you might want to:
    // - Send alerts to monitoring systems
    // - Log to external error tracking
    // - Trigger manual review processes
  }
}
```

## Controller Integration

```typescript
// order-summary.controller.ts
import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { OrderSummaryProjectionService } from './order-summary-projection.service';

@Controller('api/order-summaries')
export class OrderSummaryController {
  constructor(
    private readonly orderSummaryProjection: OrderSummaryProjectionService
  ) {}

  @Get('stats')
  getProjectionStats() {
    return this.orderSummaryProjection.getProjectionStats();
  }

  @Get('daily')
  getDailySummaries(@Query('days') days?: number) {
    const summaries = this.orderSummaryProjection.getAllDailySummaries();
    return days ? summaries.slice(0, parseInt(days)) : summaries;
  }

  @Get('customers/top')
  getTopCustomers(@Query('limit') limit?: number) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.orderSummaryProjection.getTopCustomers(limitNum);
  }

  @Get('orders/:orderId')
  getOrderSummary(@Param('orderId') orderId: string) {
    const summary = this.orderSummaryProjection.getOrderSummary(orderId);
    if (!summary) {
      throw new Error(`Order summary ${orderId} not found`);
    }
    return summary;
  }

  @Get('daily/:date')
  getDailySummary(@Param('date') date: string) {
    const summary = this.orderSummaryProjection.getDailySummary(date);
    if (!summary) {
      throw new Error(`Daily summary for ${date} not found`);
    }
    return summary;
  }

  @Get('customers/:customerId')
  getCustomerSummary(@Param('customerId') customerId: string) {
    const summary = this.orderSummaryProjection.getCustomerSummary(customerId);
    if (!summary) {
      throw new Error(`Customer summary ${customerId} not found`);
    }
    return summary;
  }

  // Capability management endpoints
  @Post('checkpoints')
  async createCheckpoint() {
    await this.orderSummaryProjection.createManualCheckpoint();
    return { message: 'Checkpoint created successfully' };
  }

  @Post('restore')
  async restoreFromCheckpoint() {
    await this.orderSummaryProjection.restoreFromLatestCheckpoint();
    return { message: 'State restored from checkpoint' };
  }

  @Get('circuit-breaker')
  getCircuitBreakerStatus() {
    return this.orderSummaryProjection.getCircuitBreakerStatus();
  }

  @Post('dead-letter/process')
  async processDeadLetterQueue() {
    const processedCount =
      await this.orderSummaryProjection.processDeadLetterQueue();
    return { processedEvents: processedCount };
  }
}
```

## Module Configuration

```typescript
// order-summary.module.ts
import { Module } from '@nestjs/common';
import { OrderSummaryProjectionService } from './order-summary-projection.service';
import { OrderSummaryController } from './order-summary.controller';

@Module({
  providers: [OrderSummaryProjectionService],
  controllers: [OrderSummaryController],
  exports: [OrderSummaryProjectionService],
})
export class OrderSummaryModule {}
```

## Testing with Capabilities

```typescript
// order-summary-projection.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OrderSummaryProjectionService } from './order-summary-projection.service';
import { IDomainEvent } from '@vytches-ddd/events';

describe('OrderSummaryProjectionService with Capabilities', () => {
  let service: OrderSummaryProjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderSummaryProjectionService],
    }).compile();

    service = module.get<OrderSummaryProjectionService>(
      OrderSummaryProjectionService
    );
    await service.onModuleInit(); // Initialize capabilities
  });

  afterEach(async () => {
    await service.onModuleDestroy(); // Clean up capabilities
  });

  it('should process order created event with capabilities', async () => {
    const event: IDomainEvent = {
      eventId: 'test-1',
      eventType: 'OrderCreated',
      aggregateId: 'order-123',
      payload: {
        orderId: 'order-123',
        customerId: 'customer-456',
        totalAmount: 99.99,
        items: [{ id: 'item-1', price: 99.99 }],
      },
      timestamp: new Date(),
      version: 1,
    };

    await service.processEvent(event);

    const orderSummary = service.getOrderSummary('order-123');
    expect(orderSummary).toBeDefined();
    expect(orderSummary?.totalAmount).toBe(99.99);
    expect(orderSummary?.itemCount).toBe(1);

    const stats = service.getProjectionStats();
    expect(stats.totalOrders).toBe(1);
    expect(stats.capabilities.checkpoints.enabled).toBe(true);
  });

  it('should handle circuit breaker functionality', async () => {
    // Test circuit breaker status
    const cbStatus = service.getCircuitBreakerStatus();
    expect(cbStatus.state).toBe('closed'); // Initially closed
    expect(cbStatus.isOpen).toBe(false);
  });

  it('should create and restore from checkpoint', async () => {
    // Create some state first
    const event: IDomainEvent = {
      eventId: 'test-checkpoint',
      eventType: 'OrderCreated',
      aggregateId: 'order-checkpoint',
      payload: {
        orderId: 'order-checkpoint',
        customerId: 'customer-checkpoint',
        totalAmount: 150.0,
        items: [{ id: 'item-1', price: 150.0 }],
      },
      timestamp: new Date(),
      version: 1,
    };

    await service.processEvent(event);

    // Create checkpoint
    await service.createManualCheckpoint();

    // Clear state (simulate restart)
    service.setState({
      orders: new Map(),
      dailySummaries: new Map(),
      customerSummaries: new Map(),
      stats: {},
    });

    // Restore from checkpoint
    await service.restoreFromLatestCheckpoint();

    // Verify state restored
    const orderSummary = service.getOrderSummary('order-checkpoint');
    expect(orderSummary).toBeDefined();
    expect(orderSummary?.totalAmount).toBe(150.0);
  });
});
```

## Key Features

- **Production-Ready Capabilities**: Checkpoints, circuit breakers, dead letter
  queues
- **Automatic Recovery**: State restoration from checkpoints
- **Failure Handling**: Circuit breaker protection and dead letter processing
- **Comprehensive Monitoring**: Detailed capability status and metrics
- **NestJS Lifecycle**: Proper initialization and cleanup with NestJS hooks
- **Enterprise Features**: Manual checkpoint creation, dead letter processing
- **Error Resilience**: Automatic retry logic and failure isolation

## Best Practices

- Initialize capabilities in `onModuleInit` for proper lifecycle management
- Always clean up capabilities in `onModuleDestroy`
- Monitor capability health through status endpoints
- Use circuit breakers to protect external service calls
- Implement manual checkpoint creation for critical state changes
- Process dead letter queues regularly to handle failed events
- Set up monitoring and alerting for capability events

## Common Pitfalls

- **Capability Lifecycle**: Not properly starting/stopping capabilities with
  module lifecycle
- **Memory Usage**: Checkpoint storage can grow large without rotation
- **Circuit Breaker Tuning**: Wrong thresholds can cause unnecessary failures
- **Dead Letter Processing**: Not processing dead letter queues leads to data
  loss
- **Error Handling**: Not properly handling capability failures

## Related Examples

- [Simple Projection](./example-1.md)
- [Advanced Projection Engine](../intermediate/example-1.md)
- [Multi-Tenant Projections](../../intermediate/example-3.md)
