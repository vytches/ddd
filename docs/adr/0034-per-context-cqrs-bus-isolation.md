# ADR-0034. Per-context CQRS Bus Isolation via forFeature()

Date: 2026-05-23

## Status

2026-05-23 proposed

## Context

### Odkryty błąd produkcyjny

W projekcie z wieloma bounded contextami używającym `@vytches/ddd-cqrs` wykryto
błąd krytyczny: komendy z jednego bounded contextu były routowane do handlerów z
innego bounded contextu. Błąd powodował zapis danych do nieprawidłowego zasobu
bez rzucania wyjątku — handler kończył się "sukcesem", ale operował na złych
danych.

**Mechanizm błędu:** `CommandBus` rejestruje handlery pod kluczem
`commandType.constructor.name` (string) w jednym globalnym `Map`. Gdy wiele
bounded contextów definiuje klasy o identycznych nazwach (np.
`UpdateUserReadModelCommand`), kolejne rejestracje nadpisują poprzednie.
Wygrywającym handlerem jest ten, który załadował się jako ostatni w cyklu
bootowania NestJS. Wynik jest niedeterministyczny i zależny od kolejności
importów modułów.

**Przykład z realnego projektu:**

Pięć bounded contextów posiadało identycznie nazwaną klasę komendy. Gdy kontekst
`neighborhood-economy` wysyłał komendę z polami `firstName`/`lastName`, bus
kierował ją do handlera kontekstu `engagement`, który tych pól nie znał. Handler
zapisywał `updateInput = {}` — aktualizował nieprawidłową tabelę z pustym
zestawem pól, pozostawiając dane w `neighborhood-economy` jako `NULL`. Błąd
objawił się dopiero przy próbie użycia tych danych, długo po zdarzeniu
inicjującym.

**Skala problemu:** W typowej aplikacji z 10+ bounded contextami wiele
"tematycznych" nazw komend (`CreateUserReadModelCommand`, `UpdateStatusCommand`,
`DeleteCommand`) pojawia się niezależnie w każdym kontekście — to naturalna
konsekwencja stosowania Ubiquitous Language per-kontekst. Zakaz duplikowania
nazw byłby wymuszaniem wspólnego języka między kontekstami, co jest
anti-patternem DDD.

### Przyczyna źródłowa w architekturze biblioteki

Aktualny design zakłada jeden globalny `CommandBus` i `QueryBus` dla całej
aplikacji. `VytchesExplorerService` (pakiet `@vytches/ddd-nestjs`) odkrywa
handlerów ze wszystkich modułów NestJS i rejestruje ich do tych samych
globalnych instancji busów. Bounded contexty nie mają żadnej własnej przestrzeni
rejestracji.

To podejście jest wygodne dla małych aplikacji z jednym kontekstem, ale łamie
zasadę autonomii bounded contextu opisaną przez Evansa i Vernona: każdy kontekst
powinien mieć własną warstwę aplikacyjną i własną obsługę komend, niezależną od
innych kontekstów.

### Istniejące zabezpieczenie po stronie zdarzeń

Biblioteka posiada już poprawny podział dla zdarzeń: `DomainEvent` i
`IntegrationEvent` jako osobne klasy bazowe (`packages/events/`). `CommandBus` i
`QueryBus` nie miały analogicznego mechanizmu izolacji.

---

## Decyzja

### 1. Naprawa klucza Map w CommandBus i QueryBus

Zmiana klucza wewnętrznego `Map` z `string` (nazwa klasy) na `Function`
(referencja do konstruktora). Klasy z różnych bounded contextów mogą mieć
identyczne nazwy, ale są zawsze różnymi obiektami w pamięci.

```typescript
// PRZED: kolizja gdy dwa konteksty mają klasę o tej samej nazwie
private handlers = new Map<string, handler>();
this.handlers.set(commandType.name, handler);  // "UpdateUserReadModelCommand"

// PO: referencja do klasy — obiektowo unikalna, bez kolizji
private handlers = new Map<Function | string, handler>();
this.handlers.set(commandType, handler);  // Function ref — zawsze unikalna
```

