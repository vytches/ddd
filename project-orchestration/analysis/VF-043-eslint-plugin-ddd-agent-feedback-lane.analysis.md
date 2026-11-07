---
task: VF-043
telemetry_run: analyze-20261104-202303-9487
status: approved
layers_done:
  [
    'implementation:scaffold',
    'implementation:ci-matrix',
    'implementation:roles-resolver',
    'implementation:scoped',
    'implementation:config-validate',
    'implementation:rules',
    'implementation:entry-agent',
    'testing:tests-contract',
    'api-surface',
  ]
threat_model: null

rag:
  - 'retrieve_code(collection=code_vytches_ddd): 0 trafień, kolekcja nie
    istnieje (projekt nieindeksowany), wiedza o kodzie z odczytu plików'
  - "retrieve_patterns('ESLint rule scoped to DDD role...'): 5 trafień,
    wszystkie z innych stosów (nestjs-ddd, nextjs), żadne nie dotyczy pakietu
    bibliotecznego"

stack_blocks:
  [ts-library, library-layers, nx-monorepo, approval-gate, ./vytches-agents]

open_questions:
  - id: Q1
    ask: >-
      Czy zatwierdzamy dziś etap zero, czy najpierw kończymy trzy otwarte
      sprawdzenia (typowane dekoratory, konfiguracja ESLint 9, pomiar "przed")?
      Kończymy je wcześniej: wtedy start prac jest wolniejszy o kilka godzin,
      ale decyzje o kształcie pakietu opierają się na pomiarach.
    q:
      "Phase 0 sign-off: AC-SPIKE (c), (d), (e) otwarte. Propozycja odroczenia
      (c) do osobnego zadania o typach (follow-up 'Types first') zmienia
      AC-SPIKE ustalone przez właściciela."
    class: USER_CHALLENGE
    door_type: two-way
    decision: D1
    options:
      [
        'Kończymy (c), (d) i (e) przed podpisem (recommended)',
        'Podpisujemy teraz, (c) przechodzi do zadania o typach, (d) i (e) w
        pierwszych dniach Phase 1',
      ]
    answer: 'Kończymy (c), (d) i (e) przed podpisem'
  - id: Q2
    ask: >-
      Zestaw reguł startowych zakłada, że dekorator obsługi zdarzeń przyjmuje
      zwykły tekst, a przyjmuje tylko klasę zdarzenia, więc jedna reguła łapie
      błąd, który i tak blokuje kompilator. Czy usuwamy tę regułę oraz drugą,
      bez żadnego źródła w dokumentacji, żeby start nie narzucał stylu?
    q:
      "Preset: (c) @EventHandler('string') redundantne
      (event-handler.decorator.ts:23-26), (h) apply() z IntegrationEvent bez
      źródła w LLMGUIDE/README/docs. Wymóg 7 z zadania (zero trafień na
      dokumentowanym użyciu) i AC-PRESET."
    class: USER_CHALLENGE
    door_type: two-way
    decision: D5
    options:
      [
        'Zmieniamy podejście: usuwamy (c) i (h) z zestawu startowego, wracamy do
        (h) po udokumentowaniu zakazu (recommended)',
        'Zatwierdzam decyzję mimo to: zostawiamy wszystkie osiem reguł, bo
        właściciel tak ustalił',
      ]
    answer:
      'Zmieniamy podejście: usuwamy (c) i (h) z zestawu startowego, wracamy do
      (h) po udokumentowaniu zakazu'
  - id: Q3
    ask: >-
      Pod jaką nazwą publikujemy pakiet w rejestrze npm? Nazwy nie da się
      później zmienić bez porzucenia starej i ściągania użytkowników na nową.
    q:
      'Nazwa publiczna (one-way): @vytches/eslint-plugin-ddd (zadanie, konwencja
      ESLint; 4 z 5 doradców) vs @vytches/ddd-eslint-plugin (pasuje do globu
      fixed w .changeset/config.json:5 i do prefiksu ddd- 19 pakietów;
      library-expert). Przy flat-only konwencja nazwy ESLint nie jest wymagana
      technicznie.'
    class: TASTE
    door_type: one-way
    decision: D2
    options:
      [
        '@vytches/eslint-plugin-ddd, dopisujemy nazwę do wspólnego wersjonowania
        (recommended)',
        '@vytches/ddd-eslint-plugin, pasuje do istniejącego wzorca nazw',
      ]
    answer:
      '@vytches/eslint-plugin-ddd, dopisujemy nazwę do wspólnego wersjonowania'
  - id: Q4
    ask: >-
      Wspieramy tylko nowy format konfiguracji ESLint, czy także stary? Stary
      format wyklucza reguły zdefiniowane w locie, więc najważniejszy mechanizm
      pakietu w nim nie zadziała, a obsługa obu formatów podwaja pracę i testy.
    q:
      'eslintrc vs flat-only (decyzja 3, one-way: publiczny kontrakt
      konfiguracji). roleScoped wymaga pluginów inline (run.js:86); npm
      dist-tags: eslint latest 10.14.0, 9.39.5 w tagu maintenance.'
    class: TASTE
    door_type: one-way
    decision: D3
    options:
      [
        'Tylko nowy format (flat), obsługa ESLint 9.39 i 10 (recommended)',
        'Nowy i stary format',
      ]
    answer: 'Tylko nowy format (flat), obsługa ESLint 9.39 i 10'
  - id: Q5
    ask: >-
      Czy pakiet udostępnia wyłącznie nazwane eksporty, zgodnie z regułą
      biblioteki, czy także jeden eksport domyślny, do którego przyzwyczajeni są
      użytkownicy ESLint? Pierwsza opcja trzyma zasady biblioteki, druga jest
      wygodniejsza dla użytkownika, ale później nie da się jej cofnąć.
    q:
      'Kształt eksportu (one-way). PA1 karty public-api: tylko nazwane eksporty.
      Nazwane rules/configs/meta/plugin działają w flat config i przez require()
      w CJS; default import w ESM wymagałby export default (wyjątek od PA1,
      usunięcie później łamie).'
    class: TASTE
    door_type: one-way
    decision: D4
    options:
      [
        'Tylko nazwane eksporty, zgodnie z regułą biblioteki (recommended)',
        'Dodatkowo eksport domyślny, świadomy wyjątek od reguły',
      ]
    answer: 'Tylko nazwane eksporty, zgodnie z regułą biblioteki'
  - id: Q6
    ask: >-
      Czy słownik ról (jakie klocki DDD rozpoznaje pakiet) zostaje w pakiecie
      wtyczki? Wydzielenie go później do osobnego pakietu jest tanie, a osobny
      pakiet teraz dokłada rejestracje bez realnego odbiorcy.
    q:
      'Decyzja 4 zadania: słownik w pluginie vs osobny pakiet. Pięciu doradców:
      plugin; wydzielenie później jest addytywne (re-eksport), o ile słownik nie
      jest publicznym eksportem.'
    class: TASTE
    door_type: two-way
    decision: D6
    options:
      ['Zostaje w pakiecie wtyczki (recommended)', 'Osobny mały pakiet od razu']
    answer: 'Zostaje w pakiecie wtyczki'
  - id: Q7
    ask: >-
      Co z dotychczasowym narzędziem do sprawdzania zasad DDD w tym
      repozytorium? Zostawiamy je bez zmian na razie, a z nowego pakietu wchodzi
      tylko reguła o importach.
    q:
      'Decyzja 1 zadania: tools/ddd-lint zostaje (CI ddd:lint || true,
      README:81-96), ddd-005 przeniesiona do presetu z allowlistą, ddd-001..003
      jako przykłady konwencji projektu, nie w presecie. ddd-002 flaguje
      dokumentowany wzorzec VO (no-throw-in-domain.ts).'
    class: TASTE
    door_type: two-way
    decision: D7
    options:
      [
        'Narzędzie zostaje, reguła o importach przechodzi do nowego pakietu,
        reszta to przykłady dla projektów (recommended)',
        'Wygaszamy narzędzie po wdrożeniu pakietu',
      ]
    answer:
      'Narzędzie zostaje, reguła o importach przechodzi do nowego pakietu,
      reszta to przykłady dla projektów'
  - id: Q8
    ask: >-
      Co dokumentacja biblioteki mówi o tworzeniu obiektów wartości: czy
      konstruktor może zgłosić błąd, czy zalecamy wariant zwracający wynik? Dziś
      przykłady się ze sobą kłócą, więc użytkownicy i narzędzia dostają
      sprzeczne sygnały.
    q:
      "Decyzja 2 zadania (VO factory throw vs Result). Konstruktor
      BaseValueObject rzuca (base-value-object.ts:87-89), a LLMGUIDE mówi 'do
      not throw inside the constructor' i ma nieosiągalne walidacje w
      Money/EmailAddress.create. Zmiana to dokumentacja, nie kod, i osobne
      zadanie."
    class: TASTE
    door_type: two-way
    decision: D8
    options:
      [
        'Konstruktor może zgłosić błąd, wariant bez błędu to osobna metoda
        zwracająca wynik, docs do poprawy w osobnym zadaniu (recommended)',
        'Biblioteka zaleca wynik zamiast błędu we wszystkich fabrykach',
      ]
    answer:
      'Konstruktor może zgłosić błąd, wariant bez błędu to osobna metoda
      zwracająca wynik, docs do poprawy w osobnym zadaniu'
  - id: Q9
    ask: >-
      Czy dodajemy do repozytorium prosty skrypt uruchamiający testy dla
      wskazanych plików i zgodę dla agentów na jego użycie? Bez tego agenci nie
      uruchomią testów nowego pakietu i implementacja stanie.
    q:
      "Blokada test-guard (decyzja 1 'oczekujące na właściciela'): brak skryptu
      test:unit i brak .claude/test-guard.json (zweryfikowane). Zmiana poza
      zakresem biblioteki: root package.json (w jednostce scaffold),
      .claude/test-guard.json i instrukcje agenta testowego ręcznie przed
      startem. Warunki: skrypt pada przy zerze testów, zakaz -u/--update w
      guardzie."
    class: TASTE
    door_type: two-way
    decision: D9
    options:
      [
        'Tak, skrypt i zgoda dodane przed startem implementacji (recommended)',
        'Nie, testy uruchamia człowiek po każdej warstwie',
      ]
    answer: 'Tak, skrypt i zgoda dodane przed startem implementacji'
  - id: Q10
    ask: >-
      Czy etap zero jest domknięty i podpisany (typowane dekoratory,
      konfiguracja ESLint 9, pomiar "przed" oraz pomiar czasu zimnego procesu od
      startu do wyniku)? Do Twojej odpowiedzi implementacja się nie zacznie.
    q:
      'Bramka Phase 0 (D1, Q1): wpisz tu odpowiedź dopiero, gdy (c), (d), (e)
      mają spike logi w pliku zadania, a pomiar zimnego procesu lintText
      (p50/p95, N≥30, ESLint 9.39 i 10) jest zapisany. Odpowiedź null blokuje
      /orchestrate.'
    class: TASTE
    door_type: two-way
    decision: D1
    answer:
      'Zatwierdzone przez właściciela 2026-11-05 z jawnym wyjątkiem od
      odpowiedzi na Q1: (c) typowane dekoratory, (e) pomiar przed, ESLint 10 w
      (d) i pomiar zimnego procesu lintText na prawdziwym pakiecie (p50/p95,
      N≥30, ESLint 9.39 i 10) nie są domknięte; implementacja Phase 1 zaczyna
      się od nich, a wyniki trafiają do pliku zadania jako spike logi przed
      pierwszą regułą'

