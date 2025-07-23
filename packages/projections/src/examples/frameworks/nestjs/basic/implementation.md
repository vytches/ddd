# Basic Projections - NestJS Implementation Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/projections + NestJS
**Complexity**: basic
**Framework**: NestJS
**Integration**: Manual setup patterns
**Dependencies**: @nestjs/common, @vytches-ddd/projections, @vytches-ddd/events

## Overview

This guide covers basic NestJS integration patterns for @vytches-ddd/projections, focusing on manual setup, standard dependency injection, and fundamental projection management. These patterns provide a solid foundation for event-driven read models in NestJS applications.

## Basic Integration Patterns

### 1. Simple Projection Service

```typescript
// basic-projection.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class BasicProjectionService extends ProjectionBase<any> implements OnModuleInit {
  
  constructor() {
    super('BasicProjection', 'v1.0');
    this.initializeState();
  }

  async onModuleInit(): Promise<void> {
    console.log('Basic Projection Service initialized');
  }

  private initializeState(): void {
    this.setState({
      items: new Map<string, any>(),
      stats: {
        totalItems: 0,
        lastUpdated: new Date()
      }
    });
  }

  @EventHandler('ItemCreated')
  async onItemCreated(event: IDomainEvent): Promise<void> {
    const itemData = event.payload;
    const currentState = this.getState();

    currentState.items.set(itemData.id, {
      ...itemData,
      createdAt: new Date(event.timestamp)
    });

    currentState.stats.totalItems = currentState.items.size;
    currentState.stats.lastUpdated = new Date();

    this.setState(currentState);
    console.log(`Item created: ${itemData.id}`);
  }

  getItem(id: string): any | undefined {
    const state = this.getState();
    return state.items.get(id);
  }

  getAllItems(): any[] {
    const state = this.getState();
    return Array.from(state.items.values());
  }

  getStats(): any {
    const state = this.getState();
    return state.stats;
  }
}
```

### 2. Event Processing Service

```typescript
// event-processor.service.ts
import { Injectable } from '@nestjs/common';
import { BasicProjectionService } from './basic-projection.service';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class EventProcessorService {
  
  constructor(
    private readonly basicProjection: BasicProjectionService
  ) {}

  async processEvent(event: IDomainEvent): Promise<void> {
    try {
      // Route events to appropriate projections
      if (this.isRelevantEvent(event.eventType)) {
        await this.basicProjection.handle(event);
      } else {
        console.log(`Event ${event.eventType} not handled by projections`);
      }
    } catch (error) {
      console.error(`Event processing failed for ${event.eventId}:`, error);
      throw error;
    }
  }

  private isRelevantEvent(eventType: string): boolean {
    const handledEvents = ['ItemCreated', 'ItemUpdated', 'ItemDeleted'];
    return handledEvents.includes(eventType);
  }
}
```

### 3. REST API Controller

```typescript
// projection-api.controller.ts
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { BasicProjectionService } from './basic-projection.service';
import { EventProcessorService } from './event-processor.service';
import { IDomainEvent } from '@vytches-ddd/events';

@Controller('api/projections')
export class ProjectionApiController {

  constructor(
    private readonly basicProjection: BasicProjectionService,
    private readonly eventProcessor: EventProcessorService
  ) {}

  @Get('items')
  getAllItems() {
    return this.basicProjection.getAllItems();
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    const item = this.basicProjection.getItem(id);
    if (!item) {
      throw new Error(`Item ${id} not found`);
    }
    return item;
  }

  @Get('stats')
  getStats() {
    return this.basicProjection.getStats();
  }

  @Post('events')
  async processEvent(@Body() event: IDomainEvent) {
    await this.eventProcessor.processEvent(event);
    return { message: 'Event processed successfully' };
  }
}
```

## Projection with Basic Capabilities

### Enhanced Projection Service

