// Base implementation
export { BaseEventStore } from './base-event-store';

// In-Memory implementation
export { InMemoryEventStore } from './in-memory-event-store';

// Event Replay
export { EventReplayEngine } from './event-replay-engine';
export {
  createAdvancedEventReplay,
  createEventReplay,
  createEventReplayFactory,
  EventReplayFactory,
} from './event-replay-factory';

// Serializers
export { JsonEventSerializer } from './serializers/json-event-serializer';

// Errors
export {
  EventDeserializationError,
  EventSerializationError,
  EventStoreConcurrencyError,
  EventStoreConnectionError,
  EventStoreError,
  EventStoreErrorCode,
  InvalidStreamVersionError,
  StreamDeletedError,
  StreamNotFoundError,
} from './errors';

export type { EventStoreErrorOptions } from './errors';

// Re-export interfaces from contracts for convenience
export type {
  IAdvancedEventStore,
  IAppendResult,
  IEventSerializer,
  IEventStore,
  IEventStoreAdapter,
  IEventStoreConfig,
  IEventStream,
  IGlobalEventStream,
  IReadAllOptions,
  IReadStreamOptions,
  IStoredDomainEvent,
  IStoredEvent,
  IStreamMetadata,
} from '@vytches/ddd-contracts';