Zachowany fallback na string key dla wstecznej kompatybilności z rejestracją
przez string (`bus.register('MyCommand', handler)`).

### 2. Opcja `scope` w dekoratorach handlerów

Dodanie opcjonalnego pola `scope?: 'context' | 'global'` do
`CommandHandlerOptions`, `QueryHandlerOptions`, `EventHandlerOptions`. Wartość
domyślna: `'context'`.

- `scope: 'context'` → handler rejestrowany w izolowanym busie swojego bounded
  contextu
- `scope: 'global'` → handler rejestrowany w globalnym busie (zachowanie
  dotychczasowe)

### 3. `VytchesDDDModule.forFeature(contextName)` — izolacja per bounded context

Nowa metoda modułu dostarcza izolowane instancje busów scoped do NestJS module:

```typescript
@Module({
  imports: [VytchesDDDModule.forFeature('orders')],
  providers: [CreateOrderHandler, GetOrderQueryHandler],
})
export class OrdersModule {}
```

Każdy `forFeature()` tworzy:

- `ICommandBus` — nowa instancja, scoped do tego modułu
- `IQueryBus` — nowa instancja, scoped do tego modułu
- `LOCAL_EVENT_BUS` — nowa instancja EventBus, scoped do tego modułu

### 4. Auto-discovery przez `FeatureHandlerRegistrar` (bez explicit list)

Nowy internal service `FeatureHandlerRegistrar` wstrzykuje `ModulesContainer` z
`@nestjs/core` i w `onModuleInit()` lokalizuje swój moduł przez unikalny Symbol
token. Iteruje tylko providerów swojego modułu — brak skanowania całej
aplikacji, brak pętli try/catch.

Informuje `VytchesExplorerService` o typach wiadomości "zajętych" przez ten
kontekst.

### 5. Global fallback — nieprzerywana wsteczna kompatybilność

`VytchesExplorerService.onApplicationBootstrap()` (po wszystkich
`onModuleInit()`):

- Pomija typy wiadomości zgłoszone przez `FeatureHandlerRegistrar`
- Rejestruje pozostałe w globalnym busie

Moduły bez `forFeature()` działają identycznie jak przed zmianą. Migracja jest
inkrementalna — można dodawać `forFeature()` kontekst po kontekście bez ryzyka
regresji.

### 6. EventBus — routing przez instanceof, nie przez flagi

`IEventDispatcher` (adapter NestJS) routuje przez typ klasy bazowej:

```typescript
if (event instanceof IntegrationEvent) {
  await this.integrationEventBus.publish(event); // cross-context, outbox
} else {
  await this.localEventBus.publish(event); // per-context, sync
}
```

Odrzucono alternatywę `static scope = 'global'` na klasach zdarzeń — takie pole
wstrzykuje wiedzę infrastrukturalną (routing) do modelu domenowego, naruszając
zasadę izolacji warstw. Biblioteka posiada już `DomainEvent` /
`IntegrationEvent` jako semantycznie poprawne rozróżnienie — używamy go.

---

## Rozważane alternatywy

### A. Wymaganie globalnie unikalnych nazw klas komend

**Odrzucone.** Wymuszanie unikalności nazw między kontekstami to narzucanie
wspólnego Ubiquitous Language, co jest fundamentalnym naruszeniem zasady bounded
context (Evans, rozdział 14). `UpdateUserReadModelCommand` ma inne znaczenie
semantyczne w każdym kontekście i powinna móc istnieć niezależnie.

### B. Prefiks kontekstu w nazwie klasy jako konwencja

**Odrzucone jako rozwiązanie biblioteki.** Konwencja
`OrdersUpdateUserReadModelCommand` jest workaroundem, nie naprawą. Biblioteka
powinna zapewniać izolację architektonicznie, nie przez konwencje nazewnicze
które można przypadkowo naruszyć. Konwencja pozostaje dopuszczalna jako
dodatkowa praktyka, ale nie może być jedynym zabezpieczeniem.

### C. Jeden bus z namespace'owanymi kluczami

