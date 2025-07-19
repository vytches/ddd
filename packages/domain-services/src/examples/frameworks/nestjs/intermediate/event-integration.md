# Event-Driven NestJS Service - Intermediate

**Focus**: Domain service with event publishing in NestJS
**Base Example**: [Event-Driven Domain Service](../../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @vytches-ddd/core, @vytches-ddd/events

## Service Implementation

```typescript
// order-event.service.ts
import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { EventHandler, IEventBus } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { 
  Order,
  OrderCreatedEvent,
  PaymentProcessedEvent,
  InventoryUpdatedEvent,
  OrderProcessingResult,
  IOrderRepository
} from '../types';

@Injectable()
export class OrderEventService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus
  ) {
    super('OrderEventService');
  }

  /**
   * Handles order created events
   */
  @EventHandler(OrderCreatedEvent)
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      console.log(`Processing order created event: ${event.orderId}`);
      
      // ⭐ FOCUS: Domain service event orchestration
      await this.updateOrderStatus(event.orderId, 'processing');
      await this.requestPaymentProcessing(event);
      await this.requestInventoryReservation(event);
      await this.scheduleNotifications(event);
      
    } catch (error) {
      console.error(`Order processing failed for ${event.orderId}:`, error);
      await this.handleOrderFailure(event.orderId, error);
    }
  }

  /**
   * Handles payment processed events
   */
  @EventHandler(PaymentProcessedEvent)
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    try {
      console.log(`Processing payment event: ${event.orderId}`);
      
      if (event.status === 'completed') {
        // ⭐ FOCUS: Event-driven decision making
        const fulfillmentReady = await this.checkFulfillmentReadiness(event.orderId);
        
        if (fulfillmentReady.isSuccess()) {
          await this.proceedWithFulfillment(event.orderId);
        }
      } else {
        await this.handlePaymentFailure(event.orderId, event.status);
      }
      
    } catch (error) {
      console.error(`Payment processing failed for ${event.orderId}:`, error);
      await this.handleOrderFailure(event.orderId, error);
    }
  }

  /**
   * Handles inventory updated events
   */
  @EventHandler(InventoryUpdatedEvent)
  async handleInventoryUpdated(event: InventoryUpdatedEvent): Promise<void> {
    try {
      console.log(`Processing inventory update: ${event.productId}`);
      
      // ⭐ FOCUS: Cross-aggregate event handling
      const affectedOrders = await this.findOrdersAffectedByInventory(event.productId);
      
      for (const order of affectedOrders) {
        await this.reevaluateOrderFulfillment(order.id);
      }
      
    } catch (error) {
      console.error(`Inventory update handling failed:`, error);
    }
  }

  /**
   * Initiates order fulfillment with event publishing
   */
  async initiateOrderFulfillment(orderId: string): Promise<Result<OrderProcessingResult, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId);
      
      if (!order) {
        return Result.failure(new Error(`Order not found: ${orderId}`));
      }
      
      if (order.status !== 'confirmed') {
        return Result.failure(new Error(`Order not ready for fulfillment: ${order.status}`));
      }
      
      // ⭐ FOCUS: Event publishing through domain service
      await this.publishFulfillmentInitiated(order);
      
      const result: OrderProcessingResult = {
        orderId: order.id,
        status: order.status,
        inventoryUpdates: [],
        notifications: []
      };
      
      return Result.success(result);
      
    } catch (error) {
      return Result.failure(new Error(`Fulfillment initiation failed: ${error.message}`));
    }
  }

  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      await this.orderRepository.save(order);
      
      // ⭐ FOCUS: Event publishing for status changes
      await this.publishOrderStatusChanged(order);
    }
  }

  private async requestPaymentProcessing(event: OrderCreatedEvent): Promise<void> {
    const paymentRequestEvent = {
      eventType: 'PaymentRequested',
      orderId: event.orderId,
      amount: event.totalAmount,
      timestamp: new Date(),
      metadata: {
        requestedBy: 'OrderEventService',
        originalEvent: event.eventType
      }
    };
    
    // ⭐ FOCUS: Event bus integration
    await this.eventBus.publish(paymentRequestEvent);
  }

  private async requestInventoryReservation(event: OrderCreatedEvent): Promise<void> {
    for (const item of event.items) {
      const reservationEvent = {
        eventType: 'InventoryReservationRequested',
        orderId: event.orderId,
        productId: item.productId,
        quantity: item.quantity,
        timestamp: new Date(),
        metadata: {
          requestedBy: 'OrderEventService',
          originalEvent: event.eventType
        }
      };
      
      // ⭐ FOCUS: Multiple event publishing
      await this.eventBus.publish(reservationEvent);
    }
  }

  private async scheduleNotifications(event: OrderCreatedEvent): Promise<void> {
    const notificationEvents = [
      {
        eventType: 'NotificationScheduled',
        orderId: event.orderId,
        userId: event.userId,
        type: 'order_confirmation',
        channel: 'email',
        timestamp: new Date()
      },
      {
        eventType: 'NotificationScheduled',
        orderId: event.orderId,
        userId: event.userId,
        type: 'order_confirmation',
        channel: 'sms',
        timestamp: new Date()
      }
    ];
    
    // ⭐ FOCUS: Batch event publishing
    await this.eventBus.publishMany(notificationEvents);
  }

  private async checkFulfillmentReadiness(orderId: string): Promise<Result<boolean, Error>> {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) {
      return Result.failure(new Error(`Order not found: ${orderId}`));
    }
    
    // Query other services through events
    const paymentCompleted = await this.isPaymentCompleted(orderId);
    const inventoryReserved = await this.isInventoryReserved(orderId);
    
    return Result.success(paymentCompleted && inventoryReserved);
  }

  private async proceedWithFulfillment(orderId: string): Promise<void> {
    await this.updateOrderStatus(orderId, 'processing');
    
    const fulfillmentEvent = {
      eventType: 'FulfillmentStarted',
      orderId,
      timestamp: new Date(),
      metadata: {
        triggeredBy: 'PaymentProcessedEvent',
        processor: 'OrderEventService'
      }
    };
    
    await this.eventBus.publish(fulfillmentEvent);
  }

  private async handlePaymentFailure(orderId: string, status: string): Promise<void> {
    await this.updateOrderStatus(orderId, 'cancelled');
    
    const failureEvent = {
      eventType: 'OrderCancelled',
      orderId,
      reason: `Payment failed with status: ${status}`,
      timestamp: new Date(),
      metadata: {
        failureType: 'payment_failure',
        originalStatus: status
      }
    };
    
    await this.eventBus.publish(failureEvent);
  }

  private async handleOrderFailure(orderId: string, error: Error): Promise<void> {
    await this.updateOrderStatus(orderId, 'failed');
    
    const failureEvent = {
      eventType: 'OrderFailed',
      orderId,
      error: error.message,
      timestamp: new Date(),
      metadata: {
        failureType: 'processing_error',
        errorMessage: error.message
      }
    };
    
    await this.eventBus.publish(failureEvent);
  }

  private async publishFulfillmentInitiated(order: Order): Promise<void> {
    const event = {
      eventType: 'FulfillmentInitiated',
      orderId: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      timestamp: new Date(),
      metadata: {
        initiatedBy: 'OrderEventService',
        orderCreatedAt: order.createdAt.toISOString()
      }
    };
    
    await this.eventBus.publish(event);
  }

  private async publishOrderStatusChanged(order: Order): Promise<void> {
    const event = {
      eventType: 'OrderStatusChanged',
      orderId: order.id,
      status: order.status,
      previousStatus: 'pending', // In real implementation, track previous status
      timestamp: new Date(),
      metadata: {
        changedBy: 'OrderEventService',
        orderTotal: order.totalAmount
      }
    };
    
    await this.eventBus.publish(event);
  }

  private async findOrdersAffectedByInventory(productId: string): Promise<Order[]> {
    // In real implementation, this would query for orders with the affected product
    const orders = await this.orderRepository.findByProductId(productId);
    return orders.filter(order => order.status === 'pending' || order.status === 'processing');
  }

  private async reevaluateOrderFulfillment(orderId: string): Promise<void> {
    const reevaluationEvent = {
      eventType: 'OrderReevaluationRequested',
      orderId,
      timestamp: new Date(),
      metadata: {
        trigger: 'inventory_update',
        requestedBy: 'OrderEventService'
      }
    };
    
    await this.eventBus.publish(reevaluationEvent);
  }

  private async isPaymentCompleted(orderId: string): Promise<boolean> {
    // In real implementation, query payment service or check events
    return true;
  }

  private async isInventoryReserved(orderId: string): Promise<boolean> {
    // In real implementation, query inventory service or check events
    return true;
  }
}
```

## Controller Integration

```typescript
// order-event.controller.ts
import { Controller, Post, Body, Param } from '@nestjs/common';
import { OrderEventService } from './order-event.service';
import { OrderCreatedEvent, PaymentProcessedEvent, InventoryUpdatedEvent } from '../types';

@Controller('order-events')
export class OrderEventController {
  constructor(
    private readonly orderEventService: OrderEventService
  ) {}

  @Post(':orderId/initiate')
  async initiateOrderFulfillment(@Param('orderId') orderId: string) {
    // ⭐ FOCUS: Thin wrapper around event service
    const result = await this.orderEventService.initiateOrderFulfillment(orderId);
    
    if (result.isFailure()) {
      throw new Error(result.error.message);
    }
    
    return result.value;
  }

  @Post('events/order-created')
  async handleOrderCreated(@Body() event: OrderCreatedEvent) {
    // ⭐ FOCUS: Event handling delegation
    await this.orderEventService.handleOrderCreated(event);
    return { success: true };
  }

  @Post('events/payment-processed')
  async handlePaymentProcessed(@Body() event: PaymentProcessedEvent) {
    // ⭐ FOCUS: Event handling delegation
    await this.orderEventService.handlePaymentProcessed(event);
    return { success: true };
  }

  @Post('events/inventory-updated')
  async handleInventoryUpdated(@Body() event: InventoryUpdatedEvent) {
    // ⭐ FOCUS: Event handling delegation
    await this.orderEventService.handleInventoryUpdated(event);
    return { success: true };
  }
}
```

## Module Configuration

```typescript
// order-event.module.ts
import { Module } from '@nestjs/common';
import { OrderEventController } from './order-event.controller';
import { OrderEventService } from './order-event.service';

@Module({
  controllers: [OrderEventController],
  providers: [
    OrderEventService,
    // Event bus and repository providers
    {
      provide: 'IEventBus',
      useClass: UnifiedEventBus
    },
    {
      provide: 'IOrderRepository',
      useClass: OrderRepository
    }
  ],
  exports: [OrderEventService]
})
export class OrderEventModule {}
```

## Key Points

- **Event-Driven Architecture**: Uses @EventHandler decorators for automatic event subscriptions
- **Event Publishing**: Demonstrates various event publishing patterns
- **Cross-Aggregate Events**: Handles events that affect multiple aggregates
- **Event Metadata**: Includes rich metadata with events for traceability
- **Batch Publishing**: Shows how to publish multiple events efficiently
- **Error Handling**: Proper error handling with compensation events

## Related Examples

- [DI Integration](./di-integration.md) - Advanced dependency injection
- [Event-Driven Domain Service](../../../intermediate/example-1.md) - Core library patterns
- [Enterprise Setup](../advanced/enterprise-setup.md) - Complete enterprise integration