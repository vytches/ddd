---
task: VP-012-hotpath-quickwins
status: approved # zatwierdzone przez użytkownika 2026-08-20 — wszystkie propozycje odpowiedzi (OQ-1..OQ-5) i decyzje D1-D5 zaakceptowane bez zmian

threat_model: null # brak stage'a threat-model w panelu tego projektu; ryzyko bezpieczeństwa (OQ-1) omówione jako decyzja D3, nie jako STRIDE/DREAD/LINDDUN

parent_task: project-orchestration/tasks/VP-012-hotpath-quickwins.md # plik ma priority:normal/status:backlog — DRIFT, patrz D5; task realnie P1 od promocji 2026-08-09
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml

panel: # runtime.yml analyze.panel, przebieg 2026-08-19
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 15,
    }
  - {
      stage: tech-analysis-specialist,
      agent: 'backend-technology-expert',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 8,
    }
  - {
      stage: api-surface-analysis,
      agent: 'library-api-guardian',
      model: sonnet,
      when: 'trafienie "publiczn" ← AC5 "Zero zmian publicznego API"',
      wynik: ok,
      tool_uses: 14,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'brak trafienia when: (nowy pakiet|granic|boundary|tag
        |scope:|cykl|circular|przenieś|wydziel|extract) — task nie tworzy
        pakietu ani nie przenosi kodu między granicami Nx',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga:
        'frontmatter agenta mówi haiku; nadpisane zgodnie z polityką /analyze',
    }
  # pominięte kroki silnika: 0a (brak stage'a threat-model), 0.7 (brak bloku ddd/core),
  # 0.8 (brak stage'a decision-gate), 0.9 (governance nieaktywny — brak bloku governance w projekcie)

consultation_2026_08_20: # ad-hoc, poza panelem runtime.yml — na żądanie użytkownika, kryterium "long-term, nie quick-fix"
  agents: [library-api-guardian, library-expert, developer-experience]
  pytanie:
    'Dla OQ-1/OQ-2/OQ-3 — które rozstrzygnięcie jest właściwe w perspektywie
    wieloletniej, nie najtańsze dziś?'
  wynik:
    zgodny (wszyscy trzej potwierdzają Plan A dla OQ-2, R1-teraz+ADR-później dla
    OQ-1); dwa nowe fakty (F15, F16) i trzy nowe wymogi dopisane do D2/D3/D4

rag:
  skipped (brak MCP retrieve_code/retrieve_patterns w tej sesji; grounding ze
  statycznej listy patterns.always + celowana weryfikacja grepem/Read każdego
  nazwanego symbolu w obu repo, przed panelem i po nim)

