# Task: Per-context CommandBus / QueryBus / EventBus isolation via forFeature()

## Task Metadata

```yaml
task_id: VP-007
title:
  Per-context CQRS bus isolation — forFeature() + handler scope + Map key fix
type: feature
priority: critical
complexity: high
estimated_time: 16h
created_by: human (production incident — command routing collision)
created_at: 2026-05-23
status: in_progress
release_target: v0.28.0
priority_score: 98/100
packages_affected:
  - '@vytches/ddd-cqrs'
  - '@vytches/ddd-nestjs'
related_adr: docs/adr/0034-per-context-cqrs-bus-isolation.md
```

---

## Why This Task Exists

### Incydent produkcyjny — kolizja nazw komend

W projekcie używającym tej biblioteki wykryto błąd krytyczny: komendy z jednego
bounded contextu były routowane do handlerów z innego bounded contextu. Diagnoza
wykazała, że `CommandBus` rejestruje handlery po `constructor.name` (string) w
jednym globalnym rejestrze bez żadnego prefiksu kontekstowego.

**Konkretny mechanizm błędu:**

Pięć bounded contextów definiowało klasę o identycznej nazwie
`UpdateUserReadModelCommand`. `CommandBus` rejestruje każdy handler pod kluczem
`"UpdateUserReadModelCommand"` — każda kolejna rejestracja nadpisuje poprzednią.
Wygrywający handler pochodzi z kontekstu, który załadował się jako ostatni.

Gdy kontekst A wysyłał komendę ze swoimi polami, bus kierował ją do handlera
kontekstu B, który:

- nie znał pól z komendy A (czytał je jako `undefined`),
- zapisywał `updateInput = {}` do własnego repozytorium,
- modyfikował zły zasób (tabela kontekstu B zamiast A),
- dane w kontekście A pozostawały `NULL`.

Błąd był trudny do wykrycia, bo nie rzucał wyjątku — handler po prostu nie
znajdował pól do aktualizacji i kończył się "sukcesem".

**Zakres kolizji** typowy dla projektu z wieloma bounded contextami:

```
UpdateUserReadModelCommand  — 5 kontekstów
CreateUserReadModelCommand  — prawdopodobnie tyle samo
(inne nazwy tematyczne)     — do audytu
```

### Przyczyna źródłowa w kodzie

```typescript
// packages/cqrs/src/implementations/command-bus.ts:89
const commandName =
  typeof commandType === 'string'
    ? commandType
    : (commandType as Function).name;
this.handlers.set(commandName, handler); // ← kolizja przy identycznych nazwach
```

```typescript
// packages/cqrs/src/implementations/command-bus.ts:122
const commandName = command.constructor.name; // ← ten sam string key przy execute
```

Ten sam problem istnieje w `EnhancedCommandBus` i analogicznie w `QueryBus`.

### Brak izolacji kontekstów w warstwie NestJS

`VytchesExplorerService` odkrywa wszystkich handlerów z całej aplikacji i
rejestruje ich do jednego globalnego `ICommandBus` / `IQueryBus`. Bounded
contexty nie mają żadnej własnej przestrzeni rejestracji.

---

## Zakres zmian

### Pakiet `@vytches/ddd-cqrs` — fix nienaruszający API

**1. Zmiana klucza Map z `string` na `Function | string`**

```typescript
// PRZED
private handlers = new Map<string, ICommandHandler<...>>();

register(commandType: unknown, handler: ...): void {
  const key = (commandType as Function).name;  // ← tylko string
  this.handlers.set(key, handler);
}

async execute<T extends ICommand>(command: T): Promise<TResult> {
  const commandName = command.constructor.name;  // ← tylko string
  const handler = this.handlers.get(commandName);
}

// PO
private handlers = new Map<Function | string, ICommandHandler<...>>();

register(commandType: unknown, handler: ...): void {
  const key = typeof commandType === 'string' ? commandType : (commandType as Function);
  this.handlers.set(key, handler);  // ← referencja do klasy, nie nazwa
}

async execute<T extends ICommand>(command: T): Promise<TResult> {
  const handler =
    this.handlers.get(command.constructor) ??           // ← Function ref (no collision)
    this.handlers.get(command.constructor.name);        // ← string fallback (BC)
}
```

Zmiana jest niewidoczna w public API (pole `handlers` jest `private`). Zachowana
pełna wsteczna kompatybilność: `bus.register('MyCommand', handler)` nadal
działa.

Dotyczy: `CommandBus`, `EnhancedCommandBus`, `QueryBus`, `EnhancedQueryBus`.

**2. Opcja `scope` w opcjach dekoratorów**

