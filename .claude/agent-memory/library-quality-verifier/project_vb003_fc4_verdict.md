---
name: project_vb003_fc4_verdict
description:
  VB-003 "F-C4 critical fix + regression test suite" unit — verification history
  and current blocker
metadata:
  type: project
---

Task VB-003-nestjs-forfeature-di-wiring, unit "F-C4 critical fix + regression
test suite (D-1, D-8, OQ-6)".

**Pass 1 (2026-07-02): NO-GO.** D-1, D-8a, D-8b implemented correctly. D-8c (new
e2e file `packages/nestjs/tests/feature/feature-di-wiring.e2e.test.ts`) was
referenced in a comment but the file did not exist anywhere in the repo.

**Pass 2 (2026-07-03): NO-GO — different, more serious reason.** D-8c file now
exists and is well-constructed (covers all 4 required assertions: local-bus
registration, event delivery, ModulesContainer identity/size probe,
dispose-on-close spies). D-1's code diff in
`packages/nestjs/src/feature/vytches-ddd-feature.module.ts` matches the analysis
exactly (bare `ModulesContainer` removed from `providers`, clear "do not re-add"
comment, no stray provider-array occurrences remain elsewhere in
`packages/nestjs/src`).

BUT: running `pnpm nx test @vytches/ddd-nestjs`
(`pnpm vitest run packages/nestjs/tests --reporter=verbose`) shows the fix does
NOT work at runtime. `FeatureHandlerRegistrar.findOwnModule()`
(`packages/nestjs/src/feature/feature-handler-registrar.ts:111`,
`this.modulesContainer.entries()`) throws
`TypeError: Cannot read properties of undefined (reading 'entries')` —
`this.modulesContainer` resolves to `undefined`, not the real global singleton.
This is a strictly worse failure mode than the original F-C4 bug (which at least
resolved to an empty _shadow_ container rather than nothing). 3 tests fail as a
direct result: both CT-3 tests in `global-bus-acl.test.ts` (only failing now
because D-8b correctly added the missing `app.init()` call — the bug was
previously dormant/masked by the tests never exercising `onModuleInit()`), and
the new D-8c e2e test itself.

Root-cause hypothesis (not fully proven, but consistent with the analysis
artifact's own D-6/F-M19 warning): `feature-handler-registrar.ts` still imports
`ModulesContainer` from the deep path
`@nestjs/core/injector/modules-container.js` (unchanged — D-6/F-M19 is a
separate, not-yet-applied unit). NestJS's constructor DI for an undecorated
typed param relies on `design:paramtypes` reflection matching the exact class
reference. In this repo's Vitest/ESM setup — which per the analysis "has TWICE
regressed on ESM/vite-node resolution in this exact area" (CHANGELOG 0.29.1/
0.29.2) — the deep-imported class reference apparently does not identity-match
whatever class reference NestJS's `InternalCoreModule` registers the global
`ModulesContainer` singleton under, so type-based lookup silently yields
`undefined` instead of throwing an unresolved-dependency error or matching.

**Why this matters for future reviews of this task**: do NOT treat "D-1's diff
matches the analysis text" as sufficient — the analysis's own D-1 claim ("No
additional import needed") is empirically false in this codebase as currently
structured, unless/until D-6/F-M19 (switching to the `@nestjs/core` public
barrel import in `feature-handler-registrar.ts`) lands too. **Always run the
actual test command and read full output before approving this unit** — a diff
that looks textually correct against the analysis can still be runtime-broken.
Re-verify by re-running `pnpm nx test @vytches/ddd-nestjs` after any future
attempt; do not just re-read the diff.

**How to apply**: next pass, check whether D-6/F-M19's deep-import removal has
been bundled in alongside D-1 (even though the task's stated scope is
D-1/D-8/OQ-6 only) — it may be a practical prerequisite for D-1 to actually
function, despite being nominally a separate finding ID. If D-6 still isn't
applied, the F-C4 fix unit cannot pass on its own merits regardless of how the
providers array reads.

**Pass 3 (2026-07-03): NO-GO — root cause now proven, not just hypothesized.**
D-6/F-M19 WAS bundled in this pass: `feature-handler-registrar.ts` now imports
`import { ModuleRef, ModulesContainer } from '@nestjs/core'` (public barrel,
matches D-6). Confirmed via direct Node ESM check that `@nestjs/core`'s barrel
DOES export `ModulesContainer` correctly
(`typeof m.ModulesContainer === 'function'`), and a standalone Vitest repro
proved barrel vs. deep-import (`@nestjs/core/injector/modules-container.js`)
yield the _same_ class reference under this repo's Vitest/SWC config — so the
pass-2 "ESM identity mismatch" hypothesis was WRONG. Test still fails
identically: `FeatureHandlerRegistrar.findOwnModule()` line ~109,
`this.modulesContainer.entries()` —
`TypeError: Cannot read properties of undefined (reading 'entries')`. Same 3
tests fail (2x CT-3 in `global-bus-acl.test.ts`, 1x new D-8c e2e test).

