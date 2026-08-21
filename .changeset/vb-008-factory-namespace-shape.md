---
'@vytches/ddd-policies': patch
---

refactor(policies): behavior factories are now frozen objects, not static-only
classes (VB-008 AC2)

`PolicyCachingBehaviorFactory`, `PolicyRetryBehaviorFactory` and
`PolicyTemporalBehaviorFactory` were classes with only static methods and no
instance state — a "namespace via class" pattern. They are now frozen
(`as const`) plain object exports built from standalone functions.

**This is invisible to every normal call site — there is nothing to migrate.**
Export name and call syntax are identical:

```ts
// Same before and after:
PolicyCachingBehaviorFactory.withTTL(policy, 60000);
PolicyRetryBehaviorFactory.forTransientFailures(policy);
PolicyTemporalBehaviorFactory.businessHours(policy, fallback);
```

The only observable difference is for code that used these purely as classes
rather than as callable namespaces — `new PolicyCachingBehaviorFactory()` or
`instanceof PolicyCachingBehaviorFactory` — which was never a supported usage
(there were no instance members) and now throws/fails type-checking instead. If
you are not doing that, do not change anything.
