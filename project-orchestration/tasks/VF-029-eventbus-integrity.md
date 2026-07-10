# Task: EventBus integrity — split registries, fan-out abort, shipped DI stub

## Task Metadata

```yaml
task_id: VF-029
title:
  'events: UnifiedEventBus split handler registries (silently dead registration
  path), BaseEventBus sync-handler throw aborts fan-out, DI stub shipped with
  useDI:true default, toString-based unsubscribe, publishMany ordering'
type: bug
priority: high
complexity: medium
estimated_time: 10h
created_by: LIB-UX-AUDIT-2026-07-10
created_at: 2026-07-10
status: review
release_target:
  pre-first-publish preferred (silent-wrong-behavior class; deletions cheaper
  before publish — coordinate with VF-031)
package: '@vytches/ddd-events'
findings: [UX-C1, UX-C2, UX-C3, UX-C8, UX-C9, UX-C10]
```

## Why

Five defects in the event bus family that produce **silently wrong behavior** —
no error, no log, just handlers that never fire or fire partially:

1. **UX-C1 (HIGH):** `UnifiedEventBus` overrides
   `publish/subscribe/registerHandler/unsubscribe/publishMany` to use its own
   `handlerRegistry` (`unified-event-bus.ts:109`), but inherits
   `registerHandlerFactory`, `getHandlers`, `getRegisteredEventTypes`,
   `clearHandlers` unchanged from `BaseEventBus` — they operate on
   `this.handlers` (`base-event-bus.ts:83`), a map `publish()` **never reads**.
   A handler registered via `registerHandlerFactory` on the recommended bus
   silently never fires; `getHandlers()`/`clearHandlers()` report/act on the
   wrong store. Only tested against a raw `BaseEventBus` subclass
   (`tests/base-event-bus-di.test.ts:52-71`), never `UnifiedEventBus`.
2. **UX-C3 (HIGH):** `base-event-bus.ts:10-21` ships a hardcoded DI stub
   (`VytchesDDD.resolve = () => null`, comment "Temporarily disabled for
   testing") while `useDI = true` **by default** — `registerHandlerFactory`'s
   wrapper calls `.handle()` on `null` → guaranteed `TypeError`. Refactor
   scaffolding shipped as the default path of a library entry point.
3. **UX-C2 (HIGH):** a synchronous handler throw inside `BaseEventBus`'s fan-out
   loop (`base-event-bus.ts:164-193`) hits `handleError`, whose default
   re-throws (`:288-295`) — every handler registered after the failing one is
   never invoked. `UnifiedEventBus.executeHandlers` (`:423-465`) behaves
   differently (runs all, per-handler try/catch) — an undocumented behavioral
   divergence between the two buses.
4. **UX-C8 (MEDIUM):** `UnifiedEventBus.unsubscribe`
   (`unified-event-bus.ts:307-340`) matches class-based handlers by
   `entry.handler.toString().includes('handler.handle(event)')` — every
   class-handler wrapper is textually identical, so with two class handlers on
   one event it can remove the **wrong** one.
5. **UX-C10 (MEDIUM):** `publishMany` (`base-event-bus.ts:122-136`,
   `unified-event-bus.ts:345-350`) fires all events via `Promise.all` — no
   cross-event ordering for a single aggregate's batch (`OrderCreated` /
   `ItemAdded` handlers interleave). Silent projection-corruption trap,
   documented nowhere.
6. **UX-C9 (MEDIUM, verify):** `registerHandlerWithContext`
   (`unified-event-bus.ts:383-391`) bypasses `MAX_HANDLERS_PER_EVENT` entirely —
   VF-025 plans "handler cap enforcement"; verify its AC covers this exact
   bypass path, otherwise fix here.

## Acceptance Criteria

1. [x] **UX-C1:** no silently dead registration path on `UnifiedEventBus` —
       either `registerHandlerFactory`/`getHandlers`/`getRegisteredEventTypes`/
       `clearHandlers` are overridden to operate on `handlerRegistry`, or the
       inherited members are removed from the public surface (coordinate with
       VF-031: if `registerHandlerFactory`+`useDI` machinery is deleted as
       zero-consumer surface, C1 and C3 resolve by removal — record the decision
       either way).
2. [x] **UX-C3:** the DI stub is gone — real `@vytches/ddd-di` wiring, or
       `useDI` default flipped to `false` + machinery deleted/`@internal`. No
       "temporarily disabled" scaffolding reachable from public API.
