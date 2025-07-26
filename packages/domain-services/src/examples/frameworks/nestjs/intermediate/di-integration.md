# DI Integration with VytchesDDD - NestJS Intermediate

**Focus**: Advanced @vytches/ddd-domain-services usage with @vytches/ddd-di
integration **Base Example**:
[Event-Driven Domain Service](../../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @vytches/ddd-core, @vytches/ddd-di

## Service Implementation

```typescript
// order-fulfillment.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  OrderCreatedEvent,
  PaymentProcessedEvent,
  OrderProcessingResult,
  IOrderRepository,
} from '../types';

@Injectable()
export class OrderFulfillmentService {
  private readonly orderFulfillmentDomainService: OrderFulfillmentDomainService;

  constructor() {
    // ⭐ FOCUS: @vytches/ddd-di integration
    this.orderFulfillmentDomainService =
      VytchesDDD.resolve<OrderFulfillmentDomainService>(
        'orderFulfillmentService'
      );
  }

  /**
   * Initiates order fulfillment process
   */
  async initiateFulfillment(
    orderId: string
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // ⭐ FOCUS: Delegate to domain service
      const result =
        await this.orderFulfillmentDomainService.initiateFulfillment(orderId);

      if (result.isFailure()) {
        throw new Error(result.error.message);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(
        new Error(`Fulfillment initiation failed: ${error.message}`)
      );
    }
  }

  /**
   * Handles order created events
   */
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // ⭐ FOCUS: Event handling through domain service
    await this.orderFulfillmentDomainService.handleOrderCreated(event);
  }

  /**
   * Handles payment processed events
   */
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    // ⭐ FOCUS: Event handling through domain service
    await this.orderFulfillmentDomainService.handlePaymentProcessed(event);
  }
}
```

## Domain Service Registration

```typescript
// order-fulfillment-domain.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { EventHandler } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import {
  OrderCreatedEvent,
  PaymentProcessedEvent,
  OrderProcessingResult,
  IOrderRepository,
} from '../types';

@DomainService({
  serviceId: 'orderFulfillmentService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['orderRepository', 'eventBus'],
})
export class OrderFulfillmentDomainService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus
  ) {
    super('OrderFulfillmentService');
  }

  @EventHandler(OrderCreatedEvent)
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      console.log(`Starting fulfillment for order: ${event.orderId}`);

      // ⭐ FOCUS: Domain service orchestration
      await this.updateOrderStatus(event.orderId, 'processing');
      await this.requestPaymentProcessing(event);
      await this.requestInventoryReservation(event);
      await this.scheduleNotifications(event);
    } catch (error) {
      console.error(`Order fulfillment failed for ${event.orderId}:`, error);
      await this.handleFulfillmentFailure(event.orderId, error);
    }
  }

  @EventHandler(PaymentProcessedEvent)
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    try {
      console.log(`Payment processed for order: ${event.orderId}`);

      if (event.status === 'completed') {
        const fulfillmentReady = await this.checkFulfillmentReadiness(
          event.orderId
        );

        if (fulfillmentReady.isSuccess()) {
          await this.proceedWithFulfillment(event.orderId);
        }
      } else {
        await this.handlePaymentFailure(event.orderId, event.status);
      }
    } catch (error) {
      console.error(`Payment processing failed for ${event.orderId}:`, error);
      await this.handleFulfillmentFailure(event.orderId, error);
    }
  }

  async initiateFulfillment(
    orderId: string
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        return Result.failure(new Error(`Order not found: ${orderId}`));
      }

      if (order.status !== 'confirmed') {
        return Result.failure(
          new Error(`Order not ready for fulfillment: ${order.status}`)
        );
      }

      await this.publishFulfillmentInitiated(order);

      const result: OrderProcessingResult = {
        orderId: order.id,
        status: order.status,
        inventoryUpdates: [],
        notifications: [],
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new Error(`Fulfillment initiation failed: ${error.message}`)
      );
    }
  }

  private async updateOrderStatus(
    orderId: string,
    status: string
  ): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      await this.orderRepository.save(order);

      await this.publishOrderStatusChanged(order);
    }
  }

  private async requestPaymentProcessing(
    event: OrderCreatedEvent
  ): Promise<void> {
    const paymentRequestEvent = {
      eventType: 'PaymentRequested',
      orderId: event.orderId,
      amount: event.totalAmount,
      timestamp: new Date(),
    };

    await this.eventBus.publish(paymentRequestEvent);
  }

  private async requestInventoryReservation(
    event: OrderCreatedEvent
  ): Promise<void> {
    for (const item of event.items) {
      const reservationEvent = {
        eventType: 'InventoryReservationRequested',
        orderId: event.orderId,
        productId: item.productId,
        quantity: item.quantity,
        timestamp: new Date(),
      };

      await this.eventBus.publish(reservationEvent);
    }
  }

  private async scheduleNotifications(event: OrderCreatedEvent): Promise<void> {
    const notificationEvent = {
      eventType: 'NotificationScheduled',
      orderId: event.orderId,
      userId: event.userId,
      type: 'order_confirmation',
      timestamp: new Date(),
    };

    await this.eventBus.publish(notificationEvent);
  }

  private async checkFulfillmentReadiness(
    orderId: string
  ): Promise<Result<boolean, Error>> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      return Result.failure(new Error(`Order not found: ${orderId}`));
    }

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
    };

    await this.eventBus.publish(fulfillmentEvent);
  }

  private async handlePaymentFailure(
    orderId: string,
    status: string
  ): Promise<void> {
    await this.updateOrderStatus(orderId, 'cancelled');

    const failureEvent = {
      eventType: 'OrderCancelled',
      orderId,
      reason: `Payment failed with status: ${status}`,
      timestamp: new Date(),
    };

    await this.eventBus.publish(failureEvent);
  }

  private async handleFulfillmentFailure(
    orderId: string,
    error: Error
  ): Promise<void> {
    await this.updateOrderStatus(orderId, 'failed');

    const failureEvent = {
      eventType: 'FulfillmentFailed',
      orderId,
      error: error.message,
      timestamp: new Date(),
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
    };

    await this.eventBus.publish(event);
  }

  private async publishOrderStatusChanged(order: Order): Promise<void> {
    const event = {
      eventType: 'OrderStatusChanged',
      orderId: order.id,
      status: order.status,
      timestamp: new Date(),
    };

    await this.eventBus.publish(event);
  }

  private async isPaymentCompleted(orderId: string): Promise<boolean> {
    return true;
  }

  private async isInventoryReserved(orderId: string): Promise<boolean> {
    return true;
  }
}
```

## Controller Integration

```typescript
// order-fulfillment.controller.ts
import { Controller, Post, Body, Param } from '@nestjs/common';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderCreatedEvent, PaymentProcessedEvent } from '../types';

@Controller('order-fulfillment')
export class OrderFulfillmentController {
  constructor(
    private readonly orderFulfillmentService: OrderFulfillmentService
  ) {}

  @Post(':orderId/initiate')
  async initiateFulfillment(@Param('orderId') orderId: string) {
    // ⭐ FOCUS: Thin wrapper around service
    const result =
      await this.orderFulfillmentService.initiateFulfillment(orderId);

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }

  @Post('events/order-created')
  async handleOrderCreated(@Body() event: OrderCreatedEvent) {
    // ⭐ FOCUS: Event handling through service
    await this.orderFulfillmentService.handleOrderCreated(event);
    return { success: true };
  }

  @Post('events/payment-processed')
  async handlePaymentProcessed(@Body() event: PaymentProcessedEvent) {
    // ⭐ FOCUS: Event handling through service
    await this.orderFulfillmentService.handlePaymentProcessed(event);
    return { success: true };
  }
}
```

## Module Configuration

```typescript
// order-fulfillment.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { OrderFulfillmentController } from './order-fulfillment.controller';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderFulfillmentDomainService } from './order-fulfillment-domain.service';

@Module({
  controllers: [OrderFulfillmentController],
  providers: [OrderFulfillmentService],
  exports: [OrderFulfillmentService],
})
export class OrderFulfillmentModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD BEFORE framework DI
    await VytchesDDD.configure();
  }
}
```

## Key Points

- **@vytches/ddd-di Integration**: Uses VytchesDDD.resolve() for service
  location
- **Domain Service Decorators**: @DomainService decorator for automatic
  registration
- **Event Handling**: @EventHandler decorators for event subscriptions
- **Service Lifetimes**: Configurable service lifetimes and contexts
- **Bridge Pattern**: NestJS service acts as bridge to domain service
- **Initialization**: Proper VytchesDDD initialization before NestJS DI

## Related Examples

- [Event Integration](./event-integration.md) - Event-driven patterns
- [Event-Driven Domain Service](../../../intermediate/example-1.md) - Core
  library patterns
- [Enterprise Setup](../advanced/enterprise-setup.md) - Complete enterprise
  integration
