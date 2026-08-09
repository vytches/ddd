# Task: Standing cross-context isolation regression suite + behavioral-BC checklist

## Task Metadata

```yaml
task_id: VF-037
title:
  'nestjs/cqrs/events: permanent cross-context isolation regression suite
  (every PR, not per-fix) + behavioral-BC-without-signature-change checklist
  in the release process'
type: test
priority: high
complexity: medium
estimated_time: 8h
created_by: LIB-MATURITY-AUDIT-2026-08-08
created_at: 2026-08-09
status: backlog
release_target: before first non-alpha tag
package: "'@vytches/ddd-nestjs', '@vytches/ddd-cqrs', '@vytches/ddd-events'"
findings: [audit "Larger #11" and "Larger #12", VB-003/F-C4, VF-030, VP-009]
```

## Why

The same underlying bug class — cross-context CQRS/event isolation broken by
DI wiring — has now been "fixed" three times: ADR-0034's original design,
VF-030 (DI token identity), then VP-009 (Symbol-token bridge, three bugs, one
of which shipped silently). Each fix added tests for its own PR; there is no
standing suite that asserts the isolation invariants as a whole on every PR.
`examples/nestjs/tests/wiring.test.ts` (the VP-009 guard) is the model — but
it covers one incident, not the invariant family.

Separately, all three incidents plus VF-036 share a shape our review process
does not catch: **behavioral breaking change with no signature change**. The
signature-diff-based BC assessment (api-extractor, api-surface snapshots)
is structurally blind to it.

## Acceptance Criteria

1. [ ] A dedicated regression suite (living in `packages/nestjs/tests/` or a
       cross-package e2e location — decide at implementation) asserting, on a
       real `Test.createTestingModule` boot:
       - commands/queries dispatched in context A never reach handlers
         registered in context B (F-C4 invariant);
       - `forRoot()` + N×`forFeature()` produce distinct, correctly-bridged
         bus token identities (VF-030/VP-009 invariants, both Symbol and
         string token paths);
       - explorer registration is alive end-to-end (dispatch → handler →
         query-back, generalizing wiring.test.ts);
       - domain events published in context A are not observed by context B
         subscribers unless explicitly bridged via ACL/integration path.
2. [ ] Suite runs in the default `nx test` target for its package (i.e. every
       PR), not as a separate opt-in target.
3. [ ] Each historical incident (F-C4, VF-030, VP-009 Bug #1-#3) is traceable
       to at least one named test case (comment with the incident ID —
       follow wiring.test.ts's incident-story convention).
4. [ ] Behavioral-BC checklist added to
       `project-orchestration/release-process.md` (and referenced from the
       PR/review flow): "does this change runtime behavior under an unchanged
       type signature? If yes → `BREAKING CHANGE:` commit + CHANGELOG entry +
       migration note, never plain `fix:`/`feat:`" — with the four historical
       examples (F-C4, VP-009 #3, VF-023 validate-throws, VF-036) listed as
       calibration cases.
5. [ ] Suite green on current develop; deliberately breaking any one of the
       invariants locally (mutation check) makes at least one test fail.

## Non-goals

- New isolation features or ACL redesign (SA-H4/M10/L4 collision semantics
  remain a separate deferred `/analyze-ddd` decision).
- Retroactive re-fixing — current code is believed correct (941/941 sampled
  tests green); this task prevents the fourth regression.

## Links & References

- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  ("Larger" items 11-12).
- `docs/adr/0034-per-context-cqrs-bus-isolation.md` (invariant definitions).
- `examples/nestjs/tests/wiring.test.ts` (pattern to generalize).
- Completed: VB-003, VF-030, VP-009 fixes (incident sources).
