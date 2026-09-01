---
task: VF-040-result-combine-and-compensation-primitive
status: approved
approved_by: właściciel biblioteki
approved_at: 2026-08-30
layers_done: [implementation, testing, api-surface] # GO 2026-08-30, przebieg wf_a6d504b8-d27
approved_scope: >-
  Domyślny zakres z D-01: S1 (odkrywalność) + S2 (łączenie wyników) + S3
  (prymityw kompensacji) w JEDNYM wydaniu minor, ~12h. Poza zakresem: item 2b
  (sygnał anulowania i kompozycja z politykami odporności), warianty kluczowane
  nazwą pola, cztery usterki sprzed taska z D-15.

threat_model: null # brak powierzchni security (prymitywy in-process, zero I/O sieciowego, zero PII); panel runtime.yml nie ma stage'a threat-model

stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml

panel: # runtime.yml analyze.panel, przebieg 2026-08-30
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      model: opus,
      when: brak,
      wynik: ok,
    }
  - {
      stage: tech-analysis-specialist,
      agent: 'backend-technology-expert',
      model: sonnet,
      when: brak,
      wynik: ok,
    }
  - {
      stage: api-surface-analysis,
      agent: 'library-api-guardian',
      model: sonnet,
      when:
        'trafienie "api" — prawdziwe: task dokłada statyki do eksportowanej
        klasy i typy do barrela',
      wynik: ok,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'trafienia when: fałszywe — "wydziel" pochodzi z "wydzielić własny
        serwis TCC" (repo konsumenta, nie nasze), "granic" z "granicą
        transakcji" (granica transakcyjna, nie pakietowa). Realne pytanie o
        umiejscowienie pakietu istnieje, ale zostało pokryte w tech-analysis z
        wstrzykniętą kartą package-boundary-pattern, a depConstraints
        zweryfikowano bezpośrednio (F9). Pominięty jako duplikat, nie jako brak
        trafienia.',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga:
        'frontmatter agenta mówi haiku; nadpisane zgodnie z polityką /analyze',
    }

rag:
  skipped (MCP claude-patterns nieosiągalny w tej sesji — CONNECTION_CLOSED;
  runtime.yml nie ma też sekcji knowledge.collection. Grounding ze statycznej
  listy patterns.always + patterns.triggers oraz z celowanej weryfikacji symboli
  w repo — patrz codebase_facts)

patterns: # 0.5 — patterns.always + trafione triggery
  always:
    - cross-layer/conventions-pattern.md
    - typescript-library/public-api-pattern.md
    - typescript-library/package-boundary-pattern.md
  triggered:
    - {
        file: typescript-library/backward-compatibility-pattern.md,
        keyword: 'wersj (— "zainstalowanej wersji", "next minor")',
      }
    - {
        file: typescript-library/library-testing-pattern.md,
        keyword: 'test (— "Testy pokrywające"), kontrakt/contract',
      }
  not_triggered:
    - {
        file: typescript-library/build-publish-pattern.md,
        powód:
          'żadne ze słów [build, bundle, eksport, export, publish, esm, cjs,
          tarball, peer] nie występuje w treści taska',
      }

