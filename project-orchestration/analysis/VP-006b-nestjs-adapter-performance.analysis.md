---
task: VP-006b-nestjs-adapter-performance
status: approved
threat_model: null
rag:
  skipped (no .claude/config/knowledge.json — knowledge-retriever MCP not
  configured for this project; classic grep/Read fallback used)
patterns:
  - backward-compatibility-pattern
  - package-boundary-pattern
  - library-testing-pattern
  - public-api-pattern
open_questions:
  - id: OQ-1
    question: >-
      AC1 resolution order. The panel's compat stage claimed registry-first
      breaks the pinned test 'should resolve from NestJS container first'
      (MAJOR, mutually exclusive with AC6). Main-agent reconciliation: the only
      viable implementation is registry-first WITH moduleRef fallback — on an
      internal miss moduleRef.get is still called, so that test (token not
      registered internally, asserts moduleRef.get called + NestJS instance
      returned) stays green. The only observable change is precedence for a
      token registered in BOTH containers with DIVERGENT instances (untested,
      and an unsupported configuration under ADR-0014 "VytchesDDD as Primary
      Container" — bridge registrations point at the same instance either way).
      Options: (A) adopt registry-first-with-fallback now, classify patch,
      CHANGELOG note + NEW explicit precedence test for the dual-divergent case;
      (B) treat the precedence flip as deliberate MAJOR in a separate task
      (VP-007) and drop AC1 from VP-006b; (C) drop AC1 entirely and keep
      NestJS-first (rejected memo alternatives: positive memo breaks
      REQUEST-scoped providers, negative memo needs string-keyed Map → leak).
      Recommendation: A. Must also verify whether the sibling test 'should
      resolve from internal container if not in NestJS' asserts the moduleRef
      call itself (if yes, that assertion needs a deliberate update — flag in
      CHANGELOG).
    answer: >-
      Option A — adopt registry-first-with-fallback now. Classify as patch, add
      a CHANGELOG note and a NEW explicit precedence test for the dual-divergent
      case. During implementation, verify whether 'should resolve from internal
      container if not in NestJS' asserts the moduleRef.get call itself; if yes,
      update that assertion deliberately and note it in the CHANGELOG. (Approved
      2026-07-11.) POST-AUDIT RESOLUTION (2026-07-11, user-delegated panel
      re-consult after the OQ-4 finding; perf stage voted A, compat stage voted
      B with "A defensible under strict conditions" — synthesis adopts A WITH
      those conditions, superseding the "classify as patch" above): (1) classify
      as a MINOR-worthy behavior change — CHANGELOG entry uses explicit BEHAVIOR
      CHANGE language; (2) dev-only one-time dual-registration divergence guard
      in resolve() (outside production: first internal hit per token probes
      moduleRef once and warns via the internal logger if a DIFFERENT instance
      exists there; never throws; zero production hot-path cost; no new public
      options); (3) FRAMEWORK-ADAPTERS.md note: do not point auto-discovery at
      an adapter that also holds a moduleRef.
  - id: OQ-2
    question: >-
      AC4 scope-copy optimization variant. (a) Benchmark first (createScope ×
      1000 at N ∈ {100, 500, 1000} services, heap delta), implement only if the
      win is material; then copy-on-write preserving VF-030 D5 snapshot
      semantics exactly. (b) Share the services Map by reference read-only +
      guard that throws/warns on register() after first createScope() — bigger
      win, but the guard is ITSELF a behavior change (registering after
      createScope is legal today) and shared maps create a dispose() hazard. (c)
      Keep the copy as-is. Regardless of variant: a NEW test 'scope dispose()
      does not clear parent maps' is mandatory (currently an untested gap).
      Recommendation: (a) — measure before building; at realistic descriptor
      counts the copy may be negligible.
    answer: >-
      Variant (a) — benchmark first (createScope × 1000 at N ∈ {100, 500, 1000},
      heap delta); implement copy-on-write preserving VF-030 D5 snapshot
      semantics ONLY if the measured win is material. If not material, keep the
      copy and document the measurement. The new 'scope.dispose() does not clear
      parent maps' test is mandatory in either outcome. (Approved 2026-07-11.)
  - id: OQ-3
    question: >-
      packages/di scope extension. The base BaseContainerAdapter
      resolveDependency() does isRegistered()+resolve(), which through this
      adapter costs 2× moduleRef.get per NestJS-side constructor param and 1
      wasted throw+catch per internal param; its cycle stack is O(n)
      Array.includes. Fix options: (A) adapter-local override of
      resolveDependency in NestJSContainerAdapter (single registry-first pass,
      cycle-check via inherited stack) — zero packages/di changes, stays inside
      VP-006b's package boundary; (B) fix in BaseContainerAdapter (tryResolve
      hook + Set-based stack) — benefits all adapters but blast radius beyond
      this task's scope. Recommendation: A now; spawn a follow-up task for B
      with its own backward-compat review (all adapters affected). Confirm
      follow-up task creation (suggested id: VP-006c).
    answer: >-
      Option A — adapter-local override of resolveDependency in
      NestJSContainerAdapter; packages/di stays untouched in VP-006b. Follow-up
      task VP-006c (BaseContainerAdapter: tryResolve hook + Set-based cycle
      stack, own backward-compat review) is CONFIRMED — create it in the backlog
      during housekeeping. (Approved 2026-07-11.)
  - id: OQ-4
    question: >-
      Dual-registration audit. Before shipping the OQ-1 change, should we audit
      the reference NestJS consumer for tokens registered BOTH natively in
      NestJS and internally in the adapter with different instances (the only
      case whose behavior flips)? Recommendation: YES — cheap, and it converts
      the OQ-1 risk assessment from theoretical to evidence-based.
    answer: >-
      YES — audit the reference NestJS consumer for divergent dual registrations
      before shipping the OQ-1 change; record the result in the task file. If
      the pattern is found, escalate back to STOP1 before merging. (Approved
      2026-07-11.) AUDIT OUTCOME (2026-07-11, workflow run wf_7e15a9fd-9be, gate
      HALTED as designed): divergent dual registration of handler classes
      CONFIRMED in the reference NestJS consumer — but exclusively on the GLOBAL
      SimpleContainer path (discoverAndRegisterHandlers registers Transient
      class tokens; NestJS separately holds fully-injected singletons; buses
      receive the live NestJS instances from the explorer). The consumer has
      ZERO non-test usages of NestJSContainerAdapter, so the finding does not
      traverse the code VP-006b changes. Escalation resolved per the OQ-1
      POST-AUDIT RESOLUTION (proceed with A + guard + MINOR classification); no
      library code path today auto-registers discovered handlers INTO a
      NestJSContainerAdapter instance (latent-only risk, neutralized by the
      guard and the FRAMEWORK-ADAPTERS.md note).
  - id: OQ-5
    question: >-
      AC2 rewording approval. AC2 as written ("resolve reflection ONCE at
      registration time") is unimplementable without breaking three existing
      tests that monkey-patch Reflect.getMetadata AFTER register() and expect
      consultation at resolve() time. The only patch-safe variant is
      lazy-once-on-first-createInstance (module-level WeakMap<Constructor,
      paramTypes>). Approve updating the task file's AC2 wording accordingly
      (proposed text in the body, section "AC rewording")? Recommendation: YES.
    answer: >-
      YES — approved. Update the task file's AC2 to the lazy-once wording from
      the "AC rewording" section (and AC1 to the Option-A wording per OQ-1).
      (Approved 2026-07-11.)
decisions:
  - id: D-1
    decision: >-
      AC2 via lazy-once reflection cache: module-level WeakMap<Constructor,
      readonly Constructor[]> populated on FIRST createInstance() per
      constructor (not at register() time). Cache empty arrays too (metadata
      absent). registerFactory/registerInstance bypass createInstance — no
      change. No invalidation needed (design:paramtypes immutable per class;
      WeakMap self-cleans).
    rationale: >-
      Both panel stages converged. Register-time caching breaks 3 pinned tests
      (Reflect.getMetadata monkey-patched after register); lazy-once is
      patch-safe, ADR-0038-compliant (keyed by constructor reference), and
      better for cold start (pays only for the resolved subgraph). Hot path then
      performs zero Reflect.getMetadata — AC2's intent satisfied.
    status: proposed
  - id: D-2
    decision: >-
      AC3 is VERIFY-ONLY: the silent `new paramType()` fallback no longer exists
      — VF-030 D7 (merged 2026-07-11, ADR-0038) rewired createInstance through
      the inherited throwing resolveDependency(). Deliverable: confirm via
      existing ghost-instance + CircularDependencyError tests; no
      implementation.
    rationale: >-
      The task file predates VF-030 (written 2026-06-30). Current source
      (nestjs-container.adapter.ts, VF-030 comments D1/D5/D7/D8) and the test
      file already pin the throwing behavior.
    status: proposed
  - id: D-3
    decision: >-
      Fix the resolveDependency double-lookup adapter-locally (override in
      NestJSContainerAdapter; single registry-first pass; reuse inherited cycle
      stack). Do NOT touch packages/di in VP-006b. Base-level improvements
      (tryResolve, Set-based cycle stack) become a follow-up task.
    rationale: >-
      Keeps the task inside its package boundary (package-boundary-pattern, same
      reasoning that split VP-006b out of VP-006). Base changes affect every
      adapter and need their own compat review. Pending OQ-3 sign-off.
    status: proposed
  - id: D-4
    decision: >-
      AC5 via in-repo dev-only bench in packages/nestjs (vitest bench, excluded
      from publish via `files`, VP-006 D-5 precedent). PRIMARY metrics are
      count-based and machine-independent: moduleRef.get invocations + throw
      count per resolve scenario (validates AC1/OQ-3 fix), Reflect.getMetadata
      invocations (validates AC2). Secondary: cold deep-graph first-resolve
      latency, warm resolve, heap delta over createScope()×K (validates AC4).
      Fixture uses a stub/counting ModuleRef with N≈500–1000 services. Do NOT
      measure NestJS app bootstrap wall-clock — not attributable to the adapter.
      Consumer-side numbers remain tracked separately (VP-006 D-1 precedent).
    rationale: >-
      Count metrics prove the algorithmic change deterministically; latency is
      noisy and host-coupled. Stub ModuleRef isolates adapter cost from
      framework bootstrap. Aligns with ADR-0023 (no performance theater —
      measure real, attributable effects).
    status: proposed
  - id: D-5
    decision: >-
      Frozen contracts for ALL VP-006b changes: error types/messages and their
      timing (ContainerServiceNotFoundError, InvalidRegistrationError,
      CircularDependencyError — 4 pinned test groups), getServices()
      membership+count (order is unpinned but do not change gratuitously),
      VF-030 D1/D8 token-reference keying, fresh per-scope scopedInstances
      cache. Two NEW tests mandatory: dual-registration precedence (OQ-1) and
      scope.dispose() parent isolation (OQ-2).
    rationale: >-
      Compat stage inventoried the 549-line test file: these are the pinned
      behaviors that keep the task patch-level. The two new tests close the
      exact coverage gaps this task's changes would otherwise slip through.
    status: proposed
units:
  - id: U-1
    title: 'AC2: lazy-once WeakMap paramtypes cache in createInstance'
    layer: nestjs-adapter
    blocked_by: [OQ-5]
  - id: U-2
    title:
      'AC1: registry-first resolve() with moduleRef fallback + new precedence
      test'
    layer: nestjs-adapter
    blocked_by: [OQ-1, OQ-4]
  - id: U-3
    title:
      'resolveDependency adapter-local override (kill double moduleRef.get)'
    layer: nestjs-adapter
    blocked_by: [OQ-3]
  - id: U-4
    title:
      'AC5: dev-only vitest bench (count-based metrics, stub ModuleRef),
      excluded from publish'
    layer: nestjs-bench
  - id: U-5
    title:
      'AC4: scope-copy optimization per chosen variant + scope.dispose()
      parent-isolation test'
    layer: nestjs-adapter
    blocked_by: [OQ-2, U-4]
  - id: U-6
    title: 'AC3 verification + full AC6 regression run + CHANGELOG entry'
    layer: nestjs-tests
    blocked_by: [U-1, U-2, U-3, U-5]
---

# VP-006b — NestJS Container Adapter Performance: Analysis (STOP1)

> Advisory-panel synthesis (performance architecture + backward-compat/API
> guardian + tech-lead synthesis). **Zero implementation.** Answer the open
> questions in the frontmatter (`open_questions[].answer`), verify the
> decisions, set `status: approved`, then run
> `/orchestrate-ddd VP-006b-nestjs-adapter-performance`.

## Headline findings

1. **The task file is partially stale — AC3 is already done.** VF-030 (ADR-0038,
   merged 2026-07-11, after this task was written) removed the silent
   `new paramType()` fallback: `createInstance()` now resolves constructor
   dependencies through the inherited throwing `resolveDependency()`
   (ContainerServiceNotFoundError naming the owning service;
   CircularDependencyError with the full chain). AC3 is verify-only.

2. **A hot-path cost the task file missed:**
   `BaseContainerAdapter. resolveDependency()` (packages/di) calls
   `isRegistered()` then `resolve()`. Through this adapter that means **2×
   `moduleRef.get` per NestJS-side constructor param** and **1 wasted
   throw+catch per internally-registered param** — on top of the issue #1 the
   task already lists. Fixable with an adapter-local override (no packages/di
   changes) — see OQ-3/D-3.

3. **AC1 and AC2 as literally written cannot ship without breakage; both have
   safe reformulations.** AC2: register-time caching breaks 3 tests → lazy-once
   cache (D-1, OQ-5). AC1: see the reconciliation note below.

4. **AC4 collides with freshly pinned semantics.** VF-030 D5 (doc + tests)
   defines scope semantics as a snapshot at creation time; naive
   share-by-reference changes post-creation visibility and creates a `dispose()`
   hazard against the parent. Benchmark-first, then
   copy-on-write-preserving-snapshot is the recommended path (OQ-2).

## Panel reconciliation note (AC1)

The compat stage rated AC1 as MAJOR, claiming registry-first breaks the pinned
test `'should resolve from NestJS container first'`. The synthesis corrects
this: registry-first **with moduleRef fallback** (the only sensible
implementation — internal miss falls through to `moduleRef.get`) keeps that test
green, because the test's token is not registered internally, so `moduleRef.get`
is still invoked and still wins. The genuinely observable change is limited to a
token registered in **both** containers with **divergent** instances — a
configuration that is (a) untested, and (b) unsupported under ADR-0014's bridge
doctrine ("frameworks consume, never create"; a bridged dual registration
resolves to the same instance under either order). The decision remains with the
human (OQ-1) because the flip is real, just far narrower than the panel's
worst-case reading. One residual check: whether
`'should resolve from internal container if not in NestJS'` asserts the
`moduleRef.get` _call_ (it would then need a deliberate update).

## What the adapter costs today (confirmed against source, post-VF-030)

| Hot-path issue                                                     | Where                       | Status                                 |
| ------------------------------------------------------------------ | --------------------------- | -------------------------------------- |
| `moduleRef.get` first, throw+catch per internally-owned resolve    | `resolve()` L58–69          | Present → AC1/OQ-1                     |
| `Reflect.getMetadata('design:paramtypes')` per createInstance call | `createInstance()` L246–258 | Present → AC2/D-1                      |
| `isRegistered()`+`resolve()` double moduleRef hit per ctor param   | base `resolveDependency()`  | Present (new finding) → OQ-3/D-3       |
| Silent `new paramType()` fallback                                  | —                           | **Gone** (VF-030 D7) → AC3 verify-only |
| Full descriptor + singleton Map copy per `createScope()`           | `createScope()` L215–227    | Present → AC4/OQ-2                     |

Scope-copy math (perf stage): ~2×N Map entries per scope; at N=1000 services
under REQUEST-scoped load ≈ 100–160 KB churn per scope — material only at high
request rates and large registries, hence benchmark-first (OQ-2).

## AC rewording (pending OQ-5 approval)

**AC2 (current):** "Resolve `design:paramtypes` reflection ONCE at registration
time and cache a ready-to-call factory; resolve hot path performs no
`Reflect.getMetadata`."

**AC2 (proposed):** "Cache `design:paramtypes` lazily, once per constructor, on
first `createInstance()` (module-level
`WeakMap<Constructor, readonly Constructor[]>`, empty-array results cached too).
After first materialization of a constructor, no further `Reflect.getMetadata`
calls occur for it; `registerFactory`/`registerInstance` paths are unaffected."

**AC1 (if OQ-1 = Option A):** "resolve() checks the adapter's own registry first
and falls back to `moduleRef.get` on an internal miss; no exception-driven
control flow for internally-registered tokens. Precedence for dual-registered
tokens becomes internal-wins (ADR-0014 alignment) — covered by a new explicit
precedence test and a CHANGELOG note."

## Open questions

Human decisions required before implementation. Full text lives in the
frontmatter (`open_questions[]`) — answers go there. Summary:

- **OQ-1** — AC1 ordering: registry-first-with-fallback now (patch + new test,
  recommended) vs separate MAJOR task vs drop. _(answer in frontmatter)_
- **OQ-2** — AC4 variant: benchmark-first then COW (recommended) vs
  shared-read-only + register guard vs keep copy. _(answer in frontmatter)_
- **OQ-3** — adapter-local resolveDependency override (recommended) vs
  packages/di base fix; confirm follow-up task. _(answer in frontmatter)_
- **OQ-4** — audit the reference NestJS consumer for divergent dual
  registrations before shipping OQ-1. _(answer in frontmatter)_
- **OQ-5** — approve AC2 rewording to lazy-once. _(answer in frontmatter)_

## Decisions (proposed)

See frontmatter `decisions[]`: **D-1** lazy-once reflection cache; **D-2** AC3
verify-only; **D-3** adapter-local resolveDependency fix, packages/di untouched;
**D-4** count-based dev-only bench in packages/nestjs; **D-5** frozen
contracts + two mandatory new tests.

## Risks

- **Backward-compat (main):** precedence flip for divergent dual registrations
  (OQ-1/OQ-4); scope-semantics drift if AC4 strays from VF-030 D5 snapshot
  behavior (OQ-2); error-contract identity pinned by 4 test groups (D-5).
- **Package boundary:** the double-lookup fix tempts a packages/di change — kept
  out by D-3/OQ-3, mirroring the boundary reasoning that created VP-006b.
- **Security:** none — internal performance optimization; no auth/PII/
  cross-context/public-surface expansion. `threat_model: null`. Related
  (already-implemented) constraints come from TM-VF-030 via ADR-0038 (token
  reference identity), which this task must preserve, not extend.

## Procedural notes

- `.claude/knowledge/patterns/` rule cards are unavailable in this checkout
  (broken symlink to claude-patterns) — panel grounding used CLAUDE.md library
  rules + ADR-0005/0014/0023/0038 instead; pattern names in `patterns[]` refer
  to the canonical claude-patterns cards.
- RAG skipped: no `.claude/config/knowledge.json` (see `rag:` frontmatter).
- Panel ran as leaf agents (no sub-delegation); synthesis by tech-lead with a
  main-agent reconciliation pass (AC1 test-impact discrepancy corrected above).