**Actual proven root cause** (isolated via minimal repro files under
`packages/nestjs/tests/__zzz-repro*.test.ts`, deleted after use — reproduce by
creating a throwaway
`@Injectable() class Probe { constructor(private readonly modulesContainer: ModulesContainer) {} }`
and checking `Reflect.getMetadata('design:paramtypes', Probe)`): in this
package's Vitest + `unplugin-swc` setup (`packages/nestjs/vite.config.mts`, SWC
replaces esbuild specifically for `emitDecoratorMetadata` support), **implicit
type-based constructor injection (no explicit `@Inject()` token) does NOT
reliably produce usable `design:paramtypes` reflection metadata for
`ModuleRef`/`ModulesContainer`-typed params** — `Reflect.getMetadata` returned
`undefined` for a plain repro class in this environment, causing NestJS's DI to
silently resolve the param to `undefined` instead of throwing. Adding explicit
`@Inject(ModulesContainer)` (and `@Inject(ModuleRef)`) to the SAME repro made
both resolve correctly (`app.get(Probe)` returned real instances) — proven fix,
not just hypothesis.

**Concrete, minimal, verified fix for the next pass**: in
`packages/nestjs/src/feature/feature-handler-registrar.ts` constructor, add
`@Inject(ModuleRef)` and `@Inject(ModulesContainer)` decorators ahead of those
two params (mirroring the existing `@Inject(ICommandBus)` etc. style already
used in the same constructor for the other params) — `Inject` is already
imported in that file. This is a small, targeted, low-risk change; do not
suggest a bigger architectural rework. Re-run
`pnpm vitest run packages/nestjs/tests --reporter=verbose` afterward and confirm
all 3 previously-failing tests pass with zero regressions elsewhere.

**Process note**: when a repro is needed to settle a "the diff matches the
analysis but the test still fails" situation, write throwaway files under
`packages/nestjs/tests/__zzz-*.test.ts`, run them, then `rm` them immediately
and re-run `git status --porcelain -- packages/nestjs` to confirm the tree is
clean before returning the verdict — do not leave repro artifacts in the repo.

Unrelated noise observed in the same test run, not to be held against this unit:
`performance-benchmarks.test.ts` failed on a memory-threshold GC-noise assertion
(`expected 1153096 to be less than 1142904`) — pre-existing flakiness, unrelated
to `packages/nestjs/src/feature/*`.

**Pass 4 (2026-07-03): GO.** The proven minimal fix from pass 3 was applied
verbatim: `@Inject(ModuleRef)` / `@Inject(ModulesContainer)` added ahead of
those two constructor params in `feature-handler-registrar.ts` (plus a bonus
`@Inject(VytchesExplorerService)` on the existing `@Optional()` param, same
root-cause class, harmless/defensive). D-6/F-M19's public barrel import
(`import { ModuleRef, ModulesContainer } from '@nestjs/core'`) remains bundled
in from pass 3. Ran `pnpm vitest run packages/nestjs/tests --reporter=verbose`:
22 files / 211 tests ALL PASS, including both CT-3 tests in
`global-bus-acl.test.ts` and the new D-8c e2e test
(`feature-di-wiring.e2e.test.ts`). Confirmed
`grep -rn "ModulesContainer" packages/nestjs/src` shows only the barrel import,
the one `@Inject()` constructor decoration, and comments — no stray `providers:`
array entries (D-8d satisfied). Tree clean, no repro artifacts left behind.

Note: OQ-9 (defensive `internalLogger.warn` when `findOwnModule()` Step 2's
`imports` is not a `Set`) was NOT added in this diff — confirmed by reading
`feature-handler-registrar.ts` lines ~122-131, still silently `return undefined`
via the loop falling through. This is correctly out of THIS unit's stated scope
(D-1/D-8/OQ-6 only; OQ-9 is bundled with the separate F-M19 unit per the
analysis), so it did not block the GO verdict, but flag it for whichever pass
verifies the F-M19/D-6/OQ-9 unit next — it may not actually be applied yet
despite D-6's import-path change already having landed.

