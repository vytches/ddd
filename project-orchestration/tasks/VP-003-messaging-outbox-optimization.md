# Task: Outbox production readiness — adoption blockers (production-validated)

## Task Metadata

```yaml
task_id: VP-003
title:
  Outbox retry backoff + type filter + InMemoryRepo + adaptive re-poll + NestJS
  module
type: feature
priority: high
complexity: medium
estimated_time: 11h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
revised_at: 2026-05-10 (consumer feedback round 1)
revised_at_2:
  2026-05-18 (deep analysis + tech-lead + architecture-guardian review)
status: in_progress
release_target:
  p1_p2: v0.26.1
  p3: v0.26.2
priority_score: 95/100
```

---

## Why This Task Exists (revised 2026-05-18)

### Historia rewizji

**Oryginalne VP-003 (2026-03-31):** spekulatywne — zakładało braki
batching/prioritization/binary serialization. Weryfikacja pokazała że to
wszystko już istnieje.

**Rewizja 1 (2026-05-10):** consumer a production consumer confirmed 3 blokery:
brak adaptive re-poll, brak NestJS modułu, niejasna dokumentacja parallel
dispatch. Docs zrobione (Part 1 ✅). Reszta odłożona do v0.26.1.

**Rewizja 2 (2026-05-18):** pełna analysis of a production consumer
implementation vs biblioteki ujawniła znacznie głębsze luki. Wymagana
przepisanie scope.

### What the consumer implemented zamiast używać OutboxProcessor

```
OutboxPollerService (własny) — powody:
  - OutboxProcessor istnieje i jest eksportowany ALE nie był znany konsumentowi
    (słaba discoverability, brak dokumentacji, GitHub Packages friction)
  - Nawet gdyby był znany — blokowały:
      1. Brak exponential backoff (tight retry loop niebezpieczny przy awarii brokera)
      2. Brak filtru po messageType (potrzebne dwa osobne pollery)
      3. Brak crash recovery API w IOutboxRepository
      4. Brak startup jitter (multi-pod thundering herd)
      5. Brak InMemoryOutboxRepository (testowanie niemożliwe bez własnego fake)
```

### What the pre-consumer analysis missed

The consumer had **two niezależne pollery** na tej samej tabeli
`outbox_messages`:

| Poller                        | Filtr                        | Logika            | Interval    |
| ----------------------------- | ---------------------------- | ----------------- | ----------- |
| `OutboxPollerService`         | wszystkie typy               | fan-out → BullMQ  | 2s + jitter |
| `GdprAuditChainPollerService` | tylko `GdprAuditChainAppend` | HMAC chain append | 3s + jitter |

Oba używają `FOR UPDATE SKIP LOCKED` żeby nie kolidować. Biblioteka nie ma
mechanizmu type-filter ani multi-instance support.

---

## Analiza luk vs. obecna implementacja

### `IOutboxRepository` (abstract class)

| Metoda                                           | Stan        | Problem                                                                      |
| ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `getUnprocessedMessages(limit?, priorityOrder?)` | ✅ istnieje | Brak filtra po `messageTypes` — blokuje wyspecjalizowane pollery             |
| `resetStaleProcessing(olderThan)`                | ❌ brak     | Crash recovery niemożliwy bez własnej implementacji; consumer added manually |
| `scheduleRetry(id, processAfter)`                | ❌ brak     | Retry z backoffem niemożliwy bez tej metody                                  |

**Ważne:** `IOutboxRepository` to `abstract class`, nie interface. Dodanie
nowych `abstract` metod jest breaking change — każdy konsument musiałby je
zaimplementować. Rozwiązanie: dodać jako **concrete methods z no-op default**
(wzorzec Template Method, spójny z obecną architekturą).

### `OutboxProcessor`

| Feature               | Stan    | Problem                                                                                                                 |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Retry backoff         | ❌ brak | `handleMessageError` resetuje do PENDING natychmiast — tight loop wyczerpuje `maxRetries` w sekundy przy awarii brokera |
| `messageTypes` filter | ❌ brak | Nie można zbudować wyspecjalizowanego pollera bez rzutowania                                                            |
| Adaptive re-poll      | ❌ brak | Fixed interval — przy burście 1000 eventów przetwarza 10 co 5s zamiast drenować kolejkę                                 |
| Livelock guard        | ❌ brak | Adaptive re-poll bez guardu → CPU spin przy ciągłym pełnym batchu                                                       |
| Startup jitter        | ❌ brak | Multi-pod deployments — thundering herd na `FOR UPDATE` przy równoczesnym starcie                                       |
| Observability hooks   | ❌ brak | Produkcja bez metryk jest ślepa                                                                                         |

