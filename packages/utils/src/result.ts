/**
 * @llm-summary Result class for result operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Result class implementing infrastructure service for result operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new Result();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new Result());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class Result<TValue, TError = Error> {
  private readonly _isSuccess: boolean;
  private readonly _value: TValue | undefined;
  private readonly _error?: TError | undefined;

  private constructor(isSuccess: boolean, value?: TValue, error?: TError) {
    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  /**
   * Check if the result is successful
   */
  get isSuccess(): boolean {
    return this._isSuccess;
  }

  /**
   * Check if the result is a failure
   */
  get isFailure(): boolean {
    return !this._isSuccess;
  }

  /**
   * Get the success value
   * @throws Error if the result is a failure
   */
  get value(): TValue {
    if (!this._isSuccess) {
      throw new Error('Cannot get value of a failure result');
    }
    return this._value as TValue;
  }

  /**
   * Get the error value
   * @throws Error if the result is successful
   */
  get error(): TError {
    if (this._isSuccess) {
      throw new Error('Cannot get error of a success result');
    }
    return this._error as TError;
  }

  /**
   * Create a successful result
   * @param value - The success value
   */
  static ok<TValue, TError = Error>(value?: TValue): Result<TValue, TError> {
    return new Result<TValue, TError>(true, value);
  }

  /**
   * Create a failure result
   * @param error - The error value
   */
  static fail<TValue, TError = Error>(error: TError): Result<TValue, TError> {
    return new Result<TValue, TError>(false, undefined, error);
  }

  /**
   * Try to execute a function and wrap the result
   * @param fn - The function to try
   * @returns A Result containing the function result or error
   */
  static try<TValue>(fn: () => TValue): Result<TValue, Error> {
    try {
      return Result.ok(fn());
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Transform the success value
   * @param fn - The transformation function
   */
  map<TNewValue>(fn: (value: TValue) => TNewValue): Result<TNewValue, TError> {
    if (this.isFailure) {
      return Result.fail<TNewValue, TError>(this.error);
    }
    return Result.ok<TNewValue, TError>(fn(this.value));
  }

  /**
   * Transform the success value with a function that returns a Result
   * @param fn - The transformation function
   */
  flatMap<TNewValue>(fn: (value: TValue) => Result<TNewValue, TError>): Result<TNewValue, TError> {
    if (this.isFailure) {
      return Result.fail<TNewValue, TError>(this.error);
    }
    return fn(this.value);
  }

  /**
   * Apply a function based on success or failure
   * @param onSuccess - Function to call on success
   * @param onFailure - Function to call on failure
   */
  match<TResult>(
    onSuccess: (value: TValue) => TResult,
    onFailure: (error: TError) => TResult
  ): TResult {
    if (this.isSuccess) {
      return onSuccess(this.value);
    }
    return onFailure(this.error);
  }

  /**
   * Apply a side effect if the result is successful
   * @param fn - The side effect function
   */
  tap(fn: (value: TValue) => void): Result<TValue, TError> {
    if (this.isSuccess) {
      fn(this.value);
    }
    return this;
  }

  /**
   * Apply a side effect if the result is a failure
   * @param fn - The side effect function
   */
  tapError(fn: (error: TError) => void): Result<TValue, TError> {
    if (this.isFailure) {
      fn(this.error);
    }
    return this;
  }

  /**
   * Try to execute an async function and wrap the result
   * @param fn - The async function to try
   * @returns A Promise of a Result containing the function result or error
   */
  static async tryAsync<TValue>(fn: () => Promise<TValue>): Promise<Result<TValue, Error>> {
    try {
      const value = await fn();
      return Result.ok(value);
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Transform the success value with an async function
   * @param fn - The async transformation function
   */
  async mapAsync<TNewValue>(
    fn: (value: TValue) => Promise<TNewValue>
  ): Promise<Result<TNewValue, TError>> {
    if (this.isFailure) {
      return Result.fail<TNewValue, TError>(this.error);
    }
    try {
      const newValue = await fn(this.value);
      return Result.ok<TNewValue, TError>(newValue);
    } catch (error) {
      return Result.fail<TNewValue, TError>(error as TError);
    }
  }

  /**
   * Transform the success value with an async function that returns a Result
   * @param fn - The async transformation function
   */
  async flatMapAsync<TNewValue>(
    fn: (value: TValue) => Promise<Result<TNewValue, TError>>
  ): Promise<Result<TNewValue, TError>> {
    if (this.isFailure) {
      return Result.fail<TNewValue, TError>(this.error);
    }
    return await fn(this.value);
  }
}