```typescript
// enhanced-projection.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { 
  ProjectionBase, 
  EventHandler,
  CheckpointCapability,
  CircuitBreakerCapability
} from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class EnhancedProjectionService extends ProjectionBase<any> implements OnModuleInit, OnModuleDestroy {
  
  private checkpointCapability: CheckpointCapability;
  private circuitBreakerCapability: CircuitBreakerCapability;

  constructor() {
    super('EnhancedProjection', 'v1.0');
    this.setupCapabilities();
    this.initializeState();
  }

  async onModuleInit(): Promise<void> {
    await this.startCapabilities();
    console.log('Enhanced Projection Service initialized with capabilities');
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopCapabilities();
    console.log('Enhanced Projection Service capabilities stopped');
  }

  private setupCapabilities(): void {
    // Basic checkpoint capability
    this.checkpointCapability = new CheckpointCapability({
      projectionName: this.projectionName,
      interval: 60000, // 1 minute
      storage: 'memory',
      batchSize: 50
    });

    // Basic circuit breaker
    this.circuitBreakerCapability = new CircuitBreakerCapability({
      projectionName: this.projectionName,
      failureThreshold: 5,
      resetTimeout: 30000 // 30 seconds
    });

    this.addCapability(this.checkpointCapability);
    this.addCapability(this.circuitBreakerCapability);
  }

  private async startCapabilities(): Promise<void> {
    await this.checkpointCapability.start();
    await this.circuitBreakerCapability.start();
    
    // Setup capability event handlers
    this.checkpointCapability.on('checkpointCreated', (checkpoint) => {
      console.log(`Checkpoint created: ${checkpoint.id}`);
    });

    this.circuitBreakerCapability.on('circuitOpened', () => {
      console.warn('Circuit breaker opened');
    });
  }

  private async stopCapabilities(): Promise<void> {
    if (this.checkpointCapability) await this.checkpointCapability.stop();
    if (this.circuitBreakerCapability) await this.circuitBreakerCapability.stop();
  }

  private initializeState(): void {
    this.setState({
      orders: new Map<string, any>(),
      dailySummaries: new Map<string, any>(),
      stats: {
        totalOrders: 0,
        totalRevenue: 0,
        lastUpdated: new Date(),
        errorCount: 0
      }
    });
  }

  @EventHandler('OrderCreated')
  async onOrderCreated(event: IDomainEvent): Promise<void> {
    try {
      // Check circuit breaker before processing
      if (this.circuitBreakerCapability.isOpen()) {
        console.warn('Circuit breaker is open, skipping event processing');
        return;
      }

      const orderData = event.payload;
      const currentState = this.getState();

      // Process order
      const order = {
        id: orderData.orderId,
        customerId: orderData.customerId,
        amount: orderData.totalAmount,
        createdAt: new Date(event.timestamp)
      };

      currentState.orders.set(order.id, order);

      // Update daily summary
      const dateKey = order.createdAt.toISOString().split('T')[0];
      const dailySummary = currentState.dailySummaries.get(dateKey) || {
        date: dateKey,
        orderCount: 0,
        revenue: 0
      };

      dailySummary.orderCount++;
      dailySummary.revenue += order.amount;
      currentState.dailySummaries.set(dateKey, dailySummary);

      // Update stats
      currentState.stats.totalOrders = currentState.orders.size;
      currentState.stats.totalRevenue += order.amount;
      currentState.stats.lastUpdated = new Date();

      this.setState(currentState);

      // Record success with circuit breaker
      await this.circuitBreakerCapability.recordSuccess();

      console.log(`Order processed: ${order.id}`);

    } catch (error) {
      // Record failure with circuit breaker
      await this.circuitBreakerCapability.recordFailure();
      
      const currentState = this.getState();
      currentState.stats.errorCount++;
      this.setState(currentState);

      console.error(`Error processing order event:`, error);
      throw error;
    }
  }

  // Query methods
  getOrder(orderId: string): any | undefined {
    const state = this.getState();
    return state.orders.get(orderId);
  }

  getDailySummary(date: string): any | undefined {
    const state = this.getState();
    return state.dailySummaries.get(date);
  }

  getProjectionHealth(): any {
    const state = this.getState();
    return {
      ...state.stats,
      circuitBreakerState: this.circuitBreakerCapability.getState(),
      lastCheckpoint: this.checkpointCapability.getLastCheckpointTime()
    };
  }

  async createManualCheckpoint(): Promise<void> {
    await this.checkpointCapability.createCheckpoint(this.getState());
  }
}
```

## Module Configuration

### Basic Module Setup

```typescript
// projection.module.ts
import { Module } from '@nestjs/common';
import { BasicProjectionService } from './basic-projection.service';
import { EnhancedProjectionService } from './enhanced-projection.service';
import { EventProcessorService } from './event-processor.service';
import { ProjectionApiController } from './projection-api.controller';

@Module({
  providers: [
    BasicProjectionService,
    EnhancedProjectionService,
    EventProcessorService
  ],
  controllers: [ProjectionApiController],
  exports: [
    BasicProjectionService,
    EnhancedProjectionService,
    EventProcessorService
  ]
})
export class ProjectionModule {}
```

### Application Module Integration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ProjectionModule } from './projection/projection.module';

@Module({
  imports: [ProjectionModule],
})
export class AppModule {}
```

## Testing Patterns

### Unit Testing

```typescript
// projection.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BasicProjectionService } from './basic-projection.service';
import { IDomainEvent } from '@vytches-ddd/events';

describe('BasicProjectionService', () => {
  let service: BasicProjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BasicProjectionService],
    }).compile();

    service = module.get<BasicProjectionService>(BasicProjectionService);
    await service.onModuleInit();
  });

  it('should process item created event', async () => {
    const event: IDomainEvent = {
      eventId: 'test-1',
      eventType: 'ItemCreated',
      aggregateId: 'item-123',
      payload: {
        id: 'item-123',
        name: 'Test Item',
        category: 'test'
      },
      timestamp: new Date(),
      version: 1
    };

    await service.handle(event);

    const item = service.getItem('item-123');
    expect(item).toBeDefined();
    expect(item.name).toBe('Test Item');

    const stats = service.getStats();
    expect(stats.totalItems).toBe(1);
  });
});
```

### Integration Testing

```typescript
// projection-integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionModule } from './projection.module';
import { EventProcessorService } from './event-processor.service';
import { BasicProjectionService } from './basic-projection.service';

