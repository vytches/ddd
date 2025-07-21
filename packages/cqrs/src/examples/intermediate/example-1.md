# Event Integration with CQRS Operations

**Version**: 1.0.0  
**Package**: @vytches-ddd/cqrs  
**Complexity**: intermediate  
**Domain**: Order Management  
**Patterns**: event-driven-cqrs, domain-events, integration-events, event-sourcing  
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/events, @vytches-ddd/di, @vytches-ddd/utils

## Description

Demonstrates advanced CQRS integration with the event system for automatic event publishing during command processing. Shows how commands can trigger domain events, integration events, and audit events while maintaining separation between command processing and event handling.

## Business Context

Complex business operations often need to trigger multiple downstream processes: inventory updates, customer notifications, audit logging, and third-party integrations. The event-driven CQRS pattern enables commands to publish events that trigger these processes asynchronously without blocking command execution.

## Code Example

```typescript
// order-commands.ts
import { BaseCommand, CreateOrderCommand, ProcessPaymentCommand, CancelOrderCommand } from '../types';

/**
 * @llm-summary Command for creating orders with automatic event publishing
 * @llm-domain Order Management
 * @llm-complexity Medium
 * 
 * @description
 * Represents the business intention to create a new order with automatic
 * event publishing for inventory, payment, and notification processes.
 * 
 * @example
 * ```typescript
 * const command = new CreateOrderCommand({
 *   customerId: 'customer-123',
 *   items: [{ productId: 'product-456', quantity: 2 }],
 *   shippingAddress: address
 * });
 * 
 * const result = await commandBus.execute(command);
 * // Automatically triggers: OrderCreated, InventoryReserved, PaymentRequested events
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export class CreateOrderCommand implements CreateOrderCommand {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly customerId: string,
    public readonly items: OrderItem[],
    public readonly shippingAddress: Address,
    public readonly billingAddress?: Address,
    public readonly paymentMethod?: PaymentMethod,
    public readonly promotionCode?: string,
    public readonly correlationId?: string
  ) {
    this.commandId = `create-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  /**
   * @llm-summary Validates order creation data and business rules
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Validates order data including customer existence, item availability,
   * address completeness, and business rule compliance.
   *
   * @returns Array of validation errors or empty array if valid
   *
   * @since 1.0.0
   * @public
   */
  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.customerId) {
      errors.push({
        field: 'customerId',
        message: 'Customer ID is required',
        code: 'MISSING_CUSTOMER_ID',
        value: this.customerId
      });
    }

    if (!this.items || this.items.length === 0) {
      errors.push({
        field: 'items',
        message: 'Order must contain at least one item',
        code: 'EMPTY_ORDER',
        value: this.items
      });
    }

    this.items?.forEach((item, index) => {
      if (!item.productId) {
        errors.push({
          field: `items[${index}].productId`,
          message: 'Product ID is required for each item',
          code: 'MISSING_PRODUCT_ID',
          value: item.productId
        });
      }

      if (!item.quantity || item.quantity <= 0) {
        errors.push({
          field: `items[${index}].quantity`,
          message: 'Quantity must be greater than zero',
          code: 'INVALID_QUANTITY',
          value: item.quantity
        });
      }
    });

    if (!this.shippingAddress || !this.isValidAddress(this.shippingAddress)) {
      errors.push({
        field: 'shippingAddress',
        message: 'Valid shipping address is required',
        code: 'INVALID_SHIPPING_ADDRESS',
        value: this.shippingAddress
      });
    }

    return errors;
  }

  /**
   * @llm-summary Calculates total order value for business rule validation
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Calculates the total order value considering item prices, quantities,
   * and any applicable promotions for business rule validation.
   *
   * @param productPrices - Map of product prices for calculation
   * @returns Total order value
   *
   * @since 1.0.0
   * @public
   */
  calculateOrderValue(productPrices: Map<string, number>): number {
    return this.items.reduce((total, item) => {
      const price = productPrices.get(item.productId) || 0;
      return total + (price * item.quantity);
    }, 0);
  }

  private isValidAddress(address: Address): boolean {
    return !!(address.street && address.city && address.postalCode && address.country);
  }
}

/**
 * @llm-summary Command for processing payments with event coordination
 * @llm-domain Order Management
 * @llm-complexity Medium
 *
 * @description
 * Represents the business intention to process payment for an order
 * with event coordination for downstream processes and audit trails.
 *
 * @since 1.0.0
 * @public
 */
export class ProcessPaymentCommand implements ProcessPaymentCommand {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(
    public readonly orderId: string,
    public readonly paymentMethod: PaymentMethod,
    public readonly amount: number,
    public readonly currency: string = 'USD',
    public readonly correlationId?: string
  ) {
    this.commandId = `process-payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!this.orderId) {
      errors.push({
        field: 'orderId',
        message: 'Order ID is required',
        code: 'MISSING_ORDER_ID',
        value: this.orderId
      });
    }

    if (!this.amount || this.amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Payment amount must be greater than zero',
        code: 'INVALID_AMOUNT',
        value: this.amount
      });
    }

    if (!this.paymentMethod || !this.paymentMethod.type) {
      errors.push({
        field: 'paymentMethod',
        message: 'Valid payment method is required',
        code: 'INVALID_PAYMENT_METHOD',
        value: this.paymentMethod
      });
    }

    return errors;
  }
}
```

```typescript
// order-command-handlers.ts
import { CommandHandler } from '@vytches-ddd/cqrs';
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { 
  CreateOrderCommand, 
  ProcessPaymentCommand,
  Order,
  CommandResult,
  OrderCreatedEvent,
  InventoryReservationRequestedEvent,
  PaymentRequestedEvent,
  AuditOrderCreatedEvent,
  PaymentProcessedEvent,
  OrderStatusUpdatedEvent
} from '../types';

