# Threat Model: TM-VP-003

**Feature:** Outbox production readiness (retry backoff, type filter,
InMemoryRepo, adaptive re-poll, NestJS module) **Task:**
VP-003-messaging-outbox-optimization **Date:** 2026-05-18 **Method:** STRIDE +
DREAD + LINDDUN **Scope:** `@vytches/ddd-messaging` OutboxProcessor,
IOutboxRepository, OutboxProcessorHooks, `@vytches/ddd-testing`
InMemoryOutboxRepository, `@vytches/ddd-nestjs` OutboxProcessorModule

---

## Context & Attack Surface

This feature adds production-critical infrastructure to a DDD library. The
outbox pattern sits at a privileged intersection: it has direct access to the
database (read/write), executes arbitrary consumer-provided handlers, processes
domain events that may carry PII, and runs as a long-lived background process.
The library is a framework — threats here propagate to all consumers.

**Components in scope:**

- `OutboxProcessor` — background poller, handler dispatch, retry logic
- `IOutboxRepository` — new methods: `scheduleRetry`, `resetStaleProcessing`,
  `getUnprocessedMessages` with type filter
- `OutboxProcessorOptions` — `retryBackoff`, `messageTypes`,
  `crashRecoveryIntervalMs`, `adaptiveRepoll`, `startupJitterMs`
- `OutboxProcessorHooks` — `onBatchComplete`, `onMessageFailed`,
  `onPermanentFailure`
- `InMemoryOutboxRepository` — test utility
- `OutboxProcessorModule.forRootAsync` — NestJS DI integration

---

## STRIDE Analysis

### S — Spoofing

#### TM-VP-003-S1: Message type spoofing via compromised storage

**Description:** An attacker with write access to the outbox table (SQL
injection, compromised DB user, internal attacker) crafts a message with a
`messageType` targeting a privileged handler (e.g., `admin.purge-all` if such a
handler exists in the consumer app). The library routes based solely on
`messageType` string — no signature verification.

**Impact:** Execution of arbitrary registered handler logic with
attacker-controlled payload.

**Mitigation (library):**

- Document that `messageType` is trusted storage-layer data, not user input.
- Handler registration is the defense boundary — only explicitly registered
  types are processed; unregistered types throw and are retried/failed.
- Recommend consumers use an allowlist enum for `messageType` values, not free
  strings.

**Mitigation (consumer):** Validate `messageType` against a known enum at
handler registration time.

---

#### TM-VP-003-S2: Handler registration race — last-write-wins silently

**Description:** `registerHandler(type, handler)` uses a `Map` with no duplicate
detection. Calling it twice with the same `type` silently replaces the handler.
In dynamic module loading or multi-instance NestJS scenarios, initialization
order determines which handler wins.

**Impact:** Wrong handler processes messages — silent data routing failure, no
error.

**DREAD:** D=2, R=2, E=2, A=2, Disc=3 → **11 (MEDIUM)**

**Mitigation:** Warn or throw on duplicate `messageType` registration. At
minimum log a warning.

---

### T — Tampering

#### TM-VP-003-T1: Payload tampering at storage layer (no integrity check)

**Description:** `IOutboxMessage.payload` is `unknown`. The library passes it to
handlers without any integrity verification. A compromised storage layer can
modify payloads between save and dispatch. Handlers receive tampered data.

**Impact:** Business logic executed with attacker-controlled inputs.

**DREAD:** D=3, R=2, E=2, A=3, Disc=2 → **12 (MEDIUM)**

**Mitigation (library):** Document explicitly that `IOutboxRepository`
implementations are trusted — payload integrity is the consumer's
responsibility. Recommend signing payloads at save time if integrity is
required.

---

#### TM-VP-003-T2: `resetStaleProcessing` as replay attack vector ⚠️ HIGH

**Description:** The proposed `resetStaleProcessing(olderThan: Date)` resets ALL
messages in PROCESSING state older than the threshold back to PENDING. If called
with `new Date(Date.now() + 999_999_999)` (far future), it resets ALL PROCESSING
messages — including ones currently being processed by other pods. This causes:

1. Double-delivery: pod A is processing message M, cron resets M to PENDING, pod
   B picks it up.
2. At-most-once semantics are violated (the pattern typically targets
   at-least-once, but double-delivery within a single processing cycle is
   unexpected).

**DREAD:** D=4, R=3, E=2, A=3, Disc=3 → **15 (HIGH)**

**Mitigations:**

- Add input validation: `olderThan` must be in the past (reject future
  timestamps).
