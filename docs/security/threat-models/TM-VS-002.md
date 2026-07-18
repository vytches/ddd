# Threat Model: TM-VS-002

**Feature:** ConsoleProvider — optional DataMasker for `event.data` **Task:**
VS-002-logging-console-provider-masking **Date:** 2026-05-27 **Method:**
STRIDE + DREAD + LINDDUN **Scope:** `@vytches/ddd-logging` —
`console-provider.ts`, `ConsoleProviderOptions`, `formatPretty`,
`formatStructured`

---

## Context & Attack Surface

`ConsoleProvider` jest domyślnym i najpowszechniej stosowanym sinkiemloga w
ekosystemie `@vytches/ddd-logging`. Serializuje `event.data` przez
`JSON.stringify` bez żadnego filtrowania w obu ścieżkach wyjścia:

```typescript
// formatPretty (linia 63):
const data = event.data ? ` ${JSON.stringify(event.data)}` : '';

// formatStructured (linia 71-75):
...(event.data && { data: event.data }),
return JSON.stringify(logObject);
```

**Kluczowa różnica od VS-001:** VS-001 maskowało payload na wejściu do systemu
logowania (w dekoratorach CQRS). VS-002 to niezależny wektor — `ConsoleProvider`
jest używany bezpośrednio przez konsumentów
(`logger.info('msg', { email, password })`) **z pominięciem dekoratorów**.
Implementacja VS-001 nie eliminuje podatności VS-002.

**Komponenty w zasięgu analizy:**

- `formatPretty()` — czytelny output do stdout, używany domyślnie
  (`prettyPrint: true`)
- `formatStructured()` — JSON output, aktywowany przez `prettyPrint: false`
- `ConsoleProviderOptions` — brak pola `masker` w obecnej wersji
- `event.data` — dowolny `Record<string, unknown>` podany przez konsumenta
- Destinations: stdout → terminal, plik logów, agregator (PM2, Docker, systemd,
  Datadog)

**Zasięg ekspozycji:** biblioteka npm dystrybuowana do wszystkich konsumentów.
Każda aplikacja używająca `ConsoleProvider` (domyślna konfiguracja) jest
dotknięta.

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID  | Zagrożenie                                                                                                                               | Wektor                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| S1  | Konsument przekazuje spreparowane dane z kluczami imitującymi metadane loggera (`level`, `timestamp`) — wstrzykiwanie pól do JSON output | `formatStructured` spread bez sanityzacji kluczy `event.data`                  |
| S2  | Aktor zewnętrzny podmienia `console.info/debug/warn/error` globalnie (monkey patching w Node.js) — przechwytuje PII przed maskowaniem    | Możliwe gdy `ConsoleProvider` jest używany w środowisku z ograniczoną izolacją |

**S1:** Możliwy ale ograniczony — `logObject` ma stały schemat, `event.data`
jest zagnieżdżone pod kluczem `data`, nie spread do korzenia. Ryzyko LOW.

**S2:** Poza scope biblioteki — dotyczy środowiska uruchomieniowego konsumenta.

---

### T — Tampering (Manipulacja danymi)

| ID  | Zagrożenie                                                                                                                                 | Wektor                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| T1  | Atakujący z dostępem do pliku logów modyfikuje wpisy (usuwa/zmienia wrażliwe dane) — brak integralności logów                              | Stdout przekierowany do pliku bez hash/podpisu                           |
| T2  | Log injection — `event.message` lub `event.data` zawiera znaki nowej linii (`\n`) — wstrzykiwanie fałszywych wpisów logów w `formatPretty` | `formatPretty` buduje string przez konkatenację bez sanityzacji newlines |

**T2 DREAD:**

- Damage: 2 — fałszywe wpisy logów, trudniejszy audyt
- Reproducibility: 3 — trywialny przy kontroli `event.message`
- Exploitability: 2 — wymaga dostarczenia danych do loggera (wewnętrzna)
- Affected users: 1 — jakość logów, nie bezpośredni atak
- Discoverability: 2
- **Score: 10/15**

---

### R — Repudiation (Zaprzeczenie)

