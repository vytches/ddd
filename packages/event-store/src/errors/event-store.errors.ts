import type { DomainErrorOptions } from '@vytches/ddd-core';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-core';

/**
 * Helper function to create options object with undefined values omitted
 * This is required for exactOptionalPropertyTypes compliance
 */
function createOptions(options: {
  eventType?: string | undefined;
  error?: Error | undefined;
  data?: unknown;
  [key: string]: unknown;
}): EventStoreErrorOptions {
  const result: EventStoreErrorOptions = {};

  // Only add properties if they're not undefined
  if (options.eventType !== undefined) {
    result.eventType = options.eventType;
  }
  if (options.error !== undefined) {
    result.error = options.error;
  }
  if (options.data !== undefined) {
    result.data = options.data;
  }

  // Add any other properties that are not undefined
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && !['eventType', 'error', 'data'].includes(key)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

export enum EventStoreErrorCode {
  Default = 'ES_ERROR',
  ConcurrencyConflict = 'ES_CONCURRENCY_CONFLICT',
  StreamNotFound = 'ES_STREAM_NOT_FOUND',
  StreamDeleted = 'ES_STREAM_DELETED',
  InvalidStreamVersion = 'ES_INVALID_STREAM_VERSION',
  SerializationError = 'ES_SERIALIZATION_ERROR',
  DeserializationError = 'ES_DESERIALIZATION_ERROR',
  ConnectionError = 'ES_CONNECTION_ERROR',
  InvalidConfiguration = 'ES_INVALID_CONFIGURATION',
  SnapshotError = 'ES_SNAPSHOT_ERROR',
  StorageError = 'ES_STORAGE_ERROR',
}

export type EventStoreErrorOptions = DomainErrorOptions & {
  code?: EventStoreErrorCode;
  streamId?: string;
  expectedVersion?: number;
  actualVersion?: number;
  position?: bigint;
  eventType?: string;
  data?: unknown;
  error?: Error;
};

export abstract class EventStoreError extends IDomainError {
  declare streamId?: string | undefined;
  declare expectedVersion?: number | undefined;
  declare actualVersion?: number | undefined;
  declare position?: bigint | undefined;
  declare eventType?: string | undefined;

  constructor(message: string, options: EventStoreErrorOptions = {}) {
    super(message, {
      code: DomainErrorCode.Default,
      ...options,
    });

    this.streamId = options.streamId;
    this.expectedVersion = options.expectedVersion;
    this.actualVersion = options.actualVersion;
    this.position = options.position;
    this.eventType = options.eventType;
  }
}

export class EventStoreConcurrencyError extends EventStoreError {
  constructor(
    public override readonly streamId: string,
    public override readonly expectedVersion: number,
    public override readonly actualVersion: number
  ) {
    super(
      `Concurrency conflict on stream ${streamId}. Expected version ${expectedVersion} but was ${actualVersion}`,
      {
        streamId,
        expectedVersion,
        actualVersion,
        data: { code: EventStoreErrorCode.ConcurrencyConflict },
      }
    );
  }

  static withDetails(
    streamId: string,
    expectedVersion: number,
    actualVersion: number,
    additionalData?: unknown
  ): EventStoreConcurrencyError {
    const error = new EventStoreConcurrencyError(streamId, expectedVersion, actualVersion);
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class StreamNotFoundError extends EventStoreError {
  constructor(public override readonly streamId: string) {
    super(`Stream ${streamId} not found`, {
      streamId,
      data: { code: EventStoreErrorCode.StreamNotFound },
    });
  }

  static withStreamId(streamId: string, additionalData?: unknown): StreamNotFoundError {
    const error = new StreamNotFoundError(streamId);
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class StreamDeletedError extends EventStoreError {
  constructor(public override readonly streamId: string) {
    super(`Stream ${streamId} has been deleted`, {
      streamId,
      data: { code: EventStoreErrorCode.StreamDeleted },
    });
  }

  static withStreamId(streamId: string, additionalData?: unknown): StreamDeletedError {
    const error = new StreamDeletedError(streamId);
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class EventSerializationError extends EventStoreError {
  constructor(
    message: string,
    public override readonly eventType?: string | undefined,
    public readonly originalError?: Error | undefined
  ) {
    super(
      message,
      createOptions({
        eventType,
        error: originalError,
        data: { code: EventStoreErrorCode.SerializationError },
      })
    );
  }

  static withEvent(
    eventType: string,
    originalError: Error,
    additionalData?: unknown
  ): EventSerializationError {
    const error = new EventSerializationError(
      `Failed to serialize event of type ${eventType}: ${originalError.message}`,
      eventType,
      originalError
    );
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class EventDeserializationError extends EventStoreError {
  constructor(
    message: string,
    public readonly dataLength?: number,
    public readonly originalError?: Error
  ) {
    super(
      message,
      createOptions({
        error: originalError,
        data: { code: EventStoreErrorCode.DeserializationError },
      })
    );
  }

  static withData(
    dataLength: number,
    originalError: Error,
    additionalData?: unknown
  ): EventDeserializationError {
    const error = new EventDeserializationError(
      `Failed to deserialize event data (${dataLength} bytes): ${originalError.message}`,
      dataLength,
      originalError
    );
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class EventStoreConnectionError extends EventStoreError {
  constructor(
    message: string,
    public readonly originalError?: Error
  ) {
    super(
      message,
      createOptions({
        error: originalError,
        data: { code: EventStoreErrorCode.ConnectionError },
      })
    );
  }

  static withError(originalError: Error, additionalData?: unknown): EventStoreConnectionError {
    const error = new EventStoreConnectionError(
      `Event store connection error: ${originalError.message}`,
      originalError
    );
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}

export class InvalidStreamVersionError extends EventStoreError {
  constructor(
    public override readonly streamId: string,
    public readonly version: number,
    message?: string
  ) {
    super(message ?? `Invalid version ${version} for stream ${streamId}`, {
      streamId,
      expectedVersion: version,
      data: { code: EventStoreErrorCode.InvalidStreamVersion },
    });
  }

  static withVersion(
    streamId: string,
    version: number,
    additionalData?: unknown
  ): InvalidStreamVersionError {
    const error = new InvalidStreamVersionError(streamId, version);
    if (additionalData) {
      error.data = {
        ...(typeof error.data === 'object' && error.data !== null ? error.data : {}),
        ...additionalData,
      };
    }
    return error;
  }
}