/**
 * @llm-summary Command handler for order creation with event publishing
 * @llm-domain Order Management
 * @llm-complexity Medium
 *
 * @description
 * Handles CreateOrder commands with automatic event publishing for
 * inventory management, payment processing, and customer notifications.
 *
 * @example
 * ```typescript
 * @CommandHandler(CreateOrderCommand, { autoRegister: true })
 * class CreateOrderCommandHandler {
 *   async handle(command: CreateOrderCommand): Promise<CommandResult<Order>>
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(CreateOrderCommand, {
  autoRegister: true,
  timeout: 15000,
  enableMetrics: true,
  enableEvents: true
})
export class CreateOrderCommandHandler {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly customerService: CustomerService,
    private readonly inventoryService: InventoryService,
    private readonly eventBus: UnifiedEventBus
  ) {}

  /**
   * @llm-summary Handles order creation with comprehensive event publishing
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Processes CreateOrder command with validation, business logic, persistence,
   * and automatic event publishing for downstream processes.
   *
   * @param command - CreateOrder command with order data
   * @returns Promise with command result containing created order
   *
   * @example
   * ```typescript
   * const command = new CreateOrderCommand(customerId, items, address);
   * const result = await handler.handle(command);
   * 
   * if (result.success) {
   *   console.log('Order created:', result.result?.id);
   *   // Events automatically published:
   *   // - OrderCreated (domain event)
   *   // - InventoryReservationRequested (integration event)
   *   // - PaymentRequested (integration event)
   *   // - AuditOrderCreated (audit event)
   * }
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async handle(command: CreateOrderCommand): Promise<CommandResult<Order>> {
    try {
      console.log(`🛒 Processing CreateOrder command: ${command.commandId}`);

      // 1. Validate command data
      const validationErrors = command.validate();
      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: 'Order validation failed'
        };
      }

      // 2. Validate customer and business rules
      const businessValidation = await this.validateBusinessRules(command);
      if (!businessValidation.success) {
        return businessValidation;
      }

      // 3. Check inventory availability
      const inventoryCheck = await this.checkInventoryAvailability(command.items);
      if (!inventoryCheck.success) {
        return {
          success: false,
          error: 'Insufficient inventory for order items',
          metadata: { inventoryErrors: inventoryCheck.errors }
        };
      }

      // 4. Create order entity
      const order = await this.createOrderEntity(command, inventoryCheck.productPrices);

      // 5. Save order
      const saveResult = await this.orderRepository.save(order);
      if (!saveResult.success) {
        return {
          success: false,
          error: 'Failed to save order',
          metadata: { repositoryError: saveResult.error }
        };
      }

      // 6. Publish events for downstream processing
      await this.publishOrderEvents(order, command);

      console.log(`✅ Order created successfully: ${order.id}`);

      return {
        success: true,
        result: order,
        metadata: {
          commandId: command.commandId,
          correlationId: command.correlationId,
          eventsPublished: [
            'OrderCreated',
            'InventoryReservationRequested', 
            'PaymentRequested',
            'AuditOrderCreated'
          ]
        }
      };

    } catch (error) {
      console.error(`❌ Failed to create order:`, error);
      
      return {
        success: false,
        error: `Order creation failed: ${error.message}`,
        metadata: {
          commandId: command.commandId,
          errorType: error.constructor.name
        }
      };
    }
  }

  /**
   * @llm-summary Validates business rules for order creation
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Validates business rules including customer status, order limits,
   * promotion codes, and payment method requirements.
   *
   * @param command - CreateOrder command to validate
   * @returns Promise with validation result
   *
   * @since 1.0.0
   * @private
   */
  private async validateBusinessRules(command: CreateOrderCommand): Promise<CommandResult<void>> {
    const errors: ValidationError[] = [];

    // Check customer exists and is active
    const customer = await this.customerService.getCustomer(command.customerId);
    if (!customer) {
      errors.push({
        field: 'customerId',
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
        value: command.customerId
      });
    } else if (customer.status !== 'active') {
      errors.push({
        field: 'customerId',
        message: 'Customer account is not active',
        code: 'CUSTOMER_INACTIVE',
        value: customer.status
      });
    }

    // Validate promotion code if provided
    if (command.promotionCode) {
      const promotionValid = await this.customerService.validatePromotion(
        command.promotionCode, 
        command.customerId
      );
      if (!promotionValid) {
        errors.push({
          field: 'promotionCode',
          message: 'Invalid or expired promotion code',
          code: 'INVALID_PROMOTION',
          value: command.promotionCode
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        validationErrors: errors,
        error: 'Business rule validation failed'
      };
    }

    return { success: true };
  }

  /**
   * @llm-summary Checks inventory availability for order items
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Validates inventory availability and retrieves current product
   * prices for order calculation and processing.
   *
   * @param items - Order items to check
   * @returns Promise with inventory check result and product prices
   *
   * @since 1.0.0
   * @private
   */
  private async checkInventoryAvailability(items: OrderItem[]): Promise<{
    success: boolean;
    errors?: string[];
    productPrices?: Map<string, number>;
  }> {
    const inventoryResults = await Promise.all(
      items.map(async item => {
        const availability = await this.inventoryService.checkAvailability(
          item.productId, 
          item.quantity
        );
        return {
          productId: item.productId,
          available: availability.available,
          price: availability.price,
          error: availability.available ? null : `Insufficient stock for ${item.productId}`
        };
      })
    );

    const errors = inventoryResults
      .filter(result => result.error)
      .map(result => result.error!);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const productPrices = new Map(
      inventoryResults.map(result => [result.productId, result.price])
    );

    return { success: true, productPrices };
  }

  /**
   * @llm-summary Creates order entity from command data
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Constructs complete order entity with calculated totals,
   * timestamps, and business logic applied.
   *
   * @param command - CreateOrder command with order data
   * @param productPrices - Map of current product prices
   * @returns Promise with created order entity
   *
   * @since 1.0.0
   * @private
   */
  private async createOrderEntity(
    command: CreateOrderCommand, 
    productPrices: Map<string, number>
  ): Promise<Order> {
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Calculate order totals
    const subtotal = command.calculateOrderValue(productPrices);
    const tax = subtotal * 0.08; // 8% tax rate
    const shipping = this.calculateShipping(command.shippingAddress, subtotal);
    const total = subtotal + tax + shipping;

    const order: Order = {
      id: orderId,
      customerId: command.customerId,
      items: command.items.map(item => ({
        ...item,
        unitPrice: productPrices.get(item.productId)!,
        totalPrice: productPrices.get(item.productId)! * item.quantity
      })),
      shippingAddress: command.shippingAddress,
      billingAddress: command.billingAddress || command.shippingAddress,
      subtotal,
      tax,
      shipping,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: now,
      version: 1,
      correlationId: command.correlationId
    };

    return order;
  }

  /**
   * @llm-summary Publishes events for order creation
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Publishes comprehensive event set for order creation including
   * domain events, integration events, and audit events.
   *
   * @param order - Created order entity
   * @param command - Original create command
   * @returns Promise that resolves when events are published
   *
   * @since 1.0.0
   * @private
   */
  private async publishOrderEvents(order: Order, command: CreateOrderCommand): Promise<void> {
    const events = [
      // Domain event for internal business logic
      new OrderCreatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        total: order.total,
        items: order.items,
        status: order.status,
        createdAt: order.createdAt,
        correlationId: command.correlationId
      }),

      // Integration event for inventory system
      new InventoryReservationRequestedEvent({
        orderId: order.id,
        customerId: order.customerId,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          reservationId: `res-${order.id}-${item.productId}`
        })),
        correlationId: command.correlationId
      }),

      // Integration event for payment system
      new PaymentRequestedEvent({
        orderId: order.id,
        customerId: order.customerId,
        amount: order.total,
        currency: 'USD',
        paymentMethod: command.paymentMethod,
        correlationId: command.correlationId
      }),

      // Audit event for compliance tracking
      new AuditOrderCreatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        commandId: command.commandId,
        timestamp: command.timestamp,
        orderValue: order.total,
        itemCount: order.items.length,
        correlationId: command.correlationId
      })
    ];

    // Publish all events in batch for better performance
    await this.eventBus.publishMany(events);

    console.log(`📡 Published ${events.length} events for order ${order.id}`);
  }

  private calculateShipping(address: Address, subtotal: number): number {
    // Simplified shipping calculation
    if (subtotal > 100) return 0; // Free shipping over $100
    if (address.country === 'US') return 9.99;
    return 19.99; // International shipping
  }
}

