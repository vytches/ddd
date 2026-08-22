---
task: VF-037-cross-context-isolation-regression-suite
status: approved
approved_at: 2026-08-10 # human approval; OQ1/OQ2/OQ4 answered by the human, OQ3/OQ5/OQ6/OQ7 proposals accepted as written
created: 2026-08-10
analyst: /analyze-ddd (panel + main-agent synthesis)
stack_profile: typescript-library
branch_analysed:
  develop (working branch is the same commit, 4dbbd4a3 — verified, zero diff)
threat_model: docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md # Addendum VF-037 written 2026-08-10: adds TM-VB-003-005 / -006, repositions -001 as a detection control
rag:
  skipped (no .claude/config/knowledge.json in this repo; MCP
  knowledge-retriever not configured)
patterns: [] # .claude/knowledge/patterns/ does not exist here — only .claude/knowledge/patterns-local/. No Rule Cards could be injected into the panel; see "Procedural notes".

verification_note: >
  /analyze-ddd withholds Grep/Glob by design, including from Explore. Research
  was therefore run through `general-purpose` subagents, which retain Bash.
  Every claim below was verified by command on `develop`. Two panel claims did
  NOT survive re-checking and were removed — see "Corrections made during
  analysis". Anything still unverified sits in open_questions, not in findings.

decisions:
  - id: D1
    title:
      New test file in packages/nestjs/tests/, not a cross-package e2e location
    choice: >
      Add one new file under packages/nestjs/tests/, alongside the existing
      feature/ suite. Do not create a cross-package e2e project, and do not
      extend feature-isolation.test.ts.
    rationale: >
      packages/nestjs declares @vytches/ddd-cqrs and @vytches/ddd-events in
      `dependencies` (package.json:51-58), so both invariant families are
      reachable. Its Nx test target is `pnpm vitest run packages/nestjs/tests` —
      no include glob to edit, any new file is picked up.
      feature-isolation.test.ts (742 lines) never calls Test.createTestingModule
      at all; it asserts structurally against mocked DynamicModule graphs, so a
      real boot cannot live there. feature-di-wiring.e2e.test.ts is the right
      style model but is scoped to F-C4.
    status: confirmed by human 2026-08-10
    propose_adr: false
  - id: D2
    title: >
      The api-extractor crash is a validate:api defect, not a build-config
      defect. Do not rewrite the loop at aggregate-root.builder.ts:167.
    choice: >
      Make `validate:api` run a build plus `fix:dts` before invoking
      api-extractor (or document that it requires `pnpm build` first). Leave
      aggregate-root.builder.ts:167 alone — it is correct TypeScript. Treat the
      api-extractor version bump as unnecessary. Implementing the dead
      `dtsConfig.transformPaths` flag is a separate cleanup, not the fix.
    rationale: >
      `scripts/fix-dts-imports.js` rewrites `from
      '../../aggregates/src/index.ts'` to `from '@vytches/ddd-aggregates'`
      across every `dist/**/*.d.ts` (regex at :89-102, replace at :135). It runs
      from `build` (package.json:59), `build:clean` (:62) and CI (ci.yml:156) —
      but NOT from `validate:api` (:73), which invokes api-extractor directly
      against whatever is in dist/. The crash the task measured is that script
      hitting an unprocessed dist, not evidence that CI's gate is broken.
      Confirmed on disk: enterprise/dist/index.d.ts still carries the raw `.ts`
      re-export, i.e. it is in the pre-fix:dts state. `dtsConfig.transformPaths`
      is genuinely dead — declared at build-configs/types.ts:62, set true at
      index.ts:48 and :126, read nowhere (config-builders.ts:25-31 consumes only
      insertTypesEntry, outDir, entryRoot). But fix:dts already covers the same
      ground, so this is duplication to tidy, not a blocker.
    status:
      confirmed by human 2026-08-10 (rationale substantially revised after the
      fix:dts finding)
    propose_adr: true
  - id: D3
    title: The real dead gate is drift detection, not the crash
    choice: >
      Replace the `--local` + `git diff | grep` pattern with comparison mode
      (drop `--local`), which exits non-zero on drift. Then extend coverage to
      value-objects and remove `|| true` from contracts/events — but only after
      the baselines are settled.
    rationale: >
      ci.yml:159-164 and :171-176 detect drift with `git diff --name-only | grep
      -q "api-report"` and respond with `echo "⚠️"`. A command inside an `if`
      condition is exempt from `set -e`, so drift cannot fail the build — by
      construction, not by accident. The only blocking behaviour in the whole
      step is a non-zero exit from api-extractor at :170 (enterprise, no `||
      true`). So the step catches crashes and waves through exactly what it was
      built to catch. `--local` is the developer mode that copies the generated
      report over the committed baseline; dropping it is what turns the run into
      a comparison.
    status: confirmed by human 2026-08-10
    propose_adr: false
  - id: D4
    title:
      AC-CHECKLIST — add the missing fourth case, do not rewrite the checklist
    choice: >
      docs/process/behavioral-bc-checklist.md already has 10 questions and a
      "Prior occurrences" table holding three cases (VB-003/F-C4, VP-009 Bug #3,
      VF-036). Add VF-023 as the fourth. Wire it from release-process.md (under
      "Release Checklist Template") and from .github/pull_request_template.md,
      which already carries a "Breaking changes are documented and justified"
      line to hang it off.
    rationale: >
      The task's AC-CHECKLIST calibrates on four cases; the file ships with
      three. VF-023 appears nowhere in it (grep: zero occurrences). Nothing
      outside the two task files references the checklist at all.
    status: confirmed by human 2026-08-10
    propose_adr: false
  - id: D-TM
    title: No new threat model
    choice: >
      Do not create TM-VF-037.md. F-C4 is covered by
      docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md
      (TM-VB-003-001), VF-030 by TM-VF-030.md. VF-037 adds tests and CI wiring,
      no production surface.
    rationale: >
      No new attack surface. The one genuinely new risk — a re-baseline
      rubber-stamping a breaking public-API removal — is release integrity,
      which the behavioral-BC checklist owns, not STRIDE.
    status: confirmed by human 2026-08-10
    propose_adr: false

