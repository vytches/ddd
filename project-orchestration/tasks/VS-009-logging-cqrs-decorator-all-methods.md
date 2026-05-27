# Task: CQRS class decorator — owija wszystkie metody zamiast tylko `handle`

## Task Metadata

```yaml
task_id: VS-009
title: "logging: @LogCommands class decorator — wrap only handle() method, not all prototype methods"
type: bug
priority: high
complexity: moderate
estimated_time: 1.5h
created_by: agent (multi-agent analysis 2026-05-27)
created_at: 2026-05-27
status: planned
security_finding: SEC-LOGGING-005
dread_score: 8
audit_ref: docs/security/threat-models/TM-VS-001.md
```

---

## Domain Context

```yaml
bounded_context: Logging / CQRS Integration
patterns:
  - Decorator
  - Command Handler
```

## Business Context

### Why This Task Exists

Multi-agentowa analiza techniczna (2026-05-27) wykryła, że dekoratory `@LogCommands`,
`@LogQueries`, `@LogCQRS` owijają **wszystkie** metody klasy, nie tylko `handle`.

Aktualnie (cqrs-decorators.ts linia 13-28):
```typescript
const originalMethods = Object.getOwnPropertyNames(target.prototype);
for (const methodName of originalMethods) {
  if (methodName === 'constructor') continue; // tylko constructor jest pomijany
  // WSZYSTKIE inne metody są owijane — w tym gettery, metody pomocnicze, prywatne
  target.prototype[methodName] = createLoggingWrapper(...);
}
```

Konsekwencje:
- Przypadkowe logowanie wewnętrznych metod handlera (np. `validate()`, `toEvent()`)
- Potencjalne wyciekanie PII przez metody pomocnicze
- Performance overhead — każda metoda instanceu jest owinięta w async wrapper
- Naruszenie zasady minimalnego zaskoczenia: `@LogCommands` powinien logować komendy, nie wszystko

### Expected Business Value

- [ ] Dekorator loguje tylko metodę `handle` (zgodnie z Command Handler pattern)
- [ ] Metody pomocnicze klasy nie są owijane w logging wrapper
- [ ] Opcja konfiguracyjna `methodsToWrap?: string[]` dla specjalnych przypadków

### Success Metrics

- Klasa z metodami `handle`, `validate`, `toEvent` — tylko `handle` jest logowane
- Backward-compatible: jeśli klasa ma tylko `handle`, zachowanie niezmienione

## Technical Context

### Current State

```typescript
// cqrs-decorators.ts:13-28 — wszystkie metody prototype
const originalMethods = Object.getOwnPropertyNames(target.prototype);
for (const methodName of originalMethods) {
  if (methodName === 'constructor') continue;
  // ... owijanie wszystkich metod
}
```

### Desired State

```typescript
// Podejście 1: tylko handle (domyślne)
const methodsToWrap = options.methodsToWrap ?? ['handle'];

for (const methodName of methodsToWrap) {
  const originalMethod = target.prototype[methodName];
  if (typeof originalMethod !== 'function') continue;
  target.prototype[methodName] = createLoggingWrapper(originalMethod, methodName, operationType, options, masker);
}

// Podejście 2: addytywny whitelist
// Konsument może dodać inne metody przez options.methodsToWrap: ['handle', 'execute']
```

### Technical Constraints

- Domyślny `methodsToWrap: ['handle']` jest **breaking** dla klas, które mają inne metody
  i polegają na ich loggowaniu — ale to był niezamierzony behavior, więc traktujemy jako bugfix
- Jeśli klasa nie ma metody `handle` (edge case), dekorator nie owija niczego — logować warning

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Domyślnie owijana tylko metoda `handle`
- [ ] `options.methodsToWrap?: string[]` pozwala zmienić listę metod
- [ ] Jeśli żadna z metod z `methodsToWrap` nie istnieje — log warning i kontynuuj
- [ ] Backward-compat: handlery z jedną metodą `handle` — zachowanie niezmienione

### Non-Functional Requirements

- [ ] Testy: klasa z `handle` + `validate` — tylko `handle` jest zalogowane
- [ ] Testy: `methodsToWrap: ['handle', 'execute']` — obie metody logowane
- [ ] JSDoc: zaktualizować `CQRSLoggingOptions` o `methodsToWrap`

### Definition of Done

- [ ] `cqrs-decorators.ts` używa `methodsToWrap` zamiast wszystkich metod prototype
- [ ] Testy zielone
- [ ] SEC-LOGGING-005 oznaczony jako resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: verify no unintended behavior change for common handler patterns
    deliverables: PASS/VETO verdict
```

## Implementation Plan

### Phase 1: Zmiana logiki wrappowania

- **Agent**: library-expert
- **Tasks**:
  - [ ] Dodaj `methodsToWrap?: string[]` do `CQRSLoggingOptions` (default: `['handle']`)
  - [ ] Zmień pętle w `LogCommands`, `LogQueries`, `LogCQRS` — iteruj po `methodsToWrap`
  - [ ] Dodaj warning gdy żadna metoda z listy nie istnieje na prototype
- **Output**: zmodyfikowany `cqrs-decorators.ts`

### Phase 2: Testy

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: handler z `handle` + `validate` — tylko `handle` logowane
  - [ ] Test: `methodsToWrap: ['handle', 'execute']` — obie metody
  - [ ] Test: brak `handle` na klasie — warning bez throw

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-27
```

### Activity Log

| Date       | Agent          | Action                           | Result          |
| ---------- | -------------- | -------------------------------- | --------------- |
| 2026-05-27 | multi-agent    | Finding detected (DDD Patterns Expert) | SEC-LOGGING-005 |
| 2026-05-27 | product-owner  | Task created, P1 priority        | VS-009 planned  |

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

| Risk                                  | Probability | Impact | Mitigation                               |
| ------------------------------------- | ----------- | ------ | ---------------------------------------- |
| Konsument loguje przez niehandlowe metody | Very Low | Low    | Niezamierzony behavior — bugfix scope    |
| Handler bez `handle` metody           | Low         | Low    | Warning + graceful skip                 |

## Testing Strategy

### Unit Tests

- [ ] Klasa z `handle()` + `validate()` — `validate` nie jest owinięty
- [ ] `methodsToWrap: ['handle', 'execute']` — oba owinięte
- [ ] Klasa bez `handle` — warning bez throw, brak wrappowania
- [ ] Istniejące testy z `handle` — zachowanie niezmienione

## Links & References

### Related Tasks

- VS-001: CQRS masking (ten sam plik `cqrs-decorators.ts`)
- VS-002: ConsoleProvider masking

### External Resources

- `docs/security/threat-models/TM-VS-001.md` — SEC-LOGGING-005

---

_Task managed by Project Orchestrator | Multi-Agent Analysis: 2026-05-27_
