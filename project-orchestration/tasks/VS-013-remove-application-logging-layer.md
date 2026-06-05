# Task: Usunięcie warstwy logowania aplikacyjnego z @vytches/ddd-logging

## Task Metadata

```yaml
task_id: VS-013 # renumerowane z VS-010 (kolizja z VS-010-datamasker-tojson-bypass)
title:
  'logging: remove application-logging layer — logger becomes internal-only
  library tool'
supersedes_extra:
  'VS-010(datamasker), VS-011, VS-012 — all cancelled as obsolete
  (DataMasker/@LogCommands deleted)'
type: refactor
priority: high
complexity: high
estimated_time: 1-2 days
created_by: agent (architektura, audyt 3-agentowy 2026-05-29)
created_at: 2026-05-29
status: in_progress
supersedes: VS-009 (cancelled)
memory_ref: feedback_logging_internal_only
target_version: 0.4.0
publish: deferred # nie publikujemy teraz — priorytet: biblioteka dalej działa (build+testy zielone)
port_logger_decision: remove # port Logger usunięty całkowicie, brak publicznego typu, brak injection
```

---

## Decyzja architektoniczna

Logger w @vytches/ddd ma być **wyłącznie wewnętrznym narzędziem biblioteki** do
logowania JEJ WŁASNYCH ważnych błędów/warningów (np. „no handler found",
misconfiguration). NIE jest produktem dla userów — oni używają własnych,
lepszych bibliotek (Pino itd.). Cała warstwa logowania aplikacyjnego znika.

Hard removal + major bump (bez deprecation cycle) — decyzja właściciela
2026-05-29.

## Wpływ na działające aplikacje (odpowiedź na pytanie właściciela)

- **Konsumpcja przez opublikowany npm:** działająca apka na obecnej wersji =
  ZERO wpływu (lockfile przypina wersję; usunięcie nie zmienia wstecz
  opublikowanych wersji). Niekompatybilność ujawnia się dopiero przy świadomej
  aktualizacji — jako błąd kompilacji TS (brak eksportu), nie cicho.
- **Konsumpcja przez workspace link / monorepo:** usunięcie łamie build
  konsumenta OD RAZU → wymaga synchronizacji. **DO POTWIERDZENIA** jak
  juz-ide-api konsumuje bibliotekę (niedostępny lokalnie).

## Decyzje Phase 0 (ROZSTRZYGNIĘTE 2026-05-29)

1. **Semver target:** `0.4.0` (decyzja właściciela). Bump `logging` ORAZ
   `enterprise`.
2. **Publikacja:** ODROCZONA — nie publikujemy teraz. Priorytet: biblioteka
   dalej się buduje i przechodzi testy (build + typecheck + vitest zielone).
   Blast radius konsumenta nieistotny na tym etapie (brak publikacji).
3. **Port `Logger`:** USUNĄĆ CAŁKOWICIE. Brak publicznego typu, brak injection
   od konsumenta. Biblioteka loguje sama do `console` przez wewnętrzny logger.
   31 pakietów przestaje importować `Logger` z ddd-logging — używają
   wewnętrznego loggera (lub po prostu console.warn/error w wąskich miejscach).

**Definicja sukcesu:** `pnpm build` + `tsc --noEmit` + `vitest` zielone w całym
monorepo. Żadnego publicznego eksportu loggera. Warstwa domenowa bez
infrastruktury.

---

## Wyniki audytu (3 agenty, 2026-05-29)

### A. Powierzchnia API (library-api-guardian)

**USUŃ z publicznego API (`packages/logging/src/index.ts`):**

- `integration/*` całość: `LogCommands`, `LogQueries`, `LogCQRS`,
  `LogStateChanges`, `LogDomainEvents`, `AggregateLoggingMixin`,
  `EnhancedLoggingMiddleware`, `createCQRSMiddleware`, `ResultLoggingExtensions`
  - typy (`CQRSLoggingOptions`, `CQRSMiddlewareOptions`, `ExecutionContext`,
    `ICQRSMiddleware`, `StateChangeLoggingOptions`, `ResultLoggingOptions`,
    `ResultLike`)
- Implementacja: `DefaultLogger`, `ConsoleProvider`, `DataMasker`,
  `ContextDetector`, `DefaultLogContextBuilder`, `DefaultLogEventBuilder`,
  `Logger` convenience object, `isLogLevelEnabled`, `LOG_LEVELS`,
  `parseLogLevel`
  - typy (`LogContext`, `LogEvent`, `LoggerConfiguration`, `LogProvider`,
    `ConsoleProviderOptions`, `ContextDetectionResult`, `MaskingOptions`)