codebase_facts: # wszystkie zweryfikowane bezpośrednio w tym przebiegu
  F1:
    'Kanoniczny Result<TValue, TError = Error> to
    packages/contracts/src/shared/result.ts — 199 linii, PRYWATNY konstruktor,
    ZERO bloków @example. Składowe: statyki ok/empty/fail/try/tryAsync,
    instancyjne map/flatMap/match/tap/tapError/mapError/ mapAsync/flatMapAsync,
    akcesory isSuccess/isFailure/value/error. Żadnej agregacji. PRZESŁANKA (1)
    TASKA POTWIERDZONA.'
  F2:
    'packages/utils/src/result.ts to 19-liniowy shim zgodności (REL-008): export
    { Result } from "@vytches/ddd-contracts". Natomiast
    packages/enterprise/src/index.ts:570 re-eksportuje Result WŁAŚNIE Z SHIMU,
    podczas gdy packages/utils/LLMGUIDE.md:94 zabrania importu Result z utils w
    nowym kodzie. Usterka SPRZED tego taska.'
  F3:
    'Zero compensat*/saga/TryConfirmCancel w kodzie runtime któregokolwiek z 19
    pakietów. Jedyne trafienie:
    packages/testing/src/seeder/domain-seeder.ts:232,246 — seeder TESTOWY
    (withCompensationActions), nie prymityw runtime. PRZESŁANKA (2) TASKA
    POTWIERDZONA. Zero kolizji nazw Compensation*.'
  F4:
    'PRZESŁANKA (3) TASKA CZĘŚCIOWO NIEAKTUALNA. PolicyBuilder.when() JEST
    udokumentowany, i to obszernie: packages/policies/LLMGUIDE.md ma dedykowaną
    sekcję Pattern 4 (linie 233-237) plus pełną tabelę typów IConditionalPolicy*
    (linie 97-100). Implementacja realna: packages/policies/src/builders/
    policy-builder.ts:213. Luka jest gdzie indziej — patrz F5.'
  F5:
    'Realna luka odkrywalności dotyczy kombinatorów Result: flatMap/mapError
    występują w DOKŁADNIE JEDNYM LLMGUIDE (value-objects). Tabela API w
    packages/utils/LLMGUIDE.md:40-45 wymienia wyłącznie
    ok/fail/empty/try/tryAsync — bez ani jednego kombinatora.
    packages/contracts/LLMGUIDE.md opisuje Result tylko ubocznie, wewnątrz
    przykładu walidacji. Plus F1: zero @example w źródle.'
  F6:
    'Bramka API: packages/contracts/api-report/ddd-contracts.api.md:819-837
    wylicza KAŻDĄ składową klasy Result → raport ZMIENI SIĘ, wymaga regeneracji
    przez validate:api:local (validate:api jest w trybie porównania).'
  F7:
    'KOREKTA do api-surface-analysis: packages/enterprise/api-report/ddd.api.md
    NIE zmieni się. Traktuje Result jako symbol importowany i re-eksportowany
    (import w linii 392, export w 1220), nie inline uje składowych klasy.
    Regeneracji wymaga wyłącznie raport contracts.'
  F8:
    'LUKA W TESTACH: packages/contracts/tests/api-surface.test.ts snapshotuje
    wyłącznie Object.keys(api).sort() — nazwy top-level barrela. NIE wykryje
    nowych statyk na już eksportowanej klasie. Luka SPRZED tego taska, ale
    VF-040 jest pierwszą zmianą, która przez nią przechodzi bez sygnału.'
  F9:
    'Umiejscowienie w resilience nie tworzy nowej krawędzi w grafie:
    packages/resilience/project.json:35 = [type:lib, scope:resilience,
    layer:infrastructure], a .eslintrc.json:162-168 pozwala scope:resilience
    zależeć od scope:contracts, scope:utils, scope:domain-primitives,
    scope:resilience. depConstraints są kluczowane WYŁĄCZNIE po scope:* — zero
    wpisów "sourceTag": "layer:*", więc tag layer:infrastructure niczego nie
    blokuje. Pakiet już hostuje CircuitBreaker, RetryPolicy, Bulkhead,
    TimeoutStrategy, TimeoutError, OperationCancelledError.'
  F10:
    'KOREKTA do api-surface-analysis: resilience NIE jest bez ochrony przed
    dryfem. packages/resilience/tests/api-surface.test.ts + snapshot istnieją,
    więc nazwy top-level są zablokowane. Brakuje wyłącznie api-extractora na
    poziomie składowych (resilience nie występuje w liście validate:api).'
  F11:
    'engines.node >= 22.19.0 (package.json:31); tsconfig.base.json: target
    ES2020, lib ["ES2020","DOM"]. Skutek: AbortSignal.timeout dostępny bez zmian
    w konfiguracji, ale Error.cause NIE PRZEJDZIE type-checku (wymaga biblioteki
    ES2022 error). Konwencja normalizacji błędu już istnieje w
    result.ts:80,164,182.'
  F12:
    'ŻADEN z 19 pakietów nie deklaruje peerDependency na typescript — minimalna
    wspierana wersja kompilatora u odbiorcy jest NIEZADEKLAROWANA. Obecny
    packages/contracts/dist/shared/result.d.ts nie używa składni nowszej niż
    bardzo stary TS. Dlatego const type parameters (TS 5.0+) są odrzucone:
    trafiają dosłownie do .d.ts i są błędem parsowania u odbiorcy poniżej 5.0.'
  F13:
    'docs/llm-context.md i packages/enterprise/llm-context.md to DWIE BAJTOWO
    IDENTYCZNE kopie (33196 B) bez generatora.
    scripts/verify-llm-context.mjs:179 sprawdza wyłącznie tę pierwszą, i tylko
    czy udokumentowane symbole nadal istnieją na poziomie barrela. Kopia
    wysyłana w pakiecie może cicho się rozjechać.'
  F14:
    'Preflight 0.a1: nic z tego taska nie jest zrobione. git status pokazuje
    plik taska jako untracked; żaden plik implementacji nie ruszony. Brak
    jednostek o statusie already-done.'

