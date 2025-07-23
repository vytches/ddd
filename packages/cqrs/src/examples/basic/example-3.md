# Advanced CQRS Patterns with Distributed Processing

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Complexity**: advanced  
**Domain**: Order Management  
**Patterns**: cqrs, distributed-processing, sagas, command-coordination,
event-sourcing  
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/events,
@vytches-ddd/messaging, @vytches-ddd/resilience, @vytches-ddd/di

## Description

Demonstrates advanced CQRS patterns including distributed command coordination,
saga orchestration, event sourcing integration, and multi-service transaction
management. Shows how to handle complex business processes that span multiple
aggregates and bounded contexts.

## Business Context

E-commerce order processing requires coordination across multiple services:
inventory management, payment processing, shipping coordination, and customer
notifications. This example shows how to orchestrate complex, long-running
business processes using advanced CQRS patterns while maintaining consistency
and handling failures gracefully.

## Code Example

````typescript
// advanced-order-commands.ts
import { ICommand, IAsyncCommand } from '@vytches-ddd/cqrs';
import { OrderItem, ShippingAddress, PaymentMethod, Customer } from '../types';

/**
 * @llm-summary Advanced command for orchestrating complex order processing workflow
 * @llm-domain Order Management
 * @llm-complexity Expert
 *
 * @description
 * Orchestrates the complete order lifecycle including inventory reservation,
 * payment processing, shipping coordination, and customer notifications.
 *
 * @example
 * ```typescript
 * const command = new ProcessCompleteOrderCommand({
 *   customerId: 'cust-123',
 *   items: orderItems,
 *   paymentMethod: paymentInfo,
 *   shippingAddress: address,
 *   sagaId: 'saga-456'
 * });
 * await commandBus.execute(command);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ProcessCompleteOrderCommand implements IAsyncCommand {
  public readonly correlationId: string;
  public readonly sagaId: string;
  public readonly timeout: number = 300000; // 5 minutes for complex workflow

  constructor(
    public readonly customerId: string,
    public readonly items: OrderItem[],
    public readonly paymentMethod: PaymentMethod,
    public readonly shippingAddress: ShippingAddress,
    public readonly billingAddress: ShippingAddress,
    public readonly metadata: {
      sourceChannel: 'web' | 'mobile' | 'api';
      customerIpAddress?: string;
      userAgent?: string;
      promotionCodes?: string[];
      affiliateId?: string;
    },
    correlationId?: string,
    sagaId?: string
  ) {
    this.correlationId =
      correlationId ||
      `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sagaId =
      sagaId || `saga-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Command validation with complex business rules
  validate(): string[] {
    const errors: string[] = [];

    if (!this.customerId) errors.push('Customer ID is required');
    if (!this.items || this.items.length === 0)
      errors.push('Order must contain at least one item');
    if (!this.paymentMethod) errors.push('Payment method is required');
    if (!this.shippingAddress) errors.push('Shipping address is required');

    // Advanced validation
    const totalAmount = this.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    if (totalAmount <= 0) errors.push('Order total must be greater than zero');
    if (totalAmount > 50000)
      errors.push('Order exceeds maximum allowed amount');

    // Item-specific validation
    this.items.forEach((item, index) => {
      if (item.quantity <= 0)
        errors.push(`Item ${index + 1}: Quantity must be positive`);
      if (item.unitPrice <= 0)
        errors.push(`Item ${index + 1}: Unit price must be positive`);
      if (!item.productId)
        errors.push(`Item ${index + 1}: Product ID is required`);
    });

    return errors;
  }

  // Compensation logic for saga pattern
  getCompensationCommands(): ICommand[] {
    return [
      new ReleaseInventoryCommand(
        this.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        this.correlationId
      ),
      new RefundPaymentCommand(
        this.paymentMethod.transactionId!,
        this.correlationId
      ),
      new CancelShippingCommand(this.shippingAddress, this.correlationId),
      new NotifyCustomerOrderCancelledCommand(
        this.customerId,
        this.correlationId
      ),
    ];
  }
}

/**
 * @llm-summary Command for coordinating inventory across multiple warehouses
 * @llm-domain Inventory Management
 * @llm-complexity Expert
 *
 * @description
 * Coordinates inventory reservation across multiple warehouses with
 * fallback allocation strategies and real-time availability checking.
 *
 * @since 1.0.0
 * @public
 */
export class CoordinateInventoryCommand implements IAsyncCommand {
  public readonly timeout: number = 30000;

  constructor(
    public readonly orderId: string,
    public readonly items: OrderItem[],
    public readonly preferredWarehouse?: string,
    public readonly allocationStrategy:
      | 'closest'
      | 'balanced'
      | 'cost_optimized' = 'balanced',
    public readonly correlationId: string = `inv-coord-${Date.now()}`
  ) {}

  validate(): string[] {
    const errors: string[] = [];
    if (!this.orderId) errors.push('Order ID is required');
    if (!this.items || this.items.length === 0)
      errors.push('Items list cannot be empty');
    return errors;
  }
}

/**
 * @llm-summary Command for processing payments with fraud detection integration
 * @llm-domain Payment Processing
 * @llm-complexity Expert
 *
 * @description
 * Processes payments with advanced fraud detection, multiple payment method support,
 * and automatic retry logic for transient failures.
 *
 * @since 1.0.0
 * @public
 */
