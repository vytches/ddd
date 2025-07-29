/**
 * Example usage of Event Handlers with DI integration
 *
 * This file demonstrates how to use the enhanced @EventHandler decorator
 * with VytchesDDD dependency injection system.
 */

import type { IDomainEvent, IEventHandler } from '@vytches/ddd-contracts';
import { EventHandler } from './event-handler.decorator';

// Example domain events

/**
 * @llm-summary UserRegisteredEvent class for user registered event operations
 * @llm-domain Architecture
 * @llm-complexity Simple
 *
 * @description
 * UserRegisteredEvent class implementing architectural component for user registered event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new UserRegisteredEvent();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class UserRegisteredEvent implements IDomainEvent {
  public readonly eventType = 'UserRegisteredEvent';

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredOn: Date = new Date(),
    public readonly version = 1
  ) {}
}

/**
 * @llm-summary OrderCreatedEvent class for order created event operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * OrderCreatedEvent class implementing architectural component for order created event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new OrderCreatedEvent();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class OrderCreatedEvent implements IDomainEvent {
  public readonly eventType = 'OrderCreatedEvent';

  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly amount: number,
    public readonly occurredOn: Date = new Date(),
    public readonly version = 1
  ) {}
}

/**
 * @llm-summary PaymentProcessedEvent class for payment processed event operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * PaymentProcessedEvent class implementing architectural component for payment processed event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PaymentProcessedEvent();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class PaymentProcessedEvent implements IDomainEvent {
  public readonly eventType = 'PaymentProcessedEvent';

  constructor(
    public readonly id: string,
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly amount: number,
    public readonly occurredOn: Date = new Date(),
    public readonly version = 1
  ) {}
}

// Basic event handler with DI integration
@EventHandler(UserRegisteredEvent, {
  lifetime: 'singleton',
  autoRegister: true,
  tags: ['user', 'notification'],
  priority: 100,
})

/**
 * @llm-summary UserRegistrationNotificationHandler class for user registration notification handler operations
 * @llm-domain Architecture
 * @llm-complexity Simple
 *
 * @description
 * UserRegistrationNotificationHandler class implementing architectural component for user registration notification handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new UserRegistrationNotificationHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class UserRegistrationNotificationHandler implements IEventHandler<UserRegisteredEvent> {
  async handle(event: UserRegisteredEvent): Promise<void> {
    // In real implementation, you would use VytchesDDD.resolve() to get dependencies
    console.log(`Sending welcome email to user ${event.userId} at ${event.email}`);

    // Example of using service locator (would need import in real usage)
    // const emailService = VytchesDDD.resolve<EmailService>('EmailService');
    // await emailService.sendWelcomeEmail(event.email);
  }
}

// Context-specific event handler
@EventHandler(OrderCreatedEvent, {
  lifetime: 'singleton',
  context: 'OrderManagement',
  autoRegister: true,
  tags: ['order', 'inventory'],
  priority: 200,
})

/**
 * @llm-summary OrderInventoryUpdateHandler class for order inventory update handler operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * OrderInventoryUpdateHandler class implementing architectural component for order inventory update handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new OrderInventoryUpdateHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class OrderInventoryUpdateHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Updating inventory for order ${event.orderId}`);

    // Example of context-aware dependency resolution
    // const inventoryService = VytchesDDD.resolve<InventoryService>('InventoryService', 'OrderManagement');
    // await inventoryService.reserveItems(event.orderId);
  }
}

// High priority event handler
@EventHandler(PaymentProcessedEvent, {
  lifetime: 'transient',
  autoRegister: true,
  tags: ['payment', 'notification', 'high-priority'],
  priority: 500,
  active: true,
})

/**
 * @llm-summary PaymentConfirmationHandler class for payment confirmation handler operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * PaymentConfirmationHandler class implementing architectural component for payment confirmation handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PaymentConfirmationHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class PaymentConfirmationHandler implements IEventHandler<PaymentProcessedEvent> {
  async handle(event: PaymentProcessedEvent): Promise<void> {
    console.log(`Processing payment confirmation for ${event.paymentId}`);

    // High priority handler for immediate payment confirmations
    // const notificationService = VytchesDDD.resolve<NotificationService>('NotificationService');
    // await notificationService.sendPaymentConfirmation(event.paymentId);
  }
}

// Multiple handlers for the same event
@EventHandler(OrderCreatedEvent, {
  lifetime: 'singleton',
  autoRegister: true,
  tags: ['order', 'analytics'],
  priority: 50, // Lower priority than inventory handler
})

/**
 * @llm-summary OrderAnalyticsHandler class for order analytics handler operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * OrderAnalyticsHandler class implementing architectural component for order analytics handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new OrderAnalyticsHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class OrderAnalyticsHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    console.log(`Recording analytics for order ${event.orderId}`);

    // const analyticsService = VytchesDDD.resolve<AnalyticsService>('AnalyticsService');
    // await analyticsService.recordOrderCreated(event);
  }
}

// Legacy event handler (backward compatibility)
@EventHandler(UserRegisteredEvent)

/**
 * @llm-summary LegacyUserHandler class for legacy user handler operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * LegacyUserHandler class implementing architectural component for legacy user handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new LegacyUserHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class LegacyUserHandler implements IEventHandler<UserRegisteredEvent> {
  handle(event: UserRegisteredEvent): void {
    console.log(`Legacy handling for user ${event.userId}`);
    // This handler will have default DI behavior but maintains backward compatibility
  }
}

// Manual registration event handler (not auto-registered)
@EventHandler(PaymentProcessedEvent, { autoRegister: false })

/**
 * @llm-summary ManualPaymentHandler class for manual payment handler operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * ManualPaymentHandler class implementing architectural component for manual payment handler operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ManualPaymentHandler();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ManualPaymentHandler implements IEventHandler<PaymentProcessedEvent> {
  handle(event: PaymentProcessedEvent): void {
    console.log(`Manual payment handling for ${event.paymentId}`);
    // This handler must be manually registered with DI container
  }
}

/**
 * @llm-summary setup event handlers example function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * setupEventHandlersExample function implementing architectural component for setup event handlers example operations.
 *
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = setupEventHandlersExample();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function setupEventHandlersExample() {
  // This function would be called during application startup

  // Register event discovery plugin
  // VytchesDDD.registerDiscoveryPlugin(new EventDiscoveryPlugin());

  // Discover and register all event handlers
  // await VytchesDDD.discoverAndRegisterHandlers();

  // The following handlers would be auto-registered:
  // - UserRegistrationNotificationHandler
  // - OrderInventoryUpdateHandler
  // - PaymentConfirmationHandler
  // - OrderAnalyticsHandler
  // - LegacyUserHandler

  // ManualPaymentHandler would need to be registered manually:
  // container.register('ManualPaymentHandler', ManualPaymentHandler);

  console.log('Event handlers configured with DI integration');
}

/**
 * @llm-summary example event handling function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * exampleEventHandling function implementing architectural component for example event handling operations.
 *
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = exampleEventHandling();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export async function exampleEventHandling() {
  // Create sample events
  const userEvent = new UserRegisteredEvent('evt-1', 'user-123', 'user@example.com');
  const orderEvent = new OrderCreatedEvent('evt-2', 'order-456', 'user-123', 99.99);
  const paymentEvent = new PaymentProcessedEvent('evt-3', 'pay-789', 'order-456', 99.99);

  // In a real application, events would be dispatched through the event bus
  // and handlers would be resolved automatically by the DI system

  // Example of what happens internally:
  // 1. Event is published to event bus
  // 2. Event bus finds all handlers for the event type
  // 3. Handlers are resolved from DI container
  // 4. Handlers are executed according to their priority

  console.log('Events:', { userEvent, orderEvent, paymentEvent });
  console.log('Handlers would be resolved and executed automatically');
}
