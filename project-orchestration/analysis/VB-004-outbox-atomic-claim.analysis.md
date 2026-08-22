---
task: VB-004-outbox-atomic-claim
status: approved
threat_model: null
rag:
  'skipped (.claude/config/knowledge.json not found — graceful fallback per
  /analyze-ddd step 0.6)'
patterns:
  - 'ts-library-patterns Rule 1 (explicit barrel exports) — applies to any new
    export from IOutboxRepository/ResilienceContext barrels'
  - 'ts-library-patterns Rule 2 (never narrow existing types, add optional) —
    governing constraint for AC#5'
  - 'ts-library-patterns Rule 6 (contract tests for public API behavior) —
    governs AC#2 test design'
  - 'project CLAUDE.md: "All public API changes must maintain backward
    compatibility" — binding for claimBatch/dispose additions'
  - 'in-file precedent: IOutboxRepository.scheduleRetry / resetStaleProcessing
    (outbox-repository.interface.ts:104,126) — existing
    concrete-with-default-body pattern on this exact abstract class, reused for
    claimBatch'
  - 'in-file precedent: bulkhead.ts:88-99 — canonical clearTimeout-in-finally
    pattern for this package (partially reused for AC#3; explicitly NOT reused
    as-is for AC#4, see D4)'
open_questions:
  - id: OQ-1
    question: >-
      Time estimate & unit split: accept 6h as at-risk (single unit), or
      pre-approve splitting into VB-004a (messaging, ~3h) + VB-004b (resilience,
      ~3h)? Panel recommendation: split — two independent packages, zero shared
      risk, makes any time-pressure descope visible and honest instead of
      silently trimming the highest-risk piece (AC#2's RED/GREEN
      concurrency-fake pairing, independently estimated at 1.5-2h alone).
    answer: >-
      Single unit/run (one /orchestrate-ddd invocation, one PR) — do NOT split
      into VB-004a/VB-004b as separate task files or invocations. Keep U-1
      (messaging) and U-2 (resilience) as clearly separated sections/phases
      within that one run (own phase() blocks, own implement→verify loop per
      unit, own attempt budget) so the two halves stay individually reviewable
      and any time-pressure descope is still visible per-section — just not run
      as two independent task/PR-level efforts.
  - id: OQ-2
    question: >-
      The panel discovered a SECOND leak not in the original F-H3 finding:
      fork()/withAttempt() in resilience-context.ts also leak an
      addEventListener('abort', ..., {once:true}) listener on the PARENT signal
      — {once:true} only auto-removes on abort, so on the happy path (parent
      never aborts) the listener never gets removed. Fixing this changes AC#4's
      shape (removeEventListener needed, not just clearTimeout). Keep this in
      VB-004's scope, or split it to a follow-up task? Panel recommendation:
      keep in VB-004 — same root cause (no disposal on settle), same fix
      pattern, same test; splitting would be artificial granularity for a
      same-file same-root-cause fix.
    answer: >-
      Keep in VB-004's scope. Unanimous across architecture-guardian,
      library-api-guardian, library-expert (consulted 2026-07-03): same
      file/interface/PR either way, D-4 already unifies both leaks behind one
      optional dispose?() member — splitting would mean a second
      interface-touching PR for what reads as "the same disposal fix, done
      twice" (worse changelog/semver optics per library-api-guardian).
  - id: OQ-3
    question: >-
      A full AbortSignal.any()/AbortSignal.timeout() native rewrite of
      fork()/withAttempt() was identified as the "real" long-term fix (Node 22
      native, engines.node >=22.19.0 confirmed available; eliminates the manual
      timer, manual clear, AND the listener leak in one stroke) but requires
      reworking controller-sharing in withMetadata/withAttempt — assessed as out
      of VB-004's 6h budget. Create an explicit small follow-up backlog task now
      (~30min-1h, well-scoped), or leave as a prose recommendation in this
      artifact that risks being lost? Panel recommendation: create now, to
      prevent loss in post-VB-004 triage. (Note: /analyze-ddd itself does not
      create task files — this requires a human/subsequent step, e.g.
      `/task-tidy` or manual task creation, if answered yes.)
    answer: >-
      Create the backlog task now. Unanimous. This project's own history
      (VB-002/VB-003 spawning VD-006/VD-007/VF-026 as discrete task files) shows
      prose-in-an-artifact reliably gets lost; task is well-scoped (~30min-1h)
      so creation cost is low. library-api-guardian's refinement: scope it
      explicitly as "internal refactor, no public API signature change" but note
      the dependency it creates — once the native AbortSignal.any()/timeout()
      rewrite lands, D-4's dispose?() may become a no-op / deprecation
      candidate; record that link in the new task so it isn't orphaned later.
      architecture-guardian's framing: cheap insurance against the manual-timer
      pattern becoming permanent by default. Human/subsequent step still
      required to actually create the task file (this artifact cannot).
      **Done**: created
      `project-orchestration/tasks/VF-027-resilience-context-abortsignal-rewrite.md`.
  - id: OQ-4
    question: >-
      AC#1's default (non-atomic) claimBatch implementation marks messages
      PROCESSING before dispatch — the panel noted this should already be
      visible to the existing resetStaleProcessing()/crash-recovery path with
      zero new code, but this interaction is not currently proven by any test
      (free coverage, not in the original AC list). Add as a required one-line
      test within VB-004's scope, or leave as an optional stretch goal for a
      later task? Panel recommendation: stretch goal — nice-to-have integration
      coverage, not blocking AC#1/AC#2's core correctness claim.
    answer: >-
      Stretch goal, not required. Unanimous. AC#1/AC#2's core correctness claim
      (atomic claim prevents double-dispatch) is fully covered by D-3's
      RED/GREEN pairing independent of this interaction; given OQ-1's
      already-flagged at-risk budget and D-3 alone estimated at 1.5-2h, do not
      add unbudgeted scope. architecture-guardian's addition: pull it into the
      very next messaging-package task as a priority item (undocumented implicit
      coupling between claimBatch's PROCESSING-marking and
      resetStaleProcessing's crash-recovery read can silently erode if left
      indefinite) — not "later, maybe."
  - id: OQ-5
    question: >-
      Process-only, not a design blocker: stages 2 and 3 of the panel both had
      Grep/Glob/Bash tool access denied this session (confirmed via 3
      independent attempts, including by the orchestrator directly), so "does
      any real `implements IOutboxRepository` / `implements ResilienceContext`
      consumer exist in this repo" is unverified. The recommended fix (optional
      `?` members) is safe under TS structural typing regardless of the answer,
      so this does NOT block approval — included here only so a human can either
      (a) answer from known knowledge, or (b) confirm the implementation phase
      should re-run this grep once tool access is available, as a checklist item
      rather than a gate.
    answer: >-
      RESOLVED (2026-07-03) — Grep/Bash access was available to all 3 consulted
      agents this time (architecture-guardian, library-api- guardian,
      library-expert), independently converging on the same result. `implements
      ResilienceContext`: exactly 1 match, `DefaultResilienceContext` itself —
      zero external implementers anywhere in the repo, D-4 is lower-risk than
      assumed. `extends IOutboxRepository`: 4 matches — 3 inline test fixtures
      in packages/messaging/tests/outbox/outbox-processor.test.ts, plus ONE REAL
      cross-package consumer:
      packages/testing/src/outbox/in-memory-outbox.repository.ts's
      `InMemoryOutboxRepository`, publicly exported from @vytches/ddd-testing's
      barrel (packages/testing/src/index.ts:36). It implements only the
      currently-abstract members and does NOT override claimBatch — confirming
      it will safely and silently inherit D-2's new default claimBatch the
      moment this ships, and that D-2's `?`-optional (not abstract/required)
      choice is EMPIRICALLY NECESSARY, not just theoretically safe: had
      claimBatch been added as a required abstract member, this real, publicly-
      shipped class would fail to compile today (library-api-guardian). Doc
      examples (LLMGUIDE.md/README.md/HOW-TO-outbox.md) also show the intended
      consumer pattern as `extends IOutboxRepository`
      (Pg/PostgresOutboxRepository), consistent with this. No longer a checklist
      item — action: cite this finding in the VB-004 PR description as concrete
      justification for the optional-member design, and run
      @vytches/ddd-testing's own test suite as part of VB-004 verification
      (architecture-guardian) since it's the one real consumer that will pick up
      new default behavior automatically.
