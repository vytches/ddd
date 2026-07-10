# Task: ddd-lint — two new rules from VB-003 lessons

## Task Metadata

```yaml
task_id: VF-026
title:
  Enforceable anti-pattern rule ddd-005 (deep-import instead of public barrel) +
  fix broken isDomainFile() gate (ddd-002 is a no-op) — ddd-004
  fanout-in-handler DESCOPED (see analysis)
type: feature
priority: high
complexity: simple
estimated_time: 5h
created_by: human (feedback 2026-07-03)
created_at: 2026-07-03
updated_at: 2026-07-10
status: in_progress
release_target: unscheduled
package: tools/ddd-lint
findings: [lessons from VB-003-nestjs-forfeature-di-wiring, SA-M1]
```

## Why

The original feedback proposed "anti_pattern per feature" on the assumption that
the repo already has a general `kind` taxonomy that supports it. **That
assumption did not hold up** — the only `kind` union in the repo is
`AIToolPermission` (`PUBLIC_NO_AUTH` | `REQUIRED`) in the VA-001 project, which
is about AI-tool permissions and unrelated to code anti-patterns. It doesn't
need to be invented from scratch, though: `tools/ddd-lint` already has a model
that fits — `ruleId` + `severity`, AST-based rules (`ddd-001`
no-mutable-state-in-aggregate, `ddd-002` no-throw-in-domain, `ddd-003`
factory-must-return-result). This task extends that existing, enforceable
mechanism — it is not a new system.

Two concrete lessons from the current VB-003 work (nestjs-forfeature-di-wiring),
fresh and confirmed in a real PR:

1. **Fanout in the handler** — the removal of `auto-discovery.service.ts` and
   the changes in `feature-handler-registrar.ts` on this branch point at a
   pattern to avoid (exact shape of "bad" vs. "good" code to be nailed down with
   the PR author during /analyze-ddd).
2. **Deep-import instead of the public barrel** — importing from a package's
   internal path instead of its entry point (`index.ts`/barrel), violating the
   "Explicit barrel exports" rule in `CLAUDE.md` (Public API Surface).

**Priority bumped normal → high (2026-07-09, SA-M1 from SEC-AUDIT-2026-07-09):**
the `ddd-002 no-throw-in-domain` gate has ALWAYS been a no-op in the repo's
actual wiring. `isDomainFile()`
(`tools/ddd-lint/src/rules/no-throw-in-domain.ts:70-87`) matches
`normalized.includes('/aggregates/')` etc. — requiring a **leading slash** — but
`npm run ddd:lint` scans with root `packages`, so relative paths look like
`aggregates/src/...` and never match. Verified: 0 `ddd-002` findings via the
wired script vs 100+ when scanned from the repo root. This explains why so many
throw sites exist in nominally "domain" folders despite the CLAUDE.md rule
("Domain layer is PURE: no thrown exceptions"). Most surfaced sites are
legitimate dual-API factories (`fromX` throws / `tryFromX` returns `Result`),
but only 2 files in the whole repo carry a
`// ddd-lint-disable no-throw-in-domain` suppression comment — the rest have
neither a confirmed Result twin nor a documented exception. Shipping two new
rules (AC1-2) on top of a silently broken path filter would compound the
existing blind spot, so the fix belongs in this task.

## Acceptance Criteria

0. [x] **SA-M1 (do this FIRST):** `isDomainFile()` matches path **segments**
       (e.g. split on `/` and compare segments, or anchor with a leading-`(^|/)`
       regex) instead of raw `includes('/…/')`; regression tests cover both
       invocation shapes (`ddd-lint packages` from repo root and absolute
       paths). Then re-run `ddd-002` over `packages/` and triage the surfaced
       violations: suppression comment (with a one-line reason) for intentional
       dual-API throw factories, follow-up fix list for the rest — no violation
       left unclassified.
1. [x] ~~ddd-lint rule: `ddd-004` — fanout in a handler~~ — **DESCOPED**
       2026-07-10 per `/analyze-ddd` (see
       `project-orchestration/analysis/VF-026-ddd-lint-anti-pattern-rules.analysis.md`,
       OQ-1 answered (a)). Research into the actual VB-003 commit found the
       phrase doesn't map to one generalizable AST rule (it conflated a
       dead-parallel-implementation removal with an
       inline-dedup→delegated-ledger refactor). Not implemented as a ddd-lint
       rule. VB-003's real lesson is captured as LLMGUIDE prose only (AC5
       below); dead-code detection is a separate follow-up (VF-034).
