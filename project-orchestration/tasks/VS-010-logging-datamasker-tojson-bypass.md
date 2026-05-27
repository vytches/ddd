# Task: DataMasker — bypass przez toJSON() getter

## Task Metadata

```yaml
task_id: VS-010
title: "logging: DataMasker.maskRecursive — bypass via toJSON() / custom getter returning PII"
type: bug
priority: high
complexity: moderate
estimated_time: 1.5h
created_by: agent (multi-agent analysis 2026-05-27)
created_at: 2026-05-27
status: planned
security_finding: SEC-LOGGING-006
dread_score: 9
audit_ref: docs/security/threat-models/TM-VS-001.md
```

---

## Domain Context

```yaml
bounded_context: Logging / Data Masking
patterns:
  - Data Masking
  - Defense in Depth
```

## Business Context

### Why This Task Exists

Security Audit (multi-agentowa analiza 2026-05-27) wykrył, że `DataMasker.maskRecursive`
przetwarza właściwości obiektu przez `Object.entries()`. Jeśli obiekt ma getter
`toJSON()` lub niestandardowe gettery zwracające PII, maskowanie nie widzi tych wartości
podczas rekursji — ale logger wywołuje `JSON.stringify()` który dopiero je materializuje.

Scenariusz ataku:
```typescript
class CreateUserCommand {
  private _email: string;

  get toJSON() {
    return { email: this._email, _internal: 'exposed' };
  }
}

// maskData() iteruje po Object.entries() — widzi tylko publiczne pola klasy
// logger.info('...', { payload: maskedData }) → JSON.stringify wywołuje toJSON()
// → email trafia do logu niezamaskowany
```

Częstszy scenariusz w DDD: Value Objects i Aggregates często mają `toJSON()` / `toPrimitives()`,
które eksponują więcej danych niż widoczne przez `Object.entries()`.

### Expected Business Value

- [ ] DataMasker zabezpieczony przed bypass przez `toJSON()` i custom getters
- [ ] Maskowanie działa poprawnie dla klas z Value Objects używanymi w komendach
- [ ] Konsumenci mogą bezpiecznie maskować komendy z zagnieżdżonymi VO

### Success Metrics

- Klasa z `toJSON()` zwracającym PII — pole email zamaskowane w logu
- Test weryfikujący serializację po maskowaniu

## Technical Context

### Current State

```typescript
// data-masker.ts:79-89
if (typeof value === 'object' && value !== null) {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {  // ← nie widzi toJSON()
    // ...
  }
  return result;
}
```

Logger downstream wywołuje `JSON.stringify(logData)`, które materializuje `toJSON()` —
wartości zwrócone przez getter nigdy nie przechodzą przez masker.

### Desired State

**Opcja A (rekomendowana):** Normalizacja przez `JSON.parse(JSON.stringify(value))` przed maskowaniem:
```typescript
maskData(data: unknown): unknown {
  if (!this.options.enabled) return data;

  // Materializuj toJSON() i gettery przed rekursją
  const normalized = this.normalize(data);
  return this.maskRecursive(normalized, new WeakSet());
}

private normalize(data: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data; // fallback dla circular refs itd.
  }
}
```

**Opcja B:** Sprawdzenie `toJSON()` podczas rekursji i wywołanie go przed processowaniem.

Opcja A jest prostsza i bardziej kompletna (łapie wszystkie custom gettery).

### Technical Constraints

- `JSON.parse(JSON.stringify())` dodaje koszt — tylko przy `maskSensitiveData: true`
- `JSON.parse(JSON.stringify())` usuwa `undefined`, `Date` → `string`, `RegExp` → `{}`
  — akceptowalne dla danych logowania
- Circular refs są obsłużone przez `try/catch` + fallback

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Obiekt z `toJSON()` zwracającym PII — PII jest zamaskowane po `maskData()`
- [ ] Value Object z `toPrimitives()` — dane PII zamaskowane
- [ ] Getter zwracający PII dynamicznie — zamaskowany
- [ ] Fallback dla non-serializable obiektów (circular, funkcje) — bez crashu

### Non-Functional Requirements

- [ ] Normalizacja przez `JSON.parse/stringify` tylko gdy `enabled: true`
- [ ] Koszt: akceptowalny przy typowych payloadach komend DDD
- [ ] Testy dla: `toJSON()`, getter, `toPrimitives()`, circular ref

### Definition of Done

- [ ] `DataMasker.maskData()` normalizuje obiekt przed rekursją
- [ ] Testy pokrywają bypass scenarios
- [ ] SEC-LOGGING-006 oznaczony jako resolved

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents: []
```

## Implementation Plan

### Phase 1: Normalizacja przed maskowaniem

- **Agent**: library-expert
- **Tasks**:
  - [ ] Dodaj `private normalize(data)` do `DataMasker`
  - [ ] Wywołaj `normalize()` na początku `maskData()` przed `maskRecursive()`
  - [ ] Handle `try/catch` dla non-serializable
- **Output**: zmodyfikowany `data-masker.ts`

### Phase 2: Testy bypass scenarios

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: klasa z `toJSON()` → PII zamaskowane
  - [ ] Test: getter → zamaskowany
  - [ ] Test: `Date` w payloadzie → serialized as string, nie crash
  - [ ] Test: circular ref → fallback, nie crash

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers:
  - VS-003 should be done first (DataMasker fix)
last_updated: 2026-05-27
```

### Activity Log

| Date       | Agent          | Action                            | Result          |
| ---------- | -------------- | --------------------------------- | --------------- |
| 2026-05-27 | multi-agent    | Finding detected (Security Audit) | SEC-LOGGING-006 |
| 2026-05-27 | product-owner  | Task created, P1 priority         | VS-010 planned  |

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

| Risk                                   | Probability | Impact | Mitigation                              |
| -------------------------------------- | ----------- | ------ | --------------------------------------- |
| `JSON.parse/stringify` zmienia typ Date | Medium     | Low    | Akceptowalne w kontekście logowania     |
| Koszt serializacji przy dużych payloadach | Low       | Medium | Ograniczony przez guard VS-012          |
| Circular ref crash                     | Low         | Medium | try/catch + fallback do raw value       |

## Testing Strategy

### Unit Tests

- [ ] `{ toJSON() { return { email: 'x@y.com' } } }` → email zamaskowany
- [ ] Klasa z getter `get sensitiveData() { return 'secret' }` → zamaskowane
- [ ] `{ date: new Date() }` → bez crashu, date jako string
- [ ] Circular ref → bez crashu, fallback

## Links & References

### Related Tasks

- VS-003: DataMasker plural fix (prerequisite)
- VS-001: CQRS masking (consumer)
- VS-012: Payload size guard (ogranicza koszt normalizacji)

### External Resources

- `docs/security/threat-models/TM-VS-001.md` — SEC-LOGGING-006

---

_Task managed by Project Orchestrator | Multi-Agent Analysis: 2026-05-27_