**⚠️ Pułapka (api-guardian):** 31 pakietów importuje `Logger` i woła
`Logger.forContext(...)` — czyli używa **convenience object (WARTOŚĆ/fasada)**,
nie tylko interfejsu. Usunięcie fasady wymaga zapewnienia wewnętrznego sposobu
uzyskania loggera w tych pakietach.

**⚠️ Leak (api-guardian):** `packages/enterprise/src/index.ts:201`
`export * from '@vytches/ddd-logging'` re-eksportuje WSZYSTKO publicznie →
usunąć linię, ewentualnie zastąpić explicit eksportem portu.

**Los pakietu:** po czyszczeniu `@vytches/ddd-logging` → `private: true`
(wewnętrzny) lub wchłonięty; port `Logger` → `@vytches/ddd-contracts`.

### B. Klasyfikacja wywołań logowania (ddd-compliance-guardian)

~106 wywołań w 31 plikach: **~40 ZOSTAJE** (błędy/warningi biblioteki), **~66
USUŃ** (logowanie operacyjne: published/processed/discovered/initialized/
disposed/saved/rebuilt).

Priorytet objętości (USUŃ): | Plik | wywołań | | --- | --- | |
`events/unified-event-bus.ts` | 21 | | `messaging/outbox-processor.ts` | 12 | |
`projections/projection-rebuilder.ts` | 8 | | `messaging/outbox-service.ts` | 8
| | `di/service-locator.ts` | 4 | | `acl/base-acl-adapter.ts` | 3 |

