# Task: policy behaviours — fix silent wrapper drop, tidy the factory shape, close the teaching gap

## Task Metadata

```yaml
task_id: VB-008
title:
  'fix(policies): preserve behaviour wrapper across composition, plus export
  shape and teaching-surface cleanup'
type: fix # was: refactor — reclassified, the headline item is a shipped correctness defect
priority: high # was: medium — promoted because AC1 is a live defect in seven published releases
complexity: medium # was: high — the API redesign the ticket asked for was rejected as misapplied
estimated_time: 6h
created_by: agent (analysis VB-006-policy-cache-v2, decision D9 / Q3)
created_at: 2026-08-20
rescoped_at: 2026-08-21 # after /analyze VB-008 + four-agent review round; see analysis artefact
status: ready
release_target:
  next 0.x minor — ships in the imminent release, breaking, with migration notes
package: '@vytches/ddd-policies'
analysis: project-orchestration/analysis/VB-008-behaviors-export-shape.analysis.md
findings: [F11 (VB-006), F11/F12/F15/F18/F19/F20 (this analysis)]
```

## Why this task no longer says what it used to

The original ticket claimed the three behaviour families violate
`public-api-pattern` PA5/N2 by exporting concrete classes instead of interfaces
plus factories. **Analysis rejected that premise.** All three classes already
implement the publicly exported `IBusinessPolicy<T>`, concrete-class export is
the deliberate convention across all 19 packages, and ADR-0012 records the
factory methods as an accepted mitigation. The fluent builder was flagged by
mistake.

What the analysis found instead is a shipped correctness defect the ticket never
mentioned, plus a much smaller version of the original complaint. The full
reasoning, all 23 verified facts and 13 decisions live in the analysis artefact
(`status: approved`, all seven blocking questions answered). **Read it before
implementing — it is the binding spec, this file is the summary.**

## Acceptance criteria

### AC1 — composition must preserve the behaviour wrapper (decision D7) — DO THIS FIRST

`and()`, `or()` and `when()` delegate straight to the inner/base policy and
silently discard the decorator, in **all three** families:

- `cached-policy.ts:593` / `:597` / `:605`
- `retry-policy.ts:352` / `:356` / `:364`
- `temporal-policy.ts:299` / `:303` / `:311`

`not()` already re-wraps correctly (`:601` / `:360` / `:307`) — that asymmetry
is the evidence this is an oversight, not a designed contract, and the correct
pattern is already in the file. Composing a cached policy must return a
composite that is still cached; same for retry and temporal.

Existing tests are false assurance and must be **replaced**, not supplemented —
the only composition assertions today are
`expect(() => policy.and(other)).not.toThrow()` at
`cached-policy.test.ts:359-360`, `retry-policy.test.ts:446-447`,
`temporal-policy.test.ts:481-482`. A real test asserts the side effect: compose,
evaluate twice against an inner policy with a call counter, assert the counter
proves the wrapper survived.

### AC2 — factory export shape, invisible to callers (decision D2)

Convert the three static-only classes to frozen object exports, keeping the
export name and the call syntax identical:

```ts
export const PolicyCachingBehaviorFactory = {
  withTTL,
  forExpensivePolicy,
  withCustomKey,
} as const;
```

Same for `PolicyRetryBehaviorFactory`
(`forTransientFailures`/`forExternalServices`/`withCustomLogic`) and
`PolicyTemporalBehaviorFactory` (`businessHours`/`weekendAware`/`holidayAware` —
**three methods, not four**).

Hard constraints:

- `from()` is a static of `PolicyTemporalBehaviorBuilder`, **not** of the
  factory. Do not touch it. (The earlier spec got this wrong.)
- `create()` and `withDefaults()` are statics on the **behaviour classes**. Not
  part of this conversion — see AC4.
- Do not touch `PolicyTemporalBehaviorBuilder` at all (decision D5).
- Do not introduce capability interfaces (`ICacheablePolicy` and friends) —
  explicitly rejected, decision D4.
- `EventDrivenPolicyFactory` is stateful (constructor + instance methods). If a
  name-based sweep tempts you, **skip it**.

