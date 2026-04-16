# @vytches/ddd-events - LLM Guide

## Purpose

Provides concrete event classes (`DomainEvent`, `IntegrationEvent`), three typed
event bus interfaces, a `UnifiedEventBus` implementation, decorator-based
handler registration, and a `DomainToIntegrationTransformer` for cross-context
event translation.

## Quick Start

```typescript
import {
  DomainEvent,
  UnifiedEventBus,
  EventHandler,
} from '@vytches/ddd-events';
import type { IDomainEventBus } from '@vytches/ddd-events';

// 1. Define a domain event
interface OrderPlacedPayload {
  orderId: string;
  amount: number;
}

class OrderPlacedEvent extends DomainEvent<OrderPlacedPayload> {
  constructor(payload: OrderPlacedPayload) {
    super(payload);
  }
}

// 2. Register a handler
@EventHandler(OrderPlacedEvent)
class OrderPlacedHandler {
  async handle(event: OrderPlacedEvent): Promise<void> {
    console.log('Order placed:', event.payload?.orderId);
  }
}

// 3. Create the bus and publish
const bus: IDomainEventBus = new UnifiedEventBus({ enableLogging: true });
bus.registerHandler(OrderPlacedEvent, new OrderPlacedHandler());
await bus.publish(new OrderPlacedEvent({ orderId: 'o-1', amount: 100 }));
```

## Key API

| Export                                    | Kind           | Description                                                                                 |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `DomainEvent<T>`                          | abstract class | Base for domain events; auto-generates `eventId`, `occurredOn`, `eventName` from class name |
| `IntegrationEvent<T>`                     | abstract class | Base for integration events; adds `serialize()` / static `deserialize()`, `schemaVersion`   |
| `IDomainEventBus`                         | type alias     | `IEventBus<IDomainEvent>` — for within-context events                                       |
| `IIntegrationEventBus`                    | type alias     | `IEventBus<IIntegrationEvent>` — for cross-context events                                   |
| `IAuditEventBus`                          | type alias     | `IEventBus<IAuditEvent>` — for compliance/audit events                                      |
| `UnifiedEventBus`                         | class          | Handles all three event types; routes by class name with optional context filtering         |
| `BaseEventBus<T>`                         | class          | Extend this to create custom bus implementations                                            |
| `UniversalEventDispatcher`                | class          | Dispatches events to multiple registered buses simultaneously                               |
| `EventHandler(EventClass, opts?)`         | decorator      | Registers class or method as event handler; supports DI auto-discovery                      |
| `EventDiscoveryPlugin`                    | class          | Scans metadata to auto-register `@EventHandler`-decorated classes                           |
| `DomainToIntegrationTransformer<D,I>`     | abstract class | Override `transform()` to map a domain event to an integration event                        |
| `IntegrationEventProcessor`               | class          | Processes integration events through a pipeline                                             |
| `DomainEvent.withMetadata(partial)`       | method         | Returns a new event copy with merged metadata                                               |
| `IntegrationEvent.serialize()`            | method         | Serializes to JSON string with payload + metadata                                           |
| `IntegrationEvent.deserialize(Cls, json)` | static         | Deserializes JSON back to typed event instance (max 1MB)                                    |

## Patterns

### Cross-context transformer

```typescript
import {
  DomainToIntegrationTransformer,
  IntegrationEvent,
} from '@vytches/ddd-events';
import type { IDomainEvent } from '@vytches/ddd-contracts';

interface OrderPlacedPayload {
  orderId: string;
  amount: number;
}
interface OrderCreatedIntegrationPayload {
  id: string;
  totalAmount: number;
}

class OrderCreatedIntegration extends IntegrationEvent<OrderCreatedIntegrationPayload> {}

class OrderPlacedTransformer extends DomainToIntegrationTransformer<
  OrderPlacedPayload,
  OrderCreatedIntegrationPayload
> {
  constructor() {
    super('orders');
  }

  protected transform(
    event: IDomainEvent<OrderPlacedPayload>
  ): OrderCreatedIntegration {
    return new OrderCreatedIntegration({
      id: event.payload!.orderId,
      totalAmount: event.payload!.amount,
    });
  }
}
```

### UnifiedEventBus with middleware

```typescript
import { UnifiedEventBus, BaseEventBus } from '@vytches/ddd-events';
import type { BaseEventBusOptions } from '@vytches/ddd-contracts';

const options: BaseEventBusOptions = {
  enableLogging: true,
  onError: (err, eventType) => logger.error('Event failed', { err, eventType }),
  middlewares: [
    next => async event => {
      console.log('before', (event as any).eventName);
      await next(event);
      console.log('after', (event as any).eventName);
    },
  ],
};

const bus = new UnifiedEventBus(options);
```

### Metadata correlation across events

```typescript
import { DomainEvent } from '@vytches/ddd-events';

class PaymentProcessed extends DomainEvent<{ orderId: string }> {}

const event = new PaymentProcessed({ orderId: 'o-1' });
const correlated = event.withMetadata({
  correlationId: 'req-abc',
  causationId: event.eventId,
});
// correlated.metadata.correlationId === 'req-abc'
```

## Anti-Patterns

**Publishing domain events from outside aggregates.** Domain events should be
generated exclusively inside aggregate methods via `apply()` and collected from
`getDomainEvents()` after persistence. Publishing an event directly from an
application service bypasses the aggregate's version tracking.

**Not using metadata for tracing.** `IDomainEvent.metadata` exists for
`correlationId`, `causationId`, and `actor`. Ignoring these fields makes
distributed tracing impossible. Always propagate `correlationId` from inbound
requests into event metadata.

**Confusing `DomainEvent` with `IntegrationEvent`.** `DomainEvent` is for
within-context state changes. `IntegrationEvent` crosses bounded context
boundaries. Publishing a `DomainEvent` directly to a message broker bypasses
translation and schema versioning — use `DomainToIntegrationTransformer`
instead.

**Coupling to `UnifiedEventBus` directly in domain code.** Domain code should
depend on `IDomainEventBus` (the type alias), not `UnifiedEventBus` (the
concrete class). This keeps the domain testable with a simple in-memory stub.

**Expecting `@EventHandler` auto-registration without calling
`EventDiscoveryPlugin`.** The decorator records metadata but does not register
handlers with any bus. You must call `EventDiscoveryPlugin` (or
`eventDiscoveryPlugin`) and provide a resolver to complete wiring.

## Hidden Features

`DomainEvent.eventName` defaults to the class name — override by passing a third
constructor argument `eventName?: string` if you need a stable name that
survives minification in production builds.

`IntegrationEvent.deserialize` enforces a hard 1MB size limit and sanitizes
`__proto__`, `constructor`, and `prototype` keys — this is a security feature,
not just a parser.

`UnifiedEventBus` calls `autoRegisterHandlers()` in its constructor — handlers
decorated with `@EventHandler` that are already in scope at construction time
are registered without any additional call.

`BaseEventBus` (exported as `CUSTOM_MIDDLEWARE_SYMBOL`) exposes a symbol for
injecting custom middleware from outside the class — useful when extending
`BaseEventBus` and needing to insert middleware at construction time from a DI
container.

`DomainToIntegrationTransformer.transformToMultipleTargets()` routes a single
domain event to several integration events when a `IContextRouter` is provided —
useful for fan-out patterns to multiple downstream contexts.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts`, `@vytches/ddd-domain-primitives`,
`@vytches/ddd-logging`, `@vytches/ddd-utils`.

**Depended on by:** `@vytches/ddd-enterprise`, `@vytches/ddd-nestjs`,
`@vytches/ddd-repositories`.
