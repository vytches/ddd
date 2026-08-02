---
task: VD-007-llmguide-completeness-pass
status: approved
threat_model: null
rag:
  'skipped (.claude/config/knowledge.json not found — no knowledge-retriever MCP
  configured for this project; fell back to direct file reads per graceful
  fallback in Step 0.6)'
patterns:
  - 'ts-library-patterns (skill, no separate Rule Card files on disk — only
    SKILL.md quick-rules loaded): Rule 1 "explicit barrel exports", Rule 7
    "export validation — every declared export must exist and be importable".
    Directly grounds this task: LLMGUIDE.md coverage is being checked against
    the same barrel-export contract these rules already assume is authoritative.'
  - "Project CLAUDE.md critical rule: 'Verify method signatures before
    documenting - never assume methods exist' — this is this task's mandate
    verbatim, already stated as a standing project rule."
  - "packages/*/tests/api-surface.test.ts (REL-005): each package already has a
    snapshot test locking its exact export list. Treat this as the canonical,
    already-tested source of truth for 'what is actually exported' — more
    reliable than re-parsing src/index.ts by eye (handles
    re-exports/aliasing/type-only exports uniformly). Use it as the
    deterministic input to both the audit and the verify gate (see D-3)."
open_questions:
  - id: OQ-1
    question:
      "The 2026-07-03 audit this task is built on reported exact
      undocumented-symbol counts for 15 of 19 packages but never mentioned
      `acl`, `aggregates`, `cqrs`, or `domain-services` — neither as 'worst
      offenders' nor 'well covered'. A supplementary check run during this
      analysis (identical methodology: every `src/index.ts` export grepped
      against `LLMGUIDE.md`) found these were simply missed, not silently fine:
      `acl` 12/28 undocumented (42.9%), `aggregates` 12/28 (42.9%), `cqrs` 10/31
      (32.3%), `domain-services` 6/19 (31.6%) — severity comparable to the
      packages that were flagged (see full list per symbol in 'Coverage audit
      gap' below). Should these four packages be added to VD-007's scope now, as
      a Tier 2 priority after the six originally-named packages, given the
      task's own title claims coverage 'across all 19 packages'? This adds ~40
      symbols and 4 more package-units to the original scope, raising the
      estimate above the original 20h. If not added now, they should at minimum
      be filed as an explicit follow-up task rather than left as a silent gap in
      an audit that already missed them once."
    answer:
      "Yes — fold acl/aggregates/cqrs/domain-services into VD-007 now, as Tier 2
      (U-7..U-10, already fully scoped per-symbol in this artifact's units[]).
      Rationale: the discovery work is already done (this analysis pass did it),
      the task's own title claims coverage 'across all 19 packages', and D-8's
      multi-invocation batching already absorbs the added volume without
      requiring a redesign. Filing a separate follow-up would mean
      re-discovering the same gap later at real cost; folding it in now is
      nearly free since U-7..U-10 are ready to execute as-is."
  - id: OQ-2
    question:
      "Are any exports in the priority packages considered pre-1.0/ experimental
      by the maintainer? library-api-guardian flagged `testing`'s newer seeder
      variants (`AIEnhancedSeeder`, `StreamingSeeder`, `GeographicSeeder`) as
      reading like newer, more-specialized additions than the baseline
      `DomainSeeder` — these would be candidates for a Key-API-row + explicit
      'API may change before v1.0' caveat instead of a full worked Patterns
      example, since a copy-pasteable code sample implies a stronger stability
      commitment than a one-line table description. If yes, list the specific
      packages/symbols that need the caveat; if no, decision D-4's heuristic
      applies uniformly with no stability caveats anywhere."
    answer:
      "Yes — apply the caveat to exactly these 3 symbols in `testing`:
      AIEnhancedSeeder, StreamingSeeder, GeographicSeeder. Each gets a
      Key-API-row + one-line 'API may change before v1.0' note instead of a full
      worked Patterns example. The baseline `DomainSeeder` keeps its full
      Patterns entry per D-4(i) (direct entry point). No other symbol in any
      priority package was flagged by library-api-guardian as
      pre-1.0/experimental in this analysis, so the caveat does not extend
      beyond these 3 — D-4's heuristic applies uniformly everywhere else."
decisions:
  - id: D-1
    decision:
      "Reshape the /orchestrate-ddd execution model for this task: units[] = one
      unit per package (see units list below), NOT the default
      domain/application/infrastructure layer loop. Each unit runs a single
      collapsed 'docs' pseudo-layer through implement -> verify -> fix
      (max_attempts=3, unchanged)."
    rationale:
      "The 3-layer split encodes three assumptions that don't transfer to a
      documentation task: (1) dependency ordering (domain before app before
      infra, because infra imports domain) does not apply — LLMGUIDE.md files
      have no compile-time dependency graph between packages; (2) smaller scope
      per turn does apply, but the natural cohesion boundary is the package (one
      LLMGUIDE.md + its src/index.ts barrel + the source behind its undocumented
      symbols), not an artificial domain/app/infra split of a single
      fixed-structure file; (3) failure isolation applies and is better served
      by the package boundary than by layers — a NO-GO on `nestjs` shouldn't
      force re-verification of `testing`. [architect panel]"
    adr: null
    propose_adr: false
  - id: D-2
    decision:
      'Run the `di` stale-API correction (AC #1: `IContainer` ->
      `IDependencyContainer`, `Lifetime` -> `ServiceLifetime`, `ContainerError`
      -> `DIError`) as a separate, fast pre-flight stage BEFORE the per-package
      unit loop, verified by a plain grep (old names gone from the Key API
      table, new names present, cross-checked against src/index.ts) rather than
      the 3-attempt quality loop that governs the additive work.'
    rationale:
      "This is a correctness bug, not a gap — three known-wrong-to-known- right
      string replacements, fully specified, zero judgment required. Actively
      wrong docs are worse than absent docs (a wrong symbol name causes a
      consumer, or an LLM reading the guide, to write non-compiling code), so it
      is the highest-severity, lowest-cost item in the task and should land
      independently and first rather than being bundled into `di`'s broader
      18-symbol additive pass, where quality-loop churn on the additive part
      could put the already-correct rename at risk of being re-touched.
      [architect panel]"
    adr: null
    propose_adr: false
  - id: D-3
    decision:
      "Redefine the per-unit verify() gate as two tiers instead of reusing a
      code-quality-verifier: (a) PRIMARY, deterministic — diff the package's
      `tests/api-surface.test.ts` snapshot (the already-tested canonical export
      list) against symbol mentions in LLMGUIDE.md; any snapshot symbol with
      zero mentions is a hard FAIL. This mirrors AC #7's re-audit requirement
      exactly and needs no LLM judgment. (b) SECONDARY, narrow — sample
      newly-added Key API rows / Patterns prose against the actual
      JSDoc/signature in source to catch fabricated behavior (AC #2);
      Sonnet-level content-diff, not a full code-quality review. Patterns code
      samples stay illustrative-only: no `tsc --noEmit` gate on them. Building
      tsc-verified examples is explicitly out of scope for VD-007 (that bar
      belongs to VD-006's `examples/` work) — requiring compile-clean samples
      here would silently expand this task into VD-006's territory and block on
      things like NestJS peer-dep types."
    rationale:
      "library-api-guardian's read of packages/*/tests/api-surface.test.ts
      confirms these snapshots already exist (introduced by REL-005 to lock the
      public API pre-v0.25.0-beta.1) and are a more reliable export source than
      re-parsing src/index.ts (they correctly resolve
      re-exports/aliasing/type-only exports). Re-grepping alone proves presence,
      not correctness — it would not have caught the `di` bug (wrong description
      of a symbol that still exists), so the coverage gate and the accuracy gate
      must both run; AC #7's grep re-audit is a coverage check and must not be
      allowed to masquerade as the full verify gate. [library-api-guardian +
      architect panel, converged independently]"
    adr: null
    propose_adr: false
  - id: D-4
    decision:
      "Adopt this heuristic for AC #3's per-package judgment call (Key API row
      only vs full Patterns entry with code sample): (i) a class/function a
      consumer directly instantiates or calls as an entry point (e.g.
      DomainSeeder, RulesRegistry, VytchesDDDFeatureModule,
      OutboxProcessorModule) -> full Patterns entry; (ii) a supporting
      interface/type that only appears as a parameter or return type of an
      already-documented entry point (e.g. GivenStep/WhenStep/ThenStep,
      HandlerInfo) -> Key API row only, description cross-references the entry
      point; (iii) a DI token/constant -> Key API row only, UNLESS the token is
      part of a documented multi-token pattern — GLOBAL_QUERY_BUS +
      LOCAL_EVENT_BUS specifically warrant a Patterns entry per AC #5, because
      the combination of tokens is the pattern, not any single token; (iv) an
      error class -> Key API row only, grouped as a set, unless it carries a
      non-obvious recovery action worth a one-line example; (v) tie-break — if
      the symbol's real JSDoc already contains an @example block (confirmed
      present on at least ContextAwareEventDispatcher), promote to a full
      Patterns entry, since the cost is transcription, not authoring."
    rationale:
      'library-api-guardian proposed this after reading actual source
      (packages/nestjs/src/dispatchers/context-aware-event-dispatcher.ts
      confirmed an existing @example JSDoc block) — the heuristic is grounded in
      what the codebase already does, not invented. It gives every implementer
      unit a reusable, non-arbitrary rule instead of re-litigating the
      row-vs-pattern call per symbol per package.'
    adr: null
    propose_adr: false
  - id: D-5
    decision:
      "`enterprise/LLMGUIDE.md` gets (a) a 'See also' cross-reference table
      mapping each re-exported package to its own LLMGUIDE.md, and (b) a
      dedicated section documenting the explicit NAMING CONFLICT RESOLUTION
      choices already commented in enterprise/src/index.ts (which symbol/name
      wins when two re-exported packages collide, e.g. BaseEntityId,
      CqrsValidationError, primary-vs-alternative
      ExecutionContext/safeRun/IAggregateCapability, and how to reach the
      alternative). It does NOT get a full Key-API-row-by-row duplicate of every
      re-exported symbol. This resolves AC #6."
    rationale:
      "enterprise/src/index.ts re-exports the bulk of its surface verbatim from
      the other packages (domain-primitives, aggregates, repositories,
      domain-services, policies, validation, projections, acl, messaging,
      resilience, plus explicit blocks from contracts/events/cqrs/di). Once the
      priority packages are fixed, every one of those re-exported symbols is the
      SAME symbol already documented at its owning package's LLMGUIDE.md —
      duplicating full rows in enterprise's guide creates two documentation
      sources for one symbol that can drift independently, which is exactly the
      failure mode this task exists to fix. A consumer importing from
      @vytches/ddd should be pointed at the owning package's guide. The
      naming-conflict-resolution behavior IS genuinely enterprise-specific and
      undiscoverable from any single re-exported package's guide, so it gets
      real documentation regardless of the other packages' state.
      [library-api-guardian]"
    adr: null
    propose_adr: false
  - id: D-6
    decision:
      'The `enterprise` unit runs strictly last, after all other package units
      are complete, and is never parallelized with the packages it re-exports.'
    rationale:
      "Its content (the D-5 cross-reference table) depends on the post-fix state
      of the packages it re-exports from — running it earlier or concurrently
      risks referencing a package's LLMGUIDE.md before that package's own
      gap-closing pass has landed. [architect panel]"
    adr: null
    propose_adr: false
  - id: D-7
    decision:
      "Every per-unit implement prompt must explicitly instruct: 'read the
      source file's JSDoc/signature for every undocumented symbol before writing
      its Key API row or Patterns sample; do not describe behavior you have not
      read in source.' This is a prompt-level requirement, not left implicit or
      deferred entirely to the verify gate."
    rationale:
      'Voluminous mechanical documentation work (up to 70 symbols in one unit,
      e.g. `contracts`) is the textbook failure mode for LLM confabulation — an
      implementer asked to describe 70 symbols will tend to produce
      plausible-sounding descriptions for whichever ones are annoying to look
      up, unless forced to cite source per symbol. Process-level mitigation up
      front is cheaper than relying on the D-3 accuracy-verify tier to catch
      fabrication after the fact on every unit, every attempt. AC #2 already
      forbids fabricated behavior — this operationalizes that requirement into
      the implement step itself. [architect panel]'
    adr: null
    propose_adr: false
  - id: D-8
    decision:
      "Keep VD-007 as a single task with a single approved analysis artifact,
      but plan multiple `/orchestrate-ddd VD-007-llmguide-completeness-pass`
      invocations, each covering a human-selected subset of units[] sized by
      symbol volume (~60-70 undocumented symbols per invocation is a reasonable
      ceiling — `contracts` alone at 70 symbols is a legitimate solo run). Do
      not attempt all units in one invocation. Exact batch boundaries per
      invocation are an operational choice made when authoring that invocation's
      Workflow script (Krok 3 of /orchestrate-ddd), not fixed in this artifact."
    rationale:
      "Turn/token budget exhaustion risk scales with total symbol count across
      units in a single Workflow run — each unit requires reading the full
      src/index.ts, then the source (JSDoc/signature) of every undocumented
      symbol in it, plus a verify pass and up to 2 fix passes. A run that dies
      mid-way through a giant combined unit leaves an ambiguous
      partial-completion state across hundreds of symbols; smaller
      per-invocation batches give clean resumption points and isolate
      escalations to a bounded blast radius. [architect panel; rejected the
      panel's own first-draft batch split as still too large — see Process notes
      below for the numbers]"
    adr: null
    propose_adr: false
  - id: D-9
    decision: 'No threat model required for this task; proceed without one.'
    rationale:
      "Pure documentation additions/corrections describing existing,
      already-shipped public API — no code behavior change, no new
      auth/PII/cross-context code paths introduced.
      .claude/config/canonical-labels.yml does not exist in this project;
      assessed directly from task content per the graceful fallback in Step 0a
      of /analyze-ddd. Residual note: because AC #5 documents `forFeature()`
      cross-context wiring semantics (GLOBAL_QUERY_BUS / LOCAL_EVENT_BUS /
      OutboxProcessor), an inaccurate code sample there could in principle model
      an insecure usage pattern — this is a documentation-quality risk covered
      by D-3's accuracy-verify tier and D-7's source-citation requirement, not a
      security vulnerability in shipped code, so it does not independently
      justify a TM."
    adr: null
    propose_adr: false
