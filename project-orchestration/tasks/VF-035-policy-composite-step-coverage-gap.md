# Task: Composite policy evaluation throws instead of returning Result for real step-type combinations

## Task Metadata

```yaml
task_id: VF-035
title:
  'policies: BuiltCompositePolicy/GroupCompositePolicy.createPolicyFromStep only
  handle 2-5 of 7 possible step types — real public builder methods produce step
  types that throw at check() time'
type: bug
priority: high
complexity: medium
estimated_time: 8h
created_by: 'VF-026 triage (research agent, 2026-07-10)'
created_at: 2026-07-10
status: backlog
release_target:
  pre-first-public-publish (public policies API core evaluation path)
package: "'@vytches/ddd-policies'"
findings: []
```

## Why

Discovered as a side effect of VF-026's `ddd-002` triage pass (not the task's
own scope — escalated separately). Two independent composite/ multi-step policy
evaluators only handle a subset of the step-type union their own sibling builder
methods can legitimately produce, so real, documented public API usage throws
instead of returning `Result.fail(...)` at policy-check time. This is a genuine
production bug, not dead code — and has zero test coverage on the affected paths
(`shouldSatisfyAny()` has no test anywhere in the repo).

1. **`packages/policies/src/builders/policy-builder.ts:347`**
   (`PolicyBuilder.createPolicyFromStep`, used when a policy has exactly ONE
   step): `PolicyBuildStep.type` has 7 members
   (`specification|async-specification|predicate|async-predicate|rules| group-or|...`),
   this switch handles 5 — **`group-or` is missing**. The public method
   `shouldSatisfyAny(...)` constructs exactly a `group-or` step. If it's used as
   the sole step, `.build()` calls this switch and throws for a legitimate,
   intended usage — `shouldSatisfyAny()` used alone is simply broken today.
2. **`packages/policies/src/builders/policy-builder.ts:538`**
   (`BuiltCompositePolicy.createPolicyFromStep`, used whenever
   `steps.length > 1`, i.e. ANY composite/multi-step policy): a _second,
   separate_ implementation of the same switch, handling only `specification`
   and `predicate` — **2 of 7 member types**. Any composite policy that mixes in
   `.mustAsync()`, `.mustSatisfyAsync()`, `.mustSatisfyRules()`, or
   `.shouldSatisfyAny()` alongside any other step will throw at `check()`-time
   (runtime, not build-time) for that step.
3. **`packages/policies/src/builders/policy-group.ts:330`**
   (`GroupCompositePolicy.createPolicyFromStep`, `steps.length > 1`): handles
   only `specification` and `predicate` out of `PolicyGroupStep`'s 3 members —
   **omits `async-specification`**, even though `PolicyGroup.mustAsync()` is a
   real public method that constructs exactly that type.
   `.must(spec).mustAsync(asyncSpec).getPolicy()` → composite mode → `check()`
   throws.

Root cause pattern common to all three: `createPolicyFromStep` was duplicated
(once per single-step fast path, once per composite path) rather than shared,
and the composite copies were never updated when new step types
(`async-specification`, `async-predicate`, `rules`, `group-or`) were added to
the builder's public surface.

## Acceptance Criteria

1. [ ] `PolicyBuilder.createPolicyFromStep` (single-step path,
       policy-builder.ts:347) handles all 7 `PolicyBuildStep` member types,
       including `group-or`.
2. [ ] `BuiltCompositePolicy.createPolicyFromStep` (multi-step path,
       policy-builder.ts:538) handles all 7 `PolicyBuildStep` member types.
       Prefer extracting ONE shared step-evaluation function used by both the
       single-step and composite paths (root-causing the duplication instead of
       patching both switches independently) — confirm this is feasible given
       the two call sites' surrounding context; if not feasible cleanly, keep
       them separate but add a compile-time exhaustiveness check (e.g. a
       `never`-typed default case) so a future new step type fails typecheck
       instead of silently reproducing this bug.
3. [ ] `GroupCompositePolicy.createPolicyFromStep` (policy-group.ts:330) handles
       all 3 `PolicyGroupStep` member types, including `async-specification`.
4. [ ] Add a compile-time exhaustiveness guard (TypeScript `never` check in the
       `default` branch of each switch) to all three functions, so adding a new
       step-type member to either union without updating all evaluators becomes
       a **typecheck failure**, not a silent runtime gap — this is the actual
       root cause and must be prevented from recurring.
5. [ ] Tests: `shouldSatisfyAny()` used as the sole step (AC1); a composite
       policy combining `.must(spec)` with `.mustAsync()`,
       `.mustSatisfyAsync()`, `.mustSatisfyRules()`, and `.shouldSatisfyAny()`
       each in turn, verifying `check()` returns `Result` (never throws) for
       every combination (AC2); `PolicyGroup.must().mustAsync().getPolicy()`
       composite mode returning `Result` correctly (AC3).
6. [ ] Regression: full `@vytches/ddd-policies` test suite green; confirm no
       existing behavior for `specification`/`predicate` steps changed.
7. [ ] `shouldSatisfyAny()` returns `IPolicyStepBuilder<T>` instead of
       `IPolicyBuilder<T>` (interface + implementation), enabling
       `.withCode()/.withMessage()/.withSeverity()` chaining on the `group-or`
       step — as a SEPARATE commit within this task (API adjustment, not part of
       the bug-fix commit). Verified non-breaking: every documented usage
       (README, LLMGUIDE, ADR-0012) chains `.build()` directly, which the step
       builder exposes; the `.shouldSatisfyAny().must()` shape exists nowhere.
       Group-or tests (AC5) are written against the NEW signature. Optionality
       (`isRequired: false` for group-or) stays out of scope. Decision trail:
       VF-035.analysis.md frontmatter Q4 (2026-07-11).

## Out of scope

- Any change to the step-type unions themselves (`PolicyBuildStep`,
  `PolicyGroupStep`) — this task fixes evaluators to match the EXISTING public
  surface, not redesign it.
- `conditional-policy-builder.ts:177,249`'s dead `'predicate'` union member
  (unreachable via current public API) — separate, low-priority cleanup, noted
  in VF-026's triage as a (C) borderline item, not this bug class.
- `base-business-policy.ts`'s "not yet implemented" placeholder throws
  (`.group()`, `.when().then()`) — already tracked as VT-006 F-M10, a different
  defect (incomplete API surface, not a step-type coverage gap).

## References

- Discovered during: VF-026's `ddd-002` triage pass (research agent, 2026-07-10)
  — see
  `project-orchestration/completed-tasks/VF-026-ddd-lint-anti-pattern-rules.md`,
  "Activity / Notes" section, "Two newly-discovered real production bugs".
- `project-orchestration/KANBAN.md` (2026-07-10 consolidated shipped banner) —
  flagged as "not yet tasked" until this file.
