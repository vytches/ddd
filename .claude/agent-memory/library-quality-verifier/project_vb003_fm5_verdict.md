---
name: project_vb003_fm5_verdict
description:
  VB-003 "F-M5 duplicate-registration guard + configureContext() (D-3)" unit —
  verification history
metadata:
  type: project
---

Task VB-003-nestjs-forfeature-di-wiring, unit "F-M5 duplicate-registration guard

- configureContext() (D-3)".

**Pass 1 (2026-07-03): GO.** New `BusRegistrationLedger`
(`packages/nestjs/src/services/bus-registration-ledger.ts`, NOT exported from
`src/index.ts` — correctly kept internal) implements per-bus (via
`WeakMap<bus, ...>` identity scoping, an equivalent-but-cleaner approach than an
explicit busId string) command/query dedup+conflict-throw and event fan-out-safe
dedup, matching D-3 exactly.
`VytchesExplorerService.configureContext(options: VytchesContextOptions): void`
(`packages/nestjs/src/services/vytches-explorer.service.ts:200`) is a real,
fully-typed new public method (additive to an already-exported class — non-
breaking). `vytches-ddd.module.ts` `forContext()`/`forContexts()` both now call
`explorer.configureContext(...)` instead of the old
`(explorer as unknown as {contextConfig: unknown}).contextConfig = ...` unsafe
private-field cast, making `strictHandlerRegistration` actually reachable as D-3
required.

Tests are real/meaningful, not structural:
`tests/bus-registration-ledger.test.ts` unit-tests the ledger in isolation
(idempotent skip, conflict-throw, bus-identity scoping, event fan-out never
conflicts); `tests/services/vytches-explorer-shared-bus.test.ts` constructs TWO
real `VytchesExplorerService` instances sharing the same bus object (simulating
the real `forRoot()`+`forContext()` bug scenario) and exercises the actual
`registerHandler()` -> `registerHandlersWithBuses()` code path end-to-end,
including asserting `strictHandlerRegistration: true` surfaces the conflict
throw while the default (false) preserves old swallow-and-skip behavior.

Ran `pnpm nx test @vytches/ddd-nestjs --skip-nx-cache`: 23 files / 215 tests,
all green, including these new files and the pre-existing
`context-aware-integration.test.ts`/`architecture-validation.test.ts` callers of
`getContextConfiguration()`.

**Noted but not blocking**: `getContextConfiguration()`'s returned object SHAPE
changed (previously spread the entire outer `VytchesDDDModuleOptions` passed to
`forContext()`/`forContexts()`, including a self-conflicting duplicate `context`
key when `options.context` was also set; now returns only
`{ context, name, ...contextOptions }` from the narrower `VytchesContextOptions`
sub-object) — a behavioral change with no type-signature change (return type
stays `Record<string, unknown> | null`). Confirmed harmless: all existing test
call sites only assert `.context`, which is preserved, and the method is
explicitly labeled "Legacy compatibility" in a code comment. Zero external
consumers per this package's pre-first-publish status (see
[[project_vt_coverage_series]] / general publish-deferred context).

Carry-over context (already GO'd by other units/passes, not re-verified here per
task scope): D-1/F-C4 fix + `@Inject(ModuleRef)`/`@Inject(ModulesContainer)`,
D-2 forRootAsync removal, D-4/D-5/D-7 dead-field/dead-file cleanup, D-6/F-M19
barrel import, D-8a/b/c test-plan items, OQ-9 warn branch — see
[[project_vb003_fc4_verdict]] for that history.