3. [x] **UX-C2:** ONE documented error semantics for handler failures across
       both buses (recommended: run all handlers, aggregate errors, matching
       `UnifiedEventBus.executeHandlers`); `BaseEventBus` no longer aborts
       fan-out mid-loop by default. Test: 3 sync handlers, middle one throws →
       third still runs, error surfaced.
4. [x] **UX-C8:** `unsubscribe` removes exactly the requested handler — identity
       mapping (e.g. `WeakMap<handler, wrapper>`) instead of `toString()`
       matching. Test: two class handlers on one event, unsubscribe B → A still
       fires.
5. [x] **UX-C9:** cap-bypass verified against VF-025's AC; if uncovered, cap
       enforced in `registerHandlerWithContext` here (cross-reference the
       outcome in both task files).
6. [x] **UX-C10:** `publishMany` ordering semantics decided and documented —
       either an opt-in sequential mode or an explicit "no cross-event ordering
       guarantee" warning in JSDoc + LLMGUIDE; decision recorded.
7. [x] Regression: full events test suite green; new tests for AC1-AC4 run
       against `UnifiedEventBus` (not only `BaseEventBus`).

## Out of scope

- Handler cap/dedup/aggregated-errors work already scoped in VF-025 (this task
  only verifies the bypass, AC5).
- Deletion decisions for the dead `audit/`/`integration/` subsystems — VF-031.
- events↔messaging connector example — docs work (VD-005/examples track).

## Activity / Notes

### 2026-07-10 — implemented on `feature/VF-029-eventbus-integrity` (status: review)

**Decision (UX-C1 + UX-C3): DI machinery DELETED.** The hardcoded `VytchesDDD`
stub (`base-event-bus.ts:10-21`), the `useDI` constructor option, the no-op
`discoverHandlers()`, and `registerHandlerFactory()` were removed from
`BaseEventBus` — zero real consumers existed (only self-tests in
`tests/base-event-bus-di.test.ts`, which were replaced by a proper
`tests/base-event-bus.test.ts` suite). C1 and C3 resolve by removal. BREAKING
CHANGE (pre-first-publish, so cheap). Cross-note for VF-031: this pre-executes
part of its events-surface scope (the `useDI`/factory machinery);
`audit/`/`integration/` subsystems and decorator discovery were NOT touched.

**Surviving inspection API:** `getHandlers` / `getRegisteredEventTypes` /
`clearHandlers` stay and are now overridden in `UnifiedEventBus` to operate on
its `handlerRegistry` (the store `publish()` actually reads). `getHandlers` on
`UnifiedEventBus` returns a snapshot `Set` of registered handler functions
(class handlers appear as their wrappers); `clearHandlers` also clears the
class-handler identity map.

**UX-C2:** one documented error semantics across both buses — run ALL handlers,
collect sync throws + async rejections, then surface: routed to
`options.onError` when configured (publish resolves), otherwise thrown as a new
`AggregatedEventHandlerError` (public export) carrying all failures.
`BaseEventBus` no longer aborts fan-out mid-loop; `UnifiedEventBus` no longer
throws only `errors[0]` and no longer throws when `onError` is configured (two
existing tests updated accordingly).

**UX-C8:** `unsubscribe` uses an identity map (handler → eventName → wrapper)
instead of `toString()` matching; empty registry keys are cleaned up.

**UX-C9:** VF-025 not yet implemented, so the cap is enforced HERE:
`registerHandlerWithContext` (single funnel for all UnifiedEventBus registration
paths) now calls `assertHandlerCapacity`, which resolves the static via
`(this.constructor as typeof BaseEventBus).MAX_HANDLERS_PER_EVENT` so subclass
overrides work as documented (static widened to `number`). Cross-noted in
VF-025.

**UX-C10:** `Promise.all` stays the default;
`publishMany(events, { sequential?: boolean })` added (non-breaking optional
param, exported `PublishManyOptions` type) with an explicit JSDoc + LLMGUIDE
warning that the default gives no cross-event ordering.
`UnifiedEventBus.publishMany` override removed (inherits the base
implementation, which dispatches polymorphically through `this.publish`).

**Verification:** events test+type-check+lint green (120 tests), nestjs
test+type-check green, enterprise test green; events api-surface snapshot
updated for the new `AggregatedEventHandlerError` export.

## References

- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (UX-C1, UX-C2, UX-C3, UX-C8, UX-C9, UX-C10; theme T1 for the deletion
  interplay)
- VF-025 (event/projections hardening) — sibling task, cap enforcement overlap
  on AC5.
