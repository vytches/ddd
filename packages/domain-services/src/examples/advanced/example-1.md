# Saga-Orchestrated Domain Service - Advanced Example

**Version**: 1.0.0
**Package**: @vytches-ddd/domain-services
**Complexity**: advanced
**Domain**: order-management
**Patterns**: domain-service, saga, long-running-processes
**Dependencies**: @vytches-ddd/core, @vytches-ddd/messaging

## Description

This example demonstrates a domain service that orchestrates long-running business processes using the Saga pattern. It shows compensation logic, state management, and complex workflow coordination.

## Business Context

Complex business processes like order fulfillment involve multiple steps that may take time and can fail at any point. Sagas provide a way to manage these long-running processes with proper compensation and rollback capabilities.

## Code Example

```typescript
// order-saga.service.ts
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { 
  BaseSaga, 
  SagaOrchestrator, 
  ISagaDefinition, 
  ISagaExecutionContext,
  ISagaActionResult
} from '@vytches-ddd/messaging';
import { Result } from '@vytches-ddd/utils';
import { 
  Order, 
  OrderCreatedEvent, 
  PaymentProcessedEvent, 
  InventoryReservedEvent,
  OrderProcessingResult,
  IOrderRepository
} from '../types';

/**
 * @llm-summary Advanced domain service using Saga pattern for long-running processes
 * @llm-domain order-management
 * @llm-complexity Complex
 * 
 * @description
 * Orchestrates complex order fulfillment processes using Saga pattern.
 * Manages compensation logic and handles distributed transaction scenarios.
 * 
 * @example
 * ```typescript
 * const service = new OrderSagaService(orchestrator, orderRepo);
 * const result = await service.startOrderFulfillmentSaga(orderId);
 * ```
 */
export class OrderSagaService extends BaseDomainService {
  constructor(
    private readonly sagaOrchestrator: SagaOrchestrator,
    private readonly orderRepository: IOrderRepository
  ) {
    super('OrderSagaService');
    this.initializeSagaDefinitions();
  }

  /**
   * Starts order fulfillment saga
   * 
   * @param orderId - Order identifier
   * @returns Result containing saga execution result or error
   */
  async startOrderFulfillmentSaga(orderId: string): Promise<Result<OrderProcessingResult, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        return Result.failure(new Error(`Order not found: ${orderId}`));
      }

      // Create saga start event
      const startEvent = {
        eventType: 'OrderCreated',
        orderId: order.id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      };

      // Start saga execution
      const context: ISagaExecutionContext = {
        correlationId: `order-saga-${orderId}`,
        userId: order.userId,
        metadata: {
          orderId: order.id,
          startTime: new Date().toISOString()
        }
      };

      const sagaResults = await this.sagaOrchestrator.processEvent(startEvent, context);
      
      if (sagaResults.length === 0) {
        return Result.failure(new Error('No saga found to handle order creation'));
      }

      const result: OrderProcessingResult = {
        orderId: order.id,
        status: order.status,
        inventoryUpdates: [],
        notifications: []
      };

      return Result.success(result);

    } catch (error) {
      return Result.failure(new Error(`Saga initiation failed: ${error.message}`));
    }
  }

  /**
   * Initializes saga definitions
   */
  private initializeSagaDefinitions(): void {
    const orderFulfillmentSaga: ISagaDefinition = {
      sagaType: 'OrderFulfillmentSaga',
      displayName: 'Order Fulfillment Workflow',
      description: 'Handles complete order fulfillment with compensation',
      startEvents: ['OrderCreated'],
      defaultTimeout: 3600000, // 1 hour
      maxInstances: 100,
      steps: [
        {
          stepName: 'ProcessPayment',
          description: 'Process payment for order',
          timeout: 30000,
          maxRetries: 3,
          compensationStep: 'RefundPayment'
        },
        {
          stepName: 'ReserveInventory',
          description: 'Reserve inventory for order items',
          timeout: 60000,
          maxRetries: 2,
          compensationStep: 'ReleaseInventory'
        },
        {
          stepName: 'ArrangeShipping',
          description: 'Arrange shipping for order',
          timeout: 120000,
          maxRetries: 1,
          compensationStep: 'CancelShipping'
        },
        {
          stepName: 'SendNotification',
          description: 'Send order confirmation',
          timeout: 10000,
          maxRetries: 3,
          compensationStep: null // No compensation needed
        }
      ],
      createInstance: async (event, context) => new OrderFulfillmentSagaInstance(),
      getCorrelationData: event => ({ orderId: event.orderId }),
      validate: () => []
    };

    this.sagaOrchestrator.registerSagaDefinition(orderFulfillmentSaga);
  }
}

/**
 * Order Fulfillment Saga Instance
 */
class OrderFulfillmentSagaInstance extends BaseSaga {
  constructor() {
    super('OrderFulfillmentSaga', 'Order Fulfillment Workflow');
  }

  /**
   * Handles events in the saga
   */
  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (event.eventType) {
      case 'OrderCreated':
        return await this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return await this.handlePaymentProcessed(event, context);
      case 'InventoryReserved':
        return await this.handleInventoryReserved(event, context);
      case 'ShippingArranged':
        return await this.handleShippingArranged(event, context);
      case 'NotificationSent':
        return await this.handleNotificationSent(event, context);
      case 'PaymentFailed':
        return await this.handlePaymentFailed(event, context);
      case 'InventoryReservationFailed':
        return await this.handleInventoryReservationFailed(event, context);
      case 'ShippingFailed':
        return await this.handleShippingFailed(event, context);
      default:
        return {
          success: false,
          error: { message: 'Unhandled event type', code: 'UNHANDLED_EVENT' }
        };
    }
  }

  /**
   * Determines if saga can handle event
   */
  canHandle(event: IExtendedDomainEvent): boolean {
    return [
      'OrderCreated',
      'PaymentProcessed',
      'PaymentFailed',
      'InventoryReserved',
      'InventoryReservationFailed',
      'ShippingArranged',
      'ShippingFailed',
      'NotificationSent'
    ].includes(event.eventType);
  }

  /**
   * Handles order created event
   */
  private async handleOrderCreated(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: {
        orderId: event.payload.orderId,
        totalAmount: event.payload.totalAmount,
        items: event.payload.items
      }
    });

    return {
      success: true,
      commands: [
        {
          type: 'ProcessPayment',
          payload: {
            orderId: event.payload.orderId,
            amount: event.payload.totalAmount,
            method: 'credit_card'
          }
        }
      ]
    };
  }

  /**
   * Handles payment processed event
   */
  private async handlePaymentProcessed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ReserveInventory',
      stepData: {
        ...this.state.stepData,
        paymentId: event.payload.paymentId
      }
    });

    const items = this.state.stepData.items || [];
    const inventoryCommands = items.map(item => ({
      type: 'ReserveInventory',
      payload: {
        productId: item.productId,
        quantity: item.quantity,
        orderId: this.state.stepData.orderId
      }
    }));

    return {
      success: true,
      commands: inventoryCommands
    };
  }

  /**
   * Handles inventory reserved event
   */
  private async handleInventoryReserved(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Track inventory reservations
    const reservedItems = this.state.stepData.reservedItems || [];
    reservedItems.push(event.payload);

    this.updateState({
      currentStep: 'ArrangeShipping',
      stepData: {
        ...this.state.stepData,
        reservedItems
      }
    });

    // Check if all items are reserved
    const totalItems = this.state.stepData.items?.length || 0;
    if (reservedItems.length === totalItems) {
      return {
        success: true,
        commands: [
          {
            type: 'ArrangeShipping',
            payload: {
              orderId: this.state.stepData.orderId,
              items: reservedItems
            }
          }
        ]
      };
    }

    return { success: true };
  }

  /**
   * Handles shipping arranged event
   */
  private async handleShippingArranged(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'SendNotification',
      stepData: {
        ...this.state.stepData,
        shippingId: event.payload.shippingId
      }
    });

    return {
      success: true,
      commands: [
        {
          type: 'SendNotification',
          payload: {
            orderId: this.state.stepData.orderId,
            userId: context.userId,
            type: 'order_confirmation'
          }
        }
      ]
    };
  }

  /**
   * Handles notification sent event
   */
  private async handleNotificationSent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'Completed',
      stepData: {
        ...this.state.stepData,
        notificationId: event.payload.notificationId
      }
    });

    return {
      success: true,
      events: [
        {
          eventType: 'OrderFulfillmentCompleted',
          payload: {
            orderId: this.state.stepData.orderId,
            completedAt: new Date().toISOString()
          }
        }
      ]
    };
  }

  /**
   * Handles payment failed event
   */
  private async handlePaymentFailed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'Failed',
      stepData: {
        ...this.state.stepData,
        failureReason: event.payload.error
      }
    });

    return {
      success: false,
      error: {
        message: 'Payment processing failed',
        code: 'PAYMENT_FAILED'
      },
      events: [
        {
          eventType: 'OrderFulfillmentFailed',
          payload: {
            orderId: this.state.stepData.orderId,
            reason: event.payload.error,
            failedAt: new Date().toISOString()
          }
        }
      ]
    };
  }

  /**
   * Handles inventory reservation failed event
   */
  private async handleInventoryReservationFailed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Start compensation
    await this.compensate('ProcessPayment', context);

    this.updateState({
      currentStep: 'Failed',
      stepData: {
        ...this.state.stepData,
        failureReason: event.payload.error
      }
    });

    return {
      success: false,
      error: {
        message: 'Inventory reservation failed',
        code: 'INVENTORY_FAILED'
      }
    };
  }

  /**
   * Handles shipping failed event
   */
  private async handleShippingFailed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Start compensation
    await this.compensate('ReserveInventory', context);
    await this.compensate('ProcessPayment', context);

    this.updateState({
      currentStep: 'Failed',
      stepData: {
        ...this.state.stepData,
        failureReason: event.payload.error
      }
    });

    return {
      success: false,
      error: {
        message: 'Shipping arrangement failed',
        code: 'SHIPPING_FAILED'
      }
    };
  }

  /**
   * Compensation logic
   */
  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (stepName) {
      case 'ProcessPayment':
        return await this.refundPayment(context);
      case 'ReserveInventory':
        return await this.releaseInventory(context);
      case 'ArrangeShipping':
        return await this.cancelShipping(context);
      default:
        return { success: true };
    }
  }

  /**
   * Refund payment compensation
   */
  private async refundPayment(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    const paymentId = this.state.stepData.paymentId;
    
    if (paymentId) {
      return {
        success: true,
        commands: [
          {
            type: 'RefundPayment',
            payload: {
              paymentId,
              orderId: this.state.stepData.orderId,
              amount: this.state.stepData.totalAmount
            }
          }
        ]
      };
    }

    return { success: true };
  }

  /**
   * Release inventory compensation
   */
  private async releaseInventory(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    const reservedItems = this.state.stepData.reservedItems || [];
    
    const releaseCommands = reservedItems.map(item => ({
      type: 'ReleaseInventory',
      payload: {
        productId: item.productId,
        quantity: item.quantity,
        orderId: this.state.stepData.orderId
      }
    }));

    return {
      success: true,
      commands: releaseCommands
    };
  }

  /**
   * Cancel shipping compensation
   */
  private async cancelShipping(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    const shippingId = this.state.stepData.shippingId;
    
    if (shippingId) {
      return {
        success: true,
        commands: [
          {
            type: 'CancelShipping',
            payload: {
              shippingId,
              orderId: this.state.stepData.orderId
            }
          }
        ]
      };
    }

    return { success: true };
  }
}
```

## Key Features

- **Saga Pattern**: Implements full saga pattern with compensation logic
- **Long-Running Processes**: Handles complex, multi-step business processes
- **Compensation Logic**: Provides rollback capabilities for failed operations
- **State Management**: Maintains saga state across multiple events
- **Event Orchestration**: Coordinates events and commands across services
- **Error Handling**: Comprehensive error handling with compensation

## Common Pitfalls

- **State Consistency**: Ensure saga state is properly persisted
- **Compensation Order**: Execute compensation in reverse order
- **Timeout Handling**: Handle timeouts gracefully
- **Idempotency**: Ensure operations are idempotent
- **Monitoring**: Implement proper monitoring and alerting

## Related Examples

- [Cross-Aggregate Domain Service](../intermediate/example-3.md) - Aggregate coordination
- [Resilient Domain Service](./example-2.md) - Resilience patterns
- [Saga Framework examples](../../messaging/examples/) - Saga implementation patterns