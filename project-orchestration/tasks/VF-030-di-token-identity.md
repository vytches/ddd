# Task: DI token identity — named-class collision in SimpleContainer, adapter lifetime correctness

## Task Metadata

```yaml
task_id: VF-030
title:
  'di/nestjs: SimpleContainer keys named-class tokens by fn.name (cross-context
  instance collision — same bug class ADR-0034 fixed in CommandBus), 3 divergent
  getTokenKey copies, NestJSContainerAdapter silently degrades Scoped to
  Transient and throws raw Error'
type: bug
priority: high
complexity: medium
estimated_time: 6h
created_by: LIB-UX-AUDIT-2026-07-10
created_at: 2026-07-10
status: backlog
release_target:
  pre-first-publish preferred (silent cross-context instance leakage; key-shape
  change is cheapest before publish)
package: "'@vytches/ddd-di', '@vytches/ddd-nestjs'"
findings: [UX-C4, UX-C5, UX-T2.1]
```

## Why

1. **UX-C4 (HIGH):** `SimpleContainer.getTokenKey()`
   (`packages/di/src/containers/simple-container.ts:355-390`) assigns
   collision-safe keys only to **anonymous** function tokens (VP-006 fix); for
   **named** classes it still uses `fn.name`. Two unrelated classes named e.g.
   `UserRepository` in two bounded contexts collide: registration throws
   `ServiceAlreadyRegisteredError` at best — or `resolve(WrongClassSameName)`
   **silently returns the other context's instance**. This is the exact bug
   class ADR-0034 documents as having caused production data corruption in
   `CommandBus` (string-keyed-by-name handler map → cross-context routing → NULL
   overwrites); the fix (`Map` keyed by constructor identity,
   `command-bus.ts:119-121`) was never propagated down into the container.
2. **UX-T2.1:** `getTokenKey` exists as **three divergent copies** —
   `SimpleContainer` (anonymous-token fix present),
   `BaseContainerAdapter.getTokenKey` (`adapters/base-adapter.ts:75-83`,
   unfixed) and `NestJSContainerAdapter.getTokenKey`
   (`packages/nestjs/src/adapters/nestjs-container.adapter.ts:33-41`, unfixed).
   "Fixed in one place, broken in two others" drift.
3. **UX-C5 (HIGH):** `NestJSContainerAdapter.resolve()` checks only
   `lifetime === 'singleton'` against its cache
   (`nestjs-container.adapter.ts:76`) — `ServiceLifetime.Scoped` is **silently
   treated as Transient**. Same public enum, different runtime behavior
   depending on which container you're handed; no test catches it. The adapter
   also throws raw `new Error(...)` (`:72,89`) instead of
   `ServiceNotFoundError`/`InvalidRegistrationError` from the DI error hierarchy
   — consumers catching typed errors miss adapter failures.

## Acceptance Criteria

1. [ ] **UX-C4:** `SimpleContainer` keys function/class tokens by **reference
       identity** (constructor object as `Map` key), string/symbol tokens by
       value — mirroring the ADR-0034 CommandBus fix. Test: two same-named
       classes registered from two contexts register and resolve independently;
       resolving one never returns the other's instance.
2. [ ] **UX-T2.1:** one canonical token-key/normalization utility (with the
       anonymous-token fix) shared by `SimpleContainer`, `BaseContainerAdapter`
       and `NestJSContainerAdapter` — the two unfixed copies are deleted.
3. [ ] **UX-C5 (lifetime):** `Scoped` in `NestJSContainerAdapter` either gets a
       real scoped-instance cache (parity with `SimpleContainer`) or requesting
       it throws `InvalidRegistrationError` — never silent Transient. Test
       asserting lifetime parity (or explicit rejection) between both
       containers.
4. [ ] **UX-C5 (errors):** adapter failures routed through the `DIError`
       hierarchy — mind VF-024's `ServiceNotFoundError` rename (AC2) landing in
       the same window; coordinate the final class name.
5. [ ] Silent `new paramType()` fallback in `createInstance()`
       (`nestjs-container.adapter.ts:247-249`) surfaces the resolution failure
       instead of constructing a zero-arg instance — coordinate with VP-006b
       (same lines are being rewritten for hot-path perf; implement once, not
       twice).
6. [ ] BC note in CHANGELOG: string-token behavior unchanged; class-token
       key-shape change documented (internal `Map` key, no public signature
       change).

## Out of scope

- ServiceLocator re-`configure()` overwrite semantics and registry
  duplicate-registration policy (SA-H4/SA-M10/SA-L4) — deliberately deferred to
  an `/analyze-ddd` design decision per SEC-AUDIT-2026-07-09; **this task is
  key-derivation correctness, not overwrite policy**.
- Hot-path performance of `resolve()`/reflection caching — VP-006b (coordinate
  on AC5 only).
- Cross-scope circular-dependency detection gap (child→parent chain reset) —
  LOW, note in code, revisit if a real cycle report ever appears.

## References

- Analysis: `project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`
  (UX-C4, UX-C5, theme T2)
- `docs/adr/0034-per-context-cqrs-bus-isolation.md` — production precedent for
  the identical bug class, one layer up.
- VP-006b (adapter hot path), VF-024 (error-name collision) — coordination
  points.
