# Task: behaviors module exports concrete classes instead of interface + factory

## Task Metadata

```yaml
task_id: VB-008
title: Behaviors module export shape violates public-api-pattern (PA5/N2)
type: refactor
priority: medium
complexity: high
estimated_time: unknown — needs its own analysis first
created_by: agent (analysis VB-006-policy-cache-v2, decision D9 / Q3)
created_at: 2026-08-20
status: planned
release_target: needs decision — breaking, so major or a deprecation window
package: '@vytches/ddd-policies'
findings: [F11_poboczne]
```

## Dlaczego

`packages/policies/src/index.ts` exports concrete implementation classes rather
than interfaces plus factory functions, binding consumers to the implementation.
This violates `public-api-pattern` PA5/N2.

It is **not** an isolated slip in one file — the same shape repeats across three
behaviour families in the same module:

- `PolicyCachingBehavior` / `PolicyCachingBehaviorFactory`
- `PolicyRetryBehavior` / `PolicyRetryBehaviorFactory`
- `PolicyTemporalBehavior` / `PolicyTemporalBehaviorBuilder` /
  `PolicyTemporalBehaviorFactory`

Pre-existing, long before VB-006. Explicitly excluded from that task (decision
D9) because folding an API redesign into a focused bugfix would have obscured
both.

## Status: planned, not ready to implement

This needs `/analyze VB-008` before any code is written. At minimum:

- Is the interface+factory shape actually right here, or is the class export
  defensible for a behaviour decorator that consumers subclass?
- Deprecation path: the current exports cannot simply disappear. Which version
  introduces the replacement, which one warns, which one removes?
- Blast radius on consumers — this is a breaking change to the most-used entry
  point of the package.
- Whether all three families move together or one at a time.

## References

- `project-orchestration/analysis/VB-006-policy-cache-v2.analysis.md`
  (F11_poboczne, D9, Q3)
- `.claude/knowledge/patterns/typescript-library/public-api-pattern.md` (PA5,
  N2)
