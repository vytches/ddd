# Security Audit — @vytches/ddd — 2026-05-26

**Zakres:** Cała biblioteka (20 pakietów, aktualny HEAD `develop` / v0.30.0)  
**Metoda:** STRIDE + DREAD + LINDDUN + OWASP Top 10  
**Audytor:** Claude Code (security-review skill)

---

## Podsumowanie wykonawcze

| Severity             | Liczba | Status                                   |
| -------------------- | ------ | ---------------------------------------- |
| CRITICAL (DREAD 12+) | 1      | Wymaga działania przed następnym release |
| HIGH (DREAD 9–11)    | 4      | Wymaga działania w bieżącym sprincie     |
| MEDIUM (DREAD 6–8)   | 3      | Zaplanować w backlogu                    |
| LOW (DREAD ≤5)       | 1      | Do rozważenia                            |
| PASS                 | 7      | Brak działania                           |

**Priorytety do tasków:** SEC-LOGGING-002 (CRITICAL), SEC-LOGGING-003 (HIGH),
SEC-LOGGING-004 (HIGH), SEC-LOGGING-001 (HIGH), SEC-POLICIES-001 (HIGH),
SEC-RESILIENCE-001 (MEDIUM), SEC-MESSAGING-001 (MEDIUM), SEC-VALUEOBJECTS-001
(LOW).

---

## Findings

---

### SEC-LOGGING-002 — CQRS decorators: `includePayload: true` loguje cały obiekt bez maskowania

**Pakiet:** `@vytches/ddd-logging`  
**Plik:** `packages/logging/src/integration/cqrs-decorators.ts:92–93`  
**Severity:** CRITICAL | DREAD: 13  
**Status:** ✅ RESOLVED (VS-001, commit `31a25d26`, 2026-05-27) —
`maskSensitiveData: true` uruchamia `DataMasker` na payloadzie; dodano
`sensitiveFields?: string[]` (additive do domyślnych wzorców regex), singleton
maskera per dekorator, try/catch fallback. Backward-compat: `maskSensitiveData`
domyślnie `false`. Pokryte testami
(`tests/integration/cqrs-decorators.test.ts`).

```typescript
// cqrs-decorators.ts:92
if (options.includePayload && commandOrQuery) {
  logData.payload = commandOrQuery; // cały obiekt, bez masking
}
logger[logLevel](`[Command] Executing CreateUser`, logData);
// → W logach: { payload: { email: "jan@example.com", password: "secret123" } }
```

**STRIDE:** I (Information Disclosure) + LINDDUN: D (Disclosure of PII)

**DREAD:**

- Damage: 3 — hasła, tokeny, PII trafiają do logów produkcyjnych
- Reproducibility: 3 — wystarczy jeden `@LogCommands({ includePayload: true })`
- Exploitability: 2 — wymaga dostępu do logów
- Affected Users: 3 — wszyscy konsumenci tej dekoratki
- Discoverability: 2 — opcja widoczna w API
- **Suma: 13 → CRITICAL**

**Rekomendacja:**

1. Gdy `includePayload: true` i `maskSensitiveData: true` (lub brak DataMasker)
   — automatycznie przekaż payload przez `DataMasker` przed logowaniem.
2. Dodać opcję `sensitiveFields: string[]` pozwalającą wykluczyć konkretne pola.
3. JSDoc: wyraźne ostrzeżenie że `includePayload: true` w połączeniu z komendami
   zawierającymi PII wymaga `maskSensitiveData: true`.

**Propozycja kodu:**

```typescript
if (options.includePayload && commandOrQuery) {
  logData.payload = options.maskSensitiveData
    ? masker.maskData(commandOrQuery)
    : commandOrQuery;
}
```

---

### SEC-LOGGING-003 — ConsoleProvider: `event.data` serializowane bez DataMasker

**Pakiet:** `@vytches/ddd-logging`  
**Plik:** `packages/logging/src/providers/console-provider.ts:63`  
**Severity:** HIGH | DREAD: 11

```typescript
// console-provider.ts:63
const data = event.data ? ` ${JSON.stringify(event.data)}` : '';
// event.data może zawierać { userId, email, token, ... } — bez masowania
```

**STRIDE:** I (Information Disclosure) + LINDDUN: D (Disclosure)

**DREAD:** D=3, R=2, E=2, A=3, Disc=1 → **11**

ConsoleProvider jest domyślnym loggerem dla środowisk dev/test i często używany
w produkcji w uproszczonych deploymentach. `event.data` jest przekazywane przez
consumer bez żadnego filtrowania — wszelkie PII (email, userId, token) trafia do
stdout.