units:
  - id: U-0
    package: 'di (correction pre-flight)'
    tier: 0
    scope:
      '3 stale Key API table entries (AC #1) — grep-verified only, no quality
      loop'
  - id: U-1
    package: testing
    tier: 1
    undocumented_count: 28
    scope:
      'entire seeder framework + GWT step interfaces (AC #4 worst-offender #1)'
  - id: U-2
    package: contracts
    tier: 1
    undocumented_count: 70
    scope: 'entire event-store/replay layer — recommend solo invocation (D-8)'
  - id: U-3
    package: policies
    tier: 1
    undocumented_count: 61
    scope: 'entire conditional/group builder subsystem + policy event system'
  - id: U-4
    package: nestjs
    tier: 1
    undocumented_count: 12
    scope:
      'VytchesDDDFeatureModule, ContextAwareEventDispatcher,
      GLOBAL_QUERY_BUS/GLOBAL_COMMAND_BUS/LOCAL_EVENT_BUS,
      OutboxProcessorModule/Service (AC #5, explicit priority items)'
  - id: U-5
    package: di
    tier: 1
    undocumented_count: 18
    scope: 'remaining additive gap after U-0 correction'
  - id: U-6
    package: validation
    tier: 1
    undocumented_count: 16
    scope:
      'specification-combinator internals (AndSpecification, OrSpecification,
      NotSpecification, PredicateSpecification, etc.), ValidationFacade,
      BaseValidationAdapter, AdapterUtils, RulesRegistry'
  - id: U-7
    package: acl
    tier: 2
    undocumented_count: 12
    scope:
      'discovered during this analysis, not in original audit — see OQ-1.
      ApplicationError, BaseApplicationService, IApplicationService,
      AdapterNotFoundError, TranslationError, ImportOptions, AdapterDefinition,
      IEnhancedACLAdapter, BaseACLRegistry, ACLRegistrationMetadata,
      TypedOperation, VersionedACLAdapter'
  - id: U-8
    package: aggregates
    tier: 2
    undocumented_count: 12
    scope:
      'discovered during this analysis, not in original audit — see OQ-1.
      IAggregateCapability, IAggregateEventHandler, IAggregateBuilder,
      AggregateWithVersioningCapability, AggregateWithAuditCapability,
      AggregateWithEventSourcingCapability, tryAsSnapshotAggregate,
      asVersioningAggregate, tryAsVersioningAggregate, tryAsAuditAggregate,
      asEventSourcingAggregate, tryAsEventSourcingAggregate'
  - id: U-9
    package: cqrs
    tier: 2
    undocumented_count: 10
    scope:
      'discovered during this analysis, not in original audit — see OQ-1.
      IDisposableBus, IResettableBus, COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN,
      IMiddlewareLogger, CqrsValidationError, ICqrsValidatable,
      CQRSConfigurationError, QueryExecutionError, CQRSConfiguration'
  - id: U-10
    package: domain-services
    tier: 2
    undocumented_count: 6
    scope:
      'discovered during this analysis, not in original audit — see OQ-1.
      DIServiceMetadata, EnhancedDomainServiceOptions, DomainServiceOptions,
      ServiceCircularError, ServiceDuplicateError, ServiceNotFoundError'
  - id: U-11
    package: enterprise
    tier: 3
    scope:
      'cross-reference table + naming-conflict-resolution section only (D-5) —
      sequence last (D-6)'
  - id: 'not-in-scope'
    package:
      'domain-primitives, projections, repositories, resilience, messaging,
      events, value-objects, utils'
    tier: null
    scope:
      '0 fully-undocumented exports per original audit — no unit needed.
      resilience has a separate, lesser "table-only, never shown in a code
      sample" quality gap noted in round-1 findings, but that is not a zero-
      mention gap and is not in this task''s acceptance criteria.'
