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
} from './event-store.errors';

export type { EventStoreErrorOptions } from './event-store.errors';