# Fakty ustalone empirycznie (grep/Read bezpośrednio w kodzie) — wiążące dla implementera.
codebase_facts:
  F1_KOREKTA:
    "Opis w § Dlaczego pliku taska mówi o AuditCapability wywołującym
    getDomainEvents(), który 'robi pełną kopię spread'. NIEAKTUALNE:
    aggregate-root.ts:243 dziś robi `.map(event => LibUtils.deepFreeze(event))`
    + `Object.freeze()` na całej tablicy przy KAŻDYM wywołaniu — implementacja
    VF-023 (deep-freeze domain events), droższa niż spread copy, nie tańsza."
  F2:
    'Precedens do naśladowania istnieje i jest zweryfikowany:
    INTERNAL_STATE_TOKEN (aggregate-root.ts:35) — moduł-prywatny unique symbol,
    NIE eksportowany z publicznego barrela packages/aggregates/src/index.ts
    (potwierdzone czytaniem całego pliku), bramkuje _internal_setState (linia
    575). SnapshotCapability (capabilities/snapshot-capability.ts:5,164-173)
    dociera do niego przez lokalny strukturalny cast + głęboki import
    wewnątrz-pakietowy — zero śladu w IAggregateRoot interface ani w index.ts.'
  F3:
    'loadFromHistory() (aggregate-root.ts:454) woła handleEvent(), NIE apply().
    Replay/rehydratacja NIE przechodzi przez interceptor AuditCapability (który
    monkey-patchuje apply) i NIE cierpi na O(N²). Zweryfikowane bezpośrednio —
    zamyka wątpliwość podniesioną w panelu przez dwóch agentów niezależnie.'
  F4:
    'transformDomainEvents() (aggregate-root.ts:297) używa enrichEvent()
    (contracts/domain-event-utils.ts:72), który buduje NOWY obiekt przez
    Object.create+Object.assign, NIE mutuje w miejscu. JSDoc funkcji explicite
    dokumentuje że wejście bywa zamrożone. Hipoteza architekta o możliwej
    kolizji z VF-023 freeze zweryfikowana jako NIEPRAWDZIWA — nie jest to bug.'
  F5:
    'LibUtils.deepFreeze(obj, seen = new WeakSet()) (lib-utils.ts:352) —
    domyślny parametr seen alokowany ŚWIEŻO per element w .map() (nie raz per
    top-level wywołanie getDomainEvents()). N elementów = N alokacji WeakSet per
    wywołanie, N²/2 łącznie przy N zaaplikowanych zdarzeniach. Krótkie spięcie
    na Object.isFrozen (linia 359) czyni re-freeze tanim, ale alokacja WeakSet i
    tak następuje przed sprawdzeniem.'
  F6_KOREKTA:
    'cached-policy.ts hashString() (linia 369) już DZIŚ robi .slice(0,32) na
    SHA-256 hex — 128-bit prefix, NIE pełne 64 znaki jak sugerował opis taska.
    Ważne dla oceny ryzyka: to był wcześniejszy fix po former djb2 (komentarz w
    kodzie), więc obecna implementacja ma świadomie wybraną, wysoką odporność
    kolizyjną — zamiana na 32-bit FNV-1a byłaby DUŻYM krokiem wstecz w tej
    metryce, nie neutralną zamianą prymitywu.'
  F7:
    'generateCacheKey() (cached-policy.ts:283) woła hashString() DWA razy na
    check (contextHash, entityHash), złożony klucz
    `${namespace}:${contextHash}:${entityHash}`. Struktura złożona NIE dzieli
    ryzyka kolizji na bezpieczną sumę: kolizja cross-user na TEJ SAMEJ encji
    wymaga kolizji tylko contextHash — czysta przestrzeń 32-bit, jeśli
    zamieniona na FNV-1a.'
  F8:
    'FNV-1a (enhanced-query-bus.ts:100-108) jest analitycznie odwracalny
    (mnożnik 0x01000193 nieparzysty mod 2³²) — kolizje NIE wymagają brute-force,
    liczy się je wprost, jeśli atakujący kontroluje choćby część wejścia
    (self-service userId, dowolne pole encji, bo entityHash liczy się z
    JSON.stringify(request.entity), linia 294).'
  F9:
    "check() (cached-policy.ts:254-257) zwraca zcache'owany Result<T,
    PolicyViolation> BEZPOŚREDNIO przy hit. Kolizja klucza nie psuje tylko
    werdyktu allow/deny — może zwrócić cudzy Result<T> niosący CUDZĄ ENCJĘ.
    Impact realistycznie sięga cross-tenant data disclosure, nie tylko authz
    bypass."
  F10:
    'Cytowany w tasku precedens (enhanced-query-bus.ts:754-763, komentarz
    "~5-10× faster") mierzy FNV-1a vs JSON.stringify, NIE vs SHA-256/hashString.
    Liczby się nie transferują do oceny fixu #2. Dodatkowo ten cache to wyniki
    ZAPYTAŃ (query results), nie decyzje autoryzacyjne — inna klasa ryzyka przy
    kolizji.'
  F11_niepotwierdzone:
    'Komentarz przy fnv1a32 sugerujący że "collision = cache miss, not
    corruption" dla EnhancedQueryBus nie został zweryfikowany (getCacheKey
    caller nie przeczytany w tej analizie) — jeśli fałszywy, query-bus ma już
    dziś latentnie tę samą klasę problemu co F-H14. Nie blokuje VP-012,
    rekomendowany jako osobny task weryfikacyjny (patrz decisions D4).'
  F12:
    'executeInParallel (enhanced-command-bus.ts:649-670): podwójny Promise.race
    potwierdzony. Kolaps do jednej race z indeksem jest matematycznie poprawny
    (FIFO microtask + already-settled parent → zawsze najniższy
    faktycznie-settled indeks, ta sama własność zachowana). Osobno:
    results.push() (linia 658) daje tablicę w kolejności UKOŃCZENIA, nie
    kolejności wejściowej commands — pre-existing bug, nie regresja tego fixu.'
  F13:
    'library-api-guardian potwierdził czytaniem
    index.ts/aggregate-interfaces.ts: _internal_setState NIE jest częścią
    IAggregateRoot interface, tylko na konkretnej klasie AggregateRoot — więc
    AC5 (zero zmian publicznego API) jest osiągalne dla analogicznego
    _internal_peekLastEvent, POD WARUNKIEM że nowa metoda trafi tylko na klasę,
    nigdy do interfejsu ani do index.ts.'
  F14_boczne:
    "Przy okazji czytania cached-policy.ts ujawnione trzy defekty NIE związane z
    F-H14, poza zakresem tego taska: B1 (PolicyCache bez sweepera, maxSize
    opcjonalne → nieograniczony wzrost przy create()/withTTL()/withCustomKey()
    bez jawnego maxSize — linie 116-142); B2 (linia 469: `cacheFailures:
    options.cacheFailures || true` zawsze true, opcji nie da się wyłączyć mimo
    że JSDoc klasy ostrzega przed cache'owaniem deny/allow — to jest bug
    logiczny, nie dług); B3 (latentny LRU node leak przy re-set na istniejący
    klucz, dziś nieosiągalny przez check(), bo miss zawsze robi
    delete+removeNode przed set)."
  F15_konsultacja:
    'library-expert zgrepował samodzielnie wszystkie mutacje _domainEvents:
    dokładnie 4 miejsca (apply() l.406, commit() l.252, transformDomainEvents()
    l.297, loadFromHistory() l.456), wszystkie w jednym pliku aggregate-root.ts,
    pole private (niedostępne z podklas bez as any). Warunek przejścia z planu A
    na plan B z D2 ("mutowane z >2-3 miejsc lub przez podklasy") NIE ZACHODZI —
    zamyka OQ-2 na korzyść planu A z wysoką pewnością.'
  F16_konsultacja_KOREKTA:
    "developer-experience ujawnił, że B2 jest POWAŻNIEJSZY niż pierwotny opis.
    Nie chodzi tylko o to, że cacheFailures nie da się wyłączyć — w
    forExpensivePolicy() (cached-policy.ts:469) jawne `cacheFailures: false`
    przekazane przez konsumenta jest PO CICHU NADPISYWANE na true (`false ||
    true` = `true`). To odwraca świadomą decyzję konsumenta czytającego własny
    JSDoc klasy ostrzegający przed cache'owaniem deny/allow, nie tylko 'opcja
    nieoperacyjna'. Podnosi pilność B2 powyżej oryginalnej oceny panelu."