**Rekomendacja:**

1. ConsoleProvider powinien akceptować opcjonalny `DataMasker` w konstruktorze.
2. Jeśli DataMasker jest skonfigurowany, `formatEvent()` powinien maskować
   `event.data` przed serializacją.
3. Albo: dokumentacja musi jasno ostrzegać, że ConsoleProvider nie maskuje
   danych.

---

### SEC-LOGGING-004 — DataMasker: `isSensitiveKey` pomija klucze w liczbie mnogiej

**Pakiet:** `@vytches/ddd-logging`  
**Plik:** `packages/logging/src/utils/data-masker.ts:106–112`  
**Severity:** HIGH | DREAD: 10

```typescript
private isSensitiveKey(key: string): boolean {
  return this.options.sensitiveKeys.some(sensitiveKey => {
    const lowerSensitiveKey = sensitiveKey.toLowerCase();
    // BUG: "passwords" kończy się na "passwords" → NIE jest maskowane
    return lowerKey.includes(lowerSensitiveKey) && !lowerKey.endsWith(`${lowerSensitiveKey}s`);
  });
}

// Przykład:
// sensitiveKeys: ['password']
// { passwords: "secret123" }  → NIE zamaskowane  ← BUG
// { password: "secret123" }   → zamaskowane       ← OK
// { userPassword: "secret" }  → zamaskowane       ← OK
// { apiTokens: "Bearer xyz" } → NIE zamaskowane  ← BUG (token → tokens)
```

**STRIDE:** I (Information Disclosure) + LINDDUN: D, U (Unawareness — konsument
myśli że maskuje)

**DREAD:** D=3, R=2, E=2, A=2, Disc=1 → **10**

**Rekomendacja:**

1. Usunąć regułę wykluczenia liczby mnogiej (false-negative worse than
   false-positive).
2. Jeśli wykluczenie FP jest konieczne — użyć word-boundary regex zamiast
   prostego `endsWith`.
3. Alternatywnie: zmienić podejście na allowlist (explicit list kluczy) zamiast
   substring matching.
4. Dodać testy dla kluczy w liczbie mnogiej.

---

### SEC-LOGGING-001 — DataMasker: ReDoS przez user-supplied regex patterns

**Pakiet:** `@vytches/ddd-logging`  
**Plik:** `packages/logging/src/utils/data-masker.ts:36`  
**Severity:** HIGH | DREAD: 10

```typescript
// data-masker.ts:36
...this.options.patterns.map(pattern => new RegExp(pattern, 'g')),
// Pattern string pochodzi z MaskingOptions.patterns: string[]
// Brak walidacji przed kompilacją
```

**STRIDE:** D (Denial of Service — ReDoS) + LINDDUN: brak

**DREAD:** D=2, R=2, E=3, A=3, Disc=0 → **10**

Jeśli `patterns` pochodzi z konfiguracji zewnętrznej (np. env var, API) lub jest
przekazywany przez consumer z user-controlled inputem, pattern jak `(a+)+$`
powoduje katastrofalne backtracking → DoS. Szczególnie groźne gdy DataMasker
jest wywoływany na hot path (każdy log event).

**Rekomendacja:**

1. Walidować wzorce regex przed kompilacją — odrzucić lub ostrzec gdy wzorzec ma
   cechy ReDoS (nested quantifiers, overlapping alternation).
2. Dodać timeout do kompilacji (trudne w Node.js bez workerów) lub sandboxować
   regexpy przez safe-regex / node-re2.
3. Minimum: dokumentacja z explicit ostrzeżeniem.
4. Rozważyć użycie `re2` package jako opcjonalnej zależności dla bezpiecznych
   regexów.

---

### SEC-POLICIES-001 — CachedPolicy: kolizje 32-bitowego hasha w kluczu cache

**Pakiet:** `@vytches/ddd-policies`  
**Plik:** `packages/policies/src/decorators/cached-policy.ts:268–275`  
**Severity:** HIGH | DREAD: 9

```typescript
private hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit space
  }
  return Math.abs(hash).toString(16);
}
// Przestrzeń: ~4 mld wartości → Birthday paradox: kolizja przy ~65k entity-key kombinacji
```

**STRIDE:** T (Tampering — entity A dostaje wynik policy entity B) + E
(Elevation — ominięcie walidacji policy)

**DREAD:** D=3, R=2, E=2, A=1, Disc=1 → **9**

Kolizja hasha skutkuje tym, że jeden agregat dostaje wynik policy innego
agregatu. W scenariuszach autentykacji/autoryzacji może to oznaczać że
`denyList.isSatisfiedBy(entityA)` zwróci wynik dla `entityB`. Prawdopodobieństwo
kolizji rośnie z liczbą jednoczesnych unikalnych encji.

