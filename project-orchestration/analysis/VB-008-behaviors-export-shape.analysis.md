---
task: VB-008
status: approved # zatwierdzone przez użytkownika 2026-08-21 po przejściu przez pytania blokujące jedno po drugim; zakres poszerzony o pełną naprawę funkcjonalną na jego wyraźne polecenie ("zrób jak należy, bez kombinacji, nie robimy półśrodków")

threat_model: null # brak stage'a threat-model w panelu tego projektu (jak w VB-006, VP-012)

parent_task: project-orchestration/tasks/VB-008-behaviors-export-shape.md
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml (source_hash 930fb5f182c0)

panel: # runtime.yml analyze.panel, przebieg 2026-08-21
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 11,
    }
  - {
      stage: tech-analysis-specialist,
      agent: 'backend-technology-expert',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 6,
    }
  - {
      stage: api-surface-analysis,
      agent: 'library-api-guardian',
      model: sonnet,
      when:
        'trafienie "export" (5x), "breaking" (2x), "deprecat" (2x), "public" ←
        treść taska o kształcie eksportu publicznego i ścieżce deprecation;
        trafienie sensowne, nie fragment innego wyrazu',
      wynik: ok,
      tool_uses: 7,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'brak trafienia when: (nowy pakiet|new package|granic|boundary|tag
        |scope:|cykl|circular|przenieś|przenosz|wydziel|extract) — zmiana nie
        przekracza żadnej granicy Nx, dotyczy jednego modułu w
        @vytches/ddd-policies plus mechanicznego re-eksportu w meta-pakiecie',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga:
        'frontmatter agenta mówi haiku; nadpisane zgodnie z polityką /analyze
        (ostatni osąd analizy idzie na opus)',
    }
  # pominięte kroki silnika: 0a (brak stage'a threat-model), 0.7 (brak bloku ddd/core),
  # 0.8 (brak stage'a decision-gate w panelu), 0.9 (brak bloku governance w tym projekcie)

review_round_2: # doproszony przegląd na żądanie człowieka, 2026-08-21, PO domknięciu panelu
  - {
      agent: 'library-api-guardian',
      model: sonnet,
      wkład:
        'zawęził sprzeczność D1/D4/D6 do rodzin caching i retry (F21);
        zaproponował nazwy bez kolizji; wykazał, że jedyną bramką łapiącą tę
        zmianę po stronie meta-pakietu jest ręczna synchronizacja dwóch barreli',
    }
  - {
      agent: 'library-quality-verifier',
      model: sonnet,
      werdykt: 'NO-GO warunkowe',
      wkład:
        'potwierdził empirycznie wszystkie 6 twierdzeń; type-check exit 0, 263
        testy zielone; argument rozstrzygający dla F11 — not() jako jedyna z
        czterech metod re-opakowuje, co jest dowodem przeoczenia, nie
        zaprojektowanej delegacji',
    }
  - {
      agent: 'library-expert',
      model: sonnet,
      wkład:
        'skorygował F4 (EventDrivenPolicyFactory ma stan); test warunków
        skrajnych obalił brzmienie D6 → D6b; przeczesał pozostałe pakiety i
        wykazał, że F11 jest izolowany (F22)',
    }
  - {
      agent: 'developer-experience',
      model: sonnet,
      wkład:
        'wykrył błąd w zakresie D2 (from() należy do buildera, F18); zero
        pokrycia przykładami (F19); przyczynę dryfu dokumentacji — bramka opt-in
        per blok (F20); odwrócił argument z D4 na mocniejszy',
    }

rag:
  skipped (runtime.yml nie ma sekcji knowledge — projekt nie ma skonfigurowanej
  kolekcji; nazwy NIE zgadywano z nazwy katalogu. Grounding ze statycznej listy
  patterns.always + triggers z 0.5, plus celowana weryfikacja grepem każdego
  nazwanego symbolu przed zapisem)