- Document the threshold recommendation (≥ 2× `messageTimeout`).
- The `InMemoryOutboxRepository` implementation MUST validate this to set
  consumer expectations.
- `crashRecoveryThresholdMs` should enforce a minimum value (e.g.,
  `messageTimeout * 2`).

```typescript
// Recommended guard in OutboxProcessor:
if (threshold < this.options.messageTimeout * 2) {
  throw new Error(
    'crashRecoveryThresholdMs must be at least 2× messageTimeout to prevent double-delivery'
  );
}
```

---

#### TM-VP-003-T3: Log injection via `lastError` field

**Description:** `handleMessageError` logs `error.message`. Error messages may
contain newlines, ANSI codes, or structured data from broker clients. In log
aggregators (Datadog, Loki), injected newlines create false log entries; ANSI
codes may trigger rendering issues.

**DREAD:** D=2, R=3, E=3, A=2, Disc=3 → **13 (MEDIUM)**

**Mitigation:** Sanitize error messages before logging — strip newlines and
non-printable characters. Add to `Logger` wrapper or document as consumer
responsibility when configuring structured logging.

---

### R — Repudiation

#### TM-VP-003-R1: No audit trail for `resetStaleProcessing`

**Description:** When `resetStaleProcessing` resets messages to PENDING, there
is no record of: which messages were reset, when, why (automated vs. manual), or
by which instance. If a message is delivered twice after a reset, root-cause
analysis is impossible without external log correlation.

**DREAD:** D=2, R=4, E=4, A=2, Disc=2 → **14 (MEDIUM)**

**Mitigation:**

- `resetStaleProcessing` should return affected message IDs (or at minimum
  count), and the processor should log them at WARN level.
- The `OutboxProcessorHooks` interface should include
  `onCrashRecovery?(count: number, threshold: Date): void` to enable
  consumer-side alerting.

---

#### TM-VP-003-R2: `onPermanentFailure` hook — unhandled throw loses the signal

**Description:** If the `onPermanentFailure` consumer callback throws, the
exception propagates up through `handleMessageError`. Currently there is no
`try/catch` wrapper around hook invocations. The failure is silently swallowed
or crashes the processor, and the permanent failure signal is lost.

**DREAD:** D=2, R=3, E=4, A=3, Disc=2 → **14 (MEDIUM)**

**Mitigation:** Wrap all hook invocations in `safeRun`/try-catch. Log hook
errors at ERROR level but never propagate them — hooks must not affect processor
stability.

```typescript
// Required pattern:
if (this.options.hooks?.onPermanentFailure) {
  const [hookError] = await safeRun(() =>
    this.options.hooks!.onPermanentFailure!(message, error)
  );
  if (hookError)
    this.logger.error('onPermanentFailure hook threw', hookError.message);
}
```

---

### I — Information Disclosure

#### TM-VP-003-I1: PII leakage in error logs via payload serialization ⚠️ HIGH

**Description:** `IOutboxMessage.payload` may contain PII (confirmed:
juz-ide-api implements `eraseUserPayloads()` — PII is present in outbox
messages). When message processing fails (e.g., JSON serialization error, schema
validation failure), the error message may include payload content:

```
TypeError: Cannot serialize value: {email: "user@example.com", phone: "+48..."}
```

This content is then logged via `Logger.error()` and shipped to log management
systems.

**DREAD:** D=4, R=3, E=3, A=4, Disc=2 → **16 (HIGH)**

**Mitigations:**

- Document that `lastError` field (stored in DB) MUST be scrubbed by the
  repository implementation before persistence (juz-ide-api already does
  `.slice(0, 2048)` and `[REDACTED_DSN]`).
- The `Logger` integration in `OutboxProcessor` should NEVER log message payload
  directly.
- Add a lint/review note: payload must never appear in `error.message` paths.

---

#### TM-VP-003-I2: Database connection strings in error logs

**Description:** `getUnprocessedMessages` errors propagate the raw DB error
message to the logger. PostgreSQL/Kysely errors often include the connection
string:

```
Error retrieving messages: connect ECONNREFUSED postgresql://user:pass@host:5432/db
```

**DREAD:** D=3, R=3, E=2, A=3, Disc=3 → **14 (MEDIUM)**

**Mitigation:** Document that `IOutboxRepository` implementations must sanitize
DB error messages (remove DSN, credentials) before throwing. Reference
juz-ide-api's `[REDACTED_DSN]` pattern as the recommended approach.

---

#### TM-VP-003-I3: `getStats()` exposes handler names to monitoring endpoints

