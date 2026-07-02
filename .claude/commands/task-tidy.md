---
name: task-tidy
description: |
  Automated task housekeeping for @vytches/ddd's actual task schema (task_id,
  not the generic TS-XXX/story_points template). Moves done tasks, flags
  missing fields, validates status/priority values, checks dependencies.
  Non-destructive — previews changes before applying.
tools: Read, Write, Edit, Glob, Grep, Bash
---

# /task-tidy — Task Housekeeping (@vytches/ddd schema)

Automated cleanup of `project-orchestration/`. Validates structure, flags
missing/invalid fields, moves completed tasks. Adapted to this repo's real task
format — **not** the generic `claude-patterns` TS-XXX/story_points template (see
"Why this override exists" below).

**Cost**: ~$0.03 (no agents) | **When**: Weekly, after sprint, or before /pulse

## Why this override exists

`claude-patterns` ships a generic `/task-tidy` written for a different project's
schema (YAML **frontmatter** with `id: TS-XXX`, `story_points`,
`priority: P0-P3`, `assignee`, `labels`, `_archive/` folder). None of that
matches how `@vytches/ddd` actually writes tasks — this project uses a
```yaml fenced block under `## Task Metadata`, `task_id`, `priority:
critical|high|normal|low`, and a single `completed-tasks/`bucket for every terminal state. Editing the shared`claude-patterns`file would break`/task-tidy`for other projects that *do* use the generic schema, so this project keeps a local override instead. This file is the source of truth for`@vytches/ddd`— do not resync it from`claude-patterns`.

## Rules Source

Schema inferred from actual files in `project-orchestration/tasks/` and
`completed-tasks/` (~80 task files) as of 2026-07-01. There is no separate
written spec — this file documents the de facto convention.

### Task File Structure

Not YAML frontmatter. Each task is:

````markdown
# Task: <Title>

## Task Metadata

```yaml
task_id: VX-NNN
title: '...'
type: bug|feature|improvement|optimization|documentation|concept|research|refactor
priority: critical|high|normal|low
complexity: simple|medium|complex|expert
estimated_time: <Xh> | "unknown (requires ...)"
created_by: human (...) | agent (...)
created_at: YYYY-MM-DD
status: planned|in_progress|backlog|blocked|review|done|cancelled
```
````

````

### Required Fields (minimum)

`task_id`, `title`, `type`, `priority`, `status`, `created_at` (a
`migrated_at` date is an accepted substitute for tasks carried over from the
pre-2026-05-08 archive — don't flag those as missing `created_at`).

### Expected-but-judgment Fields (warn if absent, never auto-fill)

`complexity`, `estimated_time`, `created_by`, `bounded_context`, `patterns` —
these require domain knowledge. Do not invent values for them; flag for
human/agent review instead.

### Optional Fields (present on some tasks, no defaults needed)

`updated_at`, `migrated_at`, `reviewed_at`, `release_target`,
`priority_score` (`NN/100`), `demand_signal`, `security_finding`,
`dread_score`, `audit_ref`, `depends_on` (free-text `TASK-ID (why)`, not a
bare array), `parent`, `related`, `package`/`packages`, `memory_ref`,
`lead_agent`, `supporting_agents`, `overall_progress`, `current_phase`,
`blockers`.

### Valid Status Values

`planned` | `in_progress` | `backlog` | `blocked` | `review` | `done` |
`cancelled`

Legacy terminal variants exist in `completed-tasks/` from before this
convention solidified (`completed`, `dropped`, `completed (partial)`). These
are historical and immutable — **never rewrite them to the current status
vocabulary**, only recognize them as valid terminal states so they don't get
flagged as invalid.

### Valid Priority Values

`critical` | `high` | `normal` | `low`

(Not P0-P3 — that scale belongs to the generic template, not this project.)

### Task Lifecycle (folder rules)

- `tasks/` — active tasks (status: `planned`, `in_progress`, `backlog`,
  `blocked`, `review`)
- `completed-tasks/` — terminal tasks (status: `done`, `cancelled`, or a
  legacy terminal variant). **Single bucket** — this repo has no `_archive/`
  folder; do not create one or invent a "deferred" move target.

## Workflow

### 1. Scan all task files

Read all `.md` files from `project-orchestration/tasks/` and
`project-orchestration/completed-tasks/`. Skip `TASK-TEMPLATE.md` (it's a
template, its placeholder `task_id: YYYY-MM-DD-XXX` is intentional, not a
mismatch). Extract the ```yaml fenced block under `## Task Metadata`.