describe('Projection Integration', () => {
  let eventProcessor: EventProcessorService;
  let projection: BasicProjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ProjectionModule],
    }).compile();

    eventProcessor = module.get<EventProcessorService>(EventProcessorService);
    projection = module.get<BasicProjectionService>(BasicProjectionService);
  });

  it('should process events through the pipeline', async () => {
    const event = {
      eventId: 'integration-1',
      eventType: 'ItemCreated',
      aggregateId: 'item-integration',
      payload: {
        id: 'item-integration',
        name: 'Integration Test Item'
      },
      timestamp: new Date(),
      version: 1
    };

    await eventProcessor.processEvent(event);

    const item = projection.getItem('item-integration');
    expect(item).toBeDefined();
    expect(item.name).toBe('Integration Test Item');
  });
});
```

## Error Handling Patterns

### Service-Level Error Handling

```typescript
// error-handling-projection.service.ts
import { Injectable } from '@nestjs/common';
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class ErrorHandlingProjectionService extends ProjectionBase<any> {
  
  constructor() {
    super('ErrorHandlingProjection', 'v1.0');
  }

  @EventHandler('RiskyEvent')
  async onRiskyEvent(event: IDomainEvent): Promise<void> {
    try {
      // Potentially failing operation
      await this.processRiskyOperation(event);
    } catch (error) {
      // Log error with context
      console.error(`Failed to process risky event ${event.eventId}:`, {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error: error.message,
        timestamp: new Date()
      });

      // Update error statistics
      const state = this.getState();
      state.errorCount = (state.errorCount || 0) + 1;
      state.lastError = {
        eventId: event.eventId,
        error: error.message,
        timestamp: new Date()
      };
      this.setState(state);

      // Re-throw for upstream error handling
      throw error;
    }
  }

  private async processRiskyOperation(event: IDomainEvent): Promise<void> {
    // Simulate risky operation
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Random processing failure');
    }
    
    console.log(`Successfully processed risky event: ${event.eventId}`);
  }

  getErrorStats(): any {
    const state = this.getState();
    return {
      errorCount: state.errorCount || 0,
      lastError: state.lastError || null
    };
  }
}
```

## Performance Considerations

### Batch Processing

```typescript
// batch-processing-projection.service.ts
import { Injectable } from '@nestjs/common';
import { ProjectionBase } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class BatchProcessingProjectionService extends ProjectionBase<any> {
  private eventQueue: IDomainEvent[] = [];
  private batchSize = 10;
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super('BatchProcessingProjection', 'v1.0');
  }

  async handle(event: IDomainEvent): Promise<void> {
    // Add event to queue
    this.eventQueue.push(event);

    // Process batch if size reached
    if (this.eventQueue.length >= this.batchSize) {
      await this.processBatch();
    } else {
      // Set timeout for batch processing
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      this.batchTimeout = setTimeout(async () => {
        if (this.eventQueue.length > 0) {
          await this.processBatch();
        }
      }, 1000); // 1 second timeout
    }
  }

  private async processBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0);
    console.log(`Processing batch of ${batch.length} events`);

    try {
      // Process all events in batch
      for (const event of batch) {
        await this.processSingleEvent(event);
      }

      console.log(`Batch processed successfully`);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Could implement retry logic here
      throw error;
    } finally {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
    }
  }

  private async processSingleEvent(event: IDomainEvent): Promise<void> {
    // Process individual event
    const state = this.getState();
    state.eventsProcessed = (state.eventsProcessed || 0) + 1;
    this.setState(state);
  }
}
```

## Best Practices

### 1. **Service Design**
- Use NestJS lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`)
- Implement proper error handling and logging
- Design services to be easily testable
- Use dependency injection for service composition

### 2. **State Management**
- Initialize projection state in constructor
- Use immutable state updates where possible
- Implement proper state validation
- Consider state size and memory usage

### 3. **Event Handling**
- Use `@EventHandler` decorator for clarity
- Implement idempotent event processing
- Handle missing or invalid event data gracefully
- Log significant events for debugging

### 4. **Performance**
- Consider batch processing for high-throughput scenarios
- Use appropriate data structures for queries
- Monitor projection performance and memory usage
- Implement proper cleanup for long-running projections

### 5. **Testing**
- Write comprehensive unit tests for event handlers
- Test error scenarios and edge cases
- Use integration tests for end-to-end validation
- Mock external dependencies appropriately

## Common Pitfalls

- **Memory Leaks**: Not properly cleaning up subscriptions and timers
- **State Corruption**: Direct mutation of projection state
- **Error Propagation**: Not handling errors at appropriate levels
- **Event Ordering**: Assuming events arrive in specific order
- **Resource Cleanup**: Not implementing proper cleanup in `OnModuleDestroy`

## Related Examples

- [Simple User Profile Projection](./example-1.md)
- [Order Summary with Capabilities](./example-2.md)
- [Advanced Projection Engine](../intermediate/example-1.md)