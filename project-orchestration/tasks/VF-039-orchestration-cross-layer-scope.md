# Task: Stop layer verifiers from reverting the previous layer's verified work

## Task Metadata

```yaml
task_id: VF-039
title:
  'tooling: /orchestrate-ddd — give each layer verifier an explicit
  previous-layers allowlist, and forbid fix agents from reverting files'
type: chore
priority: high
complexity: low
estimated_time: 2h
created_by: VF-037
created_at: 2026-08-12
status: split
split_into: [VF-039a, VF-039b]
updated_at: 2026-08-19
release_target: n/a # tooling, not shipped in any package
package:
  'n/a — target is the shared /orchestrate-ddd command template, outside this
  repo'
findings: [VF-037 implementation run wf_f24e8621-140]
```

> **SPLIT 2026-08-19 — nie implementuj tego pliku.** Analysis (panel 2026-08-13)
> re-estimated the work at 5-6h and found four facts the criteria below did not
> account for: the revert ban already exists but is worded as a licence for
> single-file checkout; `/orchestrate-ddd` names no file; nothing invokes the
> workflow lint, so WL1-WL10 protect nothing; and the command doc and lint are
> deployed as byte copies, not symlinks, so editing the source alone changes no
> runtime behaviour. The work now lives in two tasks:
>
> - **`VF-039a-orchestration-revert-ban.md`** (~2h, no blocking questions) —
>   absolute revert ban, the incident note in the real command doc, the
>   lint-invocation step, and the deploy. Priority.
> - **`VF-039b-orchestration-churn-guard.md`** (~4h, blocked) — the
>   deterministic monotonic-churn ledger injected into the verifier as a
>   precomputed fact, plus the lint rule for revert commands. Gated on where the
>   ledger lives.
>
> The criteria below are kept verbatim as the historical record of what was
> asked. AC-ALLOWLIST in particular did NOT survive analysis in this form: a
> flat previous-layers list degrades into a no-op as it grows, and would have
> flagged layer `baselines` legitimately re-editing `ci.yml` as a violation.

## Why

VF-037's implementation run lost a whole verified layer to a structural flaw in
the orchestration template, not to any agent behaving badly. Sequence, measured
from the run journal:

1. Layer `gates` implemented AC-GATES (a)(b)(c) across `package.json` and
   `.github/workflows/ci.yml`. Its verifier returned **GO** with a detailed,
   accurate account of the change.
2. Layer `baselines` ran next. Its scope was the four `api-report/` directories
   plus `ci.yml`, and its check questions included "is the change confined to
   the in-scope paths, with no stray modifications?" — the standard
   scope-contamination guard.
3. That verifier looked at the working tree, saw the `gates` layer's
   `package.json` and `ci.yml` changes sitting in the diff, and — correctly,
   from the only information it had — reported them as **out-of-scope
   contamination**. Verdict: NO-GO, two violations.
4. The fix agent resolved both violations the most direct way available: it ran
   `git checkout --` on both files and re-applied only the narrow edit its own
   layer had been asked for. AC-GATES was gone, silently, and the layer then
   passed on attempt 2.
5. The final gate caught it and returned NO-GO — the safety net worked — but
   four layers and ~1.4M subagent tokens had already been spent, and the
   recovery was manual.

Neither agent was wrong given what it was told. The template is what is missing
two things.

## Acceptance Criteria

1. [ ] **AC-ALLOWLIST — the verifier must know what it is looking at.** Every
       layer verifier prompt for layer N must carry an explicit list of the
       files written by layers 1..N-1, labelled as _already verified GO — these
       are not scope contamination_. The scope-confinement check question must
       be phrased against "paths outside both this layer's scope **and** the
       previous-layers allowlist". The orchestrator already tracks this list (it
       injects it into implementer prompts as the anti-exploration block); it
       simply never reaches the verifier.
2. [ ] **AC-NO-REVERT — reverting must not be an available move.** Fix-agent and
       implementer prompts must state that `git checkout`, `git restore`,
       `git stash` and `git reset` are forbidden on any path, without exception.
       If an agent believes a file is out of scope, it reports that in its final
       message; it never undoes it. Reverting is the only way verified work can
       disappear leaving no trace in the diff the human reviews at STOP2.
3. [ ] **AC-LINT — make it mechanical, like WL1-WL10.** Add the checks to
       `hooks/workflow-lint.js` so the next script cannot regress:
   - a rule that flags a verifier prompt built from a layer's scope or check
     questions when the script tracks previous-layer files but does not inject
     them (companion to WL10's canonical-builder shape);
   - a rule that flags the strings `git checkout`, `git restore`, `git reset` or
     `git stash` appearing anywhere in an implementer or fix prompt. Each rule
     carries its incident reference in the header comment, per the existing
     convention.
4. [ ] **AC-DOC — record the incident in the template itself.** Add it to the
       rules-as-prose section of the `/orchestrate-ddd` command doc, alongside
       the existing incident notes, so it survives into projects that copy the
       template rather than living only in this task file.

## Non-goals

- Redesigning the layer model or the STOP2 contract. The gate structure worked;
  the final gate caught the regression exactly as designed.
- Making verifiers lenient about genuine scope violations. The point is to give
  them the information needed to tell the two cases apart, not to stop them
  checking.

## Links & References

- `project-orchestration/.workflow/VF-037.workflow.js` — the script this
  happened to; its `runLayer()` already computes the previous-layer file list.
- Run journal `wf_f24e8621-140` — entries 6 (gates manifest), 17 (the NO-GO), 18
  (the revert).
- `hooks/workflow-lint.js` — WL1-WL10 header comments, the pattern to follow.
