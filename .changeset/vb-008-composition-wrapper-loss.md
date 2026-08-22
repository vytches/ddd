---
'@vytches/ddd-policies': patch
---

fix(policies): composing a cached/retried/temporal policy no longer drops the
wrapper (VB-008 AC1)

`and()`, `or()` and `when()` on `PolicyCachingBehavior`, `PolicyRetryBehavior`
and `PolicyTemporalBehavior` delegated straight to the wrapped inner/base
policy, silently discarding the decorator from the resulting composite. `not()`
already re-wrapped correctly — that asymmetry is why this is a bug fix, not a
contract change: the composed policy is still an `IBusinessPolicy<T>`, method
signatures are unchanged, only the runtime behavior of the object you get back
is corrected.

**Before** — composing a cached policy silently lost caching:

```ts
const cached = PolicyCachingBehavior.create(basePolicy, { ttl: 60000 });
const composite = cached.and(otherPolicy);
// composite evaluated basePolicy on every check(), uncached
```

**After** — the composite still routes through the wrapper:

```ts
const cached = PolicyCachingBehavior.create(basePolicy, { ttl: 60000 });
const composite = cached.and(otherPolicy);
// composite's left branch is still cached; repeated identical requests
// hit the cache instead of re-evaluating basePolicy
```

Same fix applied to `PolicyRetryBehavior` (retry semantics survive composition)
and `PolicyTemporalBehavior` (time-window semantics survive composition). No
migration needed unless your code depended on the buggy behavior — if you were
composing a cached/retried/temporal policy and got unexpected cache misses,
missing retries, or ignored time windows after `and()`/`or()`/`when()`, that is
what this fixes.

### Side effect: composed policy ids now carry the wrapper prefix

Preserving the wrapper changes the `id` of the composite, because the id is
derived from the policy the composition actually wraps:

```ts
const cached = PolicyCachingBehavior.create(basePolicy, { ttl: 60000 });
const composite = cached.and(otherPolicy);

// before: 'basePolicy_AND_otherPolicy'
// after:  'cached_basePolicy_AND_otherPolicy'
```

This is a consequence of the fix, not a separate decision: the old id claimed
the composite was built from the raw policy, which was true only because the
wrapper had been dropped. The new id describes what the object actually is.

**Migration.** Nothing to do unless you match on these strings — logging,
metrics labels, audit records, or any registry keyed by policy id. If you do,
either update the expected values or derive them from `policy.id` at runtime
rather than hard-coding them. Policy ids are diagnostic identifiers, not a
stable serialization format, so they are not covered by the package's
compatibility guarantees.
