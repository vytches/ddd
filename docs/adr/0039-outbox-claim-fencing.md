# ADR-0039. Outbox Claim Fencing (claim token)

Date: 2026-11-21

## Status

2026-11-21 accepted — implemented together with the handler-context/timeouts
work. The open questions of the first draft were resolved on the same day; see
"Resolved questions". A multi-perspective review the same day tightened the
design (see "Review outcome").

## Context

`OutboxProcessor` writes a message's outcome with
`updateStatus(id, status, error?)`, `incrementAttempt(id)` and
`scheduleRetry(id, at)`. None of them carries a precondition: no expected status
and no proof that the caller still owns the message. Three things can make a
write arrive after another worker (or crash recovery) has already reclaimed the
message:

1. a slow repository call or a paused process (GC, container freeze) that
   outlives `crashRecoveryThresholdMs - messageTimeout`;
2. `resetStaleProcessing` racing a worker that is merely slow;
3. a repository whose `claimBatch` is not atomic (the default shim).

A stale `PROCESSED`/`FAILED`/`PENDING` write then overwrites the newer attempt's
state. `handleMessageError` is also three separate calls (`incrementAttempt` →
`updateStatus(PENDING)` → `scheduleRetry`), and between the last two the row is
claimable immediately.

A guard on `status = 'PROCESSING'` alone is **not enough**: a re-claim sets the
status to `PROCESSING` again, so the stale writer still passes the check (ABA).
Ownership has to be identified by something unique per claim.

Note what the library does **not** do today: a handler that timed out never
issues a closing write — the pipeline already rejected. Fencing protects the
status row; it does nothing for side effects of a handler that is still running
(e-mail, payment). That remains the consumer's idempotency concern.

## Decision

Add fencing as an **opt-in, additive** capability. Nothing changes unless
`useFencing: true`.

### Contract

```typescript
interface IOutboxMessage {
  /** Opaque, unique per claim (a re-claim gets a new value). Set by a fencing-aware claimBatch. */
  claimToken?: string;
}

abstract class IOutboxRepository {
  // Optional members, no default implementation: there is no safe shim for fencing.

  /** UPDATE … SET status='PROCESSED', claim_token=NULL
   *  WHERE id=? AND status='PROCESSING' AND claim_token=?   → true if a row changed */
  completeFenced?(id: string, claimToken: string): Promise<boolean>;

  /** Atomically attempts = attempts + 1, last_error = ? under the same WHERE.
   *  Returns the new attempts, or null if the claim is no longer held. Status stays PROCESSING. */
  recordFailureFenced?(
    id: string,
    claimToken: string,
    error: Error
  ): Promise<number | null>;

  /** Single statement: status, process_after, claim_token=NULL under the same WHERE.
   *  Replaces updateStatus(PENDING) + scheduleRetry (closes their window) and FAILED. */
  releaseFenced?(
    id: string,
    claimToken: string,
    outcome: {
      status: MessageStatus.PENDING | MessageStatus.FAILED;
      processAfter?: Date;
      error?: Error;
    }
  ): Promise<boolean>;
}

interface OutboxProcessorOptions {
  /** Default false. Requires claimBatch + the three methods above. */
  useFencing?: boolean;
}

interface OutboxProcessorHooks {
  onStaleWrite?(
    message: IOutboxMessage,
    operation: 'complete' | 'recordFailure' | 'release'
  ): void;
}
```

### Processor behaviour with `useFencing: true`

- The constructor **throws** `TypeError` if the repository lacks any of the
  three methods, or does not OVERRIDE `claimBatch` (the inherited default is a
  non-atomic shim that sets no token — accepting it would skip every message on
  every poll). No warn-and-fall-back (unlike `useClaimBatch`): a silent fallback
  would look protected and not be.
- Success → `completeFenced`. Failure/timeout → `recordFailureFenced`, then
  `releaseFenced` with `PENDING` (+ backoff `processAfter`) or `FAILED` when
  `attempts >= maxRetries`.
- **Stale write** (`false` / `null`) is **not an error**: log at `warn`, fire
  `onStaleWrite`. A stale `complete` / `recordFailure` changes nothing at all; a
  stale `release` means the failure was already recorded (`attempts`
  incremented, `onMessageFailed` fired) and only the status change and
  `onPermanentFailure` are discarded. The newer claim owns the message; this
  attempt's result is discarded.
- `resetStaleProcessing` implementations clear `claim_token` when they reset a
  row (documented recipe); the old token can then never match again.
- Timeouts are unaffected: the timeout is still a failed attempt, now recorded
  fenced.

### Documentation, not code