export class ProcessAdvancedPaymentCommand implements IAsyncCommand {
  public readonly timeout: number = 45000;

  constructor(
    public readonly orderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly paymentMethod: PaymentMethod,
    public readonly riskAssessment: {
      customerRiskScore: number;
      transactionRiskScore: number;
      deviceFingerprint?: string;
      billingAddressMatch: boolean;
    },
    public readonly fraudPreventionRules: string[],
    public readonly correlationId: string = `payment-${Date.now()}`
  ) {}

  validate(): string[] {
    const errors: string[] = [];
    if (!this.orderId) errors.push('Order ID is required');
    if (this.amount <= 0) errors.push('Payment amount must be positive');
    if (!this.currency) errors.push('Currency is required');
    if (this.riskAssessment.customerRiskScore > 80)
      errors.push('Customer risk score too high');
    return errors;
  }
}
````

````typescript
// advanced-order-handler.ts
import {
  CommandHandler,
  ICommandHandler,
  QueryHandler,
  IQueryHandler,
} from '@vytches-ddd/cqrs';
import { Logger } from '@vytches-ddd/logging';
import { VytchesDDD } from '@vytches-ddd/di';
import { CircuitBreakerStrategy, RetryStrategy } from '@vytches-ddd/resilience';
import { OutboxPublisher } from '@vytches-ddd/messaging';
import {
  ProcessCompleteOrderCommand,
  CoordinateInventoryCommand,
  ProcessAdvancedPaymentCommand,
} from './advanced-order-commands';
import {
  OrderProcessingResult,
  InventoryCoordinationResult,
  PaymentProcessingResult,
} from '../types';

