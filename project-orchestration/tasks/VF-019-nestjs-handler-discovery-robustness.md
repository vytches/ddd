# Task: NestJS Handler Discovery Robustness

## Task Metadata

```yaml
task_id: 2026-03-31-019
title:
  NestJS Handler Discovery - Fix Lifecycle Brittleness & Manual Registration
type: refactor
priority: normal
complexity: complex
estimated_time: 12h
created_by: human
created_at: 2026-03-31 14:00
status: planned
```

## Domain Context

```yaml
bounded_context: NestJSIntegration
aggregates: []
entities: []
value_objects: []
domain_events: []
patterns:
  - Handler Discovery
  - NestJS Module Lifecycle
  - Auto-Registration
```

## Business Context

### Why This Task Exists

Strategic maturity report zidentyfikowal handler discovery jako "brittle":

- Consumer project (juz-ide-api) wymaga **100+ LOC initialization** per bounded
  context
- Kazdy handler musi byc recznie zarejestrowany w `onModuleInit()`
- Timing issues: jesli handler rejestrowany za pozno, eventy sa gubione
- Dodanie nowego handlera wymaga edycji 2-3 plikow (handler + module +
  registration)

To jest problem specyficzny dla pakietu `@vytches/ddd-nestjs` - core library nie
jest dotknieta.

### Expected Business Value

- [ ] Dodanie nowego handlera = 1 plik zamiast 3
- [ ] Zero gubionych eventow z powodu timing issues
- [ ] Redukcja initialization boilerplate z ~100 LOC do ~10 LOC per context
- [ ] Bezpieczniejsze onboarding - mniej miejsc do popelnienia bledu

### Success Metrics

- Nowy handler rejestruje sie automatycznie po dodaniu do providers NestJS
  module
- Zero timing-related event loss w testach integracyjnych
- Initialization boilerplate < 10 LOC per bounded context

## Technical Context

### Current State

Typowa rejestracja handlerow w consumer project:

```typescript
@Module({ providers: [CreateOrderHandler, CancelOrderHandler, ...] })
class OrderModule implements OnModuleInit {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
    private eventBus: EventBus,
    // ... inne busy
  ) {}

  async onModuleInit() {
    // 100+ LOC recznej rejestracji
    this.commandBus.register([
      { command: CreateOrderCommand, handler: this.createOrderHandler },
      { command: CancelOrderCommand, handler: this.cancelOrderHandler },
      // ... 20+ handlers
    ]);
    this.queryBus.register([...]);
    this.eventBus.subscribe([...]);
  }
}
```

Problemy:

- Kazdy nowy handler wymaga edycji `onModuleInit()`
- Kolejnosc rejestracji ma znaczenie (timing)
- Latwo zapomniec o rejestracji → cichy bug (event handler nigdy nie wywolany)

### Desired State

```typescript
// Opcja A: Dekorator-based auto-discovery
@CommandHandler(CreateOrderCommand)
class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  async execute(command: CreateOrderCommand): Promise<Result<void>> { ... }
}

@Module({
  providers: [CreateOrderHandler, CancelOrderHandler],
  // Auto-discovers handlers by decorator, zero manual registration
})
class OrderModule extends VytchesDddModule {}
```

```typescript
// Opcja B: Explicit but minimal registration
@Module({ providers: [...] })
class OrderModule extends VytchesDddModule {
  // Automatycznie skanuje providers i rejestruje handlery
  // na podstawie implementowanych interfejsow
}
```

### Technical Constraints

- Zmiana dotyczy TYLKO pakietu `@vytches/ddd-nestjs`
- Musi byc backward compatible - stary manual registration nadal dziala
- NestJS lifecycle: `onModuleInit()` jest jedyny bezpieczny moment na
  rejestracje
- Nie uzywac `reflect-metadata` beyond tego co NestJS juz uzywa
- Nie dodawac zaleznosci na NestJS internals ktore moga sie zmienic

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Auto-discovery handlerów na podstawie dekoratorow lub interfejsow
- [ ] `VytchesDddModule` base class ktory automatyzuje rejestracje
- [ ] Backward compatibility: manual registration nadal dziala
- [ ] Walidacja: warning jesli handler jest w providers ale nie ma dekoratora
- [ ] Ordering guarantee: wszystkie handlery zarejestrowane przed pierwszym
      eventem

### Non-Functional Requirements

- [ ] Performance: discovery w onModuleInit, nie w runtime (one-time cost)
- [ ] Security: nie skanowac modulow do ktorych nie mamy dostepu
- [ ] Documentation: migration guide z manual na auto-discovery
- [ ] Testing: integration testy z prawdziwym NestJS lifecycle

### Definition of Done

- [ ] VytchesDddModule zaimplementowany
- [ ] Auto-discovery dziala z @CommandHandler, @QueryHandler, @EventHandler
- [ ] Manual registration nadal dziala (backward compat)
- [ ] Integration testy z NestJS TestingModule
- [ ] Migration guide napisany
- [ ] Consumer project moze migrowac inkrementalnie

## Implementation Plan

### Phase 1: Research & Design

- **Tasks**:
  - [ ] Przeanalizowac jak @nestjs/cqrs robi handler discovery
  - [ ] Przeanalizowac istniejace dekoratory w @vytches/ddd-nestjs
  - [ ] Wybrac podejscie: decorator metadata vs interface scanning
  - [ ] Zaprojektowac VytchesDddModule API
- **Output**: Design document

### Phase 2: Core Implementation

- **Tasks**:
  - [ ] Zaimplementowac VytchesDddModule base class
  - [ ] Zaimplementowac handler scanner (metadata-based)
  - [ ] Dodac registration ordering guarantees
  - [ ] Backward compat layer: stary pattern nadal dziala
- **Output**: Working auto-discovery

### Phase 3: Testing & Documentation

- **Tasks**:
  - [ ] Unit testy handler scanner
  - [ ] Integration testy z NestJS TestingModule
  - [ ] Test timing: eventy nie sa gubione
  - [ ] Migration guide
- **Output**: Production-ready feature

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-03-31 14:00
```

### Activity Log

| Date | Agent | Action | Result |
| ---- | ----- | ------ | ------ |

## Risk Assessment

### Technical Risks

| Risk                                      | Probability | Impact | Mitigation                        |
| ----------------------------------------- | ----------- | ------ | --------------------------------- |
| NestJS lifecycle nie daje pelnej kontroli | Medium      | High   | Prototyp wczesnie z TestingModule |
| Breaking change w NestJS metadata API     | Low         | Medium | Wrapowac metadata access          |
| Circular dependency miedzy modulami       | Medium      | Medium | Lazy registration pattern         |

## Related ADR

- ADR-0031: NestJS Handler Auto-Discovery Architecture

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
