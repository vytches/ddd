# Event Handlers with Context Filtering

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: beginner  
**Domain**: Order Management  
**Patterns**: event-handlers, context-filtering, automatic-registration  
**Dependencies**: @vytches-ddd/events, @vytches-ddd/di

## Description

Demonstrates how to create event handlers that automatically respond to
published domain events. Shows context-filtering capabilities that allow
handlers to process only relevant events based on user, tenant, or bounded
context.

## Business Context

When an order is created, multiple business processes need to react: inventory
must be reserved, payment processing initiated, and customer notifications sent.
Event handlers provide a clean way to implement these reactions while
maintaining loose coupling between bounded contexts.

## Code Example

````typescript
// event-handlers.ts
import { EventHandler } from '@vytches-ddd/events';
import { OrderCreatedEvent, OrderConfirmedEvent } from '../types';

/**
 * @llm-summary Event handler for inventory management reactions
 * @llm-domain Inventory Management
 * @llm-complexity Simple
 *
 * @description
 * Handles order-related events to manage inventory reservations and updates.
 * Demonstrates context filtering to process only relevant events.
 *
 * @example
 * ```typescript
 * // Handler automatically called when OrderCreated event is published
 * @EventHandler(OrderCreatedEvent)
 * class InventoryHandler {
 *   async handle(event: OrderCreatedEvent): Promise<void> {
 *     // Reserve inventory automatically
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-management',
  autoRegister: true,
})
export class InventoryEventHandler {
  /**
   * @llm-summary Handles order creation by reserving inventory
   * @llm-domain Inventory Management
   * @llm-complexity Simple
   *
   * @description
   * Automatically triggered when OrderCreated event is published.
   * Reserves inventory for ordered items and updates stock levels.
   *
   * @param event - OrderCreated domain event with order details
   * @returns Promise that resolves when inventory reservation completes
   *
   * @example
   * ```typescript
   * // This method is called automatically when event is published
   * const event = new OrderCreatedEvent({
   *   orderId: 'order-123',
   *   items: [{ productId: 'prod-1', quantity: 2 }]
   * });
   * // ↳ handle() method called automatically
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: OrderCreatedEvent): Promise<void> {
    const { orderId, items, userId } = event.payload;

    console.log(`🏪 Processing inventory for order ${orderId}`);

    try {
      // Reserve inventory for each item
      for (const item of items) {
        await this.reserveInventory(item.productId, item.quantity, orderId);
        console.log(`  ✅ Reserved ${item.quantity}x ${item.productId}`);
      }

      console.log(`✅ Inventory reservation completed for order ${orderId}`);
    } catch (error) {
      console.error(
        `❌ Inventory reservation failed for order ${orderId}:`,
        error
      );

      // In real implementation, emit InventoryReservationFailed event
      // This would trigger compensation workflows
      throw error;
    }
  }

  private async reserveInventory(
    productId: string,
    quantity: number,
    orderId: string
  ): Promise<void> {
    // Simulate inventory reservation logic
    const currentStock = await this.getCurrentStock(productId);

    if (currentStock < quantity) {
      throw new Error(
        `Insufficient inventory for product ${productId}: needed ${quantity}, available ${currentStock}`
      );
    }

    // Simulate reservation process
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(
      `  📦 Reserved ${quantity} units of ${productId} for order ${orderId}`
    );
  }

  private async getCurrentStock(productId: string): Promise<number> {
    // Simulate database lookup
    const stockLevels: Record<string, number> = {
      'laptop-pro': 50,
      'mouse-wireless': 200,
      'keyboard-mechanical': 75,
    };

    return stockLevels[productId] || 0;
  }
}

/**
 * @llm-summary Event handler for payment processing
 * @llm-domain Payment Processing
 * @llm-complexity Simple
 *
 * @description
 * Handles order events to initiate and track payment processing.
 * Shows how multiple handlers can react to the same event.
 *
 * @since 1.0.0
 * @public
 */
@EventHandler(OrderCreatedEvent, {
  eventContext: ['order-management', 'payment-processing'],
  priority: 'high',
})
export class PaymentEventHandler {
  /**
   * @llm-summary Initiates payment processing for new orders
   * @llm-domain Payment Processing
   * @llm-complexity Simple
   *
   * @description
   * Automatically triggered when OrderCreated event is published.
   * Initiates payment processing based on order total and payment method.
   *
   * @param event - OrderCreated domain event
   * @returns Promise that resolves when payment initiation completes
   *
   * @since 1.0.0
   * @public
   */
  async handle(event: OrderCreatedEvent): Promise<void> {
    const { orderId, total, userId } = event.payload;

    console.log(`💳 Processing payment for order ${orderId} - $${total}`);

    try {
      // Initiate payment processing
      await this.initiatePayment(orderId, total, userId);

      console.log(`✅ Payment processing initiated for order ${orderId}`);
    } catch (error) {
      console.error(
        `❌ Payment initiation failed for order ${orderId}:`,
        error
      );
      throw error;
    }
  }