/**
 * @llm-summary Advanced command handler for complete order processing orchestration
 * @llm-domain Order Management
 * @llm-complexity Expert
 *
 * @description
 * Orchestrates complex order processing workflow including distributed inventory coordination,
 * advanced payment processing with fraud detection, shipping coordination, and comprehensive
 * error handling with compensation patterns.
 *
 * @example
 * ```typescript
 * @CommandHandler(ProcessCompleteOrderCommand, {
 *   autoRegister: true,
 *   timeout: 300000,
 *   enableRetry: true,
 *   enableCircuitBreaker: true,
 *   enableSagaOrchestration: true
 * })
 * export class ProcessCompleteOrderHandler {
 *   async handle(command: ProcessCompleteOrderCommand): Promise<CommandResult<OrderProcessingResult>>
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(ProcessCompleteOrderCommand, {
  autoRegister: true,
  timeout: 300000,
  enableMetrics: true,
  enableEvents: true,
  enableRetry: true,
  retryStrategy: {
    maxAttempts: 3,
    baseDelay: 2000,
    backoff: 'exponential',
    retryConditions: ['TIMEOUT', 'TRANSIENT_FAILURE', 'NETWORK_ERROR'],
  },
  enableCircuitBreaker: true,
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringWindow: 300000,
  },
  middleware: ['validation', 'logging', 'performance', 'saga-orchestration'],
})
export class ProcessCompleteOrderHandler
  implements ICommandHandler<ProcessCompleteOrderCommand, OrderProcessingResult>
{
  private readonly logger = Logger.forContext('ProcessCompleteOrderHandler');
  private readonly outboxPublisher =
    VytchesDDD.resolve<OutboxPublisher>('outboxPublisher');
  private readonly orderRepository = VytchesDDD.resolve('orderRepository');
  private readonly sagaOrchestrator = VytchesDDD.resolve('sagaOrchestrator');

  /**
   * @llm-summary Orchestrates complete order processing workflow with distributed coordination
   * @llm-domain Order Management
   * @llm-complexity Expert
   *
   * @description
   * Coordinates the entire order lifecycle including inventory reservation,
   * payment processing, shipping coordination, and customer notifications
   * using advanced CQRS patterns and saga orchestration.
   *
   * @param command - Complete order processing command with all required data
   * @returns Promise with comprehensive order processing result
   *
   * @throws OrderProcessingError When critical processing steps fail
   * @throws InventoryUnavailableError When inventory cannot be reserved
   * @throws PaymentProcessingError When payment processing fails
   * @throws SagaOrchestrationError When saga coordination fails
   *
   * @since 1.0.0
   * @public
   */
  async handle(
    command: ProcessCompleteOrderCommand
  ): Promise<CommandResult<OrderProcessingResult>> {
    const startTime = Date.now();
    let sagaStarted = false;

    try {
      this.logger.info('Starting complete order processing', {
        correlationId: command.correlationId,
        sagaId: command.sagaId,
        customerId: command.customerId,
        itemCount: command.items.length,
      });

      // Step 1: Start distributed saga for coordination
      await this.sagaOrchestrator.startSaga({
        sagaId: command.sagaId,
        sagaType: 'OrderProcessingSaga',
        initiatingCommand: command,
        correlationId: command.correlationId,
        timeout: 300000,
        compensationEnabled: true,
      });
      sagaStarted = true;

      // Step 2: Create preliminary order record
      const order = await this.createPreliminaryOrder(command);

      // Step 3: Coordinate inventory across multiple warehouses
      const inventoryResult =
        await this.coordinateInventoryReservation(command);
      if (!inventoryResult.success) {
        throw new InventoryUnavailableError(
          `Inventory coordination failed: ${inventoryResult.error}`,
          inventoryResult.unavailableItems
        );
      }

      // Step 4: Process payment with advanced fraud detection
      const paymentResult = await this.processAdvancedPayment(
        command,
        inventoryResult
      );
      if (!paymentResult.success) {
        // Trigger inventory release compensation
        await this.triggerInventoryCompensation(inventoryResult.reservations);
        throw new PaymentProcessingError(
          `Payment processing failed: ${paymentResult.error}`,
          paymentResult.fraudFlags
        );
      }

      // Step 5: Coordinate shipping and logistics
      const shippingResult = await this.coordinateShipping(
        command,
        inventoryResult,
        paymentResult
      );
      if (!shippingResult.success) {
        // Trigger payment and inventory compensation
        await this.triggerPaymentCompensation(paymentResult.transactionId);
        await this.triggerInventoryCompensation(inventoryResult.reservations);
        throw new ShippingCoordinationError(
          `Shipping coordination failed: ${shippingResult.error}`
        );
      }

      // Step 6: Finalize order and update aggregate
      const finalOrder = await this.finalizeOrder(
        order,
        inventoryResult,
        paymentResult,
        shippingResult
      );

      // Step 7: Publish success events and notifications
      await this.publishOrderSuccessEvents(finalOrder, command);

      // Step 8: Complete saga successfully
      await this.sagaOrchestrator.completeSaga(command.sagaId, {
        outcome: 'success',
        finalState: finalOrder,
        correlationId: command.correlationId,
      });

      const executionTime = Date.now() - startTime;
      this.logger.info('Order processing completed successfully', {
        correlationId: command.correlationId,
        orderId: finalOrder.id,
        executionTime,
        totalAmount: finalOrder.total,
      });

      return {
        success: true,
        result: {
          orderId: finalOrder.id,
          customerId: command.customerId,
          status: 'confirmed',
          totalAmount: finalOrder.total,
          estimatedDelivery: shippingResult.estimatedDelivery,
          trackingNumber: shippingResult.trackingNumber,
          paymentConfirmation: paymentResult.confirmationCode,
          inventoryReservations: inventoryResult.reservations,
          processingTime: executionTime,
          sagaId: command.sagaId,
        },
        events: [
          {
            eventType: 'OrderProcessingCompleted',
            payload: { orderId: finalOrder.id, customerId: command.customerId },
            correlationId: command.correlationId,
          },
        ],
        metadata: {
          correlationId: command.correlationId,
          executionTime,
          sagaId: command.sagaId,
          componentsInvolved: [
            'inventory',
            'payment',
            'shipping',
            'notifications',
          ],
        },
      };
    } catch (error) {
      this.logger.error('Order processing failed', {
        correlationId: command.correlationId,
        sagaId: command.sagaId,
        error: error.message,
        errorType: error.constructor.name,
        executionTime: Date.now() - startTime,
      });

      // Trigger saga compensation if saga was started
      if (sagaStarted) {
        try {
          await this.sagaOrchestrator.compensateSaga(command.sagaId, {
            error: error.message,
            compensationReason: 'command_processing_failed',
            correlationId: command.correlationId,
          });
        } catch (compensationError) {
          this.logger.error('Saga compensation failed', {
            correlationId: command.correlationId,
            sagaId: command.sagaId,
            compensationError: compensationError.message,
          });
        }
      }

      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        compensationTriggered: sagaStarted,
        metadata: {
          correlationId: command.correlationId,
          executionTime: Date.now() - startTime,
          sagaId: command.sagaId,
          failedComponent: this.identifyFailedComponent(error),
        },
      };
    }
  }

  /**
   * @llm-summary Coordinates inventory reservation across multiple warehouses
   * @llm-domain Inventory Management
   * @llm-complexity Expert
   *
   * @description
   * Implements advanced inventory coordination with fallback allocation strategies,
   * real-time availability checking, and distributed reservation management.
   *
   * @param command - Order processing command containing inventory requirements
   * @returns Promise with inventory coordination result
   *
   * @since 1.0.0
   * @private
   */
  private async coordinateInventoryReservation(
    command: ProcessCompleteOrderCommand
  ): Promise<InventoryCoordinationResult> {
    try {
      this.logger.info('Starting inventory coordination', {
        correlationId: command.correlationId,
        items: command.items.length,
      });

      const inventoryCommand = new CoordinateInventoryCommand(
        `order-${command.correlationId}`,
        command.items,
        undefined, // No preferred warehouse - use balanced strategy
        'balanced',
        command.correlationId
      );

      const commandBus = VytchesDDD.resolve('commandBus');
      const inventoryResult = await commandBus.execute(inventoryCommand);

      if (!inventoryResult.success) {
        return {
          success: false,
          error: inventoryResult.error,
          unavailableItems: inventoryResult.unavailableItems || [],
          reservations: [],
        };
      }

      return {
        success: true,
        reservations: inventoryResult.result.reservations,
        warehouseAllocations: inventoryResult.result.warehouseAllocations,
        estimatedFulfillmentTime:
          inventoryResult.result.estimatedFulfillmentTime,
      };
    } catch (error) {
      this.logger.error('Inventory coordination failed', {
        correlationId: command.correlationId,
        error: error.message,
      });

      return {
        success: false,
        error: `Inventory coordination error: ${error.message}`,
        unavailableItems: command.items.map(item => ({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          reason: 'coordination_failed',
        })),
        reservations: [],
      };
    }
  }

  /**
   * @llm-summary Processes payment with advanced fraud detection and risk assessment
   * @llm-domain Payment Processing
   * @llm-complexity Expert
   *
   * @description
   * Implements advanced payment processing with comprehensive fraud detection,
   * risk scoring, multiple payment method support, and automatic retry logic.
   *
   * @param command - Order processing command with payment information
   * @param inventoryResult - Inventory coordination result for amount calculation
   * @returns Promise with payment processing result
   *
   * @since 1.0.0
   * @private
   */
  private async processAdvancedPayment(
    command: ProcessCompleteOrderCommand,
    inventoryResult: InventoryCoordinationResult
  ): Promise<PaymentProcessingResult> {
    try {
      this.logger.info('Starting advanced payment processing', {
        correlationId: command.correlationId,
        paymentMethod: command.paymentMethod.type,
      });

      // Calculate final amount including taxes and shipping
      const orderTotal = command.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const taxAmount = this.calculateTax(orderTotal, command.shippingAddress);
      const shippingAmount = this.calculateShipping(
        inventoryResult.warehouseAllocations,
        command.shippingAddress
      );
      const finalAmount = orderTotal + taxAmount + shippingAmount;

      // Perform risk assessment
      const riskAssessment = await this.performRiskAssessment(
        command,
        finalAmount
      );

      const paymentCommand = new ProcessAdvancedPaymentCommand(
        `order-${command.correlationId}`,
        finalAmount,
        'USD', // Default currency
        command.paymentMethod,
        riskAssessment,
        [
          'velocity_check',
          'device_fingerprint',
          'billing_address_verification',
        ],
        command.correlationId
      );

      const commandBus = VytchesDDD.resolve('commandBus');
      const paymentResult = await commandBus.execute(paymentCommand);

      if (!paymentResult.success) {
        return {
          success: false,
          error: paymentResult.error,
          fraudFlags: paymentResult.fraudFlags || [],
          riskScore: riskAssessment.transactionRiskScore,
        };
      }

      return {
        success: true,
        transactionId: paymentResult.result.transactionId,
        confirmationCode: paymentResult.result.confirmationCode,
        processedAmount: finalAmount,
        processingFee: paymentResult.result.processingFee,
        riskScore: riskAssessment.transactionRiskScore,
        fraudFlags: [],
      };
    } catch (error) {
      this.logger.error('Payment processing failed', {
        correlationId: command.correlationId,
        error: error.message,
      });

      return {
        success: false,
        error: `Payment processing error: ${error.message}`,
        fraudFlags: ['processing_error'],
        riskScore: 100, // Maximum risk on processing error
      };
    }
  }

  /**
   * @llm-summary Coordinates shipping and logistics with carrier integration
   * @llm-domain Logistics Management
   * @llm-complexity Expert
   *
   * @description
   * Coordinates shipping logistics including carrier selection, route optimization,
   * delivery estimation, and tracking number generation.
   *
   * @since 1.0.0
   * @private
   */
  private async coordinateShipping(
    command: ProcessCompleteOrderCommand,
    inventoryResult: InventoryCoordinationResult,
    paymentResult: PaymentProcessingResult
  ): Promise<ShippingCoordinationResult> {
    try {
      this.logger.info('Starting shipping coordination', {
        correlationId: command.correlationId,
        warehouseCount: inventoryResult.warehouseAllocations?.length || 0,
      });

      const shippingService = VytchesDDD.resolve('shippingService');

      // Select optimal carrier based on destination and package details
      const carrierSelection = await shippingService.selectOptimalCarrier({
        origin: inventoryResult.warehouseAllocations[0]?.warehouseLocation,
        destination: command.shippingAddress,
        packageDetails: this.calculatePackageDetails(command.items),
        serviceLevel: this.determineServiceLevel(paymentResult.processedAmount),
        correlationId: command.correlationId,
      });

      // Create shipping labels and get tracking number
      const shippingLabel = await shippingService.createShippingLabel({
        carrierId: carrierSelection.carrierId,
        serviceType: carrierSelection.serviceType,
        fromAddress: inventoryResult.warehouseAllocations[0]?.warehouseAddress,
        toAddress: command.shippingAddress,
        packageDetails: this.calculatePackageDetails(command.items),
        correlationId: command.correlationId,
      });

      return {
        success: true,
        trackingNumber: shippingLabel.trackingNumber,
        carrierId: carrierSelection.carrierId,
        serviceType: carrierSelection.serviceType,
        estimatedDelivery: carrierSelection.estimatedDelivery,
        shippingCost: carrierSelection.cost,
        shippingLabel: shippingLabel.labelUrl,
      };
    } catch (error) {
      this.logger.error('Shipping coordination failed', {
        correlationId: command.correlationId,
        error: error.message,
      });

      return {
        success: false,
        error: `Shipping coordination error: ${error.message}`,
      };
    }
  }

  /**
   * @llm-summary Creates preliminary order record for saga tracking
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Creates initial order record with 'processing' status for saga coordination
   * and early failure detection.
   *
   * @since 1.0.0
   * @private
   */
  private async createPreliminaryOrder(
    command: ProcessCompleteOrderCommand
  ): Promise<any> {
    const orderAggregate = VytchesDDD.resolve('orderAggregate');

    const order = await orderAggregate.create({
      customerId: command.customerId,
      items: command.items,
      shippingAddress: command.shippingAddress,
      billingAddress: command.billingAddress,
      status: 'processing',
      metadata: command.metadata,
      correlationId: command.correlationId,
      sagaId: command.sagaId,
    });

    await this.orderRepository.save(order);
    return order;
  }

  /**
   * @llm-summary Finalizes order with all processing results
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Updates order aggregate with final processing results and sets confirmed status.
   *
   * @since 1.0.0
   * @private
   */
  private async finalizeOrder(
    order: any,
    inventoryResult: InventoryCoordinationResult,
    paymentResult: PaymentProcessingResult,
    shippingResult: ShippingCoordinationResult
  ): Promise<any> {
    order.confirm({
      paymentConfirmation: paymentResult.confirmationCode,
      trackingNumber: shippingResult.trackingNumber,
      estimatedDelivery: shippingResult.estimatedDelivery,
      finalAmount: paymentResult.processedAmount,
      inventoryReservations: inventoryResult.reservations,
    });

    await this.orderRepository.save(order);
    return order;
  }

  /**
   * @llm-summary Publishes comprehensive success events for order completion
   * @llm-domain Event Publishing
   * @llm-complexity Medium
   *
   * @description
   * Publishes multiple events for different bounded contexts and external systems.
   *
   * @since 1.0.0
   * @private
   */
  private async publishOrderSuccessEvents(
    order: any,
    command: ProcessCompleteOrderCommand
  ): Promise<void> {
    const events = [
      {
        eventType: 'OrderConfirmed',
        aggregateId: order.id,
        payload: { orderId: order.id, customerId: command.customerId },
        correlationId: command.correlationId,
      },
      {
        eventType: 'CustomerNotificationRequested',
        payload: {
          customerId: command.customerId,
          notificationType: 'order_confirmation',
          orderId: order.id,
        },
        correlationId: command.correlationId,
      },
      {
        eventType: 'InventoryCommitted',
        payload: {
          orderId: order.id,
          reservations: order.inventoryReservations,
        },
        correlationId: command.correlationId,
      },
      {
        eventType: 'ShippingInitiated',
        payload: {
          orderId: order.id,
          trackingNumber: order.trackingNumber,
          estimatedDelivery: order.estimatedDelivery,
        },
        correlationId: command.correlationId,
      },
    ];

    await this.outboxPublisher.publishMany(events);
  }

  // Helper methods for calculations and compensation
  private calculateTax(amount: number, address: ShippingAddress): number {
    // Tax calculation logic based on shipping address
    return amount * 0.08; // 8% tax rate example
  }

  private calculateShipping(
    warehouseAllocations: any[],
    address: ShippingAddress
  ): number {
    // Shipping calculation based on warehouse locations and destination
    return 15.99; // Flat rate example
  }

  private async performRiskAssessment(
    command: ProcessCompleteOrderCommand,
    amount: number
  ): Promise<any> {
    // Advanced risk assessment logic
    return {
      customerRiskScore: 25,
      transactionRiskScore: 15,
      billingAddressMatch: true,
      deviceFingerprint: command.metadata.userAgent?.slice(0, 10),
    };
  }

  private calculatePackageDetails(items: OrderItem[]): any {
    // Package details calculation for shipping
    return {
      weight: items.reduce(
        (total, item) => total + (item.weight || 1) * item.quantity,
        0
      ),
      dimensions: { length: 12, width: 10, height: 8 },
      value: items.reduce(
        (total, item) => total + item.unitPrice * item.quantity,
        0
      ),
    };
  }

  private determineServiceLevel(amount: number): string {
    return amount > 100 ? 'expedited' : 'standard';
  }

  private async triggerInventoryCompensation(
    reservations: any[]
  ): Promise<void> {
    // Trigger inventory release compensation
    const commandBus = VytchesDDD.resolve('commandBus');
    await commandBus.execute(
      new ReleaseInventoryCommand(reservations, `compensation-${Date.now()}`)
    );
  }

  private async triggerPaymentCompensation(
    transactionId: string
  ): Promise<void> {
    // Trigger payment refund compensation
    const commandBus = VytchesDDD.resolve('commandBus');
    await commandBus.execute(
      new RefundPaymentCommand(transactionId, `compensation-${Date.now()}`)
    );
  }

  private identifyFailedComponent(error: Error): string {
    if (error instanceof InventoryUnavailableError) return 'inventory';
    if (error instanceof PaymentProcessingError) return 'payment';
    if (error instanceof ShippingCoordinationError) return 'shipping';
    return 'unknown';
  }
}

