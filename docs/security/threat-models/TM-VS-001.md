# Threat Model: TM-VS-001

**Feature:** CQRS decorators — automatyczne maskowanie PII gdy
`includePayload: true` **Task:** VS-001-logging-cqrs-payload-masking **Date:**
2026-05-27 **Method:** STRIDE + DREAD + LINDDUN **Scope:**
`@vytches/ddd-logging` — `cqrs-decorators.ts`, `DataMasker`,
`CQRSLoggingOptions`

---

## Context & Attack Surface

Dekoratory `@LogCommands`, `@LogQueries`, `@LogCQRS` przechwytują każde
wykonanie handlera CQRS i opcjonalnie logują pełny payload (komendę/zapytanie).
Przy `includePayload: true` i braku maskowania, wszystkie pola obiektu trafiają
bez filtrowania do docelowego systemu logowania — konsoli, pliku, serwisu
zdalnego (np. Datadog, Sentry, Elasticsearch).

**Kluczowy wektor ekspozycji:** biblioteka jest dystrybuowana jako npm package.
Podatność nie dotyka wyłącznie jednego systemu — eksponuje PII we **wszystkich
aplikacjach konsumenckich**, które użyją `includePayload: true`.

**Komponenty w zasięgu analizy:**

- `createLoggingWrapper` — wraps handler methods, linia 92-93
  (`logData.payload = commandOrQuery`)
- `CQRSLoggingOptions` — interface z `maskSensitiveData?: boolean`
  (zdefiniowany, ale nieużywany)
- `DataMasker` — istniejący util z wzorcami regex (email, SSN, karta, telefon) +
  `sensitiveKeys`
- Transport logów: dowolny `Logger` dostarczony przez konsumenta (nie
  kontrolowany przez bibliotekę)

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID  | Zagrożenie                                                                                                                                                                     | Wektor                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| S1  | Aktor zewnętrzny podaje spreparowany payload z polami o „niewinnych" nazwach maskujących dane wrażliwe (np. `userReference` zamiast `userId`) w celu ominięcia `sensitiveKeys` | Opiera się na niekompletnej liście kluczy                 |
| S2  | Aktor wewnętrzny przekazuje własny obiekt `Logger`, który loguje do kanału zewnętrznego niewidocznego w audycie                                                                | Możliwe przez `contextName` + zastąpienie `DefaultLogger` |

**Ocena S1:** Ryzyko realne przy `sensitiveKeys` jako jedyna ochrona. Łagodzone
przez wzorce regex (email/SSN/karta/telefon) działające na wartości strings,
niezależnie od nazwy klucza.

**Ocena S2:** Poza scope tej poprawki — dotyczy architektury `Logger`.

---

### T — Tampering (Manipulacja danymi)

| ID  | Zagrożenie                                                                                                                                                            | Wektor                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| T1  | Atakujący (SSRF/MITM) czyta surowe logi z transportu zewnętrznego; logi zawierają tokeny JWT → możliwe replay attack / session hijacking                              | Dane logów niebędące pod kontrolą biblioteki |
| T2  | Payload zawiera obiekty cykliczne (circular refs) — `DataMasker` używa `WeakSet` jako ochronę, ale źle skonstruowany obiekt może spowodować wyjątek przed maskowaniem | Edge case przy serialize                     |

**T1 DREAD:**

- Damage: 3 — pełen dostęp do sesji użytkownika
- Reproducibility: 3 — dostęp do systemu logów wystarczy
- Exploitability: 2 — wymaga dostępu do logów (insider / kompromitacja
  infrastruktury)
- Affected users: 3 — wszyscy użytkownicy z active session
- Discoverability: 2 — wymaga inspekcji logów
- **Score: 13/15**

**T2 DREAD:**

- Damage: 2 — wyjątek zatrzymuje logowanie, nie aplikację (błąd cichy)
- Reproducibility: 2 — wymaga spreparowanego payloadu
- Exploitability: 1 — wewnętrzna edge case
- Affected users: 1 — tylko handler z circular ref
- Discoverability: 2
- **Score: 8/15**

