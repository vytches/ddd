# Task: Measure, don't ask — make it structurally impossible for a layer to erase the previous layer's verified work

## Task Metadata

```yaml
task_id: VF-039b
title:
  'tooling: /orchestrate — monotonic-churn ledger across layers, injected into
  the verifier as a precomputed fact, plus the lint rule that catches revert
  commands in an implementer prompt'
type: chore
priority: high
complexity: medium
estimated_time: 4h
created_by: VF-039
created_at: 2026-08-19
status: blocked
blocked_by: 'open question Q1 in the analysis — where the churn ledger lives'
updated_at: 2026-08-19
release_target: n/a # tooling, not shipped in any package
package:
  'n/a — targets /opt/projects/claude-patterns and the per-task workflow scripts'
findings: [VF-037 implementation run wf_f24e8621-140]
analysis: project-orchestration/analysis/VF-039b-orchestration-churn-guard.analysis.md
```

> **Classification note.** Carried as `chore` to match repo convention for
> tooling, but this is a reliability change to the orchestration engine and
> should carry the review weight of one. The original VF-039 label
> `complexity: low` did not survive analysis.

## Why

VF-039a takes away the agents' permission to revert. This half removes their
ability to do it unnoticed, which is a different guarantee and the more durable
one.

The analysis found that the original AC-ALLOWLIST, taken literally, would not
hold:

- **A prompt instruction already lost this fight.** The verifier was told "judge
  only the files listed in the evidence map" and "use NO-GO only for defects
  inside the layer scope". It went looking at the whole working tree anyway,
  because its own check questions asked it to. Adding a third instruction to the
  same prompt enlarges the instruction set rather than removing the competing
  instruction.
- **A flat allowlist is wrong in both directions.** It grows every layer until
  it whitelists the whole tree and the guard becomes a no-op. Worse, in the
  incident itself layer `baselines` legitimately had `.github/workflows/ci.yml`
  in its own scope and was meant to edit it further — a frozen-file allowlist
  would have flagged correct work as a violation.
- **The measurement already exists.** `snapshot()` computes a per-path
  `git diff --numstat` churn map on haiku, and the verifier already consumes one
  precomputed deterministic fact successfully (the typecheck PASS/FAIL injected
  into its evidence). Monotonic churn distinguishes "this layer extended the
  previous layer's edit" from "this layer wiped it" with no model judgement:
  increases are legal, a drop is not.

Cost was not the deciding factor — the deterministic check and the prompt-only
option are the same order of magnitude per run, both far under 1% of what the
incident cost. The check wins because it converts a probabilistic mitigation
into a structural one at the same price.

## Blocking question

**Where does the churn ledger live?** Workflow scripts are hand-authored
one-offs (~50KB, copy-adapted, no generator, no shared runtime module). Either
the guard goes into this task's script and future scripts copy-adapt it like
everything else — cheap, but it protects only scripts written afterwards and
only if the author copies the right block — or it becomes the first shared
module that scripts import, which is the structural fix but starts a
runtime-module precedent this ecosystem has deliberately avoided. This must be
answered before work starts; it changes the shape of every acceptance criterion
below.

## Acceptance Criteria

1. [ ] **AC-CHURN-LEDGER — the run remembers what was already approved.** When a
       layer reaches GO, record `{path, churn}` for each of its paths from the
       existing numstat map. Before the next layer's verifier runs, re-snapshot
       the union of previously-approved paths and compare. A churn value that
       has DROPPED below its recorded figure calls the existing escalation path.
       Increases are legal and must not trigger anything — that is what keeps a
       legitimate continuation (the `ci.yml` case above) from being flagged.
2. [ ] **AC-VERIFIER-FACT — the verifier is given a verdict, not a puzzle.** The
       comparison result is injected into the verifier prompt as a precomputed
       PASS/FAIL fact, in the same block and the same shape as the existing
       typecheck result, together with the labelled list of paths written by
       earlier layers. The scope-confinement check question is re-phrased
       against "outside this layer's scope AND outside the previously-approved
       set". The verifier must not be asked to derive scope confinement by
       reasoning over a raw file list.
3. [ ] **AC-LINT-REVERT — the ban becomes mechanical.** Add a rule to
       `hooks/workflow-lint.js` flagging `git checkout`, `git restore`,
       `git reset` or `git stash` inside an implementer or fix prompt, at WARN,
       with the incident reference in the header comment per the WL1-WL10
       convention. Two constraints from analysis:
   - Scope it to implementer/fix prompts, not the whole file. A legitimate
     occurrence already exists in the mutation-check prompt.
   - It must not fire on the ban text itself. A correctly written prohibition
     has to name all four commands, so a bare string match flags the very edit
     that fixed the problem. Use a negation-window suppressor, and accept that
     it handles the phrasing written now and does not guarantee the next
     author's.
   - Ship at WARN. Do not promote to ERROR before the false-positive rate is
     measured against the existing corpus (VF-036, VF-037).
4. [ ] **AC-REGRESSION — the rule is exercised.** Add cases to
       `tests/flow-evals/workflow-lint/run.js` covering a prompt that uses the
       commands (fires), a prompt that bans them (does not fire), and the
       mutation-check shape (does not fire).
5. [ ] **AC-DEPLOY — the lint reaches the place the system reads from.** Re-copy
       `hooks/workflow-lint.js` to `~/.claude/hooks/workflow-lint.js` and verify
       byte-identity, recording the verification in the task evidence. Source
       and deployed copy were byte-identical as of 2026-08-13.

## Non-goals

- The prose-level revert ban, the incident note and the lint-invocation step.
  Those are VF-039a and may already be merged when this starts.
- The originally specified lint rule that would infer "the script tracks
  previous-layer files but never injects them". Analysis judged the heuristic
  unreliable in both directions with no shared runtime to anchor detection
  against, and a rule that misfires on first contact teaches operators to ignore
  the linter — which would degrade WL1-WL9, which currently work. Revisit only
  if the ledger becomes a shared module with a stable API to match on.
- Per-layer commits, isolated worktrees, or any change to the STOP2 contract.

## Known limits (carry these into review)

- Churn is a proxy, not a proof. A layer that replaces forty lines with twenty
  better ones is indistinguishable from a partial revert by numstat alone. The
  false-positive class cannot be sized yet; the corpus is two scripts.
- Whatever is built here protects the next run only if that run's author copies
  the right block. That is the blocking question above, and it is the largest
  weakness this task does not close on its own.

## Links & References

- `project-orchestration/analysis/VF-039b-orchestration-churn-guard.analysis.md`
  — decision record (D1, D5) and the blocking question.
- `project-orchestration/.workflow/VF-037.workflow.js` — `snapshot()` and the
  numstat churn map at lines 126-158; `runLayer(cfg, prevFilesLine)` at 407;
  `prevFilesLine` recomputed at 594 and passed only to the implementer; the
  verifier call site building evidence from this layer's files at 494-515.
- `/opt/projects/claude-patterns/hooks/workflow-lint.js` — WL1-WL10 and the
  header-comment convention; WL10 for the per-call-site detection shape.
- `/opt/projects/claude-patterns/tests/flow-evals/workflow-lint/run.js`.
- Run journal `wf_f24e8621-140` — entries 6, 17, 18.
- Sibling: `VF-039a-orchestration-revert-ban.md`.