decisions:
  - id: D1
    topic: 'Zakres przebiegu i bramka etapu zero'
    choice:
      "Najpierw domknąć Phase 0 ((c), (d), (e)) i podpis (Q10); /orchestrate
      dostaje tylko Phase 1 (pakiet, resolver, roleScoped, preset, walidacja,
      komunikaty, testy, README i LLMGUIDE). AC-DOGFOOD (uruchomienie na dwóch
      repozytoriach konsumentów), przewodnik 'binding your own...', nota
      migracyjna ddd-lint i warstwa typowana idą do osobnego przebiegu Phase 2."
    means:
      'Pierwszy przebieg dostarcza działający pakiet, ale bez dowodu na
      prawdziwych projektach. Ten dowód jest osobnym krokiem po podpisie.'
    rationale:
      "Zadanie: 'Nothing else starts until the founder signs off' (Phase 0) i
      podział Phase 1 / Phase 2 w sekcji Phases. AC-DOGFOOD wymaga repozytoriów
      konsumentów poza tym repozytorium, czego warstwy orchestrate nie obejmują.
      Pomiar 240 ms z prototypu mierzy lintFiles po załadowaniu ESLint i
      parsera, więc przed podpisem trzeba zmierzyć zimny proces od startu do
      wyniku lintText (library-quality-verifier, performance-risk)."
    class: USER_CHALLENGE
    door_type: two-way
    premises:
      - {
          claim:
            'Brak packages/eslint-plugin-ddd i brak jakiegokolwiek kodu pluginu
            w repo (praca nie jest zrobiona)',
          evidence:
            'ls packages/eslint-plugin-ddd: No such file (sprawdzone w tej
            analizie)',
          holds: true,
        }
  - id: D2
    topic: 'Nazwa pakietu'
    choice:
      "@vytches/eslint-plugin-ddd w packages/eslint-plugin-ddd, tagi type:lib,
      scope:eslint-plugin, layer:tooling; nazwa dopisana do 'fixed' w
      konfiguracji Changesets; config/packages.json z includeInEnterprise:false;
      pakiet NIE wchodzi do meta-pakietu enterprise."
    means:
      'Nazwa jest zgodna z konwencją narzędzi ESLint i z zadaniem. Pakiet jest
      wydawany razem z resztą, ale nie trafia do zestawu runtime.'
    rationale:
      "Karta PB1/PB2 (tagi + depConstraints), karta BP6 (host jako peer). 4 z 5
      doradców za tą nazwą; sprzeciw library-expert (prefiks ddd- wszystkich 19
      pakietów, glob fixed bez edycji). Rozjazd globa: .changeset/config.json:5
      'fixed' = @vytches/ddd-*, nazwa go nie pasuje, więc wpis dopisujemy.
      Precedens narzędzia w packages/: testing (tooling,
      includeInEnterprise:false). scripts/add-package.sh:104-114 dopisuje export
      * do enterprise: NIE uruchamiać."
    class: TASTE
    door_type: one-way
  - id: D3
    topic: 'Format konfiguracji ESLint'
    choice:
      'Tylko flat config; peer eslint ^9.39.0 || ^10.0.0; CI sprawdza obie
      wersje (D17); brak eksportu eslintrc.'
    means:
      'Projekty na starym formacie ładują pakiet tylko przez osobny przebieg
      ESLint na nowym formacie; reszta ich lintu zostaje bez zmian.'
    rationale:
      'roleScoped wymaga pluginów inline (VF-043-spike/proto/run.js:86),
      eslintrc ładuje wyłącznie pakiety. Skrót @vytches/ddd w eslintrc
      kolidowałby z nazwą meta-pakietu (agent api-surface). Poszerzenie zakresu
      peer jest addytywne, zawężenie łamie.'
    class: TASTE
    door_type: one-way
  - id: D4
    topic: 'Kształt eksportów i kontrakt'
    choice:
      'Wyłącznie nazwane eksporty: plugin (obiekt { meta, rules, configs }),
      rules, configs, meta, resolveRole @beta, roleScoped @beta,
      validateRoleConfig @beta, typy; lintText w podścieżce /agent. Brak
      eksportu domyślnego; configs.recommended odwołuje się do nazwanego
      eksportu plugin. Test kontraktowy przypina: klucze plugin.rules,
      configs.recommended.rules z severity, klucze settings i nazwy ról, mapę
      exports (z /agent) oraz snapshot .d.ts.'
    means:
      'Zasady biblioteki o publicznym API są zachowane, a zmiana nazwy roli czy
      klucza konfiguracji nie przejdzie niezauważona.'
    rationale:
      'Karta PA1/N1. Eksport domyślny byłby wyjątkiem od PA1 (Q5). Dodanie
      reguły do recommended albo podniesienie severity łamie konsumentów (minor
      w 0.x, major po 1.0). Uzupełnienie library-api-guardian: kontraktem są też
      settings, nazwy ról, flaga marker, kotwice See: i mapa exports; bez
      api-extractor (D14) potrzebny snapshot .d.ts.'
    class: TASTE
    door_type: one-way
  - id: D5
    topic: 'Zestaw reguł startowych (recommended)'
    choice:
      'recommended zawiera: (a) instanceof Result, (b) rozdzielone na dwie
      reguły: new EntityId rozwiązany po źródle importu (dwie klasy EntityId;
      error, ale wejście do recommended dopiero po poprawce
      contracts/LLMGUIDE.md:26, który sam używa new EntityId) oraz statyczne
      metody EntityId oznaczone @deprecated (warn, poza ścieżką agenta, bo ta
      pokazuje tylko błędy), (d) klasowy @EventHandler bez handle() (tylko forma
      klasowa bez extends), (f)+(g) scalone: importy wewnętrzne i deep subpath z
      denylistą i osobnym komunikatem dla /internal, uruchamiane na każdym
      pliku. Reguła (e) PolicyBuilder.build bez withId/withName(/withDomain)
      istnieje jako opt-in poza recommended (wyjątek defaultDomain). Awans
      dowolnej reguły opt-in do recommended wymaga precyzji ≥95% zmierzonej na
      naturalnych trafieniach zebranych z konsumentów z AC-DOGFOOD (≥60 trafień
      bez fałszywego); same mutacje i brak trafień nie wystarczają. Odpadają (c)
      i (h).'
    means:
      'Zestaw startowy zawiera tylko reguły z oparciem w dokumentacji i bez
      fałszywych alarmów na dokumentowanym użyciu, a reguła trafia do zestawu
      dopiero po pomiarze na prawdziwych naruszeniach.'
    rationale:
      "Q2: odpowiedź 'Zmieniamy podejście'. (c) dubluje błąd kompilatora, (h)
      nie ma źródła w dokumentacji, a dispatcher NestJS kieruje IntegrationEvent
      z agregatu na szynę globalną (context-aware-event-dispatcher.ts:55-75),
      więc reguła kolidowałaby z udokumentowaną ścieżką. (e) poza recommended,
      bo ścieżka agenta pokazuje tylko błędy (D13), a warn nie dociera do
      agenta; promocja do error wymaga pomiaru (reguła trzech: ≥60 trafień bez
      fałszywych dla 95%). (h) wraca po udokumentowaniu zakazu w
      aggregates/LLMGUIDE i docs/llm-context.md. Poprawka pliku zadania wykonana
      2026-11-05. Korekta po dogfoodingu 2026-11-05: na jednym konsumencie (e),
      (a), (d), (f+g) mają 0 trafień naturalnych, więc próg ≥60 jest
      nieosiągalny tam i precyzję wnioskuje się tylko z mutacji (3024/3024
      wykrytych, 0/2268 fałszywych alarmów); kryterium awansu liczy więc
      trafienia z konsumentów AC-DOGFOOD łącznie i nie uznaje mutacji za dowód.
      (b) rozdzielone, bo 125 trafień statyk @deprecated (20/20 prawdziwych) to
      deprecjacja, a new EntityId (1 trafienie, rehydratacja z bazy) to
      nadużycie; contracts/LLMGUIDE.md:26 używa new EntityId('abc-123','text'),
      więc reguła error łamałaby wymóg 7 do czasu poprawki dokumentacji."
    class: USER_CHALLENGE
    door_type: two-way
    premises:
      - {
          claim:
            '@EventHandler przyjmuje klasę zdarzenia, nie tekst (uzasadnia
            usunięcie (c); zadanie, linia 232, twierdzi odwrotnie)',
          evidence: 'packages/events/src/decorators/event-handler.decorator.ts:23-24',
          holds: true,
        }
      - {
          claim:
            'Dla reguły (h) nie ma źródła w dokumentacji biblioteki (uzasadnia
            usunięcie (h))',
          evidence:
            'grep po LLMGUIDE/README/docs/llm-context.md: brak (Explore,
            ddd-pattern-review, documentation-master)',
          holds: true,
        }
  - id: D6
    topic: 'Słownik ról'
    choice:
      'Czysty moduł danych w pluginie (src/roles/), bez importu eslint,
      wewnętrzny (nie jest publicznym eksportem; publicznie tylko resolveRole
      @beta). Rola jest wyznaczana bindingiem (para pakiet + nazwa eksportu);
      extends/implements i dekorator to źródła bindingu. Każda rola ma flagę
      marker: library | binding-required oraz pole kind: tactical | cqrs |
      integration. Test importuje prawdziwe pakiety jako devDependencies i
      sprawdza, że każda nazwa istnieje w eksportach.'
    means:
      'Zmiana nazwy klasy w bibliotece psuje test pakietu, a nie ukrywa się jako
      cicha utrata reguły u użytkownika.'
    rationale:
      'Karta PB8/N1 (kierunek zależności w dół: narzędzie → runtime tylko w
      testach). Fakty: extends dla Aggregate, Entity, ValueObject, DomainEvent,
      IntegrationEvent, Specification, Repository (IBaseRepository abstract
      class, repositories/src/base-repository.ts:30), Policy
      (BaseBusinessPolicy, base-business-policy.ts:15); dekoratory dla
      CommandHandler, QueryHandler, EventHandler, DomainService, ACLAdapter;
      Command i Query tylko przez binding projektu albo glob (ICommand {} pusty,
      command.interface.ts:2). Dwie klasy EntityId (contracts i value-objects).
      ddd-patterns-expert: binding jest stabilny długoterminowo, struktura i
      dekorator nie; pojęcia do przewidzenia później: Factory, Application
      Service, Read Model.'
    class: TASTE
    door_type: two-way
  - id: D7
    topic: 'Los tools/ddd-lint'
    choice:
      'Zostaje bez zmian w tym przebiegu; reguła ddd-005 trafia do presetu z
      denylistą (kopia); usunięcie ddd-005 z narzędzia po parytecie i nocie
      migracyjnej w Phase 2; ddd-001..003 nie wchodzą do publikowanego presetu.'
    means:
      'Dotychczasowe sprawdzenia w CI działają jak dotąd, a nowy pakiet nie
      narzuca konwencji, której biblioteka sama nie stosuje.'
    rationale:
      'ddd-002 flaguje dokumentowany wzorzec VO (no-throw-in-domain.ts,
      heurystyka /value-objects/ i /specifications/). CI: ci.yml:109-110 || true
      celowo (komentarz :105-108). Dwie implementacje tej samej reguły to dryf,
      więc kopia jest tymczasowa (library-quality-verifier).'
    class: TASTE
    door_type: two-way
  - id: D8
    topic: 'Stanowisko dokumentacji w sprawie fabryk obiektów wartości'
    choice:
      'Walidacja w validate(); konstruktor i create() mogą rzucić Error; wariant
      bez wyjątku to osobna metoda zwracająca Result (tryCreate, za precedensem
      EntityId.tryFromX). Poprawka LLMGUIDE (Money, EmailAddress, anty-wzorzec w
      :229-232) i docs/llm-context.md w osobnym zadaniu, przed README pluginu.'
    means:
      'Plugin nie rozstrzyga sporu, a dokumentacja przestanie sobie przeczyć.'
    rationale:
      'base-value-object.ts:87-89 rzuca; value-objects/LLMGUIDE.md ~231 mówi
      odwrotnie; przykłady Money.create/EmailAddress.create mają nieosiągalną
      walidację. Kanon DDD: niezmiennik VO egzekwowany przy konstrukcji
      (ddd-patterns-expert).'
    class: TASTE
    door_type: two-way
  - id: D9
    topic: 'Ścieżka testów dla agentów'
    choice:
      'Skrypt test:unit (vitest run na wskazanych plikach, pada przy zerze
      dopasowanych testów) w root package.json w jednostce scaffold;
      .claude/test-guard.json {allowUnit:true} z zakazem -u/--update i
      instrukcje agenta testowego ręcznie przed startem.'
    means:
      'Agenci mogą uruchamiać testy nowego pakietu bez wywoływania całego
      zestawu, a literówka w ścieżce nie daje fałszywej zieleni.'
    rationale:
      'Zweryfikowano: root package.json:44 test = nx run-many --all, test:unit i
      .claude/test-guard.json nie istnieją; vitest.config.mts:20 ma
      passWithNoTests (library-quality-verifier), więc skrypt musi to nadpisać.
      pnpm vitest run packages/<pkg>/tests/<plik> działa bez nx.'
    class: TASTE
    door_type: two-way
  - id: D10
    topic: 'Zakres roleScoped'
    choice:
      "roleScoped dostaje tryb scope: 'class' | 'file'. 'class' zostawia raporty
      tylko wewnątrz klas danej roli; 'file' uruchamia regułę bazową na całym
      pliku, gdy plik ma klasę danej roli (np. zakaz importu frameworka w
      plikach ról domenowych, reguła projektowa). Reguły importów biblioteki
      (f+g) NIE są opakowane w roleScoped i działają na każdym pliku, bo import
      może leżeć w pliku bez klasy z rolą. Reguła bazowa jest przekazywana przez
      konsumenta, bez importu eslint/use-at-your-own-risk."
    means:
      'Reguły o zakazanych importach łapią naruszenie w każdym pliku, także
      takim, w którym nie ma żadnej klasy z rolą, a nie milczą po cichu.'
    rationale:
      'AC-SCOPED wymaga no-restricted-imports. Filtr w prototypie odrzuca
      raporty poza zakresem klasy (VF-043-spike/proto/plugin.js:25,32), a import
      leży na górze pliku. builtinRules z eslint/use-at-your-own-risk jest API
      bez kontraktu (plugin.js:3-5). Dogfooding 2026-11-05: tylko ok. 19,5%
      plików konsumenta ma rolę, a import /internal wykrywany z filtrem roli
      dawał 27% wykrytych mutacji; bez filtra 252/252.'
    class: MECHANICAL
    door_type: two-way
    premises:
      - {
          claim: 'Filtr roleScoped odrzuca raporty spoza zakresu klasy',
          evidence: 'VF-043-spike/proto/plugin.js:25,32',
          holds: true,
        }
      - {
          claim:
            'Import wykrywany z filtrem roli łapie tylko część naruszeń (ok. 27%
            mutacji /internal), bez filtra wszystkie',
          evidence:
            "spike log 'dogfood on a copy of the primary consumer, 2026-11-05' w
            pliku zadania (kod i surowe wyniki w scratchpadzie zostały skasowane
            przez system, więc to jedyny zapis; AC-DOGFOOD ma je powtórzyć na
            zatwierdzonym kodzie)",
          holds: true,
        }
  - id: D11
    topic: 'Walidacja konfiguracji (AC-VALIDATE)'
    choice:
      "Dwa poziomy: (i) rozwiązywalność bindingów (plik/eksport istnieje) przy
      każdym uruchomieniu, tani i z cache; (ii) 'rola nie pasuje do niczego'
      jako validateRoleConfig({cwd}) uruchamiane w bramce/CI, nie w hooku
      jednego pliku. Walidacja dotyczy ról zadeklarowanych przez projekt, nie
      wbudowanego słownika."
    means:
      'Błędny wpis w konfiguracji psuje uruchomienie, a brak klasy danej roli w
      edytowanym pliku nie jest fałszywym alarmem.'
    rationale:
      'Spike: brak pliku bindingu powodował ciche 0 handlerów
      (role-resolver.js:186-190 sprawdza tylko istnienie pliku). W trybie
      per-file brak klasy roli jest stanem normalnym.'
    class: MECHANICAL
    door_type: two-way
  - id: D12
    topic: 'Resolver'
    choice:
      "Obsługa extends i implements jednym kodem, rekurencyjnie przez bindingi
      projektu; wstrzykiwany fs, cache treści per plik, DFS z odwiedzonymi,
      ostrzeżenie przy przekroczeniu głębokości 6; prefiltr tekstowy na słowo
      class; ścieżki ./x.js, export type, export * as, wszystkie cele paths i
      extends w tsconfig; czytnik JSONC świadomy napisów (zwykły usuwacz
      komentarzy psuje wpisy typu '@scope/*') i odporny na BOM; sprawdzanie
      zasięgu (parametr, klasa lub stała lokalna o tej samej nazwie nie jest
      symbolem biblioteki); rozwijanie as, !, satisfies, aliasów const A =
      Import i przestrzeni nazw (ns.X, export * as); parsowanie odporne na
      shebang i CRLF; cache negatywny nie przeżywa wywołania lintText; bez
      --cache ESLint. Typowany tier poza hookami. Nieobsługiwane, do opisania w
      README: destrukturyzacja (const { createText } = EntityId), dynamiczne
      aliasy, łańcuch PolicyBuilder rozbity na zmienne (reguła milczy, bez
      fałszywego alarmu)."
    means:
      'Rozpoznawanie ról działa także dla fasad i klas bazowych projektu, a plik
      utworzony przed chwilą przez agenta nie zostaje nierozpoznany.'
    rationale:
      'Panel (performance-risk, tech-analysis): cache zapamiętuje chybienia
      (role-resolver.js:69,84), regex nie widzi export type / export * as
      (:102), z paths tylko pierwszy cel (:32), brak inwalidacji, cichy cap
      głębokości (:90). BaseCommandHandler z samym implements jest niewidoczny
      dla extends-only.'
    class: MECHANICAL
    door_type: two-way
  - id: D13
    topic: 'API dla hooków projektu'
    choice:
      "Podścieżka /agent: createAgentLinter({config, rulePrefixes,
      minSeverity:'error'}).lintText(text, filePath) zwraca ok{findings} |
      skipped | parse-error | config-error; newFindings(before, after).
      Biblioteka nie czyta danych od Claude, nie decyduje o deny/block. Lane
      agenta: reportUnusedDisableDirectives off, analizowane tylko wyniki z
      prefiksem ddd/ (dogfooding: 318 komunikatów bez ruleId na 9217 plikach, 0
      błędów parsowania po filtrze)."
    means:
      'Projekt sam wybiera, czy błąd blokuje zapis, czy tylko informuje agenta.'
    rationale:
      'Spike (a): blokujący PreToolUse deny 4/4, PostToolUse block 5/7, advisory
      0/12 na Haiku; wymóg errors-only. Ryzyko: noInlineConfig:true z zadania
      wyłącza wyjątki z uzasadnieniem (reguła 3), więc zablokowany agent nie ma
      wyjścia (decyzja projektu, README opisuje).'
    class: MECHANICAL
    door_type: two-way
  - id: D14
    topic: 'Zależności i powierzchnia API'
    choice:
      'dependencies: {}; peer eslint (^9.39.0 || ^10.0.0); opcjonalny peer
      @typescript-eslint/parser ^8; bez @typescript-eslint/utils, bez typescript
      (własny czytnik tsconfig z JSONC i extends); @types/estree jawnie w
      devDependencies; symbole beta oznaczone samym @beta + @since (suchy
      przebieg api-extractor potwierdza brak ostrzeżeń); api-extractor dla
      pakietu odroczone do wyjścia z beta (test kontraktowy i snapshot .d.ts w
      zamian, D4); pakiet startuje z wersją z lerna.json, dalej bumpuje tylko
      Lerna.'
    means:
      'Pakiet nie wciąga zależności do projektów użytkowników i ma ten sam numer
      wersji co reszta biblioteki.'
    rationale:
      'peerDependencies są precedensem w repo (reflect-metadata w
      cqrs/package.json:72 i events/package.json:76; zweryfikowane), karta BP6.
      @types/estree nie jest zadeklarowane nigdzie w repo (tylko tranzytywnie
      przez eslint). 126 @public, 4 @experimental, 0 @beta w src;
      ae-missing-release-tag wyłączone (api-extractor.base.json:49).'
    class: MECHANICAL
    door_type: two-way
  - id: D15
    topic: 'Wydania i dwa narzędzia wersjonowania'
    choice:
      "Zostaje obecny mechanizm (Lerna bumpuje wersje; Changesets służy do not).
      Przebieg dopisuje plik zmiany (changeset) i nazwę pakietu do 'fixed'. Do
      podpisu Phase 2 pakiet ma w package.json private: true, więc nie trafia do
      npm; zdjęcie private to osobny, świadomy krok po dogfoodingu i po
      sprawdzeniu, że CI ma publint i attw przed publikacją (BP8)."
    means:
      'Wydanie nowego pakietu nie wymaga ręcznej zmiany numeru wersji, a
      niesprawdzony pakiet nie trafia do publicznego rejestru.'
    rationale:
      'Pamięć projektu: Lerna zarządza wersjami (nie edytować version ręcznie).
      Karta BP7/N5 chce JEDNEGO narzędzia: repo ma oba (.changeset/ z 11 plikami
      oraz lerna version w skrypcie release), czyli istniejące odstępstwo od
      karty, nierozwiązywane tym zadaniem. npm LIVE od 2026-05-23, pierwsza
      publikacja jest nieodwracalna (library-quality-verifier).'
    class: MECHANICAL
    door_type: two-way
  - id: D16
    topic: 'Bramki repo, które mogą nie widzieć nowego pakietu'
    choice:
      'Zanim cokolwiek polega na test:contracts i deps:circular, jednostka
      scaffold sprawdza je zasianym przypadkiem (nowy pakiet z testem
      kontraktowym w tests/api-surface.test.ts; zasiany cykl w plikach .ts).
      Jeśli bramka jest ślepa (glob nie sięga, madge bez rozszerzenia .ts,
      passWithNoTests), naprawiamy skrypt u źródła, a nie układamy plików pod
      bramkę. Plik kontraktowy leży w tests/api-surface.test.ts, jak w
      pozostałych pakietach.'
    means: 'Zielone bramki oznaczają, że coś naprawdę sprawdziły.'
    rationale:
      'package.json:50 test:contracts = vitest packages/**/api-surface.test.ts
      --passWithNoTests (bez run, hipoteza o rozwijaniu ** do jednego poziomu
      nieuruchomiona); package.json:101 deps:circular = madge bez --extensions
      ts (hipoteza). Ostrzeżenie runtime.yml:48-56 o skryptach, które zawsze
      zwracają exit 0. Zmiana skryptów dotyka wszystkich pakietów, więc przebieg
      najpierw dowodzi ślepoty zasianym przypadkiem.'
    class: MECHANICAL
    door_type: two-way
  - id: D17
    topic: 'Macierz ESLint 9 i 10 w CI'
    choice:
      'Do ci.yml dochodzi job testujący pakiet na ESLint 9.39 i 10 (oraz pomiar
      zimnego procesu w osobnym targecie perf, poza bramką test).'
    means:
      'Zakres wspieranych wersji ESLint jest sprawdzany, a nie tylko
      zadeklarowany.'
    rationale:
      "ci.yml ma dziś macierz tylko po wersjach Node (linia 47); bez joba zakres
      '^9.39 || ^10' w peerze jest niezweryfikowaną obietnicą
      (library-quality-verifier). Pomiar czasu w bramce test byłby niestabilny
      przy równoległym pre-commit."
    class: MECHANICAL
    door_type: two-way
  - id: D18
    topic: 'Zakres reguły PA4 (strażniki is*) w pakiecie eslint-plugin-ddd'
    choice:
      'PA4 obejmuje wyłącznie unie WEJŚCIOWE (wartości, które konsument
      przekazuje do API pakietu). Unie wyjściowe i dyskryminowane polem
      (AgentLintResult, AgentSeverity), unie literałów nazw (RuleName,
      LibraryRoleName, BindingProblemCode, RoleScope) i otwarte unie (RoleName)
      nie wymagają strażników is*. Strażniki już dodane w src/agent/guards.ts
      zostają. Brak strażnika dla tych unii NIE jest naruszeniem ani
      unverified_scope.'
    means:
      'Weryfikator przestaje zgłaszać brakujące is* dla typów wyjściowych;
      warstwy GO nie są ruszane.'
    rationale:
      'Decyzja właściciela z 2026-11-06 po haltcie warstwy
      implementation:entry-agent (3 próby, kolejne unie zgłaszane z dryfem;
      karta PA4 nie rozstrzyga zakresu, a naprawa wymagałaby zmian w
      zatwierdzonych warstwach roles/resolver/rules/scoped).'
    class: USER_CHALLENGE
    door_type: two-way
  - id: D19
    topic: 'Położenie specyfikacji jednostkowych pakietu eslint-plugin-ddd'
    choice:
      'Wszystkie testy leżą w packages/eslint-plugin-ddd/tests/ (konwencja
      pozostałych pakietów). Pięć plików
      src/agent/{create-agent-linter,findings,guards}.spec.ts,
      src/configs/plugin.spec.ts i src/scoped/role-scoped.spec.ts przenosimy do
      tests/unit/{agent,configs,scoped}/*.test.ts (importy względne poprawione
      na ../../../src/...), a pliki w src/ usuwamy. Przeniesione testy muszą
      przechodzić i obejmować ścieżki parse-error, config-error i skipped dla
      createAgentLinter oraz newFindings.'
    means:
      'Bramka test i CI uruchamiają zachowanie agent-lane, strażników,
      roleScoped i presetu.'
    rationale:
      'Bramka końcowa 2026-11-06: include w vite.config.mts to
      tests/**/*.test.ts, a target test filtruje do tests/, więc 5 specyfikacji
      w src/ nie biegnie nigdzie (ślepa bramka, D16). Pozostałe pakiety nie
      trzymają specyfikacji w src/.'
    class: MECHANICAL
    door_type: two-way

patterns:
  - cross-layer/conventions-pattern.md
  - typescript-library/public-api-pattern.md
  - typescript-library/package-boundary-pattern.md
  - typescript-library/backward-compatibility-pattern.md
  - typescript-library/build-publish-pattern.md
  - typescript-library/library-testing-pattern.md

patterns_exclude: []

final_checks: []

units:
  - {
      id: scaffold,
      layer: implementation,
      dirs:
        [
          'packages/eslint-plugin-ddd/package.json',
          'packages/eslint-plugin-ddd/project.json',
          'packages/eslint-plugin-ddd/tsconfig.json',
          'packages/eslint-plugin-ddd/vite.config.mts',
          'packages/eslint-plugin-ddd/LICENSE',
          'tsconfig.base.json',
          'vitest.config.mts',
          'config/packages.json',
          '.eslintrc.json',
          'package.json',
          'pnpm-lock.yaml',
          'scripts/sync-packages.js',
          'scripts/architecture-monitor.js',
          'scripts/build-distribution.js',
          'scripts/smoke-test-publish.sh',
        ],
      reason:
        'D2, D9, D14, D15, D16: szablon packages/repositories; rejestracje
        ręczne (paths, alias vitest także dla /agent, scope tag w
        depConstraints, includeInEnterprise:false, ignorePatterns dla
        tests/fixtures, skrypt test:unit pada przy zerze testów, target perf,
        devDependency @types/estree, private: true); skrypty rejestrujące
        pakiety edytować tylko, gdy sprawdzenie wykaże listę na sztywno; naprawa
        ślepych bramek test:contracts i deps:circular wg D16. NIE uruchamiać
        scripts/add-package.sh.',
    }
  - {
      id: ci-matrix,
      layer: implementation,
      dirs: ['.github/workflows/ci.yml'],
      reason:
        'D17: job na ESLint 9.39 i 10 oraz target perf; bez zmian w istniejącym
        kroku ddd:lint || true.',
    }
  - {
      id: roles-resolver,
      layer: implementation,
      dirs:
        [
          'packages/eslint-plugin-ddd/src/roles/',
          'packages/eslint-plugin-ddd/src/resolver/',
        ],
      reason:
        'D6, D12: słownik ról (binding, marker, kind), resolver
        extends/implements, cache, tsconfig paths.',
    }
  - {
      id: scoped,
      layer: implementation,
      dirs: ['packages/eslint-plugin-ddd/src/scoped/'],
      reason:
        'D10: roleScoped z trybem class|file, reguła bazowa od konsumenta.',
    }
  - {
      id: config-validate,
      layer: implementation,
      dirs: ['packages/eslint-plugin-ddd/src/config/'],
      reason:
        'D11: schemat settings, walidacja bindingów (tani) i validateRoleConfig.',
    }
  - {
      id: rules,
      layer: implementation,
      dirs:
        [
          'packages/eslint-plugin-ddd/src/rules/',
          'packages/eslint-plugin-ddd/src/messages/',
          'packages/eslint-plugin-ddd/docs/rules/',
        ],
      reason:
        "D5 + AC-MESSAGES: reguły role-native i preset (a, b, d, f+g; (e)
        opt-in), komunikaty 'co jest nie tak. Dlaczego. Fix:. See:' i kotwice
        docs w jednym miejscu, bo zmieniają się razem.",
    }
  - {
      id: entry-agent,
      layer: implementation,
      dirs:
        [
          'packages/eslint-plugin-ddd/src/index.ts',
          'packages/eslint-plugin-ddd/src/configs/',
          'packages/eslint-plugin-ddd/src/agent/',
          'packages/eslint-plugin-ddd/README.md',
          'packages/eslint-plugin-ddd/LLMGUIDE.md',
        ],
      reason:
        'D4, D13: nazwane eksporty z plugin, configs.recommended i agent-lane,
        lintText w /agent, README (fragment importu wykonywany w teście, sekcja
        wymagań ESLint 9/10) i LLMGUIDE (tabela ról generowana z modułu danych).
        Jedyny właściciel src/index.ts.',
    }
  - {
      id: tests-unit,
      layer: testing,
      dirs:
        [
          'packages/eslint-plugin-ddd/tests/unit/',
          'packages/eslint-plugin-ddd/tests/types/',
        ],
      reason:
        'RuleTester dla każdej reguły; testy resolvera, roleScoped
        (no-restricted-imports, no-restricted-syntax, naming-convention),
        walidacji; deterministyczny licznik odczytów resolvera; asercje typów
        expectTypeOf (LT3); testy property-based dla parsera tsconfig i
        mapowania paths, jeśli fast-check jest już w repo (LT4).',
    }
  - {
      id: tests-contract,
      layer: testing,
      dirs:
        [
          'packages/eslint-plugin-ddd/tests/api-surface.test.ts',
          'packages/eslint-plugin-ddd/tests/contract/',
          'packages/eslint-plugin-ddd/tests/fixtures/',
          'packages/eslint-plugin-ddd/tests/perf/',
        ],
      reason:
        'D4, D16, D17, LT1/LT2: api-surface.test.ts (klucze reguł + severity,
        settings, role, exports, snapshot .d.ts), nazwy ze słownika vs eksporty
        prawdziwych pakietów, fixture ze znanym naruszeniem przez prawdziwe CLI
        (zero trafień = porażka), zestaw mutacyjny w repo (dla każdej reguły:
        wstrzyknięte naruszenia w wariantach import bezpośredni, alias,
        namespace, fasada, const-alias, rzutowanie oraz warianty poprawne, które
        nie mogą dać trafienia; wymagane 100% wykrytych i 0 fałszywych alarmów,
        plus test pomocniczy z celowo uszkodzonym resolverem, który musi pasować
        do tego zestawu na czerwono), pomiar zimnego procesu w pliku *.perf.ts
        poza globem test. LT6/LT7 przez istniejący scripts/smoke-test-publish.sh
        po sprawdzeniu, że radzi sobie z peerem eslint i brakiem zależności
        ddd-*, bez duplikowania testu z tarballa.',
    }