2. [ ] ddd-lint rule: `ddd-005` — detects a deep import from a package's
       internal path instead of its public barrel. Design approved in the
       analysis artifact (D-1): flag any `@vytches/ddd-<pkg>/<subpath>` import
       (every package today only declares `exports['.']`, so any subpath is
       unambiguously a violation) or a relative import crossing a
       `packages/<name>/` boundary; scope cross-package only (same-package
       relative imports never flagged); exclude `*.test.ts`/`*.spec.ts`;
       type-only imports still flagged; severity `error`.
3. [ ] `ddd-005`: a positive test (catches the violation) + a negative test (no
       false positive on correct code — incl. same-package relative imports and
       test-file exclusion), following the pattern of the existing rules in
       `tools/ddd-lint/src/rules/`.
4. [ ] Entry in `tools/ddd-lint/README.md` with a "bad"/"good" example for
       `ddd-005`.
5. [ ] The Anti-Patterns section in the LLMGUIDE.md of affected packages (at
       least `@vytches/ddd-nestjs`) updated with: (a) a link to `ddd-005` as the
       enforceable counterpart of the "explicit barrel exports" prose rule, and
       (b) since AC1 is descoped, a PROSE-ONLY note (no rule) describing
       VB-003's actual lesson — avoid dead/competing parallel implementations of
       a responsibility another class already owns (the
       `auto-discovery.service.ts` story).
