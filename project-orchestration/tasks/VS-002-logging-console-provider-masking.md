# Task: ConsoleProvider — DataMasker for `event.data`

## Task Metadata

```yaml
task_id: VS-002
title: "logging: ConsoleProvider — optional DataMasker for event.data"
type: bug
priority: high
complexity: simple
estimated_time: 1.5h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: planned
security_finding: SEC-LOGGING-003
dread_score: 11
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Logging
patterns:
  - Provider / Strategy
  - Data Masking
```

## Business Context

### Why This Task Exists

`ConsoleProvider` (the default logger in dev/test, frequently used in production)
serialises `event.data` via `JSON.stringify` without any PII filtering:

```typescript
// console-provider.ts:63
const data = event.data ? ` ${JSON.stringify(event.data)}` : '';
// → stdout: "2026-05-26T10:00:00 INFO UserCreated { email: 'jan@...' }"
```

`DataMasker` exists in the library but is not wired into `ConsoleProvider`.
Consumers who configure a DataMasker elsewhere do not expect ConsoleProvider to be
a separate "leaky" sink.

### Expected Business Value

- [ ] Consumers can configure DataMasker once and trust that ALL sinks apply it
- [ ] GDPR compliance — PII does not reach stdout/log files
- [ ] Zero breaking change — DataMasker is optional

### Success Metrics

- `ConsoleProvider` with DataMasker → PII masked in output
- Without DataMasker → behaviour unchanged (backward-compat)

## Technical Context

### Current State

```typescript
// console-provider.ts
private formatPretty(event: LogEvent): string {
  const data = event.data ? ` ${JSON.stringify(event.data)}` : '';
  // ...
}
```

No masking whatsoever.

### Desired State

```typescript
// console-provider.ts
export interface ConsoleProviderOptions {
  pretty?: boolean;
  masker?: DataMasker;  // optional
}

private formatPretty(event: LogEvent): string {
  const rawData = event.data;
  const data = rawData
    ? ` ${JSON.stringify(this.options.masker ? this.options.masker.maskData(rawData) : rawData)}`
    : '';
}
```

### Technical Constraints

- Backward-compatible: existing `new ConsoleProvider()` and `new ConsoleProvider({ pretty: true })` must work unchanged
- DataMasker import must be tree-shakeable (optional)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `ConsoleProvider` accepts optional `masker?: DataMasker` in its options
- [ ] When `masker` is provided — `event.data` is masked before serialisation
- [ ] When `masker` is absent — behaviour unchanged
- [ ] Applies to both `formatPretty` and `formatStructured`

### Non-Functional Requirements

- [ ] Backward-compatible public API
- [ ] Tests: masking of email/password in event.data
- [ ] JSDoc: example showing configuration with DataMasker

### Definition of Done

- [ ] Code implemented
- [ ] Tests green
- [ ] API surface snapshot updated
- [ ] SEC-LOGGING-003 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: backward-compat check
    deliverables: PASS/VETO
```

## Implementation Plan

### Phase 1: Implementation

- **Agent**: library-expert
- **Tasks**:
  - [ ] Add `masker?: DataMasker` to `ConsoleProviderOptions`
  - [ ] Mask `event.data` in `formatPretty()` and `formatStructured()` when masker is set
- **Output**: `console-provider.ts`

### Phase 2: Tests

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: event.data with email → masked when masker provided
  - [ ] Test: no masker → data unchanged
- **Output**: updated tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-26
```

### Activity Log

| Date       | Agent     | Action           | Result          |
| ---------- | --------- | ---------------- | --------------- |
| 2026-05-26 | sec-audit | Finding detected | SEC-LOGGING-003 |
| 2026-05-26 | human     | Task created     | VS-002 planned  |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/providers/console-provider.ts
      - tests/providers/console-provider.test.ts
```

## Risk Assessment

### Technical Risks

| Risk            | Probability | Impact | Mitigation                        |
| --------------- | ----------- | ------ | --------------------------------- |
| Breaking change | Low         | High   | masker is optional                |
| Circular dep    | Low         | Med    | DataMasker is in the same package |

## Testing Strategy

### Unit Tests

- [ ] `ConsoleProvider({ masker })` — email in event.data → `[MASKED]`
- [ ] `ConsoleProvider()` — email in event.data → unmasked (backward-compat)
- [ ] Masking in `formatStructured` (JSON output)
- [ ] Masking in `formatPretty` (pretty output)

## Links & References

### Related Tasks

- VS-001: CQRS decorators masking (same PII area)
- VS-003: DataMasker plural bug (improves mask logic used here)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-003

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