/**
 * @llm-summary Command handler for payment processing with event coordination
 * @llm-domain Order Management
 * @llm-complexity Medium
 *
 * @description
 * Handles ProcessPayment commands with payment gateway integration
 * and event publishing for order status updates and notifications.
 *
 * @since 1.0.0
 * @public
 */
@CommandHandler(ProcessPaymentCommand, {
  autoRegister: true,
  timeout: 20000,
  enableMetrics: true,
  enableEvents: true
})
export class ProcessPaymentCommandHandler {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly eventBus: UnifiedEventBus
  ) {}

  /**
   * @llm-summary Handles payment processing with event coordination
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Processes payment through gateway with comprehensive event publishing
   * for order status updates, customer notifications, and audit trails.
   *
   * @param command - ProcessPayment command with payment data
   * @returns Promise with command result containing payment result
   *
   * @since 1.0.0
   * @public
   */
  async handle(command: ProcessPaymentCommand): Promise<CommandResult<PaymentResult>> {
    try {
      console.log(`💳 Processing payment command: ${command.commandId}`);

      // 1. Validate command
      const validationErrors = command.validate();
      if (validationErrors.length > 0) {
        return {
          success: false,
          validationErrors,
          error: 'Payment validation failed'
        };
      }

      // 2. Load order
      const order = await this.orderRepository.findById(command.orderId);
      if (!order) {
        return {
          success: false,
          error: `Order not found: ${command.orderId}`
        };
      }

      // 3. Validate payment amount
      if (command.amount !== order.total) {
        return {
          success: false,
          error: 'Payment amount does not match order total',
          metadata: {
            commandAmount: command.amount,
            orderTotal: order.total
          }
        };
      }

      // 4. Process payment through gateway
      const paymentResult = await this.paymentGateway.processPayment({
        orderId: command.orderId,
        amount: command.amount,
        currency: command.currency,
        paymentMethod: command.paymentMethod,
        correlationId: command.correlationId
      });

      // 5. Update order status
      const updatedOrder = await this.updateOrderPaymentStatus(order, paymentResult);

      // 6. Publish payment events
      await this.publishPaymentEvents(updatedOrder, paymentResult, command);

      console.log(`✅ Payment processed successfully for order ${command.orderId}`);

      return {
        success: true,
        result: paymentResult,
        metadata: {
          commandId: command.commandId,
          orderId: command.orderId,
          paymentStatus: paymentResult.status,
          transactionId: paymentResult.transactionId
        }
      };

    } catch (error) {
      console.error(`❌ Payment processing failed:`, error);
      
      return {
        success: false,
        error: `Payment processing failed: ${error.message}`,
        metadata: {
          commandId: command.commandId,
          orderId: command.orderId
        }
      };
    }
  }

  /**
   * @llm-summary Updates order payment status based on payment result
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Updates order entity with payment status, transaction details,
   * and version increment for optimistic concurrency control.
   *
   * @param order - Original order entity
   * @param paymentResult - Payment gateway result
   * @returns Promise with updated order entity
   *
   * @since 1.0.0
   * @private
   */
  private async updateOrderPaymentStatus(order: Order, paymentResult: PaymentResult): Promise<Order> {
    const updatedOrder: Order = {
      ...order,
      paymentStatus: paymentResult.status === 'successful' ? 'paid' : 'failed',
      status: paymentResult.status === 'successful' ? 'confirmed' : 'payment_failed',
      transactionId: paymentResult.transactionId,
      paymentMethod: paymentResult.paymentMethod,
      paidAt: paymentResult.status === 'successful' ? new Date() : undefined,
      updatedAt: new Date(),
      version: order.version + 1
    };

    const saveResult = await this.orderRepository.save(updatedOrder);
    if (!saveResult.success) {
      throw new Error(`Failed to update order: ${saveResult.error}`);
    }

    return updatedOrder;
  }

  /**
   * @llm-summary Publishes events for payment processing results
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Publishes comprehensive event set for payment results including
   * order status updates, customer notifications, and fulfillment triggers.
   *
   * @param order - Updated order entity
   * @param paymentResult - Payment processing result
   * @param command - Original payment command
   * @returns Promise that resolves when events are published
   *
   * @since 1.0.0
   * @private
   */
  private async publishPaymentEvents(
    order: Order, 
    paymentResult: PaymentResult, 
    command: ProcessPaymentCommand
  ): Promise<void> {
    const events = [
      // Domain event for payment completion
      new PaymentProcessedEvent({
        orderId: order.id,
        customerId: order.customerId,
        transactionId: paymentResult.transactionId,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: paymentResult.status,
        processedAt: new Date(),
        correlationId: command.correlationId
      }),

      // Domain event for order status change
      new OrderStatusUpdatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        previousStatus: 'pending',
        newStatus: order.status,
        updatedAt: order.updatedAt!,
        reason: paymentResult.status === 'successful' ? 'Payment completed' : 'Payment failed',
        correlationId: command.correlationId
      })
    ];

    // Add fulfillment event for successful payments
    if (paymentResult.status === 'successful') {
      events.push(new FulfillmentRequestedEvent({
        orderId: order.id,
        customerId: order.customerId,
        items: order.items,
        shippingAddress: order.shippingAddress,
        priority: order.total > 500 ? 'high' : 'normal',
        correlationId: command.correlationId
      }));
    }

    await this.eventBus.publishMany(events);

    console.log(`📡 Published ${events.length} payment events for order ${order.id}`);
  }
}

