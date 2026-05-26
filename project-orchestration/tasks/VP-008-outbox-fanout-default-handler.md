# Task: OutboxProcessor — catch-all/default handler + priority-order contract hardening

## Task Metadata

```yaml
task_id: VP-008
title:
  Catch-all/default handler in OutboxProcessor + priorityOrder contract guard
type: feature
priority: high
complexity: simple
estimated_time: 3h
created_by: agent (consumer analysis — LocalHero TS-DR-OUTBOX-001)
created_at: 2026-05-25
status: done
release_target: v0.30.0
follows_up: VP-003
```

---

## Domain Context

```yaml
bounded_context: Messaging / Outbox
patterns:
  - Transactional Outbox
  - Template Method (handler resolution)
```

## Business Context

### Why This Task Exists

VP-003 (done 2026-05-23) made `OutboxProcessor` production-ready: retry/backoff,
crash recovery, type filter, hooks, adaptive re-poll, jitter,
`OutboxProcessorModule`. A real consumer (LocalHero, `TS-DR-OUTBOX-001`) is now
ready to **drop its hand-rolled poller and adopt `OutboxProcessor`** — exactly
the migration VP-003 anticipated.

Two friction points surfaced during that adoption that VP-003 did not cover:

1. **No catch-all handler.**
   `OutboxProcessor.registerHandler(messageType, handler)` is strictly per-type,
   and `buildPipeline()` throws `No handler registered for message type` when
   none matches (`outbox-processor.ts:352-354`). The consumer routes **~50
   integration event types through one uniform fan-out** (outbox row →
   per-context BullMQ queue). Per-type registration would mean registering the
   identical handler 50×, and silently breaking the moment a new event type is
   added without a matching registration. This blocks adoption.

2. **`priorityOrder` contract is an easy trap.** The consumer's
   `KyselyOutboxRepository` ignored the `priorityOrder` arg and did
   `ORDER BY priority DESC` on a `text` column whose values are
   `'low'|'normal'|'high'|'critical'`. Postgres sorts that alphabetically →
   `critical` processed **last**. Latent until priorities are actually used,
   then it inverts intent. The reference `InMemoryOutboxRepository` does it
   correctly (`priorityOrder.indexOf(...)`), so the contract is "repo MUST honor
   the passed array" — but nothing enforces or signposts it.

### Expected Business Value

- [ ] Consumers with uniform dispatch (fan-out, single event bus) adopt
      `OutboxProcessor` without per-type boilerplate
- [ ] New message types are handled by default instead of throwing at runtime
- [ ] The priority-ordering trap is documented/guarded so other implementors
      don't repeat it

## Technical Context

### Current State

- `buildPipeline(message)` → `handlers.get(message.messageType)` → throw if
  absent.
- `priorityOrder` is passed to
  `repository.getUnprocessedMessages(limit, priorityOrder, types)` but honoring
  it is entirely the repo's responsibility, with no guard or prominent doc.

### Desired State

- Optional default handler invoked when no type-specific handler is registered.
- Explicit, well-documented `priorityOrder` contract; ideally a tiny exported
  helper so repos rank correctly instead of hand-rolling (and mis-rolling) the
  sort.

### Technical Constraints

- **Zero breaking changes.** Default handler is opt-in; absent default + unknown
  type keeps the current throw behavior.
- Stay runtime-agnostic (no Node-only APIs) — consistent with VP-003 decisions.

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `OutboxProcessor.registerDefaultHandler(handler: IOutboxMessageHandler): void`
- [ ] `buildPipeline()` resolves type-specific handler first, falls back to
      default handler if registered, throws only if neither exists (behavior
      unchanged when no default set)
- [ ] When the default handler is used for an unregistered type, log that
      `messageType` at `debug` — never silently swallow unknown types (preserves
      visibility for other consumers who use the default as a safety net, not an
      intentional catch-all)
- [ ] Default handler participates in the same middleware pipeline +
      `messageTimeout` race
- [ ] Export `comparePriority(a, b, order?)` helper from
      `@vytches/ddd-messaging`; missing values in `order` map to `order.length`
      (sort last, not first) — guard against partial arrays
- [ ] `registerDefaultHandler` is idempotent — second call silently overwrites
      (no throw)
- [ ] `getStats()` extended with `hasDefaultHandler: boolean`
- [ ] JSDoc on `registerDefaultHandler` warns: "removes implicit type allowlist
      — all future message types auto-dispatched; validate messageType inside
      handler if allowlist required"