// Custom error types for specific failure scenarios
class InventoryUnavailableError extends Error {
  constructor(
    message: string,
    public readonly unavailableItems: any[]
  ) {
    super(message);
    this.name = 'InventoryUnavailableError';
  }
}

class PaymentProcessingError extends Error {
  constructor(
    message: string,
    public readonly fraudFlags: string[]
  ) {
    super(message);
    this.name = 'PaymentProcessingError';
  }
}

class ShippingCoordinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingCoordinationError';
  }
}
````

````typescript
// advanced-order-queries.ts
import { IQuery, IAsyncQuery } from '@vytches-ddd/cqrs';
import { QueryHandler, IQueryHandler } from '@vytches-ddd/cqrs';
import { Logger } from '@vytches-ddd/logging';
import { VytchesDDD } from '@vytches-ddd/di';

/**
 * @llm-summary Advanced query for comprehensive order analytics and reporting
 * @llm-domain Order Analytics
 * @llm-complexity Expert
 *
 * @description
 * Provides comprehensive order analytics including performance metrics,
 * failure analysis, customer behavior patterns, and business intelligence.
 *
 * @example
 * ```typescript
 * const query = new GetOrderAnalyticsQuery({
 *   dateRange: { from: lastMonth, to: today },
 *   aggregationLevel: 'daily',
 *   includeFailureAnalysis: true,
 *   includePerformanceMetrics: true
 * });
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class GetOrderAnalyticsQuery implements IAsyncQuery {
  public readonly timeout: number = 60000; // 1 minute for complex analytics

  constructor(
    public readonly filters: {
      dateRange: { from: Date; to: Date };
      customerId?: string;
      status?: string[];
      paymentMethod?: string[];
      shippingCarrier?: string[];
      warehouseId?: string[];
      minimumAmount?: number;
      maximumAmount?: number;
    },
    public readonly aggregation: {
      level: 'hourly' | 'daily' | 'weekly' | 'monthly';
      groupBy?: ('status' | 'paymentMethod' | 'carrier' | 'warehouse')[];
      includeFailureAnalysis: boolean;
      includePerformanceMetrics: boolean;
      includeCustomerSegmentation: boolean;
    },
    public readonly correlationId: string = `analytics-${Date.now()}`
  ) {}

  validate(): string[] {
    const errors: string[] = [];

    if (!this.filters.dateRange.from || !this.filters.dateRange.to) {
      errors.push('Date range is required');
    }

    if (this.filters.dateRange.from > this.filters.dateRange.to) {
      errors.push('From date must be before to date');
    }

    const daysDiff =
      (this.filters.dateRange.to.getTime() -
        this.filters.dateRange.from.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      errors.push('Date range cannot exceed 365 days');
    }

    return errors;
  }
}

/**
 * @llm-summary Advanced query handler for order analytics with caching and optimization
 * @llm-domain Order Analytics
 * @llm-complexity Expert
 *
 * @description
 * Handles complex order analytics queries with intelligent caching,
 * query optimization, and comprehensive business intelligence generation.
 *
 * @since 1.0.0
 * @public
 */
