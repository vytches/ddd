---
task: VB-005
status: approved # zatwierdzone przez użytkownika 2026-08-25, po odpowiedzi na OQ-1..OQ-4

threat_model: null # brak stage'a threat-model w panelu tego projektu (jak VB-004/VB-006/VP-012/VB-008)

parent_task: project-orchestration/tasks/VB-005-benchmark-harness-broken.md
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml (source_hash 930fb5f182c0)

panel: # runtime.yml analyze.panel, przebieg 2026-08-25
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      when: brak,
      wynik: ok,
      tool_uses: 17,
    }
  - {
      stage: tech-analysis-specialist,
      agent: 'backend-technology-expert',
      when: brak,
      wynik: ok,
      tool_uses: 9,
    }
  - {
      stage: api-surface-analysis,
      agent: 'library-api-guardian',
      when:
        'trafienie "export" (subpath export, wielokrotnie) i "index\.ts"
        (ścieżka błędu ".../src/index.ts/internal") ← treść taska o
        rozwiązywaniu subpath exportów; trafienie sensowne, nie fragment innego
        wyrazu',
      wynik: ok,
      tool_uses: 21,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'brak trafienia when: (nowy pakiet|new package|granic|boundary|tag
        |scope:|cykl|circular|przenieś|przenosz|wydziel|extract) — naprawa nie
        przekracza żadnej granicy Nx, dotyczy wyłącznie configu jednego pakietu
        dev-only (benchmarks) i lokalnej klasy w suicie testowej',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga: 'zgodnie z polityką /analyze — ostatni osąd analizy idzie na opus',
    }
  # pominięte kroki silnika: 0a (brak stage'a threat-model), 0.7 (brak bloku ddd/core),
  # 0.8 (brak stage'a decision-gate w panelu), 0.9 (task type: bug — filtr governance
  # bez znaczenia, bo w tym projekcie i tak nie ma bloku governance w panelu)

rag:
  skipped (runtime.yml nie ma sekcji knowledge, project.yml nie deklaruje
  knowledge_collection — projekt nie ma skonfigurowanej kolekcji. Grounding ze
  statycznej listy patterns.always + triggers z 0.5, plus celowana weryfikacja
  grepem/Read każdego nazwanego symbolu przed zapisem — patrz codebase_facts)