open_questions:
  - id: OQ1
    q: >
      Regenerating the contracts baseline removes the entire Scheduler subsystem
      from the public API (IEventScheduler, ISchedulerConfig,
      ISchedulerLifecycle, IScheduleOptions, IScheduledEvent, IScheduledJob,
      IJobFilter, IJobQueryResult, IRecurringPattern, enums BackoffStrategy /
      JobStatus / SchedulePriority, plus EVENT_HANDLER_METADATA and
      EVENT_HANDLER_OPTIONS) and adds Result, configureDiagnostics, enrichEvent,
      DiagnosticsOptions, DiagnosticsSink, DiagnosticsLevel,
      IAsyncDomainFactory, IBatchRepository, IDomainFactory. None of the removed
      symbols exist in packages/contracts/src/index.ts today. Was the Scheduler
      removal deliberate, and was it announced? Until this is answered the
      baseline must not be regenerated.
    blocking: true
    answer: >
      RESOLVED 2026-08-10 — deliberate, and safe to re-baseline. The removal
      happened in VF-013 (`e6e7b2b5`, 2026-03-31, "refactor: remove CLI package
      and unused scheduling interfaces"), whose commit message reads "Zero usage
      in any implementation package. External schedulers (pg-boss, BullMQ) are
      better alternatives" — consistent with the project's no-adapters stance.
      `packages/contracts/src/scheduling/` and the whole
      `packages/event-scheduling/` package were deleted; the symbols were not
      moved elsewhere (grep across every `packages/*/src/` finds none).
      Downstream consumer checked at the human's request: uses
      `@vytches/ddd@0.31.0-alpha.0` from npm and imports none of the 13 symbols
      — its own "schedule"/"JobStatus" hits are its domain vocabulary,
      unrelated. EVENT_HANDLER_METADATA / EVENT_HANDLER_OPTIONS are a separate
      story: still present, moved to `@vytches/ddd-contracts/internal` in VF-024
      (`3f8758d0`). Scope correction: comparison-mode runs show real signature
      drift in THREE packages (enterprise, contracts, events), not contracts
      alone. Each still needs its own reviewed re-baseline commit; only the
      Scheduler question is closed.
  - id: OQ2
    q: >
      Is the CI step at ci.yml:148 currently green? Everything hinges on this
      and it could not be verified — `gh` is unavailable in this environment, so
      no workflow run history was readable. If it is green, AC-GATES(a) has
      almost no work in it (fix:dts already handles the entry point) and the
      task's premise "the enterprise step aborts" applies only to local
      `validate:api`. If it is red, AC-GATES(a) is real and larger. Check a
      recent PR run before implementation.
    blocking: true
    answer: >
      RESOLVED 2026-08-10 by direct measurement, not by CI history. Note `pnpm
      prerelease` does not answer this — its chain (package.json:142) has no
      api-extractor step at all. What does answer it: `nx run-many
      --target=build --projects=contracts,events,enterprise` + `pnpm run
      fix:dts` (exactly ci.yml:152+156), then api-extractor in comparison mode,
      WITHOUT `--local`, which writes only to gitignored temp/ and mutates no
      baseline. Result: the build passes, fix:dts rewrites the paths as
      intended, and the "Internal Error" at aggregate-root.builder.ts:167 DOES
      NOT OCCUR. D2 is confirmed — the crash was `validate:api` running against
      an unprocessed dist/, nothing more. But all three configs exit 1 on
      signature drift. CI passes `--local`, which copies rather than compares,
      so CI exits 0 and the step goes green while three packages are genuinely
      drifted. So the gate is not red — it is GREEN AND MEANINGLESS, which is
      worse and is exactly what D3 describes. `git status` clean afterwards; no
      baseline touched.
  - id: OQ3
    q: >
      Given OQ2, does AC-GATES stay inside VF-037 or split into its own task?
      Its content has shifted: less "fix a crash", more "make drift detection
      actually fail the build" (D3) plus "make validate:api reproduce CI" (D2).
      The 13h estimate was written against the old shape.
    blocking: true
    answer: >
      PROPOSED 2026-08-10 (confirm or override on approval) — keep AC-GATES
      inside VF-037. Now that OQ2 is measured, the work shrank: no
      transformPaths implementation, no loop rewrite, no api-extractor bump.
      What remains is (a) drop `--local` in CI so drift exits non-zero, (b) add
      value-objects to the CI step, (c) add build+fix:dts to `validate:api` so
      it reproduces CI instead of crashing, (d) three separately reviewed
      re-baseline commits, and only then (e) remove `|| true` from
      contracts/events. That is a day of work, not a second task, and it shares
      a reviewer with the checklist wiring. Original 13h estimate still holds
      for the whole task.
  - id: OQ4
    q: >
      Confirm D-TM: no TM-VF-037.md and no addendum to TM-VB-003. If you would
      rather have the re-baseline risk recorded as a security finding than a
      process one, say so and an addendum gets written before implementation
      starts.
    blocking: true
    answer: >
      RESOLVED 2026-08-10 — human chose the addendum. Written into
      docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md as
      "Addendum VF-037 (2026-08-10)": A1 repositions TM-VB-003-001 as a
      detection control and explicitly keeps the inter-module onModuleInit
      ordering race OUT of what VF-037 closes; A2 adds TM-VB-003-005
      (api-surface gate cannot fail on drift); A3 adds TM-VB-003-006 (stale
      baselines invite rubber-stamped approval); A4 records that a clean surface
      diff is not evidence of behavioural safety. No separate TM-VF-037.md.
      Parent TM stays DRAFT pending Tech Lead sign-off.
  - id: OQ5
    q: >
      packages/logging does not exist on develop at all, yet all three worktrees
      under .claude/worktrees/agent-* carry it (20 packages vs 19). Stale
      worktrees, or a package that was dropped? Out of scope for VF-037 either
      way, but worth knowing before someone trusts a worktree.
    blocking: false
    answer: >
      PROPOSED — out of scope, no action in VF-037. The worktrees under
      .claude/worktrees/agent-* are stale agent scratch space, not a source of
      truth; develop has 19 packages and that is the reference. Worth a separate
      cleanup task if the worktrees are still being reused.
  - id: OQ6
    q: >
      The api-surface step is gated on `if: github.event_name == 'pull_request'`
      (ci.yml:149), so it never runs on push or tag. Should the release path be
      covered too, or is PR-only intended?
    blocking: false
    answer: >
      PROPOSED — leave PR-only in VF-037. Once the gate genuinely fails on drift
      (AC-GATES), a PR-gated check is sufficient: nothing reaches develop
      without a PR. Extending it to tags would only catch drift introduced by
      the release commit itself, which lerna generates. Revisit if direct pushes
      to develop ever become normal.
  - id: OQ7
    q: >
      examples/nestjs/tests/wiring.test.ts runs only when Nx considers
      examples/nestjs affected. Does AC2 ("every PR") extend to the examples
      project, or is packages/nestjs coverage enough?
    blocking: false
    answer: >
      PROPOSED — packages/nestjs coverage is enough for AC2. wiring.test.ts
      guards that the DOCUMENTED shape still boots, which is a different concern
      from the isolation invariants and is correctly scoped to the examples
      project. `nx affected` reaches it whenever examples/nestjs or its
      dependencies change, which is when it matters. No change needed.
---

# VF-037 — analysis

Two threads. The suite is smaller than the task assumes; AC-GATES is a different
shape than the task assumes, though not necessarily bigger.

Everything below was checked on `develop`. The working branch is the same commit
(`4dbbd4a3`, zero diff), so there is no branch-drift risk in these findings.

## AC1 — coverage against what already exists

| Invariant                                                                  | State                              | Evidence                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) commands/queries from context A never reach context B handlers         | **gap on a real boot**             | `feature-isolation.test.ts:617-741` covers this against a hand-built `Map` mock. That file never calls `Test.createTestingModule` at all. `feature-di-wiring.e2e.test.ts:88-198` is a real boot with one context                                                             |
| (b) forRoot() + N×forFeature() give distinct, bridged bus token identities | **partial**                        | class-token path with one forFeature: `global-bus-acl.test.ts:120-231`. Symbol-token path: `symbol-token-injection.test.ts:22-102`, but via `forTesting()`. No test with N≥2 contexts                                                                                        |
| (c) explorer registration alive end-to-end                                 | **command covered, query missing** | command dispatch → handler → result at `feature-di-wiring.e2e.test.ts:145-148`. No real-boot equivalent for `IQueryBus`; query side is mock-only (`feature-isolation.test.ts:447-490`)                                                                                       |
| (d) events from A not observed by B unless bridged                         | **gap**                            | `feature-di-wiring.e2e.test.ts:160-176` proves an event reached its own LOCAL_EVENT_BUS. There is no context B in that test, so no negative assertion exists. The `instanceof IntegrationEvent` routing at `context-aware-event-dispatcher.ts:74-98` has no integration test |

