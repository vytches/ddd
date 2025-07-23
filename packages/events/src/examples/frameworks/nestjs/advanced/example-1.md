# Event System - NestJS Advanced Integration

**Version**: 1.0.0
**Package**: @vytches-ddd/events
**Complexity**: advanced
**Domain**: Integration
**Patterns**: event-sourcing, event-mesh, complex-event-processing, microservices-coordination
**Dependencies**: @nestjs/common, @vytches-ddd/events, @vytches-ddd/event-store, @vytches-ddd/di, @vytches-ddd/resilience

## Description

Enterprise-grade NestJS integration with event sourcing, event mesh architecture, and complex event processing. This example demonstrates sophisticated patterns for microservices coordination, cross-service event propagation, and advanced event-driven architectures.

## Business Context

Large-scale enterprise applications require sophisticated event architectures that can handle complex business workflows, coordinate across multiple microservices, and maintain complete audit trails. This includes scenarios like order orchestration across multiple services, real-time analytics, and complex business process automation.

## Code Example

```typescript
// event-sourced-order.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { UnifiedEventBus, EventStore } from '@vytches-ddd/events';
import { CircuitBreaker, RetryPolicy } from '@vytches-ddd/resilience';
import { Logger } from '@vytches-ddd/logging';
import { Order, OrderAggregate, OrderSnapshot } from './types'; // From your app

@DomainService({
  serviceId: 'eventSourcedOrderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement'
})
export class EventSourcedOrderService {
  private readonly logger = Logger.forContext('EventSourcedOrderService');
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly eventStore: EventStore,
    private readonly snapshotStore: SnapshotStore,
    private readonly eventBus: UnifiedEventBus
  ) {
    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  async createOrder(orderData: CreateOrderData, correlationId: string): Promise<OrderAggregate> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // ⭐ FOCUS: Event sourced aggregate creation
        const order = OrderAggregate.create(orderData, correlationId);
        
        // Save events to event store
        const events = order.getUncommittedEvents();
        await this.eventStore.saveEvents(
          order.id.value,
          events,
          order.version
        );

        // ⭐ FOCUS: Publish events through unified event bus
        for (const event of events) {
          await this.eventBus.publish(event);
        }

        order.markEventsAsCommitted();
        
        this.logger.info('Order created with event sourcing', {
          orderId: order.id.value,
          eventCount: events.length,
          correlationId
        });

        return order;
      });
    } catch (error) {
      this.logger.error('Failed to create order', { error, orderData });
      throw new Error(`Order creation failed: ${error.message}`);
    }
  }

  async rehydrateOrder(orderId: string): Promise<OrderAggregate | null> {
    try {
      // ⭐ FOCUS: Load from snapshot + events for performance
      const snapshot = await this.snapshotStore.getLatestSnapshot<OrderSnapshot>(orderId);
      let fromVersion = 0;
      let order: OrderAggregate;

      if (snapshot.isSuccess() && snapshot.value) {
        // Reconstruct from snapshot
        order = OrderAggregate.fromSnapshot(snapshot.value);
        fromVersion = snapshot.value.version;
      } else {
        // Start from empty aggregate
        order = OrderAggregate.createEmpty(orderId);
      }

      // ⭐ FOCUS: Load and apply events after snapshot
      const eventsResult = await this.eventStore.getEventsForAggregate(orderId, fromVersion + 1);
      
      if (eventsResult.isSuccess()) {
        const events = eventsResult.value;
        
        for (const event of events) {
          order.applyEvent(event);
        }

        order.markEventsAsCommitted();
        
        // ⭐ FOCUS: Create snapshot if threshold reached
        if (order.shouldCreateSnapshot()) {
          const snapshot = order.createSnapshot();
          await this.snapshotStore.saveSnapshot(snapshot);
        }
      }

      return order.version > 0 ? order : null;
    } catch (error) {
      this.logger.error('Failed to rehydrate order', { error, orderId });
      throw new Error(`Order rehydration failed: ${error.message}`);
    }
  }

  async processOrderWorkflow(
    orderId: string, 
    action: OrderAction, 
    correlationId: string
  ): Promise<OrderAggregate> {
    try {
      const order = await this.rehydrateOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // ⭐ FOCUS: Business logic that generates domain events
      switch (action.type) {
        case 'PROCESS_PAYMENT':
          order.processPayment(action.paymentDetails);
          break;
        case 'RESERVE_INVENTORY':
          order.reserveInventory(action.inventoryDetails);
          break;
        case 'SHIP_ORDER':
          order.shipOrder(action.shippingDetails);
          break;
        case 'COMPLETE_ORDER':
          order.completeOrder();
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // ⭐ FOCUS: Persist new events and publish
      const newEvents = order.getUncommittedEvents();
      if (newEvents.length > 0) {
        await this.eventStore.saveEvents(orderId, newEvents, order.version - newEvents.length);
        
        // Publish events with correlation tracking
        for (const event of newEvents) {
          event.correlationId = correlationId;
          await this.eventBus.publish(event);
        }

        order.markEventsAsCommitted();
      }

      return order;
    } catch (error) {
      this.logger.error('Failed to process order workflow', { error, orderId, action });
      throw new Error(`Order workflow failed: ${error.message}`);
    }
  }
}

// event-mesh.service.ts
import { DomainService } from '@vytches-ddd/di';
import { UnifiedEventBus, DomainEvent } from '@vytches-ddd/events';
import { Logger } from '@vytches-ddd/logging';

@DomainService('eventMeshService')
export class EventMeshService {
  private readonly logger = Logger.forContext('EventMeshService');
  private readonly routingTable = new Map<string, string[]>();
  private readonly serviceHealth = new Map<string, boolean>();

  constructor(private readonly eventBus: UnifiedEventBus) {
    this.initializeRoutes();
    this.setupCrossServiceEventHandling();
  }

  private initializeRoutes(): void {
    // ⭐ FOCUS: Event routing configuration for microservices
    this.routingTable.set('OrderCreated', ['payment-service', 'inventory-service', 'notification-service']);
    this.routingTable.set('PaymentProcessed', ['order-service', 'accounting-service']);
    this.routingTable.set('InventoryReserved', ['order-service', 'warehouse-service']);
    this.routingTable.set('OrderShipped', ['order-service', 'tracking-service', 'notification-service']);
    this.routingTable.set('OrderCompleted', ['analytics-service', 'recommendation-service']);
  }

  private setupCrossServiceEventHandling(): void {
    // ⭐ FOCUS: Complex event processing across services
    this.eventBus.subscribe('OrderCreated', async (event) => {
      await this.orchestrateOrderCreation(event);
    });

    this.eventBus.subscribe('PaymentProcessed', async (event) => {
      if (event.status === 'successful') {
        await this.triggerInventoryReservation(event);
      } else {
        await this.handlePaymentFailure(event);
      }
    });

    this.eventBus.subscribe('InventoryReserved', async (event) => {
      await this.triggerOrderFulfillment(event);
    });

    // ⭐ FOCUS: Saga-like pattern for complex workflows
    this.eventBus.subscribe('OrderWorkflowCompleted', async (event) => {
      await this.finalizeOrderProcess(event);
    });
  }

  async orchestrateOrderCreation(event: OrderCreatedEvent): Promise<void> {
    try {
      const correlationId = event.correlationId || event.eventId;
      
      this.logger.info('Orchestrating order creation across services', {
        orderId: event.orderId,
        correlationId
      });

      // ⭐ FOCUS: Parallel service coordination
      const servicePromises = [
        this.initiatePaymentProcessing(event, correlationId),
        this.initiateInventoryCheck(event, correlationId),
        this.sendOrderConfirmation(event, correlationId)
      ];

      const results = await Promise.allSettled(servicePromises);
      
      // ⭐ FOCUS: Handle partial failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        await this.handleOrchestrationFailure(event, failures);
      }

    } catch (error) {
      this.logger.error('Order orchestration failed', {
        error,
        orderId: event.orderId
      });
      throw error;
    }
  }

  private async initiatePaymentProcessing(event: OrderCreatedEvent, correlationId: string): Promise<void> {
    // ⭐ FOCUS: Cross-service command dispatch
    const paymentCommand = new ProcessPaymentCommand(
      event.orderId,
      event.paymentDetails,
      correlationId
    );

    await this.eventBus.publish(paymentCommand);
    
    this.logger.debug('Payment processing initiated', {
      orderId: event.orderId,
      correlationId
    });
  }

  private async initiateInventoryCheck(event: OrderCreatedEvent, correlationId: string): Promise<void> {
    const inventoryCommand = new ReserveInventoryCommand(
      event.orderId,
      event.items,
      correlationId
    );

    await this.eventBus.publish(inventoryCommand);
    
    this.logger.debug('Inventory reservation initiated', {
      orderId: event.orderId,
      itemCount: event.items.length,
      correlationId
    });
  }

  private async sendOrderConfirmation(event: OrderCreatedEvent, correlationId: string): Promise<void> {
    const confirmationEvent = new OrderConfirmationRequestedEvent(
      event.orderId,
      event.customerId,
      correlationId
    );

    await this.eventBus.publish(confirmationEvent);
  }

  private async triggerInventoryReservation(event: PaymentProcessedEvent): Promise<void> {
    // ⭐ FOCUS: Event-driven state machine progression
    this.logger.info('Payment successful, triggering inventory reservation', {
      orderId: event.orderId,
      paymentId: event.paymentId
    });

    // Complex business logic based on payment type and order details
    const reservationEvent = new InventoryReservationTriggeredEvent(
      event.orderId,
      event.correlationId
    );

    await this.eventBus.publish(reservationEvent);
  }

  private async handlePaymentFailure(event: PaymentProcessedEvent): Promise<void> {
    this.logger.warn('Payment failed, initiating compensation', {
      orderId: event.orderId,
      reason: event.failureReason
    });

    // ⭐ FOCUS: Compensation pattern
    const compensationEvent = new OrderCancellationInitiatedEvent(
      event.orderId,
      'payment_failed',
      event.correlationId
    );

    await this.eventBus.publish(compensationEvent);
  }

  private async triggerOrderFulfillment(event: InventoryReservedEvent): Promise<void> {
    this.logger.info('Inventory reserved, triggering fulfillment', {
      orderId: event.orderId,
      reservationId: event.reservationId
    });

    const fulfillmentEvent = new OrderFulfillmentTriggeredEvent(
      event.orderId,
      event.reservationId,
      event.correlationId
    );

    await this.eventBus.publish(fulfillmentEvent);
  }

  private async finalizeOrderProcess(event: OrderWorkflowCompletedEvent): Promise<void> {
    // ⭐ FOCUS: Analytics and recommendations trigger
    await Promise.all([
      this.updateAnalytics(event),
      this.triggerRecommendations(event),
      this.updateCustomerMetrics(event)
    ]);
  }

  private async handleOrchestrationFailure(
    originalEvent: OrderCreatedEvent, 
    failures: PromiseRejectedResult[]
  ): Promise<void> {
    this.logger.error('Order orchestration had failures', {
      orderId: originalEvent.orderId,
      failureCount: failures.length,
      failures: failures.map(f => f.reason?.message)
    });

    // ⭐ FOCUS: Publish failure event for compensation
    const failureEvent = new OrderOrchestrationFailedEvent(
      originalEvent.orderId,
      failures.map(f => f.reason?.message || 'Unknown error'),
      originalEvent.correlationId
    );

    await this.eventBus.publish(failureEvent);
  }

  private async updateAnalytics(event: OrderWorkflowCompletedEvent): Promise<void> {
    // Send to analytics service
  }

  private async triggerRecommendations(event: OrderWorkflowCompletedEvent): Promise<void> {
    // Trigger recommendation engine
  }

  private async updateCustomerMetrics(event: OrderWorkflowCompletedEvent): Promise<void> {
    // Update customer lifetime value, order patterns, etc.
  }
}

// complex-event-processor.service.ts
import { DomainService } from '@vytches-ddd/di';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { Logger } from '@vytches-ddd/logging';

@DomainService('complexEventProcessor')
export class ComplexEventProcessorService {
  private readonly logger = Logger.forContext('ComplexEventProcessor');
  private readonly eventPatterns = new Map<string, any>();
  private readonly correlationStore = new Map<string, any[]>();

  constructor(private readonly eventBus: UnifiedEventBus) {
    this.setupComplexEventProcessing();
  }

  private setupComplexEventProcessing(): void {
    // ⭐ FOCUS: Pattern matching for complex business events
    this.setupOrderCompletionPattern();
    this.setupFraudDetectionPattern();
    this.setupCustomerJourneyPattern();
  }

  private setupOrderCompletionPattern(): void {
    // ⭐ FOCUS: Monitor complete order workflow
    const requiredEvents = ['OrderCreated', 'PaymentProcessed', 'InventoryReserved', 'OrderShipped'];
    
    requiredEvents.forEach(eventType => {
      this.eventBus.subscribe(eventType, async (event) => {
        await this.trackEventPattern('order_completion', event, requiredEvents);
      });
    });
  }

  private setupFraudDetectionPattern(): void {
    // ⭐ FOCUS: Real-time fraud pattern detection
    const suspiciousEvents = ['HighValueOrder', 'MultiplePaymentAttempts', 'VelocityExceeded'];
    
    suspiciousEvents.forEach(eventType => {
      this.eventBus.subscribe(eventType, async (event) => {
        await this.trackEventPattern('fraud_detection', event, suspiciousEvents);
      });
    });
  }

  private setupCustomerJourneyPattern(): void {
    // ⭐ FOCUS: Track customer lifecycle events
    const journeyEvents = ['CustomerRegistered', 'FirstPurchase', 'SubscriptionUpgrade', 'ChurnRisk'];
    
    journeyEvents.forEach(eventType => {
      this.eventBus.subscribe(eventType, async (event) => {
        await this.trackEventPattern('customer_journey', event, journeyEvents);
      });
    });
  }

  private async trackEventPattern(
    patternName: string, 
    event: DomainEvent, 
    requiredEvents: string[]
  ): Promise<void> {
    const correlationId = event.correlationId || event.aggregateId;
    const key = `${patternName}:${correlationId}`;
    
    // ⭐ FOCUS: Correlation-based event tracking
    if (!this.correlationStore.has(key)) {
      this.correlationStore.set(key, []);
    }
    
    const events = this.correlationStore.get(key)!;
    events.push(event);
    
    // ⭐ FOCUS: Check if pattern is complete
    const eventTypes = new Set(events.map(e => e.eventType));
    const isPatternComplete = requiredEvents.every(required => eventTypes.has(required));
    
    if (isPatternComplete) {
      await this.handlePatternCompletion(patternName, correlationId, events);
      
      // Cleanup completed pattern
      this.correlationStore.delete(key);
    }
    
    // ⭐ FOCUS: Timeout handling for incomplete patterns
    this.schedulePatternTimeout(key, 5 * 60 * 1000); // 5 minute timeout
  }

  private async handlePatternCompletion(
    patternName: string, 
    correlationId: string, 
    events: DomainEvent[]
  ): Promise<void> {
    this.logger.info('Complex event pattern completed', {
      pattern: patternName,
      correlationId,
      eventCount: events.length,
      duration: events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime()
    });

    // ⭐ FOCUS: Pattern-specific handling
    switch (patternName) {
      case 'order_completion':
        await this.handleOrderCompletionPattern(correlationId, events);
        break;
      case 'fraud_detection':
        await this.handleFraudDetectionPattern(correlationId, events);
        break;
      case 'customer_journey':
        await this.handleCustomerJourneyPattern(correlationId, events);
        break;
    }
  }

  private async handleOrderCompletionPattern(correlationId: string, events: DomainEvent[]): Promise<void> {
    // ⭐ FOCUS: Publish high-level business event
    const completionEvent = new OrderWorkflowCompletedEvent(
      correlationId,
      events,
      this.calculateWorkflowMetrics(events)
    );
    
    await this.eventBus.publish(completionEvent);
  }

  private async handleFraudDetectionPattern(correlationId: string, events: DomainEvent[]): Promise<void> {
    // ⭐ FOCUS: High-priority fraud alert
    const fraudScore = this.calculateFraudScore(events);
    
    if (fraudScore > 0.8) {
      const alertEvent = new FraudAlertEvent(
        correlationId,
        fraudScore,
        events,
        'HIGH_RISK'
      );
      
      await this.eventBus.publish(alertEvent);
    }
  }

  private async handleCustomerJourneyPattern(correlationId: string, events: DomainEvent[]): Promise<void> {
    const journeyMetrics = this.calculateJourneyMetrics(events);
    
    const journeyEvent = new CustomerJourneyCompletedEvent(
      correlationId,
      journeyMetrics,
      events
    );
    
    await this.eventBus.publish(journeyEvent);
  }

  private calculateWorkflowMetrics(events: DomainEvent[]): any {
    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;
    
    return {
      totalDuration: endTime.getTime() - startTime.getTime(),
      stepCount: events.length,
      averageStepTime: (endTime.getTime() - startTime.getTime()) / events.length
    };
  }

  private calculateFraudScore(events: DomainEvent[]): number {
    // Simple fraud scoring algorithm
    let score = 0;
    
    events.forEach(event => {
      switch (event.eventType) {
        case 'HighValueOrder':
          score += 0.3;
          break;
        case 'MultiplePaymentAttempts':
          score += 0.5;
          break;
        case 'VelocityExceeded':
          score += 0.4;
          break;
      }
    });
    
    return Math.min(score, 1.0);
  }

  private calculateJourneyMetrics(events: DomainEvent[]): any {
    return {
      touchpoints: events.length,
      journeyDuration: events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime(),
      conversionEvents: events.filter(e => e.eventType.includes('Purchase')).length
    };
  }

  private schedulePatternTimeout(key: string, timeoutMs: number): void {
    setTimeout(() => {
      if (this.correlationStore.has(key)) {
        this.logger.warn('Event pattern timed out', { key, timeoutMs });
        this.correlationStore.delete(key);
      }
    }, timeoutMs);
  }
}

// advanced-order.controller.ts
import { Controller, Post, Put, Get, Body, Param, Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EventSourcedOrderService } from './event-sourced-order.service';
import { CreateOrderData, OrderAction } from './types'; // From your app

@Injectable()
@Controller('advanced-orders')
export class AdvancedOrderController {
  private readonly orderService: EventSourcedOrderService;

  constructor() {
    this.orderService = VytchesDDD.resolve<EventSourcedOrderService>(
      'eventSourcedOrderService',
      'OrderManagement'
    );
  }

  @Post()
  async createOrder(@Body() orderData: CreateOrderData) {
    const correlationId = `order-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const order = await this.orderService.createOrder(orderData, correlationId);
    
    return {
      orderId: order.id.value,
      status: order.status,
      correlationId,
      version: order.version
    };
  }

  @Put(':id/actions')
  async executeAction(
    @Param('id') orderId: string,
    @Body() action: OrderAction
  ) {
    const correlationId = `action-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const order = await this.orderService.processOrderWorkflow(orderId, action, correlationId);
    
    return {
      orderId: order.id.value,
      status: order.status,
      version: order.version,
      correlationId
    };
  }

  @Get(':id/history')
  async getOrderHistory(@Param('id') orderId: string) {
    // ⭐ FOCUS: Event sourcing benefits - complete audit trail
    const order = await this.orderService.rehydrateOrder(orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }

    return {
      orderId: order.id.value,
      currentVersion: order.version,
      status: order.status,
      // Could expand to include full event history
      eventCount: order.version
    };
  }
}

// app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { AdvancedOrderController } from './advanced-order.controller';

@Module({
  controllers: [AdvancedOrderController]
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ FOCUS: Enterprise-grade initialization with multiple contexts
    const orderContainer = new SimpleContainer();
    const analyticsContainer = new SimpleContainer();

    // Configure bounded contexts
    VytchesDDD.configureContext('OrderManagement', orderContainer);
    VytchesDDD.configureContext('Analytics', analyticsContainer);

    await VytchesDDD.configure(orderContainer);
  }
}
```

## Key Features

- **Event Sourcing**: Complete audit trails with aggregate reconstruction from events
- **Event Mesh**: Sophisticated routing and coordination across microservices
- **Complex Event Processing**: Pattern matching and correlation for business insights
- **Saga Patterns**: Long-running workflow coordination with compensation
- **Enterprise Integration**: Full NestJS integration with context isolation

## Enterprise Benefits

1. **Complete Auditability**: Every state change captured as immutable events
2. **Microservices Coordination**: Sophisticated cross-service orchestration
3. **Business Intelligence**: Real-time pattern matching and analytics
4. **Fault Tolerance**: Circuit breakers, retries, and compensation patterns
5. **Scalability**: Event-driven architecture supports horizontal scaling

## Performance Considerations

- **Snapshot Strategy**: Balance between snapshot frequency and reconstruction time
- **Event Store Optimization**: Use appropriate indexing and partitioning strategies
- **Circuit Breaker Tuning**: Configure thresholds based on service characteristics
- **Memory Management**: Monitor correlation stores and implement cleanup strategies

## Common Pitfalls

- **Event Schema Evolution**: Plan for event versioning and backward compatibility
- **Correlation Explosion**: Implement proper cleanup for incomplete patterns
- **Snapshot Overhead**: Don't create snapshots too frequently for write-heavy aggregates
- **Circuit Breaker Configuration**: Tune parameters for each service's characteristics
- **Memory Leaks**: Ensure proper cleanup of correlation and pattern tracking

## Related Examples

- [Event Sourcing with Snapshots](../../advanced/example-1.md)
- [Enterprise Event Mesh Architecture](../../advanced/example-3.md)
- [Event Stream Processing](../../advanced/example-2.md)