# Task: `getIdentityComponents()` — a supported partial-identity equality hook on BaseValueObject

## Task Metadata

```yaml
task_id: VF-036
title:
  'value-objects: add getIdentityComponents() as a supported extension point for
  partial-identity equality (replaces the getEqualityComponents docs-phantom)'
type: feature
priority: high
complexity: medium
estimated_time: 8h
created_by: consumer-feedback-2026-08-08
created_at: 2026-08-08
updated_at: 2026-08-09
status: backlog
release_target:
  next pre-release after implementation; additive minor bump. Downstream
  consumer validation on a patched build before any npm tag (they offered)
package: "'@vytches/ddd-value-objects'"
findings: [LIB-MATURITY-AUDIT-2026-08-08 S1-3 class, consumer report 2026-08-08]
analysis: project-orchestration/analysis/VF-036-value-object-equality-components.analysis.md
threat_model: docs/security/threat-models/TM-VF-036.md
```

> **This file was rewritten 2026-08-09 after the analysis was approved.** The
> original spec proposed implementing the phantom name `getEqualityComponents`
> and shipping it as a behavioral breaking change. That design was rejected —
> see the analysis artifact, Q1. Everything below reflects the approved design.

## Why

A downstream consumer reported that `BaseValueObject.equals()` "silently
ignores" `protected getEqualityComponents()`, which ~179 of their value-object
subclasses declare. Root-cause investigation (git history, full `-S` search)
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

Decision: provide the capability, but **under a new name**. Reusing the phantom
name would activate every dormant consumer override simultaneously on upgrade —
a behavioral break the library's absolute BC rule does not permit, and one no
gate in this repo can detect. A new name is purely additive: nothing activates
for anyone, and consumers opt in per class with a greppable rename.

## Design

- Add to `BaseValueObject<T>`:
  `protected getIdentityComponents(): readonly unknown[] | undefined { return undefined; }`
- Add a brand marker so nested value objects can be recognised across duplicate
  package copies: `Symbol.for('@vytches/ddd.valueObject')` on the base. **Do not
  use `instanceof`** — a failed pnpm dedupe silently breaks it.
- `equals()` consults the hook first: if BOTH sides return a defined array,
  compare element-wise (same length, then `componentEquals` per element). If
  either side returns `undefined`, fall through to the **completely unchanged**
  raw-value comparison.
- `componentEquals(a, b)`: if both elements carry the value-object brand,
  dispatch to `a.equals(b)`; otherwise `LibUtils.deepEqual(a, b)`. Each element
  gets a **fresh** `visitedPairs` WeakMap — sharing one across elements causes
  cross-element false negatives.
- The hook is honored for primitive `T` as well as object `T`. Restricting it to
  object values would create a rule invisible in the type system, and the most
  valuable overrides are on primitive-backed VOs.
- `undefined` = opt out (the base default). `[]` = defined-and-empty, therefore
  equal to any other `[]`-returning VO — documented as a footgun, no runtime
  warning (hot path).
- A throwing override **propagates**; `equals()` is no longer a total function.
  Documented, not caught.
- `getEqualityComponents` is **never implemented**, and no shim delegates to it.

### Ordering constraint

The hook must be consulted before the `this.value === valueObject.value` fast
path — that fast path is a _value_-identity test, so it would return `true`
before the components path could return `false`. Any reflexivity shortcut
(`this === valueObject`) must live **inside the components branch only**, so the
raw path stays bit-for-bit identical. See "Release classification" below.

## Release classification — additive minor, NOT breaking

Every consumer's behavior on upgrade is unchanged, because no existing code
declares `getIdentityComponents()`: the hook returns `undefined`, the branch is
skipped, and the raw comparison executes exactly as today.

Therefore: `feat(core):`, minor bump, **no `BREAKING CHANGE:` entry**.
Versioning is Lerna's — do not hand-edit any `package.json` version field.

Two consequences of keeping it non-breaking:

