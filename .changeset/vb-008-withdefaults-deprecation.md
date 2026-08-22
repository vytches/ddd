---
'@vytches/ddd-policies': minor
---

deprecate(policies): collapse `withDefaults()` into `create(policy, config?)`
(VB-008 AC4)

`PolicyCachingBehavior` and `PolicyRetryBehavior` each had two equally-visible
entry points — `create(policy, config)` and `withDefaults(policy, ttl?)` — with
nothing indicating which one was recommended. `config`/`ttl` is now optional on
`create()`; an omitted config reproduces exactly what `withDefaults()` used to
build.

**Before:**

```ts
const cached = PolicyCachingBehavior.withDefaults(basePolicy);
const retried = PolicyRetryBehavior.withDefaults(basePolicy);
```

**After:**

```ts
const cached = PolicyCachingBehavior.create(basePolicy);
const retried = PolicyRetryBehavior.create(basePolicy);
```

`withDefaults()` still works — it is `@deprecated` and now a thin wrapper around
`create()` that logs one `console.warn` per class on first call, naming the
replacement. It will be removed in the following minor release.
`PolicyRetryBehavior.withDefaults(policy, maxAttempts?)` keeps its existing
parameter; only the caching family's `ttl` example differs above.
`PolicyTemporalBehavior` is unaffected — it only ever had `create()`.
