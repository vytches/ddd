# KANBAN — @vytches/ddd

_Last updated 2026-08-25 — **VB-005 shipped** (benchmark harness repair: the
`resolve.alias` object-form prefix-matching bug in
`benchmarks/vitest.config.mts` that broke `pnpm run bench` entirely — fixed to
array form with `/internal` subpath entries before base entries, matching the
VF-024 precedent already applied in the root config and
`packages/nestjs/vitest.bench.config.ts`, and extended to cover a second,
undiscovered instance of the same bug in `@vytches/ddd-events/internal`;
`Money`'s missing `validate()` in `hot-paths.bench.ts` fixed alongside it — a
real compile-time defect masked by the alias failure; README now documents how
to verify the harness locally. `library-quality-verifier` GO, `pnpm run bench`
confirmed exit 0 with all 11 `hot-paths.bench.ts` results present. Committed
`bf8d54cc` on `fix/VB-005-benchmark-harness-broken`, moved to
`completed-tasks/`. P1 is now empty.) Prior (same day): **VB-008 shipped**
(policy behaviours: composition-wrapper preservation across
`and()`/`or()`/`when()` + factory export shape + named cache-metrics type +
`create()`/`withDefaults()` collapse + examples/CI gate,
`library-quality-verifier` GO on all 7 ACs, no merge needed — branch was already
at `develop`'s commit, moved to `completed-tasks/`; four changesets await
release). Prior: 2026-08-24 — **VF-025 shipped** (patch scope A+C+E+G — events
dedup+diagnostics, projections clearProjectionState fix + opt-in checkpoint
resume, resilience circuit-breaker HALF_OPEN fix, cqrs typed registration —
`library-quality-verifier` GO, merged to `develop` fast-forward `4801b799`,
moved to `completed-tasks/`). Remaining scope (retryConfig classification,
error-propagation, autoRegisterHandlers opt-in flip, resilience metrics wire-up)
deferred — reserved names `VF-025b/c/d` in
`project-orchestration/completed-tasks/VF-025-event-projections-hardening.md`
§Zamknięcie, **no task files exist yet for them**, refile from the analysis
before picking that work up. Prior: 2026-08-23 (same-day follow-up) — **VF-033
shipped** (validation hardening: all 6 ACs, moved to `completed-tasks/`). Prior
(same day): post-publish board correction — v0.31.0 is live on npm
(`latest: 0.31.0`, 2026-08-22, PR #87), so **VF-036 was archived** (it had sat
in `tasks/` with `status: done` and all ACs checked) and **VB-008 was demoted P1
→ P3** — its promotion was pre-publish window reasoning that the release
invalidated. Prior: 2026-08-21 — runtime series closed (7 tasks: VF-032a/b,
VF-027, VB-007, VP-006c/d, VF-040) and boards re-prioritised. **Board correction
the same day**: VF-032a and VF-032b had sat on the P2 board for a day after
being archived — the row deletions were exact-string matches that stopped
matching once `prettier --write` realigned the table columns. Cross-checked
every board row against `tasks/` afterwards; the only entries now absent from a
board are the three `split` parents (VD-006, VF-032, VF-039), which is intended.
Prior: 2026-08-19 by `/pulse` + same-day correction (37-day sync gap —
VF-036/VF-037/VF-039 work landed since the 2026-07-13 pulse without a status
sync; VF-039 split into VF-039a/VF-039b same day. **Correction**: `/pulse`
initially flagged VF-028 as "branch active, not yet done" — a direct user check
("czy 028 właśnie nie skończyliśmy?") caught that this was itself stale: VF-028
was implemented and committed the same day (`05ac364a`), just never had its task
file updated. Verified (resilience 104/104, policies 237/237 green) and archived
alongside VF-037 — both moved to `completed-tasks/`.) Prior: 2026-08-09
(maturity-audit re-prioritization: 5 new tasks filed
VF-036/VF-037/VD-008/VT-007/VD-009, VP-012 promoted to P1, runtime-first
ordering per owner directive — see the 2026-08-09 note above the boards). Prior:
2026-07-18 by `/task-tidy` (VP-006b reconciled: task file was stuck at
`status: backlog` with unchecked ACs despite merge to `develop` `cf4029dd`
2026-07-12 and a GO verifier verdict `3b81c5ba` — status flipped to `done`, ACs
checked against git history, file moved to `completed-tasks/`). Prior:
2026-07-13 by `/pulse` (VD-005 shipped — docs truth cleanup + new
`tools/docs-compile-gate` CI tool, all 11 ACs done, moved to `completed-tasks/`,
merged to `develop`). **VF-036 (AC-SIGNOFF) is now the sole open gate on the
v0.31.0 tag** — owner decision 2026-08-19: collect the sign-off, run the full
release checklist, then merge `develop` → `main` (178 commits ahead, `main`'s
last reachable tag is `v0.27.0`) and tag. Age = days since created_at. Grouped
by priority (P0 critical · P1 high · P2 normal/medium · P3 low · backlog)._

## Start here (2026-08-24)

**v0.31.0 is published.** `npm view @vytches/ddd` → `latest: 0.31.0`, all 19
packages, released 2026-08-22 via PR #87. VF-036's AC-SIGNOFF — the gate the
2026-08-21 note called "the one gate on the tag" — was collected the next day
and the release went out. `main` was reset to origin and `develop` recreated
from it. VF-036 sat in `tasks/` with `status: done` and every AC checked until
2026-08-23; archived now.

**What that changes.** Every "before first publish" framing on this board has
expired. Breaking changes are no longer free: the packages are public and at
least one downstream application is running 0.31.0 in anger. Judge remaining
tasks by _defect severity to a real consumer_, not by _how cheap the decision is
today_ — that second axis no longer exists.

**Next thing:**

1. **VT-006** / **VT-007** — top of P2, both test debt: policies decorator
   coverage (temporal/cached/retry) + `testing` pkg hardening (~10h), or
   re-enabling the skipped domain-services e2e suite (~5h). P1 is empty — this
   is the actual next work.

\_**VB-005** (benchmark harness repair) shipped 2026-08-25 — see the header note
above; P1 is now empty. **VB-008** (policy behaviours — composition-wrapper fix

- factory export shape) shipped 2026-08-25 — see the header note above.
  **VF-025** (event/projections/resilience/cqrs patch hardening) shipped
  2026-08-24 — see "Shipped and archived" below. **VF-033** (validation
  hardening) shipped 2026-08-23 — see "Shipped and archived" under P1.\_

**Two things a newcomer to this board should not have to rediscover:**

- **Vitest green is not evidence in this repo.** It runs through esbuild, which
  strips types without checking them. Four defects in two days passed Vitest and
  were caught by `tsc`. Always also run
  `nx run <pkg>:type-check --skip-nx-cache` — the `--skip-nx-cache` is not
  decoration, a stale cache produced a false pass.
- **Prettier reformats these tables.** Editing a board row by exact-string match
  silently misses after a `prettier --write`; two completed tasks sat on the P2
  board for a day that way. Match on the ID, verify afterwards.