# Fakty ustalone empirycznie (grep/Read bezpośrednio w kodzie) — wiążące dla implementera.
codebase_facts:
  F1_root_cause_potwierdzony:
    'Hipoteza taska o tsconfig (rootDir) jest BŁĘDNA. Prawdziwy root cause:
    benchmarks/vitest.config.mts ma resolve.alias w formie OBIEKTU mapującego
    każdy pakiet workspace na KONKRETNY plik (np. "@vytches/ddd-contracts" →
    ".../packages/contracts/src/index.ts"). Mechanizm dopasowania aliasu w
    Vite/rollup-plugin-alias: importee === find || importee.startsWith(find +
    "/"), potem importee.replace(find, replacement) — dla importu
    "@vytches/ddd-contracts/internal" replacement podmienia dopasowany prefiks i
    DOKLEJA resztę ścieżki ("/internal") na końcu, dając
    ".../src/index.ts/internal" → dokładnie błąd ENOTDIR z taska. Vitest/esbuild
    NIE czyta tsconfig paths/rootDir przy resolution w runtime — to fałszywy
    trop z opisu taska, potwierdzony niezależnie przez wszystkie trzy stage''e
    panelu.'
  F2_precedens_w_repo:
    'To jest regres przez POMINIĘCIE, nie nowy problem. Root
    /opt/projects/vytches-ddd/vitest.config.mts:90-108 i
    packages/nestjs/vitest.bench.config.ts:20-46 już naprawiły DOKŁADNIE ten sam
    bug pod VF-024 — formą TABLICOWĄ ({find,replacement}[]) z wpisami subpath
    PRZED wpisami bazowymi, z komentarzem wyjaśniającym pułapkę.
    benchmarks/vitest.config.mts to jedyny config w repo, który tej poprawki nie
    dostał.'
  F3_defekt_2_jest_runtime_nie_tylko_typow:
    'Money (benchmarks/suites/hot-paths.bench.ts:58-62) rozszerza
    BaseValueObject<MoneyProps> bez implementacji "validate". Konstruktor bazowy
    (packages/value-objects/src/base-value-object.ts:87) woła "if
    (!this.validate(this.value)) throw" — brak metody daje TypeError w fazie
    KOLEKCJI testów (bo "new Money(...)" stoi w ciele describe(),
    hot-paths.bench.ts:81-83, nie w bench()), wywalając CAŁY plik. Dziś
    zamaskowany przez F1 (import pada wcześniej) — po naprawie aliasu ujawni się
    natychmiast, jeśli nie naprawiony równolegle.'
  F4_druga_mina_gwarantowana:
    'events/internal NIE jest ryzykiem profilaktycznym, tylko gwarantowaną drugą
    awarią po naprawieniu contracts/internal. packages/events/src/index.ts SAM
    importuje "@vytches/ddd-events/internal", a suita importuje DomainEvent z
    "@vytches/ddd-events" (tranzytywnie). Bez wpisu dla events/internal kolejny
    ENOTDIR pada natychmiast po fixie contracts.'
  F5_domkniecie_tranzytywne_male:
    'Grep po importach w src/ pakietów aggregates/value-objects/events/
    contracts/utils/domain-primitives (te importowane przez suitę, wprost i
    tranzytywnie) daje wyłącznie te 6 pakietów + 2 subpathy (contracts/internal,
    events/internal). Zakres naprawy jest zamknięty i znany — nie trzeba
    pokrywać wszystkich 19 pakietów biblioteki.'
  F6_druga_suita_i_stary_baseline:
    'benchmarks/vitest.config.mts include obejmuje "suites/**/*.bench.ts" —
    ISTNIEJE druga suita, isolated-hash.bench.ts, która DZIŚ przechodzi
    (benchmarks/node_modules/.vite/vitest/.../results.json: hot-paths
    failed:true duration:0, isolated-hash failed:false). Zielony wynik drugiej
    suity dziś maskuje w reporterze fail pierwszej — exit code całego przebiegu
    NIE jest wiarygodnym dowodem AC1. benchmarks/baseline.json (v0.25.0-beta.1,
    2026-05-09) zawiera realne pomiary, ale pod nazwami których w obecnym
    hot-paths.bench.ts już nie ma ("AggregateRoot.apply() — single event" vs
    obecne "single event application") — baseline jest przestarzały, nie
    fikcyjny, i nie mapuje się po nazwach.'
  F7_internal_subpath_to_swiadomy_wzorzec:
    'packages/contracts/src/internal.ts ma jawny nagłówek dokumentujący subpath
    "./internal" jako ŚWIADOMY mechanizm współdzielenia kodu międzypakietowego
    (VF-024): "Cross-package-only internal symbols. NOT part of the public
    consumer API [...] Consumers of @vytches/ddd should never import from this
    subpath." 38 plików w 15+ pakietach go używa. Zgodny z Rule Cards
    PA2/N6/PB5/PB8/N3/N4 (zweryfikowane cytatami reguł). NIE jest to dług do
    odnotowania w VB-005.'
  F8_zero_wplywu_na_publiczne_API:
    '@vytches/benchmarks ma "private": true, brak pól "exports"/"files" w
    package.json — nigdy nie był i nie może być publikowany. Zmiany ograniczone
    do benchmarks/vitest.config.mts, benchmarks/suites/hot-paths.bench.ts
    (lokalna klasa Money, nie eksport z packages/*) i benchmarks/README.md.
    Warstwa "api-surface" z orchestrate.layers (create_when: diff dotyka
    index.ts/eksportowanych sygnatur) NIE powinna się aktywować.'
  F9_rozjazd_list_pakietow:
    'benchmarks/package.json (deps): 5 pakietów. benchmarks/vitest.config.mts
    (alias): 7 pakietów. tsconfig.base.json (paths): 22 pakiety. Rozjazd
    istnieje niezależnie od wybranego wariantu naprawy aliasu — wymaga jawnego
    wyrównania listy deps/alias przy okazji tej zmiany (nie osobnego taska),
    inaczej rozszerzenie suity o kolejny pakiet powtórzy F1.'

open_questions:
  - id: OQ-1
    blocking: false # nie blokuje AC1-AC3, dotyczy tylko zabezpieczenia przed regresją
    ask: >-
      Czy benchmarki mają być uruchamiane automatycznie w naszym cyklu pracy
      (np. przy każdej zmianie), czy zostają narzędziem odpalanym ręcznie przez
      dewelopera? Jeśli ręcznie, ta sama awaria może kiedyś wrócić niezauważona.
    q: >-
      Czy "pnpm run bench" jest wywoływane wyłącznie lokalnie w benchmarks/, czy
      istnieje delegacja z roota (Nx target / skrypt root package.json / krok
      CI) — niezweryfikowane w panelu. Konsekwencja: jeśli bench nie biegnie w
      CI, forma tablicowa aliasu (D1) pozostaje wrażliwa na przypadkowy
      reordering wpisów bez żadnego automatycznego sygnału regresu.
    answer: >-
      ODPOWIEDŹ 2026-08-25: ręcznie, na razie. Zostaje narzędziem uruchamianym
      przez dewelopera na żądanie; ryzyko cichego powrotu awarii (bez sygnału z
      CI) przyjęte świadomie. Automatyzacja jako ewentualny osobny follow-up,
      nie w zakresie VB-005.
  - id: OQ-2
    blocking: false # nie blokuje AC1-AC3, dotyczy wyłącznie ewentualnego commitu do baseline.json
    ask: >-
      Po naprawie narzędzia, czy chcemy od nowa zmierzyć i zapisać aktualne
      wyniki wydajnościowe dla obecnej wersji biblioteki, czy zostawić stare
      pomiary sprzed kilku miesięcy jako punkt historyczny? Nowe pomiary są
      wiarygodne tylko wtedy, gdy zrobimy je na tej samej maszynie co
      poprzednio.
    q: >-
      benchmarks/baseline.json (v0.25.0-beta.1, capturedOn 2026-05-09) zawiera
      pomiary pod nazwami nieobecnymi w dzisiejszym hot-paths.bench.ts i brak
      wpisów dla bloku CachedPolicy dodanego w VP-012c. Repo jest dziś na
      v0.31.0. Warianty: (a) re-capture całości po naprawie i nadpisanie
      baseline, (b) zachować stary jako historyczny i dopisać nową sekcję, (c)
      nie ruszać w VB-005.
    answer: >-
      ODPOWIEDŹ 2026-08-25: (c) nie ruszać w VB-005 — zgodnie z rekomendacją
      panelu. To naprawa narzędzia, nie nowy pomiar wydajności; re-capture
      zostaje osobną decyzją na stabilnym sprzęcie, poza zakresem tego taska.
  - id: OQ-3
    blocking: false # rozszerzenie zakresu poza deklarowane AC, wymaga zgody
    ask: >-
      Czy przy tej naprawie dołożyć automatyczne sprawdzanie poprawności typów w
      katalogu benchmarków? Kosztuje trochę dodatkowej pracy teraz, ale bez tego
      defekt typu "brakująca metoda" może wrócić i znów zostanie wykryty
      dopiero, gdy narzędzie przestanie działać.
    q: >-
      Czy dodać target "type-check" (tsc --noEmit) dla benchmarks/. Defekt #2
      (brakująca implementacja abstrakcyjnej metody validate()) to błąd
      kompilacji TS, który przeszedł niezauważony, bo tsc nigdy nie jest w tym
      katalogu odpalany, a Vitest/esbuild strippuje typy bez sprawdzania — ta
      sama klasa błędu co feedback_nestjs_typecheck_required dla pakietu nestjs.
      Poza zadeklarowanym zakresem AC.
    answer: >-
      ODPOWIEDŹ 2026-08-25: nie, poza zakresem — zgodnie z rekomendacją panelu.
      VB-005 ma jasno zakreślone AC; type-check dla benchmarks/ zostaje osobnym,
      dobrze zakresowanym follow-upem, nie rozszerzeniem tego taska.
  - id: OQ-4
    blocking: true # definiuje treść AC1/AC4 — implementer potrzebuje tego przed napisaniem README
    ask: >-
      Czy instrukcja weryfikacji harnessu ma wymagać sprawdzenia, że wszystkie
      pomiary faktycznie się wykonały i wypisały wynik, a nie tylko że polecenie
      "zakończyło się sukcesem"? Bez tego możemy uznać narzędzie za naprawione,
      choć część pomiarów cicho nie wystartowała.
    q: >-
      Treść AC4 (notatka w benchmarks/README.md): czy wymaganiem ma być
      weryfikacja, że wyprodukowano wynik dla WSZYSTKICH 11 bench() w 5 blokach
      describe w hot-paths.bench.ts, a nie samo exit 0? Uzasadnienie (F6):
      include obejmuje też isolated-hash.bench.ts, która JUŻ dziś przechodzi
      obok padającej hot-paths — reporter pokazuje zielone wyniki mimo defektu.
      Rekomendacja panelu (tech-lead): TAK, twarde kryterium = policzalna liczba
      wierszy wyniku z hot-paths, nie ogólny exit code.
    answer: >-
      ODPOWIEDŹ 2026-08-25: TAK — twarde kryterium. AC1/AC4 wymagają policzalnej
      liczby wyników (11 pomiarów w 5 blokach describe) z hot-paths.bench.ts,
      nie samego exit 0 całego przebiegu. Uzasadnienie przyjęte: sam exit code
      nie jest dowodem naprawy — to dokładnie ten błąd klasy "cichy fałszywy
      zielony", przez który VB-005 w ogóle powstało.

decisions:
  - id: D1
    topic: 'Naprawa aliasu resolve.alias w benchmarks/vitest.config.mts'
    choice: >-
      Forma TABLICOWA {find, replacement}[], wpisy
      "@vytches/ddd-contracts/internal" i "@vytches/ddd-events/internal" PRZED
      wpisami bazowymi, 1:1 ze wzorcem z root vitest.config.mts:90-108, wraz z
      przeniesieniem komentarza VF-024 wyjaśniającego pułapkę kolejności.
      ODRZUCONA alternatywa: alias na KATALOG src/ pakietu, generowany
      dynamicznie (readdirSync po packages/*/package.json).
    means: >-
      Naprawa idzie sprawdzoną ścieżką, którą to repo już raz przeszło w innym
      miejscu — bez nowego mechanizmu do utrzymywania i bez ryzyka, że narzędzie
      zacznie pozwalać na więcej niż powinno.
    rationale: >-
      Alternatywa (katalog, generowany) była realną propozycją jednego z dwóch
      niezależnych recenzentów technicznych (przewaga: pokrywa systemowo KAŻDY
      przyszły subpath bez ręcznych wpisów) — ale po weryfikacji w kodzie (F5)
      jedyna dodatkowa mina, którą realnie domyka, to events/internal, a Opcja A
      i tak ją wpisuje wprost. Koszt alternatywy jest natychmiastowy i
      konkretny: alias na katalog czyni importowalnym KAŻDY plik pod src/ z 22
      pakietów (nie tylko 5-7 zadeklarowanych w benchmarks/package.json), więc
      benchmark przestaje wykrywać dryf zależności i przestaje być wiarygodnym
      świadkiem granic pakietu — odwrotnie do intencji AC2. Trzy configi w repo
      mają już formę tablicową; czwarty wariant to trwały koszt spójności bez
      proporcjonalnego zysku. Ryzyko reorderingu (podnoszone przez zwolennika
      Opcji B) jest realne, ale adresowane inaczej: komentarzem w kodzie +
      pytaniem o uruchamianie w CI (OQ-1), nie zmianą kształtu aliasu.
  - id: D2
    topic: 'Zakres naprawy — events/internal'
    choice: >-
      Naprawa events/internal wchodzi do TEGO SAMEGO taska/PR co
      contracts/internal, nie jako osobny follow-up.
    means: >-
      Naprawiamy obie ukryte usterki naraz, więc nie wracamy do tego tematu za
      tydzień z drugim identycznym zgłoszeniem.
    rationale: >-
      F4: packages/events/src/index.ts sam importuje własny subpath internal, a
      suita importuje z tego pakietu tranzytywnie — po naprawieniu
      contracts/internal kolejny ENOTDIR pada natychmiast bez tego wpisu. To ten
      sam mechanizm defektu, ta sama linia kodu do zmiany, ten sam commit.
  - id: D3
    topic:
      'Klasa Money w suicie — zostaje czy zamiana na realną klasę z biblioteki'
    choice: >-
      Lokalna klasa Money ZOSTAJE. Dodajemy wyłącznie brakującą metodę
      "validate(value: MoneyProps): boolean", opartą WYŁĄCZNIE na parametrze
      "value" (nigdy na polach instancji "this").
    means: >-
      Naprawiamy tylko to, co jest zepsute, bez zmiany tego, co dokładnie
      benchmark mierzy — wyniki pozostają porównywalne z poprzednimi pomiarami.
    rationale: >-
      packages/value-objects nie eksportuje żadnej gotowej klasy pieniężnej —
      nie ma czym podmienić lokalnego przykładu (zweryfikowane: index.ts
      eksportuje wyłącznie BaseValueObject/ValueObjectValidator/EntityId/
      BrandedId + fabryki). Podstawienie cięższego VO zmieniłoby przedmiot
      pomiaru "BaseValueObject.equals()" i zerwałoby porównywalność z
      baseline.json. Ograniczenie do parametru jest konieczne, bo konstruktor
      bazowy (VF-023, base-value-object.ts:69-77) woła validate() PRZED
      inicjalizacją pól podklasy — odwołanie do "this" w tym punkcie dałoby
      undefined, nie realne dane.
  - id: D4
    topic: 'Subpath "./internal" jako wzorzec architektoniczny'
    choice: >-
      Status quo. VB-005 NIE kwestionuje ani nie zmienia wzorca cross-package
      subpath exports contracts/internal i events/internal.
    means: >-
      Nie otwieramy przy okazji naprawy narzędzia osobnej dyskusji o tym, w jaki
      sposób pakiety biblioteki dzielą się kodem między sobą — to świadoma,
      wcześniej zaakceptowana decyzja, nie przypadkowy wyciek.
    rationale: >-
      Udokumentowany w kodzie wzorzec z VF-024 (F7), używany w 38 plikach w 15+
      pakietach, zgodny z Rule Cards public-api-pattern (PA2, N6) i
      package-boundary-pattern (PB5, PB8, N3, N4) — zweryfikowane cytatami
      reguł, nie tylko deklaracją. Zmiana tego wzorca, gdyby była potrzebna, to
      osobny task audytowy obejmujący całe monorepo, nie naprawa harnessu
      benchmarkowego jednego pakietu dev-only.
  - id: D5
    topic: 'Wpływ na publiczne API i warstwę api-surface'
    choice: >-
      Brak wpływu na publiczne API żadnego publikowanego pakietu. Warstwa
      "api-surface" z orchestrate.layers NIE powinna się aktywować dla tego
      taska.
    means: >-
      Ta zmiana nie może zepsuć niczego u odbiorców biblioteki — nie wymaga
      osobnego przeglądu zgodności wstecznej ani wpisu w plikach wydania.
    rationale: >-
      F8: @vytches/benchmarks ma "private": true, brak pól exports/files, nigdy
      nie był publikowany. Cały zakres zmian to jeden plik configu narzędzia
      deweloperskiego, jedna lokalna klasa w suicie testowej i jeden plik README
      — żaden nie jest częścią publikowanej powierzchni API.
  - id: D6
    topic: 'Kryterium odbioru AC1 wobec dwóch suit benchmarkowych'
    choice: >-
      AC1 weryfikowane per-suita (policzalna liczba wyników z hot-paths.bench.ts
      — patrz OQ-4), nie po samym exit code całego przebiegu "pnpm run bench".
    means: >-
      Sprawdzimy, że naprawiona suita faktycznie wyprodukowała wszystkie
      obiecane pomiary, a nie tylko że polecenie "nie zwróciło błędu" — inaczej
      moglibyśmy uznać naprawę za zakończoną, mimo że część pomiarów po cichu
      się nie wykonała.
    rationale: >-
      F6: include obejmuje DWIE suity ("suites/**/*.bench.ts") —
      isolated-hash.bench.ts już dziś przechodzi obok padającej
      hot-paths.bench.ts, więc sam exit code całego przebiegu nie jest dowodem
      naprawy konkretnie tej suity, o której mówi task. Zależne od odpowiedzi na
      OQ-4 (rekomendacja panelu: tak, twarde kryterium liczbowe).