- [ ] JSDoc on `registerDefaultHandler` documents `messageTypes` edge case:
      "default handler handles only types passing through `messageTypes` filter
      (if set)"
- [ ] JSDoc on `getUnprocessedMessages` (interface) states the ordering contract
      explicitly: "MUST order by the supplied `priorityOrder`; do NOT ORDER BY
      priority on string column — alphabetical sort inverts intent (critical
      sorts after high)"

### Non-Functional Requirements

- [ ] Backward compatible — all existing tests green, no new required params
- [ ] Testing: unit coverage for default-handler resolution + priority helper
- [ ] Documentation: LLMGUIDE.md fan-out recipe (one default handler for N event
      types)

### Definition of Done

- [ ] Implemented + reviewed
- [ ] Tests written and passing (>80% coverage on touched files)
- [ ] CHANGELOG + LLMGUIDE updated
- [ ] No breaking change to `OutboxProcessor` / `IOutboxRepository` public
      surface

## Implementation Plan

### Phase 1 + Phase 2: jeden PR (~3h łącznie)

> Architektonicznie oba phasesy muszą wyjść razem — default handler bez
> udokumentowanego `comparePriority` oddaje konsumentowi połowę rozwiązania i
> ryzykuje ponowny `ORDER BY priority`. Wyjątek: jeśli trzeba natychmiast
> odblokować TS-DR-OUTBOX-002 — Phase 1 może wyjść solo pod warunkiem że JSDoc
> na `getUnprocessedMessages` jest w tym samym commicie.

#### Phase 1: Default handler (~1.5h)

- **Files**: `packages/messaging/src/outbox/outbox-processor.ts`
- **Tasks**:
  - [ ] Add `private defaultHandler?: IOutboxMessageHandler`
  - [ ] `registerDefaultHandler(handler)`: idempotent (drugie wywołanie
        nadpisuje, nie rzuca)
  - [ ] JSDoc na `registerDefaultHandler`: allowlist warning + `messageTypes`
        filter edge case
  - [ ] In `buildPipeline()`:
        `const handler = this.handlers.get(type) ?? this.defaultHandler`; throw
        only if still undefined
  - [ ] `logger.debug(\`Default handler used for message type: ${type}\`)` gdy
        fallback
  - [ ] `getStats()`: dodać `hasDefaultHandler: boolean`
  - [ ] Tests (4 przypadki): (a) type-specific handler wins over default; (b)
        default used for unregistered type; (c) throw gdy brak obu; (d) default
        runs through middleware pipeline + messageTimeout race

#### Phase 2: priorityOrder contract hardening (~1.5h)

- **Files**:
  - `packages/messaging/src/outbox/outbox-interfaces.ts` — `comparePriority`
    helper
  - `packages/messaging/src/outbox/outbox-repository.interface.ts` — JSDoc MUST
    clause
  - `packages/messaging/src/outbox/index.ts` — eksport `comparePriority`
  - `packages/messaging/LLMGUIDE.md` — fan-out recipe
- **Tasks**:
  - [ ] `comparePriority(a, b, order?)`: guard dla partial arrays —
        `const rankA = order.includes(a) ? order.indexOf(a) : order.length`
        (brakujące wartości → sortuj na końcu, nie na początku)
  - [ ] Eksport z `index.ts` — tylko `comparePriority`, NIE
        `MESSAGE_PRIORITY_RANK` (rangi jako liczby to implementation detail, nie
        publiczny kontrakt)
  - [ ] JSDoc na `getUnprocessedMessages`: MUST clause + ostrzeżenie przed
        `ORDER BY priority`
  - [ ] LLMGUIDE: fan-out recipe (jeden default handler dla N typów) + SQL
        `CASE` example + ostrzeżenie E1 (default handler usuwa implicit type
        allowlist) + ostrzeżenie LINDDUN (review ACL przy dodaniu nowego
        PII-carrying event type)
  - [ ] Tests: (a) canonical order: CRITICAL < HIGH < NORMAL < LOW; (b) custom
        order array; (c) partial order array — brakujące wartości sortują na
        KOŃCU (nie na początku); (d) pełna inwersja

## Risk Assessment

