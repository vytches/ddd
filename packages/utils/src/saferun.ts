/**
 * @llm-summary Safe run function for safe execution operations
 * @llm-domain Infrastructure
 * @llm-pure true
 *
 * @description
 * safeRun function implementing infrastructure service for safe execution operations.
 * Method primarily used to run tests in a safe way, without throwing errors
 * and handling exceptions using try/catch.
 * It's not used in implementation of any features.
 *
 * @param {() => T} fn - Function to execute safely
 * @returns {readonly [E | undefined, T | undefined]} Returns tuple with error and result
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const [error, result] = safeRun(() => someFunction());
 * if (error) {
 *   console.error('Error:', error.message);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Async usage
 * const [asyncError, asyncResult] = await safeRun(async () => await someAsyncFunction());
 * if (asyncError) {
 *   console.error('Async Error:', asyncError.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */

// Synchronous version
export function safeRun<E extends Error, T>(fn: () => T): readonly [E | undefined, T | undefined];

// Asynchronous version
export function safeRun<E extends Error, T>(
  fn: () => Promise<T>
): Promise<readonly [E | undefined, T | undefined]>;

// Implementation
export function safeRun<E extends Error, T>(
  fn: () => T | Promise<T>
): readonly [E | undefined, T | undefined] | Promise<readonly [E | undefined, T | undefined]> {
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