---

# VD-007 — LLMGUIDE.md completeness pass: analysis

## Summary

The task is built on a 2026-07-03 audit (`project_examples_coverage_audit`
memory, round 2) that grepped every `src/index.ts` export name against its
package's `LLMGUIDE.md` across "all 19 packages" and found 300+ zero-mention
exports, worst in `testing` (74%), `contracts` (74%), `enterprise` (91%, largely
structural), `policies` (71%), `nestjs` (71%), `di` (69%, plus a distinct
stale-docs bug), `validation` (67%). This analysis confirms those numbers hold
(cross-checked `di` and `validation` directly against source) and adds one
material correction: **the original audit itself was not exhaustive.** A
supplementary check run in this analysis, using the identical methodology, found
`acl` (42.9%), `aggregates` (42.9%), `cqrs` (32.3%), and `domain-services`
(31.6%) were never mentioned in the original audit's findings at all — not
flagged as offenders, not confirmed clean. They were simply missed. See OQ-1:
whether to fold these into VD-007's scope now or file them as an explicit
follow-up is a human call, since it changes the task's effort estimate
materially.

The panel also identified a structural mismatch: `/orchestrate-ddd`'s default
execution model (units looped through a domain → application → infrastructure
layer sequence, verified by a code-quality-verifier) does not fit a
documentation-only task with no code layers and no behavior change. Decisions
D-1 through D-8 below reshape the execution model specifically for this task —
per-package units, a collapsed single pseudo-layer, a redesigned two-tier verify
gate built on the project's existing `api-surface.test.ts` snapshots, a fast
separate pre-flight for the `di` correctness bug, and a volume-balanced
multi-invocation batching plan instead of one giant run.