- **`@vytches/ddd-nestjs:test` has a flaky test.** A lone failure that clears on
  re-run is that, not a regression — Nx says so itself ("Nx detected a flaky
  task"). Never reach for `--no-verify`.

---

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
> plus a consumer-reported incident (`getEqualityComponents()` docs-phantom API
> → **VF-036**, P1) spawned four consolidated tasks: **VF-037** (standing
> cross-context isolation regression suite + behavioral-BC checklist, P1),
> **VD-008** (docs truth & parity sweep + docs-compile-gate extension, P2),
> **VT-007** (re-enable domain-services e2e, P2), **VD-009** (priority example
> workspaces, P3). **VP-012 promoted P2→P1** (confirmed-live runtime hot paths).
> **VD-004/VF-002 demoted P2→P3** (docs-site/strategic-docs — no runtime value;
> explicit owner decision: runtime behavior > linters/docs).
>
> **Release sequencing (owner decision, 2026-08-09)**: (1) merge the existing
> alpha branch (`release/2026-07-18-alpha`, 0.31.0-alpha.0 — already merged into
> `develop` via `d836beeb`) to **`main`** first; (2) all tasks below are
> implemented **on top of** that state, branching from `develop`; (3) VF-036
> additionally requires the downstream consumer's full-suite run on a patched
> build before any npm tag that includes it (its AC5).

> **Pulse (2026-08-19, 37-day gap)**: since the last sync, **VF-036** landed
> code (`c88e728e`) — only AC-SIGNOFF (consumer full-suite run) is outstanding,
> and it is now the sole thing blocking the npm tag. **VF-037** shipped in full
> (`c393a04b`) — archived to `completed-tasks/` 2026-08-19. **VF-039** was split
> same-day into **VF-039a** (revert-ban, design-complete, ready to ship) and
> **VF-039b** (churn-guard, deprioritised — open architecture question on where
> the churn ledger lives, not a blocker on anything else).
>
> **Correction, same day**: `/pulse` initially reported **VF-028** as "branch
> active, task file not yet updated" — a direct user check ("czy 028 właśnie nie
> skończyliśmy?") caught that the pulse's own read was stale. VF-028 was in fact
> implemented and committed the same day (`05ac364a`); only its task-file
> metadata lagged. Verified before archiving: `@vytches/ddd-resilience` 104/104
> and `@vytches/ddd-policies` 237/237 tests green; the 3 failures seen in an
> ad-hoc `@vytches/ddd-cqrs` run are pre-existing (`git blame` traces them to
> 2025-08-23, untouched by this commit) and unrelated. Archived to
> `completed-tasks/` alongside VF-037. Also found: **VP-012**'s task file still
> reads `priority: normal` despite the 2026-08-09 note above recording its P2→P1
> promotion — flagged for the next `/task-tidy`, not corrected here (no owner
> confirmation on the intended priority value, unlike VF-028/VF-037 where git
> history was conclusive). Owner decision this session: collect VF-036's
> sign-off, run the full release checklist, **then** merge `develop` → `main`
> (currently 178 commits behind, `main`'s last reachable tag is `v0.27.0`) and
> tag/publish.

> **Runtime series, 2026-08-20/21 — seven tasks shipped, all merged to
> `develop`.** Started from a backlog review filtered on "changes behaviour for
> a consumer at runtime"; only six of the then-22 tasks qualified. Each note
> below is compressed — the full record is in `completed-tasks/`.
>
> - **VF-032** split into **VF-032a** + **VF-032b**, both done. `forRootAsync()`
>   added; `forFeature()` now builds its buses through `CQRSConfiguration`, so
>   `busType: 'enhanced'` and `middlewares` finally reach a bounded context —
>   before this, adopting `forFeature()` silently cost a context its resilience
>   and metrics. One documented module pattern; `forContext`/`forContexts`
>   deprecated (they left the buses shared, so they never isolated anything).
>   Five raw `new Error` sites replaced by a typed hierarchy. Ghost
>   `types/index.ts` deleted after a three-agent panel rejected reviving it. New
>   runnable e2e example under `examples/nestjs/`.
> - **VF-027** — `fork()`/`withAttempt()` rewritten onto native
>   `AbortSignal.any()`/`timeout()`. Three listener leaks (retry SA-M12,
>   bulkhead ×2 UX-C6) close structurally: nothing is registered that could
>   leak, so a missed `dispose()` is harmless. `dispose?()` kept as a documented
>   no-op.
> - **VB-007** — `PolicyCachingBehavior` deduplicates concurrent identical
>   checks; N simultaneous misses on one key invoke the inner policy once.
> - **VP-006c** + **VP-006d** — `BaseContainerAdapter` gains a `tryResolve()`
>   hook (one lookup per constructor parameter instead of two) and Set-backed
>   cycle detection; `NestJSContainerAdapter` then dropped its VP-006b override,
>   so cycle detection lives in one place instead of two divergent copies.
> - **VF-040** — `@vytches/ddd-nestjs` brought under the api-surface gate (5
>   packages covered, was 4). Needed a per-package
>   `tsconfig.api-extractor.json`: the repo-wide `paths` send api-extractor into
>   dependency _source_, where it hits an api-extractor 7.57.8 internal defect.
>   **Anyone extending the gate to the remaining 14 packages will hit the same
>   wall** — see the task's outcome note.
>
> **Three behavioural changes a consumer would notice**, all deliberate, all
> inside the pre-publish window:
>
> 1. `autoDiscovery.enabled` was an inert switch and now works (VF-032a D8) —
>    same defect class as VB-006's `cacheFailures`.
> 2. A timed-out `fork()` now aborts with a `DOMException` named `TimeoutError`
>    rather than this package's `TimeoutError` class (VF-027 D3). `reason.name`
>    checks unaffected; `instanceof` on a fork reason is not.
> 3. Policy-check deduplication is on by default, with no opt-out (VB-007 D1).
>
> **Recurring lesson, four times in two days:** `tsc` caught defects Vitest
> passed — a variance error, an `apply()` visibility violation an example would
> have taught consumers, a constructor-type mismatch, and a `Function`/
> `Constructor` narrowing bug. Vitest runs through esbuild, which strips types
> without checking them. A green Vitest run is **not** evidence for `nestjs`;
> `nx run <pkg>:type-check --skip-nx-cache` is the gate that checks anything.
> (`--skip-nx-cache` matters: a stale cache produced a false pass during
> review.)

## P0 — Critical

_Empty._

> **Shipped (2026-08-20)**: **VB-006** done — `PolicyCache` v2. The
> `cacheFailures` dead switch now honours an explicit `false`; caches from the
> TTL and custom-key factories are bounded by a default size instead of growing
> without limit; the write path separates inserts from updates, so a re-set no
> longer evicts an unrelated entry, corrupts LRU ordering or inflates the entry
> count; `enableMetrics` — a fourth dead option found during implementation — is
> honoured too. New contract test covers every option of the public cache
> config. Purely behavioural: both barrels untouched, `maxSize` stays optional.
> Six commits on `fix/VB-006-policy-cache-v2`, archived to `completed-tasks/`.
> Spawned **VB-007** and **VB-008**.

_VS-016 (the prior sole P0) shipped 2026-07-10._

## P1 — High

_Runtime-value first (owner directive 2026-08-09): things that change or protect
how the library behaves at run time outrank docs/lint work. Re-prioritised
2026-08-21 after the runtime series — the six runtime-impacting tasks that
review found are now six done, one left (VF-025, P2; VF-033 shipped 2026-08-23).
What ranked P1 after that was the release gate and the decisions whose window
closed at first publish — **both are gone as of 2026-08-23**: the gate (VF-036)
was collected and v0.31.0 shipped, and the window closed with it, which is why
VB-008 went back to P3. VB-005, the one remaining tooling defect, shipped
2026-08-25 — P1 is now empty._

_Empty._

> **VB-005 shipped 2026-08-25.** Root cause was not the `tsconfig.json`
> `rootDir` hypothesis in the original task — it was
> `benchmarks/vitest.config.mts`'s object-form `resolve.alias`, whose
> string-prefix matching silently mangled the `@vytches/ddd-contracts/internal`
> subpath import into a broken path (`ENOTDIR .../index.ts/internal`). Fixed to
> array form with subpath entries before base entries, the same shape already
> proven in the root config and `packages/nestjs/vitest.bench.config.ts` under
> VF-024 — and extended to a second, undiscovered instance of the identical bug
> in `@vytches/ddd-events/internal`, which would have failed immediately after
> the first fix if left unaddressed. `Money`'s missing `validate()` in
> `hot-paths.bench.ts` (a real compile-time defect, masked until the alias was
> fixed) was fixed alongside it. `benchmarks/README.md` now documents a
> result-count check, not just exit code, as the standard for "the harness
> works" — the include glob covers every `*.bench.ts` file, so a future added
> suite could otherwise mask a silent collection failure the same way. Verified
> via a real `pnpm run bench` run, not just static review: exit 0, all 11
> `hot-paths.bench.ts` results present. `library-quality-verifier` GO. Deferred
> without prejudice (analysis `open_questions`, all answered "not now"): CI
> wiring for `bench`, `baseline.json` re-capture, a `type-check` target for
> `benchmarks/`. Committed `bf8d54cc` on `fix/VB-005-benchmark-harness-broken`,
> archived to `completed-tasks/`.

> **VB-008 shipped 2026-08-25.** Demoted P1 → P3 on 2026-08-23 (pre-publish
> window closed), then `/analyze VB-008` (2026-08-21, re-run under the
> post-publish constraint) rejected the original class→interface+factory premise
> (ADR-0012 already accepted the factory-method shape) and narrowed scope to:
> preserve the behaviour wrapper across `and()`/`or()`/`when()` composition (a
> live defect in all seven published releases, AC1), rename the three
> static-only factory classes to frozen objects with identical call syntax (AC2,
> invisible to callers — no major bump needed), name the cache metrics return
> type (AC3), collapse `create()`/`withDefaults()` (AC4, deprecation-window, not
> a hard cut), plus working examples and a CI retired-symbol grep gate
> (AC5/AC6). `/orchestrate VB-008` (2026-08-25) found all seven ACs already
> implemented and committed, verified GO independently
> (`library-quality-verifier`, fresh non-cached gate runs). No merge needed —
> branch was already at the same commit as `develop`. Four changesets await
> release:
> `.changeset/vb-008-{composition-wrapper-loss,factory-namespace-shape, cache-metrics-type,withdefaults-deprecation}.md`.
> Archived to `completed-tasks/`.

_Shipped and archived to `completed-tasks/` 2026-08-19: **VF-028** (resilience
correctness, `05ac364a`), **VF-037** (isolation regression suite + behavioral-BC
gate, `c393a04b`), **VF-039a** (orchestration revert-ban: absolute
`git checkout`/`restore`/`stash`/`reset` ban + incident note, landed in
`/opt/projects/claude-patterns` `f646dda`; AC-LINT-GATE/AC-DEPLOY closed earlier
same day by other work, `83019997`). 2026-08-20: **VP-012** (hot-path quick wins
— cqrs single race, aggregates getDomainEvents() memoization, policies
combined-digest cache key; 3 units via `/orchestrate`, `98e53666`). AC4
(benchmark proof) formally unmet — pre-existing broken harness, spun off as
**VB-005**. 2026-08-23: **VF-033** (validation hardening — `CoreRules`
`minLength`/`maxLength`/`range` no longer coerce absent values, `.and()`
flattens errors instead of collapsing them, `ValidationError.code`, async
short-circuit JSDoc, decision-tree guide linked from three LLMGUIDEs, `testing`
seeder rename). 2026-08-24: **VF-025** (patch scope A+C+E+G, `4801b799` —
events: WARN-only handler dedup + autoRegisterHandlers catch diagnostics;
projections: `clearProjectionState` deletes one projection not all + opt-in
checkpoint resume; resilience: circuit-breaker HALF_OPEN failureCount reset +
immediate-retrip rule shipped as one unit; cqrs: `registerTyped()`/
`registerFactoryTyped()` + overwrite warn. Remaining original scope (retryConfig
classification, error-propagation, autoRegisterHandlers opt-in flip, resilience
metrics wire-up) deferred, reserved names `VF-025b/c/d`, no task files filed yet
— see the task's own "Zamknięcie" section before picking that up). 2026-08-25:
**VB-005** (benchmark harness repair — `resolve.alias` array-form fix in
`benchmarks/vitest.config.mts` for both `contracts/internal` and
`events/internal` subpaths, `Money.validate()` added, README verification notes,
`bf8d54cc`)._

## P2 — Normal / Medium

_2026-08-20 review found six runtime-impacting tasks; VF-033 shipped 2026-08-23,
VF-025 shipped 2026-08-24 (six of six done — see "Shipped and archived"). Board
now clear of runtime defects. Next: VT-007/VT-006 (test debt), then docs &
tooling (VD-008, VF-038, VF-034, VD-006b)._

| ID      | Title                                                           | Status  | Age |
| ------- | --------------------------------------------------------------- | ------- | --- |
| VT-007  | Re-enable domain-services e2e suite (missing container classes) | backlog | 11d |
| VT-006  | Policies test coverage + testing pkg hardening                  | backlog | 49d |
| VD-008  | Docs truth & parity sweep + docs-compile-gate extension         | backlog | 11d |
| VF-038  | Give docstring quality its own lint lane                        | backlog | 8d  |
| VF-034  | Dead-code detection (knip/ts-prune) informational CI check      | backlog | 41d |
| VD-006b | Semantic combination-sanity evaluator harness + pilots (R&D)    | backlog | 47d |

## P3 — Low

| ID      | Title                                                        | Status  | Age  |
| ------- | ------------------------------------------------------------ | ------- | ---- |
| VF-039b | Churn guard — blocked on churn-ledger placement decision     | blocked | 0d   |
| VD-009  | Priority example workspaces (repos+UoW, outbox, CQRS+resil.) | backlog | 10d  |
| VD-004  | Interactive Documentation System                             | backlog | 141d |
| VF-002  | Strategic Design Documentation                               | backlog | 141d |

## Backlog

_Deliberately set aside (2026-07-11) — revisit after the P1 pre-publish pipeline
clears, not a current priority. Its own demand-signal window (`~2026-08/09`) is
now current — worth a direct check with the maintainer this week rather than
leaving it another pulse cycle._

| ID     | Title                                          | Status  | Age |
| ------ | ---------------------------------------------- | ------- | --- |
| VA-001 | @vytches/ddd-agent — AI Agent DDD Boundary Pkg | backlog | 91d |

---

**`/pulse` sync (2026-07-12)**: corrected a stale framing — VS-013 (app-logging
removal) closed **2026-06-05**, and VS-006/VS-008 are also `done`. The only open
item is the owner's manual juz-ide-api sign-off, **deliberately deferred by
prior authorization, not overdue** (no deadline was ever set). **VP-006b**
merged to `develop` 2026-07-12 (`cf4029dd`) — task file needed `/task-tidy`
archival, flagged above.

**`/task-tidy` sync (2026-07-18)**: **VP-006b** reconciled and archived to
`completed-tasks/` — see updated header note above.

**`/pulse` sync (2026-08-19, 37-day gap)**: VF-036 code-complete (`c88e728e`),
AC-SIGNOFF (consumer full-suite run) is now the **sole** gate on the npm tag.
VF-037 shipped (`c393a04b`), archived. VF-039 split into VF-039a (ready) /
VF-039b (deprioritised, blocked on a design question). VP-012's
`priority: normal` field never caught up with its 2026-08-09 P2→P1 promotion —
flagged for `/task-tidy`. VA-001's own demand-signal window (`~2026-08/09`) is
now open — worth a direct maintainer check this week.

**Same-day correction**: VF-028's task file was initially found stale
(`status: backlog` despite an active branch) and reported as still open. A
direct user question ("czy 028 właśnie nie skończyliśmy?") prompted a re-check:
VF-028 was in fact implemented, tested, and committed the same day (`05ac364a`)
— the pulse's own read was the stale artifact, not the work. Verified
(resilience 104/104, policies 237/237 tests green; the 3 `@vytches/ddd-cqrs`
failures seen in an ad-hoc run predate this commit per `git blame` and are
unrelated) and archived to `completed-tasks/` alongside VF-037. Owner decision:
collect VF-036's sign-off → full release checklist → merge `develop` → `main`
(178 commits ahead, `main` last tagged `v0.27.0`) → tag/publish.

**Recommended next action (updated 2026-08-19)**:

1. **VF-036 AC-SIGNOFF** — the sole remaining code-side gate: get the consumer's
   full-suite run on the patched build, record the sign-off.
2. **Full release checklist** (`release-process.md`) — tests, `validate:api`,
   behavioral-BC checklist, coverage — once VF-036 is signed off.
3. **Merge `develop` → `main`** and tag/publish. The old
   `release/2026-07-18-alpha` branch needs no separate handling — it's already
   fully inside `develop` (`d836beeb`).
4. Then P2 runtime-adjacent (VF-025, VT-007, VP-012), and only after that the
   docs sweep **VD-008** — important for release credibility, but it changes no
   runtime behavior.

Full audit trail: `analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md` (new),
`LIB-AUDIT-2026-07-02.analysis.md`, `SEC-AUDIT-2026-07-09.analysis.md`,
`LIB-UX-AUDIT-2026-07-10.analysis.md`.
