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
status: completed
completed_at: 2026-05-28
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
serialises `event.data` via `JSON.stringify` without any PII filtering.

**Scope rewrite (2026-05-28):** Discovery during implementation revealed that
`DefaultLogger` already masks `event.data` at `logger.ts:90` before `provider.write()`.
The original plan (masker in ConsoleProvider only) was architecturally incomplete.
Final scope addresses both vectors:
1. `DefaultLogger` default `sensitiveKeys` — common fields masked by default
2. `ConsoleProvider.masker` — standalone use without DefaultLogger

### Expected Business Value

- [x] Consumers using DefaultLogger get password/token/secret/apiKey masked by default
- [x] GDPR compliance — PII does not reach stdout/log files via either path
- [x] Zero breaking change — masker is optional, defaults unchanged for existing configs

### Success Metrics

- `ConsoleProvider({ masker })` → PII masked in output ✓
- `ConsoleProvider()` → behaviour unchanged (backward-compat) ✓
- `DefaultLogger` default config masks password/token/secret/apiKey/authorization/credential ✓

## Technical Context

### Implemented State

```typescript
// DefaultLogger default masking config (logger.ts):
masking: {
  enabled: true,
  patterns: [],
  replacement: '[MASKED]',
  sensitiveKeys: ['password', 'token', 'secret', 'apiKey', 'authorization', 'credential'],
},

// ConsoleProvider for standalone use (console-provider.ts):
export interface ConsoleProviderOptions {
  masker?: DataMasker; // standalone use only — DefaultLogger masks upstream
}

write(event: LogEvent): void {
  const effectiveEvent =
    this.masker !== undefined && event.data !== undefined
      ? { ...event, data: this.masker.maskData(event.data) as Record<string, unknown> }
      : event;
  // ...
}
```

### Technical Constraints

- Backward-compatible: existing `new ConsoleProvider()` unchanged ✓
- `DataMasker` imported as `import type` in ConsoleProvider — tree-shakeable ✓
- `exactOptionalPropertyTypes` handled: `masker: DataMasker | undefined` as class field ✓

## Requirements & Acceptance Criteria

### Functional Requirements

- [x] `ConsoleProvider` accepts optional `masker?: DataMasker` in its options
- [x] When `masker` is provided — `event.data` is masked before serialisation (once in `write()`)
- [x] When `masker` is absent — behaviour unchanged
- [x] Applies to both `formatPretty` and `formatStructured` (masking done before format dispatch)

### Non-Functional Requirements

- [x] Backward-compatible public API
- [x] Tests: masking of email/password in event.data (10 tests in console-provider.test.ts)
- [x] JSDoc: example showing configuration with DataMasker + double-masking warning

### Definition of Done

- [x] Code implemented
- [x] Tests green (92/92)
- [x] TypeScript check clean (tsc --noEmit)
- [x] @architecture-guardian PASS (2026-05-28)
- [x] SEC-LOGGING-003 marked as resolved

## Security Considerations

> Threat model: [TM-VS-002.md](../../docs/security/threat-models/TM-VS-002.md) — 2026-05-27

| Zagrożenie | DREAD | Status po VS-002 |
|-----------|-------|-----------------|
| I1+I2 — PII w stdout/agregatach logów | 12/15 | RESOLVED — DefaultLogger masks by default |
| E1+E2 — Token → eskalacja (via agregator) | 11/15 | RESOLVED — token in default sensitiveKeys |
| T2 — Log injection przez newline | 10/15 | OPEN — osobny issue |

**Residual risk:** shallow merge w `DefaultLogger.configure()` może utracić `sensitiveKeys`
gdy consumer podaje partial `masking` config — pre-existing issue, nie wprowadzone przez VS-002.

## Agent Assignments

```yaml
lead_agent: library-expert
verifier:
  agent: architecture-guardian
  verdict: PASS
  date: 2026-05-28
```

## Progress Tracking

### Current Status

```yaml
overall_progress: 100%
current_phase: completed
blockers: []
last_updated: 2026-05-28
```

### Activity Log

| Date       | Agent                | Action                          | Result                    |
| ---------- | -------------------- | ------------------------------- | ------------------------- |
| 2026-05-26 | sec-audit            | Finding detected                | SEC-LOGGING-003           |
| 2026-05-26 | human                | Task created                    | VS-002 planned            |
| 2026-05-27 | ddd-patterns-expert  | Scope review                    | DefaultLogger masks upstream — scope rewrite |
| 2026-05-28 | library-expert       | Implementation                  | 4 files, 92 tests green   |
| 2026-05-28 | architecture-guardian | Verification                   | PASS                      |

## Code References

### Files Modified

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/core/logger.interface.ts      # maxDepth/maxStringLength in masking type
      - src/logger.ts                     # default sensitiveKeys
      - src/providers/console-provider.ts # masker for standalone use
      - tests/providers/console-provider.test.ts  # 10 new tests
      - tests/logger.test.ts              # 2 new masking tests
```

## Risk Assessment

### Technical Risks

| Risk            | Probability | Impact | Mitigation                              |
| --------------- | ----------- | ------ | --------------------------------------- |
| Breaking change | None        | N/A    | masker is optional, all tests green     |
| Circular dep    | None        | N/A    | import type — no runtime dependency     |

## Links & References

### Related Tasks

- VS-001: CQRS decorators masking (same PII area) — COMPLETED
- VS-003: DataMasker plural bug (improves mask logic used here)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-003

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26 | Completed: 2026-05-28_