layers_skip: []

layers_scope:
  - {
      id: api-surface,
      dirs: ['.changeset/'],
      reason:
        'D14, D15: tylko plik zmiany (changeset) i wpis nazwy pakietu w
        .changeset/config.json; api-extractor odroczony na czas beta, więc
        raportu api-report nie ruszać.',
    }

minor_fixes: []
---

# Analiza VF-043: wtyczka ESLint z modelem ról DDD

## Synteza

Zadanie jest w pół drogi. Dwa ryzykowne pytania Phase 0 mają odpowiedź: kanał
informacji dla subagenta działa, a mechanizm zawężania reguł do ról jest szybki
i precyzyjny. Brakuje trzech sprawdzeń (typowane dekoratory, konfiguracja ESLint
9, pomiar "przed"), pomiaru zimnego procesu od startu do wyniku i podpisu
właściciela (Q10). W repo nie ma jeszcze ani linii pakietu, a kod prototypu leży
w katalogu referencyjnym.

Panel potwierdził kierunek, ale znalazł pięć rzeczy, które zmieniają plan Phase
1:

1. `roleScoped` w obecnej postaci nie zadziała dla reguły o importach, bo
   importy leżą poza klasą, a prototyp odrzuca zgłoszenia spoza klasy. AC-SCOPED
   wymaga właśnie tej reguły, więc potrzebny jest tryb "plik" (D10).
