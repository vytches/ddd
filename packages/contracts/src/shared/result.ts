/**
 * Internal helper for `Result.combine` / `Result.combineWithAllErrors`: unwraps
 * a tuple of `Result`s into a tuple of their success value types, preserving
 * position and tuple length. Not exported — an internal implementation detail
 * of the combinators' return type, not part of the public API surface.
 */
type UnwrapAll<TResults extends readonly Result<unknown, unknown>[]> = {
  [Index in keyof TResults]: TResults[Index] extends Result<infer TValue, unknown> ? TValue : never;
};

/**
 * Internal helper for `ExtractError`: true iff `T` is exactly `Error` itself
 * (not a subclass). `Result.ok(value)` called without an explicit error type
 * argument — overwhelmingly the common way to write a success entry inside a
 * `combine`/`combineWithAllErrors` array literal — types as `Result<TValue,
 * Error>` purely because `Error` is `Result`'s default type parameter, not
 * because the caller meant anything by it: a success value can never actually
 * carry that error (`.error` throws on a success). `ExtractError` uses this
 * check to treat exactly-`Error` elements as uninformative placeholders
 * rather than as a real, distinct error type competing for the shared
 * `TError`. A `Result.fail(...)` genuinely typed `Error` is structurally
 * identical to an omitted default and is filtered the same way — TypeScript
 * cannot tell the two apart from the type alone, and defaulting to the
 * widest, safest common type in that ambiguous case is the same tradeoff
 * `Result`'s own API already makes everywhere else.
 */
type IsExactlyError<T> = [T] extends [Error] ? ([Error] extends [T] ? true : false) : false;

/**
 * Internal helper for `ExtractError`: `T`'s error type, or `never` if `T`'s
 * error type is the exactly-`Error` placeholder (see `IsExactlyError`).
 * Declared as its own generic alias — rather than inlined into `ExtractError`
 * — so that invoking it with a union (one branch per tuple element, via
 * `TResults[number]`) triggers TypeScript's distributive conditional types:
 * each element is filtered independently, instead of the filter running once
 * against the union of all elements' error types merged together (which
 * would, for example, wrongly treat a real `FieldError` as a placeholder
 * whenever `Error` also happens to appear elsewhere in the same union).
 */
type NonPlaceholderError<TResult> =
  TResult extends Result<unknown, infer TError>
    ? IsExactlyError<TError> extends true
      ? never
      : TError
    : never;

/**
 * Internal helper for `ExtractError`: true iff some member of the union
 * `TUnion` is a supertype of every member of `TUnion` — i.e. the union
 * forms a subtyping chain with a single, dominating top element. Declared
 * with an explicit `TCandidate = TUnion` type parameter (rather than
 * inlining `TUnion` again) so that invoking it distributes `TCandidate`
 * over each member of the union independently — the same
 * distributive-conditional-type mechanism `NonPlaceholderError` relies on
 * (see its own comment) — checking, for each member in turn, whether the
 * *whole* union is assignable to just that one member.
 */
type HasCommonSupertypeMember<TUnion, TCandidate = TUnion> = TCandidate extends unknown
  ? [TUnion] extends [TCandidate]
    ? true
    : never
  : never;

/**
 * Internal helper for `ExtractError`: true iff the union `TUnion` has a
 * member that dominates every other member (see
 * `HasCommonSupertypeMember`) — i.e. `TUnion` is either a single type, or
 * two-or-more error types genuinely related by subtyping (one `extends`
 * another, possibly transitively). `false` exactly when `TUnion` mixes two
 * or more error types that are NOT related by subtyping in either
 * direction — no member of a wholly-unrelated union can ever be a
 * supertype of the others, so every branch of the distributive check
 * resolves to `never` and the union of `never`s collapses back to
 * `never`.
 */
type HasCommonSupertype<TUnion> = [HasCommonSupertypeMember<TUnion>] extends [never] ? false : true;