### `@vytches/ddd-testing`

| Feature                    | Stan    | Problem                                                                                                   |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `InMemoryOutboxRepository` | ❌ brak | Testowanie OutboxProcessor wymaga pisania własnego fake — boilerplate który biblioteka powinna dostarczyć |

---

## Scope (11h total, sekwencyjny)

### ✅ Part 0: Dokumentacja parallel dispatch — DONE 2026-05-10 (~30 min)

- JSDoc na `processBatch()` — explicit `Promise.allSettled` contract
- Inline komentarz przy dispatch site
- `packages/messaging/LLMGUIDE.md` — sekcja "Dispatch model" + broker-adapter
  recipe

---

### Part 1: Exponential backoff w retry — P1 (~2h)

**Problem:** retry natychmiastowy → przy awarii brokera 3 próby w ciągu sekund →
FAILED. Stracona wiadomość.

**Rozwiązanie:** użyć istniejącego pola `processAfter` na `IOutboxMessage`. Pole
istnieje, `getUnprocessedMessages` już je respektuje
(`WHERE process_after <= NOW()`). Brakuje tylko wiring w retry logic.

**Zmiany:**

1. **`IOutboxRepository`** — dodać concrete method z no-op default:

   ```typescript
   scheduleRetry(id: string, processAfter: Date): Promise<void> {
     // Default: no-op — implementacje które nie obsługują processAfter
     // po prostu zostawią messages w PENDING bez opóźnienia.
     // Override w pełnych adapterach (Kysely, TypeORM, etc.)
     return Promise.resolve();
   }
   ```

2. **`OutboxProcessorOptions`** — dodać:

   ```typescript
   retryBackoff?: {
     initial: number;   // ms, domyślnie 1000
     multiplier: number; // domyślnie 2
     maxDelay: number;  // ms, domyślnie 300_000 (5 min)
   };
   ```

3. **`OutboxProcessor.handleMessageError()`** — zmienić retry logic:
   ```typescript
   const delay = Math.min(
     opts.initial * Math.pow(opts.multiplier, attempts - 1),
     opts.maxDelay
   );
   await this.repository.scheduleRetry(id, new Date(Date.now() + delay));
   // zamiast: await this.repository.updateStatus(id, MessageStatus.PENDING)
   ```

**Testy (3 scenariusze):**

- Pierwsza próba → delay = `initial`
- Trzecia próba → delay = `initial * multiplier²`
- Po `maxRetries` → status FAILED, brak `scheduleRetry`

**Backward compat:** `retryBackoff` jest optional, brak = zachowanie jak
dotychczas (natychmiastowy PENDING).

---

### Part 2: Type filter + crash recovery w `IOutboxRepository` — P1 (~1.5h)

**Zmiany:**

1. **`getUnprocessedMessages`** — dodać optional 3. parametr:

   ```typescript
   abstract getUnprocessedMessages(
     limit?: number,
     priorityOrder?: MessagePriority[],
     messageTypes?: string[]   // ← NEW, optional → backward-compatible
   ): Promise<IOutboxMessage[]>;
   ```

   Implementacja filtruje po `message_type IN (...)` gdy podane.

2. **`resetStaleProcessing`** — concrete method z no-op default:

   ```typescript
   resetStaleProcessing(olderThan: Date): Promise<number> {
     // Override: UPDATE outbox_messages SET status='PENDING'
     //   WHERE status='PROCESSING' AND updated_at < olderThan
     return Promise.resolve(0);
   }
   ```

3. **`OutboxProcessorOptions`** — dodać:
   ```typescript
   messageTypes?: string[];          // filtr typów przekazywany do getUnprocessedMessages
   crashRecoveryIntervalMs?: number; // jeśli podane: auto-woła resetStaleProcessing co N ms
   crashRecoveryThresholdMs?: number; // jak stara musi być PROCESSING żeby ją resetować (domyślnie 5min)
   ```

**Testy:**

- Processor z `messageTypes: ['A']` ignoruje wiadomości typu 'B'
- `crashRecoveryIntervalMs` wyzwala `resetStaleProcessing` cyklicznie
- `resetStaleProcessing` nie resetuje świeżych PROCESSING

---

### Part 3: `InMemoryOutboxRepository` w `@vytches/ddd-testing` — P1 (~2h)

Konsumenci nie mają czym testować `OutboxProcessor` bez pisania własnego fake.
To jest core responsibility biblioteki testingowej.