# Fakty ustalone empirycznie (grep/Read bezpośrednio w kodzie) — wiążące dla implementera.
codebase_facts:
  F1:
    'Wszystkie trzy klasy behaviors implements IBusinessPolicy<T>
    (cached-policy.ts:322, retry-policy.ts:84, temporal-policy.ts:100), a ten
    interfejs JEST już eksportowany publicznie jako typ z
    packages/policies/src/index.ts. Są dekoratorami opakowującymi wewnętrzną
    IBusinessPolicy<T>. Szkoda, przed którą chroni PA5/N2 — "konsument nie ma
    czego użyć poza konkretem" — tu nie występuje.'
  F2:
    'Każda z trzech klas ma publiczny konstruktor (innerPolicy, config) ORAZ
    static create(); cached i retry mają dodatkowo static withDefaults()
    (cached-policy.ts:622, retry-policy.ts:381). UWAGA: withDefaults i create są
    statykami KLAS BEHAVIOR, nie klas *Factory — panel pomylił to w raporcie.
    Przykłady, README i LLMGUIDE uczą wyłącznie .create() i presetów fabryk,
    nigdy `new`.'
  F3:
    'PolicyCachingBehaviorFactory (cached-policy.ts:635),
    PolicyRetryBehaviorFactory (retry-policy.ts:397) i
    PolicyTemporalBehaviorFactory (temporal-policy.ts:471) to klasy WYŁĄCZNIE ze
    statykami — nigdy nie instancjonowane, bez stanu, bez this. Realne metody:
    caching = withTTL/forExpensivePolicy/withCustomKey; retry =
    forTransientFailures/forExternalServices/withCustomLogic; temporal =
    from/businessHours/weekendAware/holidayAware.'
  F4:
    'SKORYGOWANY W RUNDZIE 2. Wzorzec "klasa-namespace" jest konwencją CAŁEJ
    biblioteki: 12 wystąpień `export class *Factory` w packages/*/src. ALE NIE
    SĄ JEDNĄ KATEGORIĄ: 11 to prawdziwe namespace''y wyłącznie ze statykami
    (zero wywołań `new` w całym repo — zweryfikowane), natomiast
    EventDrivenPolicyFactory (event-driven-policy.ts:301) MA KONSTRUKTOR
    (defaultEventBus, defaultConfig) i metody INSTANCYJNE create/createWithAudit
    — to wstrzykiwalny serwis, nie namespace. Konwersja sterowana grepem po
    nazwie `*Factory` zniszczyłaby go. MetricExporterFactory (resilience) jest
    static-only, ale robi realny dispatch po typie (GoF Factory Method) — ta
    sama mechaniczna zmiana, inne uzasadnienie w changelogu.'
  F5:
    'Eksport konkretnych klas to konwencja wszystkich 19 pakietów.
    @vytches/ddd-resilience eksportuje CircuitBreaker, RetryPolicy, Bulkhead,
    ResiliencePolicyBuilder identycznie; ten sam barrel policies eksportuje ~20
    innych konkretnych klas (BaseBusinessPolicy, PolicyRegistry, PolicyBuilder,
    EventDrivenPolicy, PolicyEventBus...). VB-008 opisuje to jako lokalny
    problem trzech rodzin — to jest problem 19 pakietów albo żaden.'
  F6:
    'ADR-0012 ("Policies V2 Complete Redesign", status ACCEPTED) stworzył ten
    kształt świadomie. Linia 204 zapisuje "Mitigation: Factory methods and
    sensible defaults for common patterns" jako przyjętą odpowiedź na ryzyko
    złożoności API. Fabryki NIE są wpadką — są zaakceptowaną decyzją.'
  F7:
    'BŁĄD — SKORYGOWANY 2026-08-21. Pierwotnie zapisałem "pakiet NIE jest
    jeszcze opublikowany", opierając się na KANBAN.md:46 ("is a breaking change
    the moment the package is published") i na notatce w pamięci o odroczonej
    publikacji. TO BYŁO NIEPRAWDZIWE i był to fakt NOŚNY — stała na nim cała
    argumentacja, że zmiana jest darmowa. Stan faktyczny z rejestru (npm view,
    2026-08-21): @vytches/ddd-policies latest=0.30.0, alpha=0.31.0-alpha.0,
    siedem wydań publicznych (0.27.0, 0.28.0, 0.29.1, 0.29.2, 0.29.3, 0.30.0,
    0.31.0-alpha.0). Konsumenci na 0.30.0 MOGĄ istnieć i zmiana sygnatur ICH
    ZEPSUJE. Użytkownik przyjął ten koszt świadomie (odpowiedź Q1/Q2). Precedens
    VF-024 pozostaje ważny i jest teraz BARDZIEJ trafny, bo także był cięciem po
    publikacji: globalPolicyEventBus usunięto wprost, pomocą migracyjną był
    komentarz inline plus wpis w CHANGELOG
    (packages/policies/src/index.ts:113-114).'
  F8:
    'Blast radius zmierzony. W repo: packages/enterprise re-eksportuje wszystkie
    7 symboli (src/index.ts:235-241) i jego raport api-report/ddd.api.md je
    zapisuje; 3 pliki przykładów (examples/policies/src/06,07,08); 1 suite
    benchmarków; README.md + LLMGUIDE.md; 4 pliki testów (~2570 linii) z ~35
    wywołaniami getCacheSize, ~13 getCacheMetrics, ~6 getRetryMetrics. POZA
    repo: jedyny znany konsument zależy od @vytches/ddd, ale referuje ZERO z
    tych 7 symboli i zero IBusinessPolicy. Grep nie znalazł ANI JEDNEGO
    `instanceof` ani ANI JEDNEGO `extends` na tych klasach, w żadnym repo.'
  F9:
    'Powierzchnia publiczna poza IBusinessPolicy: caching →
    clearCache/getCacheMetrics/getCacheSize; retry →
    getRetryMetrics/resetMetrics; temporal → nic. getCacheMetrics()
    (cached-policy.ts:580) zwraca typ ANONIMOWY
    ReturnType<PolicyCache["getMetrics"]>, wyprowadzony z NIEEKSPORTOWANEJ klasy
    wewnętrznej — to jedyny realny wyciek implementacji do deklaracji.'
  F10:
    'PolicyTemporalBehaviorBuilder (temporal-policy.ts:326) to prawdziwy builder
    fluent kończący się build(). Ten sam barrel eksportuje już pary
    interfejs+klasa dla swojego Builder System (IPolicyBuilder/PolicyBuilder,
    IPolicyStepBuilder/PolicyStepBuilder itd.). PA5/N2 nie mówi o builderach —
    wpisanie go do taska było pomyłką.'
  F11_ukryty_defekt:
    'SYSTEMOWY, we WSZYSTKICH trzech rodzinach: and(), or() i when() delegują
    prosto do polityki wewnętrznej i CICHO GUBIĄ opakowanie. Zweryfikowane:
    cached-policy.ts:593/597/605, retry-policy.ts:352/356/364,
    temporal-policy.ts:299/303/311. Skomponowanie polityki cachowanej przez
    .and() zwraca kompozyt BEZ cache. not() re-opakowuje
    (cached:601/retry:360/temporal:307), ale deklaruje goły zwrot
    IBusinessPolicy<T>. Panel przypisał to tylko rodzinie caching i pominął
    when() — obie rzeczy poprawione tutaj.'
  F12_brak_pokrycia:
    'Jedyne testy komponowania w każdej z trzech rodzin to expect(() =>
    policy.and(other)).not.toThrow() i identyczne dla .or()
    (cached-policy.test.ts:359-360, retry-policy.test.ts:446-447,
    temporal-policy.test.ts:481-482). Nie sprawdzają semantyki — F11 nie jest
    pilnowany niczym, a testy dają fałszywe poczucie pokrycia.'
  F13_bramka_api:
    'SKORYGOWANY W RUNDZIE 2 — pierwotne brzmienie było prawdziwe, ale mylące.
    Prawda: packages/policies nie ma api-extractor.json i nie jest w liście
    projektów root-level `pnpm validate:api` / `validate:api:local` (tylko
    contracts/events/enterprise/nestjs/value-objects). NIE ISTNIEJE też target
    `nx run @vytches/ddd-enterprise:validate:api` — panel wymienił polecenie,
    którego nie ma. ALE packages/policies MA własną bramkę powierzchni eksportu
    innego rodzaju: tests/api-surface.test.ts robi
    Object.keys(import("../src")).sort() i porównuje ze snapshotem (44 linie),
    dodaną w REL-005 "to lock the public API before v0.25.0-beta.1 publish". Ta
    bramka ZŁAPIE rename z D2 natychmiast i wymusi świadome `vitest -u`. Jej
    ograniczenie: Object.keys widzi wyłącznie eksporty WARTOŚCIOWE, więc jest
    ślepa na `export type {...}` i na zmiany kształtu — tak samo jak raport
    meta-pakietu (F14).'
  F14_slepota_bramki:
    'W packages/enterprise/api-report/ddd.api.md symbole re-eksportowane z
    pakietów siostrzanych występują WYŁĄCZNIE jako `import { X } from
    "@vytches/ddd-policies"` + `export { X }` (linie 324-363 i 1081-1159) —
    nazwa i pochodzenie, bez listy składowych. Bramka łapie więc
    dodanie/usunięcie/rename nazwy, ale jest ŚLEPA na zmiany kształtu.'
  F15_dryf_dokumentacji:
    'README.md:385 woła PolicyTemporalBehaviorFactory.forBusinessHours() —
    realna nazwa to businessHours(). LLMGUIDE.md:432 woła
    PolicyCachingBehaviorFactory.create() — taka metoda nie istnieje. Task
    VD-008 zakresuje dokładnie tę klasę defektów ("phantom APIs") repo-wide.'
  F16_symbole_nieistniejące:
    'TO TRZEBA BY STWORZYĆ — grep = 0 trafień dla każdego: ICacheablePolicy,
    ICacheablePolicyBehavior, IRetryablePolicy, IRetryablePolicyBehavior,
    createCachingPolicy, PolicyCacheMetrics, PolicyRetryMetrics. Panel
    proponował je jako gdyby istniały. Decyzja D4 odrzuca ich tworzenie poza
    jednym wyjątkiem.'
  F17_nazewnictwo:
    'Katalog src/decorators/ nosi wciąż słownictwo sprzed ADR-0012 v2.1, który
    przemianował "Decorators" → "Behaviors" w API publicznym, ale nie w
    strukturze katalogów. Nieobserwowalne spoza repo.'
  F18_blad_w_D2:
    'RUNDA 2 — BŁĄD W PIERWOTNYM ZAPISIE D2, ten sam gatunek, który zarzuciłem
    panelowi. from() NIE jest statykiem PolicyTemporalBehaviorFactory, tylko
    PolicyTemporalBehaviorBuilder (temporal-policy.ts:466; klasa buildera zamyka
    się w 469, fabryka otwiera się dopiero w 471). Fabryka temporal ma DOKŁADNIE
    TRZY statyki: businessHours (475), weekendAware (492), holidayAware (508).
    Wpisanie from() do listy migracji kazałoby implementerowi spłaszczyć wejście
    do łańcucha fluent — inna i groźniejsza operacja niż zamiana jednorazowej
    fabryki.'
  F19_zero_pokrycia_przykladami:
    'RUNDA 2. Wszystkie trzy przykłady (examples/policies/src/06,07,08) OMIJAJĄ
    klasy fabryk całkowicie — wołają PolicyRetryBehavior.withDefaults(),
    PolicyCachingBehavior.create() i PolicyTemporalBehaviorBuilder.from().
    Wszystkie metody objęte D2 mają ZEROWE pokrycie działającym przykładem. To
    jest przyczyna dryfu dokumentacji (F15), nie zbieg okoliczności: nic tych
    ścieżek nie kompiluje.'
  F20_brama_docs_opt_in:
    'RUNDA 2. tools/docs-compile-gate (VD-005 AC11) istnieje i działa, ale jest
    OPT-IN per blok kodu — wymaga tokenu `compile-check` w nagłówku bloku. Oba
    znane zepsute fragmenty (F15) to zwykłe bloki ```ts, więc bramka pominęła je
    zgodnie z projektem. Bez zmiany procesu ten sam dryf powtórzy się przy D2.'
  F21_temporal_bez_nadmiaru:
    'RUNDA 2. PolicyTemporalBehavior NIE dodaje żadnej zdolności poza
    IBusinessPolicy — jego jedyne publiczne składowe to id/domain/name,
    check/and/or/not/when i static create(). Nadmiarową powierzchnię (F9) mają
    WYŁĄCZNIE rodziny caching i retry. To zawęża sprzeczność D1/D4/D6 do dwóch z
    trzech rodzin.'
  F23_brak_podmian:
    'Zweryfikowane 2026-08-21: nigdzie w repo nikt nie robi spyOn ani
    przypisania na metody tych trzech fabryk. To przesądza, że wariant A z D2
    (obiekt `as const`, właściwości tylko do odczytu) nie psuje żadnego testu —
    statyki klasy były zapisywalne, właściwości obiektu `as const` nie są, i ta
    jedyna realna różnica w zachowaniu nie ma w repo ani jednego odbiorcy.'
  F22_defekt_izolowany:
    'RUNDA 2. Przeczesanie pozostałych pakietów pod kątem F11: resilience nie ma
    w ogóle metod and/or/when (komponuje addytywnie przez listę strategii), cqrs
    i events też nie. validation ma and/or/not w composite-specification, ale
    tworzy nowy węzeł opakowujący OBA operandy — inny kształt, nie ten defekt.
    F11 jest więc izolowany do rodziny dekoratorów IBusinessPolicy, a nie
    ogólnobibliotecznej klasy defektów. Priorytet D7 zostaje bez zmian, ale
    zakres jest policies-only.'

open_questions:
  - id: Q1
    blocking: true
    ask: >-
      Kiedy planujemy pierwsze publiczne udostępnienie tej biblioteki? Jeśli
      mamy przed sobą jeszcze co najmniej jedno wydanie, poprawki wprowadzimy
      szybko i bez kosztu dla kogokolwiek; jeśli premiera jest tuż-tuż, te same
      zmiany zajmą dodatkowy cykl wydawniczy i zmuszą nas do utrzymywania starej
      wersji równolegle.
    q: >-
      Data/wydanie pierwszej publicznej publikacji @vytches/ddd-policies (dziś
      0.31.0-alpha.0, nieopublikowany, F7). Decyzja D3 o czystym cięciu bez okna
      deprecation jest ważna WYŁĄCZNIE dopóki pakiet jest nieopublikowany. Po
      publikacji ta sama zmiana staje się udokumentowanym breaking change
      wymagającym okna deprecation albo bumpa major, a koszt D2 i D7 rośnie o
      mniej więcej jeden cykl wydawniczy.
    answer: >-
      ODPOWIEDŹ 2026-08-21: biblioteka JEST opublikowana (nie tak, jak zakładał
      błędny fakt F7 — patrz korekta). Wydanie planowane na dziś/jutro/pojutrze.
      Decyzja użytkownika: wydajemy z opisem zmian w plikach wydania i
      instrukcją naprawy dla użytkowników; ewentualny refaktor u odbiorcy jest
      przyjętym kosztem. "Nie ma na co czekać".
  - id: Q2
    blocking: true
    ask: >-
      Czy poza jednym znanym nam projektem ktokolwiek jeszcze korzysta z tej
      biblioteki — inny zespół, odgałęzienie, prototyp? Jeśli tak, zmiany trzeba
      wprowadzać łagodniej i wolniej; jeśli nie, możemy je zrobić od razu i
      praktycznie za darmo.
    q: >-
      Czy pomiar blast radius (F8) jest kompletny. Jest ograniczony do
      repozytoriów widocznych na tym dysku: znalazł zero referencji do
      wszystkich 7 symboli i zero do IBusinessPolicy u jedynego znanego
      konsumenta. Jeśli istnieje nieujawniony konsument, fork albo branch
      wewnętrzny używający tych symboli, decyzja D3 (brak okna deprecation)
      traci ważność i musi wrócić do ścieżki additive-then-deprecate.
    answer: >-
      ODPOWIEDŹ 2026-08-21: użytkownik świadomie nie bada, czy istnieją inni
      odbiorcy — ryzyko przyjęte. Wiążący warunek zastępczy: każda zmiana MUSI
      mieć wpis w plikach wydania mówiący co się zmieniło i jak to naprawić u
      siebie. Uwaga łagodząca: wybrany w Q7 wariant A nie zmienia składni
      wywołania, więc dla nieznanych odbiorców realny koszt migracji tej akurat
      zmiany wynosi zero.
  - id: Q3
    blocking: true # blokuje WYŁĄCZNIE D6, nie resztę taska
    ask: >-
      Kto ma prawo zmieniać wspólne zasady jakości obowiązujące we wszystkich
      naszych projektach — zespół tej biblioteki czy poziom wyżej? Pytam, bo
      jedna z tych zasad jest sformułowana zbyt szeroko i dopóki jej nie
      poprawimy, będzie regularnie generować fałszywe zgłoszenia w kilkunastu
      innych miejscach.
    q: >-
      Kto ratyfikuje zmiany w Rule Cards współdzielonych między projektami
      (symlinkowanych z claude-patterns). VB-008 wyprodukował propozycję wyjątku
      do PA5/N2. Bez ratyfikacji to samo fałszywie pozytywne znalezisko odrodzi
      się przeciwko pozostałym 18 pakietom (F5), ale task biblioteczny mergujący
      to jednostronnie zmienia standardy każdemu innemu projektowi czytającemu
      te same karty.
    answer: >-
      ODPOWIEDŹ 2026-08-21: nieblokujące dla tego zadania. Repozytorium wzorców
      należy do użytkownika, więc ratyfikacja jest jego. Propozycja brzmienia
      (D6b) zostaje zapisana tutaj i wchodzi jako osobne zadanie; VB-008 nie
      czeka na nią i jej nie merguje.
  - id: Q4
    blocking: true # blokuje WYŁĄCZNIE D7
    ask: >-
      Czy gdy ktoś łączy dwie reguły biznesowe, dodatkowe własności jednej z
      nich — na przykład przyspieszenie działania albo automatyczne ponawianie
      po błędzie — powinny zostać zachowane? Jeśli tak, mamy usterkę do
      naprawienia; jeśli uznamy to za świadome ograniczenie, wystarczy je
      opisać, ale zostanie z nami na stałe.
    q: >-
      Czy "kompozycja zachowuje opakowanie" jest zamierzonym kontraktem. F11:
      and()/or()/when() we wszystkich trzech rodzinach delegują do polityki
      wewnętrznej i gubią dekorator. Po naprawie kompozycja zachowywałaby
      semantykę cache/retry/temporal. Żaden test nie asertuje ani jednego, ani
      drugiego zachowania (F12), a ADR-0012 nie porusza kompozycji polityk
      opakowanych. Alternatywa: uznać delegację za świadome ograniczenie i
      wyłącznie je udokumentować.
    answer: >-
      ODPOWIEDŹ 2026-08-21: TAK — łączenie reguł MA zachowywać wzbogacenie. To
      usterka, naprawiana od razu, w tym samym wydaniu co reszta. Zdejmuje to
      warunek NO-GO wystawiony przez weryfikatora, bo nie powstaje okno, w
      którym dokumentacja uczy łączenia reguł nad zepsutą semantyką.
  - id: Q5
    blocking: false
    ask: >-
      Czy zgadzamy się przepisać fragmenty dokumentacji i przykładów, żeby
      uprościć trzy pomocnicze punkty wejścia? Alternatywą jest zostawienie ich
      w obecnej formie i trwałe odnotowanie odstępstwa od naszych standardów —
      mniej pracy teraz, ale niespójność, którą będziemy tłumaczyć każdemu
      nowemu użytkownikowi.
    q: >-
      Czy akceptujemy koszt dokumentacyjny D2. Zamiana trzech klas-namespace na
      funkcje unieważnia każdy tutorial, README, LLMGUIDE i przykład, który ich
      uczy (3 przykłady, 1 benchmark, 2 pliki docs dziś — F8) i wymaga przebiegu
      VD-008 PO tej zmianie. Alternatywa: zachować obecny kształt i wpisać
      trwały, udokumentowany wyjątek od PA5/N2.
    answer: >-
      ODPOWIEDŹ 2026-08-21: pytanie w dużej mierze bezprzedmiotowe po wyborze
      wariantu A — składnia wywołania się nie zmienia, więc rename nie
      unieważnia ani jednego fragmentu dokumentacji. Koszt dokumentacyjny
      pozostaje, ale z innego powodu i użytkownik go przyjął: dopisujemy
      brakujące działające przykłady dla presetów (D12), bo dziś nie ma ich w
      ogóle (F19).
  - id: Q6
    blocking: false
    ask: >-
      Czy przed publiczną premierą chcemy uszczelnić automatyczne
      zabezpieczenie, które ma nas ostrzegać przed zmianami psującymi zgodność
      dla użytkowników? Dziś nie obejmuje ono tego obszaru, więc pierwszy taki
      błąd po premierze najprawdopodobniej wykryją użytkownicy, a nie my.
    q: >-
      Czy wykorzystać okno przedpublikacyjne na domknięcie luki bramki (D9).
      Bramka nie pokrywa packages/policies w ogóle (F13) i jest strukturalnie
      ślepa na zmiany kształtu symboli re-eksportowanych przez meta-pakiet
      (F14). Odłożenie oznacza, że pierwsza popublikacyjna zmiana łamiąca
      kontrakt może przejść niewykryta.
    answer: >-
      ODPOWIEDŹ 2026-08-21: TAK, w zakresie taniego pierwszego kroku, na mocy
      "nie robimy półśrodków". Do tego wydania wchodzi bramka grepowa z D12
      (zero odwołań do nieistniejących poleceń w dokumentach i przykładach) —
      jest deterministyczna i złapałaby oba znane dryfy. Pełna bramka
      api-extractor dla tego pakietu zostaje osobnym zadaniem (D9).
  - id: Q7
    blocking: true # blokuje D2 — bez tego implementer nie wie, co ma zbudować
    ask: >-
      Trzy pomocnicze skróty do tworzenia wzbogaconych reguł mają dziś wspólną
      etykietę, pod którą podpowiedzi w edytorze grupują je razem. Możemy tę
      grupę zachować, albo rozbić na osobne polecenia o dłuższych nazwach —
      rozbicie jest bliższe naszym standardom, ale użytkownik straci wygodne
      grupowanie i część poleceń tego samego mechanizmu będzie zapisywana
      inaczej niż reszta.
    q: >-
      Jaki kształt ma przyjąć D2. Trzej z czterech recenzentów rundy 2
      niezależnie odradzili gołe funkcje. Warianty: (A) obiekt-namespace
      zachowujący grupowanie, np. `export const cachedPolicy = { withTTL,
      forExpensive, withCustomKey } as const` — spełnia zakaz klasy-namespace
      przy ZEROWEJ zmianie call-site''ów i zerowym koszcie dokumentacyjnym; (B)
      wolne funkcje z pełnym prefiksem rodziny
      (cachedPolicyWithTTL/retryPolicyForTransientFailures/
      temporalPolicyForBusinessHours) — najbliżej litery reguły, ale rozjeżdża
      konwencję wywołania: create() i withDefaults() zostają statykami klasy, a
      presety stają się funkcjami, więc jeden mechanizm ma dwie składnie; (C)
      nie ruszać nic i wpisać trwały wyjątek. Uwaga wiążąca: gołe nazwy bez
      prefiksu są odrzucone niezależnie od wariantu — `businessHours` koliduje z
      polem konfiguracji w tym samym module (temporal-policy.ts:17), a barrel
      meta-pakietu spłaszcza ~150 nazw.
    answer: >-
      ODPOWIEDŹ 2026-08-21: WARIANT A — przebudowa niewidoczna dla wywołującego.
      Użytkownik potwierdził jednocześnie, że nie chce półśrodków: zakres
      zadania obejmuje ZARÓWNO tę zmianę kształtu, JAK I pełną listę
      funkcjonalną (naprawa łączenia reguł, nazwany typ statystyk, jeden punkt
      startu zamiast dwóch, działające przykłady dla presetów, domknięcie dryfu
      dokumentacji). Jawnie odnotowane w rozmowie: sama zmiana kształtu nie daje
      użytkownikowi nic i jest wyłącznie zgodnością ze standardem — wartość
      niesie lista funkcjonalna.

decisions:
  - id: D1
    topic: 'Przesłanka taska — trzy klasy behaviors'
    choice: >-
      ODRZUCONA. PolicyCachingBehavior, PolicyRetryBehavior i
      PolicyTemporalBehavior zostają eksportowane jako konkretne klasy. Bez
      konwersji na interfejs+fabryka, bez `export type`.
    means: >-
      Zgłoszenie okazało się w większości fałszywym alarmem — ta część
      biblioteki jest zbudowana poprawnie i nie wymaga przebudowy. Oszczędzamy
      kilka dni pracy i unikamy zmiany, która utrudniłaby życie przyszłym
      użytkownikom.
    rationale: >-
      Klasy implementują już publicznie eksportowany IBusinessPolicy<T> (F1),
      więc szkoda opisana przez PA5/N2 nie występuje. Konwersja stworzyłaby 7
      symboli nieistniejących dziś (F16), zaprzeczyłaby zaakceptowanemu
      ADR-0012, który wybrał ten kształt i wskazał metody fabryczne jako
      mitygację (F6), i zerwałaby parytet z @vytches/ddd-resilience oraz ~20
      innymi konkretnymi eksportami w tym samym barrelu (F5). Wariant `export
      type` dodatkowo zamknąłby dziedziczenie na zawsze w zamian za korzyść
      poniżej 100 bajtów po gzip.
  - id: D2
    topic: 'Klasy-namespace pełniące rolę fabryk'
    choice: >-
      PRZYJĘTA jako realny defekt. KSZTAŁT ROZSTRZYGNIĘTY 2026-08-21 (Q7):
      WARIANT A — obiekt zamiast klasy, przy zachowanej nazwie eksportu i
      identycznej składni wywołania (`export const PolicyCachingBehaviorFactory
      = { withTTL, forExpensivePolicy, withCustomKey } as const`). Ciała metod
      bez zmian, parametry typu zachowane, zero zmian u wywołującego, zero
      churnu w dokumentacji i przykładach, snapshot powierzchni eksportu i
      raport meta-pakietu nie drgną (nazwa zostaje). Zweryfikowano, że nikt w
      repo nie podmienia ani nie podstawia atrapą tych metod, więc `as const`
      niczego nie psuje (F23). Odrzucone: wolne funkcje z prefiksem — po
      korekcie F7 to realne psucie kodu opublikowanym użytkownikom w zamian za
      zero korzyści, plus rozjazd składni w obrębie jednego mechanizmu. Kontekst
      pierwotny (Q7) — trzej z czterech recenzentów rundy 2 niezależnie
      odradzili gołe funkcje. Zakres migracji SKORYGOWANY: caching =
      withTTL/forExpensivePolicy/withCustomKey; retry =
      forTransientFailures/forExternalServices/withCustomLogic; temporal =
      businessHours/weekendAware/holidayAware — TYLKO TRZY, bez from(), które
      należy do buildera, nie do fabryki (F18). withDefaults i create są
      statykami klas behavior i NIE wchodzą do migracji (F2). Wszystkie trzy
      rodziny idą razem — transformacja jest identyczna. Trzy warianty kształtu
      w Q7; gołe nazwy typu withTTL/businessHours są ODRZUCONE bezwarunkowo
      (kolizja: businessHours to również pole konfiguracji w tym samym module,
      temporal-policy.ts:17).
    means: >-
      Trzy pomocnicze punkty wejścia dostaną prostszą, bardziej naturalną formę.
      Dla użytkownika oznacza to krótszy zapis i mniej rzeczy do nauczenia;
      nazwy samych poleceń pozostają te same.
    rationale: >-
      Klasa wyłącznie ze statykami to przestrzeń nazw w kostiumie klasy: bez
      stanu, bez this, nigdy nie instancjonowana (F3). To jedyne miejsce w
      VB-008, w którym reguła trafia bez zastrzeżeń — wszystkie trzy stage'e
      panelu zgodziły się na to niezależnie. Uwaga o zakresie: konwersja NIE
      powinna ruszać wywołań getCacheSize/getCacheMetrics/getRetryMetrics w
      testach (F8) — diff dotykający tych miejsc oznacza, że D1 albo D4 są
      łamane. RUNDA 2 dołożyła trzy warunki wykonania: (1) ten sam PR MUSI
      ruszyć packages/enterprise/src/index.ts:235-241 w zamku z barrelem
      policies, bo meta-pakiet jest jedyną powierzchnią pilnowaną przez
      api-extractor (F14); (2) snapshot tests/api-surface.test.ts wywali się i
      wymaga świadomego `vitest -u`, nie automatycznego (F13); (3) po usunięciu
      klas grep na `PolicyCachingBehaviorFactory.|PolicyRetryBehaviorFactory.|
      PolicyTemporalBehaviorFactory.` w README, LLMGUIDE i examples/policies
      MUSI zwracać zero — to najtańsza bramka dla tej klasy defektu i złapałaby
      oba dryfy z F15.
  - id: D3
    topic: 'Ścieżka deprecation'
    choice: >-
      JEDNO CZYSTE CIĘCIE w kolejnym minorze 0.x. Bez okna deprecation, bez
      codemodu, bez warstw zgodnościowych. Klasyfikacja z taska ("major albo
      okno deprecation") jest fałszywą alternatywą i zostaje zastąpiona.
    means: >-
      Zmianę wprowadzamy od razu i jednorazowo, zamiast utrzymywać przez kilka
      wydań dwie wersje tego samego rozwiązania. Nikt na zewnątrz jeszcze z tego
      nie korzysta, więc koszt dla użytkowników jest zerowy — ale tylko dopóki
      nie wypuścimy pakietu publicznie.
    rationale: >-
      UZASADNIENIE PRZEPISANE po korekcie F7. Wybór się nie zmienia, podstawa
      tak: NIE "to nic nie kosztuje" (pakiet jest opublikowany, siedem wydań),
      tylko "koszt przyjęty świadomie i ogłoszony". Przed 1.0 złamanie kontraktu
      bumpuje minor, nie major (SemVer §4). Precedens jest w tym samym pakiecie
      i też po publikacji: globalPolicyEventBus usunięto wprost pod VF-024, z
      komentarzem inline i wpisem w CHANGELOG (F7). Zasięg wewnątrz repo w
      całości zmierzony (F8); poza repo nieznany i użytkownik świadomie go nie
      bada (Q2). Codemod (BC7) odrzucony jako nieproporcjonalny — ale
      OBOWIĄZKOWY staje się za to jawny wpis migracyjny w plikach wydania (co
      się zmieniło + jak to naprawić u siebie), na wyraźne polecenie
      użytkownika. Uwaga: wariant kształtu wybrany w Q7 (obiekt zamiast klasy)
      sprawia, że dla WYWOŁUJĄCEGO nie ma zmiany — realny koszt migracji spada
      do zera, mimo że pakiet jest publiczny.
  - id: D4
    topic: 'Interfejsy zdolnościowe dla metod spoza IBusinessPolicy'
    choice: >-
      NIE BUDOWAĆ. Żadnego ICacheablePolicy/IRetryablePolicy ani towarzyszących
      typów metryk (F16). JEDEN WYJĄTEK zostaje w zakresie: getCacheMetrics()
      zwraca dziś typ anonimowy wyprowadzony z nieeksportowanej klasy
      wewnętrznej (F9) — ten jeden kształt dostaje nazwany, eksportowany typ.
    means: >-
      Rezygnujemy z tworzenia dodatkowej warstwy opisowej, której nikt dziś nie
      używa — mniej rzeczy do utrzymania. Naprawiamy natomiast jeden konkretny
      przypadek, w którym wewnętrzny szczegół biblioteki wyciekał na zewnątrz.
    rationale: >-
      Cztery z pięciu dodatkowych metod (clearCache, getCacheSize,
      getRetryMetrics, resetMetrics) są wołane WYŁĄCZNIE z testów — przykłady i
      benchmark ich nie tykają (F8). Siostrzany resilience też nie segreguje
      dodatkowych składowych CircuitBreakera (F5). Każdy proponowany interfejs
      byłby nowym symbolem z zerem użytkowników (F16); sześć interfejsów
      opisujących metody, których nikt nie woła, powiększa kontrakt publiczny na
      zawsze w zamian za korzyść czysto teoretyczną. Typ anonimowy jest
      jakościowo inny: wpycha kształt klasy wewnętrznej do publikowanych
      deklaracji, gdzie konsument nie może go nazwać ani zreferować. RUNDA 2
      wyostrzyła uzasadnienie i odrzuciła moje pierwotne: "tylko testy tego
      wołają" jest argumentem KOLISTYM (metody nieodkrywalne mają zero wywołań;
      to nie dowód, że są niepotrzebne). Prawdziwy powód: na rodzinę przypada
      DOKŁADNIE JEDNA konkretna implementacja, więc interfejs zdolnościowy
      miałby jednego implementującego i nie ma czego podstawiać — interfejsy
      zarabiają na siebie przy substytucji albo drugiej implementacji, a tu nie
      ma ani jednego, ani drugiego. Kształt do nazwania jest trywialny: { hits,
      misses, evictions, entries }, wszystkie number (cached-policy.ts:141-146).
      Odpowiednik w retry (getRetryMetrics: RetryMetrics) JEST już poprawnie
      otypowany i eksportowany — caching jest jedynym winnym.
  - id: D5
    topic: 'Builder fluent'
    choice: >-
      POZA ZAKRESEM. PolicyTemporalBehaviorBuilder zostaje nietknięty i znika z
      listy symboli taska.
    means: >-
      Jeden z wymienionych w zgłoszeniu elementów okazał się w porządku i
      zostaje bez zmian.
    rationale: >-
      To prawdziwy builder fluent kończący się build(), a ten sam barrel
      eksportuje już pary interfejs+klasa dla swojego Builder System (F10).
      PA5/N2 mówi o konkrecie zamiast interfejsu+fabryki, nie o builderach.
      Wszystkie trzy stage'e panelu niezależnie uznały to za złe zastosowanie
      reguły.
  - id: D6
    topic: 'Poprawka współdzielonej Rule Card'
    choice: >-
      VB-008 ZAPISUJE propozycję brzmienia jako artefakt i SPAWNUJE osobny task
      na poziomie standardów. Nie merguje zmiany w karcie i nie blokuje się na
      niej. Propozycja: konkretna klasa MOŻE być eksportowana wprost, bez pary
      interfejs+fabryka, gdy (a) implementuje już publicznie eksportowany
      interfejs i nie dodaje zdolności poza jego kontraktem, albo (b) jest
      builderem fluent, którego jedynym kontraktem publicznym są metody łańcucha
      zakończone jedną metodą terminalną. Klasy spoza (a) muszą mieć dodatkowe
      składowe ujęte w eksportowanym interfejsie zdolnościowym. ODRZUCONE W
      RUNDZIE 2 — patrz D6b.
    means: >-
      Zauważyliśmy, że wspólna dla wszystkich projektów reguła jakościowa jest
      sformułowana zbyt szeroko i generuje fałszywe alarmy. Proponujemy
      poprawkę, ale decyzję o jej przyjęciu zostawiamy poziomowi odpowiadającemu
      za standardy w całej organizacji.
    rationale: >-
      Rule Cards są symlinkowaną infrastrukturą współdzieloną przez wszystkie
      projekty na tej maszynie, więc pojedynczy task biblioteczny edytujący je
      jednostronnie zmienia standardy innym projektom bez ich przeglądu.
      Zostawienie karty bez poprawki gwarantuje jednak, że ta sama fałszywie
      pozytywna analiza odrodzi się przeciwko pozostałym 18 pakietom, które
      eksportują konkretne klasy identycznie (F5). Rozwiązanie: napisać tutaj,
      ratyfikować gdzie indziej. Patrz Q3. Sam podział własności zostaje w mocy
      po rundzie 2; zmienia się WYŁĄCZNIE proponowane brzmienie — patrz D6b.
  - id: D6b
    topic: 'Brzmienie klauzuli wyjątku — wersja po teście warunków skrajnych'
    choice: >-
      Pierwotne brzmienie z D6 ODRZUCONE. Zamiast pytać "czy implementuje
      interfejs", klauzula pyta "czy to jest namespace w przebraniu": konkretna
      klasa MOŻE być eksportowana wprost, CHYBA ŻE zachodzą JEDNOCZEŚNIE trzy
      warunki — (1) każda składowa jest statyczna, (2) klasa nie ma konstruktora
      poza domyślnym, (3) nigdzie w repo nikt jej nie instancjonuje. Klasy
      spełniające wszystkie trzy MUSZĄ zostać zamienione na moduł funkcji albo
      obiekt. Wszystkie pozostałe konkretne klasy — dekoratory implementujące
      publiczny interfejs, serwisy ze stanem, buildery fluent, zwykłe narzędzia
      ze stanem — są zwolnione z wymogu interfejs+fabryka NIEZALEŻNIE od tego,
      czy wystawiają składowe spoza jakiegokolwiek interfejsu.
    means: >-
      Poprawiamy zbyt szeroko sformułowaną wspólną regułę tak, żeby celowała w
      jedyny realny problem, zamiast podważać kilkanaście sprawdzonych,
      stabilnych elementów biblioteki. Dzięki temu nie wygenerujemy sobie
      kilkunastu fałszywych zgłoszeń do rozpatrzenia.
    rationale: >-
      Test warunków skrajnych na realnym kodzie (próba 61 klas w policies i
      resilience) pokazał, że pierwotne brzmienie OBLAŁOBY m.in. CircuitBreaker,
      RetryPolicy, Bulkhead, PolicyEventBus, PolicyEventHandlers,
      PolicyMetricsAggregator — czyli najstarsze i najstabilniejsze klasy
      biblioteki, wyłącznie dlatego, że nigdy nie wyekstrahowano dla nich
      interfejsu, którego nikt nie potrzebował. Obla­łoby też
      CircuitBreakerStrategy i BulkheadStrategy — klasy, które interfejs
      implementują — za jeden dodatkowy getter obserwowalności. To jest
      dokładnie ten backlog, którego klauzula miała zapobiec. Przeformułowanie
      na "namespace czy nie" trafia w jedyne realne znalezisko VB-008 (D2) i
      zwalnia resztę. Wariant alternatywny, rozważony i odrzucony jako słabszy:
      rozróżnianie zdolności "behawioralnych" od "obserwowalnościowych" —
      poprawne co do intencji, ale wymaga osądu przy każdym zastosowaniu, gdzie
      test na static-only jest mechaniczny i weryfikowalny grepem.

  - id: D7
    topic: 'Ciche gubienie opakowania przy kompozycji'
    choice: >-
      NOWY, SAMODZIELNY TASK o priorytecie P1, przejmujący pilność
      przedpublikacyjną, którą board błędnie przypisał VB-008. NIE wtapiać w
      VB-008: naprawa jest behawioralna, potrzebuje własnych testów regresyjnych
      i własnego wpisu w CHANGELOG, i nie może zostać zamazana w review przez
      równoległy rename. WARUNEK BLOKUJĄCY Z RUNDY 2 (weryfikator wystawił NO-GO
      na pierwotne rozdzielenie): jeżeli D2 wychodzi wcześniej, wpis w CHANGELOG
      dla TAMTEGO wydania MUSI nieść jawne known-issue o gubieniu opakowania
      przy łączeniu reguł, z odsyłaczem do zadania D7. Bez tego wypuszczamy
      dokumentację uczącą łączenia reguł nad zepsutą semantyką. Zakres
      potwierdzony jako policies-only (F22), nie ogólnobiblioteczny.
      ROZSTRZYGNIĘTE 2026-08-21 (Q4): naprawiamy, i to w TYM SAMYM wydaniu co D2
      — co zdejmuje warunek NO-GO, bo okno "dokumentacja uczy nad zepsutą
      semantyką" w ogóle nie powstaje. Zadanie zostaje osobnym plikiem (inna
      klasa zmiany, własne testy, własny wpis migracyjny), ale wchodzi przed D2
      w kolejności realizacji — jest jedyną pozycją tej analizy realnie psującą
      działanie u odbiorcy, i to od siedmiu wydań.
    means: >-
      Znaleźliśmy realną usterkę: gdy ktoś łączy dwie reguły biznesowe,
      dodatkowe własności jednej z nich — na przykład przyspieszenie działania
      albo automatyczne ponawianie po błędzie — po cichu znikają. Nikt tego nie
      zgłosił, bo funkcja jest jeszcze nieużywana, więc chcemy to naprawić przed
      premierą, a nie po niej.
    rationale: >-
      Zweryfikowane we wszystkich trzech rodzinach, nie tylko w caching jak
      twierdził panel, i obejmuje też when() (F11). To ciche złe zachowanie
      ścieżki danych, nie preferencja nazewnicza. ~2570 linii istniejących
      testów tego nie łapie, bo jedyne asercje kompozycji to `not.toThrow()`
      (F12) — pokrycie jest pozorne. Po publikacji ta sama naprawa przestaje być
      bugfixem i staje się behawioralnym breaking change, więc okno jest realne
      akurat tutaj. Zależy od Q4.
  - id: D11
    topic: 'Dwa punkty startu dla jednego mechanizmu'
    choice: >-
      Zwinąć create() i withDefaults() do jednego wejścia create(policy,
      config?), z domyślną konfiguracją gdy pominięta — zachowanie dzisiejszego
      withDefaults(). Dotyczy rodzin caching i retry (temporal ma tylko
      create()). withDefaults() zostaje jako cienka, oznaczona jako wycofywana
      nakładka z ostrzeżeniem w czasie działania przy pierwszym wywołaniu
      (PA6/PA7/BC8), usuwana w kolejnym minorze.
    means: >-
      Dziś użytkownik widzi dwa równorzędnie wyglądające sposoby zaczęcia i nic
      mu nie podpowiada, który jest zalecany. Zostawiamy jeden, żeby nie trzeba
      było zgadywać.
    rationale: >-
      Wskazane przez przegląd doświadczenia programisty: komentarz w przykładzie
      retry sam nazywa withDefaults() ścieżką zalecaną, ale nazwa tego nie
      niesie wobec create(), które czyta się jak konstruktor podstawowy. Skoro
      to wydanie i tak łamie zgodność w tym module i ma jawną instrukcję
      migracji, to jest właściwy moment — odkładanie oznacza drugie takie
      wydanie za tydzień lub dwa, czego użytkownik jawnie nie chce. W
      przeciwieństwie do D2 ta zmiana JEST widoczna dla wywołującego, więc
      wymaga nakładki z ostrzeżeniem, a nie cichego cięcia.
  - id: D12
    topic: 'Powierzchnia ucząca i bramka, która ją utrzyma'
    choice: >-
      Do tego samego wydania: (1) po jednym działającym przykładzie na każdą z
      trzech rodzin presetów — dziś jest ich ZERO (F19); (2) przykład
      odczytujący statystyki pamięci podręcznej, żeby nazwany typ z D4 miał od
      pierwszego dnia skompilowanego odbiorcę; (3) przykład komponowania
      wzbogaconych reguł, bo kolejność opakowań ma znaczenie i nic dziś o tym
      nie mówi; (4) domknięcie dwóch dryfów z F15; (5) bramka grepowa w CI: zero
      odwołań do nieistniejących poleceń w README, LLMGUIDE i examples/policies.
    means: >-
      Dziś dokumentacja w dwóch miejscach uczy poleceń, które nie istnieją, a
      żaden gotowy przykład nie pokazuje omawianych skrótów. Naprawiamy to i
      dokładamy automatyczny sprawdzian, żeby ta klasa błędu nie wróciła.
    rationale: >-
      Przyczyna dryfu jest ustalona: mechanizm pilnujący, czy przykłady w
      dokumentach się kompilują, działa wyłącznie tam, gdzie ktoś ręcznie go
      włączył, a przy obu zepsutych fragmentach nikt tego nie zrobił (F20).
      Zerowe pokrycie przykładami (F19) jest przyczyną źródłową, nie skutkiem
      ubocznym — nic tych ścieżek nigdy nie kompilowało. Bramka grepowa jest
      tańsza i trudniejsza do pominięcia niż znaczniki per blok kodu: po zmianie
      nazw każde pozostałe odwołanie jest martwe z definicji.
  - id: D8
    topic: 'Dryf dokumentacji'
    choice: >-
      Oba znane odwołania do nieistniejących metod (F15) idą do istniejącego
      VD-008, nie do VB-008, z adnotacją, że VD-008 musi przebiec PO wejściu D2
      — rename unieważnia kolejne przykłady.
    means: >-
      Dokumentacja w kilku miejscach opisuje polecenia, które nie istnieją.
      Naprawimy to razem z szerszym przeglądem dokumentacji, po wprowadzeniu
      powyższych zmian, żeby nie poprawiać tych samych plików dwa razy.
    rationale: >-
      VD-008 zakresuje dokładnie tę klasę defektów ("phantom APIs") we
      wszystkich 19 pakietach (F15). Zdublowanie tego tutaj dałoby dwa taski
      edytujące te same pliki.
  - id: D9
    topic: 'Pokrycie i ślepota bramki api-surface'
    choice: >-
      NOWY TASK, priorytet średni. Dwa znaleziska: packages/policies nie ma
      własnej bramki api-extractor (F13), a symbole re-eksportowane przez
      meta-pakiet są w raporcie zapisane jako sama nazwa i pochodzenie, więc
      bramka łapie add/remove/rename, ale nie zmiany kształtu (F14). RUNDA 2
      koryguje ostrość tego znaleziska: policies MA własną bramkę snapshotową na
      eksporty wartościowe (F13), więc luka jest węższa, niż pierwotnie
      napisałem — dotyczy eksportów typów i zmian kształtu, nie nazw. Tani
      pierwszy krok przed pełną bramką: lint sprawdzający, że każdy nazwany
      eksport z barrela policies ma odpowiednik w bloku re-eksportu
      meta-pakietu.
    means: >-
      Nasz automatyczny mechanizm ostrzegania przed zmianami psującymi zgodność
      nie obejmuje tego obszaru i nie wykryłby części takich zmian. Warto to
      uszczelnić, zanim biblioteka trafi do publicznego użytku.
    rationale: >-
      F13 i F14. NOTATKA DLA IMPLEMENTERA: nie istnieje target `nx run
      @vytches/ddd-enterprise:validate:api` — panel wymienił polecenie, którego
      nie ma. Realne wywołania to root-level `pnpm validate:api` (porównanie,
      read-only) i `validate:api:local` (regeneracja). Patrz Q6.
  - id: D10
    topic: 'Pozostałości kosmetyczne'
    choice: >-
      NOWY CHORE, priorytet niski, świadomie odłożony: katalog src/decorators/
      wciąż nosi słownictwo sprzed przemianowania w API publicznym (F17), plus
      nadpisanie id przez defineProperty w forExpensivePolicy.
    means: >-
      Zostaje drobna niespójność nazewnicza widoczna wyłącznie wewnątrz zespołu.
      Odkładamy ją, bo nie wpływa na użytkowników.
    rationale: >-
      Nazwa katalogu jest nieobserwowalna spoza repo (F17); rename to czysty
      churn przy zerowym wpływie na konsumenta.

patterns: # z 0.5 (runtime.yml patterns.always + triggers)
  - typescript-library/public-api-pattern.md # WIĄŻE, ale ROZSTRZYGA INACZEJ NIŻ TASK: PA5/N2 trafia wyłącznie w trzy klasy-namespace (D2); dla trzech klas behaviors nie trafia (D1, F1), dla buildera nie ma zastosowania (D5, F10). Jedyny realny wyciek to anonimowy typ zwrotu (D4, F9). Karta wymaga zawężenia — patrz D6/Q3
  - typescript-library/backward-compatibility-pattern.md # WIĄŻE (trigger: breaking/major/deprecat/version): BC1 klasyfikuje D2 jako minor przed 1.0 (F7); BC4 (trójfazowa deprecation) ŚWIADOMIE POMINIĘTA na mocy D3 i precedensu VF-024; BC6/BC7 nie wyzwalają się — brak stanu do migracji, call-site'y wyłącznie w repo (F8)
  - typescript-library/build-publish-pattern.md # WIĄŻE SŁABO (trigger: export/build): argument o tree-shakingu okazał się pozorny — DCE na poziomie modułu jest już wygrane (osobne moduły per rodzina, jawne re-eksporty, sideEffects:false), a DCE na statykach klas warte poniżej 100 bajtów po gzip
  - typescript-library/package-boundary-pattern.md # NIE WIĄŻE: zmiana nie przekracza granicy Nx; meta-pakiet re-eksportuje mechanicznie (F8), graf zależności bez zmian
  - cross-layer/conventions-pattern.md # NIE WIĄŻE dla kodu konsumenta (brak nowych plików domenowych); jedyny styk to CV-owa niespójność nazwy katalogu, odłożona w D10 (F17)
  # library-testing-pattern.md NIE wczytany — żaden keyword triggera (test|spec|coverage|kontrakt|vitest) nie trafił w treść taska. UWAGA: gdyby D7 wszedł do realizacji, ten pattern STANIE SIĘ wiążący (testy regresyjne kompozycji, F12)
---

# Analiza: VB-008

## Synteza

Zgłoszenie mówi, że trzy rodziny mechanizmów pomocniczych w module reguł
biznesowych są udostępniane na zewnątrz w niewłaściwy sposób i że naprawa będzie
kosztowna i bolesna dla użytkowników. Po sprawdzeniu okazuje się, że w
większości nie ma czego naprawiać. Rzecz, przed którą chroni złamana rzekomo
zasada — że użytkownik nie ma nic, o co mógłby oprzeć swój kod, poza gotowym
konkretem — po prostu tu nie zachodzi: właściwy punkt zaczepienia istnieje i
jest udostępniony od dawna. Ten sam sposób udostępniania stosuje wszystkie
dziewiętnaście części biblioteki, a w jednym przypadku został kiedyś wybrany
świadomie i zapisany jako decyzja. Zostaje z tego jeden realny, drobny porządek:
trzy pomocnicze punkty wejścia mają dziś formę cięższą, niż potrzebują, i jeden
wewnętrzny szczegół niepotrzebnie wystaje na zewnątrz. To pół dnia pracy, nie
przebudowa.

Ciekawsze jest to, czego zgłoszenie w ogóle nie zauważyło. We wszystkich trzech
rodzinach połączenie wzbogaconej reguły z inną regułą po cichu gubi wzbogacenie:
reguła, którą ktoś świadomie przyspieszył albo kazał ponawiać po błędzie, traci
tę własność w momencie połączenia — bez błędu, bez ostrzeżenia. Nikt się na to
nie naciął tylko dlatego, że z tej funkcji jeszcze nikt nie korzysta, a testy,
które miały to pilnować, sprawdzają wyłącznie, czy nic nie wybuchło. To jest
usterka z realnym skutkiem dla użytkownika i to ona zasługuje na pilność, którą
tablica przypisała porządkom nazewniczym. Termin też jest realny, choć z innego
powodu, niż zakładano: dopóki biblioteka nie jest udostępniona publicznie, obie
zmiany kosztują nas zero; po premierze jedna staje się zmianą łamiącą zgodność,
a druga — z naprawy usterki — zmianą zachowania, którą trzeba ogłaszać.

## Co zmieniła doproszona runda przeglądu

Po domknięciu panelu cztery kolejne przeglądy dostały ten sam materiał z
poleceniem podważenia go. Wyszły z tego cztery poprawki i jeden warunek
wstrzymujący, wszystkie naniesione powyżej.

Najpoważniejsza dotyczy mnie samego: w opisie porządków wymieniłem jeden skrót,
który należy do zupełnie innego mechanizmu, niż napisałem — czyli popełniłem
dokładnie ten błąd, który wytknąłem wcześniejszym przeglądom. Wykonawca
poszedłby za tym i ruszył rzecz, której ruszać nie miał.

Druga poprawka unieważnia zaproponowane brzmienie wspólnej reguły. Przepuszczone
przez prawdziwy kod, podważyłoby kilkanaście najstarszych i najstabilniejszych
elementów biblioteki, w tym te najczęściej używane — czyli wyprodukowałoby
dokładnie ten zalew fałszywych zgłoszeń, któremu miało zapobiec. Nowe brzmienie
pyta o jedną rzecz, którą da się sprawdzić maszynowo, zamiast o rzecz wymagającą
osądu przy każdym zastosowaniu.

Trzecia jest korzystna: sądziłem, że ta część biblioteki nie ma żadnego
automatycznego zabezpieczenia przed niezauważoną zmianą tego, co widzi
użytkownik. Ma — innego rodzaju, węższe, ale działające, i to ono wychwyci
planowaną zmianę i wymusi świadomą decyzję. Luka jest realna, ale mniejsza, niż
napisałem.

Czwarta wyjaśnia, skąd bierze się psucie dokumentacji. Mechanizm, który miał
pilnować, czy przykłady w dokumentach się kompilują, działa wyłącznie tam, gdzie
ktoś ręcznie go włączył — a przy obu zepsutych fragmentach nikt tego nie zrobił.
Do tego żaden z trzech gotowych przykładów nie pokazuje ani jednego z omawianych
skrótów, więc nic ich nigdy nie sprawdzało.

Wreszcie warunek wstrzymujący: przegląd jakościowy odmówił zgody na wypuszczenie
samych porządków przed naprawą usterki z łączeniem reguł, dopóki opis wydania
nie ostrzega o niej wprost. Inaczej wypuszczamy dokumentację uczącą sposobu
użycia, który po cichu nie działa.

## Rekomendacja dla tablicy

| Pozycja               | Co z nią zrobić                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VB-008                | zawęzić do D2 + wyjątku z D4 + D5; złożoność `high` → `low`, priorytet P1 → średni; `release_target` = najbliższy minor 0.x przed premierą, czyste cięcie |
| nowy task (P1)        | ciche gubienie wzbogacenia przy łączeniu reguł (D7) — przejmuje zwolniony slot P1, z flagą blokera premiery                                               |
| nowy task (śr.)       | propozycja zawężenia wspólnej reguły jakościowej (D6), właściciel poza tym repo                                                                           |
| nowy task (śr.)       | pokrycie i ślepota automatycznej bramki zgodności (D9)                                                                                                    |
| nowy chore (niski)    | pozostałości nazewnicze (D10)                                                                                                                             |
| VD-008                | dopisać dwa potwierdzone odwołania do nieistniejących poleceń (D8), przebieg PO wejściu D2                                                                |
| decyzja przed startem | kształt zmiany z D2 wrócił do rozstrzygnięcia — trzej z czterech recenzentów odradzili wariant pierwotny (Q7)                                             |

## Odpowiedzi na cztery pytania z taska

1. **Czy interfejs+fabryka jest tu właściwy?** Nie. Trafia wyłącznie w trzy
   pomocnicze punkty wejścia, nie w same mechanizmy.
2. **Jaka ścieżka wycofywania?** Żadna — jedno czyste cięcie, dopóki biblioteka
   nie jest udostępniona publicznie.
3. **Zasięg zmiany?** Poza tym repozytorium praktycznie zerowy; wewnątrz —
   przykłady, dokumentacja i testy.
4. **Wszystkie trzy rodziny razem czy po kolei?** Razem. Zmiana jest w każdej
   identyczna, a przy usterce z łączenia reguł argument za wspólnym podejściem
   jest jeszcze mocniejszy.

## Ryzyka / uwagi

- **Reguła zostawiona bez zawężenia wróci.** Pozostałe osiemnaście części
  biblioteki jest zbudowanych tak samo, więc ta sama fałszywa diagnoza pojawi
  się jeszcze wielokrotnie, za każdym razem kosztując pełną analizę.
- **Premiera przed wprowadzeniem poprawek zamyka okno.** Obie zmiany stają się
  wtedy droższe o cykl wydawniczy i wymagają utrzymywania starej wersji obok
  nowej.
- **Usterka z łączeniem reguł wypuszczona na produkcję jest cicha.** Pierwszy
  użytkownik, który się na nią natnie, zdiagnozuje ją jako błąd we własnym
  kodzie, bo nic nie zgłosi problemu.
- **Nieujawniony użytkownik unieważnia rachunek kosztów.** Cały argument za
  szybkim, darmowym cięciem stoi na tym, że nikt jeszcze z tego nie korzysta.
- **Tripwire zakresu.** Jeśli implementacja zacznie przepisywać wywołania metryk
  w testach, znaczy to, że wychodzi poza uzgodniony zakres i łamie D1 albo D4.
- **Nazwy z panelu, których nie ma.** Siedem symboli i jedno polecenie
  wymienione przez agentów doradczych nie istnieje (F16, F13). Nie przenosić ich
  do implementacji — obowiązują nazwy z D2, D4 i D9.