### AC3 — name the cache metrics type (decision D4)

`getCacheMetrics()` returns `ReturnType<PolicyCache['getMetrics']>`, derived
from an unexported internal class, so consumers cannot name what they receive.
Export an interface and use it as the return type:

```ts
export interface PolicyCacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly entries: number;
}
```

Retry's equivalent (`getRetryMetrics(): RetryMetrics`) is already correct —
leave it alone.

### AC4 — one entry point, not two (decision D11)

Collapse `create()` and `withDefaults()` into `create(policy, config?)`, where
an omitted config reproduces today's `withDefaults()` behaviour. Applies to
caching and retry; temporal has only `create()`.

Unlike AC2 this **is** visible to callers, so `withDefaults()` stays as a thin
deprecated wrapper: JSDoc naming the replacement and the removal version (PA7 /
BC8) plus a runtime `console.warn` fired once per class on first call (PA6),
removed in the following minor.

### AC5 — teaching surface and a gate that keeps it honest (decision D12)

1. One working example per preset family — there are **zero** today; all three
   existing examples bypass the factories entirely, which is why the docs
   rotted.
2. An example that reads cache metrics, so AC3's new type has a compiled
   consumer from day one.
3. An example that composes two enriched policies — wrapping order changes
   failure semantics and nothing currently documents it.
4. Fix the two confirmed phantom APIs: `README.md:385` calls
   `PolicyTemporalBehaviorFactory.forBusinessHours()` (real name:
   `businessHours()`); `LLMGUIDE.md:432` calls
   `PolicyCachingBehaviorFactory.create()` (does not exist).
5. CI grep gate: zero references to retired symbol names across `README.md`,
   `LLMGUIDE.md` and `examples/policies/`. Cheaper and harder to skip than
   `docs-compile-gate`, which is opt-in per fence and therefore silently skipped
   both defects above.

### AC6 — release notes carry the migration, not just the fact

Per-change entries stating what changed **and how to fix it**, following the
`globalPolicyEventBus` / VF-024 precedent (inline barrel comment plus
CHANGELOG). Separate entries per change so the notes stay legible — AC1 is a
behavioural fix, AC4 is a deprecation, AC2 is invisible. Versions go through the
release tooling; never hand-edit `package.json` version fields.

### AC7 — gates

- `nx run @vytches/ddd-policies:type-check` (tsc) — Vitest green is not
  sufficient in this repo, esbuild strips types without checking them.
- `nx run @vytches/ddd-policies:test` and `:lint`.
- `tests/api-surface.test.ts` snapshot: AC2 keeps every export name, so it must
  stay green **without** `-u`. AC3/AC4 add names — updating the snapshot there
  is a deliberate act, never automatic.
- `packages/enterprise/src/index.ts:235-241` must move in lockstep with the
  policies barrel — the meta-package is the only surface api-extractor watches.

## Out of scope — do not drift into these

| Item                                                                                          | Where it goes                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Interface + factory conversion of the three behaviour classes                                 | rejected outright (D1)                       |
| `PolicyTemporalBehaviorBuilder`                                                               | untouched (D5)                               |
| Narrowing the shared `public-api-pattern` rule card                                           | separate task, owner outside this repo (D6b) |
| api-extractor coverage for this package                                                       | separate task (D9)                           |
| `src/decorators/` directory still named after the pre-v2.1 term; `defineProperty` id override | separate low chore (D10)                     |
| Repo-wide phantom-API sweep                                                                   | existing VD-008, runs **after** this task    |

## References

- `project-orchestration/analysis/VB-008-behaviors-export-shape.analysis.md` —
  binding spec: 23 verified facts, 13 decisions, seven answered questions.
- `project-orchestration/analysis/VB-006-policy-cache-v2.analysis.md` — origin
  (F11, D9, Q3).
- `.claude/knowledge/patterns/typescript-library/public-api-pattern.md` (PA5/N2,
  PA6/PA7) and `backward-compatibility-pattern.md` (BC1, BC4, BC8).
