// Most commonly used - prioritized exports
export type { IDomainEventBus, IIntegrationEventBus, IAuditEventBus } from './event-bus';

export { UniversalEventDispatcher } from './event-dispatcher';

export { EventHandler, EventDiscoveryPlugin, eventDiscoveryPlugin } from './decorators';
export type { EventHandlerOptions, DIHandlerMetadata } from './decorators';

export { BaseEventBus, CUSTOM_MIDDLEWARE_SYMBOL } from './base-event-bus';

export { UnifiedEventBus } from './unified-event-bus';
export type { UnifiedEventHandler } from './unified-event-bus';

// Domain events
export { DomainEvent } from './domain';

// Integration events - commonly used
export {
  IntegrationEvent,
  IntegrationEventProcessor,
  DomainToIntegrationTransformer,
} from './integration';

// For advanced usage - full exports removed for better tree-shaking
// Import specific exports from subpaths when needed
