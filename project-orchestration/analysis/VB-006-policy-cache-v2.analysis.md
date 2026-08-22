---
task: VB-006
status: approved # zatwierdzone przez użytkownika 2026-08-20 — propozycje odpowiedzi Q1-Q3 i decyzje D1-D9 zaakceptowane bez zmian

# Checkpoint /orchestrate (przebieg wf_4d6714da-57d, 2026-08-20T13:51Z).
# Warstwy z werdyktem GO — przy wznowieniu POMIN je, zrob tylko sanity check obecnosci plikow.
layers_done: [implementation, testing] # api-surface: POMINIETA (create_when nietrafiony);
# bramka koncowa: NO-GO (3 naruszenia, 1 BLOCKER) — patrz raport przebiegu

threat_model: null # brak stage'a threat-model w panelu tego projektu (jak w VP-012)

parent_task: project-orchestration/tasks/VB-006-policy-cache-v2.md
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml

panel: # runtime.yml analyze.panel, przebieg 2026-08-20
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 5,
    }
  - {
      stage: tech-analysis-specialist,
      agent: 'backend-technology-expert',
      model: sonnet,
      when: brak,
      wynik: ok,
      tool_uses: 1,
    }
  - {
      stage: api-surface-analysis,
      agent: 'library-api-guardian',
      model: sonnet,
      when:
        'trafienie "publiczn"/"sygnatur" ← treść taska o publicznym API i
        zmianie sygnatury',
      wynik: ok,
      tool_uses: 8,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'brak trafienia when: (nowy pakiet|granic|boundary|tag
        |scope:|cykl|circular|przenieś|wydziel|extract) — zmiana jest wyłącznie
        wewnątrz-plikowa w @vytches/ddd-policies, nie przekracza żadnej granicy
        Nx',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga:
        'frontmatter agenta mówi haiku; nadpisane zgodnie z polityką /analyze',
    }
  # pominięte kroki silnika: 0a (brak stage'a threat-model), 0.7 (brak bloku ddd/core),
  # 0.8 (brak stage'a decision-gate), 0.9 (task type: bug — governance i tak nieaktywny w tym projekcie)

rag:
  skipped (brak MCP retrieve_code/retrieve_patterns w tej sesji; grounding ze
  statycznej listy patterns.always + celowana weryfikacja grepem/Read każdego
  nazwanego symbolu w kodzie, przed panelem i po nim)