open_questions:
  - id: OQ-1
    blocking: true
    ask: >-
      Czy zgadzasz się, żeby przyspieszenie sprawdzania uprawnień w tej paczce
      ograniczyć do bezpiecznego zmniejszenia pracy o połowę, a mocniejszy
      wariant z pierwotnego opisu zadania przenieść do osobnej decyzji
      bezpieczeństwa? W najgorszym scenariuszu ten mocniejszy wariant mógłby
      pozwolić jednemu użytkownikowi zobaczyć zcache'owaną decyzję dotyczącą
      innego użytkownika.
    q: >-
      F-H14: dwa niezależne raporty panelu (ecc:architect,
      backend-technology-expert) niezależnie odrzucają bare FNV-1a-32 jako klucz
      CachedPolicy. Wektor: kolizja w 32-bitowym contextHash (cross-user, ta
      sama encja) jest realna nawet przypadkowo przy 10k-77k żywych kluczach
      (F7), a FNV-1a jest analitycznie odwracalny (F8), więc adwersarz
      kontrolujący fragment wejścia wymusza kolizję z p≈1. check() zwraca
      Result<T> z encją przy hit (F9) — impact to cross-tenant data disclosure,
      nie zły boolean. Cytowany precedens mierzył FNV vs JSON.stringify, nie vs
      SHA-256 (F10), a obecny hash to już 128-bit prefix, nie pełny SHA-256
      (F6). Proponowane rozstrzygnięcie: VP-012c = R1 (jeden połączony digest
      zamiast dwóch, separator jako prefiks długości — NIE goły NUL, bo NUL jest
      już wewnętrznym separatorem pól contextRaw, linia 305 — otwierałby atak
      przesunięcia granicy context/entity), zero zmiany profilu bezpieczeństwa,
      −50% wywołań digest, merge WARUNKOWY po benchmarku (patrz OQ-4).
      Mocniejszy wariant (R4: sync node:crypto przez wstrzykiwany hashFn; R5:
      FNV jako indeks kubełka + weryfikacja pełnego klucza w CacheEntry, kolizja
      degraduje się do miss zamiast do authz bypass) → osobny task z ADR i
      review security-privacy-architect, poza VP-012.
    answer: >-
      PROPOZYCJA (konsultacja 2026-08-20, 3/3 zgodni) — TAK, R1 teraz + ADR
      później, i to NIE jest "naprawa dwa razy": hashString/generateCacheKey są
      prywatne (zero API surface), a PolicyCacheConfig ma już dziś publiczny
      keyGenerator jako escape hatch, więc nikt nie czeka bez opcji. Dodatkowe
      wymogi dopisane do D3: (a) VP-012c dostaje krótki TM-VP-012c.md (wzorem 12
      istniejących threat-modeli), żeby przyszła sugestia "przyspieszmy
      hashowanie" miała gotowy kontekst zamiast zaczynać od zera; (b) JSDoc
      klasy dostaje jawny non-goal ostrzegający przed FNV-1a/djb2 jako
      "collision resistance to własność bezpieczeństwa, nie detal
      implementacji"; (c) NIE ujednolicać mechanizmu hashowania z
      enhanced-query-bus — to różne klasy ryzyka (query cache vs authz cache),
      wspólny prymityw hashujący to osobna, większa inwestycja wymagająca
      własnego ADR, nie część VP-012. Czeka na jawne potwierdzenie człowieka.
  - id: OQ-2
    blocking: true
    ask: >-
      Czy akceptujesz, że przyspieszenie odczytu historii zdarzeń dotknie
      wspólnego mechanizmu używanego przez sześć modułów biblioteki — większy
      zysk niż łatka w jednym miejscu, ale wymaga pełnego przebiegu testów
      regresyjnych zamiast wąskiej, izolowanej zmiany?
    q: >-
      F-H13, plan A (rekomendowany) vs plan B. Plan A: memoizacja zamrożonej
      tablicy wewnątrz AggregateRoot.getDomainEvents + dirty flag, inwalidowana
      w apply/commit/loadFromHistory/transformDomainEvents. Naprawia 14 call
      site'ów w 6 pakietach (nestjs, repositories, events, testing, contracts,
      aggregates) zamiast tylko AuditCapability; nie dodaje krawędzi modułowej
      core↔capabilities (zero ryzyka cyklu w ESM+CJS interopie, o którym
      ostrzegał architekt dla planu B); rozpuszcza ryzyko regresji integralności
      forensycznej z VF-023 D-3 (audit log dalej czyta event PO deepFreeze — nic
      się nie zmienia w tej gwarancji), zamiast łatać to ręcznym deepFreeze
      pojedynczego eventu w recordEvent, co łatwo pominąć w przyszłym
      refaktorze. Koszt: zmienia się TOŻSAMOŚĆ zwracanej tablicy (ta sama
      referencja do czasu inwalidacji zamiast nowej za każdym razem) — aliasing
      jest bezpieczny (tablica i tak zamrożona), ale testy asercjonujące
      `not.toBe` między wywołaniami pękną; wymaga grepu po takich asercjach w 6
      pakietach + `nx run-many -t test` na wszystkich przed merge. Uzupełnienie
      w obu planach: hoisted `seen = new WeakSet()` zamiast domyślnego
      per-element w `.map()` (F5) — eliminuje N alokacji per wywołanie także
      przy pierwszym, niecache'owanym przebiegu. Plan B (token-gated
      `_internal_peekLastEvent`, wzorem INTERNAL_STATE_TOKEN, F2/F13) zostaje
      jako fallback, jeśli grep ujawni że `_domainEvents` jest mutowane z więcej
      niż 2-3 miejsc lub przez podklasy poza kontrolą tego taska — wtedy
      szczelna inwalidacja jest nierealna i wąska łatka tokenowa jest
      bezpieczniejsza.
    answer: >-
      PROPOZYCJA (konsultacja 2026-08-20, 3/3 zgodni) — TAK, plan A. Warunek
      przejścia na plan B nie zachodzi (F15_konsultacja — dokładnie 4 miejsca
      mutacji, jeden plik). Dodatkowe wymogi dopisane do D2, obowiązkowe w TYM
      SAMYM PR co implementacja (nie later): (a) JSDoc metody getDomainEvents()
      dostaje akapit wzorem bloku VF-023 (linie 231-241), jawnie stwierdzający
      że zwracana referencja jest stabilna między wywołaniami do najbliższej
      mutacji — bez tego zapisu to ukryty dług wg prawa Hyruma, nie brak długu;
      (b) CHANGELOG dostaje sekcję "Consumer Impact Checklist" wzorem VF-023, z
      gotowym grepem dla konsumenta (`grep -rn "getDomainEvents()" src/ | grep
      -i "toBe\|===\|!=="`); (c) LLMGUIDE aggregates (linia ~89, tabela metod +
      przykład l.43) zaktualizowane w tym samym PR, żeby przykład kodu i opis
      metody się nie rozjechały. Czeka na jawne potwierdzenie człowieka.
  - id: OQ-3
    blocking: true
    ask: >-
      Przy okazji tego audytu znaleziono w tym samym miejscu inną pamięć
      podręczną, która może rosnąć bez ograniczenia, oraz przełącznik, którego
      mimo dokumentacji nie da się dziś wyłączyć. Czy mają dostać własne zadania
      z priorytetem WYŻSZYM niż to, zamiast wchodzić w zakres tego zadania?
    q: >-
      F14_boczne — trzy defekty w cached-policy.ts poza zakresem F-H14: B1
      (PolicyCache bez sweepera, maxSize opcjonalne → nieograniczony wzrost
      pamięci przy braku jawnego maxSize — oceniane jako POWAŻNIEJSZE niż koszt
      hashowania, wymaga mini-designu: domyślny maxSize vs wymagany vs sweeper
      TTL, nie jest łatką); B2 (`cacheFailures: options.cacheFailures || true`
      zawsze true, opcja martwa mimo że JSDoc klasy explicite ostrzega przed
      cache'owaniem deny/allow w politykach autoryzacyjnych — to jest bug, nie
      dług techniczny, fix ~15 min + test, ale zmienia zachowanie konsumentów
      dziś nieświadomie polegających na cache'owaniu odmów, patrz OQ-5); B3
      (latentny LRU node leak przy re-set istniejącego klucza, dziś nieosiągalny
      przez check() — proponowany jako AC w tasku B1, nie osobny ticket).
      Rekomendacja panelu: dwa osobne taski (B2 samodzielnie, B1+B3 razem), oba
      priorytet wyższy niż VP-012, żaden nie rozszerza tego taska.
    answer: >-
      PROPOZYCJA (konsultacja 2026-08-20, zmieniona vs oryginalna rekomendacja
      panelu) — TAK, osobne zadania, priorytet wyższy niż VP-012, ale JEDNO
      zadanie "PolicyCache v2" (mini-ADR) obejmujące B1+B2+B3 RAZEM, nie "B2
      osobno, B1+B3 razem" jak proponował pierwotny panel. Powód zmiany:
      library-expert ocenia, że to trzy objawy jednego braku (PolicyCache nie ma
      spójnego kontraktu limitów/sweep/LRU) i łatanie ich osobnymi PR-ami w
      krótkim odstępie zwiększa ryzyko regresji na tej samej strukturze węzłów
      LRU. B2 wymaga jednak PILNIEJSZEGO fixu logiki (`??` zamiast `||`) niż
      reszta — F16_konsultacja pokazuje że jest poważniejszy niż "opcja martwa":
      jawne `cacheFailures: false` konsumenta jest po cichu nadpisywane.
      Dodatkowy wymóg: test kontraktowy `policy-cache-config.contract.spec.ts`
      pilnujący zgodności JSDoc↔zachowanie dla WSZYSTKICH opcji configu w tym
      pliku (nie tylko cacheFailures) + grep `options\.\w+ \|\|
      (true|false|0|'')` po całym cached-policy.ts (ten typ buga lubi występować
      wielokrotnie w jednym pliku). Czeka na jawne potwierdzenie człowieka.
  - id: OQ-4
    blocking: false
    ask: >-
      Dla dwóch z trzech poprawianych fragmentów kodu brakuje dziś narzędzia do
      pomiaru wydajności "przed/po", którego zadanie wymaga jako dowodu. Czy
      wart jest dodatkowy czas na jego zbudowanie, czy zamykamy tę część bez
      liczb, opierając się na ocenie inżynierskiej?
    q: >-
      AC4 wymaga `pnpm bench` before/after, ale `benchmarks/suites/` zawiera
      dziś wyłącznie aggregates, di i nestjs — dla policies i cqrs suity NIE
      ISTNIEJĄ (~2-3h ich napisania, nieuwzględnione w oryginalnej estymacie
      6h). Bez suity dla policies VP-012c nie ma jak spełnić warunek z OQ-1
      ("merge tylko jeśli zysk realny ponad dominujący JSON.stringify(entity)").
      Opcja: napisać suitę dla policies (przyda się też przyszłej decyzji R4/R5
      z OQ-1), a dla cqrs zrezygnować z AC4 i uzasadnić VP-012a wyłącznie
      czytelnością kodu (mikro-optymalizacja, wartość głównie w usunięciu
      zbędnego await hopu, nie w mierzalnym zysku — patrz F12).
    answer: >-
      PROPOZYCJA (spójna z kryterium long-term użytkownika) — budować suitę dla
      policies teraz (przyda się też przyszłej decyzji R4/R5 z OQ-1, więc to nie
      jest koszt jednorazowy). Dla cqrs zrezygnować z osobnej suity — VP-012a
      jest uczciwie mikro-optymalizacją czytelności (F12), benchmark niczego by
      tu nie udowodnił ponad to, co już wiadomo z analizy kodu. Czeka na
      potwierdzenie człowieka.
  - id: OQ-5
    blocking: false
    ask: >-
      Naprawa martwego przełącznika z OQ-3 zmieni realne zachowanie u tych,
      którzy dziś nieświadomie korzystają z jego zepsutej wersji (cache'owanie
      odmów zamiast tylko zgód). Czy to ma iść jako zwykła poprawka, czy
      potrzebuje wzmianki w informacji o wydaniu?
    q: >-
      B2 (patrz OQ-3): przywrócenie działania `cacheFailures` jest formalnie
      bugfixem (opcja udokumentowana w JSDoc, dziś nieoperacyjna przez `||`
      zamiast `??`), ale zmienia liczbę realnych wywołań wewnętrznej polityki u
      konsumentów którzy dziś przypadkowo cache'ują odmowy. Pytanie o
      klasyfikację semver/changelog przy Lerna-managed bumpie (patrz pamięć
      projektu o wersjonowaniu).
    answer: >-
      PROPOZYCJA (konsultacja 2026-08-20, 2/2 zgodni na tym punkcie) — TAK,
      wzmianka w release notes obowiązkowa NIEZALEŻNIE od klasyfikacji semver.
      Uzasadnienie: kształt eksportowanego typu się nie zmienia (semver nie
      wymusi MAJOR), ale zachowanie realnie się zmienia u konsumentów dziś
      nieświadomie polegających na zepsutej wersji — mechanika wersjonowania
      sama tego nie wykryje, więc trzeba to nazwać ręcznie, tak jak zrobiono dla
      VF-023. Czeka na potwierdzenie człowieka.

decisions:
  - id: D1
    topic: 'Struktura zadania — podział na jednostki'
    choice: >-
      SPLIT na trzy niezależne jednostki bez wzajemnych zależności (patrz
      `units` niżej): VP-012a (executeInParallel, zero ryzyka, merge od razu),
      VP-012b (AuditCapability/getDomainEvents, wymaga OQ-2), VP-012c
      (CachedPolicy hash, wymaga OQ-1+OQ-4).
    means: >-
      Zamiast jednego zadania robimy trzy osobne — różnią się ryzykiem na tyle,
      że trzymanie ich razem blokowałoby pewny, szybki zysk przez tydzień
      dyskusji o bezpieczeństwie dotyczącej zupełnie innej części kodu.
    rationale: >-
      Trzy fixy nie dzielą kodu, plików, ani profilu ryzyka — jedyne co je
      łączyło to wspólny nagłówek audytu wydajności (LIB-AUDIT-2026-07-02). AC4
      (bench bez regresji) zostaje wymogiem per-jednostka, nie zbiorczym.
  - id: D2
    topic:
      'F-H13 — mechanizm fixu: memoizacja (plan A) vs token-gated accessor (plan
      B)'
    choice: >-
      PLAN A jako rekomendacja domyślna (memoizacja w getDomainEvents + dirty
      flag + hoisted WeakSet), plan B jako formalny fallback warunkowany
      wynikiem grepu z OQ-2.
    means: >-
      Naprawiamy mechanizm współdzielony przez sześć modułów biblioteki, a nie
      tylko jedno miejsce — większy zysk za cenę pełniejszych testów przed
      wypuszczeniem.
    rationale: >-
      Plan A rozwiązuje problem u źródła (getDomainEvents samo jest kosztowne
      dla KAŻDEGO wołającego, nie tylko AuditCapability — 14 call site'ów w 6
      pakietach) i unika dwóch realnych kosztów planu B: nowej krawędzi
      modułowej core↔capabilities (ryzyko cyklu w ESM+CJS interopie) oraz
      konieczności strukturalnego castu bez gwarancji runtime (feature-detect +
      fallback dla custom IAggregateRoot/test doubles). Rozpuszcza też ryzyko
      regresji integralności audytu z VF-023 D-3, zamiast wymagać ręcznej
      poprawki (deepFreeze pojedynczego eventu w recordEvent), którą łatwo
      pominąć w przyszłości. Warunek przejścia na plan B: `_domainEvents`
      mutowane z >2-3 miejsc lub przez podklasy poza kontrolą tego taska.
  - id: D3
    topic: 'F-H14 — hash klucza cache CachedPolicy'
    choice: >-
      ODRZUCONY oryginalny wariant (bare FNV-1a-32). W zakresie VP-012c: R1 —
      jeden połączony digest (SHA-256, 128-bit prefix jak dziś) zamiast dwóch,
      separator jako prefiks długości. Merge warunkowy po benchmarku (OQ-4).
      Poza VP-012: R4/R5 jako osobna decyzja bezpieczeństwa z ADR.
    means: >-
      Nie skracamy zabezpieczenia pamięci podręcznej decyzji o dostępie, bo w
      najgorszym przypadku jeden użytkownik mógłby zobaczyć dane innego. Robimy
      tylko bezpieczne zmniejszenie pracy o połowę, resztę odkładamy do osobnej,
      świadomej decyzji.
    rationale: >-
      Zbieżna, niezależna rekomendacja dwóch agentów panelu (F7-F10). Impact
      kolizji sięga cross-tenant data disclosure (F9), nie tylko błędnego
      werdyktu. Cytowany precedens nie przenosi się liczbowo (F10). R1 nie
      zmienia profilu bezpieczeństwa (wciąż SHA-256, wciąż 128-bit), tylko
      liczbę wywołań digest.
  - id: D4
    topic:
      'Znaleziska poboczne (B1, B2, B3, results-order, precedens query-bus)'
    choice: >-
      NIE rozszerzać VP-012. B2 → osobny task, priorytet wyższy niż VP-012.
      B1+B3 → jeden wspólny osobny task (ta sama struktura danych), priorytet
      wyższy niż VP-012. Weryfikacja komentarza "collision = cache miss" w
      enhanced-query-bus → osobny task ~1h, niezależny. results-order w
      executeInParallel → OSOBNY commit w TYM SAMYM PR co VP-012a (ta sama
      metoda, rozdzielanie PR-a byłoby czystym churnem), ale osobny task_id do
      śledzenia.
    means: >-
      Przy okazji audytu znaleziono cztery inne usterki w tym samym miejscu, w
      tym przełącznik którego nie da się wyłączyć i pamięć podręczną mogącą
      rosnąć bez ograniczenia. Trafiają do własnych zadań — dwa z nich
      pilniejsze niż to, nad którym pracujemy.
    rationale: >-
      B2 to bug (opcja martwa), nie dług — nie powinien czekać na
      rozstrzygnięcie bezpieczeństwa hasha w tym samym pliku. B1 wymaga wyboru
      mechanizmu (mini-design), nie jest quick-winem mimo że mieszka w tym samym
      pliku co F-H14. Rozdzielenie PR-a dla results-order byłoby czystym
      overheadem review bez żadnej korzyści izolacji ryzyka (ta sama metoda, ten
      sam fix).
  - id: D5
    topic:
      'Higiena pliku zadania (poza zakresem zapisu tej fazy — do wykonania przy
      /orchestrate lub ręcznie)'
    choice: >-
      Przed startem implementacji poprawić w
      project-orchestration/tasks/VP-012-hotpath-quickwins.md: priority
      normal→high (P1, promocja z 2026-08-09 nigdy nie utrwalona w pliku),
      complexity simple→medium, AC1 przepisać (obecny benchmark mierzy
      loadFromHistory/handleEvent, nie apply() — nie dotknie naprawianego kodu,
      patrz F3), § Dlaczego skorygować (F1_KOREKTA), AC2 przepisać zgodnie z D3.
    means: >-
      Opis zadania rozjechał się z aktualnym stanem kodu — zanim ktoś zacznie
      wdrażać, warto poprawić kryteria odbioru, żeby test sprawdzał rzeczywiście
      naprawiany fragment, a nie inny.
    rationale: >-
      /analyze nie zapisuje do plików tasków (poza zamkniętą listą: analysis.md,
      TM, rejestr TM) — ta poprawka NIE została wykonana w tym przebiegu i
      wymaga osobnego kroku po zatwierdzeniu analizy.