2. Obietnica słownika ról jest zbyt szeroka. Pięć ról rozpoznaje się po
   dziedziczeniu, pięć po dekoratorze, a Command i Query tylko przez
   konfigurację projektu, bo interfejs komendy jest pusty. Repozytorium i
   polityka mają abstrakcyjne klasy bazowe, ale polityki zbudowane przez builder
   nie są klasami (D6).
3. Z ośmiu reguł startowych jedna dubluje błąd kompilatora, a jedna nie ma
   źródła w dokumentacji. Reguła o buildzerze polityk zostaje opt-in do czasu
   pomiaru precyzji (D5).
4. Pomiar 240 ms nie obejmuje dowodu od startu procesu do wyniku, a hook
   konsumenta uruchamia zimny proces przy każdym zapisie. Budżet trzeba zmierzyć
   przed podpisem i pilnować testem w CI (D12, D17, Q10).
5. Praca agentów jest dziś zablokowana: nie ma skryptu uruchamiającego testy dla
   wskazanych plików ani zgody w strażniku testów (D9).

Konsultacja pięciu doradców (library-api-guardian, library-quality-verifier,
library-expert, documentation-master, ddd-patterns-expert) potwierdziła
wszystkie rekomendacje, z jednym sporem o nazwę (Q3, 4 do 1). Dodała dziesięć
uzupełnień, które weszły do decyzji D4, D5, D6, D9, D15, D16 i D17 oraz do
jednostek. Zasada przyjęta przez właściciela: bez obejść. Dlatego bramki repo,
które mogą nie widzieć nowego pakietu, są najpierw dowodzone zasianym
przypadkiem i naprawiane u źródła (D16), a pierwsza publikacja czeka na
dogfooding (D15).