- **Do not bundle the `NaN` self-equality fix.** A VO wrapping `NaN` is not
  equal to itself today (the raw path falls through `NaN === NaN` and the
  `typeof === 'object'` guard). Adding an unconditional `this === valueObject`
  guard would fix that — and would be a behavior change. Spin it out (see
  Follow-ups) so it can be scheduled deliberately.
- Release notes should carry one line noting that a consumer who already happens
  to declare a member named `getIdentityComponents` and compiles with
  `noImplicitOverride` will see TS4114 at those sites. Unavoidable for any new
  name; a compile-time signal, not a runtime change.

## Acceptance Criteria

1. [ ] Hook, brand symbol and `componentEquals` implemented as designed; with no
       override present, `equals()` is bit-for-bit the current behavior — the
       existing equality corpus passes unmodified. Note that corpus is thin (~6
       equality tests, no nested `Date`/`Map`/`Set`/`NaN` coverage), so it is a
       necessary but not sufficient check.
2. [ ] New tests: partial-identity VO (excluded timestamp → equal despite
       differing raw props); component order/length mismatch; `[]` vs `[]`;
       asymmetric override in BOTH call directions; `undefined`-returning
       override; nested `Date`/`Map`/`Set`/`NaN` inside components; a component
       that is itself a value object (must dispatch to its `equals()`); a
       throwing override (assert it propagates); the non-transitivity triangle
       pinned as a KNOWN ACCEPTED LIMITATION with an explanatory comment;
       cross-subclass with identical components (pins current behavior).
3. [ ] Type fixtures: an override matching the documented signature typechecks;
       negative fixtures for the arrow-property form (TS2425), `private`
       narrowing (TS2415) and non-array returns (TS2416).
4. [ ] JSDoc + README + LLMGUIDE sections matching the code exactly, covering:
       when to use component identity vs full-value equality; the asymmetric
       fallback and its collection-level consequence (non-transitivity in mixed
       populations); the `[]` footgun; throw propagation; that components must
       derive only from frozen/`readonly` state (the constructor deep-freezes
       `value` only, not subclass fields); and that `toString`/`toJSON` stay
       value-based, so equals/hash desync is the consumer's responsibility.
       **Also fix `LLMGUIDE.md:61`**, which still claims raw-`===` equality —
       wrong since VF-023. New code fences must be marked `compile-check`.
5. [ ] A permanent note in README/LLMGUIDE recording that
       `getEqualityComponents` was a 2025 documentation error, was never
       implemented, and will not be — otherwise the phantom regenerates.
6. [ ] CHANGELOG `feat(core):` entry plus a MIGRATION.md section for consumers
       holding dead `getEqualityComponents` overrides: the grep hint
       (`grep -rn "getEqualityComponents" --include="*.ts" src/`), before/after
       snippets, and the instruction to perform the rename as **one atomic
       codemod** — a partially-migrated hierarchy is exactly the mixed
       population that triggers non-transitivity.