patterns: # z 0.5 (runtime.yml patterns.always)
  - typescript-library/public-api-pattern.md # WIĄŻE: AC5 wprost o tym; PA2/N6 (internal/ nigdy w index.ts) zweryfikowane jako spełnione dla obu planów fixu #1 (F2, F13)
  - typescript-library/package-boundary-pattern.md # NIE WIĄŻE bezpośrednio: zmiany są wewnątrz-pakietowe (core↔capabilities w jednym pakiecie @vytches/ddd-aggregates), nie przekraczają granicy Nx; ryzyko cyklu modułowego z D2 jest realne, ale to inna klasa problemu niż PB1-PB8 (tagi/depConstraints między pakietami)
  - cross-layer/conventions-pattern.md # NIE WIĄŻE: brak nowych plików domenowych/aplikacyjnych — to wewnętrzna infrastruktura biblioteki (capabilities, decorators, implementations), nie kod konsumenta DDD

units:
  - id: VP-012a
    scope:
      '@vytches/ddd-cqrs — executeInParallel single race + results-order fix'
    summary: >-
      Kolaps podwójnego Promise.race do jednego z indeksem (F12) jako pierwszy
      commit; fix kolejności results[] (results[idx] = result zamiast push, new
      Array(commands.length) zamiast []) jako drugi commit w tym samym PR (D4).
      NIE dodawać error handlera do indeksowanej race — dziś odrzucona komenda
      przerywa przez pierwszą race, dodanie .then(fn, fn) połknęłoby odrzucenie
      i dałoby cichy unhandledRejection. Zero ryzyka API, zero otwartych pytań
      blokujących.
    blocked_by: []
    risk: none
    estimate: 1.5h
  - id: VP-012b
    scope:
      '@vytches/ddd-aggregates — AuditCapability O(n²) via getDomainEvents
      memoization (plan A, D2)'
    summary: >-
      Memoizacja zamrożonej tablicy wewnątrz AggregateRoot.getDomainEvents +
      dirty flag (inwalidacja przez jeden prywatny helper mutujący
      _domainEvents, nie rozsypana po apply/commit/loadFromHistory/
      transformDomainEvents osobno) + hoisted `seen = new WeakSet()` (F5).
      Wymaga PRZED implementacją: grep po asercjach tożsamości (`not.toBe`)
      między wywołaniami getDomainEvents w 6 konsumujących pakietach, oraz PO
      implementacji: `nx run-many -t test` na nestjs, repositories, events,
      testing, contracts, aggregates. W TYM SAMYM PR (konsultacja 2026-08-20):
      JSDoc getDomainEvents() z gwarancją stabilności referencji wzorem bloku
      VF-023, CHANGELOG "Consumer Impact Checklist" z gotowym grepem,
      aktualizacja LLMGUIDE aggregates (tabela metod + przykład).
    blocked_by: [OQ-2]
    risk: medium (zmiana tożsamości zwracanej referencji, cross-package)
    estimate: 4.5h
  - id: VP-012c
    scope:
      '@vytches/ddd-policies — CachedPolicy: R1 (single combined digest), NIE
      FNV-1a (D3)'
    summary: >-
      Jeden połączony SHA-256 digest (128-bit prefix jak dziś, F6) zamiast dwóch
      osobnych wywołań hashString(); separator = prefiks długości, nie goły NUL
      (NUL już jest separatorem pól wewnątrz contextRaw). Wymaga najpierw: nowej
      suity benchmarkowej dla @vytches/ddd-policies (nie istnieje dziś, patrz
      OQ-4) — merge warunkowy na wyniku pokazującym zysk ponad dominujący koszt
      JSON.stringify(request.entity). W TYM SAMYM PR (konsultacja 2026-08-20):
      TM-VP-012c.md (krótki threat model, wzorem 12 istniejących w
      docs/security/threat-models/) + JSDoc klasy z jawnym non-goal
      ostrzegającym przed FNV-1a/djb2 jako przyszłą "optymalizacją".
    blocked_by: [OQ-1, OQ-4]
    risk: low (po odrzuceniu FNV-1a; profil bezpieczeństwa niezmieniony)
    estimate: 3.5h
  - note: >-
      Odpryski, NIE część VP-012 — osobne pliki tasków po zatwierdzeniu tej
      analizy. ZMIENIONE po konsultacji 2026-08-20 (D4): B1+B2+B3 RAZEM jako
      jeden task "PolicyCache v2" (mini-ADR: bounded size + TTL sweep + poprawny
      LRU + naprawiony `??` zamiast `||` w całym pliku + test kontraktowy
      JSDoc↔zachowanie configu), priorytet > VP-012, ~3-4h, nie trzy osobne
      PR-y na tej samej strukturze danych w krótkim odstępie. Osobno:
      weryfikacja komentarza "collision = cache miss" w enhanced-query-bus
      (F11_niepotwierdzone, ~1h, niezależny, PRZED ewentualną przyszłą
      unifikacją hashowania — jeśli fałszywy, query-bus ma już dziś tę samą
      klasę problemu); decyzja bezpieczeństwa o strategii hashowania kluczy
      cache (R4/R5 z OQ-1) — wymaga własnego ADR i review
      security-privacy-architect, nieestymowalna przed tym ADR, świadomie NIE
      unifikowana z hashowaniem w query-bus (różne klasy ryzyka). Dodatkowo
      (library-expert): sprawdzić czy antywzorzec z F5 (WeakSet alokowany
      per-element w .map() zamiast raz per wywołanie deepFreeze) występuje w
      innych call site'ach LibUtils.deepFreeze w bibliotece — potencjalnie
      szerszy, tani quick win poza zakresem VP-012b.
---

# Analiza: VP-012

## Synteza (tech-lead)

Zadanie opisane jako trzy proste, godzinowe poprawki wydajności okazało się po
sprawdzeniu w kodzie czymś innym w środku. Jedna poprawka (kolejka poleceń w
CQRS) jest dokładnie tak prosta, jak zakładano, i może wejść od razu. Druga
(odczyt historii zdarzeń agregatu) da większy zysk niż planowano, jeśli
naprawimy mechanizm współdzielony przez sześć modułów biblioteki, a nie tylko
jedno miejsce — ale to wymaga solidnych testów, zanim wejdzie. Trzecia (pamięć
podręczna sprawdzania uprawnień) miała proponować szybszy, ale słabszy sposób
liczenia klucza — po sprawdzeniu ryzyka okazuje się, że w najgorszym razie
mógłby pozwolić jednemu użytkownikowi zobaczyć dane innego. Tę część ograniczamy
do bezpiecznego wariantu, a mocniejszą optymalizację odkładamy do osobnej
decyzji.

Przy okazji audytu tego samego fragmentu kodu znaleziono dodatkowo pamięć
podręczną, która może rosnąć bez końca, oraz przełącznik bezpieczeństwa, który
mimo dokumentacji nie działa — i jest gorszy niż pierwotnie sądzono: jawną
decyzję jednego użytkownika po cichu odwraca. Oba trafiają do jednego, wspólnego
zadania o wyższym priorytecie niż to.