Pierwszy przebieg implementacji obejmuje tylko Phase 1. Dowód na dwóch
projektach konsumentów, przewodnik i nota migracyjna idą do Phase 2.

Po zatwierdzeniu analizy zrobiono jednorazowy dogfooding na tymczasowej kopii
konsumenta (kod poza repo, szczegóły w spike logu w pliku zadania). Reguły
wykryły 3024 z 3024 celowo wprowadzonych naruszeń i dały 0 fałszywych alarmów na
2268 poprawnych wariantach; role rozpoznano zgodnie z niezależnym skanerem
tekstowym dla 5555 klas. Dogfooding poprawił cztery rzeczy w planie: reguły
importów muszą działać na każdym pliku (D10), reguła (b) dzieli się na błąd i
ostrzeżenie, a jej wejście do recommended czeka na poprawkę dokumentacji (D5),
awans reguł liczy trafienia naturalne z konsumentów, nie mutacje (D5), a reguły
konwencji trafiające w świadomy idiom konsumenta wymagają ratchetu, nie błędu
(Ryzyka). Pomiar zimnego procesu wyszedł blisko budżetu: mediana 245–292 ms, p95
275–314 ms przy celu poniżej 300 ms.

## Ryzyka / uwagi

- Najważniejsze ryzyko adopcji: blokada zapisu na plikach z dawnymi
  naruszeniami. Spike sprawdzał tylko nowy plik, a w projektach konsumentów
  rzucanie wyjątków w obsłudze poleceń jest powszechne (46 handlerów). Bez
  ratchetu (nowe naruszenia, nie stare) agent wpada w pętlę odmów. Dogfooding to
  potwierdził liczbami: `throw` w obsłudze poleceń ma 55 trafień w 36 plikach i
  jest świadomym idiomem wycofania transakcji, więc taka reguła konwencji
  dostaje zamrożoną bazę (55) i błąd tylko dla nowych trafień. Specification bez
  `@BusinessRule` ma 28 trafień w 18 plikach (część to pomocnicze klasy
  nieeksportowane).
