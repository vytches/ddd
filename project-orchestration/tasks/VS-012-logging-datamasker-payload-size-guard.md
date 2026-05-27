# Task: DataMasker — guard na duży payload (event loop safety)

## Task Metadata

```yaml
task_id: VS-012
title: "logging: DataMasker.maskData — payload size guard to prevent event loop blocking"
type: improvement
priority: medium
complexity: simple
estimated_time: 1h
created_by: agent (multi-agent analysis 2026-05-27)
created_at: 2026-05-27
status: planned
dread_score: 6
audit_ref: docs/security/threat-models/TM-VS-001.md
```

---

## Domain Context

```yaml
bounded_context: Logging / Data Masking
patterns:
  - Defensive Programming
  - Fail-Safe
```

## Business Context

### Why This Task Exists

Performance Optimizer (analiza 2026-05-27) wskazał, że `DataMasker.maskData()` jest
synchroniczna i rekurencywna. Dla typowych payloadów komend (kilka pól) koszt jest
pomijalny (<0.1ms). Jednak przy bardzo dużych payloadach (np. bulk command z tablicą
1000 elementów, każdy element jako zagnieżdżony obiekt) rekursja może zająć event loop
na kilkanaście do kilkudziesięciu milisekund.

Dodatkowo — po VS-010 normalizacja przez `JSON.parse(JSON.stringify())` zwiększa bazowy
koszt. Dla payloadów > 50KB to może być realne ryzyko wydajnościowe.

Scenariusze ryzyka:
- `@LogCQRS` na bulk handler (np. `ImportUsersCommand` z 500 rekordami)
- `@LogCommands` na komendę z dużym załącznikiem (base64 encoded)

### Expected Business Value

- [ ] Event loop nie jest blokowany przez maskowanie dużych payloadów
- [ ] Logi zawierają informację o pominięciu maskowania dla dużych payloadów
- [ ] Konsumenci mogą skonfigurować limit rozmiaru

### Success Metrics

- Payload > 50KB → `[PAYLOAD_TOO_LARGE — masking skipped]` w logu (zamiast maskowania)
- Payload < 50KB → normalne maskowanie
- Próg konfigurowalny przez `maxPayloadBytes` w opcjach

## Technical Context

### Current State

Brak jakiegokolwiek guardu na rozmiar payloadu w `DataMasker`.

### Desired State

```typescript
// data-masker.ts
export interface MaskingOptions {
  enabled: boolean;
  patterns: string[];
  replacement: string;
  sensitiveKeys: string[];
  maxPayloadBytes?: number;  // ← NOWE, default: 51_200 (50KB)
}

maskData(data: unknown): unknown {
  if (!this.options.enabled) return data;

  const maxBytes = this.options.maxPayloadBytes ?? 51_200;

  try {
    const serialized = JSON.stringify(data);
    if (serialized && serialized.length > maxBytes) {
      // Fail-safe: log informację, zwróć placeholder
      return `[PAYLOAD_TOO_LARGE: ${serialized.length} bytes — masking skipped]`;
    }
    const normalized = JSON.parse(serialized);  // VS-010 normalizacja
    return this.maskRecursive(normalized, new WeakSet());
  } catch {
    return data; // circular ref fallback
  }
}
```

### Technical Constraints

- `maxPayloadBytes` musi być opcjonalne (backward-compat)
- Default 50KB jest pragmatyczny — typowe payloady CQRS < 5KB
- Guard musi być PRZED normalizacją VS-010 (nie po), żeby uniknąć kosztownej serializacji

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Payload > `maxPayloadBytes` → placeholder string, nie crash, nie maskowanie
- [ ] Payload w granicach → normalne maskowanie (bez zmiany)
- [ ] `maxPayloadBytes` konfigurowalny w `MaskingOptions`
- [ ] Domyślny limit: 50KB (51_200 bytes)

### Non-Functional Requirements

- [ ] Guard działa PRZED rekursją (nie po)
- [ ] Testy dla: payload poniżej limitu, payload powyżej limitu, limit=0 (wszystko maskowane), limit=Infinity
- [ ] JSDoc: `maxPayloadBytes` z opisem i przykładem

### Definition of Done

- [ ] `MaskingOptions.maxPayloadBytes` dodane
- [ ] Guard w `maskData()` przed rekursją
- [ ] Testy zielone

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Guard implementacja

- **Agent**: library-expert
- **Tasks**:
  - [ ] Dodaj `maxPayloadBytes?: number` do `MaskingOptions` (default 51_200)
  - [ ] W `maskData()` — `JSON.stringify` + sprawdzenie długości przed rekursją
  - [ ] Return placeholder gdy za duży
- **Output**: `data-masker.ts`

### Phase 2: Testy

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: payload 1KB → normalnie maskowany
  - [ ] Test: payload 100KB → placeholder
  - [ ] Test: `maxPayloadBytes: 100` → małe payloady blokowane
  - [ ] Test: circular ref payload → fallback bez crashu

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers:
  - VS-010 (normalizacja) — VS-012 guard powinien być dodany razem z normalizacją lub po niej
last_updated: 2026-05-27
```

### Activity Log

| Date       | Agent          | Action                                   | Result          |
| ---------- | -------------- | ---------------------------------------- | --------------- |
| 2026-05-27 | multi-agent    | Finding (Performance Optimizer)          | recommendation  |
| 2026-05-27 | product-owner  | Task created, P2 priority                | VS-012 planned  |

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

| Risk                                   | Probability | Impact | Mitigation                         |
| -------------------------------------- | ----------- | ------ | ---------------------------------- |
| Guard blokuje normalne małe payloady   | Very Low    | Low    | Default 50KB jest bardzo hojny     |
| Konsument z dużym payloadem traci maskowanie | Low   | Medium | Placeholder wyraźnie wskazuje co się stało |

## Testing Strategy

### Unit Tests

- [ ] Payload poniżej limitu (1KB) → maskowanie normalne
- [ ] Payload powyżej limitu (100KB) → `[PAYLOAD_TOO_LARGE...]` string
- [ ] `maxPayloadBytes: 10` → nawet małe payloady → placeholder
- [ ] Circular ref → `try/catch` → fallback, nie crash

## Links & References

### Related Tasks

- VS-003: DataMasker plural fix (prerequisite)
- VS-010: `toJSON()` bypass — razem tworzą kompletną walidację DataMasker
- VS-001: CQRS masking (consumer DataMasker)

### External Resources

- `docs/security/threat-models/TM-VS-001.md`

---

_Task managed by Project Orchestrator | Multi-Agent Analysis: 2026-05-27_