---

### R — Repudiation (Zaprzeczenie)

| ID  | Zagrożenie                                                                                                                                      | Wektor                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| R1  | Brak mechanizmu audit trail potwierdzającego, że maskowanie faktycznie nastąpiło — log nie zawiera znacznika `masked: true`                     | Brak observability nad działaniem maskera |
| R2  | Użytkownik systemu zaprzecza akcji, bo logi nie zawierają `userId` (zamaskowanego poprawnie), ale zawierają inne korelatory (np. `commandName`) | Przy zbyt agresywnym maskowaniu           |

**R1** wskazuje na wartość dodania flagi `masked: true` / `payloadMasked: true`
do `logData` gdy maskowanie jest aktywne.

---

### I — Information Disclosure (Ujawnienie informacji)

**Główne zagrożenie dla VS-001.** Aktualna linia 93:

```typescript
logData.payload = commandOrQuery; // brak maskowania
```

| ID  | Zagrożenie                                                                                                                           | Scenariusz                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| I1  | **CRITICAL** — hasła, tokeny JWT, klucze API trafiają do logów produkcyjnych                                                         | `CreateUserCommand { email, password, token }`      |
| I2  | **HIGH** — dane RODO/GDPR (imię, adres, PESEL) w logach przechowywanych > 30 dni                                                     | Naruszenie art. 5(1)(e) RODO (zasada minimalizacji) |
| I3  | **MEDIUM** — payload komendy w logach ujawnia wewnętrzną strukturę domenową konsumentowi logów                                       | Insider threat / data breach przez trzecią stronę   |
| I4  | **LOW** — przy `includePayload: true` logowane są WAŻNE właściwości przed i po handleru (duplicate log entry) — dwukrotna ekspozycja | Linie 92 i 102 logują `logData` z payload           |

**I1 + I4 DREAD (łączny):**

- Damage: 3 — pełna ekspozycja credentials
- Reproducibility: 3 — każde wywołanie z `includePayload: true`
- Exploitability: 3 — zerowe wymagania — logi są w systemie
- Affected users: 3 — wszyscy użytkownicy aplikacji konsumenckiej
- Discoverability: 3 — natychmiastowe przy przeglądaniu logów
- **Score: 15/15** ← główny target VS-001

---

### D — Denial of Service

| ID  | Zagrożenie                                                                                                                          | Wektor                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| D1  | Bardzo duży payload (np. lista 10 000 elementów) → `DataMasker.maskRecursive` iteruje cały obiekt głęboko; może blokować event loop | Specjalnie spreparowany payload  |
| D2  | Zbyt wiele pól w `sensitiveKeys` → regex matching O(n×m) przy każdym logu                                                           | Misconfiguracja przez konsumenta |

**D1 DREAD:**

- Damage: 2 — degradacja wydajności, nie crash
- Reproducibility: 2 — wymaga dużego payloadu
- Exploitability: 2 — tylko przy `maskSensitiveData: true`
- Affected users: 2 — pogorszenie czasu odpowiedzi
- Discoverability: 1
- **Score: 9/15**

**Mitigacja D1:** `DataMasker` powinien mieć limit głębokości rekursji lub
limitu kluczy (current: brak). Rekomendacja: cap na 5 poziomów głębokości lub
100 kluczy. Poza scope VS-001, ale warto zanotować.

---

### E — Elevation of Privilege (Eskalacja uprawnień)

| ID  | Zagrożenie                                                                                           | Wektor                                     |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| E1  | Token JWT w payloadzie → atakujący z dostępem do logów uzyskuje uprawnienia zalogowanego użytkownika | Replay attack z tokenem z logów            |
| E2  | API key / service secret w payloadzie → dostęp do zintegrowanych serwisów                            | `RegisterWebhookCommand { apiKey: "..." }` |

**E1 DREAD:**

