---
task: VF-026-ddd-lint-anti-pattern-rules
status: approved
threat_model: null
rag:
  'skipped (.claude/config/knowledge.json not found — no knowledge-retriever MCP
  configured for this project; .claude/knowledge/patterns/ and
  .claude/knowledge/decisions/ also do not exist in this repo — confirmed via a
  narrow Explore pass, not assumed. Fell back to direct code reading:
  tools/ddd-lint/src/rules/*.ts, tools/ddd-lint/README.md,
  packages/nestjs/src/feature/feature-handler-registrar.ts,
  packages/nestjs/src/services/bus-registration-ledger.ts, git reflog for the
  VB-003 commit identity.'
patterns: []
open_questions:
  - id: OQ-1
    question:
      "AC1 (ddd-004 'fanout-in-handler'): research into the actual VB-003 commit
      (ddbedb6c1) found the literal phrase does NOT map cleanly onto a single
      generalizable AST-lintable pattern. VB-003 actually did two distinct
      things: (B) removed a dead, non-functional parallel implementation
      (auto-discovery.service.ts — discover() hardcoded to return [],
      duplicating VytchesExplorerService's real responsibility), and (A)
      replaced per-call-site inline dedup logic with delegation to a new
      BusRegistrationLedger service in feature-handler-registrar.ts. Neither is
      a simple, single-file syntactic check like ddd-001..003. Which direction
      do you want for AC1: (a) Descope entirely — drop the 'fanout-in-handler'
      rule from VF-026's scope, document VB-003's actual lesson (avoid
      dead/competing parallel implementations) as LLMGUIDE prose only, and spin
      up a SEPARATE follow-up task recommending knip/ts-prune in CI for
      dead-code detection (a different tool, not ddd-lint's AST-rule mechanism).
      (b) Implement the narrower, concretely-lintable rule architecture-guardian
      proposed: flag a class/method that directly calls 2+ distinct
      `register*`/`subscribe*`-shaped methods across branches or inside a loop
      without a preceding call to an allow-listed delegate (name matching
      /Ledger$|Registry$|Authority$/) — but accept this is NOT monorepo-wide
      like ddd-001..003; it only makes sense in packages/nestjs (or wherever
      'bus registration' is a concept). Needs a naming/scoping convention
      decision (see OQ-2). (c) Reframe 'fanout-in-handler' around a different,
      actually generalizable DDD concern decoupled from VB-003 (e.g. 'aggregate
      method calls >1 external service directly instead of via a domain
      event/policy') — architecture-guardian's alternate suggestion.
      Recommendation from the panel: (a), with the alternate rule from (b)
      considered as a separate, package-scoped tooling task if you still want
      static enforcement of the bus-registration discipline specifically."
    answer:
      "Approved: (a) descope. ddd-004 'fanout-in-handler' is dropped from VF-026
      entirely — not implemented as a ddd-lint AST rule. VB-003's actual lesson
      (avoid dead/competing parallel implementations) is documented as LLMGUIDE
      prose only (no enforced rule). A separate follow-up task recommending
      knip/ts-prune in CI for dead-code detection is spun up alongside this
      decision (see VF-034-dead-code-detection-ci.md) rather than folded into
      ddd-lint's AST-rule mechanism."
  - id: OQ-2
    question:
      "Only relevant if OQ-1 is answered (b) or a package-scoped variant of (c):
      tools/ddd-lint's ddd-NNN numbering is implicitly monorepo-wide today
      (every existing rule applies to any file under packages/ that matches its
      folder heuristic). A package-scoped rule (active only in packages/nestjs)
      doesn't fit that convention as-is. What's the naming/scoping mechanism — a
      new `scope: packageName` field on LintRule (extending the type in
      tools/ddd-lint/src/types.ts, runner.ts filtering rules by scope before
      running them against a file's package), a separate rule-id namespace (e.g.
      `nestjs-001` instead of `ddd-00N`), or something else? This is a small
      tool-architecture decision, not a design question about the anti-pattern
      itself."
    answer:
      "Moot — OQ-1 was answered (a) descope, not (b). No package-scoped rule is
      being implemented, so ddd-lint's numbering/scoping convention does not
      need to change as part of this task."
decisions:
  - id: D-1
    decision:
      "AC2 (ddd-005 'deep-import-instead-of-barrel'): APPROVED design, ready to
      implement without further discussion (library-api-guardian, high
      confidence — contrast with AC1/OQ-1's genuine ambiguity)."
    rationale:
      "Detection: flag any import/export whose module specifier is
      `@vytches/ddd-<pkg>/<subpath>` (verified: every packages/*/package.json
      declares only `exports['.']` today, so ANY subpath is by definition not
      the public entry — no /src/ vs /dist/ special-casing needed) OR a relative
      import whose resolved path crosses from the current file's package segment
      (under packages/<name>/) into a different package's segment. Scope:
      cross-package only — same-package relative imports (the normal, universal
      internal-composition pattern every existing rule already relies on) must
      never be flagged. Exclusions: *.test.ts/ *.spec.ts files (mirrors
      no-throw-in-domain's existing test exclusion — integration-test
      scaffolding legitimately reaches into internals sometimes). Type-only
      imports ARE still flagged (barrel discipline applies to types too).
      Severity: error (CLAUDE.md 'Public API Surface' + 'Package Boundaries' are
      both Critical Rules, same tier as ddd-002/ddd-003). Fix message: 'Import
      from the package's public barrel (@vytches/ddd-<pkg>) instead of its
      internal path. If the symbol isn't exported from index.ts, that's a signal
      it shouldn't be a cross-package dependency — export it deliberately or
      reconsider the boundary.' Known forward-compat gap (non-blocking, document
      in the rule's doc comment): if VF-024 later introduces real subpath
      exports (e.g. `@vytches/ddd-contracts/internal`), the hardcoded 'any
      subpath is a violation' regex will need to become an allowlist keyed off
      each package's own declared `exports` map — not needed today, zero
      packages currently declare subpath exports."
  - id: D-2
    decision: 'Security threat-model: NOT required for this task.'
    rationale:
      "VF-026 (both the already-shipped isDomainFile fix/CI-wiring and the
      remaining ddd-004/ddd-005 rule work) is a static-analysis dev-tool change
      — no runtime auth, PII, cross-context data flow, or public API behavior is
      touched. No canonical-labels.yml exists in this repo to mechanically check
      against; assessed directly from task content per the skill's
      graceful-fallback instruction."