**Rekomendacja:**

1. Zastąpić djb2 hashem o większej przestrzeni:
   `crypto.createHash('sha256').update(str).digest('hex').slice(0, 16)`.
2. Alternatywnie: użyć pełnego `JSON.stringify(entity)` jako klucza (bez
   hashowania), przyjmując większe zużycie pamięci.
3. Dodać opcję konfiguracji `cacheKeyFn` pozwalającą konsumentowi nadpisać
   generowanie klucza.

---

### SEC-RESILIENCE-001 — MetricExporter CSV: brak ochrony przed formula injection

**Pakiet:** `@vytches/ddd-resilience`  
**Plik:** `packages/resilience/src/observability/metric-exporters.ts:246–252`  
**Severity:** MEDIUM | DREAD: 7  
**Status:** ✅ RESOLVED (VS-006, commit `46fd54e2`, 2026-07-02) — leading `=`,
`+`, `-`, `@`, `|`, `%` oraz `\r` są teraz quotowane

```typescript
private escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;  // BUG: "=SUM(A1)" lub "@BAD" nie są owijane cudzysłowem
}
```

**STRIDE:** T (Tampering — CSV formula injection)

**DREAD:** D=2, R=1, E=2, A=1, Disc=1 → **7**

Jeśli nazwa metryki lub etykieta (np.
`circuit_breaker[=HYPERLINK("http://evil.com")]`) trafi do eksportowanego CSV, a
plik zostanie otwarty w Excel/Google Sheets — formuła może zostać wykonana.
Ryzyko ograniczone przez to, że nazwy metryk są typowo developer-defined.

**Rekomendacja:**

```typescript
private escapeCsv(value: string): string {
  // Formula injection: wrap values starting with =, +, -, @, |, %
  const needsQuote = /[,"\n\r=+\-@|%]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}
```

---

### SEC-MESSAGING-001 — OutboxProcessor: cicha podmiana default handlera bez ostrzeżenia

**Pakiet:** `@vytches/ddd-messaging`  
**Plik:** `packages/messaging/src/outbox/outbox-processor.ts:205`  
**Severity:** MEDIUM | DREAD: 7

```typescript
registerDefaultHandler(handler: IOutboxMessageHandler): void {
  this.defaultHandler = handler;  // brak logger.warn gdy this.defaultHandler !== undefined
}
```

**STRIDE:** R (Repudiation — trudno wykryć przypadkowe zastąpienie handlera)

**DREAD:** D=2, R=2, E=2, A=1, Disc=0 → **7**

Drugie wywołanie `registerDefaultHandler` cicho zastępuje poprzedni handler bez
żadnego sygnału. W złożonych setupach (DI kontener, moduł inicjalizujący) może
to prowadzić do "zaginionego" handlera — wiadomości są procesowane ale przez
nieoczekiwany handler.

**Rekomendacja:**

```typescript
registerDefaultHandler(handler: IOutboxMessageHandler): void {
  if (this.defaultHandler) {
    this.logger.warn('registerDefaultHandler: replacing existing default handler — previous handler discarded');
  }
  this.defaultHandler = handler;
}
```

---

### SEC-VALUEOBJECTS-001 — EntityIdFactory: `console.warn` w opublikowanym pakiecie

**Pakiet:** `@vytches/ddd-value-objects`  
**Plik:** `packages/value-objects/src/id.value-object.ts:34`  
**Severity:** LOW | DREAD: 4  
**Status:** ✅ RESOLVED (VS-008, commit `6428850d`, 2026-07-02) —
`VYTCHES_SUPPRESS_DEPRECATION_WARNINGS=1` wycisza warning; domyślne zachowanie
bez zmian

```typescript
// Intencjonalne — deprecation warning, jeden raz per process
console.warn(
  `[@vytches/ddd-value-objects] EntityIdFactory.${method}() is deprecated...`
);
```

**STRIDE:** I (Information disclosure — ujawnia wersję i plany deprecation)

**DREAD:** D=1, R=1, E=1, A=1, Disc=0 → **4**

Intencjonalne i udokumentowane (komentarz + lint-ignore). Ryzyko minimalne.
Jedyną kwestią jest fakt, że production-shipped package drukuje na
`console.warn` — niektórzy konsumenci mogą to traktować jako wyciek informacji w
logach produkcyjnych.

**Rekomendacja:** Niski priorytet. Opcjonalnie: dodać mechanizm supresji przez
`process.env.VYTCHES_SUPPRESS_DEPRECATION_WARNINGS`.

