# Kanban — @vytches/ddd

_Last updated: 2026-05-27 by /threat-model + multi-agent analysis + @product-owner_

Source of truth: `project-orchestration/tasks/` — this file is regenerated;
do not edit manually.

---

## 🔴 P0 — Critical (GDPR blocker — v0.31.0-rc)

| ID     | Title                                               | Status  | Est | Age | Depends on |
| ------ | --------------------------------------------------- | ------- | --- | --- | ---------- |
| VS-001 | logging: CQRS decorators — PII masking              | planned | 2h  | 1d  | VS-003     |

---

## 🟠 P1 — High (Security sprint — execute in order)

| ID     | Title                                                    | Status  | Est  | Age | Depends on       |
| ------ | -------------------------------------------------------- | ------- | ---- | --- | ---------------- |
| VS-003 | logging: DataMasker — plural key bypass (passwords)      | planned | 1h   | 1d  | —                |
| VS-002 | logging: ConsoleProvider — DataMasker for event.data     | planned | 1.5h | 1d  | VS-003           |
| VS-004 | logging: DataMasker — regex validation (ReDoS)           | planned | 2h   | 1d  | VS-003           |
| VS-005 | policies: CachedPolicy — replace djb2 hash (collisions)  | planned | 1.5h | 1d  | —                |
| VS-009 | logging: class decorator — wrap only handle(), not all   | planned | 1.5h | 0d  | VS-001 *(new)*   |
| VS-010 | logging: DataMasker — toJSON() bypass via getter         | planned | 1.5h | 0d  | VS-003 *(new)*   |

---

## 🟡 P2 — Normal

| ID     | Title                                                        | Status      | Est      | Age | Notes           |
| ------ | ------------------------------------------------------------ | ----------- | -------- | --- | --------------- |
| VS-006 | resilience: CSV exporter — formula injection chars           | planned     | 0.5h     | 1d  |                 |
| VS-007 | messaging: OutboxProcessor — warn on default handler replace | planned     | 0.5h     | 1d  |                 |
| VS-011 | logging: @LogCommands default maskSensitiveData: true        | planned     | 0.5h     | 0d  | VS-001 *(new, breaking)* |
| VS-012 | logging: DataMasker payload size guard (event loop)          | planned     | 1h       | 0d  | VS-010 *(new)*  |
| VT-001 | Test coverage gap fill                                       | in_progress | ~4h rem  | 18d |                 |
| VP-002 | Repository caching + N+1                                     | in_progress | ~15h rem | 18d |                 |
| VP-006 | DI container cold-start performance                          | in_progress | ~8h rem  | 18d |                 |
| VF-001 | DDD validation / ddd-lint tools                              | in_progress | ~10h rem | 18d |                 |
| VP-007 | Per-context CQRS buses                                       | ✅ done      | —        | 4d  |                 |
| VP-008 | OutboxProcessor default handler + priority hardening         | ✅ done      | —        | 2d  |                 |
| VP-003 | Messaging outbox production hardening                        | ✅ done      | —        | 4d  |                 |

---

## 🔵 P3 — Low / Deferred

| ID     | Title                                                     | Status  | Est  | Age |
| ------ | --------------------------------------------------------- | ------- | ---- | --- |
| VS-008 | value-objects: EntityIdFactory deprecation warn suppress  | planned | 0.5h | 1d  |
| VF-002 | Strategic design documentation                            | planned | 20h  | 59d |
| VD-004 | Interactive documentation site                            | planned | 20h  | 59d |
| VA-001 | AI agent package proposal                                 | backlog | ?    | 59d |

---

## 📊 Summary

| Status      | Count |
| ----------- | ----- |
| planned     | 17    |
| in_progress | 4     |
| ✅ done      | 3     |
| backlog     | 1     |
| **Total**   | **25**|

## 🚀 Security Sprint Plan (v0.31.0)

> Decision (Product Owner 2026-05-27): **Fix scope for VS-001** (not API redesign).
> API redesign (`payload: 'off'|'masked'|'full'`) planned for v0.32.0.
> TM-VS-001.md generated: `docs/security/threat-models/TM-VS-001.md`

**Execution order (dependency graph):**
```
VS-003 (1h) → VS-001 (2h) → VS-002 (1.5h)
           ↘  VS-004 (2h) [parallel z VS-001]
           ↘  VS-010 (1.5h) → VS-012 (1h)
VS-009 (1.5h) [po VS-001, ten sam plik]
VS-005 (1.5h) [niezależny]
```

**PR 1 — Logging stack core (6.5h) → v0.31.0-rc:**
VS-003 + VS-001 + VS-002 + VS-004

**PR 2 — DataMasker hardening (3h) → v0.31.0:**
VS-010 + VS-012 + VS-009

**PR 3 — Other packages + improvements (4h) → v0.31.0 final:**
VS-005 + VS-006 + VS-007 + VS-008 + VS-011

**Newly discovered issues (2026-05-27):**
- VS-009: Decorator wraps all class methods, not just `handle` (SEC-LOGGING-005, DREAD 8)
- VS-010: DataMasker bypass via `toJSON()` getter (SEC-LOGGING-006, DREAD 9)
- VS-011: `@LogCommands` should default to `maskSensitiveData: true` (breaking, v0.31.1)
- VS-012: Payload size guard for event loop safety (performance hardening)

_Next pulse: before starting VS-003 or in 7 days._
