# Task: CsvMetricExporter — formula injection protection

## Task Metadata

```yaml
task_id: VS-006
title: "resilience: CsvMetricExporter.escapeCsv — block formula injection chars"
type: bug
priority: normal
complexity: simple
estimated_time: 0.5h
created_by: agent (security-audit 2026-05-26)
created_at: 2026-05-26
status: planned
security_finding: SEC-RESILIENCE-001
dread_score: 7
audit_ref: docs/security/SECURITY-AUDIT-2026-05-26.md
```

---

## Domain Context

```yaml
bounded_context: Resilience / Observability
patterns:
  - Metric Exporter
```

## Business Context

### Why This Task Exists

`CsvMetricExporter.escapeCsv()` protects against commas, double-quotes and
newlines but ignores spreadsheet formula injection characters (`=`, `+`, `-`,
`@`, `|`, `%`):

```typescript
// metric-exporters.ts:246–251
private escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;  // "=SUM(A1)" → returned unquoted
}
```

If metric names or labels contain `=HYPERLINK(...)` or `@evil` (e.g. from
user-controlled circuit breaker names) and the exported CSV is opened in
Excel/Google Sheets, the formula may be executed. Risk is limited (metric names
are typically developer-defined), but trivially easy to fix.

### Expected Business Value

- [ ] Safe CSV export regardless of metric name content
- [ ] Compliance with RFC 4180 + OWASP CSV Injection guideline

### Success Metrics

- Values starting with `=`, `+`, `-`, `@`, `|`, `%` are wrapped in double-quotes

## Technical Context

### Current State

```typescript
private escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

### Desired State

```typescript
private escapeCsv(value: string): string {
  const needsQuote =
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    /^[=+\-@|%]/.test(value);  // formula injection chars
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
```

### Technical Constraints

- Zero new dependencies
- Purely internal change — no impact on public API

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Values starting with `=`, `+`, `-`, `@`, `|`, `%` → wrapped in double-quotes
- [ ] Existing behaviour for `,`, `"`, `\n` unchanged
- [ ] Empty strings and normal metric names unchanged

### Non-Functional Requirements

- [ ] Tests for each formula injection character
- [ ] No breaking change in output format (double-quotes are valid RFC 4180 CSV)

### Definition of Done

- [ ] `escapeCsv` updated
- [ ] Tests: each injection char → quoted
- [ ] SEC-RESILIENCE-001 marked as resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Fix (1 file, ~5 lines)

- **Agent**: library-expert
- **Tasks**:
  - [ ] Add `/^[=+\-@|%]/` regex to condition in `escapeCsv`
  - [ ] Add `\r` to escape chars list (RFC 4180 completeness)
  - [ ] Tests for each injection char
- **Output**: `metric-exporters.ts` + tests

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-26
```

### Activity Log

| Date       | Agent     | Action           | Result             |
| ---------- | --------- | ---------------- | ------------------ |
| 2026-05-26 | sec-audit | Finding detected | SEC-RESILIENCE-001 |
| 2026-05-26 | human     | Task created     | VS-006 planned     |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-resilience'
    files:
      - src/observability/metric-exporters.ts
      - tests/observability/metric-exporters.test.ts
```

## Risk Assessment

### Technical Risks

| Risk                  | Probability | Impact | Mitigation                             |
| --------------------- | ----------- | ------ | -------------------------------------- |
| Output format change  | Certain     | Low    | Double-quotes are valid CSV per RFC4180 |

## Testing Strategy

### Unit Tests

- [ ] `"=SUM(A1)"` → `'"=SUM(A1)"'` (quoted)
- [ ] `"+1"` → `'"+1"'`
- [ ] `"-formula"` → `'"-formula"'`
- [ ] `"@evil"` → `'"@evil"'`
- [ ] `"normal_metric"` → `"normal_metric"` (no quotes)
- [ ] `"metric,with,commas"` → `'"metric,with,commas"'` (existing behaviour)

## Links & References

### External Resources

- `docs/security/SECURITY-AUDIT-2026-05-26.md` — SEC-RESILIENCE-001
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection

---

_Task managed by Project Orchestrator | Security Audit: 2026-05-26_
