# Task: Replace NestJSContainerAdapter's resolveDependency override with tryResolve

## Task Metadata

```yaml
task_id: VP-006d
title:
  'nestjs/di: delete the VP-006b resolveDependency override in favour of the
  VP-006c tryResolve hook, removing a second copy of the cycle-detection chain'
type: refactor
priority: normal
complexity: low
estimated_time: 2h
created_by: VP-006c outcome (2026-08-20)
created_at: 2026-08-21
status: done
completed_at: 2026-08-21
release_target:
  pre-first-publish preferred (behaviour-neutral, but it removes a divergence
  risk that grows with every future base-class change)
package: "'@vytches/ddd-nestjs'"
findings: [VP-006c outcome]
```

## Why

VP-006b fixed the double-lookup hot path **adapter-locally**, because changing
the base class needed its own backward-compat review. So
`NestJSContainerAdapter` carries:

- its own `resolveDependency()` override,
- its own `NOT_RESOLVED` sentinel (duplicating `NOT_REGISTERED`),
- its own `resolutionChain` array, because the base class's stack is private.

VP-006c did that review and generalised the fix: `BaseContainerAdapter` now
offers a `tryResolve()` hook and its own Set-backed cycle detection. The
adapter-local copy is therefore redundant — and worse than redundant, it is a
**second implementation of cycle detection** that no longer shares code with the
one every other adapter uses. Any future change to `CircularDependencyError`
semantics, or to the resolution chain, has to be made twice and will silently
diverge the first time someone forgets.

## Acceptance Criteria

1. [x] `NestJSContainerAdapter.resolveDependency()` override deleted; the
       adapter overrides `tryResolve()` instead, keeping the registry-first
       then-ModuleRef lookup order VP-006b established.
2. [x] The local `NOT_RESOLVED` sentinel and `resolutionChain` array are gone —
       the base class owns both concerns. `resolveOrMiss()` either becomes the
       `tryResolve()` body or is deleted.
3. [x] Behaviour preserved: still ONE lookup per constructor parameter (no
       regression to the two-pass path VP-006b removed);
       `ContainerServiceNotFoundError` still carries the owning service as
       context; `CircularDependencyError` still reports the full chain.
4. [x] The dev-only dual-registration divergence guard (VP-006b OQ-4,
       `divergenceProbedTokens`) keeps working, or its removal is justified.
5. [x] Regression: existing `nestjs-container.adapter.test.ts` suite stays
       green, including the VF-030 D5/D6/D7 lifetime-parity and error-type
       tests.
6. [x] `nx run @vytches/ddd-nestjs:type-check` clean (Vitest alone is not
       sufficient for this package).

## Out of scope

- Any change to `BaseContainerAdapter` itself — VP-006c shipped it.
- Performance benchmarking. VP-006b established the numbers; this is a
  de-duplication with no intended change to them.

## References

- `completed-tasks/VP-006c-base-adapter-resolve-optimization.md` — the follow-up
  note
- `completed-tasks/VP-006b-nestjs-adapter-performance.md` + its analysis — the
  lookup order and the OQ-4 divergence guard

## Outcome (2026-08-21)

All six criteria met. The `resolveDependency()` override, the local
`NOT_RESOLVED` sentinel and the private `resolutionChain` are gone;
`resolveOrMiss()` became a `tryResolve()` override, so cycle detection now lives
in exactly one place for every adapter.

**AC3 verified rather than assumed.** Two things could have regressed silently:

- _Error context._ The override used `this.getTokenKey(ownerToken)` while the
  base uses `describeToken(ownerToken)`. Checked before deleting:
  `getTokenKey()` is a thin delegate to `describeToken()`, so
  `ContainerServiceNotFoundError` messages are byte-identical.
- _The VP-006b optimisation itself._ Nothing pinned "one lookup per constructor
  parameter", so removing the override could have quietly reverted to the base
  class's two-pass default with every test still green. Added a test that spies
  on `isRegistered()` and asserts it is never called during a dependency
  resolution — that is the whole point of the hook, and it now has a guard.

**AC4** — the dual-registration divergence guard (`divergenceProbedTokens`) sits
in `resolveInternal()`/`warnOnDualRegistrationDivergence()`, untouched by this
change and still exercised by its existing suite.

**The VF-040 gate earned itself back within the hour.** Running it after this
refactor flagged the surface change immediately:

```
-    protected resolveDependency<T>(param: ServiceToken<T>, ownerToken: ServiceToken): T;
+    protected tryResolve<T>(token: ServiceToken<T>): T | typeof NOT_REGISTERED;
```

Worth noting _what_ it caught: a change to the **protected** surface. That is
not incidental — the protected members of an adapter base class are public API
for adapter authors (`FRAMEWORK-ADAPTERS.md`), and this is precisely the kind of
change that reads as internal and is not. Baseline regenerated through
`validate:api:local` per the VF-037 split; the delta is three lines, all of them
this task's intent.

Gates (`--skip-nx-cache`): nestjs 274/274 (3 new), tsc clean, lint 0 errors,
build clean, `validate:api` green across five packages; full repo 2673 passed.