| ID  | Zagrożenie                                                                                                             | Wektor                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| R1  | Brak timestampa z dokładnością do ms w `formatPretty` — `.toISOString()` zwraca ms, ale format nie jest tamper-evident | Logi modyfikowalne po zapisie                              |
| R2  | Przy braku maskowania — logi zawierają PII → muszą być usunięte po incydencie → brak audit trail                       | RODO art. 17 koliduje z potrzebą retencji logów dla audytu |

**R2** jest tą samą kolizją co w VS-001, ale dotyczy innego sinka. Po VS-001
CQRS logi mogą być bezpieczne, ale logi z `ConsoleProvider` (bezpośrednie
wywołania) nadal naruszają retencję.

---

### I — Information Disclosure (Ujawnienie informacji)

**Główne zagrożenie VS-002.** Oba formaty output ujawniają `event.data` bez
filtrowania.

| ID  | Zagrożenie                                                                                                           | Scenariusz                                         |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| I1  | **HIGH** — PII w stdout → plik logów → niezabezpieczony system                                                       | `logger.info('User created', { email, password })` |
| I2  | **HIGH** — `formatStructured` (JSON) → agregator logów (Datadog, Elasticsearch) → PII w zewnętrznej bazie            | Produkcyjny JSON sink z `prettyPrint: false`       |
| I3  | **MEDIUM** — stdout widoczny w `docker logs`, `journalctl`, PM2 dashboard — dostęp przez niezaufanych devops         | Multi-tenant deployment                            |
| I4  | **MEDIUM** — logi z PII w testach CI (stdout) → artefakty CI/CD (GitHub Actions, GitLab logs) — dostęp osób trzecich | `prettyPrint: true` w środowisku testowym          |

**Dlaczego I1 jest HIGH a nie CRITICAL (jak I1 w VS-001)?** VS-002 DREAD = 11 vs
VS-001 DREAD = 15. Różnica: VS-001 dotyczył CQRS handlerów — gwarantowane
miejsce przepływu danych produkcyjnych. VS-002 dotyczy ConsoleProvider, który
często jest wyłączony w produkcji (zastąpiony przez Datadog/Elasticsearch
provider) lub skonfigurowany bez PII w `event.data`. Ryzyko realne ale zależne
od konfiguracji konsumenta.

**I1+I2 DREAD:**

- Damage: 3 — pełna ekspozycja PII w logach
- Reproducibility: 2 — wymaga `event.data` z PII (zależy od konsumenta)
- Exploitability: 2 — dostęp do logów/stdout
- Affected users: 3 — wszyscy użytkownicy aplikacji konsumenckiej
- Discoverability: 2 — przegląd logów ujawnia natychmiast
- **Score: 12/15**

---

### D — Denial of Service

| ID  | Zagrożenie                                                                                                                    | Wektor                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| D1  | Bardzo duże `event.data` → `JSON.stringify` może blokować event loop przy cyklicznych referencjach lub głębokim zagnieżdżeniu | Bez ochrony circular refs w obecnej implementacji |
| D2  | DataMasker (po wdrożeniu) na hot path logowania — każdy log z `event.data` przechodzi przez `maskRecursive`                   | Overhead zależy od rozmiaru `event.data`          |

**D1:** `JSON.stringify` rzuca
`TypeError: Converting circular structure to JSON` — crash providera. Obecna
implementacja nie ma `try/catch`. Po VS-002 (dodanie DataMasker), `maskData()`
obsługuje circular refs przez `WeakSet` → zamiana na `'[Circular Reference]'` →
`JSON.stringify` może działać poprawnie. VS-002 de facto naprawia ten edge case
jako efekt uboczny.

**D2 DREAD:**

- Damage: 1 — spowolnienie logowania
- Reproducibility: 2
- Exploitability: 1 — tylko przy bardzo dużych payloadach
- Affected users: 2
- Discoverability: 1
- **Score: 7/15**

---

### E — Elevation of Privilege (Eskalacja uprawnień)

| ID  | Zagrożenie                                                                                                                                   | Wektor                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| E1  | Token JWT / API key w `event.data` → stdout → plik logów → replay attack                                                                     | Jak VS-001 E1, ale przez inny sink |
| E2  | `formatStructured` JSON output → agregator parsuje `data.token` → insider z dostępem do dashboardu Datadog/Kibana ma pełny dostęp do tokenów | Częsty scenariusz produkcyjny      |