### 2. Detect issues (in this order)

**A. Wrong folder (auto-fix, with confirmation)**
- `status: done|cancelled` (or legacy terminal variant) in `tasks/` → move to
  `completed-tasks/`
- `status: planned|in_progress|backlog|blocked|review` in `completed-tasks/`
  → **warn only, do not move**. `completed-tasks/` is treated as an
  immutable archive; some legacy entries (e.g. tasks reusing an old ID
  scheme) carry an active-looking status but are historical records, not
  live work. Moving them back could resurrect completed/abandoned scope.
  Flag for human judgment instead.

**B. Missing required fields (warn, do not auto-fill)**
- Missing `task_id`, `title`, `type`, `priority`, or `status`/`created_at`
  (with the `migrated_at` exception above) → warn, do not invent a value.
  Unlike the generic template, this schema has no safe mechanical defaults
  (no `story_points: 0` / `assignee: '@unassigned'` equivalent) — every
  field here encodes a real decision (priority, complexity, domain context)
  that only a human or a domain-aware agent should set.

**C. Stale updated_at/created_at (warn only)**
- Most recent of `updated_at` / `reviewed_at` / `created_at` /
  `migrated_at` older than 14 days on a non-terminal task → warn with the
  age in days.

**D. Invalid values (warn, suggest fix)**
- `status` not in the valid set (current + recognized legacy variants) →
  warn
- `priority` not in `critical|high|normal|low` → warn
- Date fields not matching `YYYY-MM-DD` → warn

**E. Filename vs task_id mismatch (warn)**
- Filename (minus `.md`) doesn't start with `task_id` → warn (excludes
  `TASK-TEMPLATE.md`)

**F. Broken dependencies (warn)**
- `depends_on` referencing a `task_id` that doesn't exist in `tasks/` or
  `completed-tasks/` → warn. Note: entries here are free text like
  `VP-002 (Repository Performance)`, not a bare ID array — extract the
  leading ID token before checking existence.

**G. Duplicate task_id across tasks/ + completed-tasks/ (warn only, no fix)**
- This repo has known historical ID reuse (e.g. `VF-008`, `VF-009`, `VF-010`
  each appear twice under an old vs. current numbering scheme in
  `completed-tasks/`). Flag new duplicates that involve an **active** task
  in `tasks/`, since that's a live collision risk. Do not flag duplicates
  confined entirely to `completed-tasks/` — those are known historical
  artifacts, not actionable.

### 3. Preview changes

````

[TASK-TIDY] Scanned {N} active + {M} completed tasks

WILL MOVE ({N} files): tasks/VX-NNN-slug.md → completed-tasks/ (status: done)

WARNINGS ({N} issues): VX-NNN: updated_at 2026-05-09 → 53d stale, in_progress
VX-NNN: depends_on VX-YYY — dangling reference, target not found VX-NNN: status
"foo" not in valid set
(planned|in_progress|backlog|blocked|review|done|cancelled)
completed-tasks/VX-NNN: status looks active but sits in immutable archive —
historical, not auto-moved

NO CHANGES NEEDED: {N} tasks are clean

```

### 4. Ask for confirmation

> "Apply {N} moves? (Y/N/selective)"

Only folder moves are ever auto-applied. Field fixes are never silent —
if a fix is genuinely mechanical (e.g. a status typo), propose it explicitly
and let the user approve it individually.

### 5. Apply changes

For moves: use Bash `mv` (`tasks/` → `completed-tasks/` only, one direction).
Do not edit the moved file's content — this repo's convention doesn't
require an `updated_at` bump on move (the `status: done` transition is
already the record of completion; re-touching every field on every routine
tidy pass creates noise in a repo where `completed-tasks/` is meant to be
immutable).

If a KANBAN.md or TEAM-STATE.md housekeeping flag referenced the moved
task, update it to reflect the resolved state (mirrors what `/pulse` does).

### 6. Summary

```

[TASK-TIDY] Done Moved: {N} files → completed-tasks/ Warnings: {N} (manual
review needed)

```

## Safety Rules

- NEVER delete task files — only move `tasks/` → `completed-tasks/`
- NEVER change `status`, `title`, `task_id`, or body content
- NEVER modify tasks already in `completed-tasks/` — immutable archive,
  including legacy entries with odd/inactive-looking status values
- NEVER invent a `_archive/` folder or a "deferred" move target — this
  repo doesn't have that lifecycle stage
- NEVER auto-fill missing fields with placeholder values — every field in
  this schema encodes a real decision; warn instead
- Always preview before applying
```