**Description:** `getStats()` returns `registeredHandlers: string[]`. If
consumers expose this via a REST health endpoint, internal message type names
(business logic identifiers) are visible to anyone with HTTP access.

**DREAD:** D=2, R=4, E=4, A=3, Disc=3 → **16 (HIGH)**

**Mitigation:** Document that `getStats()` is for internal monitoring only. The
NestJS module should NOT auto-expose it via HTTP without authentication.
Consider whether `registeredHandlers` should be in `getStats()` at all, or only
returned in a separate privileged call.

---

### D — Denial of Service

#### TM-VP-003-D1: Unbounded `batchSize` → memory exhaustion ⚠️ HIGH

**Description:** `batchSize` accepts any positive number with no validation.
`new OutboxProcessor(repo, { batchSize: 1_000_000 })` attempts to load 1M
messages into memory simultaneously. At ~1KB per message (payload + metadata),
this is ~1GB RAM. In serverless/edge runtimes with 128MB limit, this crashes the
runtime.

**DREAD:** D=4, R=4, E=5, A=4, Disc=4 → **21 (HIGH)**

**Mitigation:** Add `batchSize` validation in constructor:

```typescript
if (options.batchSize !== undefined && options.batchSize > 10_000) {
  throw new Error(
    'batchSize must not exceed 10,000 — use processingInterval for throughput control'
  );
}
```

Or at minimum: document the recommended range (10–500) and the memory
implications.

---

#### TM-VP-003-D2: Adaptive re-poll saturates DB connection pool

**Description:** `adaptiveRepoll: true` with a continuously full batch causes
`setTimeout(0)` loops. Each loop issues `getUnprocessedMessages` (1 read) +
N×`updateStatus` (N writes). With `batchSize: 200` and a DB connection pool of
10 connections, the processor monopolizes the pool. Combined with multiple
`OutboxProcessorModule` processor instances, the pool is exhausted, blocking all
other database operations in the application.

**DREAD:** D=4, R=3, E=3, A=4, Disc=3 → **17 (HIGH)**

**Mitigations:**

- The livelock guard (50ms after 5 consecutive full batches) is necessary —
  validate it's correctly implemented.
- Document the interaction between `batchSize`, `adaptiveRepoll`, and DB
  connection pool sizing.
- Recommend `adaptiveRepoll: false` as the safe default (it is already proposed
  as default).
- Consider adding `minRepollDelayMs` (e.g., default 10ms) so that
  `setTimeout(0)` is never literally 0 in production.

---

#### TM-VP-003-D3: `crashRecoveryThresholdMs: 0` resets all in-flight messages

**Description:** If `crashRecoveryThresholdMs` is misconfigured to 0 (or a very
small value, e.g., 100ms), the crash recovery cron resets ALL PROCESSING
messages every cron tick — including messages currently being processed. This:

1. Causes double-delivery of every message in a batch.
2. The processor picks up the same message again while still processing it (no
   deduplication at the processor level).
3. With `crashRecoveryIntervalMs: 1000` and `crashRecoveryThresholdMs: 100`,
   every message that takes >100ms to process is reset before it completes.

**DREAD:** D=4, R=4, E=5, A=4, Disc=3 → **20 (HIGH)**

**Mitigation:** Enforce minimum `crashRecoveryThresholdMs` ≥ `messageTimeout`
(which defaults to 30s). Add validation in constructor:

```typescript
if (opts.crashRecoveryThresholdMs < opts.messageTimeout) {
  throw new Error(
    'crashRecoveryThresholdMs must be ≥ messageTimeout to prevent double-delivery'
  );
}
```

---

#### TM-VP-003-D4: `retryBackoff.initial × multiplier^attempts` integer overflow

**Description:** For `initial: 1000, multiplier: 2, maxRetries: 100`, attempt
100 yields `1000 × 2^99 ≈ 6.3 × 10^32` ms. JavaScript `Math.pow` returns
`Infinity` for large exponents. `new Date(Date.now() + Infinity)` =
`Invalid Date`. `scheduleRetry(id, new Date(NaN))` would store a null or invalid
`processAfter`, causing the message to be immediately re-queued (bypasses
backoff entirely).

**DREAD:** D=3, R=3, E=4, A=3, Disc=2 → **15 (HIGH)**

**Mitigation:** Apply `Math.min(delay, maxDelay)` BEFORE computing `new Date()`.
Additionally validate that `delay` is a finite positive number before calling
`scheduleRetry`. The proposed code in VP-003 uses `Math.min` correctly — verify
implementation matches spec.

---

### E — Elevation of Privilege

