import type { DomainErrorOptions } from '@vytches-ddd/domain-primitives';
import { IDomainError, DomainErrorCode } from '@vytches-ddd/domain-primitives';

/**
 * Unified error class for aggregate-related errors
 */
export class AggregateError extends IDomainError {
  /**
   * Error for invalid arguments provided to the aggregate
   */
  static invalidArguments(message: string, data?: DomainErrorOptions): AggregateError {
    const options = {
      code: DomainErrorCode.InvalidParameter,
      data,
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for version conflicts in the aggregate
   */
  static versionConflict(
    aggregateType: string,
    aggregateId: string | number,
    currentVersion: number,
    expectedVersion: number
  ): AggregateError {
    const message = `Version conflict: Aggregate ${aggregateType} with ID ${aggregateId} has version ${currentVersion}, but expected ${expectedVersion}`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data: {
        aggregateType,
        aggregateId,
        currentVersion,
        expectedVersion,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for when a required feature is not enabled
   */
  static featureNotEnabled(feature: string): AggregateError {
    const message = `Feature '${feature}' is not enabled on aggregate`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data: {
        feature,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for when a required method is not implemented
   */
  static methodNotImplemented(methodName: string, aggregateType: string): AggregateError {
    const message = `Method '${methodName}' must be implemented by ${aggregateType} to use this feature`;
    const options = {
      code: DomainErrorCode.MissingValue,
      data: {
        methodName,
        aggregateType,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for invalid snapshot
   */
  static invalidSnapshot(aggregateType: string, reason?: string): AggregateError {
    const message = `Invalid snapshot for aggregate ${aggregateType}${reason ? `: ${reason}` : ''}`;
    const options = {
      code: DomainErrorCode.InvalidFormat,
      data: {
        aggregateType,
        reason,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for ID mismatch during snapshot restoration
   */
  static idMismatch(snapshotId: string | number, aggregateId: string | number): AggregateError {
    const message = `ID mismatch: Snapshot is for ID ${snapshotId}, but aggregate has ID ${aggregateId}`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data: {
        snapshotId,
        aggregateId,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for type mismatch during snapshot restoration
   */
  static typeMismatch(snapshotType: string, aggregateType: string): AggregateError {
    const message = `Aggregate type mismatch: Snapshot is for type ${snapshotType}, but trying to load into ${aggregateType}`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data: {
        snapshotType,
        aggregateType,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for duplicate upcaster registration
   */
  static duplicateUpcaster(eventType: string, sourceVersion: number): AggregateError {
    const message = `Upcaster for event ${eventType} version ${sourceVersion} already exists`;
    const options = {
      code: DomainErrorCode.DuplicateEntry,
      data: {
        eventType,
        sourceVersion,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for missing upcaster
   */
  static missingUpcaster(
    eventType: string,
    fromVersion: number,
    toVersion: number
  ): AggregateError {
    const message = `Missing upcaster for event ${eventType} from version ${fromVersion} to ${toVersion}`;
    const options = {
      code: DomainErrorCode.MissingValue,
      data: {
        eventType,
        fromVersion,
        toVersion,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for when apply method interception fails (e.g. method not found)
   */
  static cannotInterceptApplyMethod(
    aggergateId: string,
    data?: DomainErrorOptions
  ): AggregateError {
    const message = `Cannot intercept apply method - method not found on aggregate ${aggergateId}`;
    const options = {
      code: DomainErrorCode.InternalError,
      data: {
        aggergateId,
        ...data,
      },
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for when event store is not configured
   */
  static eventStoreNotConfigured(data?: DomainErrorOptions): AggregateError {
    const message = 'Event store not configured';
    const options = {
      code: DomainErrorCode.MissingValue,
      data,
    };
    return new AggregateError(message, options);
  }

  /**
   * Error for when aggregate does not support event replay
   */
  static aggregateDoesNotSupportReplay(
    aggregateType: string,
    data?: DomainErrorOptions
  ): AggregateError {
    const message = `Aggregate ${aggregateType} does not support event replay`;
    const options = {
      code: DomainErrorCode.MethodNotSupported,
      data: {
        aggregateType,
        ...data,
      },
    };
    return new AggregateError(message, options);
  }
}

