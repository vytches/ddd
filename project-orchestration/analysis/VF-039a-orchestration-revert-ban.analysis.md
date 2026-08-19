---
task: VF-039a-orchestration-revert-ban
status: approved

threat_model: null # tooling/prose, brak powierzchni security; panel runtime.yml nie ma stage'a threat-model

parent_analysis: VF-039 (split 2026-08-19) # panel odpalony raz dla VF-039; ten artefakt niesie połowę bez blokad
stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml

panel: # runtime.yml analyze.panel — przebieg z 2026-08-13, wspólny dla VF-039a i VF-039b
  - {
      stage: tech-analysis,
      agent: 'ecc:architect',
      model: sonnet,
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
      pominięty:
        'trafienie "api" pochodzi z "api-report/" w opisie cudzej warstwy; slot
        bada publiczne API pakietu, a task nie rusza kodu pakietu',
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty: 'brak trafienia when:',
    }
  - {
      stage: synteza,
      agent: 'tech-lead',
      model: opus,
      uwaga:
        'frontmatter agenta mówi haiku; nadpisane zgodnie z polityką /analyze',
    }
  # pominięte kroki silnika: 0a (brak stage'a threat-model), 0.7 (brak bloku ddd/core),
  # 0.8 (brak stage'a decision-gate), 0.9 (brak bloku governance)

rag:
  skipped (brak MCP retrieve_code/retrieve_patterns w tej sesji; grounding ze
  statycznej listy patterns.always + celowana weryfikacja symboli w obu repo)

