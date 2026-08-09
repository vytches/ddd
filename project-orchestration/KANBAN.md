# KANBAN — @vytches/ddd

_Last updated 2026-08-09 (maturity-audit re-prioritization: 5 new tasks filed
VF-036/VF-037/VD-008/VT-007/VD-009, VP-012 promoted to P1, runtime-first
ordering per owner directive — see the 2026-08-09 note above the boards).
Prior: 2026-07-18 by `/task-tidy` (VP-006b reconciled: task file was
stuck at `status: backlog` with unchecked ACs despite merge to `develop`
`cf4029dd` 2026-07-12 and a GO verifier verdict `3b81c5ba` — status flipped to
`done`, ACs checked against git history, file moved to `completed-tasks/`).
Prior: 2026-07-13 by `/pulse` (VD-005 shipped — docs truth cleanup + new
`tools/docs-compile-gate` CI tool, all 11 ACs done, moved to `completed-tasks/`,
merged to `develop`). VF-028 is now the only open P1 in the entire backlog. Age
= days since created_at. Grouped by priority (P0 critical · P1 high · P2
normal/medium · P3 low · backlog)._

> Active board only — `done`/`completed`/`cancelled` tasks moved to
> `completed-tasks/`. Source of truth: `project-orchestration/tasks/`.
>
> **Just shipped (2026-07-03)**: **VD-007** done (LLMGUIDE.md completeness pass,
> 300+ undocumented exports across 11 packages, commits `f62e7cdf`/
> `6b570f21`/`025c1312`) and **VB-003** done (`forFeature` DI wiring fix,
> **BREAKING CHANGE** — stops cross-context event leak F-C4, 215/215 nestjs
> tests green) — both moved to `completed-tasks/`. **P0 board is now clear**:
> VB-003 was the last of the two original publish blockers (VB-002 landed
> 2026-07-02). Follow-ups spawned: VF-026, VD-006 (both already on this board).
>
> **Split (2026-07-04)**: **VD-006** → `/analyze-ddd` panel found the 8h
> estimate couldn't cover both halves; approved split into **VD-006a**
> (generator + CI enforcement, 8h) and **VD-006b** (semantic-eval harness +
> pilots, 10h R&D, depends on VD-006a, explicit pass/fail exit criterion).
> Original VD-006 task file marked `status: split`, kept as historical record.
> Analysis:
> `project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md`.
>
> **Just shipped (2026-07-05)**: **VD-006a** done (example-matrix generator + CI
> `--check` enforcement, commit `ff985aa9` on
> `feature/VD-006a-example-matrix-generator`, not yet pushed/PR'd) — moved to
> `completed-tasks/`. **VD-006b** now unblocked (depends on VD-006a's manifest
> `level` field, which has landed).
>
> **Just shipped (2026-07-02)**: VS-006, VS-008, VB-002 — see prior cycle notes
> in git history of this file. **v0.31.0 code scope is complete** — only the
> VS-013 validation gate remains.
>
> **Housekeeping/triage resolved (2026-07-01/02)**: VP-011, VP-002, VF-001,
> VT-001 closed/archived to `completed-tasks/`.

> **Security audit (2026-07-09)**: full-library pattern audit
> (`project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`, findings
> SA-XX) spawned **VS-016** (P0), **VS-017/VS-018/VF-028** (P1), amended
> VF-023/VF-024/VF-025/VF-026/VF-027, and bumped **VF-026** normal→high (the
> `ddd-002 no-throw-in-domain` lint gate turned out to be a no-op in CI wiring).
> Two items deliberately NOT tasked (need `/analyze-ddd` design decisions
> first): registry/DI collision semantics (SA-H4/M10/L4), injectable Clock
> (SA-M8).

> **Usability/DX audit (2026-07-10)**: full-library usability & integration
> audit (`project-orchestration/analysis/LIB-UX-AUDIT-2026-07-10.analysis.md`,
> findings UX-Cx/UX-Tx) spawned **VF-029/VF-030/VF-031** (P1) and
> **VF-032/VF-033** (P2), and amended VF-023 (AggregateRoot.equals,
> getDomainEvents shallow copy), VF-027 (bulkhead leaks UX-C6, est. 1h→2h),
> VT-006 (PolicyEventBus timer UX-C7), VD-005 (non-compiling README/LLMGUIDE
> snippets + docs compile gate, est. 8h→12h). Key strategic point: **VF-031
> (surface diet) shares the pre-first-publish hard window with VF-024** —
> removals become breaking changes after publish. NOT tasked (by design): ACL
> registry silent-overwrite (part of the deferred SA-H4/M10/L4
> collision-semantics `/analyze-ddd` decision); Fallback pattern for resilience
> and retry-engine consolidation (policies vs resilience) — need design
> decisions first.

> **Shipped (2026-07-10, consolidated)**: five tasks completed and merged to
> `develop` in one session, all independently re-verified (tests + typecheck +
> lint, zero regressions across every downstream consumer checked):
>
> - **VF-029** — EventBus integrity: split-registry dead-registration path
>   fixed, DI-stub scaffolding deleted, unified fan-out error semantics
>   (`AggregatedEventHandlerError`), identity-based unsubscribe,
>   `publishMany({ sequential })` opt-in.
> - **VS-016** — `EntityId.create()` + policies/aggregates correlation-ID
>   generators: `Math.random()` → `crypto.randomUUID()`/`LibUtils.getUUID()`.
>   **P0 board cleared.**
> - **VS-018** — CQRS `LoggingMiddleware` now opt-in (was default-on),
>   `${error}` blind interpolation fixed, new `LibUtils.sanitizeLogMessage()`
>   shared with `outbox-processor` (log-injection guard).
> - **VF-026** — `isDomainFile()` scanner fix (SA-M1, was a silent no-op) + full
>   triage of 60 surfaced `ddd-002` findings; new `ddd-005`
>   (deep-import-instead-of-barrel) rule shipped via `/analyze-ddd` →
>   `/orchestrate-ddd` (GO on first attempt). `ddd-004` (fanout-in-handler)
>   **descoped** — VB-003's actual lesson didn't map to one generalizable AST
>   rule; documented as LLMGUIDE prose instead, dead-code detection spun off as
>   **VF-034** (knip/ts-prune, new P2 task below).
> - **VS-017** — error serialization: `IDomainError.toJSON()` strict whitelist
>   (name/code/message/timestamp/data, never stack/subclass fields),
>   `TranslationError.sourceModel` made non-enumerable,
>   `PolicyViolation.toJSON()` stack now opt-in only.
>
> Analysis artifacts: `SEC-AUDIT-2026-07-09.analysis.md`,
> `LIB-UX-AUDIT-2026-07-10.analysis.md`,
> `VF-026-ddd-lint-anti-pattern-rules.analysis.md`. All five source tasks moved
> to `completed-tasks/`.
>
> **Filed (2026-07-11)**: **VF-035** — the composite-policy step-coverage bug
> flagged above (`policy-builder.ts:538`/`policy-group.ts:330`) now has a task
> file (P1, pre-publish). See P1 table below.
>
> **Shipped (2026-07-11)**: **VF-035** done — all three `createPolicyFromStep`
> switches now cover their full step-type unions via shared internal factories
> (`step-policy-factory.ts`), new `OrGroupsPolicy` makes `shouldSatisfyAny()`
> actually work (it threw for every documented usage), `assertNever` guards turn
> future union growth into typecheck failures, and `shouldSatisfyAny()` returns
> `IPolicyStepBuilder` (AC7, pre-publish signature fix). Two commits on develop:
> `a880b32b` (fix) + `63a07593` (feat). Analysis + Q1–Q4 decision trail:
> `analysis/VF-035.analysis.md`. Moved to `completed-tasks/`.

> **Session boundary (2026-07-11)**: board reviewed and re-ordered by actual
> work priority (not just chronological/creation order) ahead of a fresh
> session. **VA-001** (`@vytches/ddd-agent`) deliberately set aside for later —
> stays in `## Backlog` below P3, not a current priority; revisit after the
> pre-publish pipeline (P1) is clear.

> **Shipped (2026-07-11)**: **VF-024** done — public API surface curated ahead
> of first publish (all 9 acceptance criteria). Enterprise barrel: 10×
> `export *` → explicit named exports. `ServiceNotFoundError` renamed
> `ContainerServiceNotFoundError` (di), resolving the domain-services collision.
> Deprecated `EntityIdFactory` removed (clean pre-1.0 removal, not
> shipped-then-deprecated). `internalLogger` +
> `EVENT_HANDLER_METADATA`/`EVENT_HANDLER_OPTIONS` (contracts) and
> `CUSTOM_MIDDLEWARE_SYMBOL` (events) moved out of public barrels to `/internal`
> subpath exports. `BaseEntityId` renamed `ContractsEntityId`. **SA-M11**
> resolved: `globalPolicyEventBus` process-global singleton removed from the
> policies barrel. `testing` barrel seeder `export *` → explicit. api-extractor
> signature checking now blocking in CI for enterprise (was advisory-only).
> Verified: 24/24 projects green (test + type-check) — pre-commit caught and
> fixed a real gap in the `/internal` subpath wiring (3 `examples/*` vitest
> configs needed the same array-form alias fix as the root config). **Unblocks
> library-api-guardian sign-off on VF-023 and VF-031.** Moved to
> `completed-tasks/`.

> **Shipped (2026-07-11)**: **VF-023** done — DDD foundation guarantees for
> `BaseValueObject`/`AggregateRoot` (all 11 acceptance criteria). Constructor
> now calls `validate()` and throws on invalid input (F-C5). Deep freeze for VO
> values and domain events; `equals()` via `LibUtils.deepEqual`, not
> `JSON.stringify` (F-H5). `apply()` guards moved before `_version`/
> `_domainEvents` mutation, fixing version desync on throw+retry (F-C6).
> `_internal_setState` gated behind a module-private Symbol token, closing the
> **Critical** invariant-bypass (F-H4); `SnapshotCapability` updated in
> lockstep. `onMissingHandler` (`'warn'`/`'throw'`) config for missing event
> handlers, applied to both live `apply()` and replay (F-M2/SA-M7).
> `IEventPersistenceHandler` JSDoc now requires atomic compare-and-set semantics
> (SA-M9). `AggregateRoot.equals()` added (UX-C15). Threat model `TM-VF-023.md`
> flipped DRAFT → APPROVED. **BREAKING CHANGE** — see CHANGELOG.md for migration
> notes. Verified: 274/274 tests + typecheck clean across the 5 directly-touched
> packages; pre-commit's full 22-24 project run caught a real regression the
> 5-package pass missed (`examples/quickstart`'s `Money` VO relied on the
> pre-VF-023 construct-then-manually-validate pattern) — fixed by migrating it
> to the `getInvalidValueMessage()` hook, same pattern already used in
> `base-value-object.test.ts`; re-verified 24/24 projects green. External
> validation against the real consumer (juz-ide-api, 237+ aggregates) is
> deferred to manual sign-off before any npm tag/release — not blocking this
> merge to `develop` per explicit authorization. Moved to `completed-tasks/`.
> **Unblocks VF-031**, next in the pre-first-publish sequence.

> **Shipped (2026-07-11)**: **VF-031** done — pre-publish API surface diet, 9 of
> 10 acceptance criteria (AC3 explicitly **deferred to VF-032**: nestjs's ghost
> `types/index.ts` is circularly gated on VF-032 AC1's `forRootAsync` shape
> decision, so `packages/nestjs/` was correctly left untouched). Removed:
> `events`' entire `audit/` subsystem, `subscribeToContext`, inert
> `EventHandlerOptions.priority`, `GenericEventPersistenceHandler`; `acl`'s
> `ACLDiscoveryPlugin` + decorators (nestjs `@ACLAdapterFor` is the working
> alternative); `domain-services`' write-only `DIDomainServiceMetadataRegistry`;
> `aggregates`' duplicate capability-interface block, speculative
> never-implemented interfaces, and the exported `IAggregateBuilder`
> (**BREAKING** — shape-incompatible with the real builder, no drop-in
> replacement). Added: `resilience`'s correctly-named `getResilienceConfig()`,
> with `getResilienceMetrics()` now `@deprecated` in its favor (non-breaking).
> Two open questions resolved by explicit user decision: **OQ-1** — validation's
> `RulesRegistry` and `BaseValidationAdapter` are both permanent, equally
> first-class paths (not legacy vs. current); **OQ-2** — `events/integration`
> pipeline **KEEP**, not delete (real, re-exported public surface from the
> `enterprise` barrel, despite zero in-repo logic consumers), with
> scope-narrowing JSDoc added instead. Verified: fresh test + typecheck green
> across all 8 directly-touched packages; CHANGELOG.md carries 4 VF-031 entries.
> Moved to `completed-tasks/`.

> **Audit + re-prioritization (2026-08-09)**: full maturity audit
> (`analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`, 5 specialist agents:
> overall ~6.7/10 — code release-grade, human-facing docs a full tier behind)
> plus a consumer-reported incident (`getEqualityComponents()` docs-phantom
> API → **VF-036**, P1) spawned four consolidated tasks: **VF-037** (standing
> cross-context isolation regression suite + behavioral-BC checklist, P1),
> **VD-008** (docs truth & parity sweep + docs-compile-gate extension, P2),
> **VT-007** (re-enable domain-services e2e, P2), **VD-009** (priority example
> workspaces, P3). **VP-012 promoted P2→P1** (confirmed-live runtime hot
> paths). **VD-004/VF-002 demoted P2→P3** (docs-site/strategic-docs — no
> runtime value; explicit owner decision: runtime behavior > linters/docs).
>
> **Release sequencing (owner decision, 2026-08-09)**: (1) merge the existing
> alpha branch (`release/2026-07-18-alpha`, 0.31.0-alpha.0 — already merged
> into `develop` via `d836beeb`) to **`main`** first; (2) all tasks below are
> implemented **on top of** that state, branching from `develop`; (3) VF-036
> additionally requires the downstream consumer's full-suite run on a patched
> build before any npm tag that includes it (its AC5).

## P0 — Critical

_None._ VS-016 (the only P0) shipped 2026-07-10.

## P1 — High

_Runtime-value first (owner directive 2026-08-09): things that change or
protect how the library behaves at run time outrank docs/lint work. Suggested
order: VF-036 → VF-028 → VP-012 → VF-037._

| ID     | Title                                                            | Status  | Age |
| ------ | ---------------------------------------------------------------- | ------- | --- |
| VF-036 | BaseValueObject getEqualityComponents() hook (consumer-gated BC) | backlog | 1d  |
| VF-028 | Resilience correctness (jitter, decorator state, HALF_OPEN)      | backlog | 31d |
| VP-012 | Hot-path quick wins (AuditCapability O(n²), CachedPolicy hash)   | backlog | 32d |
| VF-037 | Cross-context isolation regression suite + behavioral-BC gate    | backlog | 0d  |

## P2 — Normal / Medium

_Runtime-adjacent first (VF-025, VT-007, VF-032, VF-033, VT-006, VF-027), then
docs & tooling (VD-008, VF-034, VD-006b). 2026-08-09 consistency fix: VF-027
and VP-006c had task files but no board row since creation — added here and
in P3 respectively._

| ID      | Title                                                             | Status  | Age |
| ------- | ----------------------------------------------------------------- | ------- | --- |
| VF-025  | Event/projections hardening (UnifiedEventBus, retry, checkpoints) | backlog | 32d |
| VT-007  | Re-enable domain-services e2e suite (missing container classes)   | backlog | 0d  |
| VF-032  | NestJS fluency (forRootAsync, forFeature→CQRSConfiguration)       | backlog | 30d |
| VF-033  | Validation hardening & one validation story                       | backlog | 30d |
| VT-006  | Policies test coverage + testing pkg hardening                    | backlog | 32d |
| VF-027  | ResilienceContext fork() — native AbortSignal.any() rewrite       | backlog | 32d |
| VD-008  | Docs truth & parity sweep + docs-compile-gate extension           | backlog | 0d  |
| VF-034  | Dead-code detection (knip/ts-prune) informational CI check        | backlog | 30d |
| VD-006b | Semantic combination-sanity evaluator harness + pilots (R&D)      | backlog | 36d |

## P3 — Low

| ID     | Title                                                          | Status  | Age |
| ------ | -------------------------------------------------------------- | ------- | --- |
| VD-009 | Priority example workspaces (repos+UoW, outbox, CQRS+resil.)   | backlog | 0d  |
| VD-004 | Interactive Documentation System                               | backlog | 78d |
| VF-002 | Strategic Design Documentation                                 | backlog | 78d |
| VP-006c | BaseContainerAdapter resolve optimization (no live callers)   | backlog | 37d |

## Backlog

_Deliberately set aside (2026-07-11) — revisit after the P1 pre-publish pipeline
clears, not a current priority._

| ID     | Title                                          | Status  | Age |
| ------ | ---------------------------------------------- | ------- | --- |
| VA-001 | @vytches/ddd-agent — AI Agent DDD Boundary Pkg | backlog | 44d |

---

**`/pulse` sync (2026-07-12)**: corrected a stale framing — VS-013 (app-logging
removal) closed **2026-06-05**, and VS-006/VS-008 are also `done`. The only open
item is the owner's manual juz-ide-api sign-off, **deliberately deferred by
prior authorization, not overdue** (no deadline was ever set). **VP-006b**
merged to `develop` 2026-07-12 (`cf4029dd`) — task file needed `/task-tidy`
archival, flagged above.

**`/task-tidy` sync (2026-07-18)**: **VP-006b** reconciled and archived to
`completed-tasks/` — see updated header note above.

**Recommended next action (2026-08-09, runtime-first)**:

1. **Merge alpha → `main`** (`release/2026-07-18-alpha` content, already in
   `develop`) — establishes the base every task below builds on top of.
2. **VF-036** (equality-components hook) — highest runtime value: fixes wrong
   equality semantics for a real consumer; ship a patched build for their
   full-suite validation (AC5) early, since their sign-off gates the tag.
3. **VF-028 AC1** (jitter default) + **VP-012** (three confirmed-live hot
   paths) — small, scoped runtime fixes; can be one working session.
4. **VF-037** (isolation regression suite) — locks in the runtime correctness
   the last three fixes bought.
5. Then P2 runtime-adjacent (VF-025, VT-007), and only after that the docs
   sweep **VD-008** — important for release credibility, but it changes no
   runtime behavior.

Full audit trail: `analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md` (new),
`LIB-AUDIT-2026-07-02.analysis.md`, `SEC-AUDIT-2026-07-09.analysis.md`,
`LIB-UX-AUDIT-2026-07-10.analysis.md`.