## Panel findings by area

**Coverage audit gap** (Explore agent, direct reads of
`packages/{acl,aggregates,cqrs,domain-services}/src/index.ts` + `LLMGUIDE.md`):
confirmed the four omitted packages are not silently well-covered — their
undocumented percentages (31–43%) sit closer to the "worst offenders" band than
the "well covered" (0%) band. Full per-symbol lists are recorded in the `units:`
frontmatter above (U-7 through U-10) so they don't need to be re-derived at
implementation time.

**Verification & API design** (`library-api-guardian`): the project already has
a better mechanical coverage-check input than re-parsing `index.ts` by eye —
`packages/*/tests/api-surface.test.ts`, a REL-005 snapshot test that locks each
package's exact export list pre-v0.25.0-beta.1. Proposed the two-tier verify
gate adopted as D-3, the row-vs-pattern heuristic adopted as D-4 (confirmed
grounded in real JSDoc `@example` blocks already present on some exports, e.g.
`ContextAwareEventDispatcher`), and the `enterprise` cross-reference treatment
adopted as D-5. Assessed backward-compatibility risk as low: REL-005 already
separated intentionally-`@internal` symbols from the public barrel before this
task existed (confirmed by comments in `enterprise/src/index.ts` naming symbols
deliberately excluded), so "add a Key API row for every undocumented export" is
not newly promising stability for something meant to stay internal. The one
residual risk it flagged without resolving is OQ-2 (possible
pre-1.0/experimental exports needing a stability caveat rather than a full
worked example).