**E2** jest bardziej prawdopodobny niż w VS-001, bo agregatory logów (Datadog,
Kibana) mają UI z wyszukiwarką po polach JSON — `data.token:*` zwraca wszystkie
tokeny w strukturalnym interfejsie, bez konieczności ręcznego przeszukiwania
plików.

**E1+E2 DREAD:**

- Damage: 3 — pełne przejęcie sesji/zasobów
- Reproducibility: 2 — zależy od tego czy `event.data` zawiera tokeny
- Exploitability: 2 — wymaga dostępu do logów/dashboardu
- Affected users: 2
- Discoverability: 2
- **Score: 11/15**

---

## DREAD Score Summary

| Zagrożenie                                | D   | R   | E   | A   | Di  | Total  | Priorytet |
| ----------------------------------------- | --- | --- | --- | --- | --- | ------ | --------- |
| I1+I2 — PII w stdout/agregatach logów     | 3   | 2   | 2   | 3   | 2   | **12** | HIGH      |
| E1+E2 — Token → eskalacja (via agregator) | 3   | 2   | 2   | 2   | 2   | **11** | HIGH      |
| T2 — Log injection przez newline          | 2   | 3   | 2   | 1   | 2   | **10** | MEDIUM    |
| D2 — DataMasker overhead na hot path      | 1   | 2   | 1   | 2   | 1   | **7**  | LOW       |

---

## LINDDUN Privacy Analysis

### L — Linkability

`event.data` może zawierać zarówno identyfikatory (`userId`, `correlationId`)
jak i PII (`email`, `name`) w jednym wpisie loga. Agregatory logów umożliwiają
linkowanie aktywności użytkownika cross-session przez korelację tych pól.

**Ryzyko:** HIGH przy `formatStructured` (JSON indexowany przez agregator).

### I — Identifiability

Bezpośredni identyfikator (email, imię) w `event.data` → logi identyfikują osobę
fizyczną bez żadnego dodatkowego łączenia.

**Ryzyko:** HIGH — dotyczy I1 bezpośrednio.

### N — Non-repudiation (privacy perspective)

Logi JSON z PII tworzą trwały zapis aktywności użytkownika. W agregatach o
retencji

> 30 dni: naruszenie zasady minimalizacji (RODO art. 5(1)(e)).

**Ryzyko:** MEDIUM.

### D — Detectability

Przy `formatStructured`: pola JSON są indeksowane przez agregatora →
wyszukiwanie `data.email:*` natychmiast ujawnia obecność danych osobowych.
Bardziej wykrywalne niż VS-001 (surowe pliki logów).

**Ryzyko przed poprawką:** HIGH. **Po poprawce:** LOW.

### D — Disclosure of information

Dwa kanały równoległe: stdout (terminal/plik) i JSON agregator. VS-002 zamyka
oba.

**Ryzyko:** HIGH.

### U — Unawareness

Konsumenci mogą zakładać, że skoro skonfigurowali masking w CQRS dekoratorach
(VS-001), to `ConsoleProvider` też maskuje. Fałszywe poczucie bezpieczeństwa po
VS-001.

**Ryzyko:** HIGH — VS-002 eliminuje ten false sense.

### N — Non-compliance

- **RODO art. 5(1)(f)** — brak odpowiedniej ochrony technicznej PII w logach
- **RODO art. 25** — brak privacy by design w domyślnym providerze biblioteki
- **CCPA** — ujawnienie personal information

**Ryzyko:** HIGH w jurysdykcjach UE/CA.

---

## Attack Scenarios (Top 3)

### Scenario A: Aggregator Leak via Structured JSON

```
Datadog/Kibana dashboard → field search: data.email:* lub data.password:* →
natychmiastowa lista wszystkich PII w logach →
insider (devops, support) uzyskuje dostęp do danych osobowych
```

DREAD: 12 | Prawdopodobieństwo bez poprawki: HIGH (formatStructured + agregator
= standardowy stack)

### Scenario B: CI Artifacts Exposure

```
Test suite loguje `logger.info('test user', { email, password })` →
stdout CI (GitHub Actions / GitLab) →
logi CI publiczne lub dostępne dla zewnętrznych contributorów →
PII w artefaktach CI
```

