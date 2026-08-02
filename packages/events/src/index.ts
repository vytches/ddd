// Most commonly used - prioritized exports
export type { IDomainEventBus, IIntegrationEventBus, IAuditEventBus } from './event-bus';

export { UniversalEventDispatcher } from './event-dispatcher';

export { EventHandler, EventDiscoveryPlugin, eventDiscoveryPlugin } from './decorators';
export type { EventHandlerOptions, DIHandlerMetadata } from './decorators';

export { BaseEventBus } from './base-event-bus';
export type { PublishManyOptions } from './base-event-bus';

export { AggregatedEventHandlerError } from './aggregated-event-handler-error';

// CUSTOM_MIDDLEWARE_SYMBOL — moved to the `@vytches/ddd-events/internal`
// subpath (VF-024, AC4). Framework-only middleware marker symbol; not part
// of the public consumer API.

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