**Workflow structure** (`ecc:architect`): confirmed the domain/app/infra layer
loop's three underlying assumptions (dependency ordering, per-turn scope
control, failure isolation) — only the latter two apply here, and both are
better served by a package-level unit boundary than by layers (D-1). Recommended
the `di` correction run as an independent pre-flight (D-2), the verifier be
re-pointed at doc-specific criteria rather than a code/DDD-violation rubric
(informed D-3), fabrication risk be mitigated at the prompt level (D-7), and
`enterprise` be sequenced strictly last (D-6). On batching: the panel's own
first proposal ("di-fix + testing + contracts + policies" as one batch, ≈159
symbols) was rejected in this same analysis pass as still too large relative to
its own stated ~60-70 symbol ceiling — D-8 keeps the volume-balancing principle
but leaves exact cut points to invocation time rather than re-deriving a second
fixed split that Tier-2's newly-added ~40 symbols (pending OQ-1) would
immediately invalidate anyway.

## Process notes

- The Explore and `ecc:architect` subagents in this session had Bash/Glob/Grep
  tool permission denied at the environment level and fell back to full-file
  `Read` calls to reconstruct listings and do symbol-by-symbol comparison. This
  does not weaken the findings above (every comparison was done against full
  file contents, not partial reads or guesses) but did make the checks slower
  than a grep-based pass would be — worth noting in case the same restriction
  affects the implementation phase's mechanical re-audit (AC #7), where a real
  `grep`/`api-surface.test.ts` diff should be preferred over agent-eyeballed
  comparison once tool access is available.
- The full per-symbol lists for the six originally-audited priority packages
  (testing, contracts, policies, nestjs, di, validation — ~205 symbols total)
  were **not** re-derived in this analysis pass; the original 2026-07-03 audit's
  session transcript containing them is no longer accessible, and the delivered
  HTML artifact explicitly does not duplicate the full list. Each unit's
  implementer must re-run the audit methodology (read `src/index.ts`, read
  `LLMGUIDE.md`, grep every exported name) for its own package at implementation
  time — this is already required by AC #2/#7 and by D-7, so it is not
  additional work, just a note that this analysis artifact is not itself a
  substitute for that per-unit step.