---

## Pozytywne wyniki (PASS)

| ID              | Obszar                                            | Dlaczego PASS                                                                                  |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| PASS-AGG-001    | Prototype pollution w `aggregate-root.ts`         | Explicit guards: `__proto__`, `constructor`, `prototype` filtrowane z metadata (linia 373–383) |
| PASS-EVENTS-001 | `safeParseIntegrationJson` — DoS                  | 1 MB byte cap + 50-level depth cap (linia 62–76)                                               |
| PASS-EVENTS-002 | Sanitizacja payloadu w IntegrationEvent           | `sanitizeIntegrationPayload` rekurencyjnie filtruje `__proto__` etc.                           |
| PASS-UTILS-001  | Brak `eval`/`new Function`                        | Przeszukano wszystkie src/ — nie znaleziono                                                    |
| PASS-ACL-001    | Brak SQL injection                                | Biblioteka nie ma dostępu do bazy danych                                                       |
| PASS-CI-001     | Usunięcie `tag-publish` job z CI                  | Zmniejsza attack surface automatycznej publikacji                                              |
| PASS-SUPPLY-001 | Brak `postinstall`/`preinstall` hooks w pakietach | Tylko `prepare` w root (husky — oczekiwane), zero w package-level                              |

---

## LINDDUN Privacy Summary

| Pakiet                    | Zagrożenie                                                           | Status            |
| ------------------------- | -------------------------------------------------------------------- | ----------------- |
| logging (ConsoleProvider) | **D — Disclosure**: `event.data` bez masowania → PII w stdout        | SEC-LOGGING-003   |
| logging (CQRS decorators) | **D — Disclosure**: command payload z PII gdy `includePayload: true` | SEC-LOGGING-002   |
| logging (DataMasker)      | **U — Unawareness**: konsument myśli że maskuje plurals ale nie      | SEC-LOGGING-004   |
| messaging                 | **N — Non-repudiation**: brak audit log zastąpienia default handlera | SEC-MESSAGING-001 |

---

## Propozycje tasków (do utworzenia)

Poniżej gotowe tytuły tasków do dodania do backlogu. Sortowane malejąco po
severity.

### CRITICAL

1. **[SEC] logging: CQRS decorators — maskowanie PII w `includePayload`**  
   Plik: `packages/logging/src/integration/cqrs-decorators.ts`  
   Działanie: automatyczne maskowanie przez DataMasker gdy
   `maskSensitiveData: true`, ostrzeżenie w JSDoc, test

### HIGH

2. **[SEC] logging: ConsoleProvider — DataMasker dla `event.data`**  
   Plik: `packages/logging/src/providers/console-provider.ts`  
   Działanie: opcjonalny DataMasker w konstruktorze, aktualizacja docs

3. **[SEC] logging: DataMasker — naprawić false-negative dla kluczy w liczbie
   mnogiej**  
   Plik: `packages/logging/src/utils/data-masker.ts`  
   Działanie: usunąć regułę `endsWith(s)`, nowe testy dla "passwords",
   "apiTokens"

4. **[SEC] logging: DataMasker — walidacja wzorców regex (ReDoS)**  
   Plik: `packages/logging/src/utils/data-masker.ts`  
   Działanie: walidacja lub safe-regex przed `new RegExp(pattern, 'g')`

5. **[SEC] policies: CachedPolicy — zastąpić djb2 hash kryptograficznym**  
   Plik: `packages/policies/src/decorators/cached-policy.ts`  
   Działanie: `crypto.createHash('sha256')`, opcja `cacheKeyFn`

### MEDIUM

6. **[SEC] resilience: CsvMetricExporter — formula injection chars**  
   Plik: `packages/resilience/src/observability/metric-exporters.ts`  
   Działanie: rozszerzyć `escapeCsv()` o `=`, `+`, `-`, `@`, `|`, `%`

7. **[SEC] messaging: OutboxProcessor — `logger.warn` przy zastąpieniu default
   handlera**  
   Plik: `packages/messaging/src/outbox/outbox-processor.ts`  
   Działanie: jedna linijka `this.logger.warn(...)` + test

### LOW

8. **[SEC] value-objects: EntityIdFactory deprecation — opcja supresji
   `console.warn`**  
   Plik: `packages/value-objects/src/id.value-object.ts`  
   Działanie: sprawdzić `process.env.VYTCHES_SUPPRESS_DEPRECATION_WARNINGS`

---

_Audit wykonany 2026-05-26. Następny full audit: przed v1.0.0 lub kwartalnie._
