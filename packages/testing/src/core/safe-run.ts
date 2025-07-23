/**
 * Enhanced safeRun utility specifically designed for testing DDD/CQRS patterns.
 * Provides type-safe error/success pattern for async operations in tests.
 *
 * Migrated from @vytches-ddd/utils and enhanced with testing-specific features.
 */

// Removed import to avoid circular dependency
// We'll use duck typing to check for BaseError-like objects

/**
 * @llm-summary Type definition for safe run result
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * SafeRunResult type implementing infrastructure service for safe run result operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: SafeRunResult = {} as SafeRunResult;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type SafeRunResult<T, E extends Error = Error> = readonly [E | undefined, T | undefined];

// Synchronous version

/**
 * @llm-summary safe run function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * safeRun function implementing infrastructure service for safe run operations.
 *
 *
 * @param {(} fn - fn parameter
 * @returns {SafeRunResult<T, E>} Returns SafeRunResult<T, E>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = safeRun(fn);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => safeRun(fn));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function safeRun<T, E extends Error = Error>(fn: () => T): SafeRunResult<T, E>;

// Asynchronous version

/**
 * @llm-summary safe run function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * safeRun function implementing infrastructure service for safe run operations.
 *
 *
 * @param {(} fn - fn parameter
 * @returns {Promise<SafeRunResult<T, E>>} Returns Promise<SafeRunResult<T, E>>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = safeRun(fn);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => safeRun(fn));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function safeRun<T, E extends Error = Error>(
  fn: () => Promise<T>
): Promise<SafeRunResult<T, E>>;

// Implementation

/**
 * @llm-summary safe run function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * safeRun function implementing infrastructure service for safe run operations.
 *
 *
 * @param {(} fn - fn parameter
 * @returns {SafeRunResult<T, E> | Promise<SafeRunResult<T, E>>} Returns SafeRunResult<T, E> | Promise<SafeRunResult<T, E>>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = safeRun(fn);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => safeRun(fn));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary safe run test function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * safeRunTest function implementing infrastructure service for safe run test operations.
 *
 *
 * @param {(} fn - fn parameter
 * @returns {SafeRunResult<T, E> | Promise<SafeRunResult<T, E>>} Returns SafeRunResult<T, E> | Promise<SafeRunResult<T, E>>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = safeRunTest(fn);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => safeRunTest(fn));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary expect error function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * expectError function implementing infrastructure service for expect error operations.
 *
 *
 * @param {new (...args: any[]} errorType - errorType parameter
 * @returns {(result: SafeRunResult<any, E>) => E} Returns (result: SafeRunResult<any, E>) => E
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = expectError(errorType);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => expectError(errorType));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary expect success function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * expectSuccess function implementing infrastructure service for expect success operations.
 *
 *
 * @param {SafeRunResult<T>} result - result parameter
 * @returns {T} Returns T
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = expectSuccess(result);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => expectSuccess(result));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary safe run with timeout function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * safeRunWithTimeout function implementing infrastructure service for safe run with timeout operations.
 *
 *
 * @param {(} fn - fn parameter
 * @returns {Promise<SafeRunResult<T, E | Error>>} Returns Promise<SafeRunResult<T, E | Error>>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = safeRunWithTimeout(fn);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => safeRunWithTimeout(fn));
 * ```
 *
 * @since 1.0.0
 * @public
 */
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
