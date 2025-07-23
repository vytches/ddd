# Event Interface Architecture

**Version**: 1.0.0 **Package**: @vytches-ddd/contracts **Complexity**: Basic
**Domain**: Foundation **Patterns**: event-interfaces, domain-events,
event-architecture **Dependencies**: @vytches-ddd/contracts

## Description

The event interface architecture provides the foundation for event-driven design
in VytchesDDD. This example demonstrates core event interfaces, domain event
patterns, event bus architecture, and handler registration patterns essential
for building event-driven applications.

## Business Context

Event-driven architecture enables loose coupling between domain components,
supports audit trails, enables real-time processing, and facilitates integration
between bounded contexts. These interfaces provide the contracts that make this
architecture possible.

## Core Event Interfaces

### Domain Event Foundation

```typescript
// src/domain/events/domain-event-foundation.ts
import {
  IDomainEvent,
  DomainEventMetadata,
  IEventBus,
  IEventHandler,
} from '@vytches-ddd/contracts';

// Basic domain event implementation
export class UserRegisteredEvent implements IDomainEvent {
  public readonly eventType = 'UserRegistered';
  public readonly eventVersion = '1.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      userId: string;
      email: string;
      registrationDate: Date;
      userType: 'standard' | 'premium';
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();

    // Add default metadata
    this.metadata = {
      correlationId: metadata.correlationId || this.generateCorrelationId(),
      causationId: metadata.causationId,
      userId: metadata.userId,
      timestamp: this.occurredAt,
      ...metadata,
    };
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Business domain event with rich payload
export class OrderProcessedEvent implements IDomainEvent {
  public readonly eventType = 'OrderProcessed';
  public readonly eventVersion = '2.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      orderId: string;
      customerId: string;
      totalAmount: number;
      currency: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
      }>;
      processingStatus: 'pending' | 'confirmed' | 'shipped';
      estimatedDelivery?: Date;
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();
    this.metadata = {
      correlationId: metadata.correlationId || `order-${aggregateId}`,
      timestamp: this.occurredAt,
      version: this.eventVersion,
      ...metadata,
    };
  }
}
```

### Event Handler Patterns

```typescript
// src/application/handlers/event-handler-patterns.ts
import { IEventHandler } from '@vytches-ddd/contracts';

// Simple event handler
export class UserRegistrationEmailHandler
  implements IEventHandler<UserRegisteredEvent>
{
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: Logger
  ) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    try {
      this.logger.info('Processing user registration event', {
        userId: event.payload.userId,
        email: event.payload.email,
        correlationId: event.metadata.correlationId,
      });

      await this.emailService.sendWelcomeEmail({
        to: event.payload.email,
        userId: event.payload.userId,
        userType: event.payload.userType,
      });

      this.logger.info('Welcome email sent successfully', {
        userId: event.payload.userId,
        correlationId: event.metadata.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to send welcome email', {
        userId: event.payload.userId,
        error: error.message,
        correlationId: event.metadata.correlationId,
      });
      throw error;
    }
  }

  // Handler metadata for registration
  getEventType(): string {
    return 'UserRegistered';
  }

  getHandlerName(): string {
    return 'UserRegistrationEmailHandler';
  }
}

// Multi-event handler
export class OrderAnalyticsHandler
  implements IEventHandler<OrderProcessedEvent>
{
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly metricsCollector: MetricsCollector
  ) {}

  async handle(event: OrderProcessedEvent): Promise<void> {
    const { payload, metadata } = event;

    // Update analytics
    await this.analyticsService.trackOrderProcessed({
      orderId: payload.orderId,
      customerId: payload.customerId,
      totalAmount: payload.totalAmount,
      currency: payload.currency,
      itemCount: payload.items.length,
      timestamp: event.occurredAt,
    });

    // Update metrics
    this.metricsCollector.increment('orders.processed', 1, {
      currency: payload.currency,
      status: payload.processingStatus,
    });

    this.metricsCollector.histogram('orders.amount', payload.totalAmount, {
      currency: payload.currency,
    });
  }

  getEventType(): string {
    return 'OrderProcessed';
  }

  getHandlerName(): string {
    return 'OrderAnalyticsHandler';
  }
}
```

### Event Bus Implementation Contract