One shape underneath all four: every real-boot test in the repo has exactly one
`forFeature()` context. `global-bus-acl.test.ts` gets closest — `'orders'` at
:154 and `'catalog'` at :210 — but those are two separate boots, not two
contexts sharing one module graph. Nothing anywhere puts two bounded contexts
side by side on a live container, which is the only place the isolation claim
can actually be falsified. That is what the new file is for, and why extending
an existing one does not work.

AC3 is further along than written. `feature-di-wiring.e2e.test.ts` already
carries an "F-C4 / TM-VB-003-001 regression gate" docblock,
`symbol-token-injection.test.ts` names VP-009 Bug #3,
`bus-registration-ledger.test.ts` names VB-003/D-3. Missing: named cases for
VF-030 and VP-009 Bugs #1-#2.

AC2 holds. `@vytches/ddd-nestjs` has static graph edges to both cqrs and events,
and `nx affected` propagates upward to dependents, so a file in
`packages/nestjs/tests/` runs whenever either package changes.

## AC-GATES — what is actually broken

The task's amendment measured real things. The interpretation needs adjusting on
one point, and it turns out to understate a different problem.

**The crash is a `validate:api` defect.** `scripts/fix-dts-imports.js` rewrites
`from '../../aggregates/src/index.ts'` into `from '@vytches/ddd-aggregates'`
across every `dist/**/*.d.ts` (regex at :89-102, replace at :135). It runs from
`build` (package.json:59), `build:clean` (:62), and CI calls it explicitly at
ci.yml:156 — with a comment saying exactly why. `validate:api` (package.json:73)
does none of that; it runs api-extractor straight against whatever is sitting in
dist/. Handed an unprocessed `.d.ts` that re-exports a raw `.ts`, api-extractor
walks into implementation code and dies at `aggregate-root.builder.ts:167`. The
loop on that line is ordinary correct TypeScript. Neither rewriting it nor
bumping api-extractor addresses anything. The on-disk state confirms the
mechanism: `enterprise/dist/index.d.ts` currently still holds the raw `.ts`
re-export, so nobody ran `fix:dts` after the last build.

