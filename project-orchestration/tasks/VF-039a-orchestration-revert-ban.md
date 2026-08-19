# Task: Take away the orchestration agents' ability to revert, and make the workflow lint actually run

## Task Metadata

```yaml
task_id: VF-039a
title:
  'tooling: /orchestrate — absolute revert ban in the shared hard rules,
  incident note in the real command doc, and a lint-invocation step at the one
  point a hand-authored workflow script is handed to the runner'
type: chore
priority: high
complexity: low
estimated_time: 2h
created_by: VF-039
created_at: 2026-08-19
status: backlog
updated_at: 2026-08-19
release_target: n/a # tooling, not shipped in any package
package: 'n/a — target is /opt/projects/claude-patterns, outside this repo'
findings: [VF-037 implementation run wf_f24e8621-140]
analysis: project-orchestration/analysis/VF-039a-orchestration-revert-ban.analysis.md
```

## Why

VF-039 was split after analysis. This half carries the four changes that have no
unanswered questions in front of them, so it can ship without waiting.

The incident is unchanged from VF-039: layer `baselines` reported the previous
layer's verified work as scope contamination, and the fix agent resolved the
violation by running `git checkout --` on the two files. A verified acceptance
criterion disappeared with no trace in the diff a human would later review.

Analysis established four things the original task did not account for:

1. **The revert ban already exists and is worded as a licence.** The workflow
   script says
   `NEVER run "git checkout ." or "git restore ." or any command that touches paths other than the single file you mutated`.
   That sentence explicitly permits `git checkout <one-file>`, which is exactly
   the move that caused the incident. This has to be replaced, not supplemented.
2. **`/orchestrate-ddd` is not a file.** The real command doc is
   `commands/orchestrate.md`. Writing the incident note to the name in the
   original task would have silently no-opped the only criterion with no other
   enforcement.
3. **Nothing runs the workflow lint.** `hooks/workflow-lint.js` is a manual CLI;
   no hook, no CI and no line in `commands/orchestrate.md` invokes it. Rules
   WL1-WL10 therefore protect nothing today. There is exactly one well-defined
   moment where a hand-authored script is handed to the runner, and no gate sits
   there.
4. **The command doc and the lint are deployed as byte copies, not symlinks.**
   Patterns, skills and rules are symlinked and go live instantly; these two are
   copied to `~/.claude/`. Editing the source alone changes nothing at runtime.

## Acceptance Criteria

1. [ ] **AC-NO-REVERT — reverting stops being an available move.** State in
       `commands/orchestrate.md` section 2, in the run of prose that already
       prescribes what every implementer prompt must carry, that `git checkout`,
       `git restore`, `git stash` and `git reset` are forbidden on any path,
       without exception, explicitly including "only my own file" and "putting
       it back the way it was". An agent that believes a file is out of scope
       says so in its final message and stops; it never undoes it.
   - **Where this lives, and why not in the script.** `HARD_RULES` is a local
     constant invented per script; `claude-patterns` has no canonical hard-rules
     block and no workflow-script template at all (verified: zero matches). The
     per-task scripts are historical once their run ends, so editing VF-037's
     copy protects nothing. Section 2 of the command doc is the only place a
     future script author reads before writing the next prompt, which makes it
     the durable home. Implementer and fix agent share one prompt builder, so
     one rule covers both.
   - **Self-application.** The workflow script generated for VF-039a itself must
     carry the rule in its own hard-rules block. That is the first proof the
     prose works.
   - Do not break the mutation-check protocol: it backs up and restores with
     `cp`, not with git, so the absolute ban does not collide with it. If the
     prose needs an exception carve-out for that shape, it must be phrased as
     "use `cp`, never git", not as a relaxation of the ban.
2. [ ] **AC-DOC — the incident survives into projects that copy the template.**
       Add the incident to the rules-as-prose run in
       `claude-patterns/commands/orchestrate.md`, alongside the existing notes
       that cite WL6 and the 2026-07-04 / 2026-07-20 incidents. Keep the lesson
       generic: the doc is shared by every consuming project, so it must not
       read as a vytches-ddd story. Correct the stale `/orchestrate-ddd` name in
       this file only — the wider rename across README, CLAUDE.md and
       DECISIONS-LOG is explicitly out of scope.
3. [x] **AC-LINT-GATE — already satisfied by other work; verify, do not build.**
       Between 2026-08-13 and 2026-08-19 the gate landed independently (commit
       `48c024e`), and in a stronger form than this task proposed: not a prose
       step but a PreToolUse hook on the `Workflow` matcher, registered in
       `~/.claude/settings.json:10`, running `hooks/pre-workflow-lint.js`, which
       at line 68 does `require('workflow-lint.js')` and therefore runs the full
       WL1-WL16 set and blocks on errors. Verified this run. Adding a prose step
       would now be a duplicate, so it is explicitly forbidden.

4. [x] **AC-DEPLOY — the change reaches the place the system reads from.**
       **Reworded 2026-08-19: the original wording was unsatisfiable.** It asked
       for a re-copy to `~/.claude/commands/orchestrate.md` and a byte-identity
       check, on the premise that the file reaches runtime as a copy. It does
       not: `~/.claude/commands` and `~/.claude/hooks` are _directory_ symlinks
       into `claude-patterns`, so source and deploy target are the same inode
       and `cp` fails with "are the same file". The premise came from reading
       `ls -l` on the file rather than `ls -ld` on the directory.
   - Replacement check, satisfied: confirm the symlink resolves to source
     (`ls -ld ~/.claude/commands`, `stat -c %i` on both paths). Drift is
     structurally impossible, so the criterion's goal holds by construction and
     no deploy step exists for anything in `claude-patterns`.

## Non-goals

- The deterministic churn guard and the new lint rules. Those are VF-039b, gated
  on an open architectural question about where a shared mechanism would live.
- Redesigning the layer model or the STOP2 contract. The final gate caught the
  regression exactly as designed.
- Renaming `/orchestrate-ddd` across the 15+ prose files that still carry it.
- Per-layer commits or isolated worktrees. Both are real structural fixes and
  both were judged out of proportion here; every implement prompt currently says
  "Do not commit, do not stage, do not push" as a deliberate invariant of the
  STOP2 contract.

## Links & References

- `project-orchestration/analysis/VF-039a-orchestration-revert-ban.analysis.md`
  — approved decision record (D2, D3, D4, D6).
- `/opt/projects/claude-patterns/commands/orchestrate.md` — the real command
  doc.
- `/opt/projects/claude-patterns/hooks/workflow-lint.js` — WL1-WL10, manual CLI.
- `project-orchestration/.workflow/VF-037.workflow.js` — the script the incident
  happened to; shared hard rules at line 43, the partial ban at line 615, one
  prompt builder for implement and fix at line 336.
- Run journal `wf_f24e8621-140` — entries 6, 17, 18.
- Sibling: `VF-039b-orchestration-churn-guard.md`.
