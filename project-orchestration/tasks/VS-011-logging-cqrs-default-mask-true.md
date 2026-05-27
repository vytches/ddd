# Task: @LogCommands — zmiana domyślnego maskowania na secure-by-default

## Task Metadata

```yaml
task_id: VS-011
title: "logging: @LogCommands default maskSensitiveData: true — secure-by-default API"
type: improvement
priority: medium
complexity: simple
estimated_time: 0.5h
created_by: agent (multi-agent analysis 2026-05-27)
created_at: 2026-05-27
status: planned
breaking_change: true
semver_impact: minor
dread_score: 6
audit_ref: docs/security/threat-models/TM-VS-001.md
```

---

## Domain Context

```yaml
bounded_context: Logging / CQRS Integration
patterns:
  - Secure by Default
  - API Design
```

## Business Context

### Why This Task Exists

DDD Patterns Expert (analiza 2026-05-27) wskazał, że `@LogCommands` powinien domyślnie
maskować dane wrażliwe, a nie wymagać jawnego `maskSensitiveData: true`.

Aktualnie (po VS-001):
```typescript
@LogCommands({ includePayload: true })  // maskSensitiveData: false — PII w logach!
@LogCommands({ includePayload: true, maskSensitiveData: true })  // bezpieczne
```

Problem: konsument musi pamiętać o dodaniu `maskSensitiveData: true`. Boolean trap.

**Dotyczy tylko `@LogCommands`** — komendy (write side) zawierają PII (dane do zapisu).
`@LogQueries` może pozostać `maskSensitiveData: false` (filtry są zwykle jawne).

### Expected Business Value

- [ ] Konsumenci nie mogą przypadkowo zalogować PII z `@LogCommands`
- [ ] Zmniejszenie ryzyka GDPR dla biblioteki jako takiej
- [ ] Jasna semantyka: Commands → domyślnie masking, Queries → domyślnie brak

### Success Metrics

- `@LogCommands({ includePayload: true })` bez `maskSensitiveData` → payload maskowany
- `@LogCommands({ includePayload: true, maskSensitiveData: false })` → jawnie niebezpieczne, payload surowy
- Changelog z jasnym opisem breaking change

## Technical Context

### Current State

```typescript
export function LogCommands(options: CQRSLoggingOptions = {}) {
  // options.maskSensitiveData: undefined → false (domyślnie)
}
```

### Desired State

```typescript
export function LogCommands(options: CQRSLoggingOptions = {}) {
  // Nadpisz default tylko dla @LogCommands — Commands mają PII
  const resolvedOptions = { maskSensitiveData: true, ...options };
  // ...
}

// @LogQueries pozostaje bez zmiany (domyślnie false)
// @LogCQRS — rozważyć: może też true?
```

### Technical Constraints

- **BREAKING CHANGE** — konsumenci z `@LogCommands({ includePayload: true })` i
  `maskSensitiveData: false` (implicit) teraz dostaną maskowanie
- Wymaga jasnego wpisu w CHANGELOG i migracji guide
- Zależy od VS-001 (implementacja maskowania)
- Semver: MINOR (nowe bezpieczne zachowanie domyślne, opt-out możliwy)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `@LogCommands` domyślnie `maskSensitiveData: true`
- [ ] `@LogCommands({ maskSensitiveData: false })` — jawne opt-out, działające
- [ ] `@LogQueries` — default bez zmian (`maskSensitiveData: false`)
- [ ] `@LogCQRS` — rozważyć zmianę, ale poza scope tego zadania

### Non-Functional Requirements

- [ ] CHANGELOG entry z przykładem migracji
- [ ] JSDoc zaktualizowany o nowe defaults

### Definition of Done

- [ ] `LogCommands` używa `{ maskSensitiveData: true, ...options }`
- [ ] Testy: domyślne maskowanie aktywne
- [ ] Testy: jawne opt-out działa

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: verify breaking change is acceptable and well-documented
    deliverables: PASS/VETO verdict
```

## Implementation Plan

### Phase 1: Zmiana defaults

- **Agent**: library-expert
- **Tasks**:
  - [ ] W `LogCommands` — spread options z `maskSensitiveData: true` jako base
  - [ ] Testy: domyślne maskowanie, jawne opt-out
  - [ ] CHANGELOG entry
- **Output**: `cqrs-decorators.ts` + changelog

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers:
  - VS-001 must be done first (masking must work before we change defaults)
last_updated: 2026-05-27
```

### Activity Log

| Date       | Agent          | Action                                   | Result          |
| ---------- | -------------- | ---------------------------------------- | --------------- |
| 2026-05-27 | multi-agent    | Finding (DDD Patterns Expert + Security) | recommendation  |
| 2026-05-27 | product-owner  | Task created, P2 priority                | VS-011 planned  |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/integration/cqrs-decorators.ts
      - tests/integration/cqrs-decorators.test.ts
      - CHANGELOG.md
```

## Risk Assessment

### Technical Risks

| Risk                                      | Probability | Impact | Mitigation                                      |
| ----------------------------------------- | ----------- | ------ | ----------------------------------------------- |
| Konsument używa `includePayload: true` bez mask | High   | Low    | To właśnie jest bug, który naprawiamy           |
| Konsument chce surowy payload z Command   | Low         | Medium | `maskSensitiveData: false` jako jawny opt-out   |

## Testing Strategy

### Unit Tests

- [ ] `@LogCommands({ includePayload: true })` — payload maskowany domyślnie
- [ ] `@LogCommands({ includePayload: true, maskSensitiveData: false })` — surowy payload
- [ ] `@LogQueries({ includePayload: true })` — domyślnie surowy (bez zmiany)

## Links & References

### Related Tasks

- VS-001: Implementacja maskowania (prerequisite)
- VS-009: Ograniczenie metod do `handle` (ten sam plik)

### External Resources

- `docs/security/threat-models/TM-VS-001.md`

---

_Task managed by Project Orchestrator | Multi-Agent Analysis: 2026-05-27_