7. [ ] Wire the missing API gate for this package: create
       `packages/value-objects/api-extractor.json` (absent — only events,
       contracts and enterprise have one) and append it to root `validate:api`.
       **Do NOT create an api-surface test** —
       `packages/value-objects/tests/api-surface.test.ts` already exists (fact
       corrected 2026-08-09; the earlier "absent, green only via
       `--passWithNoTests`" claim was wrong). It snapshots the named-export
       list, so it is blind to a new `protected` member by design — note that
       limitation rather than papering over it. Report explicitly that a clean
       api-surface diff is not evidence of behavioral safety.
8. [ ] Create the behavioral-BC checklist (LIB-MATURITY-AUDIT item 12) as a real
       artifact and apply it here. It is proposed-only today, and this is the
       third instance of the defect class after VB-003/F-C4 and VP-009 Bug #3.
9. [ ] Patched pre-release build handed to the downstream consumer for a full
       e2e/integration run against their migrated call sites; sign-off recorded
       here before any npm tag. (Under this design it validates the new hook
       rather than gating a mass activation.)
10. [ ] Type-check (`nx run @vytches/ddd-value-objects:type-check`, tsc — not
        just Vitest), full suite, ESM+CJS build, coverage ≥80% on touched files,
        all green.

## Non-goals

- No change to `AggregateRoot`/entity equality — identity-based, and `EntityId`
  does not extend `BaseValueObject` (verified).
- No type/`instanceof` check on the components path. Cross-subclass equality
  stays as it is today (pinned by an existing test); the sanctioned opt-in is a
  string-literal discriminator as the first component.
- No implementation of, shim for, or runtime detection of
  `getEqualityComponents`.
- No auto-warning for "override exists but was dead code" — the MIGRATION grep
  hint covers discovery.

## Follow-ups spawned

Found while wiring AC7. Both are PRE-EXISTING and outside the VF-036 diff —
recorded here rather than as standalone task files, and deliberately not fixed
inside this change-set.

- **`validate:api` is red before this task even starts.** The chain is events →
  contracts → enterprise → value-objects, and the **enterprise** step aborts it
  with an api-extractor internal error, _"Unable to determine semantic
  information for declaration:
  packages/aggregates/src/core/aggregate-root.builder.ts:167:16"_ (the
  destructuring pattern in `for (const { capability, configure } of …)`). Proven
  pre-existing: `packages/enterprise/dist/index.d.ts` is dated 2026-08-08,
  before the VF-036 source change, contains zero occurrences of
  `getIdentityComponents`, and `packages/aggregates` has no working-tree changes
  — yet the enterprise config still fails standalone. The value-objects config
  added by AC7 **passes standalone**, but will never be reached in CI until this
  is fixed. Likely an api-extractor version issue; try a bump before rewriting
  the loop. **Consequence for AC7 that must not be swallowed:** the gate VF-036
  adds is correctly configured and independently green, but the chain it joins
  is not. Say so in the release notes instead of implying the gate is live.
- **Committed api-report baselines are ~4 months stale, and `validate:api`
  mutates them.** `packages/contracts/api-report/ddd-contracts.api.md` and
  `packages/events/api-report/ddd-events.api.md` were last committed 2026-04-16
  (`588c5eb7`). Every config runs api-extractor with `--local`, which
  **overwrites** the committed snapshot in place instead of diffing against it,
  so merely running the verification chain dirties two unrelated packages —
  regenerating contracts produced a 1988-line diff (1106 → 882 lines), i.e.
  real, unreviewed public-surface drift. Two things to decide: run the CI gate
  without `--local` so it compares rather than rewrites, and separately review
  what actually drifted in contracts.

- **`NaN` self-equality on the raw path** — a VO wrapping `NaN` is not equal to
  itself. Genuine bug, genuine breaking change; schedule separately.
- **`LibUtils.deepEqual` shared-reference false negative** —
  `deepEqual({a: s, b: s}, {a: {x:1}, b: {x:1}})` returns `false` because
  `visitedPairs` doubles as a never-popped memo. Pre-existing; VF-036 adds a
  pinning regression test but does not fix it.
- **Uniform type-scoped equality** — consider applying a type check to both
  comparison paths at the next major.
- **`ddd-lint` rule** flagging classes that extend `BaseValueObject` and declare
  a dead `getEqualityComponents` method. Home is `tools/ddd-lint/src/cli.ts`;
  check whether VF-026 already scopes it.

## Links & References

- Approved analysis (authoritative over this file where they differ):
  `project-orchestration/analysis/VF-036-value-object-equality-components.analysis.md`
- Threat model: `docs/security/threat-models/TM-VF-036.md`
- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md` —
  action items 9 (docs-compile CI gate) and 12 (behavioral-BC checklist).
- History: `d1c13027` (phantom introduced in docs), `0ad22d88` (phantom removed
  from docs), `90d393a8` (VF-023 — the deepEqual algorithm this design reuses).
