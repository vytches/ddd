# Task: DataMasker — false-negative for plural-form sensitive keys

## Task Metadata

```yaml
task_id: VS-003
title:
  'logging: DataMasker isSensitiveKey — fix missed plurals (passwords,
  apiTokens)'
type: bug
priority: high
complexity: simple
estimated_time: 1h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: completed
completed_at: 2026-05-28
security_finding: SEC-LOGGING-004
dread_score: 10
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Logging / Data Masking
patterns:
  - Data Masking
```

## Business Context

### Why This Task Exists

`DataMasker.isSensitiveKey()` contains a rule that excludes plural-form keys to
avoid false-positives (e.g. "tokens" as a count of tokens). In practice the rule
is too broad and causes dangerous false-negatives:

```typescript
// data-masker.ts:112
return (
  lowerKey.includes(lowerSensitiveKey) &&
  !lowerKey.endsWith(`${lowerSensitiveKey}s`)
);

// Examples:
// sensitiveKeys: ['password', 'token']
// { passwords: "secret123" }    → NOT masked  (endsWith 'passwords')  ← BUG
// { apiTokens: "Bearer xyz" }   → NOT masked  (endsWith 'tokens')     ← BUG
// { password: "secret123" }     → masked                              ← OK
// { apiToken: "Bearer xyz" }    → masked                              ← OK
// { userPassword: "secret" }    → masked                              ← OK
```

Consumers configure DataMasker believing that `sensitiveKeys: ['password']` will
protect ALL fields containing the word "password" — including plurals. This
creates a false sense of security.

### Expected Business Value

- [x] `passwords`, `apiTokens`, `userSecrets` etc. are masked when the
      corresponding key is in `sensitiveKeys`
- [x] Zero false-negatives for common PII field names
- [x] Consumers can trust their DataMasker configuration

### Success Metrics

- Test: `{ passwords: "x", apiTokens: "y" }` with
  `sensitiveKeys: ['password', 'token']` → both masked

## Technical Context

### Current State

```typescript
private isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return this.options.sensitiveKeys.some(sensitiveKey => {
    const lowerSensitiveKey = sensitiveKey.toLowerCase();
    return lowerKey.includes(lowerSensitiveKey) && !lowerKey.endsWith(`${lowerSensitiveKey}s`);
  });
}
```

The `!endsWith(s)` rule excludes both genuine false-positives (e.g. "counts")
and important PII keys (e.g. "passwords", "apiTokens").

### Desired State

Remove the exclusion rule. If a consumer wants to exclude a specific key from
masking, they should simply not add it to `sensitiveKeys` — that is explicit
configuration, not magic.

```typescript
private isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return this.options.sensitiveKeys.some(sensitiveKey =>
    lowerKey.includes(sensitiveKey.toLowerCase())
  );
}
```

### Technical Constraints

- This is a behaviour change (plural keys will now be masked) — considered a
  bugfix, not a breaking change, because plural PII SHOULD be masked.

## Requirements & Acceptance Criteria

### Functional Requirements

- [x] Plural-form keys (`passwords`, `apiTokens`, `userSecrets`) are masked when
      the corresponding singular is in `sensitiveKeys`
- [x] Behaviour for singular keys is unchanged
- [x] Substring matching still works (`userPassword` matches `password`)

### Non-Functional Requirements

- [ ] Tests for: singular, plural, nested plural, camelCase plural
- [ ] Changelog entry (bugfix — may affect DataMasker behaviour)

### Definition of Done

- [x] `endsWith` exclusion rule removed
- [x] New tests green (3 new tests in data-masker.test.ts)
- [x] Existing tests green (1 updated: `tokens` key → `authItems` — old test
      relied on plural-skip bug)
- [x] SEC-LOGGING-004 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Fix and tests

- **Agent**: library-expert
- **Tasks**:
  - [x] Remove `!lowerKey.endsWith(...)` from `isSensitiveKey`
  - [x] Add tests: `passwords`, `apiTokens`, `userSecrets`, `accessTokens`
  - [x] Check whether any existing tests need updating (1 updated — `tokens` key
        renamed to `authItems`)
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

| Date       | Agent          | Action                        | Result                 |
| ---------- | -------------- | ----------------------------- | ---------------------- |
| 2026-05-26 | sec-audit      | Finding detected              | SEC-LOGGING-004        |
| 2026-05-26 | human          | Task created                  | VS-003 planned         |
| 2026-05-28 | library-expert | Removed `!endsWith` exclusion | isSensitiveKey fixed   |
| 2026-05-28 | library-expert | Added 3 new tests, updated 1  | 95/95 green, tsc clean |

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

| Risk                           | Probability | Impact | Mitigation                         |
| ------------------------------ | ----------- | ------ | ---------------------------------- |
| Consumer relied on plural-skip | Very Low    | Low    | This was a bug — correct behaviour |

## Testing Strategy

### Unit Tests

- [x] `sensitiveKeys: ['password']`, key `passwords` → masked
- [x] `sensitiveKeys: ['token']`, key `apiTokens` → masked
- [x] `sensitiveKeys: ['token']`, key `accessTokens` → masked
- [x] `sensitiveKeys: ['password']`, key `password` → still masked (unchanged)
- [x] `sensitiveKeys: ['password']`, key `userPassword` → still masked
      (unchanged)

## Links & References

### Related Tasks

- VS-001: CQRS masking (uses DataMasker)
- VS-002: ConsoleProvider masking (uses DataMasker)

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-LOGGING-004

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