**Implementacja:**

```typescript
// packages/testing/src/outbox/in-memory-outbox.repository.ts
export class InMemoryOutboxRepository extends IOutboxRepository {
  private readonly messages = new Map<string, IOutboxMessage>();

  // pełna implementacja wszystkich abstract methods
  // + resetStaleProcessing i scheduleRetry jako override
  // + helper: getAll(), clear() (test isolation)
}
```

**Testy:** 25-30 unit testów pokrywających:

- `saveMessage` / `saveBatch` / `getUnprocessedMessages`
- `messageTypes` filter
- `processAfter` respektowane (nie zwraca future messages)
- `resetStaleProcessing` — tylko stare PROCESSING wracają do PENDING
- `scheduleRetry` — ustawia `processAfter`
- `clear()` — izolacja między testami

**Export** z `@vytches/ddd-testing/src/index.ts`.

---

### Part 4: Adaptive re-poll + startup jitter w `OutboxProcessor` — P2 (~2h)

**Adaptive re-poll z livelock guardem** (inspired by consumer implementation,
without `setImmediate` — cross-runtime):

```typescript
// OutboxProcessorOptions:
adaptiveRepoll?: boolean;          // domyślnie false (opt-in)
adaptiveRepollMaxConsecutive?: number; // livelock guard: po N pełnych batchach → pauza (domyślnie 5)
adaptiveRepollPauseMs?: number;    // długość pauzy po guard (domyślnie 50)
```

```typescript
// scheduleProcessing logic:
private scheduleProcessing(consecutiveFullBatches = 0): void {
  const result = await this.processBatch();

  if (this.options.adaptiveRepoll && result.processed >= result.batchSize) {
    const consecutive = consecutiveFullBatches + 1;
    const delay = consecutive > this.options.adaptiveRepollMaxConsecutive
      ? this.options.adaptiveRepollPauseMs  // livelock guard
      : 0;                                   // immediate re-poll
    this.scheduleProcessing(consecutive, delay);
  } else {
    this.scheduleProcessing(0, this.options.processingInterval);
  }
}
```

**Startup jitter:**

```typescript
// OutboxProcessorOptions:
startupJitterMs?: number; // random delay 0..N na start(), domyślnie 0
```

**`processBatch()` return type** (backward-compatible):

```typescript
// Promise<void> → Promise<{ processed: number; batchSize: number }>
// Callers ignorujący return value nie wymagają zmian
```

**Testy (5 scenariuszy):**

- Pełny batch → natychmiastowy re-poll (delay = 0)
- Pełny batch ×6 → pauza `adaptiveRepollPauseMs`
- Partial batch → normalny interval
- Empty batch → normalny interval
- `adaptiveRepoll: false` (default) → zawsze normalny interval

---

### Part 5: `OutboxProcessorHooks` + `OutboxProcessorModule` — P3 (~3.5h)

#### 5a. Observability hooks (~1.5h)

Osobny interface (zmiany nie biją w `OutboxProcessorOptions`):

```typescript
// packages/messaging/src/outbox/outbox-hooks.ts
export interface OutboxProcessorHooks {
  onBatchComplete?(result: { processed: number; failed: number; batchSize: number; durationMs: number }): void;
  onMessageFailed?(message: IOutboxMessage, error: Error, attempt: number): void;
  onPermanentFailure?(message: IOutboxMessage, error: Error): void;
}

// W OutboxProcessorOptions:
hooks?: OutboxProcessorHooks;
```

Umożliwia: Prometheus counters, DataDog metrics, alerting na permanent failures,
DLQ routing.

**Testy:** callback woływany przy odpowiednich zdarzeniach (mock function).

#### 5b. `OutboxProcessorModule` w `@vytches/ddd-nestjs` (~2h)

**Thin wrapper** — żadna logika routingu nie może żyć w module, tylko w
`OutboxProcessor`.

```typescript
// packages/nestjs/src/outbox/outbox-processor.module.ts
OutboxProcessorModule.forRootAsync({
  processors: [
    {
      // Globalny procesor
      repositoryToken: OUTBOX_REPOSITORY,
      options: { batchSize: 200, adaptiveRepoll: true, startupJitterMs: 500 },
    },
    {
      // Wyspecjalizowany procesor (np. GDPR)
      repositoryToken: OUTBOX_REPOSITORY,
      options: { messageTypes: ['GdprAuditChainAppend'], batchSize: 50 },
      handlerToken: GDPR_OUTBOX_HANDLER,
    },
  ],
});
```