# Fakty ustalone empirycznie (grep/Read bezpośrednio w kodzie) — wiążące dla implementera.
codebase_facts:
  F1:
    'Klasa PolicyCache (packages/policies/src/decorators/cached-policy.ts:84)
    NIE jest eksportowana z żadnego barrela — potwierdzone grepem na
    packages/policies/src/decorators/index.ts i packages/policies/src/index.ts.
    Jest wyłącznie wewnętrzna. Cała jej mechanika (set/get/addNode/removeNode)
    jest wolna do zmiany bez ryzyka API.'
  F2:
    'PolicyCachingBehavior, PolicyCachingBehaviorFactory (konkretne klasy) oraz
    type PolicyCacheConfig SĄ eksportowane z packages/policies/src/index.ts
    (przez decorators/index.ts:11-15). Jedyna powierzchnia publiczna dotknięta
    przez ten task to ZACHOWANIE tych fabryk, nie ich sygnatury.'
  F3:
    'PolicyCachingBehaviorFactory.forExpensivePolicy() (cached-policy.ts:~508):
    `cacheFailures: options.cacheFailures || true` — jawne `false` od konsumenta
    jest bezwarunkowo nadpisywane na `true`. Potwierdzone, to jest fix `??`.'
  F4:
    'Ten sam plik, linia ~501: `maxSize: options.maxSize || 500` — ten sam
    wzorzec `||`. Dziś nieszkodliwe (maxSize=0 nie ma sensu w tym kontrakcie),
    ale ta sama klasa błędu w tej samej funkcji.'
  F5:
    'PolicyCachingBehavior.withDefaults() ustawia maxSize:1000,
    cacheFailures:false — bezpieczna fabryka, wzorcowa.'
  F6:
    'PolicyCachingBehaviorFactory.withTTL() i .withCustomKey() NIE ustawiają
    maxSize w ogóle → cache.set(..., undefined) → `if (maxSize && ...)` zawsze
    false → nieograniczony wzrost. To jest realny defekt B1.'
  F7:
    'TTL jest egzekwowany WYŁĄCZNIE leniwie, przy odczycie (get(), linia
    116-123). Klucz nigdy ponownie nie odczytany nigdy nie wygasa czasowo. Limit
    rozmiaru (maxSize/LRU) jest JEDYNYM realnym backstopem pamięciowym w tej
    klasie — to przesądza, że maxSize to nie kosmetyka.'
  F8:
    'addNode() (linie 189-198) jest bezwarunkowo append-only: nadpisuje wpis w
    mapie lruNodes, ale NIE odłącza starego węzła z fizycznej listy
    dwukierunkowej. Jeśli re-setowany klucz był akurat lruHead, lruHead zostaje
    trwale wskazany na węzeł-widmo. Kolejna ewikcja rozmiarowa czyta lruHead.key
    (poprawny string), ale removeNode() rozwiązuje go przez lruNodes.get(key) —
    co zwraca ŻYWY, świeżo zapisany węzeł. Efekt: ewikcja kasuje niewłaściwy
    (świeży) wpis zamiast faktycznie najstarszego. To złamanie semantyki LRU,
    nie tylko wyciek pamięci.'
  F9:
    'set() (linia ~158) robi metrics.entries++ bezwarunkowo, niezależnie od tego
    czy klucz jest nowy czy już istniał. Dziś przypadkiem się zeruje (jedyny
    call-site set() zawsze idzie po miss/expire, który już zdekrementował
    entries w get()). Po naprawie B3 re-set na żywym kluczu stanie się osiągalny
    — licznik zacznie driftować w górę względem realnego cache.size. Odkryte
    NIEZALEŻNIE przez dwóch recenzentów panelu.'
  F10:
    'Brak jakiegokolwiek dispose()/lifecycle hooka na PolicyCachingBehavior.
    Biblioteka jest deklaratywnie bez frameworka (CLAUDE.md: "No
    framework-specific code in core packages"). Sweeper (setInterval) nie miałby
    właściciela cyklu życia — nic nigdy nie wywołałoby clearInterval.'
  F11_poboczne:
    'Eksport konkretnych klas PolicyCachingBehavior/PolicyCachingBehaviorFactory
    (zamiast interfejs + funkcja fabryczna) narusza public-api-pattern (PA5/N2).
    Ten sam wzorzec powtarza się SYSTEMOWO dla PolicyRetryBehavior/Factory i
    PolicyTemporalBehavior/Builder/Factory w tym samym module behaviors — to nie
    jest odosobniony przypadek w cached-policy.ts. Pre-existing, sprzed tego
    taska. Poza zakresem VB-006 (patrz decyzja D9/Q3).'
  F12_poboczne:
    'Brak deduplikacji równoległych wywołań check() dla tego samego klucza
    (cache stampede) — dwa jednoczesne miss trafiają w wewnętrzną politykę
    niezależnie i oba zapisują do cache. Najboleśniejsze akurat dla
    forExpensivePolicy() (tam gdzie miało to najbardziej chronić przed
    powtarzalnym kosztem). Poza zakresem VB-006 (patrz decyzja D9/Q3).'

open_questions:
  - id: Q1
    blocking: false
    ask: >-
      Gdy pamięć podręczna nie ma ustawionego limitu, ile wpisów ma pomieścić,
      zanim zacznie usuwać najstarsze? Jedna propozycja mówi 1000; pokrewny, już
      istniejący mechanizm w tym samym pliku używa dziś 500. Czy oba mają używać
      tej samej liczby?
    q: >-
      Wartość DEFAULT_MAX_SIZE nierozstrzygnięta: backend-technology-expert
      proponuje 1000 jako domyślną wartość parametru w wewnętrznym
      PolicyCache.set(), podczas gdy forExpensivePolicy() ma dziś na sztywno
      500. Opcje: (a) jedna wspólna stała 1000, forExpensivePolicy() wyrównane
      do niej; (b) 1000 jako ogólny fallback, 500 zostaje dla wariantu
      "expensive" celowo (jego zcache'owane wartości są prawdopodobnie
      większe/droższe per wpis); (c) inna wartość. Rekomendacja syntezy: (b) —
      zostawić 500 tam gdzie jest zamierzone, wprowadzić 1000 jako ogólny
      fallback, nazwać obie stałe tak, żeby rozbieżność była świadoma, nie
      przypadkowa. Niebiorące: implementacja może ruszyć z (b) i stałą
      doprecyzowaną przed mergem.
    answer: >-
      PROPOZYCJA — TAK, wariant (b). DEFAULT_MAX_SIZE = 1000 jako ogólny
      fallback (nowa stała, użyta w withTTL()/withCustomKey() i jako wartość
      domyślna parametru w PolicyCache.set()); forExpensivePolicy() zachowuje
      500, ale jako nazwaną stałą (np. DEFAULT_EXPENSIVE_MAX_SIZE), z
      komentarzem że jest niższa CELOWO (droższe/większe wpisy per klucz w tym
      wariancie). Uzasadnienie: żadna dana z panelu nie wskazuje, że 500 było
      przypadkowe czy błędne — to jedyny defekt (`||` zamiast `??`) był błędem,
      nie sama wartość. Czeka na potwierdzenie człowieka.
  - id: Q2
    blocking: false
    ask: >-
      Nadchodząca zmiana wpływa na zachowanie tych pamięci podręcznych (dostają
      limit rozmiaru), bez zmiany żadnej sygnatury funkcji. Czy to ma iść jako
      zwykła poprawka z notatką, czy potrzebuje wyższej rangi w numeracji
      wersji?
    q: >-
      Klasyfikacja wydania dla behawioralnego capu z D8. Zero zmian
      eksportowanych typów/sygnatur (potwierdzone przez api-surface-analysis) —
      semver-po-sygnaturze mówi patch; semver-po-obserwowalnym-zachowaniu
      przemawia za minor. Decyzja właściciela wydania, bo wersje w tym repo idą
      przez Lerna, nie ręczną edycję package.json (patrz pamięć projektu o
      wersjonowaniu). Nie blokuje implementacji ani review — tylko treść release
      note i typ wpisu w changesecie.
    answer: >-
      PROPOZYCJA — patch/fix z obowiązkową notatką behawioralną w CHANGELOG.md
      [Unreleased] (dokładnie jak w D8), NIE podnosić do minor. Uzasadnienie:
      brak zmiany eksportowanego typu/sygnatury (potwierdzone przez
      api-surface-analysis), a nieograniczony wzrost pamięci nigdy nie był
      udokumentowanym kontraktem — to domykanie backstopu, który powinien był
      tam być od początku, nie odbieranie obiecanej funkcjonalności. Analogia do
      precedensu w tym samym repo: VP-012b (zmiana referencji zwracanej przez
      getDomainEvents()) też poszła jako fix + notatka w changelogu, nie minor.
      Czeka na potwierdzenie człowieka.
  - id: Q3
    blocking: false
    ask: >-
      Przy okazji tej naprawy znaleziono dwa większe, niepowiązane tematy: (1)
      równoległe zapytania o tę samą rzecz potrafią się zdublować zamiast
      współdzielić wynik, (2) sposób udostępniania na zewnątrz trzech podobnych
      mechanizmów w tym module (cache, retry, czasowe zachowania) odbiega od
      reszty biblioteki. Czy mają dostać własne zadania już teraz, czy zostać
      tylko odnotowane w tej analizie?
    q: >-
      Decyzja koordynatora o spawnowaniu osobnych plików tasków dla: (1)
      deduplikacja równoległych wywołań (cache stampede) — samodzielny, dobrze
      zdefiniowany, priorytet niski/średni, gotowy do specyfikacji; (2)
      naruszenie public-api-pattern (PA5/N2) eksportu konkretnych klas zamiast
      interfejs+fabryka, powtarzające się systemowo w trzech rodzinach behaviors
      (caching/retry/temporal) — wymaga własnej analizy i ścieżki deprecation,
      więc powinien powstać w stanie planned/proposed, nie ready. Rekomendacja
      syntezy: spawnować oba — znaleziska odnotowane wyłącznie w prozie
      zamkniętej analizy nie przeżywają (nikt nie grepuje starych analiz), a
      precedens w tym repo (VB-003 → VD-006/ VD-007/VF-026) pokazuje że
      spawnowane follow-upy przeżywają.
    answer: >-
      PROPOZYCJA — TAK, spawnować oba, po zatwierdzeniu tej analizy (nie w
      trakcie /analyze — poza dozwoloną listą zapisu tej fazy): (1) deduplikacja
      równoległych zapytań (cache stampede) jako gotowy, samodzielny task
      priorytetu niskiego/średniego; (2) naruszenie public-api-pattern (eksport
      klas zamiast interfejs+fabryka, systemowe w trzech rodzinach behaviors)
      jako task w stanie planned — wymaga własnej analizy i ścieżki deprecacji,
      nie wchodzi od razu do implementacji. Czeka na potwierdzenie człowieka.

decisions:
  - id: D1
    topic:
      'Przyczyna źródłowa — rozróżnienie insert vs update w ścieżce zapisu cache'
    choice: >-
      `const isUpdate = this.cache.has(key)` jako PIERWSZA instrukcja w
      prywatnej metodzie set() pamięci podręcznej, przed jakimkolwiek
      sprawdzeniem limitu/ewikcji. Ewikcja bramkowana `if (!isUpdate && size >=
      maxSize)`, liczenie wpisów bramkowane `if (!isUpdate)`.
    means: >-
      Ponowny zapis pod kluczem, który cache już ma, przestaje po cichu wyrzucać
      niepowiązany wpis, a liczba raportowanych elementów przestaje rozjeżdżać
      się z rzeczywistością.
    rationale: >-
      B1 (błędna ewikcja), B3 (duplikacja węzła LRU) i drift licznika to trzy
      objawy jednego zaniechania: ścieżka zapisu traktuje każdy zapis jak
      wstawienie. Kolejność jest tu kluczowa — jeśli sprawdzenie pojemności
      wykona się pierwsze, re-set przy size===maxSize wywłaszcza obcy wpis, mimo
      że efektywny rozmiar się nie zmienia. Naprawa na samym początku ścieżki
      zapisu obejmuje przypadek ogólny; guard umieszczony później nie może
      cofnąć ewikcji, która już się wydarzyła.
  - id: D2
    topic: 'Integralność dwukierunkowej listy LRU'
    choice: >-
      Dodatkowy guard przy tworzeniu węzła: `if (this.lruNodes.has(key))
      this.removeNode(key)` przed dodaniem nowego węzła. To UZUPEŁNIENIE D1, nie
      alternatywa.
    means: >-
      Wewnętrzna struktura kolejności zostaje spójna nawet gdy ten sam klucz
      jest zapisywany więcej niż raz, więc "usuń najstarszy" dalej znaczy
      najstarszy.
    rationale: >-
      Dodawanie węzła było bezwarunkowe: mapa klucz→węzeł była nadpisywana, a
      stary węzeł zostawał fizycznie wpięty w listę. Gdy re-setowany klucz był
      głową listy, głowa wskazywała na węzeł-widmo; kolejna ewikcja rozwiązywała
      klucz głowy przez (nadpisaną) mapę i kasowała świeżo zapisany wpis. To
      złamanie semantyki LRU, nie tylko wyciek. D1 zapobiega uruchomieniu
      ewikcji przy aktualizacjach w ogóle; D2 naprawia samą strukturę. Oba
      wymagane — żadne nie zastępuje drugiego.
  - id: D3
    topic: 'Poprawność licznika wpisów'
    choice: >-
      Inkrementacja licznika wpisów tylko przy realnych wstawieniach, na
      podstawie tej samej flagi isUpdate co w D1.
    means:
      Statystyki cache'a zostają wiarygodne zamiast zawyżać, ile faktycznie jest
      zcache'owane.
    rationale: >-
      Licznik był inkrementowany bezwarunkowo. Było to utajone tylko dlatego, że
      re-set był efektywnie nieosiągalny/zepsuty; naprawa B3 czyni go osiągalnym
      i zamieniłaby uśpiony błąd w aktywny dryf w górę. Odkryte niezależnie
      przez obu recenzentów technicznych panelu.
  - id: D4
    topic: 'Maksymalny rozmiar cache — gdzie mieszka domyślna wartość'
    choice: >-
      Publiczny typ konfiguracji zachowuje maxSize jako OPCJONALNY. Domyślna
      wartość wchodzi w implementacji: domyślny parametr w prywatnej metodzie
      set() plus `?? DEFAULT_MAX_SIZE` w miejscach wywołania w fabrykach.
      Publiczny typ pozostaje nietknięty.
    means: >-
      Istniejący kod konsumentów dalej się kompiluje bez zmian, a pamięci
      podręczne, które nigdy nie miały limitu, dostają teraz rozsądny sufit
      wbudowany.
    rationale: >-
      Uczynienie pola wymaganym potwierdzono jako MAJOR breaking change — nawet
      własna fabryka TTL biblioteki przestałaby się kompilować, bo nie
      przekazuje rozmiaru. Domyślna wartość wewnątrz nieeksportowanej klasy
      pokrywa wszystkie fabryki, obecne i przyszłe, z jednego miejsca, przy
      zerowej zmianie powierzchni publicznego API.
  - id: D5
    topic: 'Strategia egzekwowania TTL'
    choice: >-
      TTL zostaje leniwe (sprawdzane przy odczycie). Brak sweepera/timera w tle.
      Leniwa semantyka jawnie udokumentowana w JSDoc dotkniętych publicznych
      fabryk.
    means: >-
      Wpisy wygasają, gdy ktoś ich szuka, nie wg harmonogramu; to limit rozmiaru
      realnie chroni pamięć. Jest to teraz napisane w dokumentacji zamiast być
      ukrytą niespodzianką.
    rationale: >-
      To biblioteka bez frameworka, bez haka lifecycle/dispose, więc timer nie
      miałby właściciela — nałożyłby stały koszt na każdego konsumenta
      niezależnie od ruchu. Oba recenzenci techniczni odrzucili sweeper z
      identycznych powodów. Konsekwencja zaakceptowana i udokumentowana: klucz
      zapisany i nigdy więcej nie odczytany nigdy nie wygasa czasowo — ewikcja
      po rozmiarze jest jedynym realnym backstopem.
  - id: D6
    topic: 'Obsługa nullish dla opcji boolean/numerycznych'
    choice: >-
      Zamiana `||` na `??` dla flagi cache'owania niepowodzeń, ORAZ ta sama
      zmiana dla opcji maxSize w fabryce dla drogich operacji (spójność).
    means:
      Jawne przekazanie wartości opcji "fałszywej, ale zamierzonej" jest
      wreszcie respektowane.
    rationale: >-
      Naprawa flagi to faktyczny defekt zadania (jawne `false` było
      nieodróżnialne od "nie podano"). Wystąpienie przy maxSize jest dziś
      nieszkodliwe (zero jako rozmiar nie ma sensu), ale to ten sam antywzorzec
      w tym samym pliku; naprawa teraz nic nie kosztuje i zapobiega powtórce.
  - id: D7
    topic: 'Kształt dostawy'
    choice: >-
      Jeden PR, osobne commity per defekt, w tej kolejności: (1) obsługa
      nullish, (2) rozróżnienie insert/update + bramkowanie ewikcji + licznik,
      (3) guard deduplikacji listy, (4) dokumentacja/JSDoc + wpis do changeloga.
    means:
      Jeden przegląd, ale każda poprawka zostaje osobno czytelna i odwracalna w
      historii.
    rationale: >-
      Trzy defekty dzielą plik i powierzchnię testów; podział na osobne PR-y
      tworzyłby churn i zmuszał recenzenta do trzymania tego samego kontekstu
      trzy razy. Kolejność commitów odzwierciedla łańcuch przyczynowy, więc
      każdy commit jest z osobna zielony.
  - id: D8
    topic: 'Traktowanie w changelogu nowo wymuszonego sufitu rozmiaru'
    choice: >-
      Wpis do changeloga OBOWIĄZKOWY, sklasyfikowany jako fix z jawną notatką
      behawioralną: dotąd nieograniczone pamięci podręczne z fabryk TTL i
      custom-key dostają teraz limit. Brak zmiany sygnatury, więc nie flagowane
      jako breaking API change.
    means: >-
      Każdy, kto aktualizuje bibliotekę, dowiaduje się wprost, że te pamięci
      podręczne mają teraz górny limit i jak go podnieść, zamiast odkrywać to po
      zmienionym współczynniku trafień.
    rationale: >-
      Wcześniejszy nieograniczony wzrost był brakiem backstopu, nie
      udokumentowanym kontraktem, więc klasyfikacja jako major-breaking byłaby
      przesadzona. Ale to obserwowalna zmiana zachowania eksportowanych fabryk,
      a milczenie przerzuciłoby koszt odkrycia na konsumentów. Klasyfikacja
      wersji odłożona (patrz Q2); wersje idą przez narzędzia wydania, nigdy
      ręczną edycję.
  - id: D9
    topic: 'Granica zakresu'
    choice: >-
      Poza zakresem tego taska, odnotowane tylko jako fakty (F10, F11_poboczne,
      F12_poboczne). Rekomendowane jako spawnowane osobne taski (decyzja
      koordynatora, patrz Q3): deduplikacja równoległych zapytań (cache
      stampede) i przeprojektowanie publicznego API modułu behaviors.
    means: >-
      Ta praca zostaje mała i możliwa do wydania szybko; większe znaleziska
      dostają własne miejsce zamiast cicho rozdymać tę poprawkę.
    rationale: >-
      Notatka o braku lifecycle hooka jest przesłanką decyzji D5, nie zadaniem.
      Notatka o kolizji namespace ma wagę "do świadomości". Stampede to
      samodzielna funkcja. Znalezisko o wzorcu eksportu jest systemowe w trzech
      rodzinach behaviors i wymaga własnej analizy plus ścieżki deprecation —
      wtopienie któregokolwiek w ten task zamazałoby skupiony bugfix w
      przeprojektowanie API.

patterns: # z 0.5 (runtime.yml patterns.always + triggers)
  - typescript-library/public-api-pattern.md # WIĄŻE: PolicyCacheConfig i klasy fabryk są publiczne (F2); zmiana maxSize z opcjonalnego na wymagany była realnym kandydatem na breaking change, odrzucona (D4); F11_poboczne to osobne, pre-existing naruszenie PA5/N2, poza zakresem
  - typescript-library/library-testing-pattern.md # WIĄŻE: task wymaga nowego testu kontraktowego (policy-cache-config.contract.spec.ts) pilnującego zgodności JSDoc↔zachowanie dla WSZYSTKICH opcji configu — trigger "kontrakt"/"test" z treści taska
  - typescript-library/package-boundary-pattern.md # NIE WIĄŻE: zmiana wyłącznie wewnątrz-plikowa w @vytches/ddd-policies, PolicyCache nigdy nie przekracza granicy pakietu (F1)
  - cross-layer/conventions-pattern.md # NIE WIĄŻE: brak nowych plików domenowych/aplikacyjnych — wewnętrzna infrastruktura biblioteki (decorators/behaviors), nie kod konsumenta DDD
---

# Analiza: VB-006

## Synteza (tech-lead)

To, co wyglądało na trzy osobne usterki w tej samej pamięci podręcznej
uprawnień, po sprawdzeniu okazuje się jedną przyczyną z trzema objawami:
mechanizm zapisu nie rozróżnia "zapisuję coś nowego" od "aktualizuję coś, co już
tam jest". Stąd błędne usuwanie niepowiązanego wpisu przy pełnej pamięci,
uszkodzona kolejność "najstarszy first" i myląca statystyka ile faktycznie jest
zcache'owane. Naprawa jednego źródła zamyka wszystkie trzy naraz, bez rozdymania
zakresu.

Martwy przełącznik bezpieczeństwa (świadome `false` konsumenta ignorowane) —
najpilniejszy element zgłoszenia — to osobna, jednoliniowa poprawka w tym samym
pliku, bez ryzyka.

Rozwiązanie celowo NIE dotyka publicznego kształtu konfiguracji: zrobienie
limitu rozmiaru obowiązkowym złamałoby kompatybilność wsteczną (nawet własny kod
biblioteki by się nie skompilował). Limit wchodzi więc jako bezpieczna wartość
domyślna w miejscu, którego konsument nigdy nie widzi.

Przy okazji audytu znaleziono dwa większe, niezwiązane tematy w tym samym module
(dublowanie się równoległych zapytań o to samo, oraz sposób udostępniania trzech
podobnych mechanizmów na zewnątrz odbiegający od reszty biblioteki) —
rekomendacja to osobne zadania, nie rozszerzenie tego.

## Otwarte pytania (DO DYSKUSJI — odpowiedz w frontmatter `answer:`, wszystkie niebiorące)

- **Q1**: jedna wspólna domyślna wielkość limitu wszędzie, czy zostawić
  istniejący, mniejszy limit tam gdzie już jest celowy?
- **Q2**: zmiana zachowania (nowy limit) bez zmiany sygnatury — zwykła poprawka
  z notatką, czy wyższa ranga w numeracji wersji?
- **Q3**: dwa poboczne znaleziska (dublowanie zapytań, sposób udostępniania
  mechanizmów na zewnątrz) — osobne zadania już teraz, czy tylko zapisane tutaj?

## Decyzje (proponowane — zweryfikuj)

- **D1-D3**: jedna wspólna naprawa źródła (rozróżnienie nowego wpisu od
  aktualizacji) zamyka błędne usuwanie, uszkodzoną kolejność i mylącą statystykę
  naraz.
- **D4**: limit rozmiaru zostaje bezpieczną wartością domyślną w implementacji,
  nie wymogiem w publicznej konfiguracji — zero ryzyka dla istniejącego kodu
  konsumentów.
- **D5**: czas życia wpisu zostaje sprawdzany na żądanie (bez zegara w tle) — to
  jedyny realny sposób bez wprowadzania nowego rodzaju wycieku.
- **D6**: martwy przełącznik naprawiony (i drugie, mniej groźne miejsce tego
  samego typu przy okazji).
- **D7**: jedna zmiana, rozłożona na czytelne, osobne kroki w historii.
- **D8**: wzmianka w informacji o wydaniu obowiązkowa, bez podnoszenia jej do
  rangi zmiany łamiącej kompatybilność.
- **D9**: dwa poboczne znaleziska zostają poza zakresem tej naprawy.

## Ryzyka / uwagi

- Limit rozmiaru pamięci podręcznej to dziś JEDYNY realny mechanizm chroniący
  przed nieograniczonym zużyciem pamięci w tej klasie (czas życia wpisu sam w
  sobie nie sprząta niczego, co nie jest ponownie odczytywane) — to przesądza,
  że ta naprawa nie jest kosmetyką.
- Błąd uszkodzonej kolejności "najstarszy first" jest dziś ukryty wyłącznie
  dyscypliną jednego miejsca w kodzie, nie gwarancją — pęknie przy pierwszym
  przyszłym miejscu w kodzie, które zapisze do pamięci podręcznej z pominięciem
  dzisiejszej ścieżki odczytu.
- Testy wymagane jako konsekwencja napraw D1-D3 (nie osobna decyzja): ponowny
  zapis pod istniejącym kluczem przy pełnej pamięci podręcznej nie zmienia
  rozmiaru, nie usuwa żadnego innego wpisu i nie zawyża licznika; ponowny zapis
  klucza będącego akurat najstarszym nie powoduje, że kolejne czyszczenie usuwa
  świeżo zapisany wpis.
- Q1/Q2/Q3 są wszystkie niebiorące — implementacja może ruszyć bez czekania na
  odpowiedzi, ale Q1 najlepiej domknąć przed mergem (nazwa/wartość stałej), a Q3
  decyduje czy powstaną dodatkowe pliki tasków.

---

> Po wypełnieniu odpowiedzi i zatwierdzeniu decyzji: ustaw `status: approved`,
> dopiero wtedy `/orchestrate VB-006`. **KONIEC — nie wołaj orchestracji, nie
> implementuj.**