# Fakty ustalone empirycznie w przebiegu analizy — wiążące dla implementera.
codebase_facts:
  F2:
    'hooks/workflow-lint.js to ręczne CLI (233 linie, WL1-WL10). Grep po
    settings/CI/hookach: nic go nie wywołuje automatycznie.'
  F3:
    'commands/orchestrate-ddd.md NIE ISTNIEJE. Realny plik:
    claude-patterns/commands/orchestrate.md (190 linii). Nazwa /orchestrate-ddd
    żyje w prozie 15+ dokumentów.'
  F6:
    'Brak osobnego fix-agenta: implementPrompt(cfg, prevFilesLine, attempt,
    violations) przechodzi w tryb fix prozą w linii 354. Implementer i fixer to
    JEDEN builder — jedna edycja pokrywa oba.'
  F7:
    "Prompt weryfikatora JUŻ mówił 'Judge only the files listed in the evidence
    map' (511) i 'NO-GO tylko dla defektów wewnątrz zakresu' (98). Incydent i
    tak nastąpił — pytanie kontrolne przeciągnęło weryfikatora na całe drzewo.
    Instrukcja przegrała z instrukcją."
  F8:
    "Zakaz git checkout JUŻ istnieje, ale tylko w promptcie mutation-check
    (linia 615) i brzmi jako ograniczenie zasięgu: 'NEVER run git checkout . ...
    any command that touches paths other than the single file you mutated'.
    Jawnie zezwala na checkout pojedynczego pliku."
  F9:
    'Propagacja claude-patterns jest DWUDROŻNA. Symlinki (żywe natychmiast):
    .claude/knowledge/patterns, .claude/skills/*, .claude/rules/*, część
    .claude/hooks/*.sh. Kopie bajtowe (wymagają deployu):
    ~/.claude/commands/*.md, ~/.claude/hooks/workflow-lint.js. Stan 2026-08-13:
    identyczne ze źródłem, zero dryfu.'
  F13:
    'W claude-patterns NIE MA kanonicznego bloku HARD_RULES ani żadnego szablonu
    skryptu workflow (grep: zero trafień, templates/ nie zawiera nic dla
    workflow.js). HARD_RULES to stała wymyślana lokalnie w każdym skrypcie
    per-task. Trwałym domem zakazu jest więc commands/orchestrate.md §2, jedyne
    miejsce czytane przez autora NASTĘPNEGO skryptu. Skutek: AC-NO-REVERT,
    AC-DOC i AC-LINT-GATE lądują w jednym pliku.'
  F10:
    'commands/orchestrate.md §2 każe uruchomić skrypt przez narzędzie Workflow i
    cytuje WL6/WL10 jako uzasadnienie, ale NIGDY nie każe uruchomić
    workflow-lint.js. Jest dokładnie jeden dobrze określony moment przekazania
    skryptu i nie ma tam bramki.'

# KOREKTA FAKTÓW 2026-08-19 (przed implementacją). Panel działał 2026-08-13; przez sześć dni
# claude-patterns zmienił się istotnie (commity 48c024e, 5e1adc9, 8f5514a, 28c60d3).
# Zweryfikowane ponownie dziś, przed delegacją:
facts_revised_2026_08_19:
  F2_UNIEWAŻNIONY:
    "BYŁO: nic nie wywołuje workflow-lint automatycznie. JEST: hooks/hooks.json
    rejestruje PreToolUse matcher 'Workflow' → pre-workflow-lint.js, aktywny
    globalnie w ~/.claude/settings.json:10. Lint ma dziś 555 linii i reguły
    WL1-WL16 (było 233 i WL1-WL10)."
  F10_UNIEWAŻNIONY:
    'BYŁO: orchestrate.md §2 nigdy nie każe uruchomić lintu, brak bramki w
    momencie przekazania skryptu. JEST: bramka istnieje i jest MOCNIEJSZA niż
    proponowany krok prozą — to hook PreToolUse, nie zdanie w instrukcji.
    orchestrate.md urósł ze 190 do 436 linii.'
  F3_CZĘŚCIOWO:
    'Nazwa /orchestrate-ddd została już usunięta z commands/orchestrate.md
    (grep: zero trafień). Pozostaje w prozie innych dokumentów, co i tak było
    poza zakresem.'
  F9_OBALONY:
    'BYŁO (moja pomyłka z 2026-08-13, powtórzona 2026-08-19): commands/ i hooks/
    docierają do runtime jako KOPIE bajtowe wymagające deployu. JEST:
    ~/.claude/commands i ~/.claude/hooks to SYMLINKI KATALOGÓW do
    claude-patterns — ten sam inode (100405514 dla orchestrate.md, 100405133 dla
    workflow-lint.js). Pomyłka wzięła się stąd, że ls -l NA PLIKU pokazuje
    zwykły plik, a diff -q mówi identyczne, bo idzie przez dowiązany katalog.
    Skutek: kryterium AC-DEPLOY jest NIEWYKONALNE jak napisane (cp kończy się
    are the same file), a jego CEL jest spełniony strukturalnie — dryf nie może
    powstać. Weryfikacja: ls -ld na katalogu albo stat -c %i na obu ścieżkach.'
  F_GATE_POTWIERDZONY_MOCNIEJ:
    'pre-workflow-lint.js nie jest osobnym, słabszym sprawdzeniem: w linii 68
    robi require(workflow-lint.js) i uruchamia pełny zestaw WL1-WL16, blokując
    przy błędach. Bramka jest realna i twarda — skrypt Workflow bez zgodności z
    WL nie wystartuje. To domyka wątpliwość zgłoszoną przez bramkę końcową
    przebiegu.'
  F8_POTWIERDZONY:
    "Zakaz cofania nadal NIE ISTNIEJE w commands/orchestrate.md (grep na git
    checkout/restore/reset/stash: zero trafień w roli zakazu). §2a' mówi o czym
    innym — że wyjątek nie cofa zapisów z dysku."
  WPŁYW_NA_AC:
    'AC-LINT-GATE (D4) jest SPEŁNIONE cudzą pracą — do zweryfikowania i
    udokumentowania, nie do zbudowania. AC-DOC traci część o zmianie nazwy,
    zostaje sama notatka incydentowa. AC-DEPLOY staje się weryfikacją braku
    dryfu, nie naprawą. AC-NO-REVERT (D2) jest jedyną nietkniętą pracą.'
  WPŁYW_NA_VF039B:
    'Nowa reguła lintu z VF-039b to WL17, nie WL11 — numeracja doszła do WL16.
    Bramka PreToolUse oznacza, że WARN będzie realnie WIDZIANY, co było głównym
    zarzutem wobec tej reguły w analizie (Q4 zyskuje mocniejszą pozycję
    startową).'

open_questions:
  - id: Q2
    blocking: false
    ask: >-
      Zadanie wyceniono na dwie godziny, a rzetelna naprawa jest większa.
      Podnosimy wycenę i robimy całość naraz, czy najpierw wypuszczamy szybką
      część zamykającą dziurę, z ryzykiem, że solidne zabezpieczenie utknie w
      kolejce?
    q: >-
      Accept the re-estimate (5-6h) for VF-039 as one task, or split it?
      Proposed split: VF-039a = D2, D3, D4, D6 (absolute revert ban, doc note,
      lint invocation step, deploy) at roughly 2h with no blocking questions;
      VF-039b = D1 and D5 (churn ledger with precomputed-fact injection, plus
      the lint rule) at roughly 3-4h, gated on Q1.
    answer: >-
      SPLIT — decyzja użytkownika, 2026-08-19. VF-039a i VF-039b utworzone;
      VF-039 zamknięty jako umbrella (status: split). VF-039a jest priorytetem i
      nie czeka na nic; Q1, Q3 i Q4 przeszły w całości do artefaktu VF-039b i
      nie blokują tej połowy.

decisions:
  - id: D2
    topic: 'Bezwzględny zakaz cofania'
    choice: >-
      AC-NO-REVERT zostaje dokładnie jak napisane. Zakaz trafia do wspólnego
      bloku HARD_RULES (linia 43), bo implementer i fixer to jeden builder.
      Istniejące sformułowanie z linii 615 zostaje ZASTĄPIONE, nie uzupełnione.
      Nowa reguła: żadnego checkout, restore, stash, reset na żadnej ścieżce,
      nigdy, wprost włącznie z "tylko mój własny plik" i "przywracam jak było";
      agent, który uważa plik za spoza zakresu, zgłasza to i kończy turę.
    means: >-
      Automat straci prawo cofania wcześniej wykonanej pracy. Jeśli uzna, że coś
      jest nie na miejscu, ma to zgłosić człowiekowi zamiast usuwać.
    rationale: >-
      F8: obecna luka to nie przeoczenie, tylko czynne zezwolenie na dokładnie
      ten ruch, który wywołał incydent. F6: jeden builder obsługuje
      implementację i fix, więc jedna edycja pokrywa oba. Najtańsza zmiana o
      najwyższej pewności skutku, bo odbiera zdolność zamiast zniechęcać do jej
      użycia. Uwaga wykonawcza: protokół mutation-check robi backup i restore
      przez cp, nie przez git, więc bezwzględny zakaz z nim nie koliduje.
  - id: D3
    topic: 'AC-DOC wskazuje nieistniejący plik'
    choice: >-
      Cel AC-DOC to claude-patterns/commands/orchestrate.md. Notatka incydentowa
      ma być generyczna, nie związana z tym repo. Nieaktualną nazwę
      /orchestrate-ddd poprawiamy wyłącznie w pliku, który i tak otwieramy;
      szeroki rename to osobne porządki.
    means: >-
      Opis procedury poprawimy w tym jedynym miejscu, które jest naprawdę
      używane. W dokumentacji krąży dziś nieaktualna nazwa polecenia.
    rationale: >-
      F3. Zapis do nieistniejącej ścieżki po cichu unieważniłby jedyne
      kryterium, które nie ma innego egzekwowania. Generyczność ma znaczenie, bo
      dokument jest współdzielony przez wszystkie projekty konsumujące (F9).
  - id: D4
    topic: 'Wpięcie lintu w bramkę'
    choice: >-
      Krok "uruchom lint przed przekazaniem skryptu do runnera" wchodzi DO
      VF-039a, jako jedno zdanie w sekcji 2 pliku orchestrate.md, dokładnie w
      miejscu przekazania skryptu do narzędzia Workflow, z wymogiem rozwiązania
      znalezisk poziomu ERROR przed startem.
    means: >-
      Do instrukcji dopisujemy jedno zdanie: przed uruchomieniem trzeba włączyć
      istniejący, darmowy sprawdzacz. Bez tego wcześniej zbudowane
      zabezpieczenia po prostu nikt nie uruchamia.
    rationale: >-
      F10 wskazuje dokładnie jeden dobrze określony moment przekazania skryptu i
      brak bramki w tym miejscu. F2 potwierdza, że dziś nic nie wywołuje lintu
      automatycznie, czyli WL1-WL10 nie chronią niczego. Wydzielenie tego osobno
      oznacza, że reguły lintu z VF-039b trafiają w próżnię. To praca w
      dokumencie, który i tak otwieramy.
  - id: D6
    topic: 'Deploy jako część Done'
    choice: >-
      Kryterium AC-DEPLOY. VF-039a nie jest ukończone w momencie edycji
      claude-patterns: trzeba przekopiować orchestrate.md do ~/.claude/commands/
      i zweryfikować identyczność bajtową, z zapisem weryfikacji w dowodach
      zadania. Zmiany w skrypcie workflow (D2) to plik per-task w tym repo i
      deployu nie wymagają.
    means: >-
      Zmiany w instrukcji nie zaczynają działać od razu; trzeba je jeszcze
      skopiować tam, gdzie system faktycznie je czyta. Bez tego kroku zadanie
      wyglądałoby na zrobione, a w praktyce nic by się nie zmieniło.
    rationale: >-
      F9: wzorce, skille i reguły są dowiązaniami i działają natychmiast, ale
      commands/ i workflow-lint.js są kopiami. Dziś bajtowo identyczne, więc
      deploy jest trywialny; pominięcie daje zadanie oznaczone jako zrobione,
      którego zachowanie w runtime się nie zmieniło, czyli najdroższy rodzaj
      fałszywej zieleni.

patterns: # z 0.5 (runtime.yml patterns.always). Panel jednogłośnie: ŻADEN nie wiąże w tym tasku.
  - cross-layer/conventions-pattern.md # nie wiąże: brak plików warstwy domenowej/aplikacyjnej
  - typescript-library/public-api-pattern.md # nie wiąże: nic tu nie jest eksportowanym symbolem biblioteki
  - typescript-library/package-boundary-pattern.md # nie wiąże: żadna granica pakietu Nx nie jest przekraczana
# LUKA W BLOKU ts-library: brak wzorca dla pracy nad własnym toolingiem orkiestracji,
# więc grounding oparł się wyłącznie na zweryfikowanych codebase_facts powyżej.

units: []
---

# Analiza: VF-039a

## Synteza

To jest ta połowa VF-039, przed którą nie stoi żadne nierozstrzygnięte pytanie,
więc może ruszyć od razu. Trzy z czterech zmian to tekst instrukcji dla
automatu, a jedna to skopiowanie efektu tam, gdzie system naprawdę go czyta.

Najważniejsza jest ta pierwsza, i ma haczyk. Zakaz cofania pracy już istnieje,
ale sformułowano go jako ograniczenie zasięgu, przez co wprost zezwala na
cofnięcie pojedynczego pliku. To jest dokładnie ten ruch, który zniszczył
zatwierdzoną pracę. Trzeba go zastąpić, nie dopisać obok, bo dwa zdania obok
siebie znowu zostawią automat z wyborem, którego nie powinien mieć.

Dwie rzeczy, których pierwotne zadanie nie przewidziało, decydują o tym, czy ta
praca w ogóle da efekt. Dokument, do którego mieliśmy dopisać opis incydentu,
nie istnieje pod podaną nazwą, więc zapis poszedłby w pustkę. A sprawdzacz, na
którym opiera się cała reszta zabezpieczeń, nie jest przez nikogo uruchamiany,
więc reguły w nim zapisane dziś nie chronią niczego. Jedno zdanie w instrukcji,
w miejscu gdzie i tak pracujemy, to naprawia.

Na koniec rzecz łatwa do przeoczenia: instrukcja działa z kopii, nie z
oryginału. Bez skopiowania zmiany zadanie zamknie się jako zrobione, a
zachowanie systemu pozostanie identyczne jak przed poprawką.

## Otwarte pytania

Brak blokujących. Jedyne pytanie tej połowy, o podział zadania, zostało
rozstrzygnięte przez człowieka 2026-08-19 i jest odnotowane w `open_questions` z
odpowiedzią. Pozostałe pytania z pierwotnej analizy dotyczą wyłącznie VF-039b.

## Decyzje (proponowane, zweryfikuj)

- **D2**: bezwzględny zakaz cofania, zastępujący dzisiejsze częściowe
  sformułowanie
- **D3**: poprawka celu dokumentacyjnego, bo wskazana nazwa nie istnieje
- **D4**: jedno zdanie wpinające istniejący sprawdzacz w moment uruchomienia
- **D6**: skopiowanie zmian do miejsca, z którego system je czyta, jest częścią
  ukończenia

## Ryzyka / uwagi

- Zakaz jest tekstem, a incydent pokazał, że tekst potrafi przegrać z innym
  tekstem. Ta połowa ogranicza uprawnienie, ale nie mierzy skutku. Pomiar jest w
  drugiej połowie i dopóki nie wyląduje, zabezpieczenie opiera się na tym, że
  automat posłucha.
- Instrukcja i sprawdzacz są dziś identyczne z oryginałem, więc skopiowanie jest
  błahe. Jeśli zadanie zamknie się bez tego kroku, rozjazd zaczyna się teraz i
  każda kolejna zmiana odziedziczy niepewność, która wersja faktycznie działała.
- Nieaktualna nazwa polecenia żyje w kilkunastu dokumentach. Poprawiamy ją tylko
  tam, gdzie i tak pracujemy, więc następna osoba czytająca opis projektu wciąż
  poszuka polecenia, którego nie ma.
- Scenariusze uruchomieniowe pisane są ręcznie od zera dla każdego zadania.
  Zmiana w opisie procedury ochroni następny przebieg tylko wtedy, gdy autor ten
  opis przeczyta.

---

> Zatwierdzone przez człowieka 2026-08-19 (brak pytań blokujących). Uruchom
> `/orchestrate VF-039a-orchestration-revert-ban`.