- Ustawienie `noInlineConfig: true` w ścieżce agenta wyłącza wyjątki z
  uzasadnieniem, więc zablokowany agent nie ma wyjścia. To decyzja projektu
  konsumenta, ale README ma to opisać.
- Długoterminowo największe ryzyka: kontrakt `recommended` po 1.0 (każda nowa
  reguła łamie konsumentów), dryf słownika ról względem eksportów 19 pakietów
  (łapie go test na prawdziwych pakietach) i rozrost zakresu w stronę frameworka
  lintowego (`/agent` zostaje czystymi danymi, bez adapterów i zależności
  runtime).
- Cykl wersjonowania: repo ma dwa narzędzia (Lerna i Changesets) wbrew karcie
  BP7. Nie wiadomo z kodu, które publikuje; plan dopisuje plik zmiany i nazwę do
  wspólnej grupy, żeby oba były spójne.
- Hipotezy doradców, których nikt nie uruchomił: ślepota `test:contracts` na
  głębszych ścieżkach i `deps:circular` na plikach `.ts` (D16 każe to udowodnić
  przed poleganiem).
- Plugin ładuje konfigurację projektu (kod JS), jak każdy plugin ESLint.
  Zagrożenia nie wymagają osobnego modelu zagrożeń.
- Twierdzenie o końcu wsparcia ESLint 9 (od 2026-08-06) pochodzi z wyszukiwania
  agenta; potwierdzone jest tylko to, że `latest` to 10.14.0, a 9.39.5 jest w
  tagu maintenance.