decisions:
  - id: D-01
    choice:
      'Zakres: wydać item 3 (przeskalowany), item 1 (wariant krotkowy), item 2a.
      Odłożyć item 2b (AbortSignal + kompozycja z RetryPolicy), warianty
      combineRecord* oraz wszystkie usterki sprzed taska.'
    rationale:
      'Item 2b jest całkowicie bez dowodu — nic w raporcie konsumenta nie
      opisuje wiszącej kompensacji, opisuje nieskompensowane ścieżki wyjścia.
      Wszystko odkładane jest później czysto addytywne (MINOR), więc odłożenie
      nic nie kosztuje i utrzymuje zamrażaną powierzchnię małą.'
    means:
      'Wydajemy trzy rzeczy, po które konsument faktycznie przyszedł, i nic
      ponadto. Wszystko, co odkładamy, da się dołożyć później bez łamania
      zgodności — więc odkładanie nic nas nie kosztuje.'
  - id: D-02
    choice:
      'Sygnatura combine: JEDEN wspólny typ błędu E dla całego wejścia (wariant
      z taska, wbrew propozycji tech-analysis), z wariadycznym ograniczeniem
      krotki dla zachowania krotkowości. BEZ const type parameters.'
    rationale:
      'Rozstrzygnięte kosztem migracji, nie elegancją: wspólne E → wariant z
      unią błędów później łamie wyłącznie odbiorców jawnie instancjonujących
      generyki (błąd arności, rzadkie); unia → wspólne E później jest
      jednoznacznie MAJOR. Jeśli heterogeniczne błędy kiedyś będą potrzebne,
      dokłada się NOWY eksport, nie rusza zamrożonej sygnatury. const T trafia
      dosłownie do .d.ts (F12).'
    means:
      'Wybieramy wariant prostszy w użyciu i taki, z którego da się jeszcze
      wyjść bez wersji łamiącej. Nie wymuszamy też na odbiorcach nowszego
      kompilatora, niż deklarujemy.'
  - id: D-03
    choice:
      'Pusta lista wejściowa zwraca sukces z pustą krotką; bez specjalnego
      przypadku w kodzie, ale z jawnym testem.'
    rationale:
      'Element neutralny — naturalna implementacja już to daje, test przypina to
      jako kontrakt.'
    means:
      'Pusta lista danych wejściowych daje poprawny wynik, a nie błąd ani
      wyjątek. To zachowanie jest objęte testem, więc nie zmieni się
      przypadkiem.'
  - id: D-04
    choice:
      'combineWithAllErrors zwraca SKOMPAKTOWANĄ listę błędów. Warianty
      kluczowane nazwą pola NIE wchodzą w to wydanie. Dokumentacja musi jawnie
      mówić, że pozycja N na liście błędów NIE odpowiada wejściu N. WARUNEK
      TWARDY (potwierdzony przez konsumenta 2026-08-30): funkcja zwraca tablicę
      ORYGINALNYCH OBIEKTÓW BŁĘDU, nigdy nie spłaszcza ich do komunikatów ani
      stringów. Przypiąć to testem — to jedyne, co dzieli D-04 od konieczności
      dołożenia wariantu kluczowanego.'
    rationale:
      'Ustalenie tech-analysis jest trafne: historia produktowa („pokaż
      wszystkie pięć błędnych pól") działa tylko, jeśli sam typ błędu niesie
      tożsamość pola. Dołożenie wariantu kluczowanego później jest czysto
      addytywne; odwrotnie już nie. Prawdziwą pułapką jest NIEUDOKUMENTOWANE
      założenie pozycyjne.'
    means:
      'Użytkownik dostaje wszystkie błędy formularza naraz zamiast jednego po
      drugim, pod warunkiem że sam błąd niesie informację, którego pola dotyczy.
      Wariant z błędem przypisanym do nazwy pola możemy dołożyć później.'
  - id: D-05
    choice: 'Brak combineAsync. Zamiast tego jednolinijkowiec w dokumentacji.'
    rationale:
      'Kompozycja istniejących prymitywów; dedykowany eksport zamrażałby drugą
      sygnaturę bez zysku.'
    means:
      'Nie mnożymy wariantów tej samej funkcji. Przypadek asynchroniczny
      pokrywamy jedną linijką w dokumentacji.'
  - id: D-06
    choice:
      'Pomocnicze aliasy typów pozostają WEWNĘTRZNE (nieeksportowane). Gdyby
      kiedyś musiały wyjść, użyć nazw z prefiksem Infer*/CombinedResult*.'
    rationale:
      'Raz wyeksportowane są zamrożone na zawsze. To repo już potrzebowało
      ręcznego bloku rozwiązywania kolizji nazw w barrelu zbiorczym
      (enterprise/src/index.ts:579-596, kolizje EntityId/ValidationError/
      ExecutionContext/safeRun) — nazwy generyczne są dokładnie tym, co to
      wyprodukowało. Zero kolizji dziś ≠ zero kolizji za rok.'
    means:
      'Publikujemy tylko to, co odbiorcy naprawdę potrzebują wywołać. Każda
      dodatkowa nazwa w publicznym API to zobowiązanie na lata.'
  - id: D-07
    choice:
      'Prymityw kompensacji trafia do pakietu resilience. Dwie warstwy:
      niskopoziomowy stos (rejestracja + jawne odwinięcie) plus cukier
      runCompensated(fn). Nazwa *Stack, nie *Registry. ŻADNEGO Saga* w
      publicznych nazwach.'
    rationale:
      'F9: brak nowej krawędzi w grafie, pakiet już hostuje tę rodzinę wzorców.
      "Stack" opisuje faktyczne zachowanie LIFO; "registry" obiecuje
      wyszukiwanie i usuwanie po kluczu, których nie ma. Saga* koliduje z
      redux-saga w ekosystemie JS i przyciąga pytanie o zakres, które reguła
      właściciela ma zamykać.'
    means:
      'Nowa funkcja trafia tam, gdzie już mieszkają mechanizmy odporności — bez
      zmian w strukturze biblioteki. Nazewnictwo świadomie unika słowa, które w
      tym ekosystemie znaczy coś innego.'
  - id: D-08
    choice:
      'Wyłącznie asynchronicznie, sekwencyjnie w odwrotnej kolejności, pętla
      for...of z try/catch WEWNĄTRZ każdej iteracji. NIGDY Promise.all na pętli
      kompensacji. Nieudana kompensacja nie przerywa pętli.'
    rationale:
      'To błąd poprawnościowy, nie preferencja wydajnościowa: pierwsze
      odrzucenie rozstrzyga Promise.all, podczas gdy pozostałe kompensacje
      biegną dalej nieobserwowane → unhandled rejection → domyślne zachowanie
      Node od v15 może wywrócić proces PÓŹNIEJ. LIFO odpowiada
      finally/RAII/defer/ExitStack. Odbiorca z faktycznie niezależnymi
      kompensacjami rejestruje JEDNĄ, która wewnętrznie robi Promise.allSettled.'
    means:
      'Cofanie zajętych zasobów dzieje się po kolei, od ostatniego do
      pierwszego, a awaria jednego kroku nie przerywa pozostałych. To eliminuje
      klasę błędów, w której proces wywraca się kilka sekund po tym, jak
      wszystko wyglądało na obsłużone.'
  - id: D-09
    choice:
      'Odwinięcie idempotentne przez ZATRZAŚNIĘCIE PROMISY (nie flagi boolean),
      żeby równoległe i powtórzone wywołania czekały na ten sam przebieg. Po
      sukcesie stos pozostaje UZBROJONY, żeby hook po rollbacku miał co robić.'
    rationale:
      'Bez zatrzasku ścieżka „porażka w środku przepływu" plus ścieżka „hook po
      wycofaniu transakcji" zwalniają zasób DWA RAZY — co jest gorsze niż
      niezwolnienie go wcale. Flaga boolean nie wystarcza przy dwóch
      równoległych await na tym samym stosie.'
    means:
      'Zwolnienie zasobu nigdy nie wykona się dwa razy, nawet jeśli aplikacja
      wywoła je z dwóch miejsc. Podwójne zwolnienie rezerwacji byłoby gorsze niż
      jej niezwolnienie.'
  - id: D-10
    choice:
      'Zajęcie zasobu i jego kompensacja rejestrowane JEDNYM wyrażeniem: API
      przyjmuje funkcję „zajmij" i funkcję „cofnij" razem, plus etykietę. Nie ma
      sposobu, żeby zająć zasób przez to API bez nazwania jego cofnięcia.'
    rationale:
      'Dwa z dziesięciu wadliwych handlerów konsumenta zepsuły się DOKŁADNIE
      dlatego, że „zarezerwuj" i „pamiętaj żeby zwolnić" to dwie osobne
      instrukcje. Zespolenie ich jest jedyną strukturalną częścią gwarancji (a).
      Reszta gwarancji (a) NIE JEST wymuszalna: nic nie złapie bezpośredniego
      wywołania z pominięciem tego API — to należy powiedzieć w dokumentacji
      wprost.'
    means:
      'Nie da się zająć zasobu, nie mówiąc od razu, jak go zwolnić. Dokładnie
      ten rozjazd stoi za dwoma z dziesięciu wadliwych miejsc u konsumenta.'
  - id: D-11
    choice:
      'Kształt porażki BEZWARUNKOWY: zawsze pierwotny błąd plus (możliwie pusta)
      lista porażek kompensacji. Nigdy unia z gołym typem błędu.'
    rationale:
      'Czyni odczyt pierwotnej przyczyny bezwarunkowym kodem u odbiorcy. To
      sekwencyjna przyczyna z Effect sprowadzona do najprostszej liniowej formy
      — w odróżnieniu od niezależnych błędów pól, porażki kompensacji NIE są
      równorzędne wobec pierwotnego błędu. Typ czyni stan „zasłonięty"
      niereprezentowalnym; nie wymusza natomiast poprawnego WYPEŁNIENIA pól.'
    means:
      'Aplikacja zawsze odczytuje pierwotną przyczynę awarii w ten sam sposób,
      niezależnie od tego, czy sprzątanie się powiodło. Nieudane sprzątanie
      nigdy nie zasłoni prawdziwego błędu.'
  - id: D-12
    choice:
      'Brak domyślnego limitu czasu i ponowień wewnątrz pętli kompensacji.
      Zamiast tego kompozycja istniejących polityk odporności wokół funkcji
      kompensacji (udokumentowana w 2b).'
    rationale:
      'Sygnał anulowania zatrzymuje CZEKANIE, a nie efekt uboczny —
      zaraportowanie przeterminowanego zwolnienia jako "failed" byłoby kłamstwem
      i stworzyłoby NOWĄ klasę cichych błędów. Gdyby limit kiedyś wszedł, musi
      mieć TRZECI stan (timedOut), nie failed. Reimplementacja retry/timeout
      dubluje to, co pakiet już wysyła.'
    means:
      'Nie udajemy, że przerwanie czekania oznacza cofnięcie operacji — to
      byłoby kłamstwo w logach. Limity czasu i ponowienia zostają tam, gdzie już
      są.'
  - id: D-13
    choice:
      'Brak ukrytego kontekstu globalnego (żadnego AsyncLocalStorage /
      node:async_hooks) i brak wpięcia w potok CQRS w v1. Prymityw nie przyjmuje
      argumentu transakcji.'
    rationale:
      'Ukryty magazyn ambientowy to niewidoczny stan i zobowiązanie co do
      środowiska uruchomieniowego. Brak argumentu transakcji sprawia, że warunek
      „nie zarządza granicą transakcji" jest prawdziwy Z KONSTRUKCJI, a nie z
      dyscypliny.'
    means:
      'Mechanizm da się użyć zarówno w środku operacji, jak i po wycofaniu
      transakcji, bo nie zarządza nią sam. Nic nie dzieje się w tle — wszystko
      widać w kodzie wywołującym.'
  - id: D-14
    choice:
      'Semver MINOR. Changesety: minor dla ddd-contracts i minor dla
      ddd-resilience. Regeneracja raportu API pakietu contracts przez
      validate:api:local; raport pakietu zbiorczego NIE zmieni się (F7). Zero
      ręcznej edycji pól version.'
    rationale:
      'Prywatny konstruktor Result czyni go NOMINALNYM, co wyklucza każdy
      scenariusz złamania przez typowanie strukturalne: atrapy nigdy nie były
      przypisywalne, implements nigdy nie był możliwy, keyof typeof Result
      wyłącznie się poszerza. Nowe statyki na istniejącej klasie są addytywne.
      Warto zapisać to uzasadnienie w changesecie — nie widać go z samego diffa.'
    means:
      'Wydanie nie łamie niczego u obecnych odbiorców — mogą zaktualizować bez
      zmian w swoim kodzie. Numer wersji ustala standardowy proces wydawniczy.'
  - id: D-15
    choice:
      'Usterki sprzed taska NIE są naprawiane tutaj — wychodzą jako osobne
      zadania: (i) barrel zbiorczy re-eksportujący Result z przestarzałej
      warstwy zgodności wbrew własnej dokumentacji (F2), (ii) test powierzchni
      eksportów ślepy na składowe (F8), (iii) dwie identyczne kopie kontekstu
      dla modeli bez generatora (F13), (iv) niezadeklarowana minimalna wersja
      kompilatora (F12).'
    rationale:
      'Żadna nie jest spowodowana przez VF-040; wpięcie ich rozdyma zadanie o
      priorytecie medium i zaciera recenzję. Pozycja (ii) zasługuje na szybkie
      osobne wejście, bo VF-040 jest pierwszą zmianą przechodzącą przez tę lukę.'
    means:
      'Przy okazji znaleźliśmy cztery starsze usterki i zapisujemy je osobno,
      zamiast rozdymać to zadanie. Jedna z nich — luka w automatycznej kontroli
      zmian w publicznym API — zasługuje na szybkie osobne wejście.'
  - id: D-16
    choice:
      'Brak trwałości deklarowany w PIERWSZYM akapicie dokumentacji: to
      mechanizm wewnątrzprocesowy, a jeśli proces zginie w połowie, kompensacja
      się nie wykona. Żadnej persystencji, odzyskiwania ani ponowień po
      restarcie.'
    rationale:
      'W literaturze o sagach „kompensacja" implikuje odporność na pad procesu.
      Bez tego zdania wisząca rezerwacja po ubiciu procesu zostanie przypisana
      bibliotece. To granica: wszystko, co wymaga trwałego zapisu „zająłem zasób
      X", jest po drugiej stronie.'
    means:
      'Od pierwszego zdania dokumentacji mówimy, czego ten mechanizm nie robi:
      nie ratuje sytuacji, w której proces zostaje ubity w połowie. Lepiej
      ustawić oczekiwania teraz niż tłumaczyć się po incydencie.'
  - id: D-17
    choice:
      'Item 3 przeskalowany: budowniczy reguł warunkowych JEST już w pełni
      udokumentowany (F4) — task myli się w tym punkcie. Prawdziwa luka to
      kombinatory Result (F5). Naprawić: przewodniki pakietów bazowego,
      narzędziowego i zbiorczego, plus @example w samym źródle (dziś zero), plus
      obie kopie kontekstu dla modeli.'
    rationale:
      'Dokumentowanie czegoś już udokumentowanego nie zmieniłoby proporcji 8 do
      2605 ani o jotę. Sam plik taska podaje ten punkt jako obserwację, nie jako
      zweryfikowany fakt — i tu weryfikacja go obala.'
    means:
      'Jedna z trzech zgłoszonych luk okazała się nieprawdziwa — ta funkcja jest
      opisana. Skupiamy wysiłek na tej, która faktycznie jest nieopisana, i
      dokładamy przykłady w samym kodzie, gdzie dziś nie ma ani jednego.'