/**
 * Internal helper for `Result.combine` / `Result.combineWithAllErrors`: derives
 * the single shared error type `TError` for a tuple of `Result`s by collecting
 * each element's error type via `NonPlaceholderError`, dropping the
 * uninformative exactly-`Error` placeholders, and taking what remains.
 * Declaring `TError` as a type parameter that only appears inside another
 * parameter's *constraint* (as the pre-fix signature did) is never picked up
 * by inference — TypeScript only infers a type parameter from a position
 * where it structurally occurs in the parameter type itself, so `TError`
 * silently fell back to its default (`Error`) on every call. Deriving it
 * here, directly from the tuple `TResults` after it has already been
 * inferred from the argument, sidesteps that limitation entirely.
 *
 * When every non-placeholder element shares the same error type, that type
 * is returned exactly — including when there are no non-placeholder elements
 * at all (every element was `ok(...)` with no explicit error type, or the
 * input was empty), which resolves to `Error`, matching `Result`'s own
 * default.
 *
 * When two or more DIFFERENT real error types are present, `HasCommonSupertype`
 * gates which of them are acceptable per D-02 ("ONE shared error type for the
 * whole input" — never a silent union of the individual results' error
 * types). Types genuinely related by subtyping (one `extends` the other,
 * directly or transitively) are let through as before. Types that are NOT
 * related by subtyping in either direction resolve to `never` instead of
 * their raw union.
 *
 * That enforcement is PARTIAL, not absolute — `never` only blocks the READ
 * side. Reading a property off `.error` (e.g. `combined.error.field`) is a
 * compile error (`Property '...' does not exist on type 'never'`), and an
 * empty `readonly never[]` behaves the same way for `combineWithAllErrors`.
 * But `never` is assignable to every type, so in an ASSIGNMENT or PROPAGATION
 * position — the most idiomatic thing to write here, e.g.
 * `return Result.fail(combined.error)` inside a function declared to return
 * `Result<T, SomeDeclaredError>` — it type-checks silently against whatever
 * error type the caller declares. So this turns the irreconcilable mix D-02
 * forbids into a compile-time signal for direct property access, but not
 * into a hard block on propagating the value onward unread.
 *
 * Not exported — an internal implementation detail of the combinators'
 * parameter/return types, not part of the public API surface.
 */