**Aktualizacja 2026-08-20**: na prośbę użytkownika o rozstrzygnięcia
zorientowane na długi termin, nie na szybką łatkę, trzech dodatkowych doradców
(odpowiedzialność za publiczne API, za całość biblioteki, za dokumentację/DX)
potwierdziło jednogłośnie kierunek panelu i dorzuciło konkretne wymogi: pisemna
gwarancja w dokumentacji zamiast cichej zmiany zachowania, krótki dokument oceny
ryzyka przy zmianie hasha, i jeden spójny projekt naprawy pamięci podręcznej
zamiast trzech osobnych łatek. Propozycje odpowiedzi wpisane we frontmatter
`answer:` — czekają na Twoje potwierdzenie.

## Otwarte pytania (DO DYSKUSJI — odpowiedz w frontmatter `answer:`)

- **OQ-1** (blokujące): ograniczyć optymalizację cache'a uprawnień do
  bezpiecznego wariantu, mocniejszy odłożyć osobno?
- **OQ-2** (blokujące): naprawić wspólny mechanizm dla sześciu modułów (większy
  zysk, więcej testów) czy wąską łatkę w jednym miejscu?
- **OQ-3** (blokujące): dwa znalezione przy okazji defekty (rosnąca bez końca
  pamięć podręczna, martwy przełącznik) jako osobne, pilniejsze zadania?
