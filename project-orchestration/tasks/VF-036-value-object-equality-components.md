# Task: First-class `getEqualityComponents()` hook in BaseValueObject.equals()

## Task Metadata

```yaml
task_id: VF-036
title:
  'value-objects: add getEqualityComponents() as a supported extension point
  for partial-identity equality (docs-phantom API made real)'
type: feature
priority: high
complexity: medium
estimated_time: 6h
created_by: consumer-feedback-2026-08-08
created_at: 2026-08-08
status: backlog
release_target:
  next pre-release after implementation; MUST be validated by the downstream
  consumer's full suite on a patched build BEFORE any npm tag (they offered)
package: "'@vytches/ddd-value-objects'"
findings: [LIB-MATURITY-AUDIT-2026-08-08 S1-3 class, consumer report 2026-08-08]
```

## Why

A downstream consumer reported that `BaseValueObject.equals()` "silently
ignores" `protected getEqualityComponents()`, which ~170 of their value-object
subclasses implement. Root-cause investigation (git history, full `-S` search)
established:

1. **`getEqualityComponents()` has NEVER existed in the runtime API.** It
   appeared only in early `domain-primitives`/`value-objects` READMEs (from the
   initial docs commit `d1c13027` through the 2025-07-16 release `bdd5e30c`),
   showing a classic DDD `ValueObject` base with
   `protected abstract getEqualityComponents(): any[]`. The phantom was removed
   from docs in the 2026-05-23 README accuracy cleanup (`0ad22d88`), but
   consumers had already built on it.
2. **`equals()` has always compared the raw constructor value** —
   `JSON.stringify` before VF-023, `LibUtils.deepEqual` after. No released
   version ever consulted a components hook, so consumer overrides have been
   dead code in every version (NOT a 0.31.0-alpha.0 regression).
3. The underlying need is canonical DDD: "some props participate in identity,
   some don't" (timestamps, audit metadata, cache keys excluded from value
   identity). The library currently has no supported answer other than
   overriding `equals()` per subclass.

Decision: make the documented-but-never-implemented API real, since it is the
standard pattern, it matches what consumers already wrote, and the hook name is
already "reserved" by our own historical docs.

## Design

- Add to `BaseValueObject<T>`:
  `protected getEqualityComponents(): readonly unknown[] | undefined { return undefined; }`
- `equals()` consults it first: if BOTH sides return a defined component array,
  compare component-wise (same length + `LibUtils.deepEqual` per element —
  reusing the VF-023 algorithm so `Date`/`Map`/`Set`/`NaN` semantics stay
  consistent). If either side returns `undefined`, fall back to the current
  raw-value comparison unchanged.
- Asymmetric case (one side overrides, the other doesn't — different subclass
  or mixed versions): fall back to raw-value comparison; document this
  explicitly.
- No signature changes anywhere; default behavior (no override) is bit-for-bit
  the current behavior.

## ⚠️ Behavioral-BC classification (mandatory, see LIB-MATURITY-AUDIT-2026-08-08 "Larger #12")

This is a **behavioral breaking change with no signature change** — the exact
class that slipped through twice before (VB-003/F-C4, VP-009 Bug #3). Shipping
it activates every dormant consumer override at once: each starts doing what
its author intended, which may differ from what their code currently relies
on. It MUST ship with a `BREAKING CHANGE:` commit/CHANGELOG entry, not a
`feat:`.

## Acceptance Criteria

1. [ ] Hook implemented as designed; default path (no override) produces
       identical results to current `equals()` — proven by running the existing
       equality test corpus unmodified.
2. [ ] New tests: partial-identity VO (excluded timestamp field → `equals()`
       true despite differing raw props); component order/length mismatch →
       false; nested `Date`/`Map`/`Set`/`NaN` inside components; asymmetric
       override fallback; `undefined`-returning override.
3. [ ] JSDoc on the hook covering: when to use it vs full-value equality, the
       asymmetric-fallback rule, and the undefined-during-super() trap does NOT
       apply here (equals runs post-construction) — plus README + LLMGUIDE
       sections that match the code exactly (verify signatures against source;
       this task exists because docs once didn't).
4. [ ] CHANGELOG `BREAKING CHANGE:` entry with "you are affected if" clause
       (grep hint: `getEqualityComponents` in consumer repos) and before/after
       snippets; MIGRATION.md section added and cross-linked.
5. [ ] Patched pre-release build handed to the downstream consumer for a full
       e2e/integration run against their ~170 override sites; their sign-off
       recorded here before any npm tag includes this change.
6. [ ] api-surface snapshot updated; type-check + build + full value-objects
       suite green.

## Non-goals

- No change to `AggregateRoot`/entity equality (identity-based, out of scope).
- No auto-detection or warnings for "override exists but was dead code" in old
  versions — the CHANGELOG grep hint covers discovery.

## Links & References

- Consumer report: 2026-08-08 (equality components ignored; repro with a
  rate-configuration VO excluding `effectiveFrom` from identity).
- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  — action plan items 9 (docs-compile CI gate; this incident is evidence) and
  12 (behavioral-BC checklist; this task is the first consumer of it).
- History: `d1c13027` (phantom introduced in docs), `0ad22d88` (phantom removed
  from docs), `90d393a8` (VF-023 — deepEqual algorithm this design reuses).