## Uwagi

- **Status `approved`, ale Q10 ma `answer: null`**, więc `/orchestrate` odmówi
  startu do czasu podpisu etapu zero. To zamierzone: zatwierdzono kształt
  rozwiązania, nie dowód z etapu zero.
- Kroki ręczne PRZED startem `/orchestrate`: `.claude/test-guard.json` z
  `{"allowUnit": true}` (i zakazem `-u`/`--update`) oraz dopisek w instrukcjach
  agenta testowego (Q9).
- Poprawka do pliku zadania (poza listą zapisów analizy): sekcja "Gaps the type
  system leaves open" zawiera twierdzenie "`@EventHandler` accepts a string",
  które jest nieprawdziwe (event-handler.decorator.ts:23-24); wynik (c) w
  follow-upie "overload plus deprecation" jest bezprzedmiotowy. **Wykonane
  2026-11-05** w pliku zadania (twierdzenie przekreślone, usunięte z reguły
  startowej, z warstwy typów i z follow-upów).
- Osobne zadania dokumentacyjne (poza VF-043): poprawić
  `tools/ddd-lint/CONSUMER-USAGE.md` (4 reguły, dopisać ddd-005); ujednolicić
  `Money`, `EmailAddress` i anty-wzorzec w `value-objects/LLMGUIDE.md` oraz
  `docs/llm-context.md` do wariantu z osobną metodą zwracającą wynik, przed
  README pluginu; sprawdzić twierdzenie o walidacji w konstruktorze `EntityId`
  (`value-objects/LLMGUIDE.md:242-245`, `docs/llm-context.md:630-631`), bo na
  nim stoi reguła (b); rozstrzygnąć, czy zakaz `apply()` ze zdarzeniem
  integracyjnym trafia do `aggregates/LLMGUIDE.md`.
- **Stan Q10 na 2026-11-05.** Właściciel zatwierdził start świadomie, mimo że
  warunki z `q` nie są spełnione: brakuje spike logów (c) i (e), części (d) na
  ESLint 10 oraz pomiaru zimnego procesu na prawdziwym pakiecie (prototyp:
  mediana 245–292 ms, p95 275–314 ms, N=30). Zapis w `answer` mówi o tym wprost
  jako o wyjątku od Q1. Skutek: bramka maszynowa nie pilnuje już tych punktów,
  więc implementer musi je wykonać na początku Phase 1 i dopisać spike logi do
  pliku zadania, zanim napisze pierwszą regułę; jeśli pomiar zimnego startu
  przekroczy 300 ms na prawdziwym pakiecie, zatrzymuje się i wraca do
  właściciela. Plik zadania ma instrukcję startu w nowym kontekście.
- Dodatkowa poprawka dokumentacji przed regułą (b) w recommended:
  `contracts/LLMGUIDE.md:26` używa `new EntityId('abc-123','text')`, wbrew
  `value-objects/LLMGUIDE.md`. Do osobnego zadania dokumentacyjnego razem z
  weryfikacją twierdzeń o walidacji w konstruktorze `EntityId`.
- Poprawka do briefu Explore: Repozytorium ma klasę bazową `IBaseRepository`
  (abstract class, base-repository.ts:30), nie tylko interfejs.
- Zgłoszenie do skrzynki claude-patterns: `library-api-guardian` i
  `library-quality-verifier` leżą w agents/stacks/typescript-library/, ale nie
  są podlinkowane do ~/.claude/agents/ ani widoczne dla narzędzia Agent
  (ANZ-AGENT-MISSING, zgłoszone). Role uruchomiono przez general-purpose z
  definicją.
- Synteza wykonana przez głównego agenta (slot syntezy nie istnieje w
  analyze.panel tego projektu).
- Telemetria: run-start i run-end OK (analyze-20261104-202303-9487).