- Damage: 3 — pełne przejęcie sesji/uprawnień
- Reproducibility: 3 — token w logach = gotowy replay
- Exploitability: 2 — wymaga dostępu do logów
- Affected users: 2 — konkretni użytkownicy z wykradzionym tokenem
- Discoverability: 2
- **Score: 12/15**

---

## DREAD Score Summary

| Zagrożenie                           | D   | R   | E   | A   | Di  | Total  | Priorytet |
| ------------------------------------ | --- | --- | --- | --- | --- | ------ | --------- |
| I1+I4 — PII w logach (VS-001 target) | 3   | 3   | 3   | 3   | 3   | **15** | CRITICAL  |
| T1 — JWT replay z logów              | 3   | 3   | 2   | 3   | 2   | **13** | HIGH      |
| E1 — Token → eskalacja uprawnień     | 3   | 3   | 2   | 2   | 2   | **12** | HIGH      |
| D1 — DoS przez duży payload          | 2   | 2   | 2   | 2   | 1   | **9**  | MEDIUM    |
| T2 — Circular ref wyjątek            | 2   | 2   | 1   | 1   | 2   | **8**  | LOW       |
| R1 — Brak audit trail maskowania     | 1   | 2   | 1   | 2   | 2   | **8**  | LOW       |

---

## LINDDUN Privacy Analysis

LINDDUN stosowany, ponieważ feature bezpośrednio przetwarza PII (email, hasło,
tokeny, PESEL).

### L — Linkability

Payload komendy może zawierać zarówno `userId` jak i `email` — logi łączą
tożsamość z akcją użytkownika. Gdy logi trafiają do serwisów trzecich (Datadog,
Sentry), powiązanie `userId ↔ email ↔ akcja` jest możliwe cross-system.

**Ryzyko:** HIGH — naruszenie RODO art. 5(1)(a) (zasada minimalizacji przy
przekazywaniu danych).

### I — Identifiability

Email, imię, PESEL w payload → bezpośrednia identyfikacja osoby fizycznej w
logach. Nie wymaga żadnego łączenia — dane same w sobie są identyfikatorem.

**Ryzyko:** CRITICAL — dotyczy I1 bezpośrednio.

### N — Non-repudiation (privacy perspective)

Logi z dokładnym payloadem komendy tworzą niemożliwy do zaprzeczenia zapis akcji
użytkownika — potencjalnie niezgodny z prawem do bycia zapomnianym (RODO art.
17).

**Ryzyko:** MEDIUM — zależy od polityki retencji logów konsumenta.

### D — Detectability

Bez maskowania atakujący z dostępem do logów **natychmiast** wykrywa obecność
PII. Przy maskowanym logowaniu (`[MASKED]`) ujawnia jedynie fakt istnienia
danych wrażliwych, nie ich wartość.

**Ryzyko przed poprawką:** HIGH. **Po poprawce:** LOW.

### D — Disclosure of information

Główny wektor — patrz STRIDE I1. Biblioteka jako wektor dystrybucji: jedna
podatna wersja npm = N aplikacji konsumenckich eksponujących PII.

**Ryzyko:** CRITICAL.

### U — Unawareness

Konsument biblioteki może nie wiedzieć, że `includePayload: true` loguje PII.
Brak JSDoc warning = brak świadomości ryzyka.

**Ryzyko:** HIGH — mitigowane przez zadanie VS-001 (dodanie JSDoc warning).

### N — Non-compliance

Logi zawierające PII bez maskowania → naruszenie:

- **RODO art. 5(1)(f)** — brak odpowiedniej ochrony technicznej danych
- **RODO art. 25** — brak privacy by design/default
- **CCPA** — ujawnienie personal information bez zgody

**Ryzyko:** CRITICAL w jurysdykcjach UE/CA.

---

## Attack Scenarios (Top 3)

### Scenario A: Database Breach via Log Pipeline

```
Attacker → Kompromituje serwis agregacji logów (np. Elasticsearch) →
           Przeszukuje logi pod kątem "password" / "token" →
           Uzyskuje credentials tysięcy użytkowników →
           Replay/credential stuffing attack
```

