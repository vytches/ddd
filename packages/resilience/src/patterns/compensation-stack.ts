import { Result } from '@vytches/ddd-contracts';

/**
 * One compensation that failed while a {@link CompensationStack} was
 * unwinding. `error` is always normalized to an `Error` instance, whatever
 * the rejected compensation function actually threw.
 */
export interface CompensationFailure {
  readonly label: string;
  readonly error: Error;
}

/**
 * The unconditional failure shape returned by {@link runCompensated}: the
 * original failure (`cause`) plus whatever went wrong while compensating for
 * it. `compensationFailures` is always present — an empty array on a clean
 * unwind, never omitted — so reading `cause` at the call site never needs a
 * branch, and a failed cleanup can never stand in for or hide the real
 * failure.
 */
export interface CompensationOutcome<TError> {
  readonly cause: TError;
  readonly compensationFailures: readonly CompensationFailure[];
}

interface CompensationEntry {
  readonly label: string;
  readonly compensate: () => Promise<void>;
}

/**
 * In-process, in-memory only: nothing here is persisted. If the process dies
 * mid-flight, entries already pushed are lost with it and their
 * compensations never run — this is not a durable saga log, and pairing it
 * with one is a separate concern.
 *
 * A LIFO stack of "resource acquired outside the database transaction, plus
 * how to undo it" pairs — reservations, calls into another bounded context,
 * external API side effects. A database transaction unwinds itself on
 * rollback; these do not, so the caller has to.
 *
 * Every entry is registered through {@link CompensationStack.acquire} in a
 * single call: it runs the acquisition and files the matching undo function
 * together, so there is no code path through this API where a resource gets
 * acquired without its compensation also being on file. What this can't
 * enforce structurally — that the undo function you pass actually reverses
 * what the acquire function did — is on you to get right.
 *
 * {@link CompensationStack.unwind} runs registered compensations
 * sequentially, most-recently-acquired first, and is idempotent: calling it
 * again (including concurrently, from two `await`s racing on the same
 * instance) returns the same in-flight or settled run rather than
 * re-running anything. That idempotency is also why the stack stays armed
 * after a successful flow instead of clearing itself — a caller whose own
 * transaction commits after this flow completes, then rolls back for an
 * unrelated reason, can still call `unwind()` on this same instance later
 * and get a real, first-time run.
 *
 * WARNING — that same latch makes an instance single-use: once `unwind()`
 * has resolved (successfully or not), any entry registered afterward via
 * {@link CompensationStack.acquire} is never compensated. A later
 * `unwind()` call still resolves to that same already-settled run and
 * silently does not see the new entry. Treat an unwound stack as spent —
 * create a fresh `CompensationStack` for the next flow instead of reusing
 * this one.
 *
 * @example
 * ```typescript
 * const stack = CompensationStack.create();
 * const reservationId = await stack.acquire(
 *   'inventory-reservation',
 *   () => inventoryClient.reserve(orderId, items),
 *   (id) => inventoryClient.release(id)
 * );
 * // ... more acquisitions, then either:
 * const failures = await stack.unwind(); // explicit rollback
 * // or leave the stack armed for a caller further up the call chain
 * ```
 */
export class CompensationStack {
  private readonly entries: CompensationEntry[] = [];
  private unwindPromise: Promise<readonly CompensationFailure[]> | undefined;

  private constructor() {
    // Private constructor enforces creation via the static factory
  }

  static create(): CompensationStack {
    return new CompensationStack();
  }

  /**
   * Runs `acquire`, then immediately files `compensate` (bound to the value
   * `acquire` produced) as the entry that undoes it. The two are inseparable
   * in this API — there is no way to call `acquire` here without also naming
   * its `compensate` — but nothing checks that `compensate` actually reverses
   * `acquire`; that correspondence is on the caller.
   *
   * If `acquire` itself rejects, nothing is registered — there was nothing to
   * compensate for.
   *
   * @param label - identifies this entry in a {@link CompensationFailure}
   * @param acquire - performs the side effect outside the transaction
   * @param compensate - undoes it, given the value `acquire` resolved with
   */
  async acquire<TValue>(
    label: string,
    acquire: () => Promise<TValue>,
    compensate: (acquired: TValue) => Promise<void>
  ): Promise<TValue> {
    const acquired = await acquire();
    this.entries.push({ label, compensate: () => compensate(acquired) });
    return acquired;
  }