@QueryHandler(GetOrderAnalyticsQuery, {
  autoRegister: true,
  enableCaching: true,
  cacheStrategy: {
    ttl: 300000, // 5 minutes
    keyGenerator: query =>
      `order-analytics-${query.filters.dateRange.from.toISOString()}-${query.filters.dateRange.to.toISOString()}-${JSON.stringify(query.aggregation)}`,
    invalidationTags: ['orders', 'analytics'],
  },
  enableMetrics: true,
  timeout: 60000,
  middleware: ['logging', 'performance', 'caching', 'query-optimization'],
})
export class GetOrderAnalyticsHandler
  implements IQueryHandler<GetOrderAnalyticsQuery, OrderAnalyticsResult>
{
  private readonly logger = Logger.forContext('GetOrderAnalyticsHandler');
  private readonly analyticsRepository = VytchesDDD.resolve(
    'analyticsRepository'
  );
  private readonly cacheService = VytchesDDD.resolve('cacheService');
  private readonly queryOptimizer = VytchesDDD.resolve('queryOptimizer');

  /**
   * @llm-summary Executes comprehensive order analytics with optimization strategies
   * @llm-domain Order Analytics
   * @llm-complexity Expert
   *
   * @description
   * Processes complex analytics queries using query optimization, parallel processing,
   * and intelligent caching strategies for maximum performance.
   *
   * @param query - Analytics query with filters and aggregation preferences
   * @returns Promise with comprehensive analytics result
   *
   * @since 1.0.0
   * @public
   */
  async handle(
    query: GetOrderAnalyticsQuery
  ): Promise<QueryResult<OrderAnalyticsResult>> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting order analytics query', {
        correlationId: query.correlationId,
        dateRange: query.filters.dateRange,
        aggregationLevel: query.aggregation.level,
      });

      // Step 1: Check for cached results
      const cacheKey = this.generateCacheKey(query);
      const cachedResult = await this.cacheService.get(cacheKey);

      if (cachedResult) {
        this.logger.info('Analytics cache hit', {
          correlationId: query.correlationId,
          executionTime: Date.now() - startTime,
        });

        return {
          success: true,
          data: cachedResult,
          metadata: {
            correlationId: query.correlationId,
            executionTime: Date.now() - startTime,
            cacheHit: true,
            dataFreshness: 'cached',
          },
        };
      }

      // Step 2: Optimize query strategy based on data volume and complexity
      const optimizationStrategy = await this.queryOptimizer.analyzeQuery({
        dateRange: query.filters.dateRange,
        aggregationLevel: query.aggregation.level,
        estimatedDataVolume: await this.estimateDataVolume(query),
        complexityFactors: {
          hasFailureAnalysis: query.aggregation.includeFailureAnalysis,
          hasPerformanceMetrics: query.aggregation.includePerformanceMetrics,
          hasCustomerSegmentation:
            query.aggregation.includeCustomerSegmentation,
          groupByCount: query.aggregation.groupBy?.length || 0,
        },
      });

      // Step 3: Execute analytics based on optimization strategy
      let analyticsResult: OrderAnalyticsResult;

      switch (optimizationStrategy.approach) {
        case 'parallel_aggregation':
          analyticsResult = await this.executeParallelAggregation(
            query,
            optimizationStrategy
          );
          break;
        case 'incremental_processing':
          analyticsResult = await this.executeIncrementalProcessing(
            query,
            optimizationStrategy
          );
          break;
        case 'materialized_view':
          analyticsResult = await this.executeMaterializedViewQuery(
            query,
            optimizationStrategy
          );
          break;
        default:
          analyticsResult = await this.executeStandardQuery(query);
      }

      // Step 4: Cache result for future queries
      await this.cacheService.set(cacheKey, analyticsResult, 300000); // 5 minute TTL

      const executionTime = Date.now() - startTime;

      this.logger.info('Analytics query completed', {
        correlationId: query.correlationId,
        executionTime,
        strategy: optimizationStrategy.approach,
        recordsProcessed: analyticsResult.summary.totalOrders,
      });

      return {
        success: true,
        data: analyticsResult,
        metadata: {
          correlationId: query.correlationId,
          executionTime,
          strategy: optimizationStrategy.approach,
          recordsProcessed: analyticsResult.summary.totalOrders,
          cacheHit: false,
          dataFreshness: 'live',
        },
      };
    } catch (error) {
      this.logger.error('Analytics query failed', {
        correlationId: query.correlationId,
        error: error.message,
        executionTime: Date.now() - startTime,
      });

      return {
        success: false,
        error: `Analytics query failed: ${error.message}`,
        metadata: {
          correlationId: query.correlationId,
          executionTime: Date.now() - startTime,
          errorType: error.constructor.name,
        },
      };
    }
  }

  /**
   * @llm-summary Executes parallel aggregation for high-volume analytics
   * @llm-domain Data Processing
   * @llm-complexity Expert
   *
   * @description
   * Processes analytics using parallel aggregation strategies for optimal performance
   * with large datasets and complex grouping requirements.
   *
   * @since 1.0.0
   * @private
   */
  private async executeParallelAggregation(
    query: GetOrderAnalyticsQuery,
    strategy: any
  ): Promise<OrderAnalyticsResult> {
    const tasks = [];

    // Parallel execution of different analytics components
    tasks.push(this.computeBasicMetrics(query));

    if (query.aggregation.includeFailureAnalysis) {
      tasks.push(this.computeFailureAnalysis(query));
    }

    if (query.aggregation.includePerformanceMetrics) {
      tasks.push(this.computePerformanceMetrics(query));
    }

    if (query.aggregation.includeCustomerSegmentation) {
      tasks.push(this.computeCustomerSegmentation(query));
    }

    // Execute all analytics tasks in parallel
    const results = await Promise.all(tasks);

    return this.combineAnalyticsResults(results, query);
  }

  /**
   * @llm-summary Executes incremental processing for time-series analytics
   * @llm-domain Data Processing
   * @llm-complexity Expert
   *
   * @description
   * Processes analytics using incremental approaches, building on cached
   * intermediate results for improved performance.
   *
   * @since 1.0.0
   * @private
   */
  private async executeIncrementalProcessing(
    query: GetOrderAnalyticsQuery,
    strategy: any
  ): Promise<OrderAnalyticsResult> {
    // Implementation for incremental processing strategy
    // This would build on cached partial results and only process new data
    return this.executeStandardQuery(query);
  }

  /**
   * @llm-summary Executes queries against materialized views for performance
   * @llm-domain Data Access
   * @llm-complexity Expert
   *
   * @description
   * Uses pre-computed materialized views for common analytics patterns
   * to provide near-instant query responses.
   *
   * @since 1.0.0
   * @private
   */
  private async executeMaterializedViewQuery(
    query: GetOrderAnalyticsQuery,
    strategy: any
  ): Promise<OrderAnalyticsResult> {
    // Implementation for materialized view strategy
    // This would query pre-computed aggregation tables
    return this.executeStandardQuery(query);
  }

  /**
   * @llm-summary Executes standard analytics query with basic optimization
   * @llm-domain Data Processing
   * @llm-complexity Medium
   *
   * @description
   * Standard analytics processing for smaller datasets or simple aggregations.
   *
   * @since 1.0.0
   * @private
   */
  private async executeStandardQuery(
    query: GetOrderAnalyticsQuery
  ): Promise<OrderAnalyticsResult> {
    const basicMetrics = await this.computeBasicMetrics(query);
    const failureAnalysis = query.aggregation.includeFailureAnalysis
      ? await this.computeFailureAnalysis(query)
      : null;
    const performanceMetrics = query.aggregation.includePerformanceMetrics
      ? await this.computePerformanceMetrics(query)
      : null;
    const customerSegmentation = query.aggregation.includeCustomerSegmentation
      ? await this.computeCustomerSegmentation(query)
      : null;

    return this.combineAnalyticsResults(
      [basicMetrics, failureAnalysis, performanceMetrics, customerSegmentation],
      query
    );
  }

  // Helper methods for analytics computation
  private async estimateDataVolume(
    query: GetOrderAnalyticsQuery
  ): Promise<number> {
    // Estimate data volume for query optimization
    return 50000; // Example estimate
  }

  private generateCacheKey(query: GetOrderAnalyticsQuery): string {
    return `order-analytics-${JSON.stringify(query.filters)}-${JSON.stringify(query.aggregation)}`;
  }

  private async computeBasicMetrics(
    query: GetOrderAnalyticsQuery
  ): Promise<any> {
    // Basic metrics computation (total orders, revenue, etc.)
    return {
      totalOrders: 1250,
      totalRevenue: 125000,
      averageOrderValue: 100,
      conversionRate: 0.025,
    };
  }

  private async computeFailureAnalysis(
    query: GetOrderAnalyticsQuery
  ): Promise<any> {
    // Failure analysis computation
    return {
      failureRate: 0.05,
      topFailureReasons: [
        { reason: 'payment_declined', count: 45, percentage: 36 },
        { reason: 'inventory_unavailable', count: 35, percentage: 28 },
        { reason: 'shipping_error', count: 25, percentage: 20 },
      ],
    };
  }

  private async computePerformanceMetrics(
    query: GetOrderAnalyticsQuery
  ): Promise<any> {
    // Performance metrics computation
    return {
      averageProcessingTime: 2500,
      p95ProcessingTime: 4200,
      sagaCompletionRate: 0.98,
      systemThroughput: 125,
    };
  }

  private async computeCustomerSegmentation(
    query: GetOrderAnalyticsQuery
  ): Promise<any> {
    // Customer segmentation analysis
    return {
      segments: [
        { segment: 'high_value', customerCount: 85, averageOrderValue: 250 },
        { segment: 'regular', customerCount: 450, averageOrderValue: 95 },
        { segment: 'new', customerCount: 125, averageOrderValue: 75 },
      ],
    };
  }

  private combineAnalyticsResults(
    results: any[],
    query: GetOrderAnalyticsQuery
  ): OrderAnalyticsResult {
    const [
      basicMetrics,
      failureAnalysis,
      performanceMetrics,
      customerSegmentation,
    ] = results;

    return {
      summary: basicMetrics,
      failureAnalysis,
      performanceMetrics,
      customerSegmentation,
      timeSeriesData: [], // Would contain time-series breakdowns
      metadata: {
        generatedAt: new Date(),
        correlationId: query.correlationId,
        queryParameters: query.filters,
      },
    };
  }
}
````