- **OQ-4** (niebiorące): budować brakujące narzędzie do pomiaru wydajności, czy
  zamknąć tę część bez liczb?
- **OQ-5** (niebiorące): naprawa martwego przełącznika potrzebuje wzmianki w
  informacji o wydaniu?

## Decyzje (proponowane — zweryfikuj)

- **D1**: podział na trzy niezależne jednostki (VP-012a/b/c), różny profil
  ryzyka.
- **D2**: naprawa odczytu historii zdarzeń przez wspólny mechanizm (memoizacja),
  nie wąską łatkę.
- **D3**: odrzucenie szybszego, ale mniej bezpiecznego hasha; bezpieczna
  alternatywa w zakresie, mocniejsza odłożona.
- **D4**: znaleziska poboczne jako osobne zadania, nie rozszerzenie tego.
- **D5**: opis zadania wymaga korekty przed startem (poza zakresem zapisu tej
  fazy).

## Ryzyka / uwagi

- Oryginalna wycena (6h) nie uwzględniała: budowy brakującej suity benchmarkowej
  dla dwóch z trzech pakietów, testów regresyjnych w sześciu pakietach dla
  poprawki #2, ani odrzucenia i przeprojektowania poprawki #3. Realistyczna suma
  trzech jednostek: **~9.5h** (1.5 + 4.5 + 3.5), bez odprysków.