#### TM-VP-003-E1: `onPermanentFailure` routes PII to less-controlled systems

**Description:** The `onPermanentFailure` hook receives the full
`IOutboxMessage` including `payload`. A common consumer use case is routing
permanently failed messages to a DLQ (Dead Letter Queue). If the DLQ has weaker
access controls than the primary message broker (e.g., DLQ is an S3 bucket with
broader read access), an attacker who can reliably cause message failures (e.g.,
by poisoning the handler to always throw) routes sensitive payloads to a
less-controlled system.

**DREAD:** D=3, R=2, E=2, A=2, Disc=2 → **11 (MEDIUM)**

**Mitigation:** Document that `onPermanentFailure` hook should NOT include raw
payload when routing to DLQ — use only `id` and `messageType` for routing,
retrieve payload separately if needed.

---

#### TM-VP-003-E2: Crash recovery resets intentionally-stuck PROCESSING ⚠️ HIGH

**Description:** Some workflows intentionally leave messages in PROCESSING state
for manual review (e.g., GDPR erasure requests requiring human approval,
compliance holds). The `crashRecoveryIntervalMs` cron blindly resets ALL old
PROCESSING messages, including intentionally-held ones, re-queueing them for
automatic processing and bypassing the human review step.

**DREAD:** D=4, R=3, E=3, A=3, Disc=3 → **16 (HIGH)**

**Mitigations:**

- Document that `crashRecoveryIntervalMs` must not be used alongside workflows
  that intentionally hold messages in PROCESSING.
- Consider adding a `skipCrashRecoveryForTypes?: string[]` option to exclude
  specific message types from automatic reset.
- Or add a `processedBy` metadata field so crash recovery can distinguish "stuck
  by pod crash" from "held intentionally".

---

## LINDDUN Privacy Analysis

**Assessment:** The outbox pattern is a PII-proximity risk by design.
Integration events carry domain data; `IOutboxMessage.payload` is confirmed to
contain PII in at least one production consumer (juz-ide-api has
`eraseUserPayloads()`). LINDDUN analysis is **required**.

### L — Linkability

Outbox messages contain `id` (UUID) + `aggregateId` in metadata. Multiple
messages from the same aggregate reconstruct a user's activity timeline.
Messages persist for 7 days (default `cleanupAfterDays`). During this window,
the outbox table is a secondary user activity log.

**Risk:** MEDIUM. Mitigate by minimizing metadata — document that `aggregateId`
in metadata is optional unless needed for ordering.

### I — Identifiability

`IOutboxMessage.id` + `metadata.aggregateId` = persistent identifier linked to a
specific user/aggregate for the retention period. If the outbox table is
accessible to analytics or BI systems, users are identifiable.

**Risk:** MEDIUM. Recommend: limit DB role permissions on the outbox table to
the application user only (read: poller, write: service). No analytics access.

### N — Non-repudiation (Art.17 GDPR conflict)

The outbox pattern creates a durable record of all domain events. For GDPR
Art.17 (Right to Erasure), this is a liability: a FAILED message retains PII
payload beyond the erasure request. The library provides no built-in PII erasure
mechanism.

**Risk:** HIGH in GDPR-regulated contexts.

**Mitigation:**

- Document `deleteByStatusAndAge` as the GDPR cleanup mechanism.
- Recommend `eraseUserPayloads(userId)` pattern (as juz-ide-api implements) in
  LLMGUIDE.md.
- The `onPermanentFailure` hook could be used to trigger payload erasure for
  permanently failed messages.
- **New method to document:**
  `erasePayloadById(id: string, replacement: unknown): Promise<void>` — concrete
  no-op, same pattern as `resetStaleProcessing`.

### D — Detectability

Message counts per `messageType` reveal business activity patterns. Example:
10,000 `GdprAuditChainAppend` events in 1 hour = 10,000 erasure requests. If the
outbox table is shared with analytics/monitoring, business-sensitive activity
volumes are observable.

**Risk:** LOW-MEDIUM. Mitigate via access control (DB role restriction).

### D — Disclosure (LINDDUN)

Error logs containing payload fragments are shipped to third-party log
management (Datadog, Splunk, Loki). These systems have their own retention
policies outside GDPR scope.

**Risk:** HIGH if payload appears in error messages.

**Mitigation:** The `Logger` in `OutboxProcessor` must NEVER log message
payload. Error messages from handlers must be sanitized before logging. Document
this contract explicitly.

### U — Unawareness

Users generating domain events that produce outbox messages are unaware their
data persists in the outbox table for up to 7 days (default). This is additional
to normal domain storage.