type ExtractError<TResults extends readonly Result<unknown, unknown>[]> = [
  NonPlaceholderError<TResults[number]>,
] extends [never]
  ? Error
  : HasCommonSupertype<NonPlaceholderError<TResults[number]>> extends true
    ? NonPlaceholderError<TResults[number]>
    : never;

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
   * @param value - The success value (required — use Result.empty() for void operations)
   * @example
   * ```typescript
   * const email = Result.ok<string>('user@example.com');
   * email.isSuccess; // true
   * email.value; // 'user@example.com'
   * ```
   */
  static ok<TValue, TError = Error>(value: TValue): Result<TValue, TError> {
    return new Result<TValue, TError>(true, value);
  }

  /**
   * Create a successful void result (no value).
   * @example
   * ```typescript
   * function markAsShipped(order: Order): Result<void, Error> {
   *   order.ship();
   *   return Result.empty();
   * }
   * ```
   */
  static empty<TError = Error>(): Result<void, TError> {
    return new Result<void, TError>(true, undefined);
  }

  /**
   * Create a failure result
   * @param error - The error value
   * @example
   * ```typescript
   * function createEmail(raw: string): Result<Email, Error> {
   *   if (!raw.includes('@')) {
   *     return Result.fail(new Error('Email must contain @'));
   *   }
   *   return Result.ok(new Email(raw));
   * }
   * ```
   */
  static fail<TValue, TError = Error>(error: TError): Result<TValue, TError> {
    return new Result<TValue, TError>(false, undefined, error);
  }

  /**
   * Try to execute a function and wrap the result
   * @param fn - The function to try
   * @returns A Result containing the function result or error
   * @example
   * ```typescript
   * const parsed = Result.try(() => JSON.parse(rawPayload) as OrderDto);
   * if (parsed.isFailure) {
   *   logger.warn('Invalid order payload', parsed.error);
   * }
   * ```
   */
  static try<TValue>(fn: () => TValue): Result<TValue, Error> {
    try {
      return Result.ok(fn());
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Combine multiple `Result`s that share a common error type into a single
   * `Result` carrying a tuple of their values, in order.
   *
   * Resolves eagerly: on the first failure encountered (in input order), that
   * failure is returned immediately and no further inputs are inspected. An
   * empty input list succeeds with an empty tuple.
   *
   * Replaces the repeated "check `isFailure`, return `Result.fail`" block that
   * otherwise appears once per field when constructing several value objects
   * at once. For an async variant, `await Promise.all([...])` the individual
   * results first, then pass the resolved array to `combine`.
   *
   * The error type is inferred from the input tuple, with two gotchas:
   * - A tuple entry typed exactly `Error` (not a subclass) — the default you
   *   get from `Result.ok(x)` written without an explicit error type — is
   *   treated as a placeholder and ignored when inferring the shared error
   *   type. It is NOT counted as a real, distinct error type. This only
   *   matters when the tuple is mixed; a tuple of nothing but exactly-`Error`
   *   entries still infers `Error`.
   * - When the remaining (non-placeholder) error types don't reduce to one
   *   common type — e.g. sibling classes `ValidationError` and
   *   `NotFoundError` that both extend `DomainError` but don't extend each
   *   other — the inferred error type is `never`, and reading a property off
   *   `combined.error` will fail to compile. Fix it at the source: declare
   *   one shared error type across the combined factories (for example,
   *   widen them to a common base type) so they infer to that type instead.
   *
   * @param results - A tuple of `Result`s sharing a common error type
   * @returns A `Result` with a tuple of the success values, or the first error encountered
   * @example
   * ```typescript
   * // Before: one repeated isFailure block per field
   * // const emailResult = Email.create(dto.email);
   * // if (emailResult.isFailure) return Result.fail(emailResult.error);
   * // const nameResult = FullName.create(dto.name);
   * // if (nameResult.isFailure) return Result.fail(nameResult.error);
   * // ... and so on for every field
   *
   * // After: combine them and destructure once
   * const combined = Result.combine([
   *   Email.create(dto.email),
   *   FullName.create(dto.name),
   *   Address.create(dto.address),
   * ]);
   * if (combined.isFailure) {
   *   return Result.fail(combined.error);
   * }
   * const [email, name, address] = combined.value;
   * ```
   */
  static combine<TResults extends readonly Result<unknown, unknown>[]>(
    results: readonly [...TResults]
  ): Result<UnwrapAll<TResults>, ExtractError<TResults>> {
    const values: unknown[] = [];
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail<UnwrapAll<TResults>, ExtractError<TResults>>(
          result.error as ExtractError<TResults>
        );
      }
      values.push(result.value);
    }
    return Result.ok<UnwrapAll<TResults>, ExtractError<TResults>>(values as UnwrapAll<TResults>);
  }

  /**
   * Combine multiple `Result`s that share a common error type into a single
   * `Result`, collecting every failure instead of stopping at the first one.
   *
   * On success, returns a tuple of the values in input order (same shape as
   * {@link Result.combine}). On failure, returns an array of the ORIGINAL
   * error objects for every failed input — never flattened to messages,
   * strings, or any other shape.
   *
   * The error array is COMPACTED: only the errors that actually occurred are
   * included, in the order their inputs appeared. Position N in the error
   * array does NOT correspond to input N — a failure at input index 3 with no
   * other failures produces a one-element error array at index 0, not index 3.
   * Callers who need to know which input produced which error must carry that
   * identity inside the error object itself.
   *
   * An empty input list succeeds with an empty tuple.
   *
   * The error type is inferred the same way as {@link Result.combine}: an
   * entry typed exactly `Error` (the default from `Result.ok(x)` written
   * without an explicit error type) is treated as a placeholder and ignored,
   * and if the remaining error types don't reduce to one common type — e.g.
   * sibling classes that share a base but don't extend each other — the
   * inferred error type is `never` instead of a union. Declare one shared
   * error type across the combined factories (for example, widen them to a
   * common base type) to get a usable element type here.
   *
   * @param results - A tuple of `Result`s sharing a common error type
   * @returns A `Result` with a tuple of the success values, or an array of every original error
   * @example
   * ```typescript
   * // Before: the user sees one invalid field, fixes it, resubmits, sees the next
   * // const emailResult = Email.create(dto.email);
   * // if (emailResult.isFailure) return Result.fail(emailResult.error);
   * // const nameResult = FullName.create(dto.name);
   * // if (nameResult.isFailure) return Result.fail(nameResult.error);
   *
   * // After: report every invalid field in one response
   * const combined = Result.combineWithAllErrors([
   *   Email.create(dto.email),
   *   FullName.create(dto.name),
   *   Address.create(dto.address),
   * ]);
   * if (combined.isFailure) {
   *   // combined.error is readonly ValidationError[] — every original error, compacted
   *   return Result.fail(combined.error);
   * }
   * const [email, name, address] = combined.value;
   * ```
   */
  static combineWithAllErrors<TResults extends readonly Result<unknown, unknown>[]>(
    results: readonly [...TResults]
  ): Result<UnwrapAll<TResults>, readonly ExtractError<TResults>[]> {
    const values: unknown[] = [];
    const errors: ExtractError<TResults>[] = [];
    for (const result of results) {
      if (result.isFailure) {
        errors.push(result.error as ExtractError<TResults>);
      } else {
        values.push(result.value);
      }
    }
    if (errors.length > 0) {
      return Result.fail<UnwrapAll<TResults>, readonly ExtractError<TResults>[]>(errors);
    }
    return Result.ok<UnwrapAll<TResults>, readonly ExtractError<TResults>[]>(
      values as UnwrapAll<TResults>
    );
  }

  /**
   * Transform the success value
   * @param fn - The transformation function
   * @example
   * ```typescript
   * const shouted = Result.ok<string>('hello').map((value) => value.toUpperCase());
   * // shouted.value === 'HELLO'
   * ```
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
   * @example
   * ```typescript
   * const accountId = Result.ok<string>(rawId).flatMap((id) => AccountId.create(id));
   * ```
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
   * @example
   * ```typescript
   * const message = createEmail(raw).match(
   *   (email) => `Created ${email.value}`,
   *   (error) => `Failed: ${error.message}`
   * );
   * ```
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
   * @example
   * ```typescript
   * createOrder(dto).tap((order) => logger.info(`Order ${order.id} created`));
   * ```
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
   * @example
   * ```typescript
   * createOrder(dto).tapError((error) => logger.error('Order creation failed', error));
   * ```
   */
  tapError(fn: (error: TError) => void): Result<TValue, TError> {
    if (this.isFailure) {
      fn(this.error);
    }
    return this;
  }

  /**
   * Transform the error value if the result is a failure
   * @param fn - The error transformation function
   * @example
   * ```typescript
   * const domainResult = createEmail(raw).mapError((error) => new ValidationError(error.message));
   * ```
   */
  mapError<TNewError>(fn: (error: TError) => TNewError): Result<TValue, TNewError> {
    if (this.isSuccess) {
      return Result.ok<TValue, TNewError>(this.value);
    }
    return Result.fail<TValue, TNewError>(fn(this.error));
  }

  /**
   * Try to execute an async function and wrap the result
   * @param fn - The async function to try
   * @returns A Promise of a Result containing the function result or error
   * @example
   * ```typescript
   * const response = await Result.tryAsync(() => httpClient.get(`/users/${id}`));
   * ```
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
   * @example
   * ```typescript
   * const enriched = await fetchUser(id).mapAsync(async (user) => enrichWithProfile(user));
   * ```
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
      const wrappedError = error instanceof Error ? error : new Error(String(error));
      return Result.fail<TNewValue, TError>(wrappedError as unknown as TError);
    }
  }

  /**
   * Transform the success value with an async function that returns a Result
   * @param fn - The async transformation function
   * @example
   * ```typescript
   * const saved = await validateOrder(dto).flatMapAsync((order) => repository.save(order));
   * ```
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
