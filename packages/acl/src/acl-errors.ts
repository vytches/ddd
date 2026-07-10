import { IDomainError } from '@vytches/ddd-domain-primitives';

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

export class TranslationError extends ACLError {
  /**
   * The domain/external model that failed to translate. VS-017 (SA-C1):
   * kept as a non-enumerable property (defined via `Object.defineProperty`
   * below, not a constructor parameter-property) so it stays available for
   * programmatic access in a debugger or `catch` block, but is NEVER
   * included in `JSON.stringify(err)` — the exact path that fires on
   * cross-context schema drift, i.e. the error a consumer is most likely to
   * pipe straight into a JSON logger.
   */
  public readonly sourceModel: unknown;

  public readonly direction: 'TO_EXTERNAL' | 'FROM_EXTERNAL';

  constructor(
    message: string,
    contextName: string,
    sourceModel: unknown,
    direction: 'TO_EXTERNAL' | 'FROM_EXTERNAL',
    error?: Error
  ) {
    super(message, contextName, 'TRANSLATION', error);
    Object.defineProperty(this, 'sourceModel', {
      value: sourceModel,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    this.direction = direction;
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
