# Task: OutboxProcessor — `logger.warn` when default handler is replaced

## Task Metadata

```yaml
task_id: VS-007
title:
  'messaging: OutboxProcessor.registerDefaultHandler — warn log when replacing
  existing handler'
type: bug
priority: normal
complexity: simple
estimated_time: 0.5h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
updated_at: 2026-06-29
status: done
security_finding: SEC-MESSAGING-001 (resolved 2026-06-29)
dread_score: 7
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
follows_up: VP-008
```

---

## Domain Context

```yaml
bounded_context: Messaging / Outbox
patterns:
  - Transactional Outbox
```

## Business Context

### Why This Task Exists

`OutboxProcessor.registerDefaultHandler()` silently replaces any previous
handler with no signal emitted:

```typescript
// outbox-processor.ts:205
registerDefaultHandler(handler: IOutboxMessageHandler): void {
  this.defaultHandler = handler;  // silent replacement
}
```

In complex setups (DI container, multi-module bootstrap, multiple initialisers)
an accidental double-call can cause messages to be processed by an unexpected
handler — with no warning in the logs.

Identified during the same audit as VP-008 — a small follow-up to that task.

### Expected Business Value

- [ ] Accidental handler replacement is immediately visible in logs
- [ ] Easier debugging of "why is my handler not being called"

### Success Metrics

- A `warn` log appears whenever an existing default handler is replaced

## Technical Context

### Current State

```typescript
registerDefaultHandler(handler: IOutboxMessageHandler): void {
  this.defaultHandler = handler;
}
```

### Desired State

```typescript
registerDefaultHandler(handler: IOutboxMessageHandler): void {
  if (this.defaultHandler) {
    this.logger.warn(
      'registerDefaultHandler: replacing existing default handler — previous handler discarded'
    );
  }
  this.defaultHandler = handler;
}
```

### Technical Constraints

- Zero breaking change — this only adds a log line
- The existing test "second registerDefaultHandler silently replaces" should be
  updated to also assert that a warn log is emitted

## Requirements & Acceptance Criteria

### Functional Requirements

- [x] Second call to `registerDefaultHandler` → `internalLogger.warn` with
      replacement message
- [x] First call → no warn (no previous handler)
- [x] Handler is still replaced (idempotent behaviour unchanged)

### Non-Functional Requirements

- [x] Test updated to assert warn log
- [x] JSDoc updated: "Second call emits a warning and replaces the previous
      handler"

### Definition of Done

- [x] `internalLogger.warn` added (note: file uses module-level
      `internalLogger`, not `this.logger`)
- [x] Test updated (assertion on warn)
- [x] JSDoc updated
- [x] SEC-MESSAGING-001 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Fix (2 lines + test update)

- **Agent**: library-expert
- **Tasks**:
  - [ ] Add `if (this.defaultHandler) this.logger.warn(...)` before assignment
  - [ ] Update "idempotent" test — add assertion on warn log (mock logger)
  - [ ] Update JSDoc
- **Output**: `outbox-processor.ts` + tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 100%
current_phase: done
blockers: []
last_updated: 2026-06-29
```

### Activity Log

| Date       | Agent       | Action                                    | Result                                                                             |
| ---------- | ----------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-05-26 | sec-audit   | Finding detected                          | SEC-MESSAGING-001                                                                  |
| 2026-05-26 | human       | Task created                              | VS-007 planned                                                                     |
| 2026-06-29 | orchestrate | Implemented + verified (quality+PII PASS) | done; warn on replace, +3 tests, tsc clean, messaging 91/91; staged pending commit |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-messaging'
    files:
      - src/outbox/outbox-processor.ts
      - tests/outbox/outbox-processor.test.ts
```

## Risk Assessment

### Technical Risks

| Risk          | Probability | Impact | Mitigation              |
| ------------- | ----------- | ------ | ----------------------- |
| Breaking test | Low         | Low    | Update test expectation |

## Testing Strategy

### Unit Tests

- [x] First `registerDefaultHandler` → no warn log
- [x] Second `registerDefaultHandler` → warn log containing "replacing existing"
- [x] Handler is still replaced after warn

## Links & References

### Related Tasks

- VP-008: OutboxProcessor default handler (parent feature)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-MESSAGING-001

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