A reference SQL recipe (Postgres: `claim_token uuid`, `FOR UPDATE SKIP LOCKED`
claim that sets a fresh token, the three conditional `UPDATE`s) goes into
`LLMGUIDE.md`. The library ships no storage adapter and stays dependency-free.

## Alternatives considered

| Alternative                                   | Why not                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `WHERE status='PROCESSING'` only              | ABA — a re-claim restores `PROCESSING`; stale writer still passes. |
| `attempts` as the version                     | Claim does not increment it; it moves on failure only.             |
| Extra optional parameter on `updateStatus(…)` | Old repositories ignore it silently → no fencing, no signal.       |
| Required abstract methods                     | Breaks every existing `IOutboxRepository` subclass (MAJOR).        |

## Compatibility

All additions are optional members/options with default off → MINOR, no change
for existing repositories. `validate:api` reports additions only.

Behavioural classification (`docs/process/behavioral-bc-checklist.md`): with no
opt-in the pre-existing behaviour is preserved bit-for-bit and pinned by a
regression suite ("default path (no opt-in) — behaviour unchanged"). In
particular a failing status write after a successful handler is **still**
counted as a handler failure unless `isolateCompletionWriteFailures` or
`useFencing` is set. Pre-existing options whose values `setTimeout` cannot
honour are only reported with a warning, not rejected.

## Resolved questions

1. **Failure bookkeeping shape** — three methods stay (`completeFenced`,
   `recordFailureFenced`, `releaseFenced`). The processor owns the retry
   decision (`attempts >= maxRetries`, backoff); the repository stays a dumb
   conditional writer. The extra round-trip is on the failure path only.
2. **Missing token at runtime** — the message is skipped and an error is logged;
   the batch continues. It stays `PROCESSING` and crash recovery resets it.
3. **Token in `OutboxHandlerContext`** — no. It is stable only within one claim;
   `messageId` is the idempotency key.
4. **Graceful shutdown** — `stop()` unchanged; an async, draining `stop()` is a
   separate decision (it changes the signature).
5. **Recoveries and `attempts`** — stays a repository policy (documented in the
   timeouts release); not counted by the library.

## Implementation notes

- Option `useFencing` implies `useClaimBatch` and
  `isolateCompletionWriteFailures`. Names as built:
  `OutboxFencedReleaseOutcome`, `FencedOutboxRepository` (type), hook
  `onStaleWrite(message, 'complete' | 'recordFailure' | 'release')`.
- One policy, two storage strategies. `OutcomeRecorder` owns the policy (attempt
  budget, hook order, backoff, completion-failure handling);
  `LegacyOutcomeStore` (`updateStatus` / `incrementAttempt` / `scheduleRetry`)
  and `FencedOutcomeStore` (the three fenced methods) only provide primitives,
  so the two paths cannot drift.
- Handlers and hooks receive the message **without** `claimToken` (fenced path).
- Opt-in `isolateCompletionWriteFailures` (implied by fencing): a failing status
  write **after a successful handler** (`PROCESSED` / `completeFenced`) is not a
  handler failure — no attempt consumed, no `onMessageFailed`, never `FAILED`
  for a delivered message. The recorder checks whether the write committed
  (fenced: the fence rejects the release; unfenced: read-back via `getById`),
  otherwise releases to `PENDING` with the retry backoff, at most `maxRetries`
  times per message per process, then leaves the message `PROCESSING` for crash
  recovery. Hook `onCompletionWriteFailed` reports each failure. Without the
  bound a deterministically failing write would redeliver forever, repeating the
  handler's side effects. Without the opt-in the old behaviour is kept (it was
  classified as a behavioural change, hence not enabled by default — a candidate
  for a future major).

## Review outcome

A review by nine independent reviewers (developer experience, security,
performance, documentation, concurrency, compatibility, tests, language/runtime,
architecture) led to: the `claimBatch` shim check in the constructor; the
bounded and observable completion-failure redelivery; the unfenced read-back; a
timeout that always wins the race even when a handler resolves inside its
`abort` listener; the claim token kept away from handlers and hooks; validation
of `messageTimeout` and `crashRecoveryThresholdMs`; async-hook rejection
isolation; and the shared `OutcomeRecorder`.

## Consequences

- Late status writes can no longer overwrite a newer attempt (status row only).
- Retry release becomes one atomic statement, removing the PENDING-before-delay
  window.
- Consumers pay one extra column and conditional updates; they must implement
  the repository methods themselves.
- Covered by contract tests with an in-memory fenced repository: stale complete
  / failure / release, ABA re-claim, timeout + zombie, missing token, failing
  completion write, constructor `TypeError`, `onStaleWrite`.