  private async initiatePayment(
    orderId: string,
    amount: number,
    userId: string
  ): Promise<void> {
    // Simulate payment gateway integration
    console.log(`  🔄 Contacting payment gateway for $${amount}`);

    await new Promise(resolve => setTimeout(resolve, 200));

    console.log(`  💳 Payment request submitted for order ${orderId}`);
  }
}

/**
 * @llm-summary Event handler for customer notifications
 * @llm-domain Customer Service
 * @llm-complexity Simple
 *
 * @description
 * Handles order events to send customer notifications via email, SMS, or push.
 * Demonstrates handling multiple event types in a single handler.
 *
 * @since 1.0.0
 * @public
 */
export class NotificationEventHandler {
  /**
   * @llm-summary Sends order confirmation notification
   * @llm-domain Customer Service
   * @llm-complexity Simple
   *
   * @description
   * Handles OrderCreated events to send order confirmation notifications
   * to customers via their preferred communication channel.
   *
   * @param event - OrderCreated domain event
   * @returns Promise that resolves when notification is sent
   *
   * @since 1.0.0
   * @public
   */
  @EventHandler(OrderCreatedEvent, { autoRegister: true })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const { orderId, userId } = event.payload;

    console.log(
      `📧 Sending order confirmation for ${orderId} to user ${userId}`
    );

