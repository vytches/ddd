# Event Bus in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Event Bus
- **Category**: Infrastructure Pattern
- **Purpose**: Handle domain event publication and subscription with middleware support
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What is the Event Bus?

The Event Bus is an infrastructure component that manages publication and subscription of domain events. It provides a decoupled way for different parts of the system to communicate through events.

**Core Concept**:
```typescript
// Publish an event
await eventBus.publish(new OrderPlacedEvent({ orderId: '123' }));

// Subscribe to events
eventBus.subscribe(OrderPlacedEvent, (event) => {
  console.log('Order placed:', event.payload.orderId);
});
```

## Core Components

### 1. IEventBus Interface

Abstract interface defining the event bus contract:

```typescript
abstract class IEventBus {
  abstract publish<T extends IDomainEvent>(event: T): Promise<void>;
  
  abstract subscribe<T extends IDomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: EventHandlerFn<T>
  ): void;
  
  abstract registerHandler<T extends IDomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: IEventHandler<T>
  ): void;
  
  abstract unsubscribe<T extends IDomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: EventHandlerFn<T> | IEventHandler<T>
  ): void;
}
```

### 2. Event Handlers

Two types of event handlers are supported:

**Function Handlers**:
```typescript
type EventHandlerFn<T extends IDomainEvent> = (event: T) => Promise<void> | void;
```

**Class-based Handlers**:
```typescript
interface IEventHandler<T extends IDomainEvent> {
  handle(event: T): Promise<void> | void;
}
```

**Handler Detection**:
```typescript
function isEventHandler(obj: any): obj is IEventHandler<any> {
  return (
    obj &&
    typeof obj === 'object' &&
    'handle' in obj &&
    typeof obj.handle === 'function'
  );
}
```

### 3. Event Handler Decorator

Decorator for marking classes or methods as event handlers:

```typescript
@EventHandler(UserCreatedEvent)
class UserCreatedHandler implements IEventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent): void {
    // Handle event
  }
}
```

**EventHandlerOptions**:
```typescript
interface EventHandlerOptions {
  active?: boolean;        // Enable/disable handler conditionally
  availableFrom?: string;  // Version-based activation
  priority?: number;       // Execution order (higher = earlier)
  [key: string]: any;      // Custom metadata
}
```

#### Advanced Decorator Usage

```typescript
// Method-level decorator
class UserNotifications {
  @EventHandler(UserCreatedEvent)
  onUserCreated(event: UserCreatedEvent): void {
    console.log('User created:', event.payload.userId);
  }
  
  @EventHandler(UserDeletedEvent, { priority: 10 })
  onUserDeleted(event: UserDeletedEvent): void {
    console.log('User deleted:', event.payload.userId);
  }
}

// Conditional handler activation
@EventHandler(OrderPlacedEvent, { active: false })
class DisabledOrderHandler implements IEventHandler<OrderPlacedEvent> {
  handle(event: OrderPlacedEvent): void {
    // This handler is disabled and won't be executed
  }
}

// Version-based activation
@EventHandler(NewFeatureEvent, { availableFrom: '1.2.0' })
class NewFeatureHandler implements IEventHandler<NewFeatureEvent> {
  handle(event: NewFeatureEvent): void {
    // Only active in version 1.2.0 and above
  }
}

// Priority-based execution
@EventHandler(OrderProcessedEvent, { priority: 100 })
class HighPriorityHandler implements IEventHandler<OrderProcessedEvent> {
  handle(event: OrderProcessedEvent): void {
    // Executes before handlers with lower priority
  }
}
```

### 4. Metadata and Reflection

The event bus uses metadata for handler registration and configuration:

```typescript
// Metadata symbols
export const EVENT_HANDLER_METADATA = Symbol('EVENT_HANDLER_METADATA');
export const EVENT_HANDLER_OPTIONS = Symbol('EVENT_HANDLER_OPTIONS');

// Metadata structure
interface EventHandlerMetadata {
  eventType: new (...args: any[]) => IDomainEvent;
}

// How decorator adds metadata
Reflect.defineMetadata(EVENT_HANDLER_METADATA, { eventType }, target);
Reflect.defineMetadata(EVENT_HANDLER_OPTIONS, options, target);

// How to retrieve metadata
const metadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, handler);
const options = Reflect.getMetadata(EVENT_HANDLER_OPTIONS, handler);
```

