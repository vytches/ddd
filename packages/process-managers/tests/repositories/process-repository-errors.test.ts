import { describe, it, expect } from 'vitest';
import {
  ProcessRepositoryError,
  ConcurrencyError,
  ProcessValidationError,
  StorageError,
} from '../../src/repositories/process-repository-errors';

describe('ProcessRepositoryError', () => {
  it('should create a basic error with default code', () => {
    const error = new ProcessRepositoryError('Test error message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProcessRepositoryError);
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('PROCESS_REPOSITORY_ERROR');
    expect(error.name).toBe('ProcessRepositoryError');
    expect(error.details).toBeUndefined();
  });

  it('should create an error with custom code and details', () => {
    const details = { userId: 'test-user', operation: 'save' };
    const error = new ProcessRepositoryError('Custom error message', 'CUSTOM_ERROR_CODE', details);

    expect(error.message).toBe('Custom error message');
    expect(error.code).toBe('CUSTOM_ERROR_CODE');
    expect(error.details).toEqual(details);
  });

  it('should maintain proper prototype chain for instanceof checks', () => {
    const error = new ProcessRepositoryError('Test message');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof ProcessRepositoryError).toBe(true);
    expect(Object.getPrototypeOf(error)).toBe(ProcessRepositoryError.prototype);
  });
});

describe('ConcurrencyError', () => {
  it('should create a concurrency error with proper message and properties', () => {
    const error = new ConcurrencyError('process-123', 5, 3);

    expect(error).toBeInstanceOf(ProcessRepositoryError);
    expect(error).toBeInstanceOf(ConcurrencyError);
    expect(error.message).toContain('process-123');
    expect(error.message).toContain('expected version 5');
    expect(error.message).toContain('found version 3');
    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.expectedVersion).toBe(5);
    expect(error.actualVersion).toBe(3);
  });

  it('should include process manager details in error details', () => {
    const additionalDetails = { operation: 'update', timestamp: new Date() };
    const error = new ConcurrencyError('process-456', 10, 8, additionalDetails);

    expect(error.details).toEqual({
      processManagerId: 'process-456',
      expectedVersion: 10,
      actualVersion: 8,
      ...additionalDetails,
    });
  });

  it('should have the correct error name', () => {
    const error = new ConcurrencyError('process-789', 1, 0);
    expect(error.name).toBe('ConcurrencyError');
  });

  it('should format the error message consistently', () => {
    const error = new ConcurrencyError('test-process', 15, 12);
    const expectedMessage =
      "Concurrency conflict for process manager 'test-process': expected version 15, but found version 12";

    expect(error.message).toBe(expectedMessage);
  });
});

describe('ProcessValidationError', () => {
  it('should create a validation error with message only', () => {
    const error = new ProcessValidationError('Invalid input data');

    expect(error).toBeInstanceOf(ProcessRepositoryError);
    expect(error).toBeInstanceOf(ProcessValidationError);
    expect(error.message).toBe('Invalid input data');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.field).toBeUndefined();
    expect(error.value).toBeUndefined();
  });

  it('should create a validation error with field and value information', () => {
    const invalidValue = { invalid: true };
    const error = new ProcessValidationError(
      'Process ID must be a string',
      'processId',
      invalidValue
    );

    expect(error.message).toBe('Process ID must be a string');
    expect(error.field).toBe('processId');
    expect(error.value).toEqual(invalidValue);
    expect(error.details).toEqual({
      field: 'processId',
      value: invalidValue,
    });
  });

  it('should include additional details when provided', () => {
    const additionalDetails = { validationRule: 'required', context: 'save' };
    const error = new ProcessValidationError('Field is required', 'name', null, additionalDetails);

    expect(error.details).toEqual({
      field: 'name',
      value: null,
      ...additionalDetails,
    });
  });

  it('should have the correct error name', () => {
    const error = new ProcessValidationError('Test message');
    expect(error.name).toBe('ProcessValidationError');
  });
});