```typescript
// CommandHandlerOptions / QueryHandlerOptions / EventHandlerOptions
interface CommandHandlerOptions {
  serviceId?: string;
  autoRegister?: boolean;
  scope?: 'context' | 'global'; // ← nowe, optional, default: 'context'
}
```

`scope: 'context'` → handler rejestrowany w busie kontekstu (z `forFeature()`).
`scope: 'global'` → handler trafia do globalnego busa (fallback, jak
dotychczas).

### Pakiet `@vytches/ddd-nestjs` — nowe funkcje

**3. `VytchesDDDModule.forFeature(contextName)` — nowa metoda**

```typescript
static forFeature(contextName: string, options?: ForFeatureOptions): DynamicModule
```

Zwraca DynamicModule (osobna klasa `VytchesDDDFeatureModule`, nie
`VytchesDDDModule`) który dostarcza:

- `ICommandBus` — nowa izolowana instancja, scoped do modułu
- `IQueryBus` — nowa izolowana instancja, scoped do modułu
- `LOCAL_EVENT_BUS` — nowa izolowana instancja `EventBus`, scoped do modułu
- `FeatureHandlerRegistrar` — internal service (nie eksportowany)

**4. `FeatureHandlerRegistrar` — internal NestJS service**

Wstrzykuje `ModulesContainer` z `@nestjs/core`. W `onModuleInit()`:

1. Lokalizuje bieżący moduł w `ModulesContainer` przez unikalny `Symbol` token
   wstrzyknięty przez `forFeature()` — bez try/catch, O(n_modules) jednorazowo.
2. Iteruje tylko providerów tego modułu (`ourModule.providers`).
3. Dla każdego providera z metadataną `di:command-handler` / `di:query-handler`
   / `di:event-handler` bez `scope: 'global'`: rejestruje w lokalnym busie.
4. Informuje `VytchesExplorerService` o zajętych typach wiadomości.
5. W `onModuleDestroy()`: wywołuje `dispose()` na lokalnych busach (cleanup
   setInterval).

**5. `VytchesExplorerService` — update global fallback**

`onApplicationBootstrap()` (wykonuje się PO wszystkich `onModuleInit()`):

- Odkrywa wszystkich handlerów jak dotychczas.
- Pomija typy wiadomości zgłoszone przez `FeatureHandlerRegistrar` jako
  "zajęte".
- Rejestruje pozostałe (oraz `scope: 'global'`) w globalnym busie.

**6. EventBus — routing przez instanceof**

Dispatcher `UniversalEventDispatcher` (adapter NestJS) routuje zdarzenia przez
typ klasy bazowej, nie przez flagi:

```typescript
async dispatch(event: DomainEvent | IntegrationEvent): Promise<void> {
  if (event instanceof IntegrationEvent) {
    await this.integrationEventBus.publish(event);  // → IEventBus (global, outbox)
  } else {
    await this.localEventBus.publish(event);         // → LOCAL_EVENT_BUS (per-context)
  }
}
```

Biblioteka posiada już `DomainEvent` i `IntegrationEvent` jako osobne klasy
bazowe (`packages/events/`). Nie wprowadzamy `static scope` na klasie zdarzenia
— to byłoby naruszenie separacji warstw i regresja względem istniejącego modelu.

**7. Nowe eksporty z `@vytches/ddd-nestjs`**

```typescript
// Nowe tokeny i typy w public API
export const LOCAL_EVENT_BUS = Symbol.for('vytches:local-event-bus');
export type { ForFeatureOptions } from './modules/feature.module';

// VytchesDDDModule — nowa metoda statyczna
static forFeature(contextName: string, options?: ForFeatureOptions): DynamicModule
```

`FeatureHandlerRegistrar`, `VytchesDDDFeatureModule` — nie eksportowane
(internal).

---

## Lifecycle NestJS — gwarancja kolejności

```
NestJS bootstrap:

onModuleInit (OrdersModule → FeatureHandlerRegistrar)
  └── [claimuje handlery orders, informuje VytchesExplorerService]

onModuleInit (BillingModule → FeatureHandlerRegistrar)
  └── [claimuje handlery billing, informuje VytchesExplorerService]

onApplicationBootstrap (DDDModule → VytchesExplorerService)
  └── [odkrywa wszystkich → pomija zajęte → resztę do globalnego busa]
```

NestJS gwarantuje, że wszystkie `onModuleInit()` zakończą się przed
`onApplicationBootstrap()`. Brak race condition.

---

## Jak wygląda użycie z perspektywy konsumenta

Dla projektu z istniejącym globalnym setupem:

```typescript
// Jedyna zmiana per bounded context — jeden import
@Module({
  imports: [VytchesDDDModule.forFeature('orders')],
  providers: [CreateOrderHandler, GetOrderQueryHandler, OrderCreatedHandler],
})
export class OrdersModule {}
```