decisions:
  - id: D-1
    decision: >-
      Outbox message-handler timeout (outbox-processor.ts, the Promise.race
      around handler.handle(msg)): wrap in `try { await Promise.race([...]) }
      finally { if (timeoutId !== undefined) clearTimeout(timeoutId) }` — NOT
      bulkhead.ts's `.finally()`-on-the-operation-promise shape, since the
      outbox "operation" is an arbitrary consumer handler that may hang
      indefinitely; try/finally clears the timer the instant the race settles
      regardless of whether the loser ever does.
    rationale: >-
      Confirmed correct and idiomatic by both architect and
      backend-technology-expert stages; no unhandledRejection risk from the race
      loser (V8 attaches a rejection reaction via Promise.race itself). Orphaned
      handler continuing to run after timeout-wins is a pre-existing,
      out-of-scope risk (wasted work / late side-effect, not a crash) — needs a
      code comment, not a fix.
    adr: null
    propose_adr: false
  - id: D-2
    decision: >-
      Add `claimBatch?(limit?, priorityOrder?, messageTypes?):
      Promise<IOutboxMessage[]>` to `IOutboxRepository` as an OPTIONAL concrete
      method (not abstract, not required) with a default implementation that
      delegates to the existing getUnprocessedMessages() + a batch status update
      to PROCESSING — explicitly documented as non-atomic/single-worker-only in
      its default form. `getUnprocessedMessages` itself is NOT modified — its
      existing pure-read contract stays untouched. Processor usage is gated
      behind a new opt-in `OutboxProcessorOptions.useClaimBatch?: boolean`
      (default false).
    rationale: >-
      IOutboxRepository is confirmed an abstract class with existing precedent
      for concrete-with-default methods (scheduleRetry, resetStaleProcessing).
      Declaring it OPTIONAL (not just concrete-with-default) is required because
      `implements`-based consumers are not protected by a default body under TS
      structural typing — only `?` protects them (library-api-guardian finding,
      supersedes architect's initial "just concrete" framing). Retrofitting
      getUnprocessedMessages itself was rejected because it is currently a
      side-effect-free read called by consumers outside the processor
      (monitoring/inspection) — silently making it also flip status would be an
      undocumented behavioral break despite an unchanged signature.
    adr: null
    propose_adr: false
  - id: D-3
    decision: >-
      AC#2 concurrency test: extend the EXISTING `InMemoryOutboxRepository`
      fixture already present in
      packages/messaging/tests/outbox/outbox-processor.test.ts (1269 lines) with
      a claimBatch variant that performs read+mark as a synchronous critical
      section (zero `await`/microtask yield between them, correctly modeling
      mutual exclusion under Node's single-threaded event loop). Run two
      `processBatch()` calls concurrently via `Promise.all(...)` on the SAME
      processor instance (confirmed safe/equivalent to separate instances —
      processBatch() has zero internal concurrency guard/mutex). REQUIRED
      pairing: a RED control fake with one inserted `await Promise.resolve()`
      gap between read and mark, proving it DOES double-dispatch — so the GREEN
      result is proof, not a tautology. Test must explicitly document it proves
      "the processor honors an atomic-claim contract when the repository
      provides one," not that the shipped default claimBatch or any real
      repository is atomic. Test must manage fake timers / call stop() so it
      does not leak the very timers this task fixes.
    rationale: >-
      library-quality-verifier confirmed processBatch()'s lack of internal state
      makes same-vs-separate-instance a non-issue, and identified the existing
      fixture as the right base to extend rather than rewriting from scratch,
      for consistency with established test conventions in this file
      (vi.useFakeTimers, vi.spyOn call-count assertions).
    adr: null
    propose_adr: false
  - id: D-4
    decision: >-
      resilience-context.ts's fork() timer/listener leak fix: add optional
      `dispose?(): void` to the `ResilienceContext` INTERFACE (confirmed a plain
      interface, not a class, and NOT currently re-exported from
      packages/resilience/src/index.ts's public barrel — only
      DefaultResilienceContext is exported, which lowers real-world breakage
      risk). Real implementation lives only on DefaultResilienceContext: clears
      the fork timer AND removes the addEventListener('abort', ...) listener
      registered on the PARENT signal on settle (not just clearTimeout/unref).
      Internal consumers (CircuitBreaker.execute, TimeoutStrategy.execute) call
      `context.dispose?.()` in a finally block. This SUPERSEDES the architect
      stage's initial "timer.unref?.() + clear-on-abort" framing —
      backend-technology-expert's fuller analysis (unref only masks the
      process-exit symptom, does not fix the listener leak or stop the timer
      firing uselessly) is the version carried forward.
    rationale: >-
      unref() alone was assessed as a band-aid: it changes process-exit
      semantics (a real behavior change for CLI/script consumers relying on
      "process stays alive until timeout fires") without fixing the
      independently-discovered listener leak. Interface has no default-body
      mechanism (unlike IOutboxRepository), so optional member is the only
      non-breaking path; keeping it on the interface (not class-only) preserves
      usable disposal through fork()'s return type despite ResilienceContext not
      being publicly exported today.
    adr: null
    propose_adr: false
  - id: D-5
    decision: >-
      Timer-clearance proof mechanism: `vi.useFakeTimers()` +
      `vi.getTimerCount()` asserting the count returns to its pre-test value
      after the operation completes (both success and early-exit/throw paths) —
      a new idiom for this repo (no existing precedent found in
      circuit-breaker.test.ts or bulkhead.test.ts, which use
      vi.advanceTimersByTime + spy-call-count instead). Listener-leak proof for
      D-4's abort-listener fix needs a SEPARATE assertion (getTimerCount will
      not catch an EventTarget listener) — exact mechanism (spy on
      removeEventListener, or manual instrumentation) left to implementation,
      since Vitest has no built-in listener-count helper.
    rationale: >-
      library-quality-verifier's review of actual existing test files confirmed
      no precedent exists for either mechanism, and that
      packages/resilience/tests/core/ has no test file for
      DefaultResilienceContext/fork() at all today — this is greenfield
      test-suite work, not an extension, and should be budgeted as such.
    adr: null
    propose_adr: false
  - id: D-6
    decision: >-
      No formal STRIDE/DREAD threat-model for VB-004. This is a
      concurrency/reliability bugfix (duplicate dispatch, resource leak), not a
      security redesign — no auth/identity boundary, no direct sensitive-data
      exposure, no spoofing/tampering/repudiation vector (unlike VB-003's
      cross-context event leak, which was a genuine info-disclosure threat).
      Duplicate dispatch COULD amplify security-sensitive side effects in
      specific consumer handler logic (e.g. double-charging), but the library is
      generic and does not know what handlers do — this is a consumer
      idempotency concern to document, not a library-side threat surface to
      model.
    rationale: >-
      Confirmed independently by both the orchestrator's initial assessment and
      the tech-lead synthesis stage; no dissent from any panel stage. Timer leak
      is itself a mild DoS-adjacent risk under load, but the fix eliminates it
      rather than introducing it.
    adr: null
    propose_adr: false