Każdy processor entry tworzy osobną instancję `OutboxProcessorService` (extends
`OutboxProcessor` + `@Injectable()` + `OnModuleInit`/`OnModuleDestroy`).

**Testy:** API surface test + lifecycle smoke test (start/stop wywołane).

---

## Acceptance Criteria

### v0.26.0 (Part 0 — DONE)

- [x] JSDoc na `processBatch` — parallel dispatch contract
- [x] LLMGUIDE.md — sekcja dispatch model + broker-adapter recipe
- [x] Brak regresji testów
- [x] Merged do develop przed publishem

### v0.26.1 (Parts 1–4)

- [x] `scheduleRetry(id, processAfter)` w `IOutboxRepository` jako concrete
      no-op
- [x] `resetStaleProcessing(olderThan)` w `IOutboxRepository` jako concrete
      no-op
- [x] `getUnprocessedMessages` przyjmuje optional `messageTypes?: string[]`
- [x] `OutboxProcessor` retry używa exponential backoff via `processAfter`
- [x] `retryBackoff` opcja — 3 scenariusze backoffu pokryte testami
- [x] `messageTypes` opcja w `OutboxProcessorOptions`
- [x] `crashRecoveryIntervalMs` opcja — auto-woła `resetStaleProcessing`
- [x] `InMemoryOutboxRepository` w `@vytches/ddd-testing` — 25+ testów
- [x] `InMemoryOutboxRepository` eksportowany z `@vytches/ddd-testing`
- [x] `processBatch()` zwraca `{ processed, batchSize }` (backward-compatible)
- [x] Adaptive re-poll z livelock guardem — 5 scenariuszy testów
- [x] `startupJitterMs` opcja
- [x] `adaptiveRepoll` domyślnie `false` (opt-in, brak breaking change)
- [x] API surface tests dla wszystkich nowych eksportów
- [x] Zero regresji istniejących testów

### v0.26.2 (Part 5)

- [x] `OutboxProcessorHooks` interface eksportowany
- [x] `hooks` opcja w `OutboxProcessorOptions`
- [x] `onBatchComplete`, `onMessageFailed`, `onPermanentFailure` wyzwalane we
      właściwych momentach
- [x] `OutboxProcessorModule.forRootAsync` w `@vytches/ddd-nestjs`
- [x] Multi-processor: N procesorów per module
- [x] `repositoryToken` + opcjonalny `handlerToken` per processor entry
      (`handlerToken` → `Record<messageType, IOutboxMessageHandler>`)
- [x] Lifecycle: `OnModuleInit` → `start()`, `OnModuleDestroy` → `stop()`
- [x] API surface tests + lifecycle smoke tests

---

## Decyzje architektoniczne (z architecture-guardian review 2026-05-18)

| Decyzja                             | Wybór                                   | Uzasadnienie                                                                                                        |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Nowe metody w `IOutboxRepository`   | concrete z no-op default                | abstract byłoby breaking change dla istniejących implementorów                                                      |
| Adaptive re-poll timing             | `setTimeout(0/50)`                      | `setImmediate` jest Node.js-only, biblioteka celuje w edge runtimes                                                 |
| Hooks                               | osobny `OutboxProcessorHooks` interface | flat options → każda zmiana hooka bije w `OutboxProcessorOptions` semver                                            |
| `OutboxProcessorModule`             | thin DI wrapper                         | cała logika routingu w `OutboxProcessor` core, moduł = glue code                                                    |
| `concurrencyKey` (ordered delivery) | ❌ odrzucone                            | application concern — `InMemoryOutboxRepository` nie może tego zaimplementować uczciwie; workaround: `batchSize: 1` |
| `setImmediate`                      | ❌ odrzucone                            | Node.js-only API                                                                                                    |
| `pause()`/`resume()`                | ❌ odrzucone                            | brak consumer signal, low ROI                                                                                       |
| Message TTL                         | ❌ odrzucone                            | niszowy use case, osobny task gdy pojawi się demand                                                                 |

---

## Estymacja czasu

| Part                      | Co                               | Czas     |
| ------------------------- | -------------------------------- | -------- |
| 0                         | Docs (DONE)                      | 0.5h ✅  |
| 1                         | Exponential backoff              | 2h       |
| 2                         | Type filter + crash recovery API | 1.5h     |
| 3                         | `InMemoryOutboxRepository`       | 2h       |
| 4                         | Adaptive re-poll + jitter        | 2h       |
| 5a                        | `OutboxProcessorHooks`           | 1.5h     |
| 5b                        | `OutboxProcessorModule` NestJS   | 2h       |
| **Total P1+P2 (v0.26.1)** |                                  | **7.5h** |
| **Total P3 (v0.26.2)**    |                                  | **3.5h** |

