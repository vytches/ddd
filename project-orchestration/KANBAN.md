# KANBAN — @vytches/ddd

_Last manually updated 2026-07-11 (VF-031 shipped, moved to completed-tasks/;
tables current as of this date). Age = days since created_at. Grouped by
priority (P0 critical · P1 high · P2 normal/medium · P3 low · backlog)._

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

## P0 — Critical

_None._ VS-016 (the only P0) shipped 2026-07-10.

## P1 — High

_Ordered by actual work priority: VF-024, VF-023, and VF-031 (pre-publish API
surface, DDD foundation guarantees, surface diet) shipped; the newly-filed real
bug (VF-035) now leads, then independent hardening (VF-028, VF-030)._

| ID     | Title                                                         | Status  | Age |
| ------ | ------------------------------------------------------------- | ------- | --- |
| VF-035 | Composite policy step-coverage bug (throws instead of Result) | backlog | 0d  |
| VF-028 | Resilience correctness (jitter, decorator state, HALF_OPEN)   | backlog | 1d  |
| VF-030 | DI token identity (fn.name collision, Scoped→Transient)       | backlog | 0d  |

## P2 — Normal / Medium

| ID      | Title                                                             | Status  | Age |
| ------- | ----------------------------------------------------------------- | ------- | --- |
| VD-004  | Interactive Documentation System                                  | backlog | 56d |
| VF-002  | Strategic Design Documentation                                    | backlog | 56d |
| VP-006b | NestJSContainerAdapter resolve/cold-start optimization            | backlog | 3d  |
| VF-025  | Event/projections hardening (UnifiedEventBus, retry, checkpoints) | backlog | 1d  |
| VP-012  | Hot-path quick wins (AuditCapability O(n²), CachedPolicy hash)    | backlog | 1d  |
| VD-005  | Docs truth cleanup (docs/README, ADR index, quickstarts, JSDoc)   | backlog | 1d  |
| VT-006  | Policies test coverage + testing pkg hardening                    | backlog | 1d  |
| VD-006b | Semantic combination-sanity evaluator harness + pilots (R&D)      | backlog | 0d  |
| VF-034  | Dead-code detection (knip/ts-prune) informational CI check        | backlog | 0d  |
| VF-032  | NestJS fluency (forRootAsync, forFeature→CQRSConfiguration)       | backlog | 0d  |
| VF-033  | Validation hardening & one validation story                       | backlog | 0d  |

## P3 — Low

_None._

## Backlog

_Deliberately set aside (2026-07-11) — revisit after the P1 pre-publish pipeline
clears, not a current priority._

| ID     | Title                                          | Status  | Age |
| ------ | ---------------------------------------------- | ------- | --- |
| VA-001 | @vytches/ddd-agent — AI Agent DDD Boundary Pkg | backlog | 44d |

---

**Recommended next action**: (1) VS-013 juz-ide-api validation — still the
v0.31.0 publication gate, **overdue since 2026-07-05**, human/cross-team action;
also now the gate for AC8 of the shipped VF-023 (external validation against the
237+ aggregate consumer, deferred to manual sign-off before any npm
tag/release). (2) **VF-024**, **VF-023**, and **VF-031** all shipped 2026-07-11
(API surface curation; DDD foundation guarantees; surface diet) — the
pre-first-publish pipeline's design-heavy work is now clear except VF-031's
deferred AC3 (owned by VF-032). (3) **VF-035** (composite-policy step-coverage
bug, filed 2026-07-11) is a real production bug in the public policies API and
is the recommended next task to pick up — no design review needed, just
implementation, and it's already leading the P1 table. Full audit findings:
`project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`,
`SEC-AUDIT-2026-07-09.analysis.md`, `LIB-UX-AUDIT-2026-07-10.analysis.md`.