Globalna konfiguracja (`DDDModule` / `VytchesDDDModule.forRoot()`) — **zero
zmian**. Handlery — **zero zmian** (chyba że chcą jawnie `scope: 'global'`).

Moduły bez `forFeature()` działają jak dotychczas — ich handlery trafiają do
globalnego busa (fallback). Migracja jest inkrementalna: można dodawać
`forFeature()` kontekst po kontekście.

---

## Zachowanie przy braku `forFeature()` — błąd zamiast ciszy

Gdy handler z `@CommandHandler` jest w module bez `forFeature()`, a globalny bus
go nie odnajdzie — zamiast cichego pominięcia rzucamy błąd przy starcie:

```
VytchesDDDError: CreateOrderHandler is decorated with @CommandHandler
but no ICommandBus was found in module scope.

Did you forget VytchesDDDModule.forFeature('orders') in OrdersModule?
```

---

## Fazy implementacji

### Faza 1 — Fix Map key (P0, natychmiastowy, niezależny)

- `CommandBus`: `Map<Function | string>` + double-lookup w `execute()`
- `EnhancedCommandBus`: to samo + `Symbol.for()` dla cache key
- `QueryBus`: analogicznie
- `EnhancedQueryBus`: analogicznie
- Testy regresyjne dla kolizji nazw

### Faza 2 — `scope` w dekoratorach

- Dodanie `scope?: 'context' | 'global'` do `CommandHandlerOptions`,
  `QueryHandlerOptions`, `EventHandlerOptions`
- Aktualizacja Reflect.defineMetadata w dekoratorach
- Testy dla scope routing

### Faza 3 — `forFeature()` + `FeatureHandlerRegistrar`

- `VytchesDDDFeatureModule` jako osobna klasa
- `FeatureHandlerRegistrar` (ModulesContainer, uniqueToken, onModuleDestroy)
- Update `VytchesExplorerService.onApplicationBootstrap()` — global fallback
- `LOCAL_EVENT_BUS = Symbol.for('vytches:local-event-bus')`
- Eksport `ForFeatureOptions`

### Faza 4 — EventBus routing + testy integracyjne

- Zaktualizować `UniversalEventDispatcher` pattern (dla konsumentów NestJS)
- Testy: 2 konteksty z identycznymi nazwami komend — potwierdzenie izolacji
- Testy: fallback globalny dla modułów bez `forFeature()`
- Testy: `OnModuleDestroy` — brak wycieku setInterval

---

## Definicja ukończenia

- [x] `CommandBus.execute()` nie myli handlerów z różnych kontekstów przy
      identycznych nazwach klas (Faza 1, commit b45bbe57)
- [x] `forFeature('orders')` dostarcza izolowany `ICommandBus`, `IQueryBus`,
      `LOCAL_EVENT_BUS` (Faza 3)
- [x] Auto-discovery działa bez explicit listy handlerów (Faza 3 —
      FeatureHandlerRegistrar)
- [x] Moduły bez `forFeature()` nadal działają (global fallback —
      onApplicationBootstrap)
- [ ] Brak `forFeature()` przy `@CommandHandler` rzuca czytelny błąd przy
      starcie (Faza 4 — optional)
- [ ] `OnModuleDestroy` woła `dispose()` na `EnhancedCommandBus` (Faza 4)
- [x] Wszystkie testy przechodzą (160/160, zero regresji)
- [ ] Changelog i bump minor dla `@vytches/ddd-cqrs` i `@vytches/ddd-nestjs`

---

## Ryzyka

| Ryzyko                                              | Prawdopodobieństwo | Mitygacja                                     |
| --------------------------------------------------- | ------------------ | --------------------------------------------- |
| NestJS deduplikacja modułów dynamicznych            | Średnie            | Osobna klasa `VytchesDDDFeatureModule`        |
| `static scope` odziedziczony przez podklasy zdarzeń | N/A                | Usunięty z designu — używamy `instanceof`     |
| `setInterval` leak przy hot-reload testów           | Niskie             | `OnModuleDestroy` w `FeatureHandlerRegistrar` |
| Migracja konsumentów z wieloma kontekstami          | Niskie             | Inkrementalna — brak breaking change          |

---

## Powiązane

- ADR: `docs/adr/0034-per-context-cqrs-bus-isolation.md`
- Pakiety: `packages/cqrs/`, `packages/nestjs/`
- Istniejące klasy: `DomainEvent`, `IntegrationEvent` w `packages/events/`
- Istniejące: `VytchesDDDModule.forRoot()`, `VytchesExplorerService`
