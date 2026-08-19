---
task: VF-039b-orchestration-churn-guard
status: awaiting-human

threat_model: null # tooling, brak powierzchni security; panel runtime.yml nie ma stage'a threat-model

parent_analysis: VF-039 (split 2026-08-19) # panel odpalony raz dla VF-039; ten artefakt niesie połowę z blokadą
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

rag:
  skipped (brak MCP retrieve_code/retrieve_patterns w tej sesji; grounding ze
  statycznej listy patterns.always + celowana weryfikacja symboli w obu repo)

codebase_facts:
  F1:
    'Skrypty workflow są PISANE RĘCZNIE PER TASK (VF-036.workflow.js,
    VF-037.workflow.js, ~50KB, kopiowane i adaptowane). Brak generatora, brak
    współdzielonego modułu runtime.'
  F2:
    'hooks/workflow-lint.js to ręczne CLI (233 linie, WL1-WL10). Nic go nie
    wywołuje automatycznie. VF-039a dopisuje krok wywołania do orchestrate.md
    §2.'
  F4:
    "buildVerifierPrompt(cfg) ISTNIEJE, ale lokalnie w każdym skrypcie (VF-037
    linia 83). claude-patterns nie ma wspólnej wersji; WL10 wykrywa go regexem
    po nazwie. 'Kanoniczny builder' to konwencja trzymana dopasowaniem tekstu,
    nie importowana funkcja."
  F5:
    'runLayer(cfg, prevFilesLine) — linia 407. prevFilesLine inicjowany w 580,
    przeliczany w 594, przekazywany WYŁĄCZNIE do implementPrompt() (336, wołane
    w 420). Miejsce budowy prompta weryfikatora (494-515) buduje evidence z
    layerFiles, czyli plików TEJ warstwy. Teza taska potwierdzona.'
  F7:
    "Prompt weryfikatora JUŻ mówił 'Judge only the files listed in the evidence
    map' (511) i 'NO-GO tylko dla defektów wewnątrz zakresu' (98). Incydent i
    tak nastąpił — pytanie kontrolne przeciągnęło weryfikatora na całe drzewo.
    Instrukcja przegrała z instrukcją."
  F9:
    'Propagacja claude-patterns dwudrożna: symlinki (patterns, skills, rules)
    żywe natychmiast; ~/.claude/hooks/workflow-lint.js to KOPIA i wymaga
    deployu. Stan 2026-08-13: bajtowo identyczna ze źródłem.'
  F11:
    'Warstwa baselines miała .github/workflows/ci.yml WE WŁASNYM zakresie i
    miała prawo edytować go ponownie (ten sam plik ruszyła wcześniej warstwa
    gates). Lista zamrożonych plików oflagowałaby poprawną pracę jako
    naruszenie.'
  F12:
    'snapshot() (linie 126-158) już liczy mapę churnu per ścieżka z git diff
    --numstat, działa na haiku, a jej wynik jest już wstrzykiwany do evidence
    weryfikatora jako gotowy fakt PASS/FAIL dla typechecka (tc.ok, linie
    494-503). Weryfikator już z powodzeniem konsumuje gotowe fakty
    deterministyczne.'

open_questions:
  - id: Q1
    blocking: true
    ask: >-
      Czy zabezpieczenie wpisujemy tylko w bieżący scenariusz uruchomieniowy, co
      jest tanie, ale każdy następny trzeba będzie przepisywać ręcznie i ktoś
      kiedyś zapomni? Alternatywa to jeden wspólny mechanizm dla wszystkich,
      trwały, ale to już decyzja o architekturze narzędzia, a nie drobna
      poprawka.
    q: >-
      Where does the churn ledger live? Per F1 workflow scripts are
      hand-authored one-offs with no generator and no shared runtime module.
      Option (a): implement the guard inside this task's workflow script and let
      future scripts copy-adapt it, as with everything else. Cheap; protects
      only scripts written afterwards, and only if the author copies the right
      block. Option (b): extract it into the first shared module in
      claude-patterns that scripts import. Structural fix, but it starts a
      runtime-module precedent this ecosystem has deliberately not had, and it
      interacts with the split propagation model (F9: symlinks vs byte copies).
      This changes the shape of every AC in the task.
    answer: null
  - id: Q3
    blocking: false
    ask: >-
      Gdy system wykryje, że wcześniejsza praca została skasowana, ma zatrzymać
      cały przebieg, czy tylko zapytać człowieka? Zatrzymanie jest
      bezpieczniejsze, ale czasem przerwie zmianę, która była w porządku.
    q: >-
      Should a detected churn drop hard-stop the run via the existing escalate()
      path, or pause for a human ruling? A layer that legitimately deletes lines
      a previous layer added (a genuine refactor, not a revert) registers as a
      churn drop and would be blocked. Frequency is unknown; the corpus is two
      scripts.
    answer: null
  - id: Q4
    blocking: false
    ask: >-
      Nowe ostrzeżenie na start tylko informuje, nie blokuje. Planujemy kiedyś
      sprawdzić, jak często myli się w praktyce, i wtedy je zaostrzyć, czy
      zostanie ostrzeżeniem, które wszyscy przewijają?
    q: >-
      Does the new lint rule get promoted from WARN to ERROR, and who owns that
      per repo? Recommended path is WARN first, promotion after measuring the
      false-positive rate against the existing script corpus (VF-036, VF-037).
      That measurement is not in scope here. Without it the rule stays advisory
      permanently. Note VF-039a wires the lint into an invocation step, so a
      WARN is at least seen from now on.
    answer: null

