# Task: CachedPolicy — replace 32-bit djb2 hash with a safer function

## Task Metadata

```yaml
task_id: VS-005
title: "policies: CachedPolicy.hashString — replace djb2 with larger hash space or crypto"
type: bug
priority: high
complexity: simple
estimated_time: 1.5h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: planned
security_finding: SEC-POLICIES-001
dread_score: 9
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Policies
patterns:
  - Specification Pattern
  - Caching
```

## Business Context

### Why This Task Exists

`CachedPolicy.hashString()` uses a 32-bit djb2 hash to generate cache keys.
The 32-bit space (~4.3 billion values) produces collisions at ~65k unique keys
(Birthday paradox). A collision means entity A gets the policy result of entity B.

```typescript
// cached-policy.ts:268-275
private hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
```

In authentication/authorisation domains (e.g. `BlacklistPolicy`, `TierPolicy`)
a collision can mean entity X receives the policy result for entity Y — a potential
elevation of privilege.

### Expected Business Value

- [ ] Zero cache key collisions for typical volumes (millions of entities)
- [ ] Correct policy result isolation per entity
- [ ] Optional `cacheKeyFn` for consumers with custom requirements

### Success Metrics

- Hash space ≥ 128 bits (crypto.createHash)
- Or full serialised key without hashing

## Technical Context

### Current State

```typescript
// Cache key:
return `${namespace}:${contextKey}:${this.hashString(entityKey)}`;
// hashString returns 32-bit hex → collisions at ~65k keys
```

### Desired State

Option A (recommended): use `crypto.createHash('sha256')` — Node.js built-in, zero deps:

```typescript
import { createHash } from 'node:crypto';

private hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex').slice(0, 32);
}
```

Option B: use the full string as a cache key (no hashing) — higher Map memory
usage but zero collisions and zero deps.

Option C: add a `cacheKeyFn?: (entity: unknown) => string` option in `CachedPolicyConfig`
letting consumers control key generation.

**Recommendation: Option A + Option C (cacheKeyFn)**

### Technical Constraints

- `node:crypto` is a built-in since Node.js 12+ — zero new dependencies
- Cache keys must be deterministic (same input → same output)
- Changing the hash function invalidates the in-memory cache on restart (acceptable)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `hashString` uses `crypto.createHash('sha256')` or equivalent with ≥ 128-bit space
- [ ] Optional `cacheKeyFn?: (entity: unknown, context: string) => string` in `CachedPolicyConfig`
- [ ] When `cacheKeyFn` is provided it replaces the default hashing

### Non-Functional Requirements

- [ ] Zero new npm dependencies
- [ ] Backward-compatible API (implementation change, not interface change)
- [ ] Collision test: 10k different objects → 0 collisions

### Definition of Done

- [ ] `hashString` updated
- [ ] `cacheKeyFn` option added to `CachedPolicyConfig`
- [ ] Tests: no collisions, determinism, custom `cacheKeyFn`
- [ ] SEC-POLICIES-001 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: verify backward-compat public API
    deliverables: PASS/VETO
```

## Implementation Plan

### Phase 1: Hash replacement

- **Agent**: library-expert
- **Tasks**:
  - [ ] Replace djb2 with `crypto.createHash('sha256')`
  - [ ] Add optional `cacheKeyFn?` to `CachedPolicyConfig`
  - [ ] Update `CachedPolicyConfig` type in barrel
- **Output**: `cached-policy.ts`

### Phase 2: Tests

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: 1000 different JSON objects → 1000 unique keys
  - [ ] Test: same object → same key (determinism)
  - [ ] Test: custom `cacheKeyFn` is used instead of default hashing
- **Output**: tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-26
```

### Activity Log

| Date       | Agent     | Action           | Result           |
| ---------- | --------- | ---------------- | ---------------- |
| 2026-05-26 | sec-audit | Finding detected | SEC-POLICIES-001 |
| 2026-05-26 | human     | Task created     | VS-005 planned   |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-policies'
    files:
      - src/decorators/cached-policy.ts
      - tests/decorators/cached-policy.test.ts
```

## Risk Assessment

### Technical Risks

| Risk                           | Probability | Impact | Mitigation                            |
| ------------------------------ | ----------- | ------ | ------------------------------------- |
| Cache invalidation on deploy   | Certain     | Low    | Cache is in-memory; restart = cleared |
| crypto unavailable in browser  | Low         | Low    | Library targets Node.js/NestJS        |

## Testing Strategy

### Unit Tests

- [ ] 1000 different serialised entities → 1000 unique hashes
- [ ] Determinism: `hashString("abc") === hashString("abc")`
- [ ] `cacheKeyFn` is called instead of default hash
- [ ] `cacheKeyFn` output is used as the cache key

## Links & References

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-POLICIES-001
- Node.js crypto docs: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