ZOSTAJE (przykłady): `command-bus.ts:109 warn` (no handler),
`context-aware-event-dispatcher` (warn „event dropped" — krytyczne),
`di/discovery` (warn misconfiguration), `versioning-capability` (warn missing
upcaster).

### C. ⚠️ Naruszenia pure domain (BONUS — ddd-compliance-guardian)

| Plik                                                   | Naruszenie                                                   | Waga         |
| ------------------------------------------------------ | ------------------------------------------------------------ | ------------ |
| `policies/src/core/base/base-business-policy.ts`       | pole `logger` (infrastruktura) w bazowej klasie domenowej    | KRYTYCZNE    |
| `domain-services/src/base-domain-service.ts`           | `logger = Logger.forContext(...)` w bazowej klasie domenowej | KRYTYCZNE    |
| `aggregates/src/capabilities/versioning-capability.ts` | logger w capability (infra, nie pure domain)                 | AKCEPTOWALNE |

Samo istnienie pola `logger` w warstwie domenowej narusza „domain layer is
PURE". Usunięcie operacyjnych logów to za mało — wyciąć logger z tych klas
bazowych.

---

## Implementation Plan

### Phase 0: Decyzje (powyżej) + potwierdzenie konsumpcji juz-ide-api

### ✅ Phase 1 (kroki numerowane jak w briefie) — STATUS

- [x] **Krok 1 DONE (2026-05-29):** usunięto `integration/` (cqrs-decorators,
      aggregate-hooks, cqrs-middleware, result-extensions, index) + test;
      usunięto eksporty z `logging/src/index.ts`; zaktualizowano snapshoty
      api-surface (logging + enterprise). Build logging ✅, testy 89/89 ✅,
      build enterprise ✅.
- [x] **Krok 2 DONE (2026-05-29):** wewnętrzny `internalLogger` (console,
      prywatny) w 11 pakietach; przepięto ~31 plików w 9 pakietach infra (acl,
      events, messaging, di, cqrs, projections, repositories, resilience,
      nestjs, aggregates, policies-infra). warn/error→internalLogger, debug/info
      operacyjne usunięte. Build 20/20 ✅, test 24/24 ✅.
- [~] **Krok 3 — ODCIĘCIE DONE (2026-05-29), zostaje usunięcie pakietu:** ✅
  enterprise `export *` usunięty, ✅ 2 martwe `vi.mock('@vytches/ddd-logging')`
  w testach nestjs usunięte, ✅ alias w package-detection.ts usunięty, ✅
  przykłady domain-services (this.logger) naprawione, ✅ snapshoty api-surface
  zaktualizowane. Build 20/20 ✅, test 24/24 ✅. Pakiet @vytches/ddd-logging =
  izolowana sierota (nikt nie importuje/eksportuje). ZOSTAJE: czyszczenie ~11
  martwych deps `@vytches/ddd-logging` w package.json + fizyczne usunięcie
  pakietu (folder + nx project + pnpm-workspace). BONUS zrobione:
  base-repository warn-przed-throw usunięty (podwójny sygnał, rada agentów);
  kruchy timing test (>2ms) naprawiony. FOLLOW-UP: outbox-processor — Error
  wbudowany w string zamiast 2. arg internalLogger.error (zgubiony stack trace,
  rada library-expert); LoggingMiddleware w cqrs ma za wąski typ.
- [x] **Krok 4 DONE (2026-05-29):** pure domain fix — usunięto pole `logger` z
      base-business-policy.ts, base-domain-service.ts (+ usunięto logowanie
      transakcji); zaktualizowano nieaktualne komentarze w
      plain-domain-service.ts. Build ✅, 267 testów ✅.
- [x] **Krok 3 — czyszczenie/bump DONE (2026-05-29):** usunięto martwe deps
      `@vytches/ddd-logging` z 11× package.json (sed + Edit, JSON zwalidowany),
      usunięto path mapping z tsconfig.base.json. Build pakietów z czyszczonymi
      deps ✅. POZOSTAJE (sandbox blokuje rm/git rm — wymaga ręcznego
      `rm -rf packages/logging`): fizyczne usunięcie folderu pakietu.
- [x] **Krok 5 DONE (2026-05-29):** MIGRATION.md utworzony (root, BEZ numeru
      wersji). ⚠️ Wersjonowaniem zarządza **Lerna** — NIE ruszamy `version` w
      package.json ręcznie. (Próbny bump 0.30.0→0.4.0 został COFNIĘTY na
      polecenie właściciela; pakiety pozostają na 0.30.0; Lerna nada wersję przy
      release.) Patrz memory: feedback_versioning_lerna.
- [ ] **OSTATNI KROK (wymaga właściciela):** `rm -rf packages/logging` + finalny
      `nx run-many -t build,test` (oczekiwane: 20 projektów zielonych).

### Phase 1 (oryg.): Wewnętrzny logger + usunięcie logów operacyjnych

- [x] Utworzyć minimalny wewnętrzny logger (`warn`/`error` → console)
- [ ] Przepiąć ~40 wywołań ZOSTAJE na wewnętrzny logger
- [ ] Usunąć ~66 wywołań operacyjnych (priorytet: unified-event-bus, outbox-\*,
      projection-rebuilder)
- [ ] Usunąć `import { Logger } from '@vytches/ddd-logging'` z 31 plików

> **Decyzja konsolidacji (2026-06-01):** zamiast 10 prywatnych kopii
> `internal-logger.ts` per-pakiet — JEDNO źródło w
> `packages/contracts/src/internal-logger.ts`, eksportowane z barrela contracts
> (jak `Result<T>`), oznaczone `@internal`. Powód: pełna prywatność
> (subpath/`stripInternal`) wymagała operacji na shared build-config;
> barrel-export to jedyna tania opcja zgodna z externalize-workspace.
> Konsekwencja: `internalLogger` jest technicznie importowalny (i widoczny w
> `api-surface` snapshot), ale `@internal` i nie jest warstwą logowania
> aplikacyjnego. Dodano `@vytches/ddd-contracts` jako dep do
> `cqrs`/`messaging`/`projections` (miały tylko tranzytywnie).

- [ ] **Audyt niezmiennika:** `internalLogger` przyjmuje WYŁĄCZNIE metadane
      biblioteki (nazwy, `error.message`) — nigdy payloadów komend/zapytań/PII.
      Zweryfikowane na wszystkich call-site'ach 2026-06-01 (de facto spełnione).

### Phase 2: Usunięcie publicznego API

- [ ] Usunąć `packages/logging/src/integration/` w całości
- [ ] Usunąć publiczną implementację
      (DefaultLogger/ConsoleProvider/DataMasker/ContextDetector/builders/configure)
- [ ] Naprawić `enterprise/src/index.ts:201` (`export *`)
- [ ] Rozstrzygnąć port `Logger` (Phase 0 decyzja): usunąć lub → contracts

### Phase 3: Pure domain fix

- [ ] Usunąć pole `logger` z `base-business-policy.ts` i
      `base-domain-service.ts`
- [ ] Zweryfikować że warstwa domenowa nie importuje infrastruktury

### Phase 4: Semver + dokumentacja

- [ ] Bump `logging` + `enterprise` (Phase 0 target)
- [ ] `MIGRATION.md` (szkic gotowy od api-guardian)
- [ ] Changelog: usunięto warstwę logowania aplikacyjnego

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - library-api-guardian (powierzchnia API, semver) — DONE (audyt)
  - ddd-compliance-guardian (klasyfikacja + pure domain) — DONE (audyt)
  - library-quality-verifier (VETO przed merge)
```

---

_Task utworzony na podstawie audytu 3-agentowego | Supersedes VS-009 |
2026-05-29_