`dtsConfig.transformPaths` really is dead — declared at
build-configs/types.ts:62, set to `true` at index.ts:48 and :126, never read
(config-builders.ts:25-31 consumes only `insertTypesEntry`, `outDir`,
`entryRoot`). Two mechanisms were designed for the same job and only the
post-processing one was finished. Worth tidying, not worth blocking on.

**The gate that is genuinely dead is drift detection.** ci.yml:159-164 and
:171-176 look for drift with `git diff --name-only | grep -q "api-report"` and
answer with `echo "⚠️"`. A command in an `if` condition is exempt from `set -e`,
so drift cannot fail the build — structurally, not by oversight. The only
blocking behaviour in the entire step is a non-zero exit from api-extractor at
:170. The step therefore catches crashes and waves through precisely the thing
it exists to catch. This is worse than the task's framing: the problem is not
only that `--local` overwrites the baseline, it is that even the drift the
script does notice was never wired to a failure.

**Baseline staleness is two of four.** contracts and events sit at `588c5eb7`
(2026-04-16). enterprise moved at `27e00551` (2026-07-11, VF-031); value-objects
at `c88e728e` (2026-08-09, VF-036). Working tree clean. Note the enterprise
baseline is `api-report/ddd.api.md`, not `ddd-enterprise.api.md`.

