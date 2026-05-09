# Kanban — @vytches/ddd

_Last regenerated: 2026-05-09 (post-marathon) by /pulse_

Source of truth: `project-orchestration/tasks/` — this file is regenerated;
edits here will be overwritten. Update task YAML frontmatter instead. Handoff:
[`/RELEASE-READINESS.md`](../RELEASE-READINESS.md).

---

## P0 — Critical

| ID      | Title                                                               | Status      | Est | Last Touched | Notes                                                                     |
| ------- | ------------------------------------------------------------------- | ----------- | --- | ------------ | ------------------------------------------------------------------------- |
| REL-000 | Confirm @vytches scope is reservable on npmjs.org or pick fallback  | in_progress | 1h  | 1d           | Deadline 2026-05-12 (3 days). Research done; manual registration pending. |
| REL-003 | Configure all 20 packages for public npmjs.org with provenance      | parked      | 3h  | 1d           | Code-only change. Single soonest unblock. No npm credentials needed.      |
| REL-011 | Strategy + execution for moving @vytches/\* from GH Packages to npm | parked      | 3h  | 1d           | Depends on REL-003 + REL-000. Migration ADR + release.yml update.         |

## P1 — High

| ID     | Title                                                       | Status                | Est | Last Touched | Notes                                                                                                                                                             |
| ------ | ----------------------------------------------------------- | --------------------- | --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VP-002 | Repository caching + indexed queries + N+1 prevention       | in_progress (partial) | 20h | 0d           | **Partial 2026-05-09**: IBatchRepository contract + MemoizedSpecification shipped. Original "35% loading" criterion **out of scope** (adapter concern). Score 88. |
| VP-003 | Batching, prioritization, binary serialization in outbox    | planned               | 14h | 1d           | Score 87. Unvalidated — flagged by @product-owner (no consumer signal).                                                                                           |
| VP-004 | Streaming event projections with backpressure               | planned               | 18h | 1d           | Score 86. **Scope question**: contradicts no-adapters decision; consider repurpose/drop.                                                                          |
| VF-001 | Automated DDD compliance validation (rule engine + scoring) | in_progress (partial) | 24h | 0d           | **Partial 2026-05-09**: MVP CLI shipped (3 rules, ddd-lint). Full rule engine + scoring remains. Score 82.                                                        |

## P2 — Normal

| ID     | Title                                                        | Status                | Est | Last Touched | Notes                                                                                                                                        |
| ------ | ------------------------------------------------------------ | --------------------- | --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| VT-001 | Cover aggregates/domain-primitives/messaging/contracts       | in_progress (partial) | 16h | 0d           | **Partial 2026-05-09**: PBT (fast-check) + lifecycle suite + outbox-processor bug fix. Coverage ratio targets remain.                        |
| VF-002 | Bounded context, context mapping, large-scale structure docs | planned               | 20h | 1d           | Score 78. Depends on VF-001 + (cancelled VD-001).                                                                                            |
| VD-004 | Search, live playground, categorization for docs site        | planned               | 20h | 1d           | Score 77. **Cut candidate** if capacity tight (StackBlitz from DX-NEW-001 already covers "run without cloning").                             |
| VP-006 | Cold-start, service-resolution, auto-discovery performance   | in_progress (partial) | 16h | 0d           | **Partial 2026-05-09**: single-pass reflection + WeakSet memoization. Container metadata size + service-resolution targets remain. Score 72. |

## P3 — Low

_(none currently active)_

---

## Frontmatter cleanup — DONE 2026-05-09

All 4 partial-delivery task files updated:

- **VT-001** → `in_progress` + `## Partial delivery (2026-05-09)` section
- **VP-006** → `in_progress` + partial-delivery section + acceptance criteria
  checkboxes
- **VP-002** → `in_progress` + partial-delivery section + scope amendment
  (no-adapters)
- **VF-001** → `in_progress` + MVP delivery section + remaining scope

**VF-CANON-001** → moved to `completed-tasks/`.

**VP-NEW-002** → `completed-tasks/VP-NEW-002-apply-refactor.md` created with
full delivery record (refactor scope, bench deltas, verification).

---

## Recently completed (last 24h)

| Task         | Shipped | Estimated | Actual | Highlight                                                         |
| ------------ | ------- | --------- | ------ | ----------------------------------------------------------------- |
| VF-CANON-001 | full    | 8h        | 1h     | 3 canonical Evans/Vernon gaps closed                              |
| _(no file)_  | —       | 8-12h     | 1h     | JSDoc enhancement for 18 core public-API symbols                  |
| VT-001       | partial | 16h       | 1h     | PBT + lifecycle + caught outbox-processor destructure bug         |
| VP-NEW-002   | full    | 6h        | 30m    | apply() replay perf +21.7% (3.9M events/s)                        |
| VP-006       | partial | 16h       | 30m    | DI single-pass reflection + WeakSet memo (~15-30ms multi-context) |
| VP-002       | partial | 20h       | 45m    | IBatchRepository contract + MemoizedSpecification                 |
| VF-001       | MVP     | 24h       | 1h     | ddd-lint CLI (3 rules, 29 tests, scans 458 files in ~200ms)       |

**Session totals**: ~5h actual vs ~82h estimated = **94% time saved**.

---

## Critical path to publish

```
REL-003 (3h, code-only) ──┐
                          ├──► REL-011 (30m) ──► npmjs.com manual registration
REL-000 (deadline ⏰) ────┘                       (maintainer, ~30m)
                                                          │
                                                          ▼
                                              juz-ide-api smoke test (1h)
                                                          │
                                                          ▼
                                              npm publish + announce (1h)
```

Total maintainer time to publish: **~3.5h** once REL-000 deadline cleared.

---

## Counts (post-cleanup)

- **Active**: 11 task files
- **Parked**: 2 (REL-003, REL-011)
- **In progress**: 5 (REL-000, VT-001, VP-006, VP-002, VF-001 — last 4 with
  partial deliveries)
- **Pure planned**: 4 (VP-003, VP-004, VF-002, VD-004)
- **Completed-tasks/**: 44 (incl. 2 added today: VF-CANON-001, VP-NEW-002)
