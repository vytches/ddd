---
task: VF-042-stale-compensation-invalidation
status: approved # zatwierdzone przez właściciela biblioteki 2026-08-31, po konsultacji 5-agentowego panelu doradczego (library-api-guardian, library-quality-verifier, library-expert, documentation-master, ddd-patterns-expert)

layers_done: [implementation, testing] # /orchestrate 2026-09-01: final_gate (library-quality-verifier) GO, zero violations; exit STAGE_NOT_COMMIT

threat_model: null # brak powierzchni security — prymityw in-process, zero I/O sieciowego, zero PII; panel runtime.yml nie ma stage'a threat-model

stack_blocks: [ts-library, library-layers, nx-monorepo, approval-gate] # kopia z runtime.yml

panel: # runtime.yml analyze.panel, przebieg 2026-08-31
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
        'trafienie "API"/"public"/"signature" — prawdziwe: framing question
        taska to dosłownie pytanie, czy dodać nowe publiczne API',
      wynik: ok,
    }
  - {
      stage: boundary-analysis,
      agent: 'ecc:architect',
      pominięty:
        'brak trafienia when:. Jedyny kandydat w treści taska — "wydzielić
        własny serwis TCC" z sekcji o konsumencie w VF-040 — nie występuje w
        VF-042. Zero granic pakietów rusza się w tym tasku (zmiany zostają w
        pakiecie resilience, jeśli w ogóle jakiś kod powstanie).',
    }

