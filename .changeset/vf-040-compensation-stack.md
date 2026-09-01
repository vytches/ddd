---
'@vytches/ddd-resilience': minor
---

feat(resilience): add `CompensationStack`/`runCompensated` try-confirm-cancel
primitive (VF-040)

**`@vytches/ddd-resilience`:**

- `CompensationStack` — a LIFO stack of "resource acquired outside the database
  transaction, plus how to undo it" pairs (external reservations, cross-context
  calls, other side effects a DB rollback can't reach).
  `acquire(label, acquire, compensate)` runs the acquisition and files its
  matching undo function in one call, so there is no path through the API where
  a resource gets acquired without a compensation on file.
- `stack.unwind()` runs every registered compensation sequentially,
  most-recently-acquired first (`for...of` with `try/catch` inside the loop,
  never `Promise.all`). A compensation that itself throws is recorded and does
  not stop the rest from running. Idempotent by latching the first run's
  promise, not a boolean flag, so two concurrent `await`s on the same stack — or
  a second call after a first has already settled — resolve to that same run
  instead of compensating twice. On success the stack stays armed rather than
  clearing itself, so a caller can still `unwind()` it later from an unrelated
  failure path (e.g. a hook that fires after their own transaction rolls back).
- `runCompensated(stack, fn)` — runs `fn` against the stack; on `Result.fail`,
  unwinds the stack and returns a `Result.fail` whose error is a
  `CompensationOutcome` (always `{ cause, compensationFailures }` — the list is
  empty on a clean unwind, never omitted, so a failed cleanup is reported
  alongside the real error and never hides it). On success, the stack is left
  armed. Compensation also runs when `fn` throws or rejects instead of resolving
  to a failed `Result`: the stack is unwound first, then the original error
  propagates unchanged.
- `CompensationFailure`, `CompensationOutcome<TError>` — exported types for the
  shapes above.
- In-process only, not durable: if the process dies mid-flight, entries already
  pushed are lost with it and their compensations never run. This is called out
  in the first paragraph of the primitive's own documentation.
- Lives in `@vytches/ddd-resilience`, not a new package: `scope:resilience`
  already depends on `scope:contracts` for its `Result`-returning APIs, so this
  adds no new edge to the package dependency graph.
- No `Saga*` naming, no `AsyncLocalStorage`, no CQRS pipeline hook, and no
  transaction argument in v1 — the primitive does not manage a transaction
  boundary, by construction, and is meant to compose with code that does
  (including from outside its own call, e.g. after an external rollback).
- No built-in timeout or retry around a compensation call; compose the
  `compensate` function with this package's own `RetryPolicy` or
  `TimeoutStrategy` when that's needed.

**Usage:**

```ts
import { CompensationStack, runCompensated } from '@vytches/ddd-resilience';
import { Result } from '@vytches/ddd-contracts';

const stack = CompensationStack.create();
const outcome = await runCompensated(stack, async s => {
  const reservationId = await s.acquire(
    'inventory-reservation',
    () => inventoryClient.reserve(orderId, items),
    id => inventoryClient.release(id)
  );
  return placeOrder(orderId, reservationId);
});

if (outcome.isFailure) {
  const { cause, compensationFailures } = outcome.error;
  logger.error('order placement failed', cause);
  if (compensationFailures.length > 0) {
    logger.error('cleanup also failed', compensationFailures);
  }
}
```