| Risk                                       | Probability | Impact | Mitigation                                              |
| ------------------------------------------ | ----------- | ------ | ------------------------------------------------------- |
| Default handler hides missing-handler bugs | Low         | Low    | Opt-in; absent default keeps throw; doc the trade-off   |
| Helper diverges from repo sort             | Low         | Med    | Single exported source of truth; reference impls use it |

## Testing Strategy

### Unit Tests

- [ ] Default handler resolution matrix (4 przypadki — patrz Phase 1)
- [ ] `comparePriority`: canonical, custom, partial (missing → last), full
      inversion
- [ ] `getStats()` zwraca `hasDefaultHandler: false` przed rejestracją, `true`
      po
- [ ] `registerDefaultHandler` idempotency: drugie wywołanie nadpisuje handler

### Integration Tests

- [ ] `OutboxProcessor` + `InMemoryOutboxRepository` + jeden default handler
      drenaż mieszanych typów

## Security Considerations

> Full threat model:
> [`docs/security/threat-models/TM-VP-008.md`](../../docs/security/threat-models/TM-VP-008.md)
> Method: STRIDE + DREAD + LINDDUN | Date: 2026-05-26

### HIGH — block merge if absent

| ID  | Finding                                                                                                               | Action                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| T1  | `comparePriority` with partial `order` array → silent priority inversion (missing values sort FIRST via indexOf = -1) | Guard: map missing values to `order.length` (sort last), add test  |
| E1  | Default handler removes implicit type allowlist — future unregistered types auto-dispatched                           | LLMGUIDE must warn explicitly; show `knownTypes` allowlist pattern |

### MEDIUM — address before v0.30.0 release

| ID      | Finding                                                                    | Action                                                                                                                                |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1      | Debug-only log for default dispatch — no operator visibility at INFO level | Consider WARN on first occurrence per unknown type                                                                                    |
| S1      | Default handler accepts any messageType from compromised storage           | Document opt-out of allowlist in LLMGUIDE; consumer guidance to validate type in handler                                              |
| D1      | Garbage-type flood now consumed by handler instead of failing fast         | LLMGUIDE recipe should include type-guard in default handler                                                                          |
| LINDDUN | New PII-carrying types auto-dispatched before PII handler added            | Kontrola dostępu na kolejkach + `eraseUserPayloads()` dla GDPR; LLMGUIDE: ostrzeżenie o review ACL przy dodaniu nowego PII-event type |

### Inherited from TM-VP-003 (still applicable)

- `getStats()` must NOT be auto-exposed via HTTP without authentication.
- Logger must NEVER include raw message payload.

---

## Links & References

### Related Tasks

- VP-003: Outbox production readiness (DONE) — this is its adoption follow-up
- Consumer: LocalHero `TS-DR-OUTBOX-002` (blocked_by VP-008 — adopts
  OutboxProcessor for fan-out)
- Consumer context: LocalHero `TS-DR-OUTBOX-001` (app-side race fix + priority
  bug, independent of VP-008)

### Code References

```yaml
packages:
  - package: '@vytches/ddd-messaging'
    files:
      - src/outbox/outbox-processor.ts # registerDefaultHandler, buildPipeline fallback, hasDefaultHandler w getStats
      - src/outbox/outbox-interfaces.ts # comparePriority (tylko, bez MESSAGE_PRIORITY_RANK)
      - src/outbox/outbox-repository.interface.ts # JSDoc MUST clause na getUnprocessedMessages
      - src/outbox/index.ts # eksport comparePriority
      - LLMGUIDE.md # fan-out recipe + allowlist warning + LINDDUN note
```

### Follow-up tasks

- **VP-004-outbox-security-medium-debt** (v0.31.0, nie urgentny): MEDIUM items z
  TM-VP-003 które nie trafiły do VP-003 ani VP-008:

  - Duplicate handler registration WARN (S2)
  - `onCrashRecovery` hook w OutboxProcessorHooks (R1)
  - LLMGUIDE GDPR Art.17 / erasePayloadById recipe (LINDDUN-N)
  - Document DB error message sanitization / [REDACTED_DSN] pattern (I2)

- **VP-009** (po consumer adoption signal z LocalHero TS-DR-OUTBOX-002):
  Kandydat: multi-worker concurrency hardening (`scheduleRetry` /
  `resetStaleProcessing` atomic update).

---

_Task created from consumer adoption analysis (LocalHero TS-DR-OUTBOX-001),
2026-05-25._
