c# Task: CQRS decorators — PII masking for `includePayload`

## Task Metadata

```yaml
task_id: VS-001
title: "logging: CQRS decorators — automatic PII masking when includePayload: true"
type: bug
priority: critical
complexity: simple
estimated_time: 2h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: planned
security_finding: SEC-LOGGING-002
dread_score: 13
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Logging / CQRS Integration
patterns:
  - Decorator
  - Data Masking
```

## Business Context

### Why This Task Exists

Security audit (2026-05-26) identified a CRITICAL finding: the `@LogCommands`,
`@LogQueries`, and `@LogCQRS` decorators with `includePayload: true` log the full
command/query object with no masking applied.

Example of the exposure:

```typescript
@LogCommands({ includePayload: true })
class CreateUserHandler {
  handle(cmd: CreateUserCommand) { ... }
}
// cmd = { email: "jan@example.com", password: "secret123" }
// → Logger output: { payload: { email: "jan@example.com", password: "secret123" } }
```

Passwords, JWT tokens, credit card numbers, and any other PII flow directly into
production logs. DREAD score 13 — highest finding in this audit.

### Expected Business Value

- [ ] Consumers can safely use `includePayload: true` without risking PII leakage
- [ ] GDPR compliance — personal data does not appear in logs
- [ ] Zero breaking change — `maskSensitiveData` flag already exists in the interface but is unused

### Success Metrics

- No PII in logs when `maskSensitiveData: true` (verified by test)
- Backward-compatible: `{ includePayload: true }` without `maskSensitiveData` retains current behaviour
- JSDoc contains explicit security warning

## Technical Context

### Current State

`cqrs-decorators.ts:92–93`:
```typescript
if (options.includePayload && commandOrQuery) {
  logData.payload = commandOrQuery;  // no masking applied
}
```

`maskSensitiveData?: boolean` is defined in `CQRSLoggingOptions` but is never used
when logging the payload.

### Desired State

When `maskSensitiveData: true`, the payload is run through `DataMasker` before being
added to `logData`. When `maskSensitiveData` is not set, behaviour is unchanged
(backward-compatible).

### Technical Constraints

- Must not change `CQRSLoggingOptions` signature in a breaking way
- `DataMasker` already exists at `packages/logging/src/utils/data-masker.ts`
- Default `maskSensitiveData: false` (backward-compat)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] When `maskSensitiveData: true` — payload is masked through `DataMasker` before logging
- [ ] `DataMasker` uses default patterns (email, SSN, card, phone) + `sensitiveKeys` from options
- [ ] When `maskSensitiveData: false` (default) — behaviour unchanged
- [ ] Optional `sensitiveFields?: string[]` forwarded to `DataMasker.sensitiveKeys`

### Non-Functional Requirements

- [ ] Security: PII does not appear in logs when `maskSensitiveData: true`
- [ ] Testing: tests for payload with email/password/token under both flag states
- [ ] Documentation: JSDoc warning "includePayload: true exposes all command fields — use maskSensitiveData: true for PII"

### Definition of Done

- [ ] Code implemented in `cqrs-decorators.ts`
- [ ] Tests verifying PII masking and backward-compat
- [ ] JSDoc updated with security warning
- [ ] `SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-002 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: verify no breaking change in public API
    deliverables: PASS/VETO verdict
```

## Implementation Plan

### Phase 1: Implement masking

- **Agent**: library-expert
- **Tasks**:
  - [ ] Add `DataMasker` instantiation in `createLoggingWrapper` when `maskSensitiveData: true`
  - [ ] Use `masker.maskData(commandOrQuery)` instead of raw `commandOrQuery`
  - [ ] Add optional `sensitiveFields?: string[]` to `CQRSLoggingOptions` (backward-compat)
- **Output**: modified `cqrs-decorators.ts`

### Phase 2: Tests and documentation

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: payload with `password`, `email`, `token` → masked when `maskSensitiveData: true`
  - [ ] Test: same payload without the flag → unmasked (backward-compat)
  - [ ] Update JSDoc
- **Output**: tests + docs

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-26
```

### Activity Log

| Date       | Agent     | Action            | Result          |
| ---------- | --------- | ----------------- | --------------- |
| 2026-05-26 | sec-audit | Finding detected  | SEC-LOGGING-002 |
| 2026-05-26 | human     | Task created      | VS-001 planned  |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/integration/cqrs-decorators.ts
      - tests/integration/cqrs-decorators.test.ts
```

## Risk Assessment

### Technical Risks

| Risk                        | Probability | Impact | Mitigation                        |
| --------------------------- | ----------- | ------ | --------------------------------- |
| Breaking API change         | Low         | High   | maskSensitiveData defaults to false |
| DataMasker overhead on hot path | Low     | Low    | DataMasker is lightweight, lazy init |

## Testing Strategy

### Unit Tests

- [ ] `{ includePayload: true, maskSensitiveData: true }` — email/password in payload → `[MASKED]`
- [ ] `{ includePayload: true, maskSensitiveData: false }` — payload unmasked
- [ ] `{ includePayload: true }` (no maskSensitiveData) — backward-compat, unmasked
- [ ] `sensitiveFields: ['password', 'token']` → those fields masked

## Links & References

### Related Tasks

- VS-002: ConsoleProvider DataMasker (same area)
- VS-003: DataMasker plural bug (improves masking used here)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-002

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