**Risk:** MEDIUM in GDPR contexts. Mitigate by documenting in consumer-facing
Privacy Impact Assessment templates.

### N — Non-compliance

The no-op `resetStaleProcessing` default could re-deliver a message after a GDPR
erasure if:

1. User requests erasure → `eraseUserPayloads` nulls the payload.
2. The message was stuck in PROCESSING (pod crash) with original payload still
   in the handler's in-flight data.
3. Crash recovery resets it → handler re-executes with the (already-erased)
   message → payload in handler memory.

The actual stored payload is erased, but in-flight re-delivery may expose data
in handler memory logs.

**Risk:** LOW (edge case) but non-zero in GDPR-strict environments.

---

## Risk Summary

| ID        | Category    | Finding                                              | DREAD | Priority     |
| --------- | ----------- | ---------------------------------------------------- | ----- | ------------ |
| T2        | Tampering   | `resetStaleProcessing` replay → double-delivery      | 15    | HIGH         |
| D1        | DoS         | Unbounded `batchSize` → OOM                          | 21    | **CRITICAL** |
| D2        | DoS         | Adaptive re-poll → DB connection pool exhaustion     | 17    | HIGH         |
| D3        | DoS         | `crashRecoveryThresholdMs: 0` → all-messages reset   | 20    | **CRITICAL** |
| D4        | DoS         | Backoff integer overflow → `Infinity` delay          | 15    | HIGH         |
| E2        | EoP         | Crash recovery bypasses intentional PROCESSING holds | 16    | HIGH         |
| I1        | Info        | PII in error logs via payload serialization          | 16    | HIGH         |
| I3        | Info        | `getStats()` exposes handler names                   | 16    | HIGH         |
| R1        | Repudiation | No audit trail for `resetStaleProcessing`            | 14    | MEDIUM       |
| R2        | Repudiation | Hook throw silently lost                             | 14    | MEDIUM       |
| I2        | Info        | DB connection strings in logs                        | 14    | MEDIUM       |
| S2        | Spoofing    | Handler registration last-write-wins                 | 11    | MEDIUM       |
| T3        | Tampering   | Log injection via `lastError`                        | 13    | MEDIUM       |
| E1        | EoP         | `onPermanentFailure` routes PII to DLQ               | 11    | MEDIUM       |
| LINDDUN-N | Privacy     | GDPR Art.17 conflict — PII in FAILED messages        | -     | HIGH         |
| LINDDUN-D | Privacy     | PII in error logs → third-party log systems          | -     | HIGH         |

---

## Required Mitigations Before Implementation

The following MUST be addressed in VP-003 implementation (block merge if
absent):

### CRITICAL (block v0.26.1)

1. **`batchSize` validation in constructor** — max 10,000, throw on violation.
2. **`crashRecoveryThresholdMs` minimum validation** — must be ≥
   `messageTimeout`, throw on violation.
3. **Hook invocations wrapped in `safeRun`** — hook exceptions must never
   propagate to processor.
4. **`Math.min(delay, maxDelay)` before `new Date()`** — guard against
   `Infinity` from overflow.

### HIGH (block v0.26.1)

5. **`resetStaleProcessing` input validation** — reject `olderThan` in the
   future (must be past date).
6. **`InMemoryOutboxRepository.resetStaleProcessing`** — validate `olderThan` to
   set consumer expectations.
7. **Logger must never include raw payload** — lint/code review gate.
8. **Document `getStats()` as internal-only** — NestJS module must not
   auto-expose via HTTP.

### MEDIUM (address before v0.26.2)

9. **Duplicate handler registration warning** — log WARN on `registerHandler`
   overwrite.
10. **`onCrashRecovery` hook in `OutboxProcessorHooks`** — enable consumer
    alerting on recovery events.
11. **LLMGUIDE.md: GDPR Art.17 recipe** — `erasePayloadById` pattern +
    `deleteByStatusAndAge` usage.
12. **Document error message sanitization** — reference juz-ide-api
    `[REDACTED_DSN]` pattern.

---

## References

- VP-003 task:
  `project-orchestration/tasks/VP-003-messaging-outbox-optimization.md`
- Implementation: `packages/messaging/src/outbox/outbox-processor.ts`
- Repository interface:
  `packages/messaging/src/outbox/outbox-repository.interface.ts`
- Consumer reference:
  `juz-ide-api/src/shared/infrastructure/messaging/outbox/outbox-poller.service.ts`
- STRIDE: Microsoft Threat Modeling (SDL)
- LINDDUN: Privacy by Design threat modeling framework