    try {
      await this.sendOrderConfirmation(orderId, userId);
      console.log(`✅ Order confirmation sent for ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to send confirmation for ${orderId}:`, error);
      // Don't throw - notification failures shouldn't break order processing
    }
  }

  /**
   * @llm-summary Sends order confirmation notification
   * @llm-domain Customer Service
   * @llm-complexity Simple
   *
   * @description
   * Handles OrderConfirmed events to notify customers that their
   * order has been confirmed and is being processed.
   *
   * @param event - OrderConfirmed domain event
   * @returns Promise that resolves when notification is sent
   *
   * @since 1.0.0
   * @public
   */
  @EventHandler(OrderConfirmedEvent, { autoRegister: true })
  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    const { orderId } = event.payload;

    console.log(`📬 Sending order processing notification for ${orderId}`);

    try {
      await this.sendOrderProcessingNotification(orderId);
      console.log(`✅ Processing notification sent for ${orderId}`);
    } catch (error) {
      console.error(
        `❌ Failed to send processing notification for ${orderId}:`,
        error
      );
    }
  }

  private async sendOrderConfirmation(
    orderId: string,
    userId: string
  ): Promise<void> {
    // Simulate email/notification service
    console.log(
      `  📤 Sending confirmation email for order ${orderId} to user ${userId}`
    );
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private async sendOrderProcessingNotification(
    orderId: string
  ): Promise<void> {
    // Simulate notification service
    console.log(`  📤 Sending processing notification for order ${orderId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
````

````typescript
// event-system-setup.ts
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { VytchesDDD } from '@vytches-ddd/di';
import {
  InventoryEventHandler,
  PaymentEventHandler,
  NotificationEventHandler,
} from '../types';

/**
 * @llm-summary Event system setup with automatic handler registration
 * @llm-domain System Configuration
 * @llm-complexity Simple
 *
 * @description
 * Demonstrates how to set up the event system with automatic handler
 * discovery and registration through the dependency injection system.
 *
 * @example
 * ```typescript
 * const eventSystem = new EventSystemSetup();
 * await eventSystem.initialize();
 * // ↳ All event handlers automatically registered
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class EventSystemSetup {
  private eventBus: UnifiedEventBus;
  private eventDispatcher: UniversalEventDispatcher;

  constructor() {
    this.eventBus = new UnifiedEventBus();
    this.eventDispatcher = new UniversalEventDispatcher(this.eventBus);
  }

  /**
   * @llm-summary Initializes event system with automatic handler registration
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Sets up the complete event system including bus, dispatcher, and
   * automatic registration of all decorated event handlers.
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * const setup = new EventSystemSetup();
   * await setup.initialize();
   *
   * // Now events will be automatically routed to handlers
   * await orderService.createOrder(command);
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async initialize(): Promise<void> {
    try {
      // Register event infrastructure with DI container
      VytchesDDD.registerInstance('eventBus', this.eventBus);
      VytchesDDD.registerInstance('eventDispatcher', this.eventDispatcher);

      // Register event handlers (normally auto-discovered)
      VytchesDDD.registerInstance(
        'inventoryEventHandler',
        new InventoryEventHandler()
      );
      VytchesDDD.registerInstance(
        'paymentEventHandler',
        new PaymentEventHandler()
      );
      VytchesDDD.registerInstance(
        'notificationEventHandler',
        new NotificationEventHandler()
      );

      // Configure auto-discovery (in real applications)
      await VytchesDDD.configure();

      console.log('✅ Event system initialized with handlers:');
      console.log('  - InventoryEventHandler (context: order-management)');
      console.log(
        '  - PaymentEventHandler (context: order-management, payment-processing)'
      );
      console.log('  - NotificationEventHandler (auto-register: true)');
    } catch (error) {
      console.error('❌ Failed to initialize event system:', error);
      throw error;
    }
  }

  /**
   * @llm-summary Gets the configured event dispatcher for use in repositories
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Provides access to the configured event dispatcher for use in
   * repository implementations for automatic event publishing.
   *
   * @returns Configured UniversalEventDispatcher instance
   *
   * @since 1.0.0
   * @public
   */
  getEventDispatcher(): UniversalEventDispatcher {
    return this.eventDispatcher;
  }

  /**
   * @llm-summary Gets the configured event bus for direct event publishing
   * @llm-domain System Configuration
   * @llm-complexity Simple
   *
   * @description
   * Provides access to the event bus for scenarios requiring direct
   * event publishing outside the repository pattern.
   *
   * @returns Configured UnifiedEventBus instance
   *
   * @since 1.0.0
   * @public
   */
  getEventBus(): UnifiedEventBus {
    return this.eventBus;
  }
}

// Complete demonstration
async function demonstrateEventHandlers(): Promise<void> {
  console.log('🚀 Setting up event system...');

  // Initialize event system
  const eventSystem = new EventSystemSetup();
  await eventSystem.initialize();

  // Create order service with event publishing
  const orderService = new OrderService(eventSystem.getEventDispatcher());

  console.log('\n📦 Creating order...');

  const command: CreateOrderCommand = {
    userId: 'user-123',
    items: [
      {
        productId: 'laptop-pro',
        name: 'Laptop Pro',
        quantity: 1,
        price: 1299.99,
      },
      {
        productId: 'mouse-wireless',
        name: 'Wireless Mouse',
        quantity: 1,
        price: 49.99,
      },
    ],
    shippingAddress: {
      street: '123 Tech Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA',
    },
    paymentMethod: 'credit_card',
  };

  try {
    // Create order - triggers automatic event publishing and handling
    const order = await orderService.createOrder(command);

    console.log('\n✅ Order created successfully!');
    console.log('📋 The following handlers were automatically triggered:');
    console.log('  1. InventoryEventHandler - Reserved inventory');
    console.log('  2. PaymentEventHandler - Initiated payment');
    console.log('  3. NotificationEventHandler - Sent confirmation');

    // Confirm order - triggers more events
    console.log('\n🔄 Confirming order...');
    await orderService.confirmOrder(order.id);

    console.log('\n✅ Order confirmed successfully!');
    console.log('📋 Additional handlers triggered:');
    console.log('  1. NotificationEventHandler - Sent processing notification');
  } catch (error) {
    console.error('❌ Order processing failed:', error);
  }
}
````

## Key Features

- **🎯 Automatic Registration**: Event handlers automatically registered through
  DI decorators
- **🔍 Context Filtering**: Handlers process only events matching their context
  criteria
- **⚡ Concurrent Processing**: Multiple handlers process the same event
  simultaneously
- **🎨 Multiple Events**: Single handler can handle multiple event types with
  separate methods
- **🛡️ Error Isolation**: Handler failures don't affect other handlers or event
  publishing

## Common Pitfalls

- **❌ Blocking Handlers**: Avoid long-running operations in event handlers
- **❌ Handler Dependencies**: Don't create dependencies between event handlers
- **❌ Forgetting Context**: Remember to specify context for targeted event
  handling
- **❌ Exception Propagation**: Consider whether handler exceptions should fail
  the operation

## Related Examples

- [Example 1: Basic Publishing](./example-1.md) - Repository pattern with
  automatic publishing
- [Example 3: Context Filtering](./example-3.md) - Advanced context-based event
  routing
- [Intermediate: Batch Processing](../intermediate/example-1.md) - Handling
  multiple events efficiently
