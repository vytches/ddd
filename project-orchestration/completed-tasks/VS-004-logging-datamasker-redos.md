# Task: DataMasker — regex pattern validation (ReDoS)

## Task Metadata

```yaml
task_id: VS-004
title:
  'logging: DataMasker — validate user-supplied regex patterns before new
  RegExp()'
type: bug
priority: high
complexity: medium
estimated_time: 2h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: completed
security_finding: SEC-LOGGING-001
dread_score: 10
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Logging / Data Masking
patterns:
  - Data Masking
  - Input Validation
```

## Business Context

### Why This Task Exists

`DataMasker` accepts regex patterns as strings (`options.patterns: string[]`)
and compiles them without any validation:

```typescript
// data-masker.ts:36
...this.options.patterns.map(pattern => new RegExp(pattern, 'g')),
```

If `patterns` comes from external configuration (env var, remote config, API) or
contains a developer mistake, a pattern such as `(a+)+$` causes catastrophic
backtracking:

- Node.js is single-threaded — ReDoS blocks the entire event loop
- DataMasker is on the hot path (EVERY log event)
- 1 blocked thread = entire service becomes unresponsive

### Expected Business Value

- [ ] Protection against accidental ReDoS via malformed regex patterns
- [ ] Better DX — clear error instead of process hang
- [ ] Infrastructure safety for consumers

### Success Metrics

- Syntactically invalid patterns throw `RangeError` in the `DataMasker`
  constructor
- Documentation describes the risk and how to configure patterns safely

## Technical Context

### Current State

```typescript
constructor(options: Partial<MaskingOptions> = {}) {
  // ...
  this.compiledPatterns = [
    ...defaultPatterns,
    ...this.options.patterns.map(pattern => new RegExp(pattern, 'g')), // no validation
  ];
}
```

### Desired State

Option A (minimum): Validate that the pattern is a valid regex before
compiling.  
Option B (better): Heuristic detection of potentially dangerous patterns.  
Option C (best): Use `safe-regex` or `re2` as an optional dependency.

**Recommendation: Option A + JSDoc warning (no additional dependencies)**

```typescript
this.compiledPatterns = [
  ...defaultPatterns,
  ...this.options.patterns.map(pattern => {
    try {
      return new RegExp(pattern, 'g');
    } catch {
      throw new RangeError(`DataMasker: invalid regex pattern "${pattern}"`);
    }
  }),
];
```

Plus a JSDoc warning: "Patterns are compiled as-is — avoid patterns with nested
quantifiers ((a+)+) or overlapping alternations which can cause ReDoS."

### Technical Constraints

- Library must remain dependency-free — no `re2` or `safe-regex` as hard deps
- Validation in constructor (fail-fast), not in `maskData` (hot path)
- Must not add `peerDependencies` without broader discussion

## Requirements & Acceptance Criteria

### Functional Requirements

- [x] Invalid regex syntax → `RangeError` thrown in constructor with a clear
      message
- [x] Valid patterns work as before
- [x] JSDoc describes ReDoS risk and provides safe pattern examples

### Non-Functional Requirements

- [x] Zero new dependencies
- [x] Fail-fast: error in constructor, not on first `maskData` call
- [x] Test for invalid syntax

### Definition of Done

- [x] Validation added to constructor
- [x] Test: `new DataMasker({ patterns: ['[invalid'] })` → `RangeError`
- [x] JSDoc with ReDoS warning
- [x] SEC-LOGGING-001 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Validation and tests

- **Agent**: library-expert
- **Tasks**:
  - [ ] Wrap `new RegExp(pattern, 'g')` in try/catch → `RangeError` with clear
        message
  - [ ] Add JSDoc ReDoS warning (nested quantifiers)
  - [ ] Test: invalid pattern → RangeError
  - [ ] Test: valid pattern → compiles without error
- **Output**: `data-masker.ts` + tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 100%
current_phase: completed
blockers: []
last_updated: 2026-05-28
```

### Activity Log

| Date       | Agent            | Action            | Result                                    |
| ---------- | ---------------- | ----------------- | ----------------------------------------- |
| 2026-05-26 | sec-audit        | Finding detected  | SEC-LOGGING-001                           |
| 2026-05-26 | human            | Task created      | VS-004 planned                            |
| 2026-05-28 | threat-model     | TM-VS-004 created | STRIDE + DREAD + LINDDUN                  |
| 2026-05-28 | api-guardian     | Phase 2B review   | APPROVE-WITH-CHANGES                      |
| 2026-05-28 | library-expert   | Implementation    | Source + tests + CHANGELOG applied        |
| 2026-05-28 | vitest           | Test suite        | 30/30 PASS (5 new VS-004 + 25 regression) |
| 2026-05-28 | tsc              | Typecheck         | Clean — no errors                         |
| 2026-05-28 | quality-verifier | Phase 4A          | PASS — zero violations                    |
| 2026-05-28 | human            | Task closed       | VS-004 completed                          |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/utils/data-masker.ts
      - tests/utils/data-masker.test.ts
```

## Risk Assessment

### Technical Risks

| Risk                     | Probability | Impact | Mitigation                      |
| ------------------------ | ----------- | ------ | ------------------------------- |
| Breaking for bad regexes | Very Low    | Low    | Throwing RangeError is a bugfix |

## Testing Strategy

### Unit Tests

- [ ] `new DataMasker({ patterns: ['[invalid'] })` → `RangeError` in constructor
- [ ] `new DataMasker({ patterns: ['\\b\\d{4}\\b'] })` → compiles and works
- [ ] Error message includes the problematic pattern for debugging

## Links & References

### Related Tasks

- VS-003: DataMasker plural bug (same file)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-001
- OWASP ReDoS:
  https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
