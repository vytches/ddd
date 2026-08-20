# Task: BaseContainerAdapter Resolve Optimization

## Task Metadata

```yaml
task_id: VP-006c
title: BaseContainerAdapter tryResolve hook + Set-based cycle stack
type: optimization
priority: normal
complexity: medium
estimated_time: 6h
created_by: VP-006b analysis follow-up (OQ-3/D-3, approved 2026-07-11)
created_at: 2026-07-11
status: done
completed_at: 2026-08-20
release_target: post-v0.26
parent: VP-006-di-container-performance
package: '@vytches/ddd-di'
```

## Why this task exists

VP-006b analysis
(`project-orchestration/analysis/VP-006b-nestjs-adapter-performance.analysis.md`,
OQ-3 / D-3) found a hot-path cost in the shared base class:
`BaseContainerAdapter.resolveDependency()` (packages/di) performs
`isRegistered()` followed by `resolve()` — a DOUBLE lookup per constructor
parameter for every adapter built on the base class. Through a framework-backed
adapter this can mean two framework lookups (or one wasted throw+catch) per
parameter. Additionally, the base cycle-detection stack uses O(n)
`Array.includes` per push.

VP-006b fixed this ADAPTER-LOCALLY for `NestJSContainerAdapter` only (an
`override resolveDependency()` doing a single registry-first pass), because a
base-class change affects ALL adapters and needs its own backward-compat review
— outside VP-006b's package boundary (`package-boundary-pattern`). OQ-3's answer
confirmed this follow-up: "Follow-up task VP-006c (BaseContainerAdapter:
tryResolve hook + Set-based cycle stack, own backward-compat review) is
CONFIRMED."

## Scope

`packages/di/src/**` (`BaseContainerAdapter` and its tests):

1. **`tryResolve` hook**: introduce a protected miss-tolerant resolution hook on
   `BaseContainerAdapter` so `resolveDependency()` becomes a SINGLE pass (no
   `isRegistered()` + `resolve()` double lookup). Default implementation must
   preserve current behavior for subclasses that only override `resolve()`;
   subclasses may override `tryResolve` for a cheaper native path.
2. **Set-based cycle stack**: replace the O(n) `Array.includes` resolution stack
   membership check with a `Set`-based check, while preserving the ordered chain
   needed for `CircularDependencyError`'s full-chain message (e.g. keep the
   array for ordering, add a companion `Set` for membership — or an
   insertion-ordered structure).
3. **Backward-compat review (own pass)**: this touches EVERY adapter
   (`SimpleContainer` consumers, `NestJSContainerAdapter`, InversifyJS /
   TSyringe adapters, custom adapters documented in
   `packages/di/FRAMEWORK-ADAPTERS.md`). The protected surface of
   `BaseContainerAdapter` is public API for adapter authors — additions must be
   optional, existing override points must keep their signatures and error
   contracts (`ContainerServiceNotFoundError` with owner context,
   `CircularDependencyError` with full chain, timing unchanged).
4. **Follow-up cleanup opportunity**: once the base has a single-pass path,
   evaluate whether `NestJSContainerAdapter`'s local `resolveDependency`
   override (VP-006b / D-3) can be reduced to a `tryResolve` implementation — in
   `@vytches/ddd-nestjs`, as its own change with its own tests (do not bundle
   silently).

## Acceptance Criteria

1. [x] `resolveDependency()` performs a single resolution pass (no
       `isRegistered()` + `resolve()` double lookup) via a `tryResolve` hook;
       default behavior for existing subclasses unchanged.
2. [x] Cycle detection membership check is O(1) (Set-based) while
       `CircularDependencyError` still reports the full ordered chain.
3. [x] Backward-compat review documented: no breaking change to the
       `BaseContainerAdapter` protected/public surface; all existing adapter
       tests green without modification (any deliberate test change must be
       justified and CHANGELOG-noted).
4. [x] Error contract regression-tested: `ContainerServiceNotFoundError`
       (owner-scoped), `CircularDependencyError` (full chain),
       `InvalidRegistrationError` — types, messages, and timing unchanged.
5. [x] CHANGELOG entry for `@vytches/ddd-di` (perf; behavior change only if the
       compat review surfaces one — then escalate before merging).

## Out of scope

- `@vytches/ddd-nestjs` changes (the adapter-local override shipped in VP-006b
  stays as-is until the cleanup in Scope #4 is separately evaluated).
- Any `SimpleContainer` / `ServiceLocator` semantics changes (VP-006 territory).

## Dependencies / sequencing

- After VP-006b merges (its adapter-local override and benchmarks provide the
  reference behavior and a measurement harness to compare against).

## References

- Analysis:
  `project-orchestration/analysis/VP-006b-nestjs-adapter-performance.analysis.md`
  (OQ-3, D-3)
- Sibling task:
  `project-orchestration/tasks/VP-006b-nestjs-adapter-performance.md`
- Parent task: `project-orchestration/tasks/VP-006-di-container-performance.md`
- Pattern: `.claude/knowledge/patterns/backward-compatibility-pattern.md`,
  `.claude/knowledge/patterns/package-boundary-pattern.md`

## Outcome (2026-08-20)

**1. `tryResolve` hook.** `resolveDependency()` is now a single pass. The
default `tryResolve()` is `isRegistered() ? resolve() : NOT_REGISTERED`, i.e.
byte-for-byte the previous behaviour, so an adapter overriding only `resolve()`
sees no change. An adapter with a native miss-tolerant lookup overrides the hook
and drops to one framework call per constructor parameter.

**2. Set-based cycle stack.** `Array.includes` (O(n) per parameter) replaced by
a companion `Set` for membership; the array stays for ordering because
`CircularDependencyError` reports the full chain, which a Set cannot express.
Both are mutated together — the test that resolves the same token twice in
sequence exists specifically to catch a Set that is added to but not deleted
from.

**3. Backward-compat review (AC3).**

- **`NOT_REGISTERED` is new public API.** A sentinel, not `undefined`/`null`,
  because a container may legitimately hold a registration whose value _is_
  `undefined` — conflating the two would turn a working registration into a
  `ContainerServiceNotFoundError`. Exported from the package barrel, since an
  adapter author cannot implement the hook without it. Added to the api-surface
  snapshot.
- **No existing override points changed signature.** `resolve`, `isRegistered`,
  `register`, `registerFactory`, `registerInstance`, `getServices` are all
  untouched; `tryResolve` is additive and optional.
- **Only one subclass exists in-repo**: `NestJSContainerAdapter`. It is
  deliberately **not** touched — VP-006c's scope is `packages/di/src/**`, and
  that adapter carries its own `resolveDependency()` override from VP-006b with
  a local `NOT_RESOLVED` sentinel and a local resolution chain (the base stack
  was private). It keeps working unchanged.
- **Follow-up worth filing** (not done here): now that the base class offers the
  same single-pass mechanism, `NestJSContainerAdapter`'s override and its
  duplicate sentinel could be deleted in favour of a `tryResolve()` override —
  removing a second, divergent copy of the cycle-detection chain. That is an
  edit to `packages/nestjs`, outside this task's package boundary.

`FRAMEWORK-ADAPTERS.md` documents the hook with the two rules an implementer
must not get wrong (return the sentinel, never throw; leave
`ContainerServiceNotFoundError` to the base class).

Gates (`--skip-nx-cache`): di 140/140 (7 new), tsc clean, lint 0 errors, build
clean; full repo 2670 passed / 7 skipped / 11 todo.