```typescript
// src/infrastructure/events/event-bus-implementation.ts
import { IEventBus, IDomainEvent, IEventHandler } from '@vytches-ddd/contracts';

// Event bus interface implementation
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, IEventHandler<any>[]>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // Publish single event
  async publish<T extends IDomainEvent>(event: T): Promise<void> {
    const eventType = event.eventType;
    const eventHandlers = this.handlers.get(eventType) || [];

    this.logger.debug('Publishing event', {
      eventType,
      aggregateId: event.aggregateId,
      handlerCount: eventHandlers.length,
      correlationId: event.metadata.correlationId,
    });

    // Execute handlers concurrently
    const handlerPromises = eventHandlers.map(async handler => {
      try {
        await handler.handle(event);
        this.logger.debug('Event handler completed successfully', {
          eventType,
          handlerName: this.getHandlerName(handler),
          correlationId: event.metadata.correlationId,
        });
      } catch (error) {
        this.logger.error('Event handler failed', {
          eventType,
          handlerName: this.getHandlerName(handler),
          error: error.message,
          correlationId: event.metadata.correlationId,
        });
        throw error;
      }
    });

    await Promise.all(handlerPromises);
  }

  // Publish multiple events
  async publishMany<T extends IDomainEvent>(events: T[]): Promise<void> {
    const publishPromises = events.map(event => this.publish(event));
    await Promise.all(publishPromises);
  }

  // Subscribe handler to event type
  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const eventHandlers = this.handlers.get(eventType)!;
    eventHandlers.push(handler);

    this.logger.info('Event handler subscribed', {
      eventType,
      handlerName: this.getHandlerName(handler),
      totalHandlers: eventHandlers.length,
    });
  }

  // Unsubscribe handler
  unsubscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(eventType);
    if (!eventHandlers) return;

    const index = eventHandlers.indexOf(handler);
    if (index !== -1) {
      eventHandlers.splice(index, 1);
      this.logger.info('Event handler unsubscribed', {
        eventType,
        handlerName: this.getHandlerName(handler),
      });
    }
  }

  // Get all handlers for event type
  getHandlers<T extends IDomainEvent>(eventType: string): IEventHandler<T>[] {
    return this.handlers.get(eventType) || [];
  }

  // Clear all handlers
  clear(): void {
    this.handlers.clear();
    this.logger.info('All event handlers cleared');
  }

  private getHandlerName(handler: IEventHandler<any>): string {
    // Try to get handler name from method if available
    if (typeof handler.getHandlerName === 'function') {
      return handler.getHandlerName();
    }
    return handler.constructor.name;
  }
}
```

### Event Registry and Discovery

```typescript
// src/infrastructure/events/event-registry.ts
import { IDomainEvent, IEventHandler } from '@vytches-ddd/contracts';

interface EventHandlerRegistration {
  eventType: string;
  handler: IEventHandler<any>;
  metadata: {
    name: string;
    version: string;
    priority?: number;
    async: boolean;
  };
}

export class EventRegistry {
  private registrations = new Map<string, EventHandlerRegistration[]>();

  // Register handler with metadata
  register<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
    metadata: {
      name?: string;
      version?: string;
      priority?: number;
      async?: boolean;
    } = {}
  ): void {
    const registration: EventHandlerRegistration = {
      eventType,
      handler,
      metadata: {
        name: metadata.name || handler.constructor.name,
        version: metadata.version || '1.0.0',
        priority: metadata.priority || 0,
        async: metadata.async ?? true,
      },
    };

    if (!this.registrations.has(eventType)) {
      this.registrations.set(eventType, []);
    }

    const handlers = this.registrations.get(eventType)!;
    handlers.push(registration);

    // Sort by priority (higher priority first)
    handlers.sort(
      (a, b) => (b.metadata.priority || 0) - (a.metadata.priority || 0)
    );
  }

  // Get handlers for event type
  getHandlers(eventType: string): EventHandlerRegistration[] {
    return this.registrations.get(eventType) || [];
  }

  // Get all registered event types
  getEventTypes(): string[] {
    return Array.from(this.registrations.keys());
  }

  // Get handler statistics
  getStatistics(): {
    totalEventTypes: number;
    totalHandlers: number;
    handlersByType: Record<string, number>;
  } {
    const handlersByType: Record<string, number> = {};
    let totalHandlers = 0;

    for (const [eventType, handlers] of this.registrations) {
      handlersByType[eventType] = handlers.length;
      totalHandlers += handlers.length;
    }

    return {
      totalEventTypes: this.registrations.size,
      totalHandlers,
      handlersByType,
    };
  }

  // Auto-discovery from decorators (if using decorator pattern)
  discoverHandlers(handlers: any[]): void {
    for (const handlerClass of handlers) {
      const instance = new handlerClass();

      // Check if handler implements IEventHandler
      if (typeof instance.handle === 'function') {
        // Try to get event type from metadata or method
        const eventType = this.extractEventType(instance);
        if (eventType) {
          this.register(eventType, instance);
        }
      }
    }
  }

  private extractEventType(handler: any): string | null {
    // Try method if available
    if (typeof handler.getEventType === 'function') {
      return handler.getEventType();
    }

    // Try metadata if using decorators
    if (handler.constructor.eventType) {
      return handler.constructor.eventType;
    }

    // Fallback: extract from class name
    const className = handler.constructor.name;
    if (className.endsWith('Handler')) {
      return className.replace('Handler', '');
    }

    return null;
  }
}
```