units:
  - id: U-1
    scope: '@vytches/ddd-messaging (AC#1, #2, #3)'
    summary: >-
      claimBatch() optional method + useClaimBatch opt-in flag on
      IOutboxRepository/OutboxProcessorOptions; RED/GREEN concurrency test
      extending the existing InMemoryOutboxRepository fixture; try/finally
      clearTimeout fix in outbox-processor.ts's message-handler race. Estimated
      ~3h (D-3's test is the dominant cost, 1.5-2h alone).
  - id: U-2
    scope: '@vytches/ddd-resilience (AC#4)'
    summary: >-
      dispose?() optional method on ResilienceContext interface, implemented on
      DefaultResilienceContext (clearTimeout + removeEventListener on settle,
      addressing both the original F-H3 timer leak and the panel-discovered
      parent-listener leak); wired into CircuitBreaker.execute and
      TimeoutStrategy.execute finally blocks (note: TimeoutStrategy is currently
      a .then/.catch chain, not try/finally — this is a structural change, not a
      one-line edit). Fully greenfield test suite
      (packages/resilience/tests/core/ has no existing DefaultResilienceContext
      test file). Estimated ~3h.
  - note: >-
      OQ-1 resolved: single /orchestrate-ddd run, single PR — U-1 and U-2 run as
      two clearly separated phase()-scoped sections within that one run (own
      implement→verify loop, own attempt budget each), NOT as two separate task
      files/invocations like VD-007's multi-batch approach. AbortSignal.any
      native rewrite (OQ-3) is explicitly NOT a unit of this task if answered
      "create separately" — it would need its own task file first.
---

## Summary

VB-004 fixes two related-but-independent bugs surfaced by LIB-AUDIT-2026-07-02:
**F-H2** (outbox double-dispatch — no atomic-claim contract, so concurrent
workers can dispatch the same message twice) and **F-H3** (timer leaks on the
happy path in two `Promise.race`/timeout patterns — outbox message handling, and
`resilience-context.ts`'s `fork()`). A four-stage panel (architect →
backend-technology-expert → library-api-guardian → library-quality-verifier →
tech-lead synthesis) confirmed both bugs against the real source (paths had
drifted from the task spec — messaging code now lives under
`packages/messaging/src/outbox/`, resilience under
`packages/resilience/src/{core,patterns}/`) and converged on a concrete,
backward-compatible fix shape for all 5 acceptance criteria. The panel also
**surfaced two things the original task spec did not mention**: (1) the outbox
timer leak scales per-message up to `batchSize` (default up to 10,000)
concurrent 30s timers, not "a" leak; (2) `fork()`/`withAttempt()` also leak an
`abort` listener on the **parent** signal (`{once:true}` only removes on abort,
never on happy-path settle) — a second, independent leak in the same code path
that the originally-scoped fix (`clearTimeout`/`unref`) alone would not have
caught.

The panel's headline recommendation, requiring human sign-off, is to **split
this task into two independent units** (messaging: AC#1-#3; resilience: AC#4)
because the 6h estimate was assessed as at-risk — dominated by AC#2's RED/GREEN
concurrency-fake test (1.5-2h alone) and AC#4's fully greenfield test suite for
`DefaultResilienceContext` (no existing test file). No threat-model is
recommended (D-6) — this is a reliability bugfix, not a security-boundary
change.

**Process note:** Grep/Glob/Bash tool access was denied to two panel stages and
to the orchestrator's own direct attempts this session (confirmed via 3
independent tries) — see OQ-5. This left one question genuinely unverified (do
any real `implements IOutboxRepository`/`implements ResilienceContext` consumers
exist in this repo), but does not block the recommendation since the chosen
mechanism (optional `?` members) is safe under TypeScript structural typing
regardless of the answer.

## Panel findings by area

### Design (architect + backend-technology-expert)

Both bugs confirmed against real code with corrected line numbers. Recommended
`claimBatch()` as a new optional method rather than retrofitting
`getUnprocessedMessages` (would silently change its existing side-effect-free
contract). The `try/finally` pattern for the outbox race was confirmed as
better-fitted than a literal copy of `bulkhead.ts`'s `.finally()` shape, since
the outbox "operation" is an arbitrary, possibly-hanging consumer handler.
`resilience-context.ts`'s `fork()` was correctly flagged as NOT the same shape
as `bulkhead.ts` (AbortController-based, not `Promise.race`) — the Node.js-lens
review upgraded the initial "unref is enough" framing to "clearTimeout +
removeEventListener on settle," after discovering the parent-listener leak that
unref alone would not fix. A full `AbortSignal.any()`/`AbortSignal.timeout()`
native rewrite (Node 22, confirmed available) was identified as the "real"
long-term fix but assessed out of budget — see OQ-3.

### Backward compatibility (library-api-guardian)

Confirmed `IOutboxRepository` is an abstract class (existing precedent for
concrete-with-default methods) and `ResilienceContext` is a plain interface not
currently exported from the resilience package's public barrel (lowering
breakage risk of touching it). Sharpened the design panel's recommendation:
`claimBatch` must be `?`-optional, not just concrete-with-default, to protect
`implements`-based consumers under TS structural typing — a distinction the
design stage had not drawn. Verdict: CONDITIONAL GO, with the one unresolved
verification item captured as OQ-5.