DREAD: 15 | Prawdopodobieństwo bez poprawki: HIGH

### Scenario B: Insider Threat — Support Engineer

```
Support engineer → Dostęp do logów w celu debugowania →
                   Widzi plaintext email + hasło w logach →
                   Możliwość nieautoryzowanego dostępu do kont użytkowników
```

DREAD: 13 | Prawdopodobieństwo bez poprawki: MEDIUM-HIGH

### Scenario C: GDPR Audit Failure

```
Inspektor RODO → Żąda demonstracji ochrony danych w systemie →
                 Logi zawierają PII bez pseudonimizacji →
                 Naruszenie art. 25 RODO →
                 Kara do 4% rocznego obrotu lub 20M EUR
```

DREAD: N/A (compliance, nie cyberatak) | Ryzyko prawne: CRITICAL

---

## Remediation Requirements

### Must Have (VS-001 scope)

| #   | Wymaganie                                                                                                  | Plik                       | Priorytet |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------- | --------- |
| R1  | Wywołanie `DataMasker.maskData(commandOrQuery)` gdy `maskSensitiveData: true`                              | `cqrs-decorators.ts:92-93` | CRITICAL  |
| R2  | Maskowanie dotyczy OBU logów (przed i po wykonaniu handlera) — linia 92 i logData w linia 102              | `cqrs-decorators.ts`       | CRITICAL  |
| R3  | `sensitiveFields?: string[]` forwarded do `DataMasker({ sensitiveKeys })`                                  | `CQRSLoggingOptions`       | HIGH      |
| R4  | JSDoc warning: "includePayload: true exposes all command fields — use maskSensitiveData: true for PII"     | `CQRSLoggingOptions`       | HIGH      |
| R5  | Testy: email/password/token masked gdy `maskSensitiveData: true`; unmasked gdy `false` lub niezdefiniowany | test file                  | HIGH      |

### Should Have (poza scope VS-001, osobne issues)

| #   | Wymaganie                                                                                   | Zagrożenie            |
| --- | ------------------------------------------------------------------------------------------- | --------------------- |
| S1  | Dodać `payloadMasked: true` do `logData` gdy maskowanie aktywne                             | R1 — audit trail      |
| S2  | Limit głębokości rekursji w `DataMasker` (maks. 5 poziomów)                                 | D1 — DoS              |
| S3  | Domyślna lista `sensitiveKeys` w `DataMasker` (np. `password`, `token`, `secret`, `apiKey`) | I1 — defense-in-depth |

---

## Backward Compatibility Assessment

Zmiany w VS-001 są **w pełni backward-compatible**:

| Scenariusz                                           | Przed                | Po                         |
| ---------------------------------------------------- | -------------------- | -------------------------- |
| `{ includePayload: true }`                           | payload surowy       | payload surowy (bez zmian) |
| `{ includePayload: true, maskSensitiveData: false }` | payload surowy       | payload surowy (bez zmian) |
| `{ includePayload: true, maskSensitiveData: true }`  | payload surowy (bug) | payload maskowany (fix)    |
| `{ includePayload: false }`                          | brak payload         | brak payload (bez zmian)   |

`CQRSLoggingOptions` rozszerzony o opcjonalne `sensitiveFields?: string[]` —
non-breaking addition.

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION — CRITICAL FIX**

Podatność I1 (DREAD 15/15) to najwyższy wynik w audycie 2026-05-26.
Implementacja VS-001 eliminuje główny wektor ekspozycji PII. Ryzyko rezydualne
po wdrożeniu:

- MEDIUM: brak domyślnej listy `sensitiveKeys` → konsumenci muszą świadomie
  skonfigurować maskowanie
- LOW: brak limitu rekursji w `DataMasker` → osobny issue
- LOW: brak `payloadMasked` flagi w logach → osobny issue

Żadne z tych zagrożeń rezydualnych nie blokuje implementacji VS-001.

---

_Generated: 2026-05-27 | Method: STRIDE + DREAD + LINDDUN | Task: VS-001_