## Corrections made during analysis

Two panel claims failed re-checking and are not in the findings above. Recording
them because both are the failure mode VF-037 was written to prevent.

The first draft of this artifact claimed the CI api-extractor lines were
166/167/172 and that the task's 157/158/170 had drifted. Direct read of ci.yml
shows **157/158/170 is correct**; the task was right and the panel agent
miscounted. The second draft claimed the api-extractor crash proved CI's gate
was broken, which collapsed once `fix:dts` at ci.yml:156 was read — the local
script and the CI step do different things, and only the local one was ever
measured.

Both errors survived one round of review each. The lesson is the one already in
the task: a claim about what a gate does is worth exactly what the command that
produced it was run against.

## State of the VP-009 bridge

Project memory recorded on 2026-08-08 that the Symbol-token bridge existed only
in `forRoot()`. On `develop` it does not. `busTokenBridge()`
(vytches-ddd.module.ts:56-69) is called from `forRoot()` (:91), `forContext()`
(:137) and `forContexts()` (:199); `forFeature()` gets the tokens through
`useExisting` aliases in `vytches-ddd-feature.module.ts:82-87`; `forTesting()`
registers stubs directly under both tokens via `useValue` (:246-312).
`GLOBAL_COMMAND_BUS` / `GLOBAL_QUERY_BUS` stay forRoot-only, which is intended
and commented as such at feature module :77-81.

