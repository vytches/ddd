---
'@vytches/ddd-policies': minor
'@vytches/ddd': minor
---

feat(policies): export `PolicyCacheMetrics` (VB-008 AC3)

`PolicyCachingBehavior.getCacheMetrics()` returned
`ReturnType<PolicyCache['getMetrics']>` — an anonymous type derived from
`PolicyCache`, an internal, unexported class — so consumers had no way to name
the shape of what they got back (a local variable, a function parameter, a
stored field).

**Before** — no way to name the return type:

```ts
// no exported type to reach for; had to inline the shape or use `typeof`
function logMetrics(
  m: ReturnType<PolicyCachingBehavior<unknown>['getCacheMetrics']>
) {
  console.log(m.hits, m.misses, m.evictions, m.entries);
}
```

**After** — `PolicyCacheMetrics` is exported from `@vytches/ddd-policies` (and
re-exported from `@vytches/ddd`):

```ts
import type { PolicyCacheMetrics } from '@vytches/ddd-policies';

function logMetrics(m: PolicyCacheMetrics) {
  console.log(m.hits, m.misses, m.evictions, m.entries);
}
```

`getCacheMetrics()`'s return type is now `PolicyCacheMetrics` explicitly (the
runtime shape is unchanged: `{ hits, misses, evictions, entries }`, all
`readonly number`). Purely additive — no existing code needs to change.