describe('StorageError', () => {
  it('should create a storage error with operation and message', () => {
    const error = new StorageError('save', 'Database connection failed');

    expect(error).toBeInstanceOf(ProcessRepositoryError);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toBe('Database connection failed');
    expect(error.code).toBe('STORAGE_ERROR');
    expect(error.operation).toBe('save');
    expect(error.underlyingError).toBeUndefined();
  });

  it('should create a storage error with underlying error information', () => {
    const underlyingError = new Error('Connection timeout');
    underlyingError.name = 'ConnectionTimeoutError';

    const error = new StorageError('load', 'Failed to retrieve data', underlyingError);

    expect(error.operation).toBe('load');
    expect(error.underlyingError).toBe(underlyingError);
    expect(error.details).toEqual({
      operation: 'load',
      underlyingErrorName: 'ConnectionTimeoutError',
      underlyingErrorMessage: 'Connection timeout',
    });
  });

  it('should include additional details when provided', () => {
    const additionalDetails = { retryCount: 3, timeout: 5000 };
    const error = new StorageError('query', 'Query execution failed', undefined, additionalDetails);

    expect(error.details).toEqual({
      operation: 'query',
      underlyingErrorName: undefined,
      underlyingErrorMessage: undefined,
      ...additionalDetails,
    });
  });

  it('should have the correct error name', () => {
    const error = new StorageError('delete', 'Delete operation failed');
    expect(error.name).toBe('StorageError');
  });

  it('should handle undefined underlying error gracefully', () => {
    const error = new StorageError('backup', 'Backup failed', undefined);

    expect(error.underlyingError).toBeUndefined();
    expect(error.details?.underlyingErrorName).toBeUndefined();
    expect(error.details?.underlyingErrorMessage).toBeUndefined();
  });
});

describe('Error Inheritance Chain', () => {
  it('should maintain proper inheritance chain for all error types', () => {
    const baseError = new ProcessRepositoryError('Base error');
    const concurrencyError = new ConcurrencyError('proc-1', 2, 1);
    const validationError = new ProcessValidationError('Validation failed');
    const storageError = new StorageError('save', 'Storage failed');

    // All should be instances of Error
    expect(baseError instanceof Error).toBe(true);
    expect(concurrencyError instanceof Error).toBe(true);
    expect(validationError instanceof Error).toBe(true);
    expect(storageError instanceof Error).toBe(true);

    // All should be instances of ProcessRepositoryError
    expect(baseError instanceof ProcessRepositoryError).toBe(true);
    expect(concurrencyError instanceof ProcessRepositoryError).toBe(true);
    expect(validationError instanceof ProcessRepositoryError).toBe(true);
    expect(storageError instanceof ProcessRepositoryError).toBe(true);

    // Specific type checks
    expect(concurrencyError instanceof ConcurrencyError).toBe(true);
    expect(validationError instanceof ProcessValidationError).toBe(true);
    expect(storageError instanceof StorageError).toBe(true);

    // Cross-type checks should be false
    expect(concurrencyError instanceof ProcessValidationError).toBe(false);
    expect(validationError instanceof StorageError).toBe(false);
    expect(storageError instanceof ConcurrencyError).toBe(false);
  });

  it('should have consistent error properties across all types', () => {
    const concurrencyError = new ConcurrencyError('proc-1', 2, 1);
    const validationError = new ProcessValidationError('Invalid');
    const storageError = new StorageError('save', 'Failed');

    // All should have name property matching constructor name
    expect(concurrencyError.name).toBe('ConcurrencyError');
    expect(validationError.name).toBe('ProcessValidationError');
    expect(storageError.name).toBe('StorageError');

    // All should have appropriate error codes
    expect(concurrencyError.code).toBe('CONCURRENCY_ERROR');
    expect(validationError.code).toBe('VALIDATION_ERROR');
    expect(storageError.code).toBe('STORAGE_ERROR');

    // All should have message property
    expect(typeof concurrencyError.message).toBe('string');
    expect(typeof validationError.message).toBe('string');
    expect(typeof storageError.message).toBe('string');
  });
});

describe('Error Serialization', () => {
  it('should serialize error properties correctly', () => {
    const details = { userId: 'test', operation: 'save' };
    const error = new ProcessRepositoryError('Test error', 'TEST_ERROR', details);

    // Convert to JSON and back
    const serialized = JSON.stringify({
      message: error.message,
      code: error.code,
      details: error.details,
      name: error.name,
    });

    const parsed = JSON.parse(serialized);

    expect(parsed.message).toBe('Test error');
    expect(parsed.code).toBe('TEST_ERROR');
    expect(parsed.details).toEqual(details);
    expect(parsed.name).toBe('ProcessRepositoryError');
  });

  it('should handle complex error details serialization', () => {
    const underlyingError = new Error('Database error');
    const storageError = new StorageError('query', 'Query failed', underlyingError, {
      query: 'SELECT * FROM processes',
      timeout: 5000,
      retryCount: 2,
    });

    const serializedDetails = JSON.stringify(storageError.details);
    const parsedDetails = JSON.parse(serializedDetails);

    expect(parsedDetails.operation).toBe('query');
    expect(parsedDetails.underlyingErrorName).toBe('Error');
    expect(parsedDetails.underlyingErrorMessage).toBe('Database error');
    expect(parsedDetails.query).toBe('SELECT * FROM processes');
    expect(parsedDetails.timeout).toBe(5000);
    expect(parsedDetails.retryCount).toBe(2);
  });
});