`main` was not checked and does not matter here — the alpha build has not been
merged into it, so `develop` is the reference. Memory has been corrected.

## Risks

The re-baseline can do real damage. contracts drops an entire Scheduler
subsystem from the public surface. Some of that diff is clearly intended
(`Result` moving into contracts, REL-008, 2026-05-08), but a removal that size
deserves an explicit decision and a changelog entry rather than arriving as a
side effect of whoever runs the tool first. OQ1 blocks on it.

Sequencing matters more than scope. Turning contracts and events into blocking
gates while contracts carries four months of unreviewed drift produces a red
build on day one, and a gate people learn to override is worse than no gate.

And the line the task asks for in the outcome: a clean api-surface diff proves
the shape did not change. It says nothing about behaviour. VF-036 would have
passed it. That is why AC-CHECKLIST sits alongside AC-GATES rather than instead
of it.

## Procedural notes

The panel ran without Rule Cards — `.claude/knowledge/patterns/` and
`.claude/knowledge/decisions/` do not exist here (only `patterns-local/`), so
command steps 0.5 and 0.7 had nothing to inject. RAG skipped: no
`.claude/config/knowledge.json`. Synthesis was done by the main agent rather
than a separate leaf, which the command permits.

`/analyze-ddd` withholds Grep and Glob deliberately, including from Explore. The
working approach under that constraint is `general-purpose` subagents, which
keep Bash: one narrow question each, an explicit tool-call budget, and a warning
that the first Bash call hits the Fact-Forcing Gate and should be answered
rather than treated as a block. That is how every fact here was gathered.

## Named symbols — existence check

Verified present: `busTokenBridge`, `FeatureHandlerRegistrar`,
`VytchesExplorerService`, `ContextAwareEventDispatcher`, `COMMAND_BUS_TOKEN`,
`QUERY_BUS_TOKEN`, `GLOBAL_COMMAND_BUS`, `GLOBAL_QUERY_BUS`,
`BusRegistrationLedger`, `scripts/fix-dts-imports.js`,
`.github/pull_request_template.md`, `docs/process/behavioral-bc-checklist.md`,
`project-orchestration/release-process.md`.

**Does not exist — must be created:** the N-context regression suite file, a
VF-023 row in the checklist's "Prior occurrences" table, any reference to the
checklist from release-process.md or the PR template, a build+fix:dts step
inside `validate:api`, and a comparison-mode (non-`--local`) invocation anywhere
in CI.

## Suggested mutations for AC6

1. `context-aware-event-dispatcher.ts:75` — invert
   `if (event instanceof IntegrationEvent)`. Should break invariant (d).
2. `feature-handler-registrar.ts:165` — flip `scope !== 'global'` to
   `scope === 'global'`. Should break (a) and (c), plus an existing test.
3. `vytches-ddd.module.ts:59-68` — point `busTokenBridge()`'s `inject` at a
   token that cannot resolve. Should break the Symbol-token half of (b).
4. `vytches-ddd.module.ts:99-107` — make `GLOBAL_COMMAND_BUS` resolve from a
   feature-scoped bus instead of root. Should break `global-bus-acl.test.ts`
   CT-3.
5. Aimed at the new N-context test: change `FeatureHandlerRegistrar`'s
   own-module lookup from Symbol-reference identity to name comparison, so
   registrar A can match module B. Nothing in the repo catches this today.
