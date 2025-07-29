import { IDomainError } from '@vytches/ddd-core';

/**
 * @llm-summary ACLError class for a c l error operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * ACLError class implementing integration layer component for a c l error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ACLError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ACLError extends IDomainError {
  public metadata?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly contextName: string,
    public readonly operation?: string,
    error?: Error
  ) {
    super(message, { contextName, operation, error });
  }

  static translationFailed(
    contextName: string,
    direction: 'TO_EXTERNAL' | 'FROM_EXTERNAL',
    error: Error
  ): ACLError {
    return new ACLError(
      `Translation failed (${direction}): ${error.message}`,
      contextName,
      'TRANSLATION',
      error
    );
  }

  static operationFailed(contextName: string, operation: string, error: Error): ACLError {
    return new ACLError(
      `Operation '${operation}' failed: ${error.message}`,
      contextName,
      operation,
      error
    );
  }

  static unsupportedOperation(contextName: string, operation: string): ACLError {
    return new ACLError(`Operation '${operation}' is not supported`, contextName, operation);
  }

  static externalSystemUnavailable(contextName: string, systemName: string): ACLError {
    return new ACLError(
      `External system '${systemName}' is unavailable`,
      contextName,
      'HEALTH_CHECK'
    );
  }
}

/**
 * @llm-summary TranslationError class for translation error operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * TranslationError class implementing integration layer component for translation error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TranslationError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class TranslationError extends ACLError {
  constructor(
    message: string,
    contextName: string,
    public readonly sourceModel: unknown,
    public readonly direction: 'TO_EXTERNAL' | 'FROM_EXTERNAL',
    error?: Error
  ) {
    super(message, contextName, 'TRANSLATION', error);
  }

  static forToExternal(
    message: string,
    contextName: string,
    sourceModel: unknown,
    error?: Error
  ): TranslationError {
    return new TranslationError(message, contextName, sourceModel, 'TO_EXTERNAL', error);
  }

  static forFromExternal(
    message: string,
    contextName: string,
    sourceModel: unknown,
    error?: Error
  ): TranslationError {
    return new TranslationError(message, contextName, sourceModel, 'FROM_EXTERNAL', error);
  }
}

/**
 * @llm-summary AdapterNotFoundError class for adapter not found error operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * AdapterNotFoundError class implementing integration layer component for adapter not found error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AdapterNotFoundError();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class AdapterNotFoundError extends ACLError {
  constructor(contextName: string, adapterName: string, error?: Error) {
    super(
      `Adapter '${adapterName}' not found for context '${contextName}'`,
      contextName,
      'ADAPTER_LOOKUP',
      error
    );
  }

  static forContext(contextName: string, adapterName: string): AdapterNotFoundError {
    return new AdapterNotFoundError(contextName, adapterName);
  }
}
