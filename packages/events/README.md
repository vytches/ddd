# @vytches/ddd-events

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-events.svg)](https://badge.fury.io/js/%40vytches%2Fddd-events)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Domain events, integration events, and a unified event bus for DDD
> applications**

## Installation

```bash
pnpm add @vytches/ddd-events
```

## What's included

### Event classes

| Export             | Kind  | Description                                                  |
| ------------------ | ----- | ------------------------------------------------------------ |
| `DomainEvent`      | class | Base class for domain events (aggregate-level state changes) |
| `IntegrationEvent` | class | Base class for cross-boundary integration events             |

### Buses and dispatchers

| Export                     | Kind  | Description                                                     |
| -------------------------- | ----- | --------------------------------------------------------------- |
| `BaseEventBus`             | class | Abstract base for custom event bus implementations              |
| `UnifiedEventBus`          | class | Concrete bus that handles domain, integration, and audit events |
| `UniversalEventDispatcher` | class | Dispatches events to all registered buses simultaneously        |

### Integration event processing

| Export                           | Kind  | Description                                                          |
| -------------------------------- | ----- | -------------------------------------------------------------------- |
| `IntegrationEventProcessor`      | class | Processes raw `IntegrationEvent` objects through registered handlers |
| `DomainToIntegrationTransformer` | class | Transforms `DomainEvent` instances into `IntegrationEvent` instances |

### Decorators and discovery

| Export                 | Kind      | Description                                                                |
| ---------------------- | --------- | -------------------------------------------------------------------------- |
| `EventHandler`         | decorator | Marks a class as a handler for specific event type(s)                      |
| `EventDiscoveryPlugin` | class     | `IHandlerDiscoveryPlugin` that discovers `@EventHandler`-decorated classes |
| `eventDiscoveryPlugin` | object    | Pre-built singleton instance of `EventDiscoveryPlugin`                     |
| `EventHandlerOptions`  | interface | Options accepted by `@EventHandler`                                        |
| `DIHandlerMetadata`    | interface | Metadata stored on handler classes by the decorator                        |

### Bus interfaces

| Export                 | Kind      | Description                                    |
| ---------------------- | --------- | ---------------------------------------------- |
| `IDomainEventBus`      | interface | Bus for domain events                          |
| `IIntegrationEventBus` | interface | Bus for integration events                     |
| `IAuditEventBus`       | interface | Bus for audit events                           |
| `UnifiedEventHandler`  | interface | Handler contract accepted by `UnifiedEventBus` |

### Internal symbol (advanced use)

| Export                     | Kind   | Description                                                                         |
| -------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `CUSTOM_MIDDLEWARE_SYMBOL` | symbol | Marker for custom middleware attached to buses; not part of the stable consumer API |

## Quick start

### Define and publish a domain event

```typescript
import { DomainEvent, UnifiedEventBus } from '@vytches/ddd-events';

class OrderPlaced extends DomainEvent<{ orderId: string; total: number }> {
  constructor(payload: { orderId: string; total: number }) {
    super('OrderPlaced', payload, { version: 1, source: 'OrderContext' });
  }
}

const eventBus = new UnifiedEventBus();

eventBus.subscribe('OrderPlaced', async event => {
  console.log('Order placed:', event.payload.orderId);
});

await eventBus.publish(new OrderPlaced({ orderId: 'ord-1', total: 99.99 }));
```

### Handler decorator

```typescript
import { EventHandler } from '@vytches/ddd-events';

@EventHandler(OrderPlaced)
class SendConfirmationEmailHandler {
  async handle(event: OrderPlaced): Promise<void> {
    await emailService.send(event.payload.orderId);
  }
}
```

### Integration events

```typescript
import {
  IntegrationEvent,
  DomainToIntegrationTransformer,
} from '@vytches/ddd-events';

class OrderCreatedIntegrationEvent extends IntegrationEvent<{
  orderId: string;
}> {
  constructor(orderId: string) {
    super('OrderCreated', { orderId }, { source: 'OrderContext' });
  }
}

const transformer = new DomainToIntegrationTransformer([
  {
    domainEventName: 'OrderPlaced',
    transform: domainEvent =>
      new OrderCreatedIntegrationEvent(domainEvent.payload.orderId),
  },
]);
```

## Package boundaries

`@vytches/ddd-events` depends on:

- `@vytches/ddd-contracts` — `IDomainEvent`, `IEventBus`, `IEventHandler`,
  metadata keys
- `@vytches/ddd-logging` — internal logging

## License

MIT
