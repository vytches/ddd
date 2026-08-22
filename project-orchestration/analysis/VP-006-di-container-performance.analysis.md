---
task: VP-006-di-container-performance
status: approved
threat_model: null
patterns:
  - public-api-pattern
  - backward-compatibility-pattern
  - package-boundary-pattern
  - library-testing-pattern
  - build-publish-pattern
open_questions:
  - id: OQ-1
    question: >-
      Kryteria 2 (<5ms first-time resolve) i 5 (≤4MB metadata) zmierzono na
      konsumencie juz-ide-api działającym na NestJS. Sam SimpleContainer to
      Map.get + zero-arg `new ctor()`, bez reflection na hot-path. Czy
      przeskalować te kryteria na metryki mierzone w izolacji biblioteki (np.
      „narzut resolve biblioteki < X µs", „pamięć deskryptorów < Y KB / 1000
      usług"), a liczby NestJS śledzić osobno po stronie konsumenta?
    answer: >-
      TAK. Przeskalować kryteria 2 i 5 na SLO mierzone w izolacji biblioteki:
      narzut resolve biblioteki (µs/op na rozgrzanym SimpleContainerze) oraz
      pamięć deskryptorów (KB / 1000 usług). Liczby NestJS (cold start, 15–25ms,
      8–12MB) przestają być kryteriami biblioteki — śledzone osobno po stronie
      konsumenta/adaptera. To kontrakt mierzalny i niezależny od frameworka.
  - id: OQ-2
    question: >-
      Realny wolny path first-time resolve to NestJSContainerAdapter
      (packages/nestjs): `resolve()` zawsze najpierw woła `moduleRef.get(token,
      {strict:false})` (throw+catch na hot-path), a `createInstance()` robi
      `Reflect.getMetadata('design:paramtypes')` + rekurencyjny resolve per
      param. Czy optymalizacja adaptera NestJS jest w zakresie VP-006, czy to
      osobne zadanie (np. VP-006b) w pakiecie @vytches/nestjs?
    answer: >-
      POZA ZAKRESEM VP-006. Optymalizacja NestJSContainerAdapter (sprawdzanie
      własnego rejestru przed moduleRef.get; eliminacja throw+catch na hot-path;
      przeniesienie Reflect.getMetadata('design:paramtypes') z resolve na czas
      rejestracji i cache gotowej fabryki; przegląd duplikacji deskryptorów w
      createScope) zostaje wydzielona jako osobny task VP-006b w
      @vytches/nestjs. Powód: leży w pakiecie nestjs, nie ddd-di — trzymanie w
      VP-006 łamie package-boundary i wymaga osobnej oceny backward-compat
      adaptera.
  - id: OQ-3
    question: >-
      Optymalizacja pamięci „D" (Object.freeze / interning ServiceDescriptor)
      jest obserwowalna dla konsumentów (ServiceDescriptor jest eksportowany i
      zwracany przez getServices()/getServicesByTag()) i NIE jest łapana przez
      snapshot API. Czy w ogóle wchodzimy w zmianę runtime-zachowania
      deskryptora w VP-006 (wymaga audytu juz-ide-api pod mutacje deskryptorów +
      świadomej decyzji semver), czy ograniczamy się do bezpiecznych zysków
      pamięci, które nie zmieniają semantyki deskryptora?
    answer: >-
      NIE wchodzimy w freeze/intern w VP-006. ServiceDescriptor pozostaje
      mutowalny i o niezmienionej tożsamości. Realizujemy tylko bezpieczne zyski
      pamięci nie zmieniające semantyki: usunięcie podwójnej retencji instancji
      (services.instance + singletonInstances) w SimpleContainerze. Duplikacja
      deskryptorów w createScope to adapter NestJS → VP-006b. Powód: freeze jest
      obserwowalny (Object.isFrozen, TypeError w strict ESM), interning zmienia
      ===, a snapshot API tego nie łapie — zbyt duże ryzyko cichej regresji u
      konsumenta wobec mizernego zysku.
  - id: OQ-4
    question: >-
      Test regresji cold-start/resolve nie istnieje: pakiet @vytches/benchmarks
      ma `suites/` puste i NIE zależy od @vytches/ddd-di. Gdzie umieścić bench
      (proposal: packages/di/benchmarks z vitest/bench, dev-only, wykluczony z
      published package), i jaką metrykę zablokować, by była sensowna w izolacji
      biblioteki (nie mierzyła NestJS)?
    answer: >-
      packages/di/benchmarks z importem vitest/bench, dev-only, wykluczony z
      published package przez pole `files`. NIE jednorazowy test „zamykający" —
      stała bramka regresji w CI z baseline.json. Metryki blokowane: narzut
      resolve biblioteki (µs/op, rozgrzany kontener, singleton + transient) oraz
      pamięć deskryptorów (KB / 1000 zarejestrowanych usług). Zero zależności od
      @vytches/nestjs — bench mierzy wyłącznie SimpleContainer/ServiceLocator.
  - id: OQ-5
    question: >-
      Czy kryteria 2 i 5 pozostają blokujące dla v0.26, czy degradujemy je do
      „best-effort / measure-and-document", skoro są w dużej mierze po stronie
      konsumenta/NestJS, a nie biblioteki?
    answer: >-
      Degradujemy kryteria 2 i 5 (w starym brzmieniu NestJS) z blokujących do
      „best-effort / measure-and-document" — NIE są blokerami v0.26. Blokujące
      dla v0.26 stają się nowe SLO biblioteki (z OQ-1) zablokowane benchem
      (OQ-4). Realny zysk po stronie konsumenta dostarcza VP-006b (adapter
      NestJS).
  - id: OQ-6
    question: >-
      `getTokenKey` dla anonimowej klasy używa `token.toString()` jako klucza
      Map — zapisuje cały kod źródłowy klasy jako klucz (footgun pamięci i
      kolizji). Czy poprawa tego (correctness + pamięć) wchodzi w zakres VP-006,
      czy zgłaszamy jako osobny defekt?
    answer: >-
      W ZAKRESIE VP-006 (ddd-di, wewnętrzne). Naprawiamy getTokenKey dla klas
      anonimowych — obecne `token.toString()` (cały kod klasy jako klucz Map) to
      bug pamięci i ryzyko kolizji. Uwaga implementacyjna: to zmiana zachowania
      dla edge-case'u klas anonimowych (zmiana klucza identyfikującego), nie
      łapana przez snapshot API — pokryć testem kontraktowym i odnotować w
      CHANGELOG (patch). Połączyć z memoizacją getTokenKey (D-2/B).
decisions:
  - id: D-1
    decision: >-
      Przeskalować acceptance criteria 2 i 5 na metryki mierzone w izolacji
      biblioteki; liczby NestJS (cold start 2.5–4s, 15–25ms, 8–12MB) śledzić
      osobno w konsumencie.
    rationale: >-
      SimpleContainer nie robi reflection ani autowiringu — to czyste Map.get +
      new ctor(). Zgłoszone metryki mieszają narzut frameworka NestJS
      (reflect-metadata, moduleRef.get, JIT warmup) z narzutem biblioteki.
      Kryterium liczbowe oparte o NestJS jest dla biblioteki niemierzalne i
      nieosiągalne wewnętrznie.
    status: accepted
  - id: D-2
    decision: >-
      Przyjąć bezpieczne optymalizacje wewnętrzne: B (memoizacja getTokenKey) i
      C (Set zamiast tablicy `resolutionChain` do detekcji cykli, z symetrycznym
      czyszczeniem w `finally`).
    rationale: >-
      Oba czysto wewnętrzne (prywatne pola/metody), patch-level, nie dotykają
      zablokowanego public API. C wymaga zachowania kolejności DFS w komunikacie
      CircularDependencyError (delete w finally lustrzane do obecnego pop).
    status: accepted
  - id: D-3
    decision: >-
      Zaimplementować A (eliminacja podwójnego lookupu isRegistered+resolve w
      ServiceLocator.resolve) przez wewnętrzny SimpleContainer.tryResolve(): T |
      undefined, zachowując DOKŁADNIE obecny typ i komunikat
      ServiceNotFoundError oraz semantykę fallbacku context→global.
    rationale: >-
      Eliminuje podwójne przejście mapy i łańcucha parent-scope. Pitfalle: (1)
      obecny komunikat błędu jest specyficzny (token + 'Service not registered
      in any container' jako pole context) — musi zostać 1:1; (2) łapać
      WYŁĄCZNIE ServiceNotFoundError, nie CircularDependencyError, by nie
      maskować realnych cykli. Patch-level jeśli zachowanie identyczne.
    status: accepted
  - id: D-4
    decision: >-
      NIE wdrażać D (freeze/intern ServiceDescriptor) w VP-006. Realizować tylko
      zyski pamięci nie zmieniające semantyki deskryptora: usunięcie podwójnej
      retencji instancji (services.instance + singletonInstances) w
      SimpleContainerze. Duplikacja deskryptorów w
      NestJSContainerAdapter.createScope() przeniesiona do VP-006b.
    rationale: >-
      ServiceDescriptor jest eksportowany i zwracany przez getServices(); freeze
      jest obserwowalny (Object.isFrozen, mutacje rzucają TypeError w strict
      ESM), a interning zmienia tożsamość obiektów (===). Snapshot API tego NIE
      łapie → cicha regresja u konsumenta. Freeze tylko jako osobne zadanie z
      audytem juz-ide-api i świadomym semver (min. minor).
    status: accepted
  - id: D-5
    decision: >-
      Dodać test regresji resolve/cold-start jako dev-only (import
      vitest/bench), mierzony w izolacji biblioteki, wykluczony z published
      package przez pole `files`. Proposal lokalizacji: packages/di/benchmarks z
      osobnym vitest.bench.config, uruchamiany na żądanie (nie w zwykłym CI test
      run).
    rationale: >-
      Ograniczenie dependency-free dotyczy zależności runtime; devDependency nie
      trafia do konsumenta. Vitest już dostarcza bench() — zero nowych
      zależności. @vytches/benchmarks dziś nie zależy od ddd-di, więc albo dodać
      tam dep, albo lokalny bench w pakiecie di (preferowane: bliżej kodu,
      łatwiejszy guard).
    status: accepted
  - id: D-6
    decision: >-
      Potraktować optymalizację NestJSContainerAdapter (kolejność: własny
      rejestr PRZED moduleRef.get; uniknięcie throw+catch na hot-path; cache
      paramtypes) jako najwyższą dźwignię dla cold-start/resolve, ale wydzielić
      ją jawnie — sibling-zadanie VP-006b w @vytches/nestjs (UTWORZONE:
      project-orchestration/tasks/VP-006b-nestjs-adapter-performance.md).
    rationale: >-
      To realne źródło 15–25ms first-time, ale leży w pakiecie nestjs, nie
      ddd-di. Trzymanie tego w VP-006 rozmywa zakres i miesza granice pakietów
      (package-boundary-pattern). Wymaga własnej oceny backward-compat adaptera.
    status: accepted
units:
  - id: U-1
    title:
      'SimpleContainer.tryResolve() + ServiceLocator bez podwójnego lookupu (A)'
    layer: di
    blocked_by: [OQ-3, D-3]
  - id: U-2
    title: 'Memoizacja getTokenKey (B)'
    layer: di
  - id: U-3
    title: 'Set dla detekcji cykli z symetrycznym finally (C)'
    layer: di
  - id: U-4
    title:
      'Eliminacja podwójnej retencji instancji w SimpleContainer (część D-4)'
    layer: di
  - id: U-5
    title:
      'Dev-only bench resolve/cold-start (vitest/bench), excluded from publish
      (E)'
    layer: benchmarks
    blocked_by: [OQ-4]
---

# VP-006 — DI Container Performance: Analiza (STOP1)

> Synteza panelu advisory (perf-architecture + mapa kodu DI + backward-compat
> guardian). **Zero implementacji.** Artefakt do dyskusji — odpowiedz na otwarte
> pytania (frontmatter `open_questions[].answer`), zweryfikuj decyzje, ustaw
> `status: approved`, dopiero potem
> `/orchestrate-ddd VP-006-di-container-performance`.

## Kontekst

VP-006 dostarczyło już część (2026-05-09, commit `0749bb72`): single-pass
reflection w `auto-discovery.service.ts` (1 skan `Reflect.getMetadataKeys`
zamiast 5 wywołań `getMetadata` na providera) + memoizacja `WeakSet`
processedTargets dla wielokontekstowego discovery. Kryteria 3 i 4 = DONE.

Pozostają otwarte kryteria **2** (resolve <5ms first-time) i **5** (metadata
≤4MB) oraz brak testu regresji cold-start.

## Najważniejsze ustalenie panelu — niezgodność zakresu metryk

Zgłoszone liczby (cold start 2.5–4s, resolve 15–25ms, 8–12MB) **zmierzono na
konsumencie `juz-ide-api` (NestJS, 200+ handlerów, 10+ kontekstów)** i mieszają
narzut frameworka z narzutem biblioteki:

- **`SimpleContainer` (czysty, framework-agnostyczny)** — hot-path to
  `services.get(key)` (Map) → cache singletonów →
  `new descriptor.implementation()` z **zerową liczbą argumentów, bez
  reflection, bez budowy grafu zależności**. Ten path jest z natury szybki; to
  **nie** jest źródło 15–25ms.
- **`NestJSContainerAdapter` (packages/nestjs) — realny wolny path:**
  `resolve()` ZAWSZE najpierw woła `moduleRef.get(token, {strict:false})`, a
  przy chybieniu NestJS **rzuca**, co jest łapane try/catch (throw+catch na
  hot-path dla każdej wewnętrznie zarejestrowanej usługi). `createInstance()`
  robi `Reflect.getMetadata('design:paramtypes')` + **rekurencyjny resolve per
  parametr konstruktora** — to faktyczne przejście grafu, koszt kumuluje się z
  głębokością.
- **`ServiceLocator.resolve`** robi **podwójne przejście**:
  `isRegistered(token)` a potem `resolve(token)` (każde idzie po mapie i
  łańcuchu parent-scope) — w gałęzi context i global.

Wniosek: liczbowe kryteria oparte o NestJS są dla biblioteki w dużej mierze
niemierzalne i nieosiągalne wewnętrznie. Stąd OQ-1/OQ-2/OQ-5 i D-1/D-6.

## Co biblioteka realnie może (bezpiecznie) zrobić

Tabela werdyktu backward-compat (api-surface snapshot łapie tylko **nazwy**
eksportów — `Object.keys(api).sort()` — NIE kształt typów ani zachowanie
runtime):

| Zmiana                                                                    | Public surface?   | Semver     | Ryzyko      | Werdykt                                                                       |
| ------------------------------------------------------------------------- | ----------------- | ---------- | ----------- | ----------------------------------------------------------------------------- |
| A — kolaps `isRegistered`+`resolve` w ServiceLocator (przez `tryResolve`) | nie               | patch      | średnie     | warunkowo OK (zachować typ+komunikat błędu; łapać tylko ServiceNotFoundError) |
| B — memoizacja `getTokenKey`                                              | nie               | patch      | niskie      | OK                                                                            |
| C — `Set` dla detekcji cykli                                              | nie               | patch      | niskie      | OK (symetryczne czyszczenie w `finally`)                                      |
| D — freeze/intern `ServiceDescriptor`                                     | **tak (runtime)** | min. minor | **wysokie** | NIE w VP-006 (cicha regresja, audyt konsumenta)                               |
| E — bench dev-only (`vitest/bench`)                                       | nie               | patch      | brak        | OK                                                                            |

## Pamięć (kryterium 5) — prawdopodobne źródła bloatu

`Map<string, ServiceDescriptor>` biblioteki jest lekka. Realni kandydaci do
8–12MB przy skali konsumenta:

1. **Podwójna retencja instancji** — singletony żyją w `services`
   (`descriptor.instance`) i w `singletonInstances` jednocześnie.
2. **`NestJSContainerAdapter.createScope()` kopiuje pełny zestaw deskryptorów
   singletonów do każdego scope'u** — per-request scoping mnoży wpisy Map +
   klucze stringowe.
3. **Wielkie klucze `toString()`** dla anonimowych klas (cały kod klasy jako
   klucz Map — patrz OQ-6).
4. `tags` trzymane przez referencję — **NIE** są źródłem bloatu.

Bezpieczne zyski (bez zmiany semantyki deskryptora): #1 i przegląd #2 — patrz
D-4.

## Otwarte pytania

Wymagają decyzji człowieka przed implementacją. Pełna lista i treść we
frontmatter (`open_questions[]`). Skrót:

- **OQ-1 / OQ-5** — przeskalować i/lub zdegradować kryteria 2 i 5 (NestJS vs
  biblioteka)? _(odpowiedź w frontmatter)_
- **OQ-2 / D-6** — czy optymalizacja `NestJSContainerAdapter` jest w zakresie
  VP-006, czy sibling VP-006b w @vytches/nestjs? _(odpowiedź w frontmatter)_
- **OQ-3 / D-4** — czy w ogóle dotykamy runtime-zachowania `ServiceDescriptor`
  (freeze/intern)? _(odpowiedź w frontmatter)_
- **OQ-4 / D-5** — gdzie i jak zbudować test regresji w izolacji biblioteki?
  _(odpowiedź w frontmatter)_
- **OQ-6** — czy poprawiamy footgun `getTokenKey` dla anonimowych klas tu, czy
  jako osobny defekt? _(odpowiedź w frontmatter)_

## Decyzje (proponowane)

Propozycje z uzasadnieniem we frontmatter (`decisions[]`). Skrót: **D-1**
przeskalować kryteria; **D-2** wdrożyć B+C; **D-3** wdrożyć A przez
`tryResolve`; **D-4** NIE wdrażać freeze/intern, tylko bezpieczne zyski pamięci;
**D-5** bench dev-only w izolacji; **D-6** wydzielić optymalizację adaptera
NestJS jako VP-006b.

## Ryzyka

- **Backward-compat (główne):** każda zmiana dotykająca komunikatu/typu błędu
  resolve, kształtu `ServiceDescriptor`, lub wyniku `getTokenKey` jest
  obserwowalna i **nie jest łapana** przez snapshot API → ryzyko cichej regresji
  u konsumenta (juz-ide-api, 237+ agregatów). Mitygacja: trzymać zmiany jako
  ściśle wewnętrzne (D-2/D-3), unikać D.
- **Granice pakietów:** mieszanie optymalizacji NestJS (packages/nestjs) z
  ddd-di rozmywa zakres i łamie package-boundary-pattern — stąd D-6.
- **Bezpieczeństwo:** brak — czysta optymalizacja wewnętrznej infrastruktury DI,
  bez auth/PII/cross-context/zmiany powierzchni publicznej. Threat model
  niewymagany (`threat_model: null`).
