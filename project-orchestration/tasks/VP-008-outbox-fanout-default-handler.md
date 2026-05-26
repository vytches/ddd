# Task: OutboxProcessor — catch-all/default handler + priority-order contract hardening

## Task Metadata

```yaml
task_id: VP-008
title: Catch-all/default handler in OutboxProcessor + priorityOrder contract guard
type: feature
priority: high
complexity: simple
estimated_time: 3h
created_by: agent (consumer analysis — LocalHero TS-DR-OUTBOX-001)
created_at: 2026-05-25
status: planned
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

VP-003 (done 2026-05-23) made `OutboxProcessor` production-ready: retry/backoff, crash
recovery, type filter, hooks, adaptive re-poll, jitter, `OutboxProcessorModule`. A real
consumer (LocalHero, `TS-DR-OUTBOX-001`) is now ready to **drop its hand-rolled poller and
adopt `OutboxProcessor`** — exactly the migration VP-003 anticipated.

Two friction points surfaced during that adoption that VP-003 did not cover:

1. **No catch-all handler.** `OutboxProcessor.registerHandler(messageType, handler)` is
   strictly per-type, and `buildPipeline()` throws `No handler registered for message type`
   when none matches (`outbox-processor.ts:352-354`). The consumer routes **~50 integration
   event types through one uniform fan-out** (outbox row → per-context BullMQ queue). Per-type
   registration would mean registering the identical handler 50×, and silently breaking the
   moment a new event type is added without a matching registration. This blocks adoption.

2. **`priorityOrder` contract is an easy trap.** The consumer's `KyselyOutboxRepository`
   ignored the `priorityOrder` arg and did `ORDER BY priority DESC` on a `text` column whose
   values are `'low'|'normal'|'high'|'critical'`. Postgres sorts that alphabetically →
   `critical` processed **last**. Latent until priorities are actually used, then it inverts
   intent. The reference `InMemoryOutboxRepository` does it correctly
   (`priorityOrder.indexOf(...)`), so the contract is "repo MUST honor the passed array" — but
   nothing enforces or signposts it.

### Expected Business Value

- [ ] Consumers with uniform dispatch (fan-out, single event bus) adopt `OutboxProcessor`
      without per-type boilerplate
- [ ] New message types are handled by default instead of throwing at runtime
- [ ] The priority-ordering trap is documented/guarded so other implementors don't repeat it

## Technical Context

### Current State

- `buildPipeline(message)` → `handlers.get(message.messageType)` → throw if absent.
- `priorityOrder` is passed to `repository.getUnprocessedMessages(limit, priorityOrder, types)`
  but honoring it is entirely the repo's responsibility, with no guard or prominent doc.

### Desired State

- Optional default handler invoked when no type-specific handler is registered.
- Explicit, well-documented `priorityOrder` contract; ideally a tiny exported helper so repos
  rank correctly instead of hand-rolling (and mis-rolling) the sort.

### Technical Constraints

- **Zero breaking changes.** Default handler is opt-in; absent default + unknown type keeps
  the current throw behavior.
- Stay runtime-agnostic (no Node-only APIs) — consistent with VP-003 decisions.

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `OutboxProcessor.registerDefaultHandler(handler: IOutboxMessageHandler): void`
- [ ] `buildPipeline()` resolves type-specific handler first, falls back to default handler if
      registered, throws only if neither exists (behavior unchanged when no default set)
- [ ] When the default handler is used for an unregistered type, log that `messageType` at
      `debug` — never silently swallow unknown types (preserves visibility for other consumers
      who use the default as a safety net, not an intentional catch-all)
- [ ] Default handler participates in the same middleware pipeline + `messageTimeout` race
- [ ] (Optional, recommended) export `MESSAGE_PRIORITY_RANK` map or
      `comparePriority(a, b, order?)` helper from `@vytches/ddd-messaging` so repositories rank
      by `priorityOrder` correctly instead of naive column sort
- [ ] JSDoc on `getUnprocessedMessages` (interface) states the ordering contract explicitly and
      warns against naive `ORDER BY priority` on string enums

### Non-Functional Requirements

- [ ] Backward compatible — all existing tests green, no new required params
- [ ] Testing: unit coverage for default-handler resolution + priority helper
- [ ] Documentation: LLMGUIDE.md fan-out recipe (one default handler for N event types)

### Definition of Done

- [ ] Implemented + reviewed
- [ ] Tests written and passing (>80% coverage on touched files)
- [ ] CHANGELOG + LLMGUIDE updated
- [ ] No breaking change to `OutboxProcessor` / `IOutboxRepository` public surface

## Implementation Plan

### Phase 1: Default handler (~1.5h)

- **Files**: `packages/messaging/src/outbox/outbox-processor.ts`
- **Tasks**:
  - [ ] Add `private defaultHandler?: IOutboxMessageHandler` + `registerDefaultHandler()`
  - [ ] In `buildPipeline()`: `const handler = this.handlers.get(type) ?? this.defaultHandler`;
        throw only if still undefined
  - [ ] Tests: type-specific wins over default; default used for unregistered type; throw when
        neither present; default runs through middleware + timeout
- **Output**: opt-in catch-all dispatch

### Phase 2: priorityOrder contract hardening (~1.5h)

- **Files**: `packages/messaging/src/outbox/outbox-interfaces.ts` (helper),
  `outbox-repository.interface.ts` (JSDoc), `packages/messaging/LLMGUIDE.md`
- **Tasks**:
  - [ ] Export `comparePriority` / `MESSAGE_PRIORITY_RANK` keyed by `MessagePriority`
  - [ ] Strengthen `getUnprocessedMessages` JSDoc: "MUST order by the supplied `priorityOrder`;
        do NOT `ORDER BY priority` directly — string enum values sort alphabetically"
  - [ ] LLMGUIDE: fan-out recipe + SQL `CASE` example honoring `priorityOrder`
  - [ ] Tests: helper ranks CRITICAL<HIGH<NORMAL<LOW; respects custom order arrays

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
| ---- | ----------- | ------ | ---------- |
| Default handler hides missing-handler bugs | Low | Low | Opt-in; absent default keeps throw; doc the trade-off |
| Helper diverges from repo sort | Low | Med | Single exported source of truth; reference impls use it |

## Testing Strategy

### Unit Tests

- [ ] Default handler resolution matrix (4 cases above)
- [ ] `comparePriority` ordering + custom `priorityOrder`

### Integration Tests

- [ ] `OutboxProcessor` + `InMemoryOutboxRepository` + one default handler drains mixed types

## Links & References

### Related Tasks

- VP-003: Outbox production readiness (DONE) — this is its adoption follow-up
- Consumer: LocalHero `TS-DR-OUTBOX-002` (blocked_by VP-008 — adopts OutboxProcessor for fan-out)
- Consumer context: LocalHero `TS-DR-OUTBOX-001` (app-side race fix + priority bug, independent of VP-008)

### Code References

```yaml
packages:
  - package: '@vytches/ddd-messaging'
    files:
      - src/outbox/outbox-processor.ts        # registerDefaultHandler + buildPipeline fallback
      - src/outbox/outbox-interfaces.ts        # comparePriority / MESSAGE_PRIORITY_RANK
      - src/outbox/outbox-repository.interface.ts  # JSDoc contract
      - LLMGUIDE.md                            # fan-out recipe
```

---

_Task created from consumer adoption analysis (LocalHero TS-DR-OUTBOX-001), 2026-05-25._