### 5. InMemoryEventBus Implementation

The in-memory implementation stores handlers and manages event publishing:

```typescript
export class InMemoryEventBus implements IEventBus {
  // Store handlers by event type name
  private handlers: Map<string, Set<EventHandlerFn<any> | IEventHandler<any>>> = 
    new Map();
  
  // Middleware pipeline for processing events
  private publishPipeline: (event: IDomainEvent) => Promise<void>;
  
  constructor(options: InMemoryEventBusOptions = {}) {
    this.options = { enableLogging: false, ...options };
    this.publishPipeline = this.buildPublishPipeline();
  }
  
  // Extract event name from constructor
  private getEventName<T extends IDomainEvent>(
    eventType: new (...args: any[]) => T
  ): string {
    const prototype = eventType.prototype;
    if (prototype && 'eventType' in prototype) {
      return prototype.eventType;
    }
    return eventType.name;
  }
  
  // Dynamic middleware addition
  public addMiddleware(middleware: EventBusMiddleware): void {
    this.options.middlewares = [
      ...(this.options.middlewares || []),
      middleware
    ];
    this.publishPipeline = this.buildPublishPipeline();
  }
  
  // Building the middleware pipeline
  private buildPublishPipeline(): (event: IDomainEvent) => Promise<void> {
    // Base pipeline - actual event handling
    const basePipeline = async (event: IDomainEvent): Promise<void> => {
      const eventName = (event as any).eventType || event.constructor.name;
      const handlers = this.handlers.get(eventName);
      
      if (!handlers || handlers.size === 0) {
        if (this.options.enableLogging) {
          console.log(`[EventBus] No handlers for ${eventName}`);
        }
        return;
      }
      
      // Execute handlers
      const promises: Promise<void>[] = [];
      for (const handler of handlers) {
        try {
          let result: void | Promise<void>;
          
          if (isEventHandler(handler)) {
            result = handler.handle(event);
          } else {
            result = handler(event);
          }
          
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          this.handleError(error as Error, eventName);
        }
      }
      
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    };
    
    // Apply middlewares in reverse order
    let pipeline = basePipeline;
    if (this.options.middlewares) {
      for (let i = this.options.middlewares.length - 1; i >= 0; i--) {
        pipeline = this.options.middlewares[i](pipeline);
      }
    }
    
    return pipeline;
  }
}
```

### 6. Event Bus Builder

Fluent API for configuring event buses:

```typescript
const eventBus = EventBusBuilder.create()
  .withLogging()
  .withCorrelation()
  .withErrorHandler((error, eventType) => {
    console.error(`Error in ${eventType}:`, error);
  })
  .withCustomMiddleware(async (event, next) => {
    console.log('Before:', event.eventType);
    await next(event);
    console.log('After:', event.eventType);
  })
  .build();
```

## Advanced Usage Patterns

### Priority-based Handler Execution

```typescript
// Handlers execute in priority order (highest first)
@EventHandler(OrderPlacedEvent, { priority: 100 })
class CriticalOrderHandler implements IEventHandler<OrderPlacedEvent> {
  handle(event: OrderPlacedEvent): void {
    // Executes first - critical business logic
  }
}

@EventHandler(OrderPlacedEvent, { priority: 50 })
class StandardOrderHandler implements IEventHandler<OrderPlacedEvent> {
  handle(event: OrderPlacedEvent): void {
    // Executes second - standard processing
  }
}

@EventHandler(OrderPlacedEvent, { priority: 10 })
class LoggingHandler implements IEventHandler<OrderPlacedEvent> {
  handle(event: OrderPlacedEvent): void {
    // Executes last - logging/metrics
  }
}
```

### Conditional Handler Activation

```typescript
// Environment-based activation
@EventHandler(PaymentProcessedEvent, { 
  active: process.env.PAYMENT_WEBHOOKS_ENABLED === 'true' 
})
class PaymentWebhookHandler implements IEventHandler<PaymentProcessedEvent> {
  handle(event: PaymentProcessedEvent): void {
    // Only active when environment variable is set
  }
}

// Feature flag based activation
@EventHandler(NewFeatureEvent, { 
  active: featureFlags.isEnabled('new-feature') 
})
class NewFeatureHandler implements IEventHandler<NewFeatureEvent> {
  handle(event: NewFeatureEvent): void {
    // Activated based on feature flag
  }
}
```

### Version-based Handler Management