### Integration Event Patterns

```typescript
// src/domain/events/integration-events.ts
import { IDomainEvent, DomainEventMetadata } from '@vytches-ddd/contracts';

// Integration event for cross-domain communication
export class CustomerProfileUpdatedIntegrationEvent implements IDomainEvent {
  public readonly eventType = 'Integration.CustomerProfileUpdated';
  public readonly eventVersion = '1.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      customerId: string;
      changes: {
        email?: string;
        name?: string;
        address?: {
          street: string;
          city: string;
          zipCode: string;
          country: string;
        };
        preferences?: Record<string, any>;
      };
      previousValues: Record<string, any>;
      changeReason: string;
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();
    this.metadata = {
      correlationId: metadata.correlationId || `customer-${aggregateId}`,
      timestamp: this.occurredAt,
      source: 'CustomerDomain',
      destination: ['OrderDomain', 'MarketingDomain'],
      ...metadata,
    };
  }
}

// Event for external system integration
export class PaymentProcessedExternalEvent implements IDomainEvent {
  public readonly eventType = 'External.PaymentProcessed';
  public readonly eventVersion = '1.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      paymentId: string;
      orderId: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      externalTransactionId: string;
      gatewayResponse: {
        status: 'success' | 'failed' | 'pending';
        message: string;
        errorCode?: string;
      };
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();
    this.metadata = {
      correlationId:
        metadata.correlationId || `payment-${this.payload.paymentId}`,
      timestamp: this.occurredAt,
      source: 'PaymentGateway',
      externalTransactionId: this.payload.externalTransactionId,
      ...metadata,
    };
  }
}
```

### Event Versioning and Migration

```typescript
// src/domain/events/event-versioning.ts
import { IDomainEvent, DomainEventMetadata } from '@vytches-ddd/contracts';

// Version 1 of user event
export class UserCreatedEventV1 implements IDomainEvent {
  public readonly eventType = 'UserCreated';
  public readonly eventVersion = '1.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      userId: string;
      email: string;
      name: string;
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();
  }
}

// Version 2 with additional fields
export class UserCreatedEventV2 implements IDomainEvent {
  public readonly eventType = 'UserCreated';
  public readonly eventVersion = '2.0.0';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      userId: string;
      email: string;
      name: string;
      // New fields in v2
      registrationSource: 'web' | 'mobile' | 'api';
      subscriptionPlan: 'free' | 'premium' | 'enterprise';
      preferences?: {
        newsletter: boolean;
        notifications: boolean;
      };
    },
    public readonly metadata: DomainEventMetadata = {}
  ) {
    this.occurredAt = new Date();
  }
}

// Event migration utility
export class EventMigrator {
  static migrateUserCreatedEvent(
    event: UserCreatedEventV1
  ): UserCreatedEventV2 {
    return new UserCreatedEventV2(
      event.aggregateId,
      {
        ...event.payload,
        // Default values for new fields
        registrationSource: 'web',
        subscriptionPlan: 'free',
        preferences: {
          newsletter: true,
          notifications: true,
        },
      },
      {
        ...event.metadata,
        migratedFrom: event.eventVersion,
        migrationTimestamp: new Date(),
      }
    );
  }
}
```

## Key Features

- **Type Safety**: Full TypeScript support for events and handlers
- **Metadata Support**: Rich metadata for correlation, causation, and tracking
- **Handler Registration**: Flexible handler registration and discovery
- **Event Versioning**: Support for event schema evolution
- **Integration Events**: Cross-domain and external system events
- **Async Processing**: Concurrent handler execution
- **Error Handling**: Comprehensive error handling and logging

## Common Pitfalls

- **Missing Metadata**: Always include correlation IDs for traceability
- **Handler Exceptions**: Ensure proper error handling in event handlers
- **Event Versioning**: Plan for event schema evolution from the start
- **Memory Leaks**: Properly unsubscribe handlers when no longer needed

## Related Examples

- Foundation Contracts - Core interfaces and specifications
- Advanced Event Architecture - Persistence and replay patterns
- EntityId Usage - Using EntityId in domain events

## Best Practices

- Use meaningful event names that describe business outcomes
- Include rich metadata for debugging and correlation
- Design events for forward compatibility
- Implement idempotent event handlers
- Use integration events for cross-domain communication
- Version events when schema changes are needed
- Log event processing for observability
