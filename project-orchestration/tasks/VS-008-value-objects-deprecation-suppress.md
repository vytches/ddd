# Task: EntityIdFactory — option to suppress `console.warn` deprecation

## Task Metadata

```yaml
task_id: VS-008
title: "value-objects: EntityIdFactory deprecation warn — env-var suppression option"
type: improvement
priority: low
complexity: simple
estimated_time: 0.5h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: planned
security_finding: SEC-VALUEOBJECTS-001
dread_score: 4
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Value Objects
patterns:
  - Deprecation Pattern
```

## Business Context

### Why This Task Exists

`EntityIdFactory` emits `console.warn` (once per process) when deprecated methods
are called. The behaviour is intentional and documented — but some consumers:

1. Cannot migrate quickly to the new API (legacy codebase)
2. Do not want `console.warn` in production where every output is monitored
3. Use test frameworks that treat `console.warn` as a test failure

They need a way to silence the warning without removing the deprecation itself.

### Expected Business Value

- [ ] Consumers who knowingly use the deprecated API can suppress the warning
- [ ] Test suites do not fail due to `console.warn` from the library
- [ ] Nothing changes for consumers who do not use the deprecated API

### Success Metrics

- `VYTCHES_SUPPRESS_DEPRECATION_WARNINGS=1` → no console.warn output
- Default: warning still displayed

## Technical Context

### Current State

```typescript
// id.value-object.ts:34
// eslint-disable-next-line no-console
console.warn(
  `[@vytches/ddd-value-objects] EntityIdFactory.${method}() is deprecated...`
);
```

No suppression mechanism exists.

### Desired State

```typescript
function warnEntityIdFactoryDeprecation(method: string, replacement: string): void {
  if (_entityIdFactoryWarned.has(method)) return;
  if (process.env['VYTCHES_SUPPRESS_DEPRECATION_WARNINGS'] === '1') return;
  _entityIdFactoryWarned.add(method);
  // eslint-disable-next-line no-console
  console.warn(`[@vytches/ddd-value-objects] EntityIdFactory.${method}() is deprecated...`);
}
```

### Technical Constraints

- `process.env` is available in Node.js — library targets Node.js
- Env var checked at call time (not at module load) — allows setting it before first call
- No public API addition needed — env var is sufficient

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `VYTCHES_SUPPRESS_DEPRECATION_WARNINGS=1` → no console.warn for deprecated EntityIdFactory methods
- [ ] Without the env var → behaviour unchanged (warning as before)
- [ ] Env var checked after the `_entityIdFactoryWarned.has` guard (order preserved)

### Non-Functional Requirements

- [ ] Zero breaking change
- [ ] JSDoc updated: "Set VYTCHES_SUPPRESS_DEPRECATION_WARNINGS=1 to silence"
- [ ] Test: with env var set → no warning emitted

### Definition of Done

- [ ] Env var guard added to `warnEntityIdFactoryDeprecation`
- [ ] Test with env var set
- [ ] JSDoc updated
- [ ] SEC-VALUEOBJECTS-001 marked as resolved (low priority finding)

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Fix (1 line + test)

- **Agent**: library-expert
- **Tasks**:
  - [ ] Add `if (process.env['VYTCHES_SUPPRESS_DEPRECATION_WARNINGS'] === '1') return;`
  - [ ] Test: set env var → call deprecated method → verify no console.warn
  - [ ] Update JSDoc
- **Output**: `id.value-object.ts` + tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-26
```

### Activity Log

| Date       | Agent     | Action           | Result                |
| ---------- | --------- | ---------------- | --------------------- |
| 2026-05-26 | sec-audit | Finding detected | SEC-VALUEOBJECTS-001  |
| 2026-05-26 | human     | Task created     | VS-008 planned        |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-value-objects'
    files:
      - src/id.value-object.ts
      - tests/id.value-object.test.ts
```

## Risk Assessment

### Technical Risks

| Risk             | Probability | Impact | Mitigation          |
| ---------------- | ----------- | ------ | ------------------- |
| None significant | N/A         | N/A    | 1-line change       |

## Testing Strategy

### Unit Tests

- [ ] `VYTCHES_SUPPRESS_DEPRECATION_WARNINGS=1` + call deprecated method → no console.warn
- [ ] Without env var → console.warn emitted (existing test)

## Links & References

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-VALUEOBJECTS-001

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