```typescript
// Different handlers for different versions
@EventHandler(UserCreatedEvent, { availableFrom: '1.0.0' })
class LegacyUserHandler implements IEventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent): void {
    // Original handler logic
  }
}

@EventHandler(UserCreatedEvent, { availableFrom: '2.0.0' })
class ModernUserHandler implements IEventHandler<UserCreatedEvent> {
  handle(event: UserCreatedEvent): void {
    // Updated handler logic for v2.0.0+
  }
}
```

### Complex Middleware Chains

```typescript
// Authentication middleware
const authMiddleware: EventBusMiddleware = (next) => async (event) => {
  const metadata = (event as IExtendedDomainEvent).metadata;
  if (metadata?.userId) {
    await validateUserPermissions(metadata.userId);
  }
  await next(event);
};

// Performance monitoring middleware
const performanceMiddleware: EventBusMiddleware = (next) => async (event) => {
  const start = performance.now();
  await next(event);
  const duration = performance.now() - start;
  metrics.recordEventProcessingTime(event.eventType, duration);
};

// Retry middleware
const retryMiddleware: EventBusMiddleware = (next) => async (event) => {
  let lastError: Error;
  for (let i = 0; i < 3; i++) {
    try {
      await next(event);
      return;
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw lastError!;
};

// Compose middleware
const eventBus = EventBusBuilder.create()
  .withMiddleware(authMiddleware)
  .withMiddleware(performanceMiddleware)
  .withMiddleware(retryMiddleware)
  .build();
```

## Troubleshooting and Debugging

### Event Flow Tracing

```typescript
// Debug middleware for tracing event flow
const debugMiddleware: EventBusMiddleware = (next) => async (event) => {
  const eventId = (event as IExtendedDomainEvent).metadata?.eventId;
  console.group(`Event: ${event.eventType} (${eventId})`);
  console.log('Payload:', event.payload);
  console.log('Metadata:', (event as IExtendedDomainEvent).metadata);
  console.time('Processing');
  
  try {
    await next(event);
    console.log('✓ Success');
  } catch (error) {
    console.error('✗ Error:', error);
    throw error;
  } finally {
    console.timeEnd('Processing');
    console.groupEnd();
  }
};
```

### Handler Registration Inspection

```typescript
// Extend InMemoryEventBus for debugging
class DebuggableEventBus extends InMemoryEventBus {
  getHandlerCount(eventType: new (...args: any[]) => IDomainEvent): number {
    const eventName = this.getEventName(eventType);
    return this.handlers.get(eventName)?.size || 0;
  }
  
  listHandlers(): Map<string, number> {
    const result = new Map<string, number>();
    this.handlers.forEach((handlers, eventType) => {
      result.set(eventType, handlers.size);
    });
    return result;
  }
}
```

### Common Issues and Solutions

1. **Handler Not Being Called**
   - Check event type name matches exactly
   - Verify handler is properly registered
   - Ensure handler options are correct (active: true)

2. **Events Lost During Processing**
   - Check error handler configuration
   - Verify async handlers are properly awaited
   - Review middleware error handling

3. **Performance Issues**
   - Avoid blocking operations in handlers
   - Use async handlers for I/O operations
   - Consider batching for high-frequency events

4. **Memory Leaks**
   - Always unsubscribe handlers when no longer needed
   - Be careful with closure references in handlers
   - Monitor handler count growth

## Best Practices

1. **Keep Handlers Focused**: Single responsibility per handler
2. **Use Async Wisely**: Don't block the event loop
3. **Handle Errors Gracefully**: Always configure error handlers
4. **Add Correlation**: Track related events across services
5. **Test with Middleware**: Add testing middleware for verification
6. **Version Your Handlers**: Plan for handler evolution
7. **Monitor Performance**: Add metrics middleware
8. **Document Handler Dependencies**: Clear handler execution order

## Conclusion

DomainTS Event Bus provides:

- **Decoupled Communication**: Loose coupling between components
- **Middleware Pipeline**: Extensible event processing
- **Flexible Handlers**: Function and class-based approaches
- **Rich Metadata**: Decorators with configuration options
- **Error Resilience**: Configurable error handling
- **Dynamic Configuration**: Runtime middleware addition
- **Debugging Support**: Tools for troubleshooting

The implementation supports simple event publishing as well as complex event-driven architectures with features like priority handling, conditional activation, and sophisticated middleware pipelines.
