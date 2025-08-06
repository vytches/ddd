/**
 * @description
 * Executes a function safely and returns a tuple containing either an error or the result.
 * This utility is designed for testing scenarios where you want to handle errors explicitly
 * without using try/catch blocks. It properly handles both synchronous and asynchronous functions,
 * automatically unwrapping Promise types for better TypeScript inference.
 *
 * **IMPORTANT**: This function is specifically designed for testing scenarios. In normal
 * implementation code, prefer using standard try/catch blocks or Result patterns from
 * @vytches/ddd-utils for error handling.
 *
 * @template E - Error type (extends Error)
 * @template T - Return type of the function
 * @param {() => T | Promise<T>} fn - Function to execute safely (sync or async)
 * @returns {readonly [E | undefined, T | undefined]} Tuple with [error, result]
 *
 * @example
 * ```typescript
 * // Synchronous function - returns tuple directly
 * const [error, result] = safeRun(() => validateUser(userData));
 * if (error) {
 *   expect(error).toBeInstanceOf(ValidationError);
 *   expect(error.message).toContain('Invalid email');
 * } else {
 *   expect(result).toBeDefined();
 *   expect(result.id).toBe('123');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Asynchronous function - await unwraps Promise<tuple> to tuple
 * const [error, user] = await safeRun(async () => await userService.findById('123'));
 * if (error) {
 *   expect(error).toBeInstanceOf(NotFoundError);
 * } else if (user) {
 *   // user is properly typed as User, not Promise<User>
 *   expect(user.email).toBe('user@example.com');
 *   expect(user.role).toBe('admin');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Testing error scenarios without try/catch
 * describe('UserService', () => {
 *   it('should handle validation errors', () => {
 *     const [validationError] = safeRun(() =>
 *       userService.createUser({ email: 'invalid' })
 *     );
 *
 *     expect(validationError).toBeInstanceOf(ValidationError);
 *     expect(validationError?.code).toBe('INVALID_EMAIL');
 *   });
 * });
 * ```
 */

// Asynchronous overload - for functions that return a Promise
export function safeRun<T>(
  fn: () => Promise<T>
): Promise<readonly [Error | undefined, T | undefined]>;

// Synchronous overload - for functions that don't return a Promise
export function safeRun<T>(fn: () => T): readonly [Error | undefined, T | undefined];

// Implementation
export function safeRun<T>(
  fn: () => T | Promise<T>
):
  | readonly [Error | undefined, T | undefined]
  | Promise<readonly [Error | undefined, T | undefined]> {
  try {
    const result = fn();

    // Check if result is a Promise or Promise-like (thenable)
    if (
      result !== null &&
      result !== undefined &&
      typeof result === 'object' &&
      'then' in result &&
      typeof (result as { then: unknown }).then === 'function'
    ) {
      // Handle Promise result
      return Promise.resolve(result)
        .then(value => [undefined, value] as const)
        .catch(error => {
          // Ensure error is an Error instance
          const errorInstance = normalizeError(error);
          return [errorInstance, undefined] as const;
        });
    }

    // Handle synchronous result
    return [undefined, result as T] as const;
  } catch (error) {
    // Ensure error is an Error instance
    const errorInstance = normalizeError(error);
    return [errorInstance, undefined] as const;
  }
}

/**
 * Normalizes various error types into an Error instance.
 * Preserves existing Error instances and converts other types.
 * @internal
 */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    // Handle objects with message property
    return new Error(String((error as { message: unknown }).message));
  }

  if (error && typeof error === 'object' && 'code' in error) {
    // Handle objects with code property (common in APIs)
    const errorObj = error as { code?: unknown; details?: unknown; description?: unknown };
    const message = errorObj.description || errorObj.details || errorObj.code;
    return new Error(String(message));
  }

  // Fallback for any other type
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}