**Odrzucone.** `"orders:UpdateUserReadModelCommand"` jako klucz wymaga zmiany
API rejestracji (`bus.register('orders:...', handler)`) i jest niezgodne z
istniejącymi dekoratorami `@CommandHandler`. Nie eliminuje problemu przy
auto-discovery.

### D. Dwie klasy bazowe DomainEvent / IntegrationEvent dla zdarzeń (już istnieje)

**Zaakceptowane — już zaimplementowane.** Biblioteka posiada ten podział.
Wymagało tylko podłączenia do mechanizmu routingu w dispatchers.

---

## Konsekwencje

### Pozytywne

- **Eliminacja klasy błędów produkcyjnych.** Identyczne nazwy klas komend w
  różnych kontekstach przestają być problemem architektonicznym.
- **Zgodność z kanonicznym DDD.** Każdy bounded context ma własną warstwę
  obsługi komend, niezależną od innych kontekstów (Evans/Vernon).
- **Inkrementalna migracja.** Brak breaking change. Istniejące aplikacje
  działają bez zmian. `forFeature()` można dodawać kontekst po kontekście.
- **Auto-discovery działa.** Konsument nie musi listować handlerów explicite —
  biblioteka wykrywa je automatycznie przez `ModulesContainer`.
- **Lepszy DX przy błędach.** Brak `forFeature()` daje czytelny błąd przy
  starcie zamiast cichego routing do złego handlera.

### Negatywne

- **Jedna linia boilerplate per bounded context module.**
  `imports: [VytchesDDDModule.forFeature('orders')]` jest wymagane dla izolacji.
  Moduły bez tego importu nadal działają globalnie (nie jest to breaking
  change).
- **Więcej instancji busów w pamięci.** Każdy `forFeature()` tworzy oddzielne
  instancje `CommandBus`, `QueryBus`, `EventBus`. Dla 10 kontekstów = 30
  instancji zamiast 3. Dla typowych zastosowań (handlery jako NestJS singletons,
  brak intensive caching) overhead jest pomijalny. Cache w `EnhancedCommandBus`
  powinien być wyłączony dla per-context instancji (`enableCache: false`).
- **Zależność od `ModulesContainer` (@nestjs/core internals).**
  `FeatureHandlerRegistrar` używa `ModulesContainer` do lokalizacji własnego
  modułu. API jest eksportowane przez `@nestjs/core` i używane przez oficjalne
  biblioteki NestJS (`@nestjs/cqrs`), jednak nie jest dokumentowane jako
  stabilne. Ryzyko ocenione jako niskie.

### Neutralne

- **Bump wersji: minor dla obu pakietów.** Wszystkie zmiany są addytywne lub
  dotyczą implementacji wewnętrznej. Żadna zmiana nie jest breaking dla
  istniejących konsumentów.
- **`Symbol.for()` zamiast `Symbol()` dla tokenów DI.** Gwarantuje ten sam
  symbol przy hot-reload i w środowiskach testowych z wielokrotnym importem
  modułu.

---

## Implikacje dla konsumentów

Konsumenci z istniejącym globalnym setupem:

**Krok 1 (opcjonalny, zalecany):** dodaj `forFeature('nazwa')` do każdego
bounded context module. Handlery z tego modułu zaczną używać izolowanego busa.

**Krok 2 (jeśli potrzebny):** sprawdź czy jakieś komendy/queries mają kolizje
nazw. Jeśli tak — `forFeature()` je izoluje bez zmiany nazw klas.

Brak kroku 1 i 2 = zachowanie identyczne jak przed zmianą.

---

## Powiązane decyzje

- ADR-0014: DI Integration Bridge Pattern — established the
  `IDependencyContainer` abstraction keeping CQRS framework-agnostic
- ADR-0031: NestJS Handler Auto-Discovery — original `VytchesExplorerService`
  design that this ADR extends with per-context scoping
- ADR-0007: Event System Consolidation — established `DomainEvent` /
  `IntegrationEvent` split that this ADR leverages for EventBus routing
- Task VP-007: implementation details
