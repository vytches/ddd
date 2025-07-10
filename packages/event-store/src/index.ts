// Base implementation
export { BaseEventStore } from './base-event-store';

// In-Memory implementation
export { InMemoryEventStore } from './in-memory-event-store';

// Event Replay
export { EventReplayEngine } from './event-replay-engine';
export { EventReplayFactory, createEventReplayFactory, createEventReplay, createAdvancedEventReplay } from './event-replay-factory';

// Serializers
export { JsonEventSerializer } from './serializers/json-event-serializer';

// Errors
export {
  EventStoreErrorCode,
  EventStoreError,
  EventStoreConcurrencyError,
  StreamNotFoundError,
  StreamDeletedError,
  EventSerializationError,
  EventDeserializationError,
  EventStoreConnectionError,
  InvalidStreamVersionError,
} from './errors';

export type { EventStoreErrorOptions } from './errors';

// Re-export interfaces from contracts for convenience
export type {
  IAdvancedEventStore,
  IEventStore,
  IEventStoreConfig,
  IAppendResult,
  IStoredEvent,
  IStoredDomainEvent,
  IEventStream,
  IGlobalEventStream,
  IReadStreamOptions,
  IReadAllOptions,
  IStreamMetadata,
  IEventSerializer,
  IEventStoreAdapter,
} from '@vytches-ddd/contracts';