DREAD: 10 | Prawdopodobieństwo: MEDIUM (popularna praktyka logowania w testach)

### Scenario C: Docker Logs PII Leak

```
Kontener produkcyjny → docker logs → aggregacja przez EFK stack →
Elasticsearch indeksuje `data.token` →
admin Kibany ma pełny dostęp do tokenów przez UI →
sesje użytkowników możliwe do przejęcia
```

DREAD: 11 | Prawdopodobieństwo: MEDIUM-HIGH

---

## Relacja do VS-001

| Aspekt                | VS-001 (CQRS decorators)                              | VS-002 (ConsoleProvider)                         |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Wektor                | `logData.payload` w dekoratorach                      | `event.data` w providerze                        |
| Scope                 | Handlery z `@LogCommands`/`@LogQueries`               | Wszystkie bezpośrednie wywołania `logger.*`      |
| Czy VS-001 wystarczy? | ❌ Nie — logger.info() bezpośrednie pomija dekoratory |
| Konfiguracja          | Per-decorator (`maskSensitiveData: true`)             | Per-provider (`new ConsoleProvider({ masker })`) |
| DREAD                 | 15/15                                                 | 12/15                                            |

**VS-002 jest niezależnym wektorem** — implementacja obu jest wymagana dla
pełnej ochrony.

---

## Remediation Requirements

### Must Have (VS-002 scope)

| #   | Wymaganie                                                                         | Plik                        | Priorytet |
| --- | --------------------------------------------------------------------------------- | --------------------------- | --------- |
| R1  | Dodać `masker?: DataMasker` do `ConsoleProviderOptions`                           | `console-provider.ts`       | HIGH      |
| R2  | Maskowanie `event.data` w `formatPretty()` przed `JSON.stringify`                 | `console-provider.ts:63`    | HIGH      |
| R3  | Maskowanie `event.data` w `formatStructured()` przed rozpakowaniem do `logObject` | `console-provider.ts:71-75` | HIGH      |
| R4  | JSDoc: przykład konfiguracji z DataMasker                                         | `ConsoleProviderOptions`    | MEDIUM    |
| R5  | Testy: email w `event.data` → masked/unmasked przy obu formatach                  | test file                   | HIGH      |

### Should Have (poza scope VS-002)

| #   | Wymaganie                                                  | Zagrożenie                                           |
| --- | ---------------------------------------------------------- | ---------------------------------------------------- |
| S1  | Sanityzacja newline w `formatPretty` (log injection T2)    | T2 — MEDIUM                                          |
| S2  | try/catch wokół `JSON.stringify` (D1 — circular ref crash) | D1 — po VS-002 DataMasker obsłuży jako efekt uboczny |

---

## Backward Compatibility Assessment

| Scenariusz                                    | Przed                      | Po                       |
| --------------------------------------------- | -------------------------- | ------------------------ |
| `new ConsoleProvider()`                       | brak masking               | brak masking (bez zmian) |
| `new ConsoleProvider({ prettyPrint: false })` | brak masking               | brak masking (bez zmian) |
| `new ConsoleProvider({ masker: dm })`         | (błąd TS — opcja nieznana) | masking aktywny          |

Zmiana jest **w pełni backward-compatible** — `masker` jest opcjonalne,
istniejące konfiguracje działają bez zmian.

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION — HIGH PRIORITY**

VS-002 jest niezależnym wektorem od VS-001. Implementacja VS-001 bez VS-002
pozostawia bezpośrednie wywołania `logger.*` i wszystkich konsumentów
`ConsoleProvider` bez ochrony. Ryzyko rezydualne po wdrożeniu:

- LOW: brak sanityzacji newline w `formatPretty` (log injection) — osobny issue
- LOW: DataMasker overhead przy bardzo dużych `event.data` — zaakceptowane
  (maxDepth/maxStringLength z VS-001)
- LOW: Circular ref crash w `JSON.stringify` — DataMasker obsłuży jako efekt
  uboczny

Żadne z tych zagrożeń rezydualnych nie blokuje implementacji VS-002.

---

_Generated: 2026-05-27 | Method: STRIDE + DREAD + LINDDUN | Task: VS-002_