open_questions:
  - id: OQ-1
    blocking: true
    q:
      'Prymityw kompensacji jest wyłącznie wewnątrzprocesowy: kompensacje biegną
      na ścieżkach porażki i przy jawnym wywołaniu po rollbacku, ale NIE po
      padzie procesu. Brak dziennika, persystencji, odzyskiwania po restarcie.
      Branżowe znaczenie słowa „kompensacja" (literatura o sagach) implikuje
      odporność na crash, więc odbiorcy odczytają gwarancję, której nie dajemy.
      Dołożenie trwałości później oznacza port persystencji, abstrakcję magazynu
      i semantykę odzyskiwania — czyli dokładnie terytorium sagi/process
      managera, które standing rule właściciela wyklucza, plus pytanie o
      zależność runtime (biblioteka jest bezzależnościowa z założenia).
      Stanowisko tech-analysis: jeśli właściciel nie jest gotów odmawiać
      trwałości TRWALE i wielokrotnie, item 2 nie powinien wyjść wcale —
      półśrodek tworzy ekspozycję na winę bez drogi wyjścia.'
    ask: >-
      Ten mechanizm sprząta po nieudanej operacji, ale nie po nagłym padzie
      procesu — i takiej gwarancji nigdy nie damy bez wejścia w obszar, który
      świadomie zostawiamy innym bibliotekom. Czy godzisz się odmawiać tego
      odbiorcom także za rok, gdy poproszą drugi i trzeci raz; jeśli nie, lepiej
      tej części w ogóle nie wydawać?
    answer: >-
      TAK — trzymamy granicę na stałe (właściciel, 2026-08-30). Biblioteka robi
      wyłącznie to, co należy do biblioteki DDD, i nie wychodzi poza to.
      Trwałość, odzyskiwanie po restarcie i orkiestracja wielu kroków są poza
      zakresem TRWALE, nie tylko w tym wydaniu. D-16 przestaje być rekomendacją
      i staje się zobowiązaniem: zastrzeżenie o braku trwałości musi być w
      pierwszym akapicie dokumentacji. OQ-1 rozstrzygnięte, S3 odblokowane.
  - id: OQ-2
    blocking: false
    q:
      'combineWithAllErrors zwraca skompaktowaną listę wyłącznie błędów, które
      wystąpiły, więc pozycja N nie odpowiada wejściu N (D-04). Historia
      produktowa z raportu („użytkownik z pięcioma błędnymi polami widzi
      wszystkie pięć") obowiązuje więc TYLKO wtedy, gdy obiekty błędów po
      stronie konsumenta już niosą przynależność do pola. Jeśli nie niosą,
      konsument dostaje pięć anonimowych błędów i historia nie działa — a
      lekarstwem jest wariant kluczowany nazwą pola, odłożony w D-04 (dołożenie
      później jest addytywne). Jedno pytanie do zespołu konsumenta rozstrzyga,
      czy odłożenie jest bezpieczne.'
    ask: >-
      Żeby użytkownik zobaczył naraz wszystkie błędne pola formularza,
      komunikaty błędów po stronie aplikacji muszą same nieść nazwę pola. Czy
      dopytać zespół konsumenta, jak jest u nich — jeśli nie niosą, dołożymy
      wariant z błędem przypisanym do pola, ale to dodatkowa praca w kolejnym
      wydaniu?
    answer: >-
      ROZSTRZYGNIĘTE — wariant kluczowany nazwą pola NIE jest potrzebny
      (odpowiedź konsumenta, 2026-08-30). U konsumenta walidacja formatu na
      granicy API już dziś zbiera wszystkie błędy naraz i niesie nazwę pola — to
      warstwa poza handlerem, której nasza funkcja w ogóle nie dotyczy. W
      warstwie domenowej część ich klas błędów niesie opcjonalną nazwę pola,
      część nie, ale to ich niespójność do uporządkowania po ich stronie, nie
      nasza. Jedyne, czego od nas potrzebują: zwrócić tablicę oryginalnych
      obiektów błędu i NIE spłaszczać jej do komunikatów — wtedy sami wyciągną
      nazwę pola tam, gdzie jest. Nasz projekt już to spełnia; warunek
      przeniesiony do D-04 i wymaga testu.
  - id: OQ-3
    blocking: false
    q:
      'S1 (dokumentacja) + S2 (combine) to ~6h, niskie ryzyko, dotyka wyłącznie
      pakietu bazowego i dostarcza pozycję o największym zasięgu. S3
      (kompensacja) to ~6h, dotyka pakietu odporności i jest zablokowane przez
      OQ-1. Mogą wyjść jako jeden minor albo jako dwa kolejne minory.
      AKTUALIZACJA 2026-08-30 (odpowiedź konsumenta): konsument NIE zaczął
      własnej ekstrakcji i deklaruje, że wstrzyma się z nią, jeśli dostanie od
      nas orientacyjny termin albo uzgodni kształt interfejsu zawczasu. To
      podnosi cenę odkładania S3 — odkładając je, blokujemy ich planowaną pracę,
      zamiast tylko przesuwać własną. Tania ścieżka pośrednia, niezależna od
      wyboru wydania: wysłać im szkic API z tej analizy do uzgodnienia TERAZ.'
    ask: >-
      Konsument nie zaczął jeszcze własnej wersji tego mechanizmu i wstrzyma
      się, jeśli damy mu orientacyjny termin — więc odkładanie tej części
      blokuje teraz także jego pracę, nie tylko naszą. Wydajemy najpierw
      dokumentację i łączenie wyników, a sprzątanie zasobów w kolejnym wydaniu,
      czy wszystko naraz?
    answer: >-
      WSZYSTKO NARAZ — właściciel przyjął domyślny zakres z D-01 przy
      zatwierdzeniu (2026-08-30): trzy kawałki w jednym wydaniu minor.
      Uzasadnienie: konsument wstrzymuje własną pracę i czeka na nas, więc
      dzielenie na dwa wydania oszczędza nam mało, a jego blokuje dłużej.
---

# Analiza: VF-040 — łączenie wyników i prymityw kompensacji

## Synteza

Zadanie przyszło z audytu aplikacji odbiorcy i zgłasza trzy sprawy. Dwie z nich
potwierdziły się co do joty: nie mamy sposobu łączenia wielu wyników w jeden,
nie mamy też żadnego mechanizmu sprzątania po zasobach zajętych poza transakcją
bazy danych. Trzecia — o tym, że dwie mocne funkcje są nieodkrywalne — okazała
się trafna tylko w połowie. Jedna z nich jest opisana obszernie i to nie tam
leży problem; druga nie ma w dokumentacji ani jednego przykładu użycia, a w
samym kodzie nie ma ich zero. Skupiamy wysiłek tam, gdzie luka jest realna.

Rekomendacja to trzy niezależne kawałki wydane w tej kolejności: najpierw
dokumentacja i przykłady, bo mają największy zasięg i zerowe ryzyko; potem
łączenie wyników, tanie i natychmiastowe; na końcu mechanizm sprzątania, który
niesie największą wartość, ale też jedyne pytanie, na które musisz odpowiedzieć
przed startem. Wszystko, co odkładamy — warianty spekulacyjne i limity czasu —
da się dołożyć później bez łamania zgodności, więc odłożenie nic nie kosztuje.

Wartość mechanizmu sprzątania nie jest teoretyczna. U odbiorcy ten sam protokół
jest przepisany ręcznie w dziesięciu miejscach, z czego dwa mają dziś ścieżki,
po których zajęty zasób nigdy nie wraca. Nic tego nie sygnalizuje — ani
kompilator, ani działająca aplikacja. Klucz do naprawy jest zaskakująco prosty:
nie da się zająć zasobu, nie mówiąc od razu, jak go zwolnić.

## Ryzyka / uwagi

1. **Słowo „kompensacja" obiecuje więcej, niż dajemy.** W literaturze branżowej
   oznacza odporność na nagły pad procesu. Jeśli u odbiorcy zostanie wisząca
   rezerwacja po ubiciu aplikacji, wina spadnie na bibliotekę — nawet jeśli
   nigdy tego nie obiecywaliśmy. Zabezpieczenie: zastrzeżenie w pierwszym
   akapicie dokumentacji. Powiązane z OQ-1.
2. **Pełzanie zakresu.** Wydanie mechanizmu sprzątania otwiera kolejkę próśb o
   trwałość, ponowienia po restarcie i orkiestrację wielu kroków. Każda z nich
   to wejście w obszar świadomie zostawiony dedykowanym bibliotekom, a
   odmawianie będzie kosztować czas przy każdym kolejnym wydaniu.
3. **To, co wydamy, zamrażamy.** Publikujemy dla zewnętrznych odbiorców od maja
   — nową nazwę da się później poszerzyć, ale nie da się jej poprawić bez wersji
   łamiącej. Dlatego celowo publikujemy jak najmniej nazw.
4. **Luka w automatycznej kontroli zmian.** Istniejący test pilnuje tylko listy
   nazw najwyższego poziomu, więc nie widzi elementów dokładanych do istniejącej
   klasy. To zadanie jest pierwszym, które przez tę lukę przechodzi bez sygnału.
   Zabezpieczenie: ręcznie odświeżony raport dla pakietu bazowego; poprawka luki
   wychodzi osobno.
5. **Nie mówimy odbiorcom, jakiego kompilatora wymagamy.** Żaden pakiet tego nie
   deklaruje, więc każda nowsza składnia w plikach typów to ryzyko po ich
   stronie. W tym zadaniu jej unikamy; deklarację zapisujemy jako osobne
   zadanie.
6. **Niespójność w pakiecie zbiorczym.** Główny pakiet udostępnia podstawowy typ
   wyniku ze starej warstwy zgodności, podczas gdy dokumentacja tej warstwy
   odradza jej używanie. Usterka sprzed tego zadania, ale każde nowe API na tym
   typie zwiększa liczbę osób, które trafią tam nie tą drogą.
7. **Odbiorca planuje własny mechanizm sprzątania — ryzyko zdjęte, pojawiło się
   zobowiązanie.** Potwierdzili, że nie zaczęli i wstrzymają się, jeśli dostaną
   od nas termin albo uzgodniony kształt interfejsu. Dublowanie pracy już nam
   nie grozi, ale teraz to oni czekają na nas: milczenie z naszej strony blokuje
   ich planowaną pracę. Zabezpieczenie: wysłać im szkic API do uzgodnienia, nie
   czekając na wydanie.
8. **Harmonogram (niskie).** Dwanaście godzin wystarcza wyłącznie na uzgodniony
   zakres. Powrót któregokolwiek z odłożonych elementów podnosi szacunek do
   około osiemnastu.

## Podział na kawałki

| #   | Kawałek                                                                       | Nakład   | Blokada      |
| --- | ----------------------------------------------------------------------------- | -------- | ------------ |
| S1  | Dokumentacja kombinatorów wyniku + `@example` w źródle + obie kopie kontekstu | ~3h      | brak         |
| S2  | `combine` + `combineWithAllErrors`, wariant krotkowy, wspólne `E`             | ~3h      | brak         |
| S3  | Prymityw kompensacji (stos + cukier) w pakiecie odporności                    | ~5-6h    | **OQ-1**     |
| —   | Wariant z sygnałem anulowania + kompozycja z politykami odporności            | odłożone | nowe zadanie |
| —   | Warianty kluczowane nazwą pola                                                | odłożone | OQ-2         |

Najmniejszy sensowny wycinek: **S1 samodzielnie**. Nie wymaga zmiany raportu API
ani changesetu poza dokumentacyjnym, a to on faktycznie rusza proporcję 8
do 2605.

## Checklista dla implementera (bramki repo)

- `pnpm run validate:api:local` → regeneruje **wyłącznie**
  `packages/contracts/api-report/ddd-contracts.api.md` (F6). Raport pakietu
  zbiorczego **nie zmieni się** (F7) — jakikolwiek diff w `events`,
  `value-objects`, `nestjs` traktować jako sygnał ostrzegawczy, nie jako
  oczekiwany artefakt.
- `packages/contracts/tests/api-surface.test.ts` — snapshot **nie ruszy się** od
  nowych statyk (F8). Jeśli aliasy typów zostaną wewnętrzne zgodnie z D-06, nie
  ruszy się w ogóle.
- `packages/resilience/tests/api-surface.test.ts` — snapshot **ruszy się** przy
  nowych eksportach top-level (F10); zaktualizować świadomie.
- `pnpm run validate:exports` — uruchomić, nie zakładać wyniku (VF-040 nie
  dokłada nowych podścieżek `exports`, więc spodziewany no-op).
- Nowy changeset: `minor` dla `@vytches/ddd-contracts`, `minor` dla
  `@vytches/ddd-resilience`. Zero ręcznej edycji pól `version` — bumpy robi
  proces wydawniczy.
- `Error.cause` **nie przejdzie type-checku** przy obecnej konfiguracji (F11) —
  kształt porażki z D-11 go nie potrzebuje; nie sięgać po niego odruchowo.