## Unit: "forRootAsync removal, deprecated field cleanup, AutoDiscoveryService

removal, F-M19 fix (D-2, D-4, D-5, D-6, D-7, OQ-9, D-8d)" — Pass 1 (2026-07-03):
NO-GO

Confirmed prediction from pass 4 above: OQ-9 was indeed still missing when this
unit was checked. Of the 7 named decisions, only 3 implemented:

- D-2 (remove `VytchesDDDModule.forRootAsync()`): DONE, clean removal, verified
  zero dangling call sites/refs (the _other_ `forRootAsync` still in the repo,
  on `OutboxProcessorModule`, is an unrelated static method — not in scope).
- D-6 (F-M19 deep import -> `@nestjs/core` public barrel): DONE in both
  `feature-handler-registrar.ts` and `vytches-ddd-feature.module.ts`.
- D-8d (grep repo for stray bare `ModulesContainer` in a `providers:` array):
  DONE/clean — only import statements + comments remain.

NOT implemented (zero diff, verified by direct read of current file state):

- D-4: `contexts` field in `packages/nestjs/src/types.ts` (~line 139) still
  carries the `@deprecated` JSDoc tag.
- D-5: all 6 dead `VytchesDDDModuleOptions` fields (`bridgeToNestJS`,
  `performance`, `handlers`, `monitoring`, `globalBridgeToNestJS`,
  `enableContexts`) still present verbatim in `types.ts`.
- D-7: `packages/nestjs/src/discovery/auto-discovery.service.ts`,
  `discovery/index.ts`, and `tests/auto-discovery-perf.test.ts` all still exist;
  their tests still run and pass as part of the green 211-test suite (dead code
  untouched — a fully green test run does NOT mean this decision landed, since
  nothing asserts the absence of removed code).
- OQ-9: `findOwnModule()` Step 2 (lines ~122-131) has no `internalLogger.warn`
  branch for the `imports instanceof Set === false` case — confirms pass 4's
  flag was correct, it is genuinely still missing.

D-8a/D-8b/D-8c test-plan items (from the _other_ unit) were also present and
correct in this same diff/tree state — pure carry-over, not re-verified fresh
here beyond confirming they still pass (211/211 green via
`pnpm nx test @vytches/ddd-nestjs`).

Lesson reinforced: a green test suite is NOT evidence that "removal" decisions
(D-4/D-5/D-7 style: delete dead fields/files) landed — there's no test that
fails when dead code is merely left in place. Must positively re-grep/re-read
the target files per decision ID each pass, not infer from CI status.

**Pass 2 (2026-07-03): NO-GO — new blocker, different from pass 1's "missing
decisions" gaps.** D-4, D-5, D-7, OQ-9 (the 4 items missing in pass 1) are now
all correctly implemented: `contexts` field's stray `@deprecated` tag removed
from `types.ts`; all 6 dead `VytchesDDDModuleOptions` fields
(`bridgeToNestJS`/`performance`/`handlers`/`monitoring`/`globalBridgeToNestJS`/
`enableContexts`) deleted from `types.ts`;
`discovery/auto-discovery.service.ts`, `discovery/index.ts`,
`tests/auto-discovery-perf.test.ts` all deleted, confirmed never referenced from
the public barrel (`src/index.ts`), `DEFAULT_DISCOVERY_PATTERNS`/
`DEFAULT_EXCLUDE_PATTERNS` also cleanly removed from `constants.ts`;
`findOwnModule()` Step 2 now has the required `internalLogger.warn` on the
non-Set-`imports` branch. D-2 (`forRootAsync` removal) and D-6 (F-M19 barrel
import) remain correctly in place from pass 1, still verified clean.

