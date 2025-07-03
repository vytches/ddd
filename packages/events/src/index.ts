// Most commonly used - prioritized exports
export type {
  IDomainEventBus,
  IIntegrationEventBus,
  IAuditEventBus
} from './event-bus';

export {
  UniversalEventDispatcher
} from './event-dispatcher';

export {
  EventHandler
} from './event-handler';

export {
  BaseEventBus,
  CUSTOM_MIDDLEWARE_SYMBOL
} from './base-event-bus';

export {
  EventBusRegistry
} from './event-bus-registry';

// Domain events
export {
  DomainEvent,
  InMemoryDomainEventBus,
  type InMemoryDomainEventBusOptions
} from './domain';

// Integration events - commonly used
export {
  IntegrationEvent,
  InMemoryIntegrationEventBus,
  IntegrationEventProcessor,
  DomainToIntegrationTransformer
} from './integration';

// For advanced usage - full exports removed for better tree-shaking
// Import specific exports from subpaths when needed