patterns:
  - cross-layer/conventions-pattern.md # source: ts-library, always
  - typescript-library/public-api-pattern.md # source: ts-library, always
  - typescript-library/package-boundary-pattern.md # source: nx-monorepo, always
  - typescript-library/build-publish-pattern.md # trigger: "export"/"eksport" (subpath export, wielokrotnie w tasku)
  - typescript-library/library-testing-pattern.md # trigger: "vitest" (vitest configu paczki benchmarks)

units: []

orchestrate_run: # /orchestrate VB-005, przebieg 2026-08-25
  layers_done: [implementation]
  layers_skipped:
    - {
        id: testing,
        powód:
          'brak nowych testów bibliotecznych w packages/*/tests — naprawa
          dotyczy wyłącznie harnessu dev-only',
      }
    - {
        id: api-surface,
        powód: 'D5 — zero wpływu na publiczne API, create_when niespełnione',
      }
  checks_layer_skipped:
    - {
        checks: ['lint', 'validate:types', 'deps:circular'],
        powód:
          'benchmarks/ nie jest projektem Nx (brak project.json, nx.json
          obejmuje tylko packages/*) — żaden z tych skryptów go nie dotyka',
      }
  real_check:
    'pnpm run bench (root deleguje do pnpm -F @vytches/benchmarks bench)
    uruchomiony bezpośrednio przez verify + final_gate jako jedyna faktyczna
    bramka'
  layer_verify:
    {
      agent: 'ecc:typescript-reviewer',
      attempts: 2,
      werdykt_final: GO,
      benchCheck:
        { exitCode: 0, hotPathsResultCount: 11, isolatedHashPassed: true },
    }
  final_gate: { agent: 'library-quality-verifier', werdykt: GO }
  korekta_faktu:
    'F6 w analizie opierał się na przestarzałym cache node_modules/.vite/vitest/
    — isolated-hash.bench.ts NIE istnieje dziś w benchmarks/suites/ (tylko
    hot-paths.bench.ts). Nie zmienia to żadnej decyzji (D6 — twarde kryterium
    liczby wyników — pozostaje słuszne jako zabezpieczenie na przyszłość),
    implementer poprawnie zweryfikował stan bieżący zamiast ślepo podążyć za
    nieaktualnym faktem z artefaktu.'
  status: 'STAGE_NOT_COMMIT — zmiany w stage, commit robi człowiek'
---

# Analiza: VB-005-benchmark-harness-broken

## Synteza (tech-lead)

Root cause defektu #1 jest potwierdzony i inny niż hipoteza w tasku: to błąd
dopasowania aliasu w `benchmarks/vitest.config.mts` (prefix-match doklejający
resztę ścieżki subpath exportu), nie problem `tsconfig.json`. Repo ma już
sprawdzony precedens naprawy tego samego buga (VF-024) w dwóch innych configach
— naprawa VB-005 kopiuje ten wzorzec (D1), rozszerzony o drugą, dotąd
niezauważoną minę: `@vytches/ddd-events/internal` (D2), która wybuchnie
natychmiast po naprawieniu pierwszej, jeśli nie zostanie naprawiona równolegle.

Defekt #2 (`Money.validate()`) to blokada uruchomieniowa, nie tylko błąd typów —
wywala całą suitę w fazie kolekcji testów. Naprawa jest prosta: dopisać metodę
opartą wyłącznie na parametrze wejściowym (D3).

Zakres jest zamknięty i mały: 6 pakietów, 2 subpathy, jeden plik configu, jedna
klasa w suicie, jeden README. Zmiana nie dotyka publicznego API żadnego
publikowanego pakietu (D5) i nie kwestionuje istniejącego, udokumentowanego
wzorca współdzielenia kodu między pakietami biblioteki (D4). Jedyna pułapka przy
odbiorze: benchmarks ma DWIE suity, a druga już dziś przechodzi — więc samo
"polecenie zakończyło się sukcesem" nie dowodzi, że naprawiona suita faktycznie
coś zmierzyła (D6, OQ-4).

Rekomendacja: kierunek naprawy AC1-AC3 jest rozstrzygnięty i nieblokowany żadnym
z otwartych pytań. OQ-4 (treść kryterium AC1/AC4) wymaga odpowiedzi przed
napisaniem notatki README, OQ-1/OQ-2/OQ-3 dotyczą wyłącznie decyzji o
rozszerzeniu zakresu poza deklarowane AC i nie blokują startu.

## Plan per AC

- **AC1** (pnpm run bench, exit 0, wszystkie bench() wykonane) — wynika z
  AC2+AC3; kryterium odbioru wg OQ-4: policzalna liczba wyników z
  `hot-paths.bench.ts` (11 pomiarów w 5 blokach `describe`), nie sam exit code
  całego przebiegu (bo obejmuje też drugą, już zieloną suitę).
- **AC2** (naprawiony import subpath, bez importu relatywnego) —
  `benchmarks/vitest.config.mts`: `resolve.alias` z obiektu na tablicę
  `{find, replacement}[]`, wpisy `@vytches/ddd-contracts/internal` i
  `@vytches/ddd-events/internal` na początku, z komentarzem VF-024. Zero zmian w
  importach źródłowych pakietów.
- **AC3** (Money implementuje validate()) —
  `benchmarks/suites/hot-paths.bench.ts:58-62`: dodać
  `validate(value: MoneyProps): boolean` czytającą wyłącznie `value`.
- **AC4** (notatka README) — `benchmarks/README.md`: sekcja o lokalnej
  weryfikacji harnessu, z oczekiwaną liczbą pomiarów (wg OQ-4) i jednym zdaniem
  o tym, że alias omija `package.json#exports` — świadomy wyjątek ograniczony do
  `benchmarks/`, nie wzorzec do kopiowania w pakietach publikowanych.

## Otwarte pytania (DO DYSKUSJI — odpowiedz w frontmatter `answer:`)

- **OQ-1** (nieblokujące): Czy benchmarki mają biec automatycznie w pipeline,
  czy zostają narzędziem ręcznym?
- **OQ-2** (nieblokujące): Czy odświeżyć `baseline.json` po naprawie?
- **OQ-3** (nieblokujące): Czy dodać `type-check` dla `benchmarks/`?
- **OQ-4** (blokujące AC1/AC4): Czy kryterium odbioru ma wymagać policzalnej
  liczby wyników, nie tylko exit 0?

## Decyzje (proponowane — zweryfikuj)

- **D1**: forma tablicowa aliasu, wzorzec z root configu (nie alias na katalog).
- **D2**: naprawa `events/internal` wchodzi do tego samego taska.
- **D3**: lokalna `Money` zostaje, dopisujemy `validate()`.
- **D4**: subpath `./internal` to status quo, nie dług do naprawy tutaj.
- **D5**: zero wpływu na publiczne API, warstwa `api-surface` nie aktywuje się.
- **D6**: AC1 weryfikowane per-suita, nie po ogólnym exit code.

## Ryzyka / uwagi

- Druga suita (`isolated-hash.bench.ts`) już dziś przechodzi i może maskować w
  reporterze fail suity `hot-paths` — patrz D6/OQ-4.
- Rozjazd list pakietów między `benchmarks/package.json` (5),
  `benchmarks/vitest.config.mts` (7) i `tsconfig.base.json` (22) istnieje
  niezależnie od tej naprawy — implementer powinien wyrównać deps/alias przy
  okazji, inaczej rozszerzenie suity o kolejny pakiet w przyszłości powtórzy
  dokładnie ten sam defekt.
- `baseline.json` jest przestarzały (nazwy pomiarów się nie zgadzają z obecną
  suitą) — nie ruszać go bez odpowiedzi na OQ-2.

---

> Po wypełnieniu odpowiedzi i zatwierdzeniu decyzji: ustaw `status: approved`,
> dopiero wtedy `/orchestrate VB-005`. **KONIEC — nie wołaj orchestracji, nie
> implementuj.**