**BUT**: this package has a dedicated `type-check` Nx target
(`tsc --noEmit --project packages/nestjs/tsconfig.json`, distinct from the
`test` target which runs Vitest/esbuild transpile-only and does NOT do full type
checking) whose `tsconfig.json` `include` covers BOTH `src/**/*.ts` AND
`tests/**/*.ts`. Running `pnpm nx run @vytches/ddd-nestjs:type-check` produces
**34 compile errors** (`TS2353`/`TS2559` "Object literal may only specify known
properties") across 5 test files that pass the now-deleted D-5 fields
(`bridgeToNestJS`, `performance`, `globalBridgeToNestJS`, `handlers`,
`monitoring`) as literal properties to `forContext()`/`forContexts()`:
`tests/architecture-validation.test.ts` (only 2 of ~10 call sites were cleaned
up in the diff — many more remain later in the same file, lines 314-524),
`tests/context-aware-integration.test.ts`,
`tests/integration-stress-test.test.ts`, `tests/performance-benchmarks.test.ts`,
`tests/realistic-enterprise-integration.test.ts` (none of these 4 files appear
in `git diff` at all — completely untouched). `pnpm nx test @vytches/ddd-nestjs`
is fully green (21 files/204 tests) precisely BECAUSE Vitest doesn't enforce
excess-property checks — a green Vitest run does NOT mean the package
type-checks. D-5's analysis claim "confirmed zero external usage" only ever
covered the _consumer app_, not this package's OWN test suite, which has ~35
internal usages that were missed.

**For next pass**: verify all 5 files above have every `bridgeToNestJS` /
`performance` / `handlers` / `monitoring` / `globalBridgeToNestJS` /
`enableContexts` literal-property usage and matching `expect(...).toBe(...)`
assertions on those fields removed (mirror the cleanup style already correctly
applied to the first ~2 call sites of `architecture-validation.test.ts`), THEN
re-run `pnpm nx run @vytches/ddd-nestjs:type-check` and confirm zero errors
before approving. Do not rely on `pnpm nx test`/vitest alone for this unit — it
structurally cannot catch this class of regression.

**Pass 3 (2026-07-03): NO-GO — same blocker persists, unchanged root cause.**
`architecture-validation.test.ts` is now fully cleaned (0 dead-field usages
left, confirmed by grep) but the other 4 files flagged in pass 2 —
`context-aware-integration.test.ts`, `integration-stress-test.test.ts`,
`performance-benchmarks.test.ts`, `realistic-enterprise-integration.test.ts` —
are STILL completely absent from `git diff`/`git status` (zero edits) and still
contain `bridgeToNestJS`/`performance`/`handlers`/`monitoring`/
`globalBridgeToNestJS`/`enableContexts` literal properties passed to
`forContext()`/`forContexts()`. `pnpm nx run @vytches/ddd-nestjs:type-check`
still fails, now with 26 `TS2353`/`TS2559` errors (down from 34 — the
`architecture-validation.test.ts` cleanup accounts for the delta) across exactly
those 4 files. `pnpm nx test @vytches/ddd-nestjs` is still fully green (21 files
/ 202 tests) — reconfirms Vitest cannot catch this regression class, do not let
a green Vitest run substitute for type-check here.

All other decisions in this unit re-verified clean this pass, no regressions:
D-2 (`forRootAsync` removal — only remaining `forRootAsync` hit is the unrelated
`OutboxProcessorModule` static method), D-4/D-5 (types.ts has zero `@deprecated`
tag on `contexts` and zero dead fields), D-6 (both
`feature-handler-registrar.ts` and `vytches-ddd-feature.module.ts` use the
`@nestjs/core` public barrel import for `ModulesContainer`), D-7 (discovery/ dir
and its test fully deleted, zero references in `src/index.ts`), OQ-9
(`internalLogger.warn` present in `findOwnModule()` Step 2's non-Set branch),
D-8d (`grep -rn "ModulesContainer" packages/nestjs/src` shows only imports/
comments/the one `@Inject()` decoration, zero stray `providers:` entries). Also
confirmed the F-C4 fix (`@Inject(ModuleRef)`/`@Inject(ModulesContainer)` on
`feature-handler-registrar.ts`'s constructor, from the _other_ unit's pass 4 GO)
is still present and intact — carry-over, not re-verified fresh beyond
confirming the diff still shows it.

**For next pass**: same instruction as pass 2 — clean the 4 untouched files,
then re-run type-check. This is now a 2-pass-repeated gap; flag to the
orchestrator that these 4 files may need to be explicitly assigned rather than
assumed to be swept up incidentally.

**Pass 4 (2026-07-03): NO-GO — same blocker, still not fully resolved, but
partial progress made.** Of the 4 files flagged in pass 3:

- `context-aware-integration.test.ts`: now fully cleaned (0 remaining dead-field
  usages; contributes 0 errors to type-check output).
- `integration-stress-test.test.ts`: partially cleaned but STILL has 3 remaining
  `TS2353` errors: `globalBridgeToNestJS` at line 625, `bridgeToNestJS` at lines
  716 and 791.
- `performance-benchmarks.test.ts`: STILL completely untouched (zero edits,
  confirmed absent from `git status --porcelain -- packages/nestjs`), 9
  remaining errors (`bridgeToNestJS` x6 lines 218/323/456/497/581,
  `globalBridgeToNestJS` line 264, `performance` line 531 — note `handlers:` and
  `monitoring:` object keys at lines 224/503/535 are nested inside
  `performance`/other objects, not top-level `VytchesDDDModuleOptions`
  properties, so they don't independently trigger TS2353 but must still be
  removed once the parent literal is cleaned).
- `realistic-enterprise-integration.test.ts`: STILL completely untouched (zero
  edits), 4 remaining errors (`bridgeToNestJS` x3 lines 236/345/505,
  `performance` line 428).

`pnpm nx run @vytches/ddd-nestjs:type-check` fails with 14 total errors (down
from 26 in pass 3 — confirms real incremental progress, not stagnation). All
other decisions (D-2, D-4, D-5-in-src, D-6, D-7, OQ-9, D-8d) re-confirmed still
clean/intact this pass via direct grep/read of `packages/nestjs/src` (diff stat:
7 files changed, 25 insertions/502 deletions in src, unchanged shape from prior
passes) — not the blocker, do not re-flag these.

**For next pass**: finish `integration-stress-test.test.ts` (3 call sites),
`performance-benchmarks.test.ts` (all ~9 call sites), and
`realistic-enterprise-integration.test.ts` (all ~4 call sites), then re-run
`pnpm nx run @vytches/ddd-nestjs:type-check` and confirm exactly 0 errors. This
is now a 3-pass-repeated gap on the same 2 fully-untouched files
(`performance-benchmarks.test.ts`, `realistic-enterprise-integration.test.ts`) —
strongly recommend orchestrator explicitly assign these 2 files as a standalone
follow-up task rather than relying on incidental sweep-up, since 3 consecutive
passes have failed to touch them at all.

**Pass 5 (2026-07-03): GO.** All 3 remaining files
(`integration-stress-test.test.ts`, `performance-benchmarks.test.ts`,
`realistic-enterprise-integration.test.ts`) fully cleaned — confirmed by grep
for `bridgeToNestJS`/`globalBridgeToNestJS`/`enableContexts`/dead
`performance:`/`handlers:`/`monitoring:` object-literal keys (zero hits; the
only remaining string matches are unrelated `console.log` text). Ran
`pnpm nx run @vytches/ddd-nestjs:type-check --skip-nx-cache`: **0 errors**
(first time clean after 4 consecutive NO-GOs on this exact blocker). Ran
`pnpm nx test @vytches/ddd-nestjs --skip-nx-cache`: 21 files / 202 tests, all
green, including the D-8c e2e gate and the D-8a/D-8b carry-over tests.
Re-verified every decision in this unit fresh by direct read/grep (not inferred
from a prior pass): D-2 (`forRootAsync` cleanly deleted from
`vytches-ddd.module.ts`, only remaining hit is the unrelated
`OutboxProcessorModule` static method), D-4 (`contexts` field JSDoc rewritten,
zero `@deprecated` tags left in `types.ts`), D-5 (all 6 dead fields deleted from
the `VytchesDDDModuleOptions` interface in `types.ts`, diff shows the exact
fields matching the decision), D-6 (`feature-handler-registrar.ts` and
`vytches-ddd-feature.module.ts` both use `@nestjs/core` public barrel import for
`ModulesContainer`), D-7 (`discovery/` dir gone, `auto-discovery-perf.test.ts`
gone, `DEFAULT_DISCOVERY_PATTERNS`/`DEFAULT_EXCLUDE_PATTERNS` gone from
`constants.ts`, zero references anywhere in `src/index.ts` — note
`tests/auto-discovery.test.ts` is a DIFFERENT, still-present file that tests the
real `VytchesExplorerService` mechanism, not the deleted `AutoDiscoveryService`;
do not confuse the two by name alone), OQ-9 (`internalLogger.warn` present and
correctly worded in `findOwnModule()` Step 2's non-Set branch), D-8d
(`grep -rn "ModulesContainer" packages/nestjs/src` shows only
imports/comments/one `@Inject()` decoration).

Root cause of the 4-pass type-check gap, for posterity: a green Vitest run was
never sufficient evidence for D-5 because Vitest/esbuild transpile-only mode
does not enforce TS excess-property/object-literal checks — only the dedicated
`type-check` Nx target (`tsc --noEmit`) catches stale literal properties
referencing deleted interface fields in test files. This class of gap (test
files passing literal properties for since-deleted optional fields) will recur
for any future interface field removal in this package; always run type-check,
not just the test target, when verifying a field-removal decision.
