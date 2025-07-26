# Event-Driven Domain Service - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-services **Complexity**:
intermediate **Domain**: order-management **Patterns**: domain-service,
event-driven, orchestration **Dependencies**: @vytches/ddd-core,
@vytches/ddd-events

## Description

This example demonstrates an event-driven domain service that publishes and
subscribes to domain events. It shows how to create loosely coupled services
that communicate through events while maintaining domain boundaries.

## Business Context

In complex domains, services need to communicate without tight coupling.
Event-driven architecture allows services to publish events when significant
business events occur, enabling other services to react appropriately without
direct dependencies.

## Code Example

````typescript
// order-fulfillment.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import { EventHandler, DomainEvent } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  OrderCreatedEvent,
  PaymentProcessedEvent,
  InventoryUpdatedEvent,
  OrderStatus,
  IOrderRepository,
  OrderProcessingResult,
} from '../types';

/**
 * @llm-summary Event-driven domain service for order fulfillment
 * @llm-domain order-management
 * @llm-complexity Medium
 *
 * @description
 * Orchestrates order fulfillment through event-driven patterns.
 * Handles order lifecycle events and coordinates fulfillment processes.
 *
 * @example
 * ```typescript
 * const service = new OrderFulfillmentService(orderRepo, eventBus);
 * // Service automatically handles events through @EventHandler decorators
 * ```
 */
export class OrderFulfillmentService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus
  ) {
    super('OrderFulfillmentService');
  }

  /**
   * Handles order created events to initiate fulfillment process
   *
   * @param event - Order created domain event
   */
  @EventHandler(OrderCreatedEvent)
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      console.log(`Starting fulfillment for order: ${event.orderId}`);

      // Step 1: Update order status
      await this.updateOrderStatus(event.orderId, 'processing');

      // Step 2: Request payment processing
      await this.requestPaymentProcessing(event);

      // Step 3: Request inventory reservation
      await this.requestInventoryReservation(event);

      // Step 4: Schedule fulfillment notifications
      await this.scheduleNotifications(event);
    } catch (error) {
      console.error(`Order fulfillment failed for ${event.orderId}:`, error);
      await this.handleFulfillmentFailure(event.orderId, error);
    }
  }

  /**
   * Handles payment processed events
   *
   * @param event - Payment processed domain event
   */
  @EventHandler(PaymentProcessedEvent)
  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    try {
      console.log(`Payment processed for order: ${event.orderId}`);

      if (event.status === 'completed') {
        // Check if all fulfillment conditions are met
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

  /**
   * Handles inventory updated events
   *
   * @param event - Inventory updated domain event
   */
  @EventHandler(InventoryUpdatedEvent)
  async handleInventoryUpdated(event: InventoryUpdatedEvent): Promise<void> {
    try {
      console.log(`Inventory updated for product: ${event.productId}`);

      // Find orders that might be affected by inventory changes
      const affectedOrders = await this.findOrdersAffectedByInventory(
        event.productId
      );

      for (const order of affectedOrders) {
        await this.reevaluateOrderFulfillment(order.id);
      }
    } catch (error) {
      console.error(`Inventory update handling failed:`, error);
    }
  }

  /**
   * Initiates order fulfillment process
   *
   * @param orderId - Order identifier
   * @returns Result containing fulfillment result or error
   */
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

      // Publish fulfillment initiated event
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

  /**
   * Updates order status
   */
  private async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      await this.orderRepository.save(order);

      // Publish status change event
      await this.publishOrderStatusChanged(order);
    }
  }

  /**
   * Requests payment processing
   */
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

  /**
   * Requests inventory reservation
   */
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

  /**
   * Schedules fulfillment notifications
   */
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

  /**
   * Checks if order is ready for fulfillment
   */
  private async checkFulfillmentReadiness(
    orderId: string
  ): Promise<Result<boolean, Error>> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      return Result.failure(new Error(`Order not found: ${orderId}`));
    }

    // Check if payment is completed and inventory is reserved
    const paymentCompleted = await this.isPaymentCompleted(orderId);
    const inventoryReserved = await this.isInventoryReserved(orderId);

    return Result.success(paymentCompleted && inventoryReserved);
  }

  /**
   * Proceeds with order fulfillment
   */
  private async proceedWithFulfillment(orderId: string): Promise<void> {
    await this.updateOrderStatus(orderId, 'processing');

    const fulfillmentEvent = {
      eventType: 'FulfillmentStarted',
      orderId,
      timestamp: new Date(),
    };

    await this.eventBus.publish(fulfillmentEvent);
  }

  /**
   * Handles payment failure
   */
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

  /**
   * Handles fulfillment failure
   */
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

  /**
   * Publishes fulfillment initiated event
   */
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

  /**
   * Publishes order status changed event
   */
  private async publishOrderStatusChanged(order: Order): Promise<void> {
    const event = {
      eventType: 'OrderStatusChanged',
      orderId: order.id,
      status: order.status,
      timestamp: new Date(),
    };

    await this.eventBus.publish(event);
  }

  /**
   * Checks if payment is completed for order
   */
  private async isPaymentCompleted(orderId: string): Promise<boolean> {
    // In real implementation, this would check payment status
    return true;
  }

  /**
   * Checks if inventory is reserved for order
   */
  private async isInventoryReserved(orderId: string): Promise<boolean> {
    // In real implementation, this would check inventory reservations
    return true;
  }

  /**
   * Finds orders affected by inventory changes
   */
  private async findOrdersAffectedByInventory(
    productId: string
  ): Promise<Order[]> {
    // In real implementation, this would query for affected orders
    return [];
  }

  /**
   * Reevaluates order fulfillment based on inventory changes
   */
  private async reevaluateOrderFulfillment(orderId: string): Promise<void> {
    // In real implementation, this would check if order can still be fulfilled
    console.log(`Reevaluating fulfillment for order: ${orderId}`);
  }
}
````

## Key Features

- **Event-Driven Architecture**: Uses @EventHandler decorators for event
  subscriptions
- **Loose Coupling**: Services communicate through events rather than direct
  calls
- **Event Publishing**: Publishes domain events for other services to consume
- **Orchestration**: Coordinates complex business processes through events
- **Error Handling**: Handles failures gracefully with compensation events
- **Domain Boundaries**: Maintains clear boundaries between different domains

## Common Pitfalls

- **Event Ordering**: Don't assume events arrive in order
- **Duplicate Events**: Handle potential duplicate event delivery
- **Event Versioning**: Consider event schema evolution
- **Circular Dependencies**: Avoid circular event dependencies
- **Error Propagation**: Handle event processing failures appropriately

## Related Examples

- [Basic Domain Service](../basic/example-1.md) - Simple domain service patterns
- [Domain Service with Policy Integration](./example-2.md) - Policy enforcement
- [NestJS Event Integration](../frameworks/nestjs/intermediate/event-integration.md) -
  Framework integration
