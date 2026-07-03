---
task: VB-003-nestjs-forfeature-di-wiring
status: approved
threat_model: docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md
rag:
  'skipped (.claude/config/knowledge.json not found — no knowledge-retriever MCP
  configured for this project)'
patterns: []
open_questions:
  - id: OQ-1
    question:
      'ADR-0034 (cross-context handler leakage) is referenced by name in code
      comments (feature-handler-registrar.ts) but its file could not be located
      under docs/adr/ — the README index only lists ADR-0001..0019 (a known gap,
      itself finding F-M11). Confirm the actual filename/slug for ADR-0034 so
      its precedent can be formally cited.'
    answer:
      'Resolved: docs/adr/0034-per-context-cqrs-bus-isolation.md (2026-05-23,
      accepted, Phases 1-3 implemented). Confirmed by direct read: it documents
      exactly the cross-context command/query routing collision this task
      regresses, including the ModulesContainer dependency called out in its own
      Consequences section as a known, low-risk internal-API dependency. Cite
      this ADR directly in the VB-003 commit/PR.'
  - id: OQ-2
    question:
      "AutoDiscoveryService (task AC #6, described in the source audit as a
      'public no-op') could not be found anywhere in the current
      packages/nestjs/src tree or its public exports. Was it already removed in
      a prior cleanup (e.g. VB-002, commit 82d92fdc)? If so, AC #6's
      AutoDiscoveryService sub-item should be marked already-resolved rather
      than active work."
    answer:
      "Resolved (correction, not removal): it exists at
      packages/nestjs/src/discovery/auto-discovery.service.ts, but was never
      exported from the package's public barrel (packages/nestjs/src/index.ts
      has no re-export of it or ./discovery) — the audit's 'public' framing was
      inaccurate, but 'no-op' is confirmed: discover() -> getAllModules() is
      hardcoded to return [] with a comment admitting it's unimplemented, so the
      loop body never runs. Its only test (auto-discovery-perf.test.ts) bypasses
      discover()/getAllModules() entirely, calling the private processClass()
      directly via an (as any) cast, so the existing suite does not depend on
      the broken entry point. VytchesExplorerService is the real, working
      auto-discovery mechanism. Decision: remove AutoDiscoveryService and
      auto-discovery-perf.test.ts as dead code superseded by
      VytchesExplorerService (do not implement getAllModules() to make it real
      -- that would duplicate VytchesExplorerService's responsibility). AC #6
      wording should read 'dead internal service, never publicly exported'
      rather than 'public no-op'."
  - id: OQ-3
    question:
      "Does the primary downstream consumer application actually call
      forRootAsync() anywhere? This determines whether F-H8 should be fixed (if
      used) or removed from the public API (if unused, per the panel's unanimous
      recommendation). Needs a grep in the consumer's codebase, which is outside
      this repo."
    answer:
      "Resolved -- confirmed NOT used, verified directly in the consumer's
      codebase. Zero call sites of VytchesDDDModule.forRootAsync() (the only
      forRootAsync hits in that repo belong to unrelated NestJS modules, e.g.
      ClsModule/ThrottlerModule). Bigger picture: the consumer does not call
      VytchesDDDModule.forRoot(), .forFeature(), .forContext(), or
      .forContexts() anywhere either -- it wires the library via a single
      hand-rolled wrapper module that imports VytchesExplorerService directly
      and constructs EnhancedCommandBus/EnhancedQueryBus manually as one global,
      app-wide instance, driving discovery itself from onApplicationBootstrap().
      This fully confirms D-2 (remove forRootAsync) is safe with respect to this
      consumer. It also means this specific consumer is not currently exposed to
      F-C4 in production, since it never invokes forFeature() -- see the new
      process note below."
  - id: OQ-4
    question:
      'Do any consumer applications pass the 6 confirmed-dead
      VytchesDDDModuleOptions fields (bridgeToNestJS, performance, handlers,
      monitoring, globalBridgeToNestJS, enableContexts) to
      forRoot()/forContexts()? TypeScript excess-property checks mean removing
      these fields from the interface is a compile-time break for any caller
      that still passes them, even though they are runtime-dead. Needs
      confirmation before a no-deprecation-cycle removal is safe.'
    answer:
      'Resolved -- moot for the primary consumer, verified directly: it never
      calls forRoot()/forContexts() at all (see OQ-3), so it cannot be passing
      any VytchesDDDModuleOptions fields, dead or otherwise. Zero grep hits for
      bridgeToNestJS/globalBridgeToNestJS/enableContexts in that codebase,
      consistent with this. Fully confirms D-5 (remove the 6 dead fields with no
      deprecation cycle) is safe with respect to this consumer.'
  - id: OQ-5
    question:
      'Is ModulesContainer actually exported from the public @nestjs/core barrel
      (not just the deep injector path) across both supported peer versions (^10
      and ^11)? This determines whether the F-M19 fix (replacing the deep
      import) is a safe drop-in or needs a version-conditional approach. Prior
      deep-import history (CHANGELOG 0.29.1/0.29.2) suggests the original
      deep-import choice may have been forced by an ESM/vite-node resolution
      issue specific to that path, not just a stylistic preference — needs to be
      re-verified against the current installed @nestjs/core, ideally with an
      actual ESM/vite-node build+run, not just vitest.'
    answer:
      "Cannot be verified from this environment -- no node_modules are installed
      anywhere on disk (no @nestjs/core present to inspect). Do not guess; treat
      this as a build-phase verification gate rather than an analysis-phase
      fact. Before merging the F-M19 fix: run an actual dual ESM/CJS build plus
      a vite-node execution against the currently pinned @nestjs/core version
      (matching the repo's prior regression history in CHANGELOG 0.29.1/0.29.2,
      which vitest alone did not catch). If ModulesContainer is not resolvable
      from the public @nestjs/core barrel in either supported peer major (^10 or
      ^11), keep the deep import for F-M19 rather than forcing a swap that
      reintroduces the same ESM-resolution bug class this repo has already hit
      twice."
  - id: OQ-6
    question:
      "The architecture panel flagged a residual race: even after the F-C4
      one-line fix, local handler 'claim' (in onModuleInit of the feature
      module) and the global explorer's fallback registration (also
      onModuleInit, in a different module) run in the same NestJS lifecycle
      phase with no guaranteed inter-module init order. Does closing
      TM-VB-003-001 (the Critical DREAD finding) require an explicit ordering
      guarantee (e.g. deferring global registration to onApplicationBootstrap),
      or is the current onModuleInit-only design considered acceptable residual
      risk? This changes the size/scope of the F-C4 fix from '1 line' to '1 line
      + lifecycle-phase change'."
    answer:
      "Resolved -- the architect's concern does not apply here, verified
      directly in code. VytchesExplorerService already implements the two-phase
      split ADR-0034 Phase 3 specifies: onModuleInit() (line ~92) does discovery
      only, and onApplicationBootstrap() (line ~140) carries an explicit code
      comment 'Runs after all onModuleInit() hooks complete, so
      FeatureHandlerRegistrar [claims are visible]' before performing global
      fallback registration, which explicitly skips types already claimed via
      claimHandlerTypes() (called by FeatureHandlerRegistrar during its own
      onModuleInit()). NestJS guarantees onApplicationBootstrap runs strictly
      after ALL modules' onModuleInit hooks app-wide -- this is not an
      assumption, it's documented NestJS lifecycle ordering. So local claim
      always completes before global fallback registration is even attempted, by
      design, independent of inter-module onModuleInit ordering. The F-C4 fix
      remains a genuine 1-line change; no lifecycle-phase change is needed.
      Action item: add an explicit e2e assertion (part of AC #2 / D-8) that a
      claimed handler is never present on the global bus after full app
      bootstrap, to pin this guarantee down as a regression test rather than
      leaving it as implicit design intent."
  - id: OQ-7
    question:
      'Confirm the F-M5 duplicate-registration guard design before
      implementation: a per-bus ledger (not per-explorer) keyed by (messageType,
      handlerType, busId) for idempotent command/query dedup, (messageType,
      busId) hard-error for genuine conflicts, and (eventType, handlerType,
      busId) dedup for the multi-handler event bus. Also confirms scope: adding
      a real configureContext() method on VytchesExplorerService to replace the
      current private-field cast, making strictHandlerRegistration reachable
      from forContext()/forContexts() as required by AC #4.'
    answer:
      'Confirmed -- adopt the D-3 design as specified: a bus-scoped registration
      ledger (keyed by (messageType, handlerType, busId) for idempotent
      command/query dedup, (messageType, busId) hard-error for genuine
      conflicts, (eventType, handlerType, busId) dedup for the multi-handler
      event bus), plus a real configureContext(config) method on
      VytchesExplorerService replacing the current unsafe private-field cast. No
      changes to this design from the panel proposal.'
  - id: OQ-8
    question:
      'Is the pre-existing behavior where multiple forFeature() calls with the
      SAME contextName receive separate LOCAL_EVENT_BUS instances (each
      UnifiedEventBus is a fresh useFactory-created instance) in scope for
      VB-003, or should it be split into a follow-up task? Flagged by the
      architecture panel as a latent issue, not one of the original 5 findings.'
    answer:
      "Out of scope for VB-003. It is not one of the 5 audited findings and
      expanding this task's estimated 8h scope to redesign LOCAL_EVENT_BUS
      sharing across same-named forFeature() calls is not justified here. Track
      as a separate, lower-priority follow-up finding discovered during this
      analysis (add to the backlog/KANBAN, not to VB-003's acceptance criteria)."
  - id: OQ-9
    question:
      "FeatureHandlerRegistrar.findOwnModule() Step 2 reads the private
      Module.imports Set via an unsafe cast — the same class of internal-API
      fragility as F-M19 (deep import), but not covered by that finding's scope.
      Should this be included in VB-003's F-M19 fix, or tracked as separate tech
      debt?"
    answer:
      "Partial inclusion: bundle a minimal defensive guard into the F-M19 fix --
      a runtime shape-check (e.g. verifying Module.imports is actually a Set
      before use) that throws a clear, actionable error if NestJS's internal
      shape changes, instead of the current silent-cast failure mode. Do NOT
      attempt the larger architectural replacement (swapping to a public
      DiscoveryService-based traversal) within VB-003 -- track that as separate
      tech debt, consistent with the architect panel's own framing of it as 'a
      real debt, but a separate task.'"
  - id: OQ-10
    question:
      "Sign off on the proposed test plan before implementation starts: (a)
      relabel the existing feature-handler-registrar.test.ts algorithm-level
      tests as 'algorithm-only, does not cover DI wiring' rather than rewriting
      them outright, (b) add real .init() calls to the existing
      global-bus-acl.test.ts CT-3 tests (currently calls compile() but never
      init(), so onModuleInit — where the F-C4 bug lives — never runs), (c) add
      a new e2e test file with a real
      Test.createTestingModule().compile()+app.init() cycle plus an explicit
      ModulesContainer identity/size probe (asserting container
      size/reference-equality to the root-resolved container, not just
      behavioral outcome), (d) run a repo-wide search for the
      bare-class-in-providers pattern (providers: [...ModulesContainer...])
      across packages/nestjs/src to rule out the same bug class recurring
      elsewhere before closing VB-003."
    answer:
      'Confirmed -- adopt the D-8 test plan as the acceptance bar for AC #2 and
      AC #8, exactly as specified. No changes from the panel proposal.'
decisions:
  - id: D-1
    decision:
      "F-C4 fix: remove ModulesContainer from the providers array in
      VytchesDDDFeatureModule.forFeature(). No additional import (e.g.
      DiscoveryModule) is required — ModulesContainer is provided globally by
      NestJS's InternalCoreModule regardless of what the consuming module
      imports."
    rationale:
      "Confirmed by the architecture panel: listing a bare class in `providers`
      is shorthand for `{ provide: X, useClass: X }`, which instantiates a fresh
      instance that shadows the global one in this module's injector scope.
      Removing the line lets resolution fall through to the global singleton,
      matching the code's own comment ('ModulesContainer is provided by NestJS
      InternalCoreModule (global)') and the audit's empirical probe (size=0
      local vs size=3 global)."
    adr: null
    propose_adr: false
  - id: D-2
    decision:
      'Recommend REMOVING forRootAsync() from the public API before the first
      publish, rather than fixing it — pending confirmation via OQ-3.'
    rationale:
      "Both the architecture panel and library-api-guardian independently
      converged on removal. Architectural argument: DynamicModule's
      imports/exports/global/providers shape must be known synchronously at
      module-registration time; a true async useFactory can only ever feed a
      value provider, never legitimately drive `global` or splice `...providers`
      — so 'fixing' this method can only produce a narrower,
      confusingly-similar-but-not-equivalent version of forRoot(), not real
      parity. API-guardian argument: this is the cheapest point in the library's
      lifecycle to remove a method whose declared contract (useFactory/inject
      configurability) was never actually honored — post-publish, removal
      becomes a breaking change; pre-publish, it is free. If OQ-3 reveals real
      usage, fall back to fixing it via a dedicated OPTIONS_TOKEN pattern,
      keeping useFactory/inject strictly isolated from the shared bridge tokens
      (ICommandBus/IQueryBus) to avoid the circular-dependency hazard the
      architect flagged."
    adr: null
    propose_adr: true
  - id: D-3
    decision:
      'F-M5 guard: implement a bus-scoped registration ledger (not
      explorer-scoped), keyed by (messageType, handlerType, busId) for
      idempotent command/query dedup and (messageType, busId) for hard-error
      conflict detection; event bus dedup by (eventType, handlerType, busId)
      since multiple handlers per event type are legitimate. Add a real
      configureContext(config) method on VytchesExplorerService to replace the
      current unsafe private-field cast, so strictHandlerRegistration becomes
      reachable from forContext()/forContexts() per AC #4.'
    rationale:
      "The root cause of duplicate registration is multiple explorer instances
      (forRoot + forContext), so the dedup ledger must live above any single
      explorer's lifetime — pinning it to the bus instance neutralizes the 'many
      explorers' problem at the point of registration, without needing to
      deduplicate the explorers themselves."
    adr: null
    propose_adr: false
  - id: D-4
    decision:
      'Remove the @deprecated tag from the `contexts` field in
      VytchesDDDModuleOptions immediately — it is actively read by forContexts()
      and the tag is simply incorrect documentation.'
    rationale:
      'Doc-only correction, zero behavioral change, zero consumer risk. No
      reason to bundle with the riskier dead-field removal (D-5).'
    adr: null
    propose_adr: false
  - id: D-5
    decision:
      'Remove the 6 confirmed-dead fields (bridgeToNestJS, performance,
      handlers, monitoring, globalBridgeToNestJS, enableContexts) from
      VytchesDDDModuleOptions in a single cut, with no formal deprecation cycle
      — conditional on OQ-4 confirming zero call sites pass them today.'
    rationale:
      "Pre-first-publish window means no external npm consumers exist yet who
      would need a deprecation-cycle warning. However, TypeScript's
      excess-property checks on object literals mean any caller (including the
      primary internal consumer application, which is a live workspace
      dependent, not an npm consumer) that still passes these fields will hit a
      compile error the moment they're removed from the interface — this must be
      verified, not assumed, before removal."
    adr: null
    propose_adr: false
  - id: D-6
    decision:
      'F-M19 fix: replace the deep import of
      @nestjs/core/injector/modules-container.js with the public @nestjs/core
      barrel import — conditional on OQ-5 confirming the export exists across
      both supported peer major versions and re-validating against an actual
      ESM/vite-node build, not just the vitest unit suite.'
    rationale:
      'The prior CHANGELOG history (0.29.1 ERR_UNSUPPORTED_DIR_IMPORT, 0.29.2
      needed explicit .js extension for vite-node) shows this exact area has
      already broken twice under ESM tooling in ways vitest alone did not catch.
      Reverting to a public import is architecturally preferable (less fragile
      against internal NestJS refactors) but must be verified with the same
      rigor that surfaced the original two regressions, or it risks
      reintroducing a third variant of the same class of problem.'
    adr: null
    propose_adr: false
  - id: D-7
    decision:
      'Remove AutoDiscoveryService
      (packages/nestjs/src/discovery/auto-discovery.service.ts) and its test
      file (tests/auto-discovery-perf.test.ts) as dead code, superseded by
      VytchesExplorerService. Do not attempt to implement getAllModules() to
      make it functional.'
    rationale:
      "Verified directly via grep + code read (superseding the earlier,
      incorrect 'class does not exist' finding from OQ-2's first pass): the
      class exists but was never exported from the package's public barrel
      (packages/nestjs/src/index.ts), and its only entry point (discover() ->
      getAllModules()) is hardcoded to return an empty array, making it a
      genuine no-op -- just an internal one, not a public one as the source
      audit framed it. Its existing test suite bypasses the broken entry point
      entirely (calls the private processClass() method directly), so removing
      the class carries no test-coverage loss for anything actually exercised.
      VytchesExplorerService already provides the real, working auto-discovery
      mechanism; keeping a second, non-functional parallel implementation around
      is pure maintenance liability."
    adr: null
    propose_adr: false
  - id: D-8
    decision:
      'Adopt the proposed test plan from OQ-10 as the acceptance bar for AC #2
      and AC #8: a real compile()+init()+close() e2e test with an explicit
      ModulesContainer identity/size probe (not behavioral assertions alone),
      relabeled (not necessarily rewritten) unit tests for the findOwnModule()
      traversal algorithm, an added .init() call in the existing
      global-bus-acl.test.ts, and a repo-wide check for the same
      bare-class-in-providers pattern elsewhere in the package before closing
      the task.'
    rationale:
      "library-quality-verifier's analysis showed concretely why the existing
      tests miss F-C4: one mocks ModulesContainer as a plain Map (never
      exercises real DI shadowing), the other calls compile() but never init()
      (so onModuleInit, where the bug lives, never executes). Behavioral
      assertions alone (AC #2's a/b/c) are necessary but not sufficient as a
      regression gate, because a future refactor could reintroduce shadowing in
      a way that still happens to pass a single-module-topology behavioral test."
    adr: null
    propose_adr: false
units: null
---

# VB-003 — NestJS `forFeature()` DI wiring fix: analysis

## Summary

The task targets a confirmed CRITICAL defect (F-C4) plus four related findings
(F-H8, F-M5, F-M15, F-M19) in `@vytches/ddd-nestjs`, all originating from the
`LIB-AUDIT-2026-07-02` library-wide audit. Direct code reads confirm every
finding is currently active in the source tree — none are stale except possibly
the `AutoDiscoveryService` sub-item of AC #6 (see OQ-2).

**Root cause (F-C4):** `VytchesDDDFeatureModule.forFeature()` lists the bare
class `ModulesContainer` in its `providers` array. In NestJS, a bare class in
`providers` is shorthand for `{ provide: X, useClass: X }` — this instantiates a
_fresh, empty_ `ModulesContainer` scoped to the feature module, shadowing the
real global singleton that NestJS's `InternalCoreModule` would otherwise inject.
`FeatureHandlerRegistrar.findOwnModule()` then iterates zero modules, always
returns `undefined`, logs a warning, and skips local bus registration. Because
the handler's message type is never "claimed," the library's global explorer
(registered via `forRoot()`) picks it up and registers it on the **global**
command/query/event bus instead — this is precisely the cross-context handler
leakage that ADR-0034 previously fixed, now regressed.

**Threat modeling** (full STRIDE/DREAD/LINDDUN run, level 3 — cross_context +
public_api both matched) confirms this is genuinely security-relevant: DREAD
score 14 (Critical) for cross-context Information Disclosure, because a handler
in one bounded context can end up processing a domain event that originated in a
different context whenever two contexts happen to use the same event class name.
See `docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md` for
the full analysis, DFD, attack tree, and DREAD register (4 findings total, 1
Critical / 2 High / 1 Medium).

**The fix for F-C4 itself is a one-line change** (remove `ModulesContainer` from
`providers`) and the architecture panel confirmed this is the correct root-cause
fix, not a band-aid. However, the panel also surfaced a residual risk not in the
original findings list (OQ-6): even after the fix, local "claim" and global
"fallback registration" both run in the `onModuleInit` lifecycle phase across
different modules, and NestJS does not guarantee inter-module init ordering — so
a race between the two may persist. This needs an explicit decision before the
fix can be considered complete for the Critical DREAD finding, not just for the
narrower "does findOwnModule() return a value" bug.

## Panel findings by area

**Architecture** (see decisions D-1, D-2, D-3 and open questions OQ-6, OQ-8,
OQ-9): confirmed F-C4's root cause and fix are correct; found `forRootAsync()`
cannot be meaningfully "fixed" to real parity with `forRoot()` due to NestJS's
synchronous DynamicModule shape requirement (recommends removal); proposed a
bus-scoped ledger design for the F-M5 duplicate-registration guard; flagged a
lifecycle-ordering residual risk and two latent issues outside the original
findings (separate `LOCAL_EVENT_BUS` per same-name `forFeature()` call, and a
second internal-API fragility point in `findOwnModule()` Step 2 not covered by
F-M19).

**API / backward compatibility** (see decisions D-2, D-4, D-5, D-7 and open
questions OQ-2, OQ-3, OQ-4): F-C4's fix is a **behavioral breaking change
despite an unchanged type signature** — any handler that today "works" only
because of the cross-context leak will silently stop receiving events it was
never supposed to receive, with no compile error and no runtime exception. This
should be called out explicitly as `BREAKING CHANGE:` in the changelog, not
filed as a plain `fix:`, and validated against the primary consumer
application's full test suite before merging past the existing pre-release
validation gate. Confirmed the pre-first-publish window makes this the cheapest
possible time to remove dead/lying API surface (`forRootAsync`, the 6 dead
option fields), but flagged that a live workspace consumer still exists today
and TypeScript's excess-property checks make blind field removal a real
compile-time risk pending confirmation.

**Testability / quality** (see decision D-8 and open question OQ-10): confirmed
with direct code evidence why the _existing_ tests do not catch F-C4 —
`feature-handler-registrar.test.ts` mocks the container as a plain `Map` (never
exercises the actual provider-shadowing mechanism) and `global-bus-acl.test.ts`
calls `compile()` but never `init()`, so `onModuleInit()` — where the bug lives
— never runs in that test. Recommended a concrete, code-referenced test plan
(new e2e file with an explicit container identity/size probe, not just
behavioral assertions) and confirmed the `outbox` submodule of the same package
does **not** share this bug pattern (pure factory/token DI, no container
introspection) — so no additional review is needed there. Flagged specific
coverage traps (the `onModuleDestroy` dispose branches, the
`registerHandlersInLocalBuses` catch block) that are easy to leave at 0% even
with 80%+ aggregate package coverage.

## Process notes

- **Consumer verification (OQ-3/OQ-4, resolved 2026-07-02):** direct inspection
  of the primary downstream consumer's codebase shows it does not use
  `VytchesDDDModule.forRoot()`, `.forFeature()`, `.forContext()`,
  `.forContexts()`, or `.forRootAsync()` at all. It wires the library through a
  single hand-rolled wrapper module that injects `VytchesExplorerService`
  directly and constructs one global
  `EnhancedCommandBus`/`EnhancedQueryBus`/event-bus setup for the entire
  application, driving handler discovery itself from `onApplicationBootstrap()`.
  Two consequences worth flagging explicitly:

  1. This consumer is **not currently exposed to F-C4 in production**, since it
     never invokes `forFeature()` — the fix remains Critical-priority for the
     library (any consumer that does use `forFeature()`, including future OSS
     adopters post-publish, is exposed), but the immediate blast radius on the
     known heavy consumer is smaller than the DREAD register's Affected-users
     dimension (A=3) assumed. Worth a one-line caveat when reporting this to
     stakeholders: the threat is real for the library's documented isolation
     feature, not currently realized in the primary consumer's deployment.
  2. Because this consumer runs one shared global command/query bus for every
     bounded context, its protection against the _original_ ADR-0034 problem
     (cross-context command-name collisions) rests entirely on that ADR's Phase
     1 fix (`Map<Function, ...>` keys in `CommandBus`/`QueryBus`, applied
     unconditionally inside `packages/cqrs/`, independent of `forFeature()`) —
     not on `forFeature()`-based isolation. This appears sufficient for
     name-collision safety, but the consumer gets none of `forFeature()`'s
     per-context bus isolation. Whether that's an intentional architectural
     choice or an adoption gap is outside VB-003's scope — flag as a candidate
     discussion topic, not a VB-003 blocker.

- `.claude/knowledge/patterns/` and `.claude/knowledge/decisions/` do not exist
  anywhere in this repository, despite `CLAUDE.md` describing the patterns
  directory as "symlinked from claude-patterns." This is a repo/tooling gap
  unrelated to VB-003's content — pattern grounding (step 0.5) and decision-card
  grounding (step 0.7) both fell back to the panel's own domain expertise
  instead. Not blocking for VB-003, but worth a separate maintenance task if
  pattern-grounded analysis is expected to work going forward.
- No `.claude/config/knowledge.json` was found, so RAG retrieval (step 0.6) was
  skipped entirely rather than attempted — this is a graceful, intentional skip
  per the command's own fallback rule, not an omission.
- This session's tool permissions denied Bash and provided no standalone
  Glob/Grep/LS tools, at both the main-agent and subagent level. All code
  discovery in this analysis was done via direct `Read` calls against paths
  inferred from the task description and prior audit artifact, which is why
  several open questions above are marked as needing a grep-capable follow-up
  rather than being resolved outright — they are cheap, mechanical lookups, not
  design questions, and should not by themselves block approval once answered.