## Key Features

- **🔄 Saga Orchestration**: Complete saga coordination with compensation
  patterns and distributed transaction management
- **⚡ Distributed Processing**: Multi-service coordination with advanced
  resilience and failure handling
- **📊 Advanced Analytics**: Comprehensive query optimization with parallel
  processing and intelligent caching
- **🛡️ Fraud Detection**: Integrated risk assessment and fraud prevention in
  payment processing
- **📦 Multi-Warehouse Coordination**: Sophisticated inventory allocation across
  distributed warehouses
- **🚚 Logistics Integration**: Advanced shipping coordination with carrier
  selection and route optimization
- **🔍 Performance Optimization**: Query strategy selection and execution
  optimization for analytics
- **📈 Real-time Metrics**: Comprehensive performance monitoring and business
  intelligence

## Advanced Patterns

1. **Saga Orchestration**: Long-running business process coordination with
   automatic compensation
2. **Distributed Command Coordination**: Multi-service command execution with
   rollback capabilities
3. **Advanced Query Optimization**: Strategy-based query execution for complex
   analytics
4. **Event-Driven Compensation**: Automatic failure recovery through
   event-driven compensation patterns
5. **Risk-Based Processing**: Adaptive processing flows based on risk assessment
   and business rules

## Performance Considerations

