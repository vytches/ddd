---
'@vytches/ddd-events': patch
'@vytches/ddd-resilience': patch
'@vytches/ddd-projections': minor
'@vytches/ddd-cqrs': minor
'@vytches/ddd': minor
---

fix(events,resilience): diagnostics-only hardening; feat(projections,cqrs):
checkpoint resume and typed command registration (VF-025)

**`@vytches/ddd-events`:**

- `UnifiedEventBus` now logs an `internalLogger.warn` when the exact same
  handler reference is registered with the exact same `contexts` for the same
  event name more than once. This is visibility only — the duplicate
  registration is still added (not deduplicated), so dispatch-time invocation
  counts are unchanged.
- `getHandlers()`'s doc comment now spells out that its return type (`Set`)
  collapses same-reference duplicates, so its size can be smaller than the
  actual number of invocations per matching event — it was already true before
  this release, just undocumented.
- The previously-empty `catch` around DI auto-registration of discovered
  handlers now logs via `internalLogger.warn` instead of swallowing silently. It
  still never rethrows — a broken DI setup does not prevent bus construction.

No public API changes. Purely diagnostic; existing behavior is unchanged.

**`@vytches/ddd-resilience`:**

- Fixed `CircuitBreaker`'s `HALF_OPEN` handling: `failureCount` is now reset to
  `0` when the circuit transitions `OPEN` → `HALF_OPEN`, and — together with
  that reset, as one inseparable fix — any failure while `HALF_OPEN` now
  immediately re-trips the circuit back to `OPEN`, regardless of `failureCount`.
  Previously `failureCount` was never reset on entering `HALF_OPEN`, so a single
  failed probe happened to re-trip only because the stale counter from the prior
  trip already sat at or above `failureThreshold`. Resetting the counter without
  also adding the immediate-trip rule would have been a resilience regression
  (it would take `failureThreshold` more failures to re-trip instead of just
  one) — the two changes ship together for that reason.
- Known accepted trade-off, not a bug: with `halfOpenMaxProbes > 1`, a
  concurrent probe that fails (re-tripping to `OPEN`) can race a different probe
  that succeeds at nearly the same moment; the success branch still zeroes
  `failureCount`. This only transiently skews `getMetrics().failureCount` —
  state transitions are driven solely by `nextAttemptTime` /
  `shouldAttemptReset()`, so `OPEN`/`HALF_OPEN`/`CLOSED` transitions themselves
  are unaffected.

No public API changes — constructor and method signatures are unchanged. This is
a correctness fix: circuits that reach `HALF_OPEN` are now measurably more
resilient to a flapping dependency than before.

**`@vytches/ddd-projections`:**

- `IProjectionRebuildConfig` (re-exported from the package root) gains a new
  optional field: `resumeFromCheckpoint?: boolean` (default `false`). When
  `true`, `ProjectionRebuilder.rebuild()` resumes replay from the projection's
  last persisted checkpoint (via a registered `CheckpointCapability`) instead of
  replaying from the beginning, seeding the projection store with the
  checkpoint's state first.
- `CheckpointCapability` gains a new public method:
  `clearCheckpoint(): Promise<void>`, which deletes the persisted checkpoint for
  the projection. `ProjectionRebuilder.clearProjectionState()` now calls it
  automatically when the projection has checkpoint capability, so a manual clear
  also resets any checkpoint instead of leaving it pointing past the now-cleared
  read model.
- Resume is refused (falling back to a full rebuild) when there is no
  checkpoint, or when the checkpoint's `position` is not a positive safe integer
  (`Number.isSafeInteger`). On refusal, `ProjectionRebuilder` logs exactly this
  message via `internalLogger.warn` (grep for it):

  ```
  ProjectionRebuilder: resumeFromCheckpoint rejected for "<projectionName>" - <reason>. Falling back to full rebuild.
  ```

  where `<reason>` is one of `no checkpoint found` or
  `checkpoint position must be a positive safe integer`.

  **Before enabling `resumeFromCheckpoint`, your projection's `apply()` (or
  equivalent event-handling method) must be idempotent.** Resume seeds the
  projection store from the checkpoint's saved state and then replays only
  events from the checkpoint's position onward — but if your checkpoint interval
  and your replay's position resolution ever disagree (e.g. a checkpoint saved
  without a numeric `event.metadata.position`, which persists as position `0`),
  events already reflected in the checkpointed state could be re-applied. An
  idempotent `apply()` makes that re-application safe; a non-idempotent one can
  silently double-count.

  ```ts
  // Before: always full rebuild from the beginning
  await rebuilder.rebuild(filter, { clearBeforeReplay: true });

  // After: resume from the last checkpoint when one exists and is valid
  // (requires idempotent apply() on the projection engine)
  await rebuilder.rebuild(filter, { resumeFromCheckpoint: true });
  ```

  This is purely additive and opt-in — omitting the field preserves today's
  always-full-rebuild behavior exactly.

**`@vytches/ddd-cqrs`:**

- `EnhancedCommandBus` gains two new public methods,
  `registerTyped<T extends ICommand, TResult = void>(commandType: CommandConstructor<T> | string, handler: ICommandHandler<T, TResult>): void`
  and
  `registerFactoryTyped<T extends ICommand, TResult = void>(commandType: CommandConstructor<T> | string, factory: () => ICommandHandler<T, TResult>): void`.
  Both delegate to the existing `register()` / `registerFactory()` — runtime
  behavior is identical — but constrain `commandType` to a constructor of `T`
  (or a string key), so a handler whose generic parameter doesn't match the
  command class is rejected at the call site instead of compiling silently.

  `register()` / `registerFactory()` are unchanged (`commandType: unknown`) and
  remain the right choice for dynamic/plugin registration paths that only have a
  runtime string key, with no command class available at the call site. Prefer
  the `*Typed` variants everywhere else for compile-time safety.

  ```ts
  // Before: commandType is `unknown` — a mismatched handler compiles
  commandBus.register(CreateOrderCommand, new CreateOrderHandler());

  // After: same runtime behavior, mismatches are now a compile error
  commandBus.registerTyped(CreateOrderCommand, new CreateOrderHandler());
  ```

- `register()` / `registerFactory()` now log an `internalLogger.warn` when a
  command key already has a registration (under either kind — an instance being
  replaced by a factory, or vice versa, also warns). This is diagnostics only:
  the overwrite still happens, last-write-wins is unchanged. A consumer with log
  monitoring may see new warning entries after upgrading if their code
  re-registers the same command key more than once.

**`@vytches/ddd`:**

Re-exports `IProjectionRebuildConfig` (via `@vytches/ddd-projections`) and
`EnhancedCommandBus` (via `@vytches/ddd-cqrs`) unchanged from their source
packages, so the new field, the new `CheckpointCapability` method, and the new
`registerTyped()` / `registerFactoryTyped()` methods are all available through
this package's existing re-exports without any change to
`packages/enterprise/src/index.ts`.
