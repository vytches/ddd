/**
 * Method primarly used to run tests in a safe way, without throwing errors
 * and handling exceptions using try/catch.
 * It's not used in implementation of any features.
 */

// Synchronous version
export function safeRun<E extends Error, T>(
  fn: () => T,
): readonly [E | undefined, T | undefined];

// Asynchronous version
export function safeRun<E extends Error, T>(
  fn: () => Promise<T>,
): Promise<readonly [E | undefined, T | undefined]>;

// Implementation
export function safeRun<E extends Error, T>(
  fn: () => T | Promise<T>,
):
  | readonly [E | undefined, T | undefined]
  | Promise<readonly [E | undefined, T | undefined]> {
  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then((value) => [undefined, value] as const)
        .catch((error) => [error as E, undefined] as const);
    }

    return [undefined, result] as const;
  } catch (error) {
    return [error as E, undefined] as const;
  }
}
