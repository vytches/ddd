# Event Store - NestJS Intermediate DI Integration

**Focus**: Advanced Event Store usage with @vytches-ddd/di integration
**Base Example**: [Event Store Intermediate Implementation](../../../intermediate/implementation.md)
**Dependencies**: @nestjs/common, @vytches-ddd/event-store, @vytches-ddd/di

## Service Implementation

```typescript
// event-store.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EnterpriseEventStoreService } from '../../../intermediate/implementation';
import { ProjectionEngine, OrderSummaryProjection } from '../../../intermediate/implementation';
import { DomainEvent } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { OrderData, ProjectionState } from './types'; // From your app

@Injectable()
export class EventStoreService implements OnModuleInit {
  private readonly enterpriseEventStore: EnterpriseEventStoreService;
  private readonly projectionEngine: ProjectionEngine;

  constructor() {
    // ⭐ FOCUS: @vytches-ddd/di integration
    this.enterpriseEventStore = VytchesDDD.resolve<EnterpriseEventStoreService>('enterpriseEventStore');
    this.projectionEngine = VytchesDDD.resolve<ProjectionEngine>('projectionEngine');
  }

  async onModuleInit() {
    // ⭐ FOCUS: Setup projections during module initialization
    this.projectionEngine.registerProjection(new OrderSummaryProjection());
  }

  // ✅ FOCUS: Thin wrapper around enterprise event store
  async appendEventsWithProjections(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number = -1
  ): Promise<Result<void, Error>> {
    try {
      return await this.enterpriseEventStore.appendEvents(
        streamId, 
        events, 
        expectedVersion
      );
    } catch (error) {
      throw new Error(`Events append with projections failed: ${error.message}`);
    }
  }

  async readEventsWithOptions(
    streamId: string,
    options: ReadEventOptions = {}
  ): Promise<Result<EventReadResult, Error>> {
    try {
      return await this.enterpriseEventStore.readEvents(streamId, options);
    } catch (error) {
      throw new Error(`Events read failed: ${error.message}`);
    }
  }

  async getOrderSummary(): Promise<Result<OrderSummaryState, Error>> {
    try {
      return await this.enterpriseEventStore.getProjectionState<OrderSummaryState>(
        'OrderSummaryProjection'
      );
    } catch (error) {
      throw new Error(`Order summary retrieval failed: ${error.message}`);
    }
  }

  async rebuildOrderSummary(fromDate?: Date): Promise<Result<void, Error>> {
    try {
      return await this.enterpriseEventStore.rebuildProjection(
        'OrderSummaryProjection',
        fromDate
      );
    } catch (error) {
      throw new Error(`Order summary rebuild failed: ${error.message}`);
    }
  }

  async getSystemHealth(): Promise<HealthStatus> {
    try {
      return await this.enterpriseEventStore.getHealthStatus();
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}
```

## Advanced Order Service

```typescript
// advanced-order.service.ts
import { Injectable } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { OrderCreatedEvent, OrderStatusChangedEvent, OrderData } from './types'; // From your app

@Injectable()
export class AdvancedOrderService {
  constructor(private readonly eventStore: EventStoreService) {}

  async createOrderWithProjection(orderData: OrderData): Promise<void> {
    // ⭐ FOCUS: Create order with automatic projection updates
    const events = [
      new OrderCreatedEvent(
        orderData.orderId,
        orderData.customerId,
        orderData.items,
        orderData.total,
        new Date()
      )
    ];

    const result = await this.eventStore.appendEventsWithProjections(
      `order-${orderData.orderId}`,
      events
    );

    if (result.isFailure()) {
      throw new Error(`Order creation with projection failed: ${result.error.message}`);
    }
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: string,
    previousStatus: string,
    expectedVersion: number
  ): Promise<void> {
    const event = new OrderStatusChangedEvent(
      orderId,
      newStatus,
      previousStatus,
      new Date()
    );

    const result = await this.eventStore.appendEventsWithProjections(
      `order-${orderId}`,
      [event],
      expectedVersion
    );

    if (result.isFailure()) {
      throw new Error(`Order status update failed: ${result.error.message}`);
    }
  }

  async getOrderAnalytics(): Promise<OrderAnalytics> {
    const summaryResult = await this.eventStore.getOrderSummary();
    
    if (summaryResult.isSuccess() && summaryResult.value) {
      const summary = summaryResult.value;
      return {
        totalOrders: summary.totalOrders,
        totalRevenue: summary.totalRevenue,
        averageOrderValue: summary.averageOrderValue,
        ordersByStatus: summary.ordersByStatus,
        topCustomers: this.getTopCustomers(summary.ordersByCustomer),
        lastUpdated: summary.lastUpdated
      };
    }

    throw new Error('Failed to retrieve order analytics');
  }

  async rebuildAnalytics(fromDate?: Date): Promise<void> {
    const result = await this.eventStore.rebuildOrderSummary(fromDate);
    
    if (result.isFailure()) {
      throw new Error(`Analytics rebuild failed: ${result.error.message}`);
    }
  }

  private getTopCustomers(customerOrders: Record<string, number>): Array<{ customerId: string; orderCount: number }> {
    return Object.entries(customerOrders)
      .map(([customerId, orderCount]) => ({ customerId, orderCount }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
  }
}
```

## Module Configuration with DI Setup

```typescript
// event-store.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { EventStoreService } from './event-store.service';
import { AdvancedOrderService } from './advanced-order.service';
import { EnterpriseEventStoreService, ProjectionEngine } from '../../../intermediate/implementation';

@Module({
  providers: [
    EventStoreService,
    AdvancedOrderService
  ],
  exports: [EventStoreService, AdvancedOrderService]
})
export class EventStoreModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    const container = new SimpleContainer();
    
    // Register enterprise event store services
    container.registerInstance('enterpriseEventStore', new EnterpriseEventStoreService());
    container.registerInstance('projectionEngine', new ProjectionEngine());
    
    await VytchesDDD.configure(container);
  }
}
```

## Health Check Controller

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { HealthStatus } from './types'; // From your app

@Controller('health')
export class HealthController {
  constructor(private readonly eventStore: EventStoreService) {}

  @Get('event-store')
  async getEventStoreHealth(): Promise<HealthStatus> {
    return await this.eventStore.getSystemHealth();
  }
}
```

**Key Points:**
- Advanced DI integration with @vytches-ddd/di
- Service locator pattern usage
- Enterprise-grade dependency management
- Projection system integration
- Health monitoring capabilities
- Optimistic concurrency control support