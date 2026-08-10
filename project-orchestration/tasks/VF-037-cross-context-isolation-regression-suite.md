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
estimated_time: 13h # was 8h; +5h for AC-GATES, added 2026-08-09
created_by: LIB-MATURITY-AUDIT-2026-08-08
created_at: 2026-08-09
status: backlog
updated_at: 2026-08-09 # amended after VF-036 shipped: AC-GATES added, checklist now exists
release_target: before first non-alpha tag
package: "'@vytches/ddd-nestjs', '@vytches/ddd-cqrs', '@vytches/ddd-events'"
findings:
  [
    audit "Larger #11" and "Larger #12",
    VB-003/F-C4,
    VF-030,
    VP-009,
    VF-036 (fourth instance + dead api-surface gate layer),
  ]
```

## Why

The same underlying bug class — cross-context CQRS/event isolation broken by DI
wiring — has now been "fixed" three times: ADR-0034's original design, VF-030
(DI token identity), then VP-009 (Symbol-token bridge, three bugs, one of which
shipped silently). Each fix added tests for its own PR; there is no standing
suite that asserts the isolation invariants as a whole on every PR.
`examples/nestjs/tests/wiring.test.ts` (the VP-009 guard) is the model — but it
covers one incident, not the invariant family.

Separately, all three incidents plus VF-036 share a shape our review process
does not catch: **behavioral breaking change with no signature change**. The
signature-diff-based BC assessment (api-extractor, api-surface snapshots) is
structurally blind to it.

### Amendment 2026-08-09 — measured during VF-036, do not re-derive

VF-036 shipped (`c88e728e`). To be precise about which of this task's two
threads it belongs to: it is **not** a cross-context isolation incident — the
"fixed three times" count in the paragraph above is still correct. It is the
fourth instance of the **second** thread, behavioral change under an unchanged
signature, after F-C4, VP-009 #3 and VF-023.

Wiring its api-extractor gate surfaced facts that make this task **larger and
more urgent than written**: the signature-diff layer is not merely blind to
semantics, it is **not running at all**. Each of these was verified by command,
not inferred:

- **`pnpm validate:api` is red, and has been for some time.** The chain is
  events → contracts → enterprise → value-objects; the **enterprise** step
  aborts with an api-extractor internal error at
  `packages/aggregates/src/core/aggregate-root.builder.ts:167:16` (the
  destructuring pattern in `for (const { capability, configure } of …)`), so
  nothing after it ever runs. A reader of the failure will misattribute it to
  whichever config they assume was executing.
- **CI never invokes `validate:api`.** `.github/workflows/ci.yml` runs
  api-extractor inline for contracts (`:157`, `|| true`), events (`:158`,
  `|| true`) and enterprise (`:170`, blocking). Two of the three cannot fail the
  build. There is no value-objects step at all. The npm script and the CI steps
  are different things, and only the latter gates anything.
- **Every config uses `--local`, which overwrites the committed `api-report`
  baseline instead of diffing against it.** The tool therefore cannot detect a
  regression even when it does run — it records the new state as the baseline.
  Running it also dirties unrelated packages, which reads as scope contamination
  at review time.
- **Baselines are stale since 2026-04-16 (`588c5eb7`).** Regenerating
  `contracts` produced a 1988-line diff (1106 → 882 lines) — real, unreviewed
  public-surface drift in a package nobody was watching.
- **`api-surface.test.ts` exists in 19 packages but snapshots
  `Object.keys(api).sort()`** — the named-export list only. Blind to a new or
  changed `protected` member by construction, which is exactly the VF-036 shape.

Consequence for scope: **AC-GATES** below is new. Fixing the isolation suite
while the surface-diff layer stays dead would leave the review process leaning
on a gate that reports success without having run.

## Acceptance Criteria

1. [ ] A dedicated regression suite (living in `packages/nestjs/tests/` or a
       cross-package e2e location — decide at implementation) asserting, on a
       real `Test.createTestingModule` boot:
   - commands/queries dispatched in context A never reach handlers registered in
     context B (F-C4 invariant);
   - `forRoot()` + N×`forFeature()` produce distinct, correctly-bridged bus
     token identities (VF-030/VP-009 invariants, both Symbol and string token
     paths);
   - explorer registration is alive end-to-end (dispatch → handler → query-back,
     generalizing wiring.test.ts);
   - domain events published in context A are not observed by context B
     subscribers unless explicitly bridged via ACL/integration path.
2. [ ] Suite runs in the default `nx test` target for its package (i.e. every
       PR), not as a separate opt-in target.
3. [ ] Each historical incident (F-C4, VF-030, VP-009 Bug #1-#3) is traceable to
       at least one named test case (comment with the incident ID — follow
       wiring.test.ts's incident-story convention).
4. [ ] **AC-CHECKLIST — wire up the checklist that now exists; do not write a
       new one.** `docs/process/behavioral-bc-checklist.md` was created by
       VF-036 (`c88e728e`) and currently has exactly one consumer, VF-036
       itself. Reference it from `project-orchestration/release-process.md` and
       from the PR/review flow. Core question: "does this change runtime
       behavior under an unchanged type signature?" **Calibrate on four cases,
       and note that they do not all resolve the same way** — the earlier
       wording implied every hit means `BREAKING CHANGE:`, which is wrong and
       would have produced an incorrect release classification for VF-036:
   - F-C4 (VB-003) — behavioral break, correctly `BREAKING CHANGE:`.
   - VP-009 Bug #3 — behavioral break that shipped silently. The one to study.
   - VF-023 validate-throws — behavioral break, announced.
   - **VF-036 — the counter-example.** Same shape, but the design was
     deliberately reshaped so the no-override path stays bit-for-bit identical,
     making it a genuine additive minor with **no** `BREAKING CHANGE:` entry.
     The checklist's job is to force the question and make the answer explicit,
     not to force a breaking classification.
5. [ ] **AC-GATES (new, 2026-08-09) — make the surface-diff layer actually
       run.** See the amendment under "Why" for the measured state. Minimum: (a)
       fix or work around the api-extractor internal error on
       `packages/aggregates/src/core/aggregate-root.builder.ts:167` that aborts
       the chain — try an api-extractor version bump before rewriting the loop;
       (b) invoke the gate from CI, covering every package that has a config,
       and remove the `|| true` from the steps meant to be blocking; (c) run it
       in **comparison** mode in CI, not `--local`, so a drift fails the build
       instead of silently rewriting the baseline; (d) regenerate and review the
       four-month-stale baselines as a separate, reviewed commit — the
       `contracts` drift needs eyes, not a rubber stamp. State plainly in the
       outcome that a clean api-surface diff still is not evidence of behavioral
       safety; it is a shape diff. This AC buys back the gate that should have
       existed, it does not solve the defect class.
6. [ ] Suite green on current develop; deliberately breaking any one of the
       invariants locally (mutation check) makes at least one test fail.

## Non-goals

- New isolation features or ACL redesign (SA-H4/M10/L4 collision semantics
  remain a separate deferred `/analyze-ddd` decision).
- Retroactive re-fixing — current code is believed correct (941/941 sampled
  tests green); this task prevents the fourth regression.

## Process note carried over from VF-036

Cite acceptance criteria by **stable identifier**, never by ordinal. VF-036's
criteria were renumbered in a rewrite while its analysis artifact and threat
model kept citing positions, so "AC5 — the consumer sign-off that blocks the npm
tag" silently came to point at a documentation item. Anyone ticking it would
have tagged a release with no sign-off recorded. That is why the criteria above
are gaining `AC-CHECKLIST` / `AC-GATES` names.

A second lesson worth applying before this task's panel runs: **confirm
`Bash`/`Grep`/`Glob` are available first.** They were denied throughout VF-036's
analysis, which degraded silently into a document that looked verified and was
not — three factual claims about this repo turned out to be wrong, one of them
inside a table headed "trust these". For a task whose entire subject is "check
what the gates actually do", an analysis without search tools is worthless.

## Links & References

- `docs/process/behavioral-bc-checklist.md` — created by VF-036; this task wires
  it into the release process (AC-CHECKLIST).
- `project-orchestration/tasks/VF-036-value-object-equality-components.md` —
  fourth incident of the class; its "Follow-ups spawned" section holds the
  api-extractor and baseline-drift findings that AC-GATES absorbs.
- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  ("Larger" items 11-12).
- `docs/adr/0034-per-context-cqrs-bus-isolation.md` (invariant definitions).
- `examples/nestjs/tests/wiring.test.ts` (pattern to generalize).
- Completed: VB-003, VF-030, VP-009 fixes (incident sources).