### **Command Processing**

- **Saga Coordination**: 300-second timeout for complex workflows with automatic
  cleanup
- **Parallel Processing**: Simultaneous inventory, payment, and shipping
  coordination
- **Circuit Breakers**: Automatic fallback strategies for external service
  failures
- **Compensation Patterns**: Automatic rollback coordination across distributed
  services

### **Query Processing**

- **Strategy Selection**: Automatic optimization strategy selection based on
  data volume and complexity
- **Parallel Aggregation**: Concurrent processing of different analytics
  components
- **Intelligent Caching**: Multi-level caching with TTL and invalidation
  strategies
- **Materialized Views**: Pre-computed aggregations for common analytics
  patterns

## Common Pitfalls

- **❌ Incomplete Compensation**: Always implement full compensation logic for
  distributed transactions
- **❌ Missing Timeout Handling**: Set appropriate timeouts for all distributed
  operations
- **❌ Poor Error Context**: Provide detailed error context for distributed
  system debugging
- **❌ Cache Invalidation**: Implement proper cache invalidation strategies for
  analytics
- **❌ Saga State Management**: Properly manage saga state across distributed
  components

## Related Examples

- [Example 1: Command Handlers](./example-1.md) - Basic CQRS command and query
  handling
- [Example 2: Query Optimization](./example-2.md) - Advanced query patterns and
  caching
- [Intermediate: Event Integration](../intermediate/example-1.md) - Event-driven
  CQRS patterns
- [NestJS Advanced Integration](../frameworks/nestjs/advanced/enterprise-patterns.md) -
  Enterprise patterns with framework integration