decisions:
  - id: D1
    topic: 'Główna kontrola: deterministyczna, nie promptowa'
    choice: >-
      Monotonic-churn ledger jako główna kontrola. Przy każdym GO warstwy zapisz
      {path, churn} z istniejącej mapy numstat w snapshot(); przed weryfikatorem
      kolejnej warstwy zrób re-snapshot i porównaj. Spadek churnu na ścieżce
      wcześniej zatwierdzonej wywołuje escalate(). Wzrost jest legalny. Wynik
      wstrzykiwany do prompta weryfikatora jako GOTOWY FAKT PASS/FAIL, w tym
      samym bloku i kształcie co istniejący wynik typechecka, razem z
      etykietowaną listą ścieżek poprzednich warstw. AC-ALLOWLIST zostaje, ale
      jako nośnik tego faktu, nie jako lista, z której weryfikator ma sam
      wnioskować.
    means: >-
      Narzędzie samo zapamięta, ile pracy wykonano nad każdym plikiem, i
      zatrzyma przebieg w chwili, gdy kolejny krok zacznie tę pracę kasować.
      Dziś wykrywaliśmy to dopiero na końcu, po spaleniu kilku godzin pracy i
      dużych kosztów.
    rationale: >-
      F12: mapa churnu i wzorzec wstrzykiwania gotowych faktów już istnieją i
      działają. F5: prevFilesLine jest liczony co warstwę i po prostu nie
      dociera do miejsca budowy prompta weryfikatora, więc to kilka linii
      instalacji. F11 przekreśla naiwną listę zamrożonych plików: warstwa
      baselines miała prawo edytować ci.yml po raz drugi, a monotoniczny churn
      odróżnia "rozszerzył" od "cofnął" bez oceny modelu. F7 jest powodem, dla
      którego to nie może zostać kontrolą promptową: instrukcja konkurująca z
      inną instrukcją przegrywa niedeterministycznie. Koszt nie rozstrzyga —
      wariant deterministyczny i promptowy są tego samego rzędu wielkości na
      przebieg, oba grubo poniżej 1% kosztu incydentu.
    propose_adr: true
  - id: D5
    topic: 'Zakres reguł lintu'
    choice: >-
      Z dwóch planowanych reguł budujemy tylko regułę wykrywającą cztery ciągi
      git w promptcie implementera lub fixa, poziom WARN, z supresorem okna
      negacji, żeby tekst samego zakazu z VF-039a jej nie wywoływał, plus
      przypadki regresyjne w evalu. Reguła wnioskująca "skrypt śledzi pliki
      poprzednich warstw, ale ich nie wstrzykuje" wypada.
    means: >-
      Z dwóch planowanych kontroli automatycznych budujemy tylko tę prostą i
      pewną. Druga zgadywałaby zbyt często i nauczyłaby zespół ignorować
      ostrzeżenia, a wtedy przestałyby działać także te, które dziś działają.
    rationale: >-
      Odrzuconej regule przypisano błędy w obie strony: fałszywe trafienia, gdy
      identyfikator śledzący służy tylko do escalate(), i fałszywe pominięcia,
      gdy allowlista liczona jest inline i nigdy nie nazwana. F1 oznacza brak
      wspólnego runtime, o który dałoby się zaczepić detekcję; F4 pokazuje, że
      "kanoniczny builder" to konwencja trzymana wyłącznie dopasowaniem tekstu.
      Reguła myląca się przy pierwszym kontakcie uczy operatorów ignorować
      linter, a ta nieufność uogólnia się na WL1-WL9, które działają. Zachowana
      reguła też ma jeden znany konfundent: poprawnie napisany zakaz MUSI
      wymienić zakazane polecenia z nazwy, więc gołe dopasowanie ciągu trafiłoby
      w edycję, która naprawiła problem.