### Test strategy (library-quality-verifier)

Read the actual existing test files rather than assuming test shape. Found a
reusable `InMemoryOutboxRepository` fixture already in the messaging test suite
(extend, don't rewrite) but zero existing test coverage for
`DefaultResilienceContext`/`fork()` in resilience (fully greenfield). Confirmed
`processBatch()` has no internal concurrency guard, resolving an open design
question about same-instance vs. separate-instance concurrent testing (doesn't
matter — use same-instance for simplicity). **Flagged the 6h estimate as
at-risk** with a concrete hour-by-hour breakdown, and surfaced one piece of free
bonus coverage (claimed-but-crashed batches should already be visible to the
existing `resetStaleProcessing` crash-recovery path — worth a one-line test, not
a new AC).

### Synthesis (tech-lead)

Reconciled all stages, confirming the Node.js-lens review's fuller
"clearTimeout + removeEventListener" recommendation supersedes the design
stage's initial "unref is enough" framing (D-4 carries the final version
forward). Recommended the two-unit split (D-3/D-4's estimated 3h each) over
accepting a single at-risk 6h unit, and assessed no threat-model is needed (D-6)
— a reliability bug, not a security-boundary change; the
duplicate-dispatch-amplifying-security-sensitive-side-effects angle is real but
is a consumer idempotency concern, not a library-side attacker-exploitable
vector.

## Process notes

- Grep/Glob/Bash tool access was denied to two panel stages
  (library-api-guardian, an Explore-agent follow-up) and to the orchestrator's
  own direct Bash attempts this session (3 independent tries, including a plain
  `git status` sanity check that also failed) — this appears to be a
  session-wide permission-mode restriction, not specific to any one agent or
  tool. This left the
  `implements IOutboxRepository`/`implements ResilienceContext` consumer-count
  question unverified (OQ-5) but does not block any recommendation in this
  artifact, since the chosen mechanism (optional class/interface members) is
  safe under TypeScript structural typing regardless of the answer.
- No `.claude/config/preset.yml`, `.claude/config/knowledge.json`,
  `.claude/config/canonical-labels.yml`, or
  `.claude/knowledge/patterns/`/`.claude/knowledge/decisions/` exist in this
  project — RAG retrieval, pattern-card grounding, and decision-card grounding
  all fell back to graceful defaults (ts-library-patterns skill content +
  project CLAUDE.md rules + in-file precedent), consistent with the same gaps
  observed during VD-007's analysis.
- `BUSINESS_RULES.yaml` was checked at the repo root and `packages/messaging/`
  directly (found absent at both) but could not be exhaustively searched
  repo-wide due to the tool-access issue above. Given this is a dependency-free
  infrastructure library (no domain aggregates of its own), it plausibly does
  not apply to this repo at all — not confirmed with full certainty.
