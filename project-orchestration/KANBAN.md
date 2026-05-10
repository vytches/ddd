# Kanban — @vytches/ddd

_Last regenerated: 2026-05-10 (VT-coverage-marathon) by /pulse_

Source of truth: `project-orchestration/tasks/` — this file is regenerated;
edits here will be overwritten. Update task YAML frontmatter instead. Handoff:
[`/RELEASE-READINESS.md`](../RELEASE-READINESS.md).

---

## P0 — Critical

| ID      | Title                                                              | Status      | Est  | Last Touched | Notes                                                                           |
| ------- | ------------------------------------------------------------------ | ----------- | ---- | ------------ | ------------------------------------------------------------------------------- |
| REL-000 | Confirm @vytches scope is reservable on npmjs.org or pick fallback | in_progress | 1h   | 2d           | **Deadline 2026-05-12 — 2 days.** Manual registration; only human-gated action. |
| REL-003 | Configure all 20 packages for public npmjs.org with provenance     | parked      | 3h   | 2d           | Code-only change. Single soonest unblock. No npm credentials needed.            |
| REL-011 | Move @vytches/\* from GH Packages to npm                           | parked      | 0.5h | 2d           | Depends on REL-003 + REL-000. Migration ADR + release.yml update.               |

## P1 — High

| ID     | Title                                                          | Status      | Est | Last Touched | Notes                                                                                            |
| ------ | -------------------------------------------------------------- | ----------- | --- | ------------ | ------------------------------------------------------------------------------------------------ |
| VT-001 | Cover aggregates/domain-primitives/messaging/contracts (parent) | in_progress | 16h | 1d           | VT-002..005 closed bulk of scope (+5.3pp coverage). Remaining: GWT migration, domain-primitives ratio. |

## P2 — Normal

| ID     | Title                                                        | Status      | Est | Last Touched | Notes                                                                                            |
| ------ | ------------------------------------------------------------ | ----------- | --- | ------------ | ------------------------------------------------------------------------------------------------ |
| VF-001 | Automated DDD compliance validation (rule engine + scoring)  | in_progress | 24h | 1d           | MVP shipped (3 rules, 29 tests, 458 files in ~200ms). Full scope deferred.                       |
| VP-002 | Repository caching + indexed queries + N+1 prevention        | in_progress | 20h | 1d           | IBatchRepository contract + MemoizedSpecification done. Remainder unvalidated.                   |
| VP-006 | Cold-start, service-resolution, auto-discovery performance   | in_progress | 16h | 1d           | Single-pass reflection + WeakSet memo done. Remainder optional.                                  |
| VP-003 | Batching, prioritization, binary serialization in outbox     | planned     | 14h | —            | **UNVALIDATED** — juz-ide-api rates current outbox "acceptable". Validate before starting.       |
| VP-004 | Streaming event projections with backpressure                | planned     | 18h | —            | **DROP CANDIDATE** — flagged 3rd consecutive pulse. Contradicts no-adapters decision.            |
| VF-002 | Bounded context, context mapping, large-scale structure docs | planned     | 20h | —            | Strategic design docs for v0.26+ educational content.                                            |
| VD-004 | Search, live playground, categorization for docs site        | planned     | 20h | —            | Deferred — depends on docs site infrastructure.                                                  |

## P3 — Low

_None._

---

## Recently Completed (last 7 days)

- **VT-002** — Foundation tier coverage (aggregate-errors, aggregate-utilities, id.value-object) — 2026-05-10
- **VT-003** — Capabilities coverage (audit/versioning/snapshot/event-sourcing) — 2026-05-10
- **VT-004** — Integration layers + base-business-policy — 2026-05-10
- **VT-005** — DI base-adapter + discovery-registry + CQRS configuration — 2026-05-10
- **VF-CANON-001** — Entity, PlainDomainService, IDomainFactory canonical patterns — 2026-05-09
- **VP-NEW-002** — apply() refactor (replay +21.7%, 3.9M events/s) — 2026-05-09

---

## Critical Path to Publish

```
REL-000 (npmjs.com manual registration, <1h, deadline 2026-05-12)
    ↓
REL-003 (publishConfig, 3h, code-only)
    ↓
REL-011 (CI wiring, 30 min)
    ↓
smoke test (1h)
    ↓
PUBLISH
```

**Total: ~5.5h once maintainer acts on REL-000.**

---

## Dropped / Deprioritized

- **VP-004** flagged for formal drop pending @product-owner decision
  (contradicts no-adapters architectural choice; flagged 3rd consecutive pulse).

---

## Velocity (cumulative)

- Marathon total: ~26h actual vs ~233h estimated (89% time saved)
- Today (VT-002..005): ~5h actual vs ~24h estimated (79% saved)
- Yesterday (canonical patterns + JSDoc + perf): ~5h actual vs ~82h estimated (94% saved)