patterns: # z 0.5 (runtime.yml patterns.always). Panel jednogłośnie: ŻADEN nie wiąże w tym tasku.
  - cross-layer/conventions-pattern.md # nie wiąże: brak plików warstwy domenowej/aplikacyjnej
  - typescript-library/public-api-pattern.md # nie wiąże: nic tu nie jest eksportowanym symbolem biblioteki
  - typescript-library/package-boundary-pattern.md # nie wiąże: żadna granica pakietu Nx nie jest przekraczana
# UWAGA: gdyby Q1 rozstrzygnięto na wariant (b), czyli pierwszy współdzielony moduł
# importowany przez skrypty, public-api-pattern i package-boundary-pattern ZACZNĄ wiązać
# — moduł dostanie powierzchnię publiczną i granicę. Przelicz tę listę po odpowiedzi na Q1.

units: []
---

# Analiza: VF-039b

## Synteza

VF-039a odbiera automatowi prawo do cofania pracy. Ta połowa odbiera mu
możliwość zrobienia tego niezauważenie, a to inna gwarancja i trwalsza.

Rozpoznanie jest takie: instrukcja już raz przegrała z instrukcją. Weryfikator
miał czarno na białym napisane, żeby oceniał wyłącznie własne pliki, i mimo to
poszedł przeglądać całe drzewo, bo pytanie kontrolne kazało mu sprawdzić, czy
nie ma zmian spoza zakresu. Dokładanie kolejnego zdania do tego samego polecenia
nie usuwa konkurencji między zdaniami, tylko ją powiększa. Dlatego główną
kontrolą powinien być pomiar.

Narzędzie już dziś liczy, ile zmian przybyło w każdym pliku, i już dziś podaje
weryfikatorowi gotowe wyniki innych automatycznych sprawdzeń. Wystarczy
zapamiętać ten pomiar w chwili zatwierdzenia i przerwać przebieg, gdy później
spadnie. Wzrost zostaje dozwolony, i to jest kluczowe, bo w tym samym incydencie
kolejny krok miał prawo dopisać coś do tego samego pliku. Zwykła lista plików
nietykalnych blokowałaby pracę wykonaną poprawnie.

Zanim to ruszy, trzeba rozstrzygnąć jedno. Scenariusze uruchomieniowe pisze się
ręcznie od zera dla każdego zadania, więc poprawka wpisana w bieżący scenariusz
ochroni następny tylko wtedy, gdy ktoś ją przepisze. Alternatywa jest trwała,
ale otwiera decyzję o architekturze narzędzia, której to środowisko dotąd
świadomie unikało. To pytanie blokuje start.

## Otwarte pytania (odpowiedz w frontmatter `answer:`)

- **Q1** (blokujące): jedno rozwiązanie dla wszystkich przebiegów czy poprawka
  tylko w bieżącym
- **Q3**: zatrzymywać przebieg po wykryciu cofnięcia czy tylko pytać
- **Q4**: czy nowe ostrzeżenie ma kiedyś zacząć blokować

## Decyzje (proponowane, zweryfikuj)

- **D1**: pomiar zamiast instrukcji jako główne zabezpieczenie
- **D5**: budujemy tylko prostszą z dwóch kontroli automatycznych

## Ryzyka / uwagi

- Pomiar liczby zmian to przybliżenie, nie dowód. Krok, który zastępuje
  czterdzieści linii dwudziestoma lepszymi, wygląda tak samo jak częściowe
  cofnięcie. Nie wiemy, jak często to się zdarza, bo mamy tylko dwa wcześniejsze
  przebiegi do porównania.
- Scenariusze uruchomieniowe pisane są ręcznie od zera dla każdego zadania.
  Cokolwiek tu naprawimy, ochroni następny przebieg tylko wtedy, gdy autor
  przepisze właściwy fragment. To najpoważniejsza nieadresowana słabość i jest
  dokładnie treścią pytania blokującego.
- Nowa kontrola automatyczna może zareagować na tekst samego zakazu, bo
  poprawnie napisany zakaz musi wymienić zakazane polecenia z nazwy.
  Zabezpieczenie przed tym działa na sformułowanie, które napiszemy teraz, i nie
  gwarantuje nic następnemu autorowi.
- Rezygnacja z trudniejszej kontroli automatycznej sprawia, że sam błąd, o który
  chodzi, pozostanie niewykrywalny w przyszłych przebiegach. Pomiar ogranicza
  skutek, nie nawrót.
- Odpowiedź na pytanie blokujące może zmienić listę wiążących wzorców. Wariant
  wspólnego modułu daje mu powierzchnię publiczną i granicę, więc dwa wzorce
  dziś niewiążące zaczną wiązać.

---

> Po wypełnieniu odpowiedzi i zatwierdzeniu decyzji: ustaw `status: approved`,
> potem uruchom `/orchestrate VF-039b-orchestration-churn-guard`.