open_questions:
  - id: VF-042-Q1
    ask: >-
      Czy zamknięcie tego zadania samą zasadą opisaną w dokumentacji, bez nowej
      funkcji w bibliotece, jest dla Ciebie akceptowalnym wynikiem? Jeśli
      oczekujesz, że konsument dostanie konkretny nowy mechanizm, powiedz to
      teraz — zmienia to zakres.
    q: >-
      Panel jednogłośnie rekomenduje zamknięcie VF-042 zerem nowego publicznego
      API: udokumentowana zasada + jedna poprawka na poziomie PATCH (zamrożenie
      tablicy błędów) + jedno zdanie dokumentacji o timeoucie. Prośba konsumenta
      (metoda `invalidate(value): boolean`) zostaje odpowiedziana wskazówką, nie
      kodem. Odrzucenie uzasadnione: (1) brak dowodu popytu — oba scenariusze, w
      których jakiekolwiek API by się opłacało (≥2 zasoby na stosie, konfirmacja
      poza kolejnością), nie występują w żadnym dostępnym kodzie produkcyjnym;
      (2) sam kształt jest zdyskwalifikowany niezależnie od popytu — rozdziela
      acquire/undo na dwie instrukcje (wzorzec, który zepsuł 2/10 ręcznych
      handlerów przed VF-040), klucz po tożsamości wartości jest niewiarygodny
      (`undefined` dla zasobów bez uchwytu), a `splice` w trakcie trwającego
      unwindu potwierdzono ręcznym prześledzeniem jako powodujący PODWÓJNE
      wywołanie compensate na przesuniętym wpisie — gorsze niż samo pominięcie.
    answer: >-
      Tak. Jednoglosna rekomendacja panelu doradczego (5/5). Warunek: to
      zamkniecie dziala tylko razem z VF-042-D2 (poprawka PATCH) i tylko jesli
      zasada wyladuje jako konkretny artefakt dokumentacyjny, nie sama proza w
      JSDoc. documentation-master wskazal, ze VF-040 juz raz udowodnil w tym
      repo, ze sama obecnosc zasady/API bez przykladu jest bezwartosciowa (2605
      recznych miejsc mimo istniejacych kombinatorow Result). Wymagane cztery
      artefakty: (1) rozszerzony @example w runCompensated
      (compensation-stack.ts:216-235) pokazujacy krok confirm; (2) wzmocnione
      WARNING w JSDoc runCompensated (linie 176-189); (3) doslowny cytat
      blednego kodu w packages/resilience/LLMGUIDE.md, sekcja "Compensating for
      side effects..." (linia 254), nie sama proza w sekcji Anti-Patterns; (4)
      wpis w OBU kopiach llm-context.md (docs/llm-context.md i
      packages/enterprise/llm-context.md, potwierdzone jako nie-identyczne).
  - id: VF-042-Q2
    ask: >-
      Mamy dwa wykluczające się sposoby bezpiecznego użycia i musimy ogłosić
      jeden jako oficjalny: albo mechanizm uznajemy za zużyty po udanym
      przebiegu i nie oddajemy go do późniejszego wycofania, albo zostawiamy go
      do późniejszego wycofania, ale wtedy w danym przebiegu nie wolno robić
      niczego nieodwracalnego. Który wariant ma być tym zalecanym?
    q: >-
      "Confirm ostatni" samo w sobie NIE zamyka luki z sekcji Why taska. Dwie
      własności VF-040 są wzajemnie niezgodne w obecności nieodwracalnej
      konfirmacji: (a) stos zostaje uzbrojony po sukcesie, żeby zewnętrzny hook
      mógł go odwinąć po późniejszym rollbacku transakcji wywołującej; (b)
      konfirmacja dzieje się wewnątrz flow. Przy obu naraz ścieżka "sukces →
      stos uzbrojony → zewnętrzny hook po rollbacku → release na już
      potwierdzonym zasobie" pozostaje osiągalna nawet przy poprawnie napisanym
      kodzie z konfirmacją na końcu. Dokładnie jeden wariant musi stać się
      oficjalną udokumentowaną zasadą: (A) confirm ostatni ORAZ stos jest
      traktowany jako zużyty po sukcesie — nie oddawany zewnętrznemu hookowi;
      albo (B) stos zostaje uzbrojony dla hooka ORAZ nic nieodwracalnego nie
      dzieje się w danym przebiegu — konfirmacja przesunięta poza ten stos,
      dopiero po commicie wywołującej transakcji. Wybór determinuje treść
      dokumentacji i nie da się go rozstrzygnąć wyłącznie technicznie — to
      zobowiązanie co do modelu użycia.
    answer: >-
      Wariant B, sformulowany jako lokalna regula latwa do zastosowania. 3 z 5
      doradcow (api-guardian, quality-verifier, library-expert) rekomenduja B:
      to jedyny wariant zgodny z juz napisana i przetestowana gwarancja (test
      compensation-stack.test.ts:269-281 pokrywa dokladnie "armed after
      success"); wariant A wymagalby cofniecia gwarancji, ktora VF-040 swiadomie
      zamrozil. ddd-patterns-expert rozwiazal pozorny spor A/B: w kanonie TCC
      Confirm i Cancel sa stanami terminalnymi, wzajemnie wykluczajacymi sie
      bezwarunkowo, wiec B doprowadzone do konca i tak wymusza to samo
      zobowiazanie co A dla wpisow, ktore zostaly potwierdzone. Oficjalne
      brzmienie zasady (do dokumentacji, D2/D4): "Stos zostaje uzbrojony dla
      pozniejszego hooka WYLACZNIE gdy w tym przebiegu nic nieodwracalnego sie
      nie wydarzylo. W chwili wykonania operacji, ktorej nie da sie cofnac
      (confirm) - traktuj ten wpis (albo caly stos, przy konwencji
      jeden-zasob-na-stos z VF-042-Q3) jako zamkniety; nie licz na sciezke
      zewnetrznego hooka dla niego." Zachowuje przetestowane zachowanie dla
      czystych rezerwacji i daje regule w stylu "jesli X to zawsze Y" latwa do
      zastosowania przez agenta piszacego kod (postulat documentation-master),
      bez cofania niczego z VF-040.
  - id: VF-042-Q3
    ask: >-
      Czy zasada „jeden zasób na jeden przebieg" ma być tylko zaleceniem, czy
      twardym wymogiem? Wymóg jest czytelniejszy, ale zamyka drogę do obsługi
      wielu zasobów naraz bez dużej zmiany wersji.
    q: >-
      "Jeden zasób na stos" to kształt, w którym udokumentowana zasada jest
      trywialnie bezpieczna i pasuje do każdego znanego użycia produkcyjnego.
      Panel rekomenduje zapisać to jako wskazówkę, nie twardy kontrakt (D4) —
      zostawiając przypadek wielozasobowy otwarty na przyszłość, o ile pojawi
      się dowód potrzeby. Alternatywa: ogłosić to twardym kontraktem (np. osobna
      fabryka wymuszająca jeden wpis) — czytelniejsze do rozumowania, ale zamyka
      drogę do obsługi wielu zasobów poniżej zmiany MAJOR, a strażnik API ocenił
      taką fabrykę jako mylącą (sugerowałaby, że domyślna konstrukcja NIE jest
      single-use, co jest fałszywe).
    answer: >-
      Zalecenie, nie wymog - jednoglosnie potwierdzone (5/5). Korekta
      uzasadnienia w VF-042-D4 wskazana przez ddd-patterns-expert: to NIE jest
      wlasnosc kanonu TCC (kanoniczny TCC/2PC nie jest wzorcem per-resource -
      koordynacja wielu uczestnikow pod jednym coordinatorem to sens jego
      istnienia). Ograniczenie do jednego zasobu wynika z wlasnych, juz
      zadeklarowanych non-goals TEGO prymitywu (brak trwalosci, brak retry per
      uczestnik, brak sledzenia czesciowego niepowodzenia) - nie z definicji
      wzorca. Dokumentacja ma mowic "wielozasobowa koordynacja wymaga trwalosci
      i retry, ktorych ten prymityw celowo nie ma", nie "TCC jest z natury
      per-resource" - zeby nikt kiedys nie powolal sie na falszywy autorytet
      kanonu przeciwko slusznemu przyszlemu rozszerzeniu.
  - id: VF-042-Q4
    ask: >-
      Jaki konkretny dowód potrzeby miałby otworzyć temat rozszerzenia w
      przyszłości — ile realnych zastosowań u konsumentów albo jaki
      udokumentowany incydent? Ustalenie progu teraz oszczędza powtórzenia tej
      samej dyskusji.
    q: >-
      Rozszerzenie o uchwyt potwierdzenia (Q3 z taska) jest odroczone, nie
      odrzucone na stałe — jego kształt jest zapisany z góry w D5 jako MINOR.
      Brakuje ustalonego progu dowodowego, który by je odblokował — np. N
      niezależnych miejsc u konsumentów trzymających ≥2 zasoby na jednym stosie,
      albo udokumentowany incydent spowodowany konfirmacją poza kolejnością. Bez
      uzgodnionego progu temat wróci jako opinia, nie jako dowód.
    answer: >-
      Prog: realny, zgloszony incydent produkcyjny LUB co najmniej 2 niezalezne
      miejsca u konsumentow (rozne zespoly/konteksty, nie dwa handlery tego
      samego stylu kodowania) trzymajace 2+ zasoby na jednym stosie albo
      cierpiace na potwierdzenie poza kolejnoscia - nigdy hipoteza. Dodatkowy
      warunek (quality-verifier): projekt API musi byc pokrywalny testem tak
      mocnym jak dzisiejszy (tozsamosc referencyjna, kolejnosc, brak race'ow) -
      inaczej przyszle API odziedziczy ten sam problem "splice podczas unwind",
      ktory dzis odrzucil panel. WAZNE zawezenie zakresu VF-042-D5
      (ddd-patterns-expert): jesli powodem jest potrzeba trwalosci/niezaleznego
      retry per uczestnika (prawdziwa koordynacja wielozasobowa) - to NIE
      odblokowuje D5, ktory jest i pozostaje ograniczony wylacznie do przypadku
      pojedynczego zasobu z potwierdzeniem poza kolejnoscia. Kanoniczna
      odpowiedz na wielozasobowa koordynacje to osobny, trwaly prymityw
      sag/process manager (zgodne z juz przyjeta w tym repo preferencja:
      dedykowane biblioteki, nie ten pakiet), nie rozszerzenie
      CompensationStack.
  - id: VF-042-Q5
    ask: >-
      Automatyczna kontrola zmian w publicznym interfejsie działa tylko w
      mniejszości pakietów. Czy to świadoma decyzja, czy zaległość, którą warto
      zaplanować jako osobne zadanie?
    q: >-
      Niższy priorytet, osobne od reszty VF-042. Zweryfikowane w trakcie
      syntezy: tylko 5 z 19 pakietów w monorepo ma skonfigurowany raport
      powierzchni API (`contracts`, `value-objects`, `events`, `nestjs`,
      `enterprise`); pakiet `resilience` nie jest wśród nich. To nie jest
      pojedyncze przeoczenie w jednym pakiecie, tylko stan domyślny większości
      monorepo — polityka do ustalenia, nie bug do łatania w ramach zakresu tego
      taska. Konsekwencja praktyczna: żadna zmiana powierzchni publicznej w
      `resilience` (w tym poprawka D2) nie jest dziś łapana automatycznie przy
      merge.
    answer: >-
      Zaleglosc, nie swiadoma polityka - jednoglosnie potwierdzone.
      library-expert dorzucil kluczowy fakt: pakiety fundamentalne (aggregates,
      domain-primitives) TEZ nie maja api-extractor.json - to nie selektywne
      pominiecie resilience, tylko niedokonczony rollout w 14/19 pakietow
      monorepo (slad po VF-037). Nie blokuje VF-042. Rekomendacja: osobny task
      niskiego priorytetu obejmujacy caly monorepo (ustalenie polityki pokrycia,
      np. wedlug liczby wewnetrznych konsumentow pakietu), nie punktowa lata dla
      resilience.

decisions:
  - id: VF-042-D1
    topic: 'framing question — API czy udokumentowana zasada'
    choice: >-
      Documented invariant, NOT public API. No `invalidate(value)` (or any
      equivalent) ships in this task. The consumer's proposed shape is rejected
      permanently, not merely deferred: it splits acquire and undo into two
      separate call sites, it identifies an entry by its value (undefined for
      handle-less resources, ambiguous for equal values), and it reports failure
      as a silent boolean.
    means: >-
      Nie dokładamy nowej funkcji do biblioteki — zgłoszony przypadek zamykamy
      opisaną zasadą użycia, którą konsument stosuje sam. Rozwiązanie
      zaproponowane przez konsumenta odrzucamy na stałe, bo odtwarza dokładnie
      ten błąd, który ten mechanizm miał wyeliminować.
    rationale: >-
      Two independent lines of argument converge. (1) Demand: both scenarios in
      which any invalidation API pays for itself — two or more resources on one
      stack, or out-of-order confirmation — occur in no available production
      code. (2) Shape: the split acquire/undo pattern is exactly what broke 2 of
      10 hand-written handlers before VF-040, so shipping it would re-introduce
      the defect class the primitive exists to remove. Cost asymmetry decides
      the tie: a published public name cannot be withdrawn below a MAJOR bump,
      while a documentation gap is closable in a PATCH.

  - id: VF-042-D2
    topic: 'candidate scope item 1 — mutowalna tablica błędów'
    choice: >-
      Ship candidate scope item 1 as a PATCH: freeze the failure array before it
      is returned from the unwind routine, preserving reference identity. Land
      it in its own commit, independent of the outcome of D1, with one CHANGELOG
      sentence describing the runtime behaviour change.
    means: >-
      Wynik zwracany przez mechanizm kompensacji staje się faktycznie
      niemodyfikowalny, zgodnie z tym, co obiecuje jego opis. To poprawka
      porządkowa wydawana niezależnie od głównego rozstrzygnięcia; odnotowujemy
      ją w opisie wydania, bo teoretycznie może dotknąć kogoś, kto do tej pory
      łamał deklarowaną zasadę.
    rationale: >-
      The array is currently handed out as a shared mutable structure, which
      violates the "no mutable export without readonly enforced at runtime"
      rule; the declared type already says readonly, so the runtime was simply
      not backing the contract. Freezing keeps the same object reference, so the
      existing identity assertion in `compensation-stack.test.ts:193` (`toBe`)
      stays green, and a caller who casts the readonly away now gets a no-op or
      a TypeError instead of silent corruption. Semver classification is PATCH —
      the declared type is unchanged and only already-type-violating code is
      affected — but that code exists in principle, hence the CHANGELOG note.

  - id: VF-042-D3
    topic: 'candidate scope item 2 — brak timeoutu na throw-path unwind'
    choice: >-
      Addressed by one documentation sentence directing the reader to the
      existing timeout strategy for wrapping individual compensation callbacks.
      No new parameter, no option object change.
    means: >-
      Ostrzegamy w dokumentacji, że pojedyncza operacja wycofująca może się
      zawiesić i że biblioteka ma już gotowy mechanizm limitu czasu do owinięcia
      takiej operacji. Nie dokładamy własnego limitu, bo w tej ścieżce nie ma
      jak zaraportować jego przekroczenia bez zmiany zachowania, na którym
      polegają obecni użytkownicy.
    rationale: >-
      The risk is real rather than theoretical — the failure mode is a
      correlated cascade, where the same external system whose outage triggers
      the compensation wave is also the one likely to hang the compensations
      themselves, and neither Node request timeouts (they cover only the
      request-accept phase, not handler processing time) nor a gateway timeout
      free a suspended promise inside the process. But a built-in timeout cannot
      be reported: on the throw path the original error propagates untouched by
      design ("unconditional failure shape"), leaving nowhere to surface a
      compensation timeout without changing that contract. Composition with the
      existing `TimeoutStrategy` gives the caller the protection and keeps the
      failure shape intact.

  - id: VF-042-D4
    topic: 'wymuszanie vs. dokumentowanie "jeden zasób na stos"'
    choice: >-
      The invariant is documented only — it is not mechanically enforced. No new
      factory (e.g. a "single use" variant) and no runtime restriction to one
      entry per stack. Zero new exported symbols in this task. Exact wording
      depends on VF-042-Q2 (rule variant A vs B).
    means: >-
      Zasadę zapisujemy w dokumentacji, a nie wymuszamy w kodzie — dodatkowy
      wariant tworzenia sugerowałby fałszywie, że domyślny działa inaczej.
      Ostateczne brzmienie zasady zależy od rozstrzygnięcia pytania o oficjalny
      wariant.
    rationale: >-
      A dedicated factory name would actively mislead: it implies the default
      factory produces something that is not single-use, which is false — the
      JSDoc already states every instance is single-use (single-use is a
      structural property of the promise-latch, not a construction choice).
      Enforcing one entry per stack would also foreclose the multi-resource case
      that the panel could not rule out for the future, trading a documentation
      gap for a MAJOR-level restriction. CORRECTION (advisory panel,
      ddd-patterns-expert): the earlier framing that "one resource per stack
      matches canonical TCC" is wrong and must not appear in the shipped
      documentation — canonical TCC/2PC is not inherently per-resource;
      coordinating multiple participants under one coordinator is the reason the
      pattern exists. The one-resource limit is a consequence of this
      primitive's own already-declared non-goals (no persistence, no
      per-participant retry, no partial-failure tracking), not of the pattern's
      definition. Ship the documentation phrased as "the multi-resource case
      needs persistence and retry this primitive deliberately does not have,"
      never as "TCC is inherently per-resource" — so no future reader cites
      false canonical authority against a legitimate future extension.

  - id: VF-042-D5
    topic: 'kształt przyszłego API (Q3 z taska), jeśli kiedyś odblokowany'
    choice: >-
      Pre-register the only defensible shape, should evidence of need ever
      arrive: a sibling acquire-style method (working name `acquireWithHandle`)
      returning an opaque `CompensationHandle<TValue>` exposing `value` and
      `confirm(): void` closed over that specific entry — never value-based
      lookup, never a change to the return type of the existing `acquire`.
      `confirm()` marks a flag on the entry; it must never splice. Any future
      method that mutates the entry list must perform a synchronous
      in-flight-unwind check (`unwindPromise !== undefined`) and throw before
      any mutation and before any await. `confirm()` throws synchronously when
      the stack is latched or unwinding — never a silent boolean or no-op.
      Exported as a named type alongside the existing exports in the same file.
      Classification if ever shipped: MINOR. SCOPE CORRECTION (advisory panel,
      ddd-patterns-expert): this shape answers ONLY the single-resource,
      out-of-order-confirmation case. It is explicitly NOT a gateway to
      multi-resource coordination — a stack holding several independently
      confirmable resources needs persistence and per-participant retry that
      this primitive permanently does not have (VF-040 OQ-1, D-13). If the
      evidence that ever arrives (VF-042-Q4) is multi-resource coordination
      rather than a single out-of-order confirm, the correct answer is a
      separate, durable saga/process-manager primitive outside this package —
      not an extension of `CompensationStack`, and not this handle shape
      stretched to cover it.
    means: >-
      Zapisujemy z góry jedyny dopuszczalny kształt ewentualnego przyszłego
      rozszerzenia, żeby dyskusja nie zaczynała się od zera i nie skończyła
      gorszym wariantem. Świadomie nie korzystamy z okna, w którym zmiana byłaby
      dziś darmowa, bo wybrany kształt jest bezpieczny niezależnie od terminu.
    rationale: >-
      Manual tracing showed splice during an in-flight unwind causes a DOUBLE
      compensate call on the shifted entry — strictly worse than skipping one; a
      flag keeps the list length and order stable so the index loop cannot
      desynchronise, at negligible performance cost. The synchronous guard is
      required because the real hazard is mutation while the unwind loop is
      suspended on an await; two concurrent `unwind()` calls are already safe
      today thanks to JS run-to-completion on the check-then-set in `unwind()`
      itself. Verified fact (orchestrator, `npm pack
      @vytches/ddd-resilience@0.31.0`): `CompensationStack` is absent from the
      published package — the VF-040 minor bump has not been released — so
      reshaping the existing `acquire`'s return type would today be technically
      free. The panel deliberately does NOT exploit that window: by the time
      evidence of need plausibly arrives, the primitive will almost certainly
      already be published, and the sibling-method shape is the one that
      survives either timeline without a deprecation cycle.

  - id: VF-042-D6
    topic: 'korekta rejestru — eksport klasy z prywatnym konstruktorem'
    choice: >-
      Registry correction: `CompensationStack`'s private constructor plus static
      factory (`create()`) is opaque-handle-via-controlled-construction, not a
      bare exported concrete class. VF-040 must NOT be cited as precedent for
      "exporting plain classes is fine" in future public-API decisions.
    means: >-
      Prostujemy zapis w rejestrze: wcześniejsza decyzja nie była odstępstwem od
      zasad projektowania interfejsów. Dzięki temu nikt nie powoła się na nią w
      przyszłości jako na zgodę na luźniejsze podejście.
    rationale: >-
      An earlier framing (carried into this panel from the VF-040 record)
      treated the export as a straightforward violation of the
      interface-plus-factory rule (PA5); it is closer to the spirit of that rule
      than to its breach, since consumers cannot construct or subclass it
      directly and the concrete type is effectively opaque behind `static
      create()`. Left uncorrected, the mistaken reading becomes a durable
      licence for genuinely bare class exports elsewhere in the monorepo.

  - id: VF-042-D7
    topic:
      'znaleziona przy okazji, wcześniej istniejąca luka (nie naprawiana tu)'
    choice: >-
      Explicit scope exclusion, recorded not fixed: calling `acquire()` while an
      `unwind()` is already in flight silently never receives compensation in
      that run, because `runUnwind`'s loop counts down from the entry count
      captured when the unwind started. Pre-existing behaviour of VF-040,
      untouched by this task. AMENDED (advisory panel, quality-verifier): still
      not fixed, but a regression test IS added in this task — deferred first
      compensation via a controllable promise, `acquire()` a new entry while
      that unwind is in flight, assert the new entry is never compensated in
      that run. Comment the test explicitly as `// KNOWN GAP, tracked in VF-042`
      — not `.skip()` — so the gap has a standing, executable witness instead of
      only a prose record that can silently rot or be "fixed" into a different
      bug unnoticed.
    means: >-
      Odnotowujemy znaną, wcześniej istniejącą lukę w rzadkim scenariuszu i
      dopisujemy do niej jeden test, który ją demonstruje — bez naprawiania
      samego zachowania. Zapis służy temu, żeby w przyszłości nie została wzięta
      za nowy błąd wprowadzony przez to zadanie, a test pilnuje, żeby nikt
      przypadkiem nie pogorszył sytuacji bez zauważenia.
    rationale: >-
      It is a genuine silent-failure path and belongs in the record so a future
      reader does not rediscover it as a regression introduced here, but fixing
      it would require a semantics decision of its own (e.g. should late
      `acquire()` during an in-flight unwind reject, queue, or start a second
      unwind run?) that is orthogonal to the framing question and out of
      proportion for this task's diff. A prose-only record is exactly the
      failure mode this package exists to eliminate — silent because nothing
      signals it — so the panel's quality-verifier recommended pairing the
      record with an executable regression test instead of relying on
      documentation alone.

  - id: VF-042-D8
    topic: 'obserwacja procesowa — pokrycie api-extractor w monorepo'
    choice: >-
      The absence of automated public-surface checking for the resilience
      package is raised as a separate, lower-priority process observation (see
      VF-042-Q5). It does not block this task, and the freeze change (D2) ships
      without it.
    means: >-
      Zgłaszamy osobno, że automatyczna kontrola publicznego interfejsu obejmuje
      tylko mniejszość pakietów, więc zmiany w pozostałych nie są wychwytywane
      przy scalaniu. To obserwacja procesowa niższego priorytetu i nie
      wstrzymuje tego zadania.
    rationale: >-
      Verified during synthesis: only 5 of 19 packages (`contracts`,
      `value-objects`, `events`, `nestjs`, `enterprise`) carry the api-extractor
      surface-report configuration, so this is the repository's default state
      rather than an omission specific to one package — which makes it a policy
      question for the owner (VF-042-Q5), not a bug to patch inside a scoped
      task. The practical consequence stands regardless: no public-surface
      change in `resilience`, including D2's freeze, is caught automatically at
      merge.

patterns:
  - cross-layer/conventions-pattern.md # always
  - typescript-library/public-api-pattern.md # always
  - typescript-library/package-boundary-pattern.md # always
  - typescript-library/backward-compatibility-pattern.md # trigger: "major"/"version" (linia 162, "a name that can never be corrected without a major version") — trafienie realne, task jest wprost o zamrażaniu nazwy publicznej

rag: >-
  skipped (brak knowledge.collection w runtime.yml/project.yml; project.yml nie
  istnieje w tym repo; MCP claude-patterns nie połączył się w tej sesji —
  potraktowane jako awaria połączenia, nie jako dowód braku możliwości).
  Fallback: statyczna lista patterns.always/triggers z runtime.yml (powyżej).

units: []
---

# Analiza: VF-042-stale-compensation-invalidation

## Synteza (tech-lead)

Zgłoszony przez konsumenta problem zamykamy opisaną zasadą użycia, a nie nową
funkcją w bibliotece — bo konkretny kształt, który zaproponował, odtwarzałby
dokładnie ten błąd, który ten mechanizm miał usunąć, a sytuacje, w których
jakiekolwiek rozszerzenie by się opłaciło, nie występują dziś w żadnym dostępnym
kodzie produkcyjnym.

Przy okazji wydajemy jedną drobną poprawkę porządkową (wynik operacji staje się
faktycznie niemodyfikowalny, zgodnie z tym, co obiecuje jego opis) oraz
dopisujemy jedno zdanie ostrzeżenia o tym, że operacja wycofująca może się
zawiesić i jak się przed tym zabezpieczyć gotowym mechanizmem. Kształt
ewentualnego przyszłego rozszerzenia zapisujemy z góry, żeby przyszła dyskusja
nie zaczęła się od zera.

## Otwarte pytania — ZAMKNIĘTE (odpowiedzi w frontmatter `answer:`)

Wszystkie pięć rozstrzygnięte 2026-08-31 przez właściciela biblioteki, po
konsultacji panelu doradczego (library-api-guardian, library-quality-verifier,
library-expert, documentation-master, ddd-patterns-expert).

- **VF-042-Q1**: TAK — zamknięcie samą zasadą dokumentacyjną, pod warunkiem D2
  (PATCH) i czterech konkretnych artefaktów dokumentacyjnych (nie sama proza
  JSDoc) — patrz `answer:` w frontmatter.
- **VF-042-Q2**: Wariant **B**, sformułowany jako lokalna reguła "jeśli
  wydarzyło się coś nieodwracalne — traktuj wpis jako zamknięty". Zachowuje już
  przetestowaną gwarancję z VF-040, rozstrzyga pozorny spór A/B
  (ddd-patterns-expert).
- **VF-042-Q3**: Zalecenie, nie wymóg — z poprawionym uzasadnieniem w D4 (to nie
  własność kanonu TCC, tylko konsekwencja już zadeklarowanych non-goals tego
  prymitywu).
- **VF-042-Q4**: Realny incydent lub ≥2 niezależne miejsca u konsumentów, z
  projektem pokrywalnym testem tak mocnym jak dzisiejszy. Jeśli powodem jest
  potrzeba trwałości — to osobny temat (saga), nie rozszerzenie D5.
- **VF-042-Q5**: Zaległość (14/19 pakietów, w tym fundamentalne, też jej nie
  mają), nie polityka — osobny task niskiego priorytetu, nie blokuje VF-042.

## Decyzje (zatwierdzone)

- **VF-042-D1**: Brak nowego publicznego API — zasada dokumentacyjna zamiast
  metody `invalidate`.
- **VF-042-D2**: Zamrożenie tablicy błędów kompensacji — PATCH, osobny commit.
- **VF-042-D3**: Brak timeoutu na ścieżce throw — jedno zdanie dokumentacji, nie
  nowy parametr.
- **VF-042-D4**: „Jeden zasób na stos" pozostaje zaleceniem, nie jest wymuszone
  kodem. Uzasadnienie skorygowane: to ograniczenie tego prymitywu, nie własność
  kanonu TCC.
- **VF-042-D5**: Gotowy szkic przyszłego API (uchwyt potwierdzenia), ściśle
  ograniczony do przypadku pojedynczego zasobu z potwierdzeniem poza kolejnością
  — NIE furtka do koordynacji wielozasobowej.
- **VF-042-D6**: Korekta rejestru — eksport klasy z prywatnym konstruktorem nie
  jest naruszeniem zasady interfejs+fabryka.
- **VF-042-D7**: Znaleziona przy okazji, wcześniej istniejąca luka (acquire w
  trakcie trwającego unwindu) — odnotowana, NIE naprawiana, ale dostaje jeden
  test regresyjny oznaczony jako znana luka.
- **VF-042-D8**: Obserwacja procesowa o pokryciu automatycznej kontroli API w
  monorepo — osobne, niższy priorytet.

## Ryzyka / uwagi

Główne ryzyko zostało zamknięte wyborem wariantu B w Q2 — reguła zamykająca lukę
z sekcji Why jest teraz jednoznaczna i zgodna z już przetestowanym zachowaniem,
więc dokumentacja może powstać w ostatecznym brzmieniu bez dalszych
rozstrzygnięć.

Drugie ryzyko pozostaje otwarte świadomie: konsument prosił o konkretny
mechanizm i dostanie odpowiedź w postaci wskazówki. Próg z Q4 jest teraz
zapisany, więc powrót tematu będzie oceniany wobec konkretnego kryterium, nie od
zera. Osobno odnotowujemy lukę procesową z Q5 (pokrycie `api-extractor`) — nie
wstrzymuje tego zadania, zaplanowana jako osobny task.

---

> **ZATWIERDZONE 2026-08-31.** Wszystkie odpowiedzi wypełnione,
> `status: approved`. Następny krok:
> `/orchestrate VF-042-stale-compensation-invalidation`.
