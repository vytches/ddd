# KANBAN — @vytches/ddd

_Last manually updated 2026-07-10 (banner history consolidated; tables current
as of this date). Age = days since created_at. Grouped by priority (P0 critical
· P1 high · P2 normal/medium · P3 low · backlog)._

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
> **Not yet tasked — needs a task file:** `policy-builder.ts:538` /
> `policy-group.ts:330` (`BuiltCompositePolicy`/`GroupCompositePolicy` >
> `.createPolicyFromStep`) — composite/multi-step policy evaluation silently
> throws instead of returning `Result` for real, reachable step-type
> combinations (`shouldSatisfyAny()`, `.mustAsync()`, `.mustSatisfyRules()` used
> together) — a genuine bug in the public policies API with zero test coverage
> on the affected paths. Found during VF-026's triage, escalated but not yet
> turned into a task — do this before publish.

## P0 — Critical

_None._ VS-016 (the only P0) shipped 2026-07-10.

## P1 — High

| ID     | Title                                                             | Status  | Age |
| ------ | ----------------------------------------------------------------- | ------- | --- |
| VF-023 | DDD foundation guarantees (VO validate, apply atomicity)          | backlog | 8d  |
| VF-024 | Pre-publish API surface (enterprise barrel, collisions, removals) | backlog | 8d  |
| VF-028 | Resilience correctness (jitter, decorator state, HALF_OPEN)       | backlog | 1d  |
| VF-030 | DI token identity (fn.name collision, Scoped→Transient)           | backlog | 0d  |
| VF-031 | Pre-publish API surface diet (zero-consumer scaffolding)          | backlog | 0d  |

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

| ID     | Title                                          | Status  | Age |
| ------ | ---------------------------------------------- | ------- | --- |
| VA-001 | @vytches/ddd-agent — AI Agent DDD Boundary Pkg | backlog | 43d |

---

**Recommended next action**: (1) VS-013 juz-ide-api validation — still the
v0.31.0 publication gate, **overdue since 2026-07-05**, human/cross-team action.
(2) Pre-first-publish pipeline: **VF-024** (API surface curation, 10h) unblocks
library-api-guardian sign-off on **VF-023**/VF-031 — all three touch the same
pre-publish BC window and involve consumer-impacting design calls (VO
deep-freeze, `EntityIdFactory` removal, enterprise barrel curation) worth a
human review pass before implementation. (3) File a task for the
`policy-builder.ts:538`/`policy-group.ts:330` composite-policy bug (see banner
above) before publish. Full audit findings:
`project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`,
`SEC-AUDIT-2026-07-09.analysis.md`, `LIB-UX-AUDIT-2026-07-10.analysis.md`.