// Service interfaces
interface OrderRepository {
  save(order: Order): Promise<{ success: boolean; error?: string }>;
  findById(id: string): Promise<Order | null>;
}

interface CustomerService {
  getCustomer(customerId: string): Promise<Customer | null>;
  validatePromotion(code: string, customerId: string): Promise<boolean>;
}

interface InventoryService {
  checkAvailability(productId: string, quantity: number): Promise<{
    available: boolean;
    price: number;
  }>;
}

interface PaymentGateway {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
}
```

```typescript
// event-projection-handler.ts
import { EventHandler } from '@vytches-ddd/events';
import { OrderCreatedEvent, PaymentProcessedEvent, OrderStatusUpdatedEvent } from '../types';

/**
 * @llm-summary Event handler for order projections and read models
 * @llm-domain Order Management
 * @llm-complexity Medium
 *
 * @description
 * Handles domain events to maintain read-optimized projections
 * for order dashboards, customer views, and reporting systems.
 *
 * @example
 * ```typescript
 * @EventHandler(OrderCreatedEvent)
 * class OrderProjectionHandler {
 *   async handle(event: OrderCreatedEvent): Promise<void>
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-management',
  autoRegister: true
})
export class OrderProjectionHandler {
  constructor(
    private readonly orderProjectionRepository: OrderProjectionRepository,
    private readonly customerStatsRepository: CustomerStatsRepository
  ) {}

  /**
   * @llm-summary Updates order projections when orders are created
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Creates read-optimized order projections for dashboards and customer
   * views when OrderCreated events are received.
   *
   * @param event - OrderCreated domain event
   * @returns Promise that resolves when projections are updated
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: OrderCreatedEvent): Promise<void> {
    try {
      console.log(`📊 Updating projections for order created: ${event.payload.orderId}`);

      // 1. Create order summary projection
      const orderSummary = {
        orderId: event.payload.orderId,
        customerId: event.payload.customerId,
        status: event.payload.status,
        total: event.payload.total,
        itemCount: event.payload.items.length,
        createdAt: event.payload.createdAt,
        lastUpdated: new Date()
      };

      await this.orderProjectionRepository.createOrderSummary(orderSummary);

      // 2. Update customer statistics
      await this.customerStatsRepository.incrementOrderCount(event.payload.customerId);
      await this.customerStatsRepository.addToTotalSpent(
        event.payload.customerId, 
        event.payload.total
      );

      console.log(`✅ Order projections updated for ${event.payload.orderId}`);

    } catch (error) {
      console.error(`❌ Failed to update order projections:`, error);
      throw error;
    }
  }
}

/**
 * @llm-summary Event handler for payment status projections
 * @llm-domain Order Management
 * @llm-complexity Medium
 *
 * @description
 * Handles payment events to update order status projections
 * and payment analytics for business intelligence.
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(PaymentProcessedEvent, {
  eventContext: 'order-management',
  autoRegister: true
})
export class PaymentProjectionHandler {
  constructor(
    private readonly orderProjectionRepository: OrderProjectionRepository,
    private readonly paymentAnalyticsRepository: PaymentAnalyticsRepository
  ) {}

  /**
   * @llm-summary Updates payment projections when payments are processed
   * @llm-domain Order Management
   * @llm-complexity Medium
   *
   * @description
   * Updates order status projections and payment analytics when
   * PaymentProcessed events are received.
   *
   * @param event - PaymentProcessed domain event
   * @returns Promise that resolves when projections are updated
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: PaymentProcessedEvent): Promise<void> {
    try {
      console.log(`💳 Updating payment projections for order: ${event.payload.orderId}`);

      // 1. Update order payment status in projection
      await this.orderProjectionRepository.updatePaymentStatus(
        event.payload.orderId,
        event.payload.status,
        event.payload.transactionId
      );

      // 2. Record payment analytics
      await this.paymentAnalyticsRepository.recordPayment({
        orderId: event.payload.orderId,
        customerId: event.payload.customerId,
        amount: event.payload.amount,
        currency: event.payload.currency,
        status: event.payload.status,
        processedAt: event.payload.processedAt,
        transactionId: event.payload.transactionId
      });

      console.log(`✅ Payment projections updated for ${event.payload.orderId}`);

    } catch (error) {
      console.error(`❌ Failed to update payment projections:`, error);
      throw error;
    }
  }
}

// Repository interfaces
interface OrderProjectionRepository {
  createOrderSummary(summary: OrderSummary): Promise<void>;
  updatePaymentStatus(orderId: string, status: string, transactionId: string): Promise<void>;
}

interface CustomerStatsRepository {
  incrementOrderCount(customerId: string): Promise<void>;
  addToTotalSpent(customerId: string, amount: number): Promise<void>;
}

interface PaymentAnalyticsRepository {
  recordPayment(payment: PaymentAnalytics): Promise<void>;
}
```

## Key Features

- **🔗 Event-Driven Architecture**: Commands automatically publish events for downstream processing
- **📡 Multi-Event Publishing**: Single command triggers multiple event types (domain, integration, audit)
- **🔄 Event Coordination**: Events coordinate complex business processes across bounded contexts
- **📊 Projection Updates**: Event handlers maintain read-optimized projections automatically
- **🎯 Loose Coupling**: Commands focus on business logic while events handle side effects
- **⚡ Async Processing**: Events enable asynchronous processing without blocking commands

## Event Integration Patterns

1. **Command-Event Coordination**: Commands publish events that trigger downstream processes
2. **Event-Driven Projections**: Events update read models and analytics automatically
3. **Cross-Context Communication**: Integration events enable communication between bounded contexts
4. **Audit Event Sourcing**: Audit events provide complete business process trails
5. **Compensating Events**: Events can trigger compensating actions for failed operations

## Architecture Benefits

### **Scalability**
- Commands and events can be processed independently
- Event handlers can scale based on load patterns
- Async processing prevents blocking on slow operations
- Multiple event handlers can process same events concurrently

### **Resilience**
- Failed event processing doesn't affect command success
- Event replay capabilities for system recovery
- Compensating events for complex rollback scenarios
- Circuit breaker patterns for external service calls

### **Maintainability**
- Clear separation between command processing and side effects
- Event handlers can be added without modifying existing commands
- Business logic changes isolated to specific handlers
- Comprehensive audit trails for debugging and compliance

## Common Pitfalls

- **❌ Event Ordering**: Don't assume events will be processed in specific order
- **❌ Event Coupling**: Events should not depend on specific handler implementations
- **❌ Blocking Event Publishing**: Publish events asynchronously to avoid performance impact
- **❌ Missing Error Handling**: Always handle event publishing failures gracefully

## Related Examples

- [Example 1: Command Handlers](../basic/example-1.md) - Basic command handling patterns
- [Example 2: Query Handlers](../basic/example-2.md) - Query handling with projections
- [Example 3: Middleware Pipeline](../basic/example-3.md) - Cross-cutting concerns
- [Advanced: Event Sourcing](../advanced/example-1.md) - Complete event sourcing implementation