---
# Artefakt analizy — kontrakt handoff research → implementacja (ADR 0002).
# Pisany przez /analyze, edytowany przez CZŁOWIEKA, czytany przez /orchestrate.
task: VF-028-resilience-correctness
status: approved
layers_done:
  [implementation, testing, api-surface] # implementation GO wf_9a6b18a7-1d9; testing GO wf_36ac26d3-8ff;
  # api-surface wf_1bdb0970-780 ESCALATE_AND_HALT po 3 probach (validate:exports czerwone na
  # packages/cli - pakiet wpisany w config/packages.json od pierwszego commita repo, nigdy nie
  # utworzony, niezwiazany z VF-028; wszystkie pakiety dotkniete taskiem przechodza czysto).
  # Praca warstwy (enterprise/index.ts re-eksporty, api-report regen, changeset) zweryfikowana
  # 2x przez implementera jako poprawna. Czlowiek zatwierdzil kontynuacje (AskUserQuestion,
  # 2026-08-19 15:18Z) - potraktowane jako GO z udokumentowanym wyjatkiem.
approved_at: 2026-08-19 # OQ1-OQ4 rozstrzygnięte przez konsultację architecture-guardian + ddd-patterns-expert + library-expert + developer-experience; OQ1 potwierdzone przez człowieka (3:1, dysent library-expert odnotowany w answer)
created: 2026-08-19
analyst:
  /analyze (panel ecc:architect + backend-technology-expert +
  library-api-guardian, synteza tech-lead@opus)
branch_analysed:
  fix/VF-028-resilience-correctness (== develop, drzewo czyste, zweryfikowane
  git status/log)
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate]

threat_model: null
# Panel tego bloku (runtime.yml) nie deklaruje stage'u `threat-model` — nie ma go czym
# triggerować. Task nie dotyka auth/PII/cross-context, więc brak TM jest spójny z zakresem.

rag:
  skipped (brak `knowledge.collection` w runtime.yml i brak
  project.yml/knowledge.json w repo)

patterns:
  - cross-layer/conventions-pattern.md # source: patterns.always
  - typescript-library/public-api-pattern.md # source: patterns.always
  - typescript-library/package-boundary-pattern.md # source: patterns.always
  - typescript-library/library-testing-pattern.md # trigger: "test" (AC6, wielokrotnie w treści taska)
  - typescript-library/backward-compatibility-pattern.md
    # DODANE mimo braku trafienia regexu (keywords: breaking|semver|major|deprecat|wersj|
    # version|migracja|migration|changeset — żaden nie występuje w treści taska).
    # Uznane za lukę regexu: AC1 zmienia domyślne zachowanie runtime (jitter), AC2 zmienia
    # semantykę dekoratorów, oba dodają nowe eksporty publiczne — patrz "Dobór panelu" niżej.

units: [] # Ralphinho seam, MVP: jeden unit (cały task)

open_questions:
  - id: OQ1
    ask: >-
      Naprawa sprawia, że każdy obiekt dostaje własny licznik awarii — to
      rozwiązuje problem przypadkowego mieszania się awarii między
      niepowiązanymi obiektami. Czy chcemy dać jednocześnie sposób na ŚWIADOME
      współdzielenie licznika, czy wystarczy opisać to ograniczenie w
      dokumentacji?
    q: >-
      AC2 (per-instance policies via WeakMap keyed by `this`) tworzy dwa
      niezaadresowane problemy, wskazane niezależnie przez dwa stage'e panelu.
      (1) tech-analysis: AC2 wymaga wpisu do JSDoc/LLMGUIDE "jeśli CHCESZ
      dzielony breaker, dziel instancję albo użyj jawnie nazwanej polityki" —
      dziś nie istnieje mechanizm "jawnie nazwanej polityki" dla dekoratorów;
      dokumentacja obiecywałaby funkcję, której nie da się użyć. Propozycja:
      `BaseResilienceDecoratorConfig.sharedPolicy?: ResilienceStrategy`. (2)
      tech-analysis-specialist: AC2 częściowo nie rozwiązuje własnego Why. SA-M2
      motywuje AC2 przykładem "request-scoped providery dzielą liczniki awarii
      przez przypadek". Per-instance NAPRAWIA dzielenie, ale czyni
      `@CircuitBreaker`/`@Bulkhead` BEZUŻYTECZNYMI dla providerów
      request-scoped: świeża instancja per request ⇒ `failureCount` zawsze 0 ⇒
      breaker nigdy się nie zatrzaśnie; świeży `Bulkhead` per request ⇒ brak
      globalnego limitu współbieżności. `@Retry` nieaffected (bezstanowy).
      Propozycja: `scope?: 'instance' | 'shared'`, default `'instance'`.
      Dodatkowy kontekst NestJS (nienaprawialny w bibliotece):
      request-scoped/durable providery przechodzą przez Proxy — `this` może być
      proxy albo target zależnie od call-site, dając DWIE polityki z rozjechanym
      stanem, bez błędu. Warianty do rozstrzygnięcia: (A) `scope?:
      'instance'|'shared'` — deklaratywne, biblioteka zarządza instancją
      współdzieloną, pokrywa oba problemy; (B) `sharedPolicy?:
      ResilienceStrategy` — konsument wstrzykuje własną instancję, bardziej
      elastyczne (dzielenie między RÓŻNYMI klasami), wyższy próg wejścia; (C)
      żadne — tylko dokumentacja ograniczenia, escape hatch jako follow-up
      (patrz OQ2). library-api-guardian: oba (A)/(B) są MINOR strukturalnie, ale
      to nowy kontrakt BEHAWIORALNY wymagający własnych testów kontraktowych,
      nie tylko typu.
    answer: >-
      ROZSTRZYGNIĘTE — wariant (A). `scope?: 'instance' | 'shared'` na
      `BaseResilienceDecoratorConfig`, default `'instance'`. Wchodzi w tym samym
      PR co AC2, jako osobny AC7 z własnymi testami kontraktowymi (nie chowany
      pod AC2) — krok 0 (D9) i tak otwiera ten sam plik, więc koszt krańcowy
      jest niski. Konsultacja: architecture-guardian, ddd-patterns-expert i
      developer-experience rekomendowali (A); library-expert rekomendował (C) —
      zgrepował cały monorepo i nie znalazł ani jednego użycia
      `@CircuitBreaker`/`@Bulkhead` z request-scoped providerem, więc ocenił
      ryzyko jako teoretyczne. Decyzja (A) mimo tego dysentu: potwierdzona przez
      człowieka (3:1), bo to tryb awarii, który nie zostawia śladu — breaker
      cicho przestaje chronić, konsument nie ma jak połączyć "mój breaker nigdy
      się nie zatrzasnął" z "moja klasa jest request-scoped", więc brak zgłoszeń
      w repo nie jest dowodem, że problem nie wystąpi u konsumentów.
    answer_by: human (po konsultacji 4 agentów, 2026-08-19)
    blocks:
      [krok 2 (AC2 per-instance), krok 3 (AC3 wire-through configu dekoratora)]

  - id: OQ2
    ask: >-
      Jeśli decydujemy się dodać ten sposób świadomego współdzielenia — czy ma
      wejść razem z obecną poprawką, czy jako osobne, późniejsze zadanie z
      własnymi testami?
    q: >-
      Zależne od OQ1. Rekomendacja library-api-guardian: jeśli escape hatch z
      OQ1 wchodzi w VF-028, NIE chować go pod AC2 — wymaga własnego AC i
      własnych testów kontraktowych (nowy kontrakt behawioralny, nie
      rozszerzenie typu) plus jawnej noty w PR. (A) VF-028 dostaje nowy AC7
      "escape hatch" + testy kontraktowe — zakres rośnie, ale dokumentacja AC2
      jest prawdziwa od dnia pierwszego. (B) Escape hatch jako osobny ticket;
      VF-028 wchodzi z AC2 + jawnie udokumentowanym ograniczeniem
      (breaker/bulkhead niezdatne dla request-scoped providerów) i BEZ zdania
      "użyj jawnie nazwanej polityki" w JSDoc, bo byłoby nieprawdziwe — wymaga
      korekty treści AC2 w pliku taska. (C) Escape hatch wchodzi, ale wariant
      minimalny, bez wsparcia dla przypadku NestJS Proxy.
    answer: >-
      ROZSTRZYGNIĘTE — wariant (A), konsekwencja OQ1. Escape hatch wchodzi w
      VF-028, w tym samym PR, jako osobny AC7 z własnymi testami kontraktowymi —
      nie chowany pod AC2. Treść AC2 w pliku taska wymaga dopisania AC7 przed
      `/orchestrate`.
    answer_by: human (po konsultacji 4 agentów, 2026-08-19)
    blocks: [krok 2 (AC2), treść AC2 w pliku taska]

  - id: OQ3
    ask: >-
      Dwie części systemu konfiguruje się dziś w niespójny sposób — jedna
      prostym przełącznikiem, druga zestawem ustawień. Czy przy okazji
      ujednolicamy je do jednego wzorca, czy zostawiamy oba działające obok
      siebie?
    q: >-
      AC1 wymaga wystawienia `jitter` w `resilience.retry` OBU szyn CQRS. Szyny
      mają dziś różne kształty opcji: command-bus `retry?: { obiekt }`,
      query-bus `retry?: boolean` (prymityw). Zweryfikowane grepem
      (library-api-guardian): `EnhancedQueryBusOptions.resilience.retry` NIE
      jest publicznie odczytywalne (`options` prywatne, brak gettera,
      `getMetrics()` zwraca osobny ręcznie konstruowany obiekt) — poszerzenie
      typu jest bezpieczne zarówno dla wywołujących, jak i dla odczytujących.
      (A) Unia: `retry?: boolean | BusRetryOptions` w query-busie — tańsze
      teraz, zostawia trwałą rozbieżność kształtów jako źródło pomyłek na
      zawsze. (B) Ujednolicenie: query-bus dostaje ten sam wzorzec obiektowy co
      command-bus, `retry: true` zachowane jako wariant przejściowy —
      rekomendacja library-api-guardian, tańsze w utrzymaniu długoterminowo.
      Niezależnie od wariantu: nie używać `RetryConfig` z
      @vytches/ddd-resilience jako typu opcji szyny (wszystkie pola tam
      wymagane) — potrzebny nazwany, eksportowany `BusRetryOptions` plus
      dedykowany test typu (`expectTypeOf`/`tsd`), bo eksport type-only nie
      pojawi się w `api-surface.test.ts` (ten test robi `Object.keys()` na
      module runtime, typy są wymazywane w kompilacji).
    answer: >-
      ROZSTRZYGNIĘTE — wariant (B), jednomyślna rekomendacja wszystkich czterech
      konsultowanych agentów (architecture-guardian, library-expert,
      developer-experience; ddd-patterns-expert przyjął to jako założenie w
      odpowiedzi na OQ4). Query-bus dostaje ten sam kształt obiektowy co
      command-bus (`BusRetryOptions`, D12), `retry: true` zostaje jako legacy
      alias mapowany wewnętrznie na `{ enabled: true }` — zero zmiany zachowania
      dla dzisiejszych konsumentów query-busa. Uzasadnienie zbieżne we
      wszystkich odpowiedziach: obie szyny żyją w jednym pakiecie i są typowo
      konfigurowane razem w jednym module DI — rozjazd kształtu configu między
      nimi jest gwarantowanym źródłem cichych pomyłek przy kopiowaniu ustawień
      między szynami, unia `boolean | obiekt` (wariant A) tylko to utrwala na
      stałe.
    answer_by: human (po konsultacji 4 agentów, 2026-08-19)
    blocks: [krok 4 (AC1)]

  - id: OQ4
    ask: >-
      Czy włączenie tego mechanizmu ma wymagać jawnego potwierdzenia w
      konfiguracji w obu miejscach jednakowo, czy jedno z nich może pozostać
      przy dzisiejszym łagodniejszym zapisie?
    q: >-
      Zależne od OQ3 (odpowiedź (A) na OQ3 czyni to pytanie częściowo
      bezprzedmiotowym). Command-bus dla obiektowej formy retry wymaga dziś
      jawnego `enabled: true` (REL-009: retry komend jest opt-in, bo większość
      handlerów nie jest idempotentna). Query-bus traktuje samo `retry === true`
      jako włączenie. Po AC1 semantyka "co znaczy podany, ale niepełny obiekt
      retry" musi być identyczna w obu szynach, inaczej konsument kopiujący
      konfigurację między szynami dostanie ciche wyłączenie retry. (A) Symetria
      wymuszona: obiektowa forma w OBU szynach wymaga `enabled: true` — spójne,
      ale dla query-busa zmienia zachowanie dla `retry: true`, chyba że
      zmapowane na `{enabled:true}`. (B) Symetria permisywna: sama obecność
      obiektu retry oznacza włączenie w obu szynach. (C) Status quo: różne
      reguły, udokumentowane. Wariant (A) lub (B) musi być pokryty testem
      kontraktowym (patrz D13) rozszerzonym o przypadek "obiekt retry bez pola
      enabled".
    answer: >-
      ROZSTRZYGNIĘTE — wariant (A), jednomyślna rekomendacja wszystkich trzech
      pytanych o to agentów (ddd-patterns-expert, library-expert,
      developer-experience). Forma obiektowa `retry` wymaga jawnego `enabled:
      true` w OBU szynach. `retry: true` w query-busie nadal mapowane
      wewnętrznie na `{ enabled: true }` — zero zmiany zachowania dla
      dzisiejszych konsumentów. Odrzucone (B): zastosowane do command-busa
      cofnęłoby świadomą decyzję REL-009 (retry komend musi być jawnie opt-in,
      bo większość handlerów nie jest idempotentna) — autowłączenie retry dla
      nieidempotentnych mutacji byłoby regresją bezpieczeństwa, nie tylko zmianą
      kształtu typu. Test kontraktowy D13 rozszerzony o przypadek "obiekt retry
      bez pola enabled" na OBU szynach — musi dawać ten sam wynik (disabled).
    answer_by: human (po konsultacji 4 agentów, 2026-08-19)
    blocks: [krok 4 (AC1)]

decisions:
  - id: D1
    topic: Semver nowych opcjonalnych pól
    choice: >-
      Wszystkie nowe pola (halfOpenMaxProbes?, sharedPolicy?/scope? — o ile
      wejdą, BusRetryOptions) => MINOR.
    rationale: >-
      library-api-guardian zweryfikował każde pole osobno; opcjonalne pola w
      istniejących interfejsach nie łamią istniejących wywołań (BC3). Jedyny
      formalny kandydat na MAJOR (usunięcie halfOpenMaxAttempts) rozstrzygnięty
      w D3.
    means:
      Zmiana nie zepsuje istniejących projektów korzystających z biblioteki.

  - id: D2
    topic: Nazwa nowego pola limitu prób HALF_OPEN
    choice: 'halfOpenMaxProbes. NIE reużywać halfOpenMaxAttempts.'
    rationale: >-
      halfOpenMaxAttempts żyje w @vytches/ddd-projections
      (projection-interfaces.ts:174, czytane w circuit-breaker-capability.ts:57)
      z INNĄ semantyką (odpowiednik successThreshold, nie bramka na równoległe
      próby). Reużycie nazwy dałoby dwa pola o tej samej nazwie i różnym
      znaczeniu w jednym monorepo — zweryfikowane w kodzie.
    means:
      Nowe ustawienie dostaje własną nazwę, żeby nie mylić się z podobnie
      brzmiącym ustawieniem w innej części biblioteki.

  - id: D3
    topic: Martwe pole halfOpenMaxAttempts w opcjach command-busa
    choice: >-
      Usunąć (enhanced-command-bus.ts:48), bez @deprecated aliasu. Traktować
      jako PATCH + jawny wpis CHANGELOG "pole nigdy nie działało".
    rationale: >-
      Zweryfikowane: pole zadeklarowane, zero odczytów w całym pakiecie cqrs.
      Ustawienie go dziś jest no-opem, więc usunięcie nie zmienia żadnego
      obserwowalnego zachowania konsumenta. @deprecated byłby teatrem — nie ma
      ścieżki odczytu, w którą wstrzyknąć console.warn.
    means:
      Usuwamy martwe ustawienie, które nigdy nic nie robiło, i mówimy o tym
      wprost w changelogu.

  - id: D4
    topic: Algorytm jittera w @vytches/ddd-resilience
    choice:
      Bez zmian (Equal Jitter, retry.ts:80). AC1 to wyłącznie wire-through
      defaultu.
    rationale: >-
      `delay * (0.5 + Math.random() * 0.5)` to kanoniczny AWS Equal Jitter, nie
      kod ad-hoc. Zmiana algorytmu dotknęłaby wszystkich obecnych konsumentów
      jitter:true — scope creep w tasku o przepięcie flagi.
    means:
      Sposób losowania opóźnień zostaje bez zmian; zmienia się tylko to, że jest
      domyślnie włączony.

  - id: D5
    topic: Typ błędu dla odmowy sondy HALF_OPEN
    choice:
      'Klasa konkretna: CircuitBreakerHalfOpenLimitError extends
      CircuitBreakerOpenError.'
    rationale: >-
      Reużycie CircuitBreakerOpenError dałoby mylący komunikat (nextAttemptTime
      w przeszłości, bo HALF_OPEN oznacza że recovery już minęło). Dziedziczenie
      zachowuje `instanceof` u konsumentów. Klasy błędów są ustaloną konwencją
      repo — TimeoutError, OperationCancelledError, BulkheadRejectedException,
      MaxRetriesExceededError już eksportowane jako klasy w resilience/index.ts.
      Ryzyko nazewnicze niskie — potraktowane jako decyzja panelu, nie pytanie
      blokujące.
    means:
      Nowa, wyraźnie nazwana sytuacja błędna, rozpoznawalna dla kodu, który już
      obsługuje ten typ błędu.

  - id: D6
    topic: Metryka halfOpenProbesInFlight
    choice: Odłożone do VF-025, nie wchodzi w VF-028.
    rationale: >-
      Metryki resilience są jawnie out-of-scope VF-028. Test deterministyczny
      AC3 nie wymaga tego pola (recoveryTimeout:0 + zawieszona operacja +
      Promise.allSettled wystarczą, bo admission jest w pełni synchroniczny —
      brak realnego race conditio, patrz sekcja "Grounding" w body). Dodanie
      teraz poszerza publiczną powierzchnię bez odbiorcy.
    means:
      Podgląd liczby prób w trakcie odzyskiwania zrobimy razem z resztą metryk,
      nie tutaj.

  - id: D7
    topic: Cel AC4 i kierunek fixu
    choice: >-
      internalLogger.warn + zachowanie zwracanego false. NIE rethrow. Cel to
      packages/policies/src/adapters/specification-adapters.ts:29-35
      (isSatisfiedBy), NIE
      packages/policies/src/core/base/base-business-policy.ts.
    rationale: >-
      KOREKTA WZGLĘDEM OPISU TASKA, zweryfikowana w kodzie:
      base-business-policy.ts:139-148 już dziś NIE połyka wyjątku — opakowuje go
      w violation `SPECIFICATION_ERROR` z `originalError` w details. Faktyczny
      defekt jest w specification-adapters.ts:29-35 (`catch (_error) { return
      false }`), którego siostrzana metoda explainFailure (linie 66-68) NIE
      rzuca — wynosi komunikat błędu do zwracanego stringa. AC4 mówi wprost "to
      samo rozumowanie co explainFailure", więc spójna decyzja to ujawnić błąd
      przez log, nie zmieniać kontrakt zwracanego typu. Rethrow wysadziłby
      ścieżki kompozycji specyfikacji (and/or/not) i podwoiłby log przy
      dwukrotnym wywołaniu (isSatisfiedBy + explainFailure na tym samym
      błędzie). internalLogger już zaimportowany w tym samym pakiecie
      (decorators/temporal-policy.ts:183), zależność od @vytches/ddd-contracts
      już w package.json.
    means:
      Błąd przestanie znikać bez śladu — pojawi się w logach diagnostycznych —
      ale sposób działania dla istniejącego kodu się nie zmieni.

  - id: D8
    topic: Rozjazd algorytmów jittera między pakietami
    choice: >-
      AC5 musi udokumentować, że jitter w @vytches/ddd-policies
      (retry-policy.ts:300-302, pasmo ±10%) to INNY algorytm niż w
      @vytches/ddd-resilience (retry.ts:80, Equal Jitter 50-100%). Docs-only,
      zero zmian zachowania.
    rationale: >-
      Znalezione i zweryfikowane podczas syntezy, nie było w żadnym stage'u
      panelu. Ta sama nazwa opcji `jitter: boolean` o dwóch różnych semantykach
      w dwóch pakietach — bez noty AC5 utrwali nieporozumienie zamiast je
      usunąć.
    means:
      W ostrzeżeniu do dokumentacji dopiszemy, że dwa podobnie nazwane
      ustawienia w różnych częściach biblioteki działają inaczej.

  - id: D9
    topic: Kolejność implementacji — krok 0 przed AC2/AC3
    choice: >-
      Refaktor `Resilience` (composite decorator) na tę samą fabrykę co
      pozostałe dekoratory wchodzi PRZED AC2 i przed wire-through AC3, jako
      osobny commit bez zmiany zachowania.
    rationale: >-
      `Resilience` (resilience-decorators.ts:139-195) duplikuje ciało
      `createResilienceDecorator` z innym builderem. Bez deduplikacji WeakMapa
      (AC2) i przepięcie halfOpenMaxProbes (AC3) musiałyby być zaimplementowane
      dwukrotnie — dokładnie mechanizm, w którym powstaje cicha dziura
      (dekorator CircuitBreaker już dziś wylicza pola configu jawnie zamiast
      spreadować, więc nowe pole łatwo zgubić w jednym z dwóch miejsc, jeśli
      zostaną dwa).
    means:
      Najpierw porządkujemy zduplikowany kod, potem naprawiamy błąd raz, a nie
      dwa razy.

  - id: D10
    topic: Wydłużona latencja odzyskiwania po AC3
    choice: >-
      Udokumentować w JSDoc/LLMGUIDE w ramach AC3 (jedna sonda trzyma slot przez
      całą sekwencję retry z backoffem, bo Retry siedzi wewnątrz CircuitBreaker
      w kompozycji obu szyn). Nie zmieniać kolejności strategii w kompozycji.
    rationale: >-
      CompositeResilienceStrategy iteruje strategie wstecz — zmiana kolejności
      złożenia byłaby zmianą behawioralną znacznie szerszą niż VF-028. Efekt
      regulowany przez successThreshold, nie przez halfOpenMaxProbes — konsument
      musi o tym wiedzieć.
    means:
      Opiszemy w dokumentacji, że po awarii powrót do normalnej pracy może
      potrwać dłużej i od czego to zależy.

  - id: D11
    topic: Fallback dla this === undefined w AC2
    choice: >-
      Wymagany jawny fallback: gdy `this` nie jest obiektem/funkcją (odpięta
      metoda, destrukturyzacja), dekorator używa jednej leniwej "unbound"
      polityki zamiast WeakMapy.
    rationale: >-
      Dziś taki przypadek działa (dzieli politykę modułową). Po wprowadzeniu
      WeakMapy bez fallbacku `WeakMap.set(undefined, …)` rzuca TypeError —
      bugfix wprowadziłby regresję runtime w kodzie, który dziś działa. To nie
      opcja projektowa, to warunek poprawności AC2.
    means: Zadbamy, żeby naprawa nie wywróciła przypadków, które dziś działają.

  - id: D12
    topic: Kształt typu opcji retry dla obu szyn
    choice: >-
      Nazwany, eksportowany interfejs BusRetryOptions + dedykowany test typu
      (expectTypeOf/tsd) obok testu kontraktowego, niezależnie od wyniku OQ3.
    rationale: >-
      Eksport type-only nie pojawi się w api-surface.test.ts (Object.keys() na
      runtime module — typy wymazywane w kompilacji), więc regresja kształtu
      przeszłaby cicho. Nie używać RetryConfig z @vytches/ddd-resilience jako
      typu opcji szyny (wszystkie pola tam wymagane — zły kształt dla
      opcjonalnych ustawień szyny).
    means:
      Dodamy osobny test pilnujący kształtu ustawień, bo istniejący mechanizm
      kontrolny tego nie łapie.

  - id: D13
    topic: Test kontraktowy dla nowego defaultu jittera
    choice: >-
      AC1 wymaga osobnego testu kontraktowego w packages/cqrs asercjonującego
      jitter === true w domyślnie zbudowanej strategii retry (przy braku jawnej
      konfiguracji).
    rationale: >-
      Zweryfikowane: packages/cqrs/tests/api-surface.test.ts istnieje, ale to
      snapshot nazw eksportów (Object.keys()) — nie złapie zmiany defaultu
      wewnątrz setupResilience(). Bez jawnie zaplanowanego testu AC6 "nowe
      testy" zostanie odhaczone happy-pathem, który przechodzi identycznie przed
      i po zmianie.
    means:
      Zmiana domyślnego ustawienia musi mieć własny test, bo obecne testy jej
      nie zauważą.
---

# Analiza: VF-028 — resilience correctness

## Synteza (tech-lead)

Trzy niezależne analizy zgodnie potwierdzają, że wszystkich pięć usterek jest
realnych i możliwych do naprawienia bez psucia istniejących wdrożeń — żadna z
proponowanych zmian nie wymusza na użytkownikach biblioteki przeróbek ich kodu.

Naprawa dzieli się na część mechaniczną, którą można zacząć od razu, i jedną
decyzję projektową, która wymaga zatwierdzenia: czy przy okazji dajemy świadomy
sposób na współdzielenie ochrony przed awariami między obiektami, czy tylko
opisujemy powstałe ograniczenie w dokumentacji.

### Kolejność implementacji

| #   | Krok                                                                                                                         | Pakiet     | Zależność                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------- |
| 0   | Refaktor `Resilience` → wspólna fabryka dekoratora (bez zmiany zachowania)                                                   | resilience | brak, odblokowany od razu                   |
| 1   | AC3 rdzeń: probe-gate w `CircuitBreaker` + `halfOpenMaxProbes?` + `CircuitBreakerHalfOpenLimitError` + test deterministyczny | resilience | krok 0                                      |
| 2   | AC2: WeakMap per klasa×metoda + fallback `this === undefined`                                                                | resilience | **OQ1/OQ2**                                 |
| 3   | AC3 wire-through: `halfOpenMaxProbes` w jawnej liście pól dekoratora `CircuitBreaker`                                        | resilience | **OQ1/OQ2** (dzieli plik z AC2)             |
| 4   | AC1: `jitter` w opcjach obu szyn + `BusRetryOptions` + usunięcie `halfOpenMaxAttempts`                                       | cqrs       | **OQ3/OQ4**                                 |
| 5   | AC4: log zamiast cichego `false` w `specification-adapters.ts`                                                               | policies   | brak, może iść równolegle z resilience/cqrs |
| 6   | AC5: JSDoc/LLMGUIDE + nota o rozjeździe algorytmów jittera                                                                   | policies   | konsumuje ustalenia 1-4                     |
| 7   | AC6: pełna regresja 3 pakietów + typecheck                                                                                   | wszystkie  | —                                           |

Kroki 0, 1, 5, 6 są odblokowane niezależnie od odpowiedzi na otwarte pytania.
Kroki 2 i 3 czekają na OQ1/OQ2; krok 4 czeka na OQ3/OQ4.

## Otwarte pytania (DO DYSKUSJI — odpowiedz w frontmatter `answer:`)

- **OQ1**: świadome współdzielenie licznika awarii (escape hatch) — wchodzi, czy
  tylko opis ograniczenia w dokumentacji?
- **OQ2**: jeśli escape hatch wchodzi — w tym samym PR, czy osobnym zadaniem?
- **OQ3**: kształt opcji retry dla szyny zapytań — poszerzenie unią, czy
  ujednolicenie z szyną komend?
- **OQ4**: symetria warunku włączenia retry między obiema szynami.

## Decyzje (proponowane — zweryfikuj)

- **D1**: wszystkie nowe pola opcjonalne → MINOR.
- **D2**: nowe pole nazywa się `halfOpenMaxProbes`, nie `halfOpenMaxAttempts`
  (kolizja nazwy w innym pakiecie, inna semantyka).
- **D3**: martwe pole `halfOpenMaxAttempts` w szynie komend — usunąć, nie
  deprecate-alias.
- **D4**: algorytm jittera w resilience bez zmian (to już AWS Equal Jitter).
- **D5**: nowy typ błędu dla odmowy sondy, dziedziczący po istniejącym.
- **D6**: metryka liczby sond w locie — odłożona do VF-025.
- **D7**: **KOREKTA lokalizacji AC4** — cel to `specification-adapters.ts`, nie
  `base-business-policy.ts` (ten drugi już dziś nie połyka wyjątków cicho). Fix:
  log, nie rethrow.
- **D8**: udokumentować rozjazd dwóch różnych algorytmów jittera w dwóch
  pakietach (nowe znalezisko z syntezy, poza oryginalnym audytem).
- **D9**: refaktor `Resilience` (deduplikacja) wchodzi jako krok 0, przed
  AC2/AC3.
- **D10**: wydłużona latencja odzyskiwania po AC3 — udokumentować, nie zmieniać
  kolejności strategii.
- **D11**: fallback dla wywołań odpiętą metodą jest warunkiem poprawności AC2,
  nie opcją.
- **D12**: nazwany, eksportowany typ opcji retry + dedykowany test typu.
- **D13**: dedykowany test kontraktowy na nowy default jittera (istniejące testy
  go nie złapią).

## Grounding — zweryfikowane w kodzie (2026-08-19, drzewo czyste)

Wszystkich pięć ustaleń audytu (SA-H3, SA-M2, SA-M3, SA-M4, SA-L5) potwierdzone
jako aktualne i nienaprawione. Kluczowe cytaty file:line zebrane w trakcie
panelu:

- `packages/cqrs/src/implementations/enhanced-command-bus.ts:227` —
  `jitter: false` hardcoded; opcje `resilience.retry` (linie 50-56) bez pola
  `jitter`.
- `packages/cqrs/src/implementations/enhanced-query-bus.ts:332` —
  `jitter: false` hardcoded; opcje tej szyny to `retry?: boolean` (linia 39),
  nie obiekt.
- `packages/resilience/src/patterns/retry.ts:107` — `RetryPolicy` własny default
  `jitter: true`; `calculateDelay()` (74-84) — Equal Jitter, zakres 50-100%
  obliczonego opóźnienia.
- `packages/resilience/src/decorators/resilience-decorators.ts:51,143-167` —
  polityka budowana raz przy dekoracji klasy, przechwycona przez closure,
  dzielona przez wszystkie instancje. `Resilience` (139-195) duplikuje ciało
  `createResilienceDecorator`.
- `packages/resilience/src/patterns/circuit-breaker.ts:45-72,108-113` —
  `execute()` wpuszcza wszystko po przejściu OPEN→HALF_OPEN, brak licznika prób
  w locie. Brak race conditio w klasycznym sensie (JS single-threaded, zero
  `await` między sprawdzeniem stanu a punktem, w którym trzeba wstawić
  inkrement) — deficyt to brak licznika, nie wyścig.
- `packages/policies/src/adapters/specification-adapters.ts:29-35` —
  `isSatisfiedBy` łapie wszystko, zwraca `false` bez logu. `explainFailure`
  (66-68) wynosi treść błędu.
  `packages/policies/src/core/base/base-business-policy.ts:139-148` — **NIE jest
  celem AC4**: już dziś opakowuje wyjątek w violation `SPECIFICATION_ERROR` z
  `originalError`.
- `packages/resilience/src/patterns/retry.ts:66-72` — `shouldRetry` zwraca
  `true` bez `retryableErrors` — potwierdzone jak opisano.
- `packages/policies/src/decorators/retry-policy.ts:300-302` — drugi, INNY
  algorytm jittera (pasmo ±10%) niż w resilience — nowe znalezisko z syntezy,
  poza oryginalnym audytem (D8).
- `packages/cqrs/src/implementations/enhanced-command-bus.ts:48` —
  `halfOpenMaxAttempts?` zadeklarowane, zero odczytów w pakiecie; ta sama nazwa
  żyje w `packages/projections/src/projection-interfaces.ts:174` +
  `packages/projections/src/capabilities/circuit-breaker-capability.ts:57` z
  INNĄ semantyką.

## Ryzyka / uwagi

Główne ryzyko: poprawka rozwiązuje jeden z dwóch problemów, dla których
powstała, a drugi zamienia w inny — dla obiektów tworzonych na czas pojedynczego
żądania ochrona przed awariami przestanie działać zupełnie. Bez odpowiedzi na
OQ1 dokumentacja obiecywałaby możliwość, której nie da się użyć.

Ryzyko drugie, cichsze: dwie z planowanych zmian to zmiany domyślnego
zachowania, których obecne testy z zasady nie wykrywają (D13, jitter; oraz
kształt typu z D12) — bez zaplanowania dla nich osobnych testów zadanie zostanie
odhaczone jako zrobione, a regresja przejdzie niezauważona.

Uwaga do zakresu: analiza wskazała jedną rozbieżność względem opisu zadania —
miejsce jednej z pięciu usterek (AC4) jest inne, niż zakładał opis; poprawka
jest ta sama co do intencji, ale plik do zmiany inny (D7).

### Follow-upy odnotowane, NIE wchodzą w VF-028 (nie tworzyć tasków teraz)

| #   | Znalezisko                                                                                                                                        | Dowód                                            | Dlaczego osobno                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| FU1 | `RetryPolicy.delay()` akumuluje listenery na `AbortSignal` (`retry.ts:86-99`, `{once:true}` nie usuwa listenera gdy timer rozstrzygnie normalnie) | zweryfikowane                                    | terytorium VF-027 (ResilienceContext lifecycle)                      |
| FU2 | `failureCount` nigdy nie resetowany przy wejściu w HALF_OPEN                                                                                      | zachowanie pożądane, ale metryka myląca          | naturalny wsad do VF-025                                             |
| FU3 | Command-bus retry bez passthrough `retryableErrors` (REL-009 hazard)                                                                              | zweryfikowane                                    | poza treścią AC1, własna decyzja o kształcie                         |
| FU4 | Rozjazd algorytmów jittera policies (±10%) vs resilience (Equal Jitter) — ujednolicenie algorytmu                                                 | zweryfikowane (D8 pokrywa tylko dokumentacyjnie) | zmiana behawioralna dla wszystkich konsumentów, osobny semver review |
| FU5 | Nazwa `halfOpenMaxAttempts` w `@vytches/ddd-projections` myląca względem nowego `halfOpenMaxProbes`                                               | zweryfikowane                                    | żywe pole, zmiana nazwy tam to MAJOR, poza VF-028                    |

## Dobór panelu — luki regexu `when:` odnotowane świadomie

- `api-surface-analysis` (library-api-guardian) **odpalony mimo braku
  trafienia** regexu
  `api|eksport|export|index\.ts|publiczn|public|breaking|semver|deprecat|sygnatur|signature`
  — żaden z tych tokenów nie występuje w treści taska. Uznane za lukę:
  AC1/AC2/AC3 zmieniają domyślne zachowanie publicznego API i dodają nowe
  eksporty, ryzyko backward-compat jest realne mimo braku słów-kluczy.
- `boundary-analysis` (ecc:architect, blok nx-monorepo) **pominięty mimo
  trafienia** słowa `boundary` (linia AC3: "N concurrent calls at the recovery
  **boundary**") — fragment fałszywie pozytywny: to granica czasowa (recovery
  timeout), nie granica pakietu/modułu, którą ten slot ocenia. Task nie tworzy
  nowego pakietu ani nie przenosi kodu między granicami Nx.

## Named symbols — weryfikacja przed zapisem

Wszystkie sześć nowo proponowanych symboli publicznych sprawdzone grepem — żaden
nie istnieje dziś pod tą nazwą (poza kolizją nazw opisaną w D2, w innym
pakiecie): `halfOpenMaxProbes`, `CircuitBreakerHalfOpenLimitError`,
`sharedPolicy`/`scope` na `BaseResilienceDecoratorConfig`, `BusRetryOptions`,
`halfOpenProbesInFlight` (metryka, odłożona — D6). Wszystkie sześć plików
źródłowych cytowanych w opisie taska (`enhanced-command-bus.ts`,
`enhanced-query-bus.ts`, `resilience-decorators.ts`, `circuit-breaker.ts`,
`retry.ts`) istnieją i zostały przeczytane w pełni lub w cytowanych zakresach
linii — żadne "TO TRZEBA STWORZYĆ" nie dotyczy pliku, tylko nowych pól/klas
wewnątrz istniejących plików.

---

> Po wypełnieniu odpowiedzi (OQ1-OQ4) i zatwierdzeniu decyzji: ustaw
> `status: approved`, potem uruchom
> `/orchestrate VF-028-resilience-correctness`.