---

## Coupled With

- `@vytches/ddd-testing` — nowy eksport `InMemoryOutboxRepository`
- `@vytches/ddd-nestjs` — nowy `OutboxProcessorModule` (Part 5b)
- consumer migration: po v0.26.1 mogą wyrzucić własne crony i dual-pollers jeśli
  Parts 1–4 są kompletne

---

## Security Considerations

> Pełna analiza STRIDE + DREAD + LINDDUN:
> [`docs/security/threat-models/TM-VP-003.md`](../../docs/security/threat-models/TM-VP-003.md)
> Data: 2026-05-18

### Wymagane mitigacje — CRITICAL (blokują v0.26.1)

| ID  | Zagrożenie                                                                         | Mitygacja                                                                           |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | Unbounded `batchSize` → OOM / DB overload (DREAD: 21)                              | Walidacja w konstruktorze: `batchSize <= 10_000`, rzuć `Error` przy przekroczeniu   |
| D3  | `crashRecoveryThresholdMs: 0` resetuje wszystkie PROCESSING wiadomości (DREAD: 20) | Wymuś minimum: `crashRecoveryThresholdMs >= messageTimeout`; domyślnie `300_000` ms |
| D4  | Backoff integer overflow → `Infinity` delay (DREAD: 15)                            | `Math.min(delay, maxDelay)` przed `new Date(Date.now() + delay)`                    |
| T3  | Eksplozja hooków = silent failure silences metrics (DREAD: 15)                     | Każde wywołanie hooka owrapować w `safeRun` (try/catch + Logger.error)              |

### Wymagane mitigacje — HIGH (przed v0.26.1)

| ID  | Zagrożenie                                                   | Mitygacja                                                                                                |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| D2  | Adaptive re-poll → DB connection pool exhaustion             | Dokumentować `minPollIntervalMs` default; adaptive re-poll opt-in (`false` domyślnie)                    |
| I1  | PII w logach error przez `JSON.stringify(message.payload)`   | Logger nigdy nie loguje surowego `payload`; logować tylko `id`, `messageType`, `attempt`                 |
| I3  | `getStats()` ujawnia nazwy handlerów do 3rd-party systemów   | Udokumentować jako internal/debug; ostrzeżenie w JSDoc                                                   |
| T2  | `resetStaleProcessing` może zreplayować wiadomości in-flight | Odrzucać `olderThan` w przyszłości (`> Date.now()`); logować wiadomości resettowane                      |
| E2  | Crash recovery omija GDPR intentional holds                  | Udokumentować: `resetStaleProcessing` nie powinien być wywoływany na wiadomościach z GDPR retention flag |

### LINDDUN — Privacy (HIGH)

- **PII w logach:** payload serialization do error logów → potencjalnie
  3rd-party log systems (DataDog, Sentry). Logger musi logować tylko `id` +
  `messageType`.
- **GDPR Art.17 konflikt:** wiadomości FAILED zachowują pełny payload.
  Udokumentować że konsument odpowiada za cleanup (`eraseUserPayloads` pattern z
  consumer project).

### Acceptance Criteria Security (dodane do v0.26.1)

- [x] `batchSize > 10_000` rzuca błąd w konstruktorze z opisowym komunikatem
- [x] `crashRecoveryThresholdMs < messageTimeout` rzuca błąd w konstruktorze
- [x] Backoff delay zawsze przez `Math.min(delay, maxDelay)` przed użyciem w
      `Date`
- [x] Hooki wywołane w `safeRun` — błąd hooka nie propaguje do pętli processingu
      (zaimplementowane jako `safelyInvokeHook` try/catch + `Logger.error`)
- [x] Logger w `handleMessageError` loguje tylko `id`, `messageType`, `attempt`
      — nigdy `payload`

## Historia rewizji

- **2026-03-31**: utworzenie (spekulatywne, 14h)
- **2026-05-08**: migracja z work-items archive
- **2026-05-10**: rewizja 1 po consumer feedback — zmniejszony scope do 4h, Part
  1 zrobiony
- **2026-05-18**: revision 2 after deep analysis of consumer implementation +
  recenzja tech-lead + architecture-guardian — zakres rozszerzony do 11h, 5
  nowych luk zidentyfikowanych
