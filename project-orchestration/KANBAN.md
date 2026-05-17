# Kanban — @vytches/ddd

_Last regenerated: 2026-05-17 by /pulse_

Source of truth: `project-orchestration/tasks/` — this file is regenerated;
edits here will be overwritten. Update task YAML frontmatter instead. Handoff:
[`/RELEASE-READINESS.md`](../RELEASE-READINESS.md).

---

## P0 — Critical

| ID      | Title                                                              | Status      | Est  | Age | Notes                                                                            |
| ------- | ------------------------------------------------------------------ | ----------- | ---- | --- | -------------------------------------------------------------------------------- |
| REL-000 | Confirm @vytches scope is reservable on npmjs.org or pick fallback | in_progress | 1h   | 7d  | **OVERDUE 5 DAYS (deadline 2026-05-12).** Human gate — maintainer registers org. |
| REL-003 | Configure all 20 packages for public npmjs.org with provenance     | parked      | 3h   | 7d  | Code-ready. Unblocks once REL-000 done. No npm credentials needed.               |
| REL-011 | Move @vytches/\* from GH Packages to npm                           | parked      | 0.5h | 7d  | Depends on REL-003 + REL-000. Migration ADR + release.yml update.                |

## P1 — High

| ID     | Title                                                           | Status      | Est | Age | Notes                                                                                |
| ------ | --------------------------------------------------------------- | ----------- | --- | --- | ------------------------------------------------------------------------------------ |
| VT-001 | Cover aggregates/domain-primitives/messaging/contracts (parent) | in_progress | 16h | 7d  | VT-002..005 closed bulk (+5.3pp). Remaining: GWT migration, domain-primitives ratio. |

## P2 — Normal

| ID     | Title                                                        | Status      | Est | Age | Notes                                                                   |
| ------ | ------------------------------------------------------------ | ----------- | --- | --- | ----------------------------------------------------------------------- |
| VF-001 | Automated DDD compliance validation (rule engine + scoring)  | in_progress | 24h | 7d  | MVP shipped (3 rules, 29 tests, 458 files ~200ms). Full scope deferred. |
| VP-002 | Repository caching + indexed queries + N+1 prevention        | in_progress | 20h | 7d  | IBatchRepository + MemoizedSpecification done. Remainder unvalidated.   |
| VP-006 | Cold-start, service-resolution, auto-discovery performance   | in_progress | 16h | 7d  | Single-pass reflection + WeakSet memo done. Remainder optional.         |
| VP-003 | Outbox optimization (adaptive re-poll + NestJS module)       | planned     | 14h | 7d  | Parts 2–3 validated by juz-ide-api. Defer to v0.26.1 fast-follow.       |
| VF-002 | Bounded context, context mapping, large-scale structure docs | planned     | 20h | 7d  | Strategic design docs for v0.26+ educational content.                   |
| VD-004 | Search, live playground, categorization for docs site        | planned     | 20h | 7d  | Deferred — depends on docs site infrastructure.                         |

## P3 — Low

_None._

---

## Recently Completed (last 14 days)

- **VT-002** — Foundation tier coverage (aggregate-errors, aggregate-utilities,
  id.value-object) — 2026-05-10
- **VT-003** — Capabilities coverage (audit/versioning/snapshot/event-sourcing)
  — 2026-05-10
- **VT-004** — Integration layers + base-business-policy — 2026-05-10
- **VT-005** — DI base-adapter + discovery-registry + CQRS configuration —
  2026-05-10
- **VF-CANON-001** — Entity, PlainDomainService, IDomainFactory canonical
  patterns — 2026-05-09
- **VP-NEW-002** — apply() refactor (replay +21.7%, 3.9M events/s) — 2026-05-09

---

## Critical Path to Publish

```
REL-000 (npmjs.com manual registration, <1h, 🔴 OVERDUE 5 DAYS)
    ↓
REL-003 (publishConfig, 3h, code-only)
    ↓
REL-011 (CI wiring, 30 min)
    ↓
smoke test (1h)
    ↓
PUBLISH v0.26.0
```

**Total: ~5.5h once maintainer acts on REL-000.**

---

## Dropped

- **VP-004** — formally flagged for DROP (4th consecutive pulse). Scope
  "streaming event projections with backpressure" contradicts no-adapters
  policy; 0 consumer validation. If demand surfaces post-publish, repurpose as
  4h documentation task.

---

## Velocity (cumulative)

- Marathon total: ~26h actual vs ~233h estimated (89% time saved)
- Last 7 days (2026-05-10..17): docs/tests only, develop branch clean
