# Technical Debt Register — @vytches/ddd

_Maintained by @tech-lead. Updated via `/tech-debt` or `/pulse`._ _Last review:
2026-04-03_

---

## Debt Score

| Date       | Major | Minor | Score | Trend                         |
| ---------- | ----- | ----- | ----- | ----------------------------- |
| 2026-04-03 | 1     | 3     | 2.5   | — (initial verified baseline) |

**Score formula**: Major x 1.0 + Minor x 0.5 **Thresholds**: 🟢 < 2 | 🟡 2-5 |
🔴 > 5

**Current: 🟡 MEDIUM (2.5)**

---

## 🔴 Major Debt (blocks features or creates risk)

| ID    | Description                                                                               | Area      | Effort | Blocks                   | Resolution Task  |
| ----- | ----------------------------------------------------------------------------------------- | --------- | ------ | ------------------------ | ---------------- |
| D-001 | Raw `throw new Error()` in base EntityId (7 calls, lines 142-182) — no domain error types | contracts | 2h     | Clean public API surface | VF-010 (updated) |

---

## 🟡 Minor Debt (slows down work)

| ID    | Description                                                                  | Area          | Effort | Notes                       |
| ----- | ---------------------------------------------------------------------------- | ------------- | ------ | --------------------------- |
| D-003 | `console.log` in test-harness.ts:274 + 3x `console.warn` in seeder           | testing       | 30min  | Non-blocking, cosmetic      |
| D-005 | `EntityIdFactory` still exported (deprecated, delegates to EntityId)         | value-objects | 0h now | Remove in next semver major |
| D-006 | CONVENTIONS.md missing — factory naming + constructor pattern not documented | docs          | 1h     | Onboarding friction         |

---

## ✅ Resolved

| ID  | Description                                       | Resolved Date         | How                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —   | `any` types (claimed 531)                         | 2026-04-03 (verified) | ~100 remain, nearly all intentional: `new (...args: any[]) => T` (TS pattern, 29 instances), decorator signatures, `Record<string, any>` for metadata, ACL domain-agnostic design, test seeders. Removing these would make the library unusable. |
| —   | `getPreviousState(): any` in IAuditable           | 2026-04-03 (verified) | INTENTIONAL — audit interface must capture any aggregate state. Changing to `unknown` would force consumers to add type narrowing on every audit read. Keeping `any` is the correct DX trade-off.                                                |
| —   | 522 `console.log` calls (claimed)                 | 2026-04-03 (verified) | Passively resolved. Actual remaining: 4 (1 log + 3 warn in testing pkg)                                                                                                                                                                          |
| —   | TODO/FIXME comments (claimed unknown)             | 2026-04-03 (verified) | 0 remaining in src/                                                                                                                                                                                                                              |
| —   | Factory naming inconsistency (claimed 8 patterns) | 2026-04-03 (verified) | Convention applied: create/from*/tryFrom*. Old names deprecated.                                                                                                                                                                                 |
| —   | Generic ID types on AggregateRoot (VF-009)        | 2026-04-03 (verified) | Already implemented: `AggregateRoot<TId = string>`                                                                                                                                                                                               |
| —   | Seeder stub methods typed `any`                   | 2026-04-03 (verified) | INTENTIONAL — test seeders must generate arbitrary aggregate/VO types. Type safety here would kill usability.                                                                                                                                    |

---

## Notes

[2026-04-03] @tech-lead: First verified baseline. Previous task files (VF-009,
VF-010) contained wildly stale numbers from early codebase state. VF-009 was
fully implemented but never marked complete. VF-010 claimed 80h/531 any/522
console — actual remaining work is ~12h. Major cleanup happened passively
through VF-021/VF-022 quality audits.

[2026-04-03] @tech-lead: Logger in aggregates core (aggregate-utilities.ts
imports @vytches/ddd-logging) needs architectural review — library packages
should not force logging dependency on consumers. Consider optional/pluggable
pattern.