- Fix #2 w wersji z oryginalnego opisu zadania byłby cofnięciem świadomej
  decyzji bezpieczeństwa sprzed tego taska (obecny 128-bit prefix SHA-256 sam
  jest wcześniejszą poprawką po słabszym haszu) — gdyby wszedł bez rewizji,
  byłby to realny regres bezpieczeństwa przemycony pod etykietą "quick win".
- Plan A dla fixu #1 zmienia tożsamość referencji zwracanej przez
  `getDomainEvents()` między wywołaniami (ta sama tablica zamiast nowej za
  każdym razem) — bezpieczne pod względem aliasingu (dane i tak zamrożone), ale
  wymaga sprawdzenia testów asercjonujących tożsamość przed merge.
- Cztery odpryski (B1-B3, kolejność results, weryfikacja query-bus) NIE zostały
  utworzone jako pliki tasków w tej fazie — to wymaga osobnego kroku po
  zatwierdzeniu tej analizy.
- **Konsultacja 2026-08-20 ujawniła, że B2 jest poważniejszy niż pierwotnie
  oceniono**: to nie "opcja której nie da się wyłączyć", tylko mechanizm, który
  po cichu ODWRACA jawną decyzję konsumenta o wyłączeniu cache'owania odmów w
  jednej z fabryk. Podnosi to pilność powyżej oryginalnej oceny.
- Wszystkie trzy propozycje odpowiedzi we frontmatter (`answer:`) są
  PROPOZYCJAMI z konsultacji, nie ostatecznymi decyzjami — `status` zostaje
  `awaiting-human` dopóki nie potwierdzisz każdej z nich (albo zmienisz).

---

> Po wypełnieniu odpowiedzi (OQ-1 do OQ-3 blokujące) i zatwierdzeniu decyzji:
> ustaw `status: approved`, dopiero wtedy
> `/orchestrate VP-012-hotpath-quickwins`. **KONIEC — nie wołaj orchestracji,
> nie implementuj.**
