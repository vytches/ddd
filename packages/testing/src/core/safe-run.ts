/**
 * Enhanced safeRun utility specifically designed for testing DDD/CQRS patterns.
 * Provides type-safe error/success pattern for async operations in tests.
 *
 * Migrated from @vytches/ddd-utils and enhanced with testing-specific features.
 */

// Removed import to avoid circular dependency
// We'll use duck typing to check for BaseError-like objects

export type SafeRunResult<T, E extends Error = Error> = readonly [E | undefined, T | undefined];

export function safeRun<T, E extends Error = Error>(fn: () => T): SafeRunResult<T, E>;

export function safeRun<T, E extends Error = Error>(
  fn: () => Promise<T>
): Promise<SafeRunResult<T, E>>;

export function safeRun<T, E extends Error = Error>(
  fn: () => T | Promise<T>
): SafeRunResult<T, E> | Promise<SafeRunResult<T, E>> {
  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then(value => [undefined, value] as const)
        .catch(error => [error as E, undefined] as const);
    }

    return [undefined, result] as const;
  } catch (error) {
    return [error as E, undefined] as const;
  }
}

export function safeRunTest<T, E extends Error = Error>(
  fn: () => T | Promise<T>,
  context?: string
): SafeRunResult<T, E> | Promise<SafeRunResult<T, E>> {
  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then(value => [undefined, value] as const)
        .catch(error => {
          if (context && error && typeof error === 'object' && 'data' in error) {
            error.data = { ...(error?.data ? error.data : {}), testContext: context };
          }
          return [error as E, undefined] as const;
        });
    }

    return [undefined, result] as const;
  } catch (error) {
    if (context && error && typeof error === 'object' && 'data' in error) {
      const domainError = error as any;
      domainError.data = { ...(domainError.data || {}), testContext: context };
    }
    return [error as E, undefined] as const;
  }
}

export function expectError<E extends Error>(
  errorType: new (...args: any[]) => E
): (result: SafeRunResult<any, E>) => E {
  return (result: SafeRunResult<any, E>): E => {
    const [error, value] = result;

    if (!error) {
      throw new Error(
        `Expected error of type ${errorType.name}, but operation succeeded with value: ${value}`
      );
    }

    if (!(error instanceof errorType)) {
      throw new Error(
        `Expected error of type ${errorType.name}, but got ${error.constructor.name}: ${error.message}`
      );
    }

    return error;
  };
}

export function expectSuccess<T>(result: SafeRunResult<T>): T {
  const [error, value] = result;

  if (error) {
    throw new Error(`Expected successful operation, but got error: ${error.message}`);
  }

  if (value === undefined) {
    throw new Error('Expected successful operation, but got undefined value');
  }

  return value;
}

export async function safeRunWithTimeout<T, E extends Error = Error>(
  fn: () => Promise<T>,
  timeoutMs: number,
  context?: string
): Promise<SafeRunResult<T, E | Error>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Operation timed out after ${timeoutMs}ms${context ? ` in context: ${context}` : ''}`
        )
      );
    }, timeoutMs);
  });

  return safeRunTest<T, E>(() => Promise.race([fn(), timeoutPromise]), context);
}