  /**
   * Unwinds every registered entry, most-recently-acquired first, one at a
   * time — sequential `await`s inside a `for...of`, never
   * `Promise.all`. Running compensations concurrently would let the stack's
   * settlement be decided by whichever compensation rejects first while the
   * rest keep running unobserved, which surfaces later as an unhandled
   * rejection instead of as a reported {@link CompensationFailure}.
   *
   * A failed compensation is recorded and does not stop the loop — every
   * remaining entry still gets its turn. Neither timeouts nor retries are
   * applied around a compensation call; compose the `compensate` function
   * passed to {@link CompensationStack.acquire} with this package's own
   * `RetryPolicy` or `TimeoutStrategy` if you need either.
   *
   * Idempotent by latching the first run's promise: concurrent or repeated
   * calls all resolve to that same run, so entries are compensated at most
   * once regardless of how many times `unwind()` is called.
   *
   * WARNING — this latch never resets, so it also makes the instance
   * single-use: once it has resolved, any entry registered afterward via
   * {@link CompensationStack.acquire} is silently skipped by every
   * subsequent call. Do not `acquire()` onto a stack that has already been
   * unwound.
   */
  unwind(): Promise<readonly CompensationFailure[]> {
    if (!this.unwindPromise) {
      this.unwindPromise = this.runUnwind();
    }
    return this.unwindPromise;
  }

  private async runUnwind(): Promise<readonly CompensationFailure[]> {
    const failures: CompensationFailure[] = [];

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (!entry) continue;

      try {
        await entry.compensate();
      } catch (error) {
        failures.push({
          label: entry.label,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return failures;
  }
}

/**
 * Runs `fn` against a {@link CompensationStack} and, if it fails, unwinds
 * that stack before reporting the failure. `stack` is a parameter rather
 * than something this function creates internally so the caller keeps their
 * own reference to it — needed because a caller may have to unwind it again
 * later from outside this call entirely, e.g. from a hook that runs after
 * their own database transaction rolls back for a reason unrelated to `fn`.
 *
 * WARNING — that "unwind later from a hook" pattern only holds on the
 * success path below. `unwind()` latches permanently once it runs (see
 * {@link CompensationStack.unwind}), and this function already calls it
 * before returning `Result.fail` and before rethrowing. On either of those
 * paths the stack is spent by the time control returns to the caller, so a
 * later `stack.unwind()` call from an external hook silently no-ops — it
 * resolves to the same already-settled result without compensating
 * anything new. Only when `fn` resolves successfully, leaving the stack
 * untouched, is deferring the unwind to a later hook still meaningful.
 *
 * On success, the stack is left armed — `runCompensated` does not unwind it.
 * That reservation, external-API call, or cross-context side effect stays
 * live and compensatable until the caller decides otherwise by calling
 * `stack.unwind()` themselves.
 *
 * On failure — `fn` resolving to `Result.fail` — the stack is unwound and
 * the returned failure always carries both the original `cause` and the
 * (possibly empty) list of compensations that themselves failed; a failed
 * cleanup is reported alongside the real error, never in place of it.
 *
 * On a thrown/rejected `fn` — as opposed to a resolved `Result.fail` — the
 * stack is unwound the same way, then the original error is re-thrown as-is:
 * not wrapped, not replaced, not augmented with anything. This mirrors
 * `finally` semantics — cleanup always runs, the exception always keeps
 * propagating untouched — rather than silently converting a throw into a
 * returned `Result`, which would change this function's contract and break
 * a caller that already catches the thrown error today.
 *
 * Because the thrown error is never touched, there is no field on it to
 * carry `compensationFailures` the way `CompensationOutcome` does on the
 * `Result.fail` path. If any compensation also fails while unwinding after a
 * throw, that failure is only observable by calling `stack.unwind()` again
 * from the `catch` block — `unwind()` is idempotent, so this does not
 * re-run any compensation; it simply returns the same settled list of
 * failures from the run this function already triggered.
 *
 * This primitive takes no transaction argument and reaches for no
 * request-scoped context of its own — by construction, it does not manage a
 * transaction boundary or hook into anything else that does.
 *
 * @example
 * ```typescript
 * const stack = CompensationStack.create();
 * const outcome = await runCompensated(stack, async (s) => {
 *   const reservationId = await s.acquire(
 *     'inventory-reservation',
 *     () => inventoryClient.reserve(orderId, items),
 *     (id) => inventoryClient.release(id)
 *   );
 *   return placeOrder(orderId, reservationId);
 * });
 *
 * if (outcome.isFailure) {
 *   const { cause, compensationFailures } = outcome.error;
 *   logger.error('order placement failed', cause);
 *   if (compensationFailures.length > 0) {
 *     logger.error('cleanup also failed', compensationFailures);
 *   }
 * }
 * ```
 */
export async function runCompensated<TValue, TError>(
  stack: CompensationStack,
  fn: (stack: CompensationStack) => Promise<Result<TValue, TError>>
): Promise<Result<TValue, CompensationOutcome<TError>>> {
  let outcome: Result<TValue, TError>;

  try {
    outcome = await fn(stack);
  } catch (error) {
    await stack.unwind();
    throw error;
  }

  if (outcome.isFailure) {
    const compensationFailures = await stack.unwind();
    return Result.fail<TValue, CompensationOutcome<TError>>({
      cause: outcome.error,
      compensationFailures,
    });
  }

  return Result.ok<TValue, CompensationOutcome<TError>>(outcome.value);
}
