/**
 * Base error class for all process repository errors.
 * Provides structured error handling for persistence operations.
 */
export class ProcessRepositoryError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code = 'PROCESS_REPOSITORY_ERROR',
    details?: Record<string, unknown> | undefined
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when optimistic concurrency control detects a conflict.
 * Indicates that the process manager was modified by another operation.
 */
export class ConcurrencyError extends ProcessRepositoryError {
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(
    processManagerId: string,
    expectedVersion: number,
    actualVersion: number,
    details?: Record<string, unknown>
  ) {
    const message = `Concurrency conflict for process manager '${processManagerId}': expected version ${expectedVersion}, but found version ${actualVersion}`;

    super(message, 'CONCURRENCY_ERROR', {
      processManagerId,
      expectedVersion,
      actualVersion,
      ...details,
    });

    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Error thrown when validation of repository inputs fails.
 * Indicates invalid data being passed to repository methods.
 */
export class ValidationError extends ProcessRepositoryError {
  public readonly field?: string | undefined;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string | undefined,
    value?: unknown,
    details?: Record<string, unknown> | undefined
  ) {
    super(message, 'VALIDATION_ERROR', {
      field,
      value,
      ...details,
    });

    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when storage operations fail.
 * Indicates underlying persistence layer problems.
 */
export class StorageError extends ProcessRepositoryError {
  public readonly operation: string;
  public readonly underlyingError?: Error | undefined;

  constructor(
    operation: string,
    message: string,
    underlyingError?: Error | undefined,
    details?: Record<string, unknown> | undefined
  ) {
    super(message, 'STORAGE_ERROR', {
      operation,
      underlyingErrorName: underlyingError?.name,
      underlyingErrorMessage: underlyingError?.message,
      ...details,
    });

    this.operation = operation;
    this.underlyingError = underlyingError;
  }
}
