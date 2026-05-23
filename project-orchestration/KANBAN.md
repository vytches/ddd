# Kanban — @vytches/ddd

_Last regenerated: 2026-05-22 by /pulse_

Source of truth: `project-orchestration/tasks/` — this file is regenerated;
edits here will be overwritten. Update task YAML frontmatter instead.

---

## P0 — Critical

_None. v0.26.0 published. No blocking issues._

---

## P1 — High

| ID     | Title                                                      | Status      | Est     | Notes                                                     |
| ------ | ---------------------------------------------------------- | ----------- | ------- | --------------------------------------------------------- |
| VP-003 | Outbox production readiness (backoff + re-poll + recovery) | in_progress | 7.5h    | Parts 2–4 production-validated. Start feature branch now. |
| VT-001 | Fill critical test coverage gaps (GWT + domain-primitives) | in_progress | ~4h rem | Post-publish opportunistic. GWT migration remaining.      |

---

## P2 — Normal

| ID     | Title                                                        | Status      | Est  | Notes                                                                                 |
| ------ | ------------------------------------------------------------ | ----------- | ---- | ------------------------------------------------------------------------------------- |
| VF-001 | Automated DDD compliance validation (rule engine + scoring)  | in_progress | ~18h | MVP shipped (3 rules, CLI live). Remaining rules deferred.                            |
| VP-002 | Repository caching + indexed queries + N+1 prevention        | in_progress | ~15h | Partial done. Consider split into -a/-b subtasks.                                     |
| VP-006 | Cold-start, service-resolution, auto-discovery performance   | in_progress | ~8h  | Partial done. Consider split into -a/-b subtasks.                                     |
| VF-002 | Bounded context, context mapping, large-scale structure docs | planned     | 20h  | Defer to v0.27. Validate post-publish adoption signal first.                          |
| VD-004 | Search, live playground, categorization for docs site        | planned     | 20h  | Deferred. Pending real user signal. Lighter alternatives: Algolia (4h), Mermaid (4h). |

---

## P3 — Low / Backlog

| ID     | Title                                              | Status  | Est     | Notes                                                   |
| ------ | -------------------------------------------------- | ------- | ------- | ------------------------------------------------------- |
| VA-001 | `@vytches/ddd-agent` AI boundary package (concept) | backlog | unknown | Post-v0.27. Awaiting production validation in consumer. |

---

## Recently Completed (last 14 days)

- **DOC-001** — README accuracy audit: 17/20 packages had hallucinated APIs, all
  rewritten — 2026-05-22
- **VP-004** — DROPPED: event store streaming (no-adapters violation, zero
  consumer signal) — 2026-05-22
- **REL-011** — @vytches/\* migration GH Packages → npmjs.org — done
- **REL-003** — publishConfig for all 20 packages with provenance — done
- **REL-000** — npm org registration + v0.26.0 published ✅ — done
- **VT-005** — DI base-adapter + discovery-registry + CQRS configuration —
  2026-05-10
- **VT-004** — Integration layers + base-business-policy — 2026-05-10
- **VT-003** — Capabilities coverage (audit/versioning/snapshot/event-sourcing)
  — 2026-05-10
- **VT-002** — Foundation tier coverage — 2026-05-10
- **VF-CANON-001** — Entity, PlainDomainService, IDomainFactory canonical
  patterns — 2026-05-09

---

## Critical Path — v0.26.1

```
VP-003 Parts 2–4 (7.5h, feature branch)
    ↓
docs patch release (README fixes to npm)
    ↓
v0.26.1 publish
```

---

## Dropped

- **VP-004** — event store streaming with backpressure. Contradicts no-adapters
  policy; 0 consumer validation after 5 consecutive pulse flags. If demand
  surfaces post-publish, repurpose as 4h documentation task.
