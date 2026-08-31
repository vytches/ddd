# Task: `Result.combine` + prymityw kompensacji (feedback konsumenta)

## Task Metadata

```yaml
task_id: VF-040
title:
  'feat: dodać Result.combine/combineWithAllErrors oraz prymityw kompensacji
  (try-confirm-cancel); zweryfikować odkrywalność kombinatorów Result i
  PolicyBuilder.when w LLMGUIDE'
type: feature
priority: medium
complexity: medium
estimated_time: 12h
created_by: consumer-feedback (audyt warstwy aplikacji u konsumenta, 2026-08-30)
created_at: 2026-08-30
status: done # zaimplementowane 2026-08-30, przebiegi wf_a6d504b8-d27 + wf_65234500-a3a; final gate GO; STAGED, niezacommitowane
analysis: project-orchestration/analysis/VF-040-result-combine-and-compensation-primitive.analysis.md
analysis_status: approved # bramka zdjęta 2026-08-30; OQ-1/OQ-2/OQ-3 zamknięte, zakres S1+S2+S3 w jednym minorze
updated_at: 2026-08-30
release_target: next minor
package: "'@vytches/ddd'"
findings: [consumer-handler-contract-audit] # mapowanie na zgłoszenie po stronie konsumenta trzymane poza tym repo
```

## Why

Feedback z aplikacji konsumującej: NestJS DDD, **338 command handlerów / 179
query handlerów**, ~72 tys. linii warstwy aplikacji. Audyt wykazał dwie luki w
API i jedną obserwację o odkrywalności. Wszystko zweryfikowane w
`dist/index.d.ts` zainstalowanej wersji.

---

## 1. `Result` nie ma agregacji wielu wyników

**Stan obecny**: `Result` udostępnia `ok`, `empty`, `fail`, `try`, `tryAsync`,
`map`, `mapAsync`, `flatMap`, `flatMapAsync`, `match`, `tap`, `tapError`,
`mapError`. Brakuje jakiejkolwiek operacji łączącej **wiele** Resultów w jeden.
(`combine` obecne w API dotyczy `IValidator` — inny byt.)

**Dlaczego to generyczna luka**: konstrukcja kilku value objectów pod rząd to
podstawowy kształt w każdej aplikacji DDD. Bez agregacji każdy konsument pisze N
razy ten sam blok „sprawdź `isFailure`, zwróć `Result.fail`" — po ~6 linii na
pole. W jednym handlerze konsumenta to 5 takich bloków różniących się wyłącznie
nazwą pola.

**Propozycja**:

```ts
static combine<T extends readonly Result<unknown, E>[], E>(results: T)
  : Result<UnwrapAll<T>, E>            // pierwszy błąd albo krotka wartości

static combineWithAllErrors<T extends readonly Result<unknown, E>[], E>(results: T)
  : Result<UnwrapAll<T>, E[]>          // wszystkie błędy naraz
```

Drugi wariant ma wpływ na produkt, nie tylko na kod: bez niego użytkownik z
pięcioma błędnymi polami formularza dostaje **jeden** błąd, poprawia, wysyła
ponownie, dostaje kolejny. Oba warianty są standardem w bibliotekach tej klasy
(np. neverthrow).

---

## 2. Brak prymitywu kompensacji (try-confirm-cancel)

**Stan obecny**: brak czegokolwiek pod `compensat*` / `saga` w
`dist/index.d.ts`.

**Dlaczego to generyczna luka**: `Result` i `@Transactional` pokrywają to, co
dzieje się **wewnątrz** transakcji bazodanowej. Nie pokrywają zasobów żyjących
**poza** nią — rezerwacji w ledgerze, wywołań innego kontekstu, zewnętrznych
API. Transakcja cofa się sama; te rzeczy nie. Konsument musi więc samodzielnie
zagwarantować trzy rzeczy naraz:

1. kompensacja wywołana na **każdej** ścieżce wyjścia po zajęciu zasobu,
2. kompensacja **nigdy nie rzuca**,
3. porażka kompensacji **nie przesłania** błędu pierwotnego.

Pominięcie któregokolwiek jest ciche — nie ma sygnału ani od kompilatora, ani w
runtime.

**Dowód, że to realny problem, nie teoria**: w aplikacji konsumenta ten sam
protokół (`reserve → confirm → release`) jest napisany ręcznie w **10
handlerach**. Pięć implementacji jest kompletnych, **dwie mają nieskompensowane
ścieżki wyjścia** (odpowiednio 2 i 3). Poprawność zależy dziś wyłącznie od tego,
którą kopię ktoś skopiował — czyli dokładnie ten rodzaj powtarzalnej mechaniki,
którą biblioteka już raz zdjęła z konsumenta przy `Result` i `safeRun`.

**Propozycja**: generyk rejestrujący kroki wraz z ich kompensacjami, wywołujący
je w odwrotnej kolejności przy porażce, z gwarancjami (1)-(3) wymuszonymi w
implementacji/typie zamiast pozostawionymi dyscyplinie konsumenta.

**Uwaga projektowa**: kompensacja bywa potrzebna **po** rollbacku transakcji,
nie tylko wewnątrz przepływu — konsument planuje hook `compensate()` w swojej
własnej klasie bazowej handlera, wołany po wycofaniu transakcji. Prymityw
powinien dać się użyć w obu miejscach, więc nie powinien zakładać, że sam
zarządza granicą transakcji.

---

## 3. Odkrywalność istniejącego API (nie luka w kodzie)

Dwie mocne, istniejące funkcje są w praktyce nieużywane:

| API                                                                               | Użycia w kodzie domenowym konsumenta | Ręczna alternatywa                                   |
| --------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| kombinatory `Result` (`flatMap`, `mapError`, `match`…)                            | **8**                                | 2605× `if (x.isFailure) return Result.fail(x.error)` |
| `PolicyBuilder.when()` (pełne then/else/and/or przez `IConditionalPolicyBuilder`) | **4**                                | rozgałęzienia `if` w warstwie aplikacji              |

Nie twierdzimy, że wszystkie 2605 miejsc powinny być łańcuchami — przy zmiennym
typie błędu na każdym kroku wczesny return bywa czytelniejszy. Ale rząd
wielkości sugeruje, że te API są nieznane, a nie świadomie odrzucone.
`PolicyBuilder.when()` jest tu wymowniejszy: rozwiązuje problem warunkowych
reguł biznesowych deklaratywnie, a mimo to prawie nikt go nie użył — konsument
odtwarzał tę funkcjonalność `if`-ami w handlerach.

Pakiet dostarcza `LLMGUIDE.md` i `llm-context.md` — a to z tych plików uczą się
agenci piszący kod w projektach konsumujących. Do sprawdzenia, czy oba API mają
tam przykłady użycia.

> **KOREKTA PO ANALIZIE (2026-08-30).** Sprawdzone: `PolicyBuilder.when()` >
> **jest** udokumentowany, i to obszernie — dedykowana sekcja wzorca plus pełna
> tabela typów budowniczego warunkowego. Ten punkt zgłoszenia jest nietrafiony.
> Prawdziwa luka dotyczy wyłącznie kombinatorów `Result`: występują w dokładnie
> jednym przewodniku pakietu, tabela API w przewodniku pakietu narzędziowego
> wymienia same konstruktory (`ok`/`fail`/`empty`/`try`/`tryAsync`), a plik
> źródłowy `Result` ma **zero** bloków `@example`.

---

## Acceptance Criteria

Uszczegółowione po analizie (2026-08-30). Numer decyzji odsyła do `decisions[]`
w artefakcie analizy.

### S1 — odkrywalność (~3h, bez blokad)

- [ ] Przykłady użycia kombinatorów `Result` (`flatMap`, `mapError`, `match`,
      `tap`) w przewodnikach pakietu bazowego, narzędziowego i zbiorczego
- [ ] Bloki `@example` w JSDoc **każdej** składowej `Result` (dziś zero) — to z
      nich karmią się podpowiedzi edytora i agenci piszący kod u konsumentów
- [ ] Anty-wzorzec zacytowany **dosłownie** w przewodniku
      (`if (x.isFailure) return Result.fail(x.error)`), żeby agent szukający
      własnego outputu trafił na zamiennik
- [ ] Obie kopie pliku kontekstu dla modeli zaktualizowane (są dwie, identyczne,
      bez generatora — łatwo zaktualizować tylko jedną)
- [ ] ~~przykłady dla `PolicyBuilder.when()`~~ — **nie dotyczy**, już istnieją
      (D-17)

### S2 — łączenie wyników (~3h, bez blokad)

- [ ] `Result.combine` — pierwszy błąd albo **krotka** wartości (nie
      `unknown[]`), jeden wspólny typ błędu `E`, wariadyczne ograniczenie krotki
      (D-02)
- [ ] **BEZ** `const` type parameters — trafiają dosłownie do `.d.ts` i są
      błędem parsowania u odbiorcy poniżej TS 5.0, a minimalnej wersji nie
      deklarujemy (D-02)
- [ ] `Result.combineWithAllErrors` — agregacja wszystkich błędów
- [ ] **Zwraca tablicę ORYGINALNYCH OBIEKTÓW BŁĘDU, nigdy nie spłaszcza ich do
      komunikatów ani stringów** — warunek potwierdzony przez konsumenta,
      przypiąć testem (D-04)
- [ ] Dokumentacja mówi wprost, że pozycja N na liście błędów **nie** odpowiada
      wejściu N (lista jest skompaktowana) (D-04)
- [ ] Pomocnicze aliasy typów pozostają **wewnętrzne**, nieeksportowane (D-06)
- [ ] Brak `combineAsync` — zamiast tego jednolinijkowiec w dokumentacji (D-05)
- [ ] ~~warianty kluczowane nazwą pola~~ — **odłożone**, konsument potwierdził,
      że nie są potrzebne (D-04, OQ-2)

### S3 — prymityw kompensacji (~5-6h)

- [ ] Trafia do pakietu odporności (zero nowych krawędzi w grafie zależności)
      (D-07)
- [ ] Nazwa `*Stack`, nie `*Registry`; **żadnego `Saga*`** w publicznych nazwach
      (D-07)
- [ ] Zajęcie zasobu i jego kompensacja rejestrowane **jednym wyrażeniem** — nie
      da się zająć zasobu bez nazwania cofnięcia (D-10)
- [ ] Wyłącznie asynchronicznie, sekwencyjnie LIFO, `for...of` z `try/catch`
      **wewnątrz** iteracji; **nigdy `Promise.all`** (D-08)
- [ ] Nieudana kompensacja nie przerywa pętli (D-08)
- [ ] Odwinięcie idempotentne przez **zatrzaśnięcie promisy**, nie flagę
      boolean; po sukcesie stos pozostaje uzbrojony (D-09)
- [ ] Kształt porażki bezwarunkowy: zawsze pierwotny błąd + (możliwie pusta)
      lista porażek kompensacji; nigdy unia z gołym błędem (D-11)
- [ ] Prymityw nie przyjmuje argumentu transakcji — „nie zarządza granicą
      transakcji" prawdziwe z konstrukcji (D-13)
- [ ] Brak `AsyncLocalStorage`, brak wpięcia w potok CQRS w v1 (D-13)
- [ ] Brak domyślnego limitu czasu i ponowień wewnątrz pętli (D-12)
- [ ] **Zastrzeżenie o braku trwałości w PIERWSZYM akapicie dokumentacji**:
      jeśli proces zginie w połowie, kompensacja się nie wykona (D-16, OQ-1)

### Testy

- [ ] `combine`: pusta lista (sukces z pustą krotką), wszystkie sukcesy,
      pierwszy błąd, wiele błędów
- [ ] `combineWithAllErrors`: oryginalne obiekty błędu zachowane, nie
      spłaszczone
- [ ] Kompensacja: porażka w środku sekwencji, kompensacja która sama rzuca,
      **podwójne wywołanie odwinięcia (najwyższa waga — podwójne zwolnienie jest
      gorsze niż niezwolnienie)**, dwa równoległe `await` na tym samym stosie

### Bramki wydania

- [ ] `pnpm run validate:api:local` → regeneruje **wyłącznie** raport API
      pakietu bazowego; raport pakietu zbiorczego **nie zmienia się**
- [ ] Snapshot powierzchni eksportów pakietu odporności zaktualizowany świadomie
- [ ] Changeset: `minor` dla pakietu bazowego i `minor` dla pakietu odporności;
      **zero ręcznej edycji pól `version`** (D-14)
- [ ] `Error.cause` **nie przejdzie** type-checku przy obecnej konfiguracji —
      nie sięgać po niego odruchowo

## Odłożone do osobnych zadań (D-15)

Znalezione przy okazji, **nie naprawiane tutaj**:

1. Barrel zbiorczy re-eksportuje `Result` z przestarzałej warstwy zgodności,
   choć jej własna dokumentacja tego zabrania
2. Test powierzchni eksportów pakietu bazowego jest ślepy na składowe klasy — to
   zadanie jest **pierwszym**, które przez tę lukę przechodzi bez sygnału
3. Dwie bajtowo identyczne kopie pliku kontekstu dla modeli bez generatora;
   weryfikator sprawdza tylko jedną
4. Niezadeklarowana minimalna wersja TypeScriptu (żaden pakiet nie ma
   `peerDependency`)

Plus, jako osobne zadanie na później: wariant z sygnałem anulowania i
udokumentowana kompozycja z istniejącymi politykami odporności (item 2b —
całkowicie bez dowodu w zgłoszeniu, nic nie opisuje wiszącej kompensacji).

## Priorytet z perspektywy konsumenta

(3) najtańsze i o największym zasięgu · (1) tanie, natychmiastowy zwrot · (2)
największa wartość, największy nakład — odblokowuje usunięcie całej klasy
cichych błędów.

## Kontekst po stronie konsumenta

Zgłoszenie pochodzi z audytu warstwy aplikacji w aplikacji konsumującej (NestJS
DDD). Konsument prowadzi po swojej stronie własne zadanie o kontrakcie cyklu
życia handlera oraz odpowiadający mu ADR — **namiary na te dokumenty celowo nie
są tu podane**: to publiczne repo biblioteki open-source i nie nazywamy w nim
wewnętrznych projektów ani artefaktów odbiorców. Mapowanie trzymamy poza
repozytorium.

Konsument planuje wydzielić własny serwis TCC per kontekst — jeśli powstanie
przed tym zadaniem, jego implementacja może posłużyć jako punkt wyjścia zamiast
opisu.

> **AKTUALIZACJA 2026-08-30.** Potwierdzone u konsumenta: własna ekstrakcja
> **nie została zaczęta** i zostanie wstrzymana, jeśli dostaną od nas
> orientacyjny termin albo uzgodniony kształt interfejsu. Ryzyko zdublowania
> pracy zdjęte — ale teraz to oni czekają na nas. Rekomendacja z analizy: wysłać
> im szkic API do uzgodnienia niezależnie od tego, w którym wydaniu prymityw
> finalnie wyjdzie.
