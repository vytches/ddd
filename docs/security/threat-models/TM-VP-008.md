# Threat Model: TM-VP-008

**Feature:** OutboxProcessor catch-all/default handler + priorityOrder contract
hardening **Task:** VP-008-outbox-fanout-default-handler **Date:** 2026-05-26
**Method:** STRIDE + DREAD + LINDDUN **Scope:** `@vytches/ddd-messaging` —
`OutboxProcessor.registerDefaultHandler()`, `comparePriority()` helper,
`IOutboxRepository.getUnprocessedMessages()` JSDoc, `getStats()` extension

---

## Context & Attack Surface

VP-008 is a narrow, additive change on top of VP-003's production-ready
`OutboxProcessor`. The new attack surface introduced is small but qualitatively
different from VP-003:

1. **Default handler changes the implicit dispatch contract.** Before VP-008, an
   unknown `messageType` always throws — this is an implicit allowlist. After
   VP-008, a consumer who registers a default handler converts that allowlist
   into a catch-all. Any message type (including injected or typo'd ones) now
   reaches handler logic instead of failing fast.

2. **`comparePriority` is a pure utility with no I/O.** Its attack surface is
   limited to incorrect usage patterns — primarily incomplete `order` arrays
   causing silent sort inversions.

3. **`getStats()` extension** adds `hasDefaultHandler: boolean` — a minor
   information disclosure addition to an existing surface (TM-VP-003-I3 already
   covers `getStats()`).

**Components in scope:**

- `OutboxProcessor.registerDefaultHandler()` — new method
- `OutboxProcessor.buildPipeline()` — modified fallback chain
- `OutboxProcessor.getStats()` — extended with `hasDefaultHandler`
- `comparePriority(a, b, order?)` — new export from `@vytches/ddd-messaging`
- `IOutboxRepository.getUnprocessedMessages()` — JSDoc hardening only, no code
  change

**Out of scope:** BullMQ fan-out logic (consumer-side), KyselyOutboxRepository
(consumer-side). Library responsibility ends at providing the hook and helper.

---

## STRIDE Analysis

### S — Spoofing

#### TM-VP-008-S1: Default handler accepts any unregistered messageType — implicit allowlist removed

**Description:** Before VP-008, `buildPipeline()` throws on any unregistered
`messageType`. This is a de-facto allowlist: only explicitly registered types
are ever dispatched. A consumer who registers a default handler replaces this
throw with dispatch. An attacker with write access to the outbox table (SQL
injection, compromised DB user) can now craft messages with arbitrary
`messageType` values (e.g., `'admin.override'`, `'billing.free-tier-upgrade'`,
or random UUIDs) and guarantee they reach the default handler with
attacker-controlled payload — bypassing the per-type registration gate.

**Impact:** Handler executes with attacker-controlled payload for any invented
type. Severity depends entirely on what the consumer's default handler does. A
fan-out handler that dispatches to BullMQ queues is low impact; a handler that
performs business logic conditionally on payload content is high impact.

**DREAD:** D=3, R=3, E=2, A=3, Disc=3 → **14 (MEDIUM)**

**Mitigations:**

- This is opt-in: consumers who do not register a default handler retain
  throw-on-unknown behavior unchanged.
- The required debug log (`messageType` logged when default handler used)
  provides a detection signal.
- **Library action (MANDATORY):** LLMGUIDE.md must document the implicit
  allowlist trade-off explicitly: "registering a default handler is a conscious
  opt-out of the strict type allowlist — only do this if your default handler is
  safe for any payload."
- **Consumer guidance:** Default handlers should validate `message.messageType`
  against a known enum before processing, even in fan-out scenarios.

---

### T — Tampering

#### TM-VP-008-T1: `comparePriority` with incomplete order array → silent priority inversion ⚠️ HIGH

**Description:** `comparePriority(a, b, order?)` uses
`order.indexOf(a) - order.indexOf(b)` to compute ranking. If a consumer passes a
partial order array — e.g., `['critical', 'high']` omitting `'normal'` and
`'low'` — then `indexOf('normal')` = -1 and `indexOf('low')` = -1. When both
values are absent from the array, the comparator returns 0 (equal rank). When
one value is present and one absent (indexOf = -1), the absent value sorts
BEFORE the present one (−1 < any positive index). This means:
`comparePriority('low', 'critical', ['critical'])` = -1 - 0 = **-1** → `'low'`
sorts before `'critical'`. A partial order array silently inverts the intent.

**Impact:** LOW-priority messages processed before CRITICAL ones. Latent until
partial order arrays are actually used; surfaces as a priority bug in production
only when message queues are mixed.

**DREAD:** D=3, R=3, E=4, A=3, Disc=2 → **15 (HIGH)**

**Mitigations:**

- **Library action (MANDATORY):** `comparePriority` must validate `order` at
  call time: if any `MessagePriority` value is absent from the array, throw or
  default to canonical order for missing values.

```typescript
// Recommended guard:
export function comparePriority(
  a: MessagePriority,
  b: MessagePriority,
  order: MessagePriority[] = DEFAULT_PRIORITY_ORDER
): number {
  const rankA = order.indexOf(a);
  const rankB = order.indexOf(b);
  // Missing value → treat as lowest priority (push to end)
  const safeA = rankA === -1 ? order.length : rankA;
  const safeB = rankB === -1 ? order.length : rankB;
  return safeA - safeB;
}
```

- **Tests:** Must include case: partial order array with missing priorities —
  verify missing values sort last (not first).

---

#### TM-VP-008-T2: Payload passed to default handler without type-contract validation

**Description:** A type-specific handler is registered by a developer who knows
the payload shape for that exact type. The default handler, by design, handles
all types — including types the developer did not anticipate. If the handler
performs any payload-dependent logic (e.g., `(msg.payload as any).userId`),
type-confusion errors may occur silently, with handler errors retried up to
`maxRetries` before permanent failure. The retry loop with backoff may keep a
malformed or attacker-crafted payload alive in the processing queue for hours.

**DREAD:** D=2, R=3, E=3, A=2, Disc=3 → **13 (MEDIUM)**

**Mitigations:**

- Document: default handlers MUST treat payload as `unknown` and validate before
  use.
- The debug log (already required) will surface unknown types being dispatched.

---

### R — Repudiation

#### TM-VP-008-R1: Debug-only log for default handler dispatch — no trace at INFO level

**Description:** The spec requires
`logger.debug('Using default handler for type: X')`. In production systems, log
level is typically INFO or higher. Debug logs are suppressed by default. If an
attacker injects messages with crafted `messageType` values and a default
handler is registered, those messages are dispatched and processed with **no log
trace visible to an operator**. There is no way to distinguish "all types were
registered explicitly" from "some unknown types were silently caught by the
default handler" without debug logging enabled.

**Impact:** Post-incident forensics cannot determine whether unexpected types
were processed. Compliance audit trails are incomplete.

**DREAD:** D=2, R=4, E=5, A=2, Disc=3 → **16 (MEDIUM)**

**Mitigations:**

- **Library action (RECOMMENDED):** Log at `warn` (not `debug`) when the default
  handler is used for a type that is NOT in a declared known-types list. Add an
  optional `knownTypes?: string[]` option to `OutboxProcessorOptions` — types
  not in this list and handled by default emit WARN.
- Alternatively: first occurrence of each unknown type logged at INFO,
  subsequent at DEBUG (deduplication by type).
- At minimum: the LLMGUIDE fan-out recipe must note the logging level
  limitation.

---

### I — Information Disclosure

#### TM-VP-008-I1: `hasDefaultHandler: boolean` in getStats() extends existing disclosure surface

**Description:** `getStats()` already exposes `registeredHandlers: string[]`
(see TM-VP-003-I3). Adding `hasDefaultHandler: true` further reveals the
processor's configuration: an attacker who can query the stats endpoint now
knows that ANY `messageType` will be dispatched (no throw for unknowns). This
eliminates uncertainty about whether an injected unknown type will cause
observable errors (throw, alert, ops investigation) or silent dispatch.

**DREAD:** D=2, R=4, E=4, A=2, Disc=4 → **16 (MEDIUM)**

**Mitigation:** This extends TM-VP-003-I3 — the existing mitigation applies:
`getStats()` must be documented as internal monitoring only, never auto-exposed
via HTTP. No new library action required beyond the existing guidance. The
`hasDefaultHandler` field itself is a necessary observability addition; the risk
is in exposure, not existence.

---

### D — Denial of Service

#### TM-VP-008-D1: Default handler as DoS amplifier — garbage types consume handler capacity

**Description:** Before VP-008, messages with unregistered types fail fast
(throw in `buildPipeline()` → `handleMessageError()` → retry/backoff → permanent
failure). With a default handler registered, every garbage message — including
an attacker's flood of random-UUID `messageType` values from compromised storage
— executes the handler. For a fan-out default handler (e.g., BullMQ
`queue.add()`), each garbage message adds a job to a downstream queue. 1,000
injected garbage messages = 1,000 queue jobs, potentially filling the queue and
starving legitimate jobs.

**DREAD:** D=3, R=3, E=2, A=3, Disc=2 → **13 (MEDIUM)**

**Mitigations:**

- The `batchSize` validation from TM-VP-003-D1 still applies (limits messages
  per cycle).
- Default handler can implement its own type allowlist as a second line of
  defense.
- **Library action:** LLMGUIDE recipe should show a recommended default handler
  with a type allowlist guard, not a pure catch-all.

---

### E — Elevation of Privilege

#### TM-VP-008-E1: Default handler bypasses implicit type-based access control ⚠️ HIGH

**Description:** Some consumer handlers enforce access control based on message
type — for example, a handler for `'payment.captured'` verifies the aggregate
owner before publishing. A type-specific handler provides a natural audit point:
the developer writes handler code knowing exactly what type it handles. The
default handler removes this type gate: a new event type added to the domain
(e.g., `'account.admin-override'`) that is not yet registered as a type-specific
handler will silently fall through to the catch-all, bypassing any access checks
the developer would have added to a type-specific handler. This is a progressive
risk: safe today, dangerous when a new sensitive event type is added and the
developer forgets that the default handler already covers it.

**DREAD:** D=3, R=3, E=3, A=3, Disc=3 → **15 (HIGH)**

**Mitigations:**

- **Library action (MANDATORY):** LLMGUIDE must contain an explicit warning:
  "Adding a default handler means ALL future message types — including ones
  added later — will be dispatched automatically. Review access control
  assumptions before registering a default handler."
- **Recommended pattern:** Fan-out default handlers should use an explicit
  allowlist (`knownTypes`) rather than a pure catch-all.
- The debug/warn log for unknown type dispatch is a necessary detection
  mechanism.

---

## LINDDUN Privacy Analysis

**Assessment:** VP-008 does not introduce new PII processing logic. The default
handler receives the same `IOutboxMessage` structure as type-specific handlers.
VP-003 LINDDUN findings (Linkability, Identifiability, GDPR Art.17 conflict,
Disclosure via logs) remain in force and are not reproduced here. One new
incremental risk:

### Progressive PII Exposure via Catch-all Dispatch

**Description:** In an evolving domain, new event types are added over time. If
a consumer has a default handler registered and a new event type carrying PII
(e.g., `'user.gdpr-export-requested'` with `payload: { email, ssn }`) is added
to the domain before a type-specific handler with PII awareness is implemented,
the default handler dispatches the full payload automatically. The fan-out
handler (BullMQ dispatch) sends the PII-carrying payload to all configured
queues — some of which may not have PII access controls.

**Risk level:** MEDIUM in GDPR-regulated environments.

**Mitigation:**

- **Do NOT strip payload at dispatch time.** The Transactional Outbox pattern
  exists precisely to carry full integration event data to downstream contexts.
  A metadata-only dispatch would require a synchronous query-back to the
  originating context, breaking async decoupling and losing the point-in-time
  snapshot of aggregate state.
- The correct mitigation layer is **access control on queues/topics**: only
  authorized downstream contexts should be able to read from queues that carry
  PII.
- For GDPR Art.17 (Right to Erasure): use the `eraseUserPayloads()` pattern
  already documented for VP-003 — nullify payloads in the outbox table on
  erasure request. The outbox entry persists (for audit trail) but the PII is
  removed.
- LLMGUIDE: note that registering a default handler that dispatches to multiple
  queues means ALL queues receive ALL new event types as they are added. Access
  control review is required when a new PII-carrying type is added to the
  domain.

---

## Risk Summary

| ID      | Category    | Finding                                                           | DREAD | Priority |
| ------- | ----------- | ----------------------------------------------------------------- | ----- | -------- |
| T1      | Tampering   | `comparePriority` partial order array → silent priority inversion | 15    | **HIGH** |
| E1      | EoP         | Default handler bypasses implicit type-based access control       | 15    | **HIGH** |
| R1      | Repudiation | Debug-only log for default dispatch — no trace at INFO level      | 16    | MEDIUM   |
| I1      | Info        | `hasDefaultHandler` extends getStats() disclosure surface         | 16    | MEDIUM   |
| S1      | Spoofing    | Default handler removes implicit type allowlist                   | 14    | MEDIUM   |
| D1      | DoS         | Garbage types consume handler capacity instead of failing fast    | 13    | MEDIUM   |
| T2      | Tampering   | Payload passed to default handler without type-contract           | 13    | MEDIUM   |
| LINDDUN | Privacy     | New PII-carrying types auto-dispatched before PII handler added   | —     | MEDIUM   |

No CRITICAL findings. VP-008 is a lower-risk change than VP-003 — the new
surface is narrow and all HIGH findings have straightforward library-side
mitigations.

---

## Required Mitigations Before Implementation

### HIGH — block merge if absent

1. **`comparePriority` missing-value guard** — absent values in `order` array
   must map to `order.length` (sort last), not -1 (sort first). Add test:
   partial order array with missing priorities.

2. **LLMGUIDE warning: default handler removes type allowlist** — explicit note
   that all future message types (including ones added later) are
   auto-dispatched. Recommend `knownTypes` allowlist guard in the default
   handler.

### MEDIUM — address before v0.30.0 release

3. **Log level for unknown type dispatch** — consider WARN for first occurrence
   per type, not DEBUG. Operators need visibility without enabling debug logging
   globally.

4. **LLMGUIDE fan-out recipe** — show default handler dispatching metadata only
   (`id`, `messageType`, `aggregateId`), not full payload, to avoid PII in
   transit.

5. **`comparePriority` tests** — include partial order array + full inversion +
   custom order cases.

### Inherited from VP-003 (still applicable, not duplicated here)

- TM-VP-003-I3: `getStats()` must not be auto-exposed via HTTP without auth.
- TM-VP-003-I1: Logger must never include raw payload content.

---

## References

- VP-008 task:
  `project-orchestration/tasks/VP-008-outbox-fanout-default-handler.md`
- Predecessor threat model: `docs/security/threat-models/TM-VP-003.md`
- Implementation target: `packages/messaging/src/outbox/outbox-processor.ts`
- Helper target: `packages/messaging/src/outbox/outbox-interfaces.ts`
- STRIDE: Microsoft Threat Modeling (SDL)
- LINDDUN: Privacy by Design threat modeling framework