---

# VF-026 — ddd-lint AC1/AC2 (new rules) — Research & Analysis

## Scope of this analysis

AC0 (broken `isDomainFile()` path-matching scanner) and AC6 (wire `ddd:lint`
into CI as informational) were **already implemented and merged to `develop`**
in a prior session pass (commit `a5ac3e9e`, merged `73121897`) — full triage of
the 60 real `ddd-002` findings it surfaced is recorded in the task file itself
(`project-orchestration/tasks/VF-026-ddd-lint-anti-pattern-rules.md`, "Activity
/ Notes" section), not repeated here. **This analysis covers only the remaining
AC1/AC2 (new rules `ddd-004`/`ddd-005`)**, which the task file explicitly
deferred pending `/analyze-ddd` — that command is this artifact.

## Why this needed a panel (not just "write the two rules")

The task's own text for AC1 already flagged uncertainty ("exact shape of 'bad'
vs. 'good' code to be nailed down with the PR author during /analyze-ddd"). Two
narrow research passes into git history confirmed that uncertainty was
well-founded, not just process caution:

- **VB-003 commit identity**: `ddbedb6c1` (reflog-recovered; `git log --grep`
  wasn't usable in this analysis's restricted tool context — a human with Bash
  can confirm via
  `git show ddbedb6c1 -- packages/nestjs/src/discovery/auto-discovery.service.ts packages/nestjs/src/feature/feature-handler-registrar.ts`).
- **What VB-003 actually fixed** doesn't reduce to one lint-rule shape — see
  OQ-1 for the full breakdown. This is exactly the kind of thing `/analyze-ddd`
  exists to surface before code gets written against a premise that doesn't hold
  up.

AC2, by contrast, turned out to have **zero ambiguity** once a library-boundary
specialist looked at it directly against this repo's actual
`package.json exports` maps — see D-1. It's approved as a decision, not left as
an open question.

## Panel summary (condensed — full leaf outputs available via session

transcript, not duplicated here per the skill's anti-quadratic-context guidance)

- **architecture-guardian** (AC1 focus): read the actual post-VB-003 code
  (`feature-handler-registrar.ts`, `bus-registration-ledger.ts`). Confirmed
  neither of VB-003's two real fixes (dead-parallel-implementation removal;
  inline-dedup→delegated-ledger refactor) is a clean single-file AST pattern
  like ddd-001..003. Proposed a third, narrower, genuinely-lintable candidate
  (register\*-calls-without-delegate-to-Ledger/Registry) but flagged it as
  inherently package-scoped, not monorepo-wide — recommends descoping AC1 from
  this task's `ddd-004` framing.
- **library-api-guardian** (AC2 focus): verified via direct read of every
  `packages/*/package.json` that none declare subpath `exports` today, making
  "any subpath after the bare specifier" an unambiguous violation signal.
  Delivered a complete, ready-to-implement rule design (detection logic,
  exclusions, severity, fix message) — see D-1. Explicitly contrasted its own
  high confidence against ddd-004's acknowledged ambiguity.
- **Synthesis**: performed directly by the orchestrating agent rather than a
  third leaf call. Procedural note (per the skill's documented fallback
  allowance): the two leaf outputs were independent, non-conflicting, and
  already complete on their respective questions — a dedicated synthesis agent
  would have mostly restated them rather than adding new analysis, and session
  cost was already elevated. Nothing here needed reconciling between the two
  leaves; this isn't a case of picking a synthesis over an ignored disagreement.

## Recommendation

1. Answer OQ-1 (and OQ-2 if applicable) — the panel's own lean is toward **(a)
   descope AC1** from a generic `ddd-004`, since forcing VB-003's actual lesson
   into one monorepo-wide AST rule would either miss the real issue (dead
   parallel implementations — needs `knip`/`ts-prune`, a different tool) or
   produce a rule that only ever fires in one package.
2. **D-1 (ddd-005) can be implemented as soon as this artifact is approved** —
   it does not depend on how OQ-1 is resolved. If you want to unblock AC2
   without waiting on the AC1 discussion, that's a reasonable split (note it
   explicitly when you flip `status: approved`, e.g. "AC2 approved, AC1 deferred
   to a follow-up task").
3. Whatever AC1 resolves to, update the task file's AC1 wording to match before
   implementation — the current wording (fanout-in-handler, exact definition
   TBD) is now stale relative to what this analysis found.