6. [x] Wire `ddd:lint` into CI, at minimum as **informational** (e.g.
       `pnpm ddd:lint || true`), per the tool's own README-stated rollout plan
       (Informational → Blocking-soon → Blocking). Confirmed 2026-07-04:
       `ddd:lint` is wired into **neither** `.github/workflows/ci.yml` (the only
       lint step there is ESLint via `nx affected --target=lint`) **nor**
       `.husky/pre-commit` today — it only runs when someone remembers to invoke
       it manually. Adding `ddd-004`/`ddd-005` to a linter nobody actually runs
       compounds this gap rather than fixing it; this task should not ship two
       more rules into that same blind spot. (Dogfooding confirmed 2026-07-04: a
       live run against `packages/` already finds real findings — 3 errors, 48
       warnings across 35 files — so the mechanism itself works, it's the
       enforcement wiring that's missing.)

## Out of scope

- A general `kind` taxonomy / schema redesign for anti-patterns — it doesn't
  exist and isn't needed here; the existing `ruleId`+`severity` model in
  ddd-lint is sufficient.
- Systematically adding an Anti-Patterns section to all 19 LLMGUIDE.md files — a
  separate task, if deemed worthwhile after this pilot.

## Activity / Notes

### 2026-07-10 — AC0 + AC6 done on `feature/VF-026-ddd-lint-fix-and-rules`; AC1-5 remain open

**AC0 (isDomainFile fix):** `isDomainFile()` now splits the normalized path into
segments and checks exact segment membership in
`{domain, aggregates, value-objects, specifications, policies}` instead of
`includes('/name/')` substring matching. Added a regression test proving the
exact bug shape (domain folder as the FIRST path segment, no leading slash —
what `runLint({ root: 'packages' })` actually produces) plus a false-positive
guard test (`my-aggregates-helper` no longer matches). Full tool suite: 33/33
passing; `tsc --noEmit` clean.

**Full re-scan + triage (delegated to a research agent, all 60 pre-existing
findings classified, none skipped):**

- **Suppressed (confirmed dual-API, same pattern as
  `contracts/entity-id.implementation.ts`):**
  `aggregates/src/core/aggregate-utilities.ts` (4 throws — asX/tryAsX pairs) and
  `value-objects/src/id.value-object.ts` (12 of 13 throws — fromX/tryFromX pairs
  on `EntityId` + deprecated `EntityIdFactory`; the 13th is a genuinely
  exhaustive `IdType` switch). Both got the same
  `// ddd-lint-disable no-throw-in-domain` header with reasoning. Verified:
  `pnpm ddd:lint` error count dropped 63 → 46 (exactly the 17 suppressed
  throws); aggregates test 191/191, value-objects test 90/90 unaffected.

- **Follow-up fix list — 43 real findings across 14 files, NOT fixed here** (out
  of scope for a lint-tool task; each needs its own review/PR): builder
  `.build()`/`validateBuilder()` validation that throws instead of returning
  `Result` (`policy-builder.ts`, `policy-definition.ts`, `temporal-policy.ts`,
  `policy-context-builder.ts`, `policy-request-builder.ts`, `policy-registry.ts`
  — the latter's `validateDefinition()` alone is 8 findings); capability methods
  with no Result alternative (`event-sourcing-capability.ts`,
  `snapshot-capability.ts`); `base-business-policy.ts`'s 4 "not yet implemented"
  placeholder throws (already tracked as VT-006 F-M10 — confirmed match, not
  duplicated); `event-driven-policy.ts:184` re-throwing instead of honoring its
  own declared `Promise<Result<T, PolicyViolation>>` return type;
  `policy-event-bus.ts:106` (`subscribe()` cap exceeded, no Result twin);
  `policy-registry.ts:24` (`register()` duplicate ID, no `tryRegister`). Full
  file:line list preserved in the triage agent's report (not duplicated here —
  see git history of this task file / session transcript if needed verbatim;
  summarized above by file).

- **Two newly-discovered real production bugs, escalate separately (not part of
  this task's scope, flagging so they aren't lost):** `policy-builder.ts:538`
  (`BuiltCompositePolicy.createPolicyFromStep`) and `policy-group.ts:330`
  (`GroupCompositePolicy.createPolicyFromStep`) each handle only 2 of a wider
  step-type union in their composite/multi-step evaluation path. Real public
  builder methods (`shouldSatisfyAny()`, `.mustAsync()`, `.mustSatisfyAsync()`,
  `.mustSatisfyRules()`) construct step types that these `switch` statements
  don't handle — a composite policy mixing those in throws at `check()` time
  instead of returning `Result.fail(...)`, silently breaking the method's own
  contract for real, reachable usage (not dead code). No existing test covers
  `shouldSatisfyAny()` at all. **Recommend a new P1 bug task** (candidate id:
  next free `VF-0XX` or fold into VT-006's policies-hardening scope) before
  publish, since this affects the public policies API's core evaluation path.

- **3 borderline/no-action items (C, judgment calls, listed for completeness):**
  `conditional-policy-builder.ts:177,249` (dead union members, unreachable via
  current public API — narrow the type or remove, low priority);
  `policy-event-bus.ts:273` (opt-in `errorStrategy: 'throw'` escape hatch —
  arguably fine as documented opt-in behavior, human sign-off recommended if
  ever revisited).

**AC6 (CI wiring):** added a `DDD compliance (informational)` step to
`.github/workflows/ci.yml` right after the existing ESLint step, running
`pnpm ddd:lint || true` — matches the tool's own README-documented Stage 1
rollout (Informational → Blocking-soon → Blocking). YAML validated
(`python3 -c "import yaml; yaml.safe_load(...)"`). `.husky/pre-commit` left
untouched (not required by AC6's "at minimum" wording).

**AC1-5 remain open (new `ddd-004`/`ddd-005` rules — fanout-in-handler,
deep-import-instead-of-barrel).** Not attempted: AC1 explicitly requires "the
exact definition confirmed during /analyze-ddd against the real VB-003 example"
— inventing that rule's precise shape unilaterally risks not matching what the
PR author/reviewer actually meant by the anti-pattern. Recommend running
`/analyze-ddd VF-026` (or a fresh follow-up task id) to nail down AC1/AC2's rule
definitions before implementing, now that AC0's higher-priority scanner fix and
AC6's CI wiring are shipped independently.

### 2026-07-10 — `/analyze-ddd VF-026` run, approved, AC1 descoped

Full panel analysis (architecture-guardian + library-api-guardian) confirmed
AC1's premise didn't hold up (see AC1's strikethrough note above) and produced a
ready-to-implement design for AC2/`ddd-005` (see AC2's note above). Artifact:
`project-orchestration/analysis/VF-026-ddd-lint-anti-pattern-rules.analysis.md`
(`status: approved`, OQ-1/OQ-2 answered). Follow-up task spun up per the descope
decision: `VF-034-dead-code-detection-ci.md` (knip/ts-prune in CI, independent
of ddd-lint). Remaining scope for this task is AC2-5, `ddd-005` only.

## References

- `tools/ddd-lint/src/rules/no-throw-in-domain.ts` and neighboring files — the
  rule pattern to follow (and, per SA-M1, the broken `isDomainFile()` to fix).
- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-M1).
- Diff on `feature/VB-003-nestjs-forfeature-di-wiring` — source of both examples
  (removal of `packages/nestjs/src/discovery/auto-discovery.service.ts`, changes
  in `feature-handler-registrar.ts`).
