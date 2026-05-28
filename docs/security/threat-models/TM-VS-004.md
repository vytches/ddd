# Threat Model: TM-VS-004

**Feature:** DataMasker — walidacja regex patternów (ochrona przed ReDoS)
**Task:** VS-004-logging-datamasker-redos
**Date:** 2026-05-28
**Method:** STRIDE + DREAD + LINDDUN
**Scope:** `@vytches/ddd-logging` — `data-masker.ts` (kompilacja `options.patterns` → `RegExp`)

---

## Context & Attack Surface

`DataMasker` przyjmuje wzorce regex jako tablicę stringów (`MaskingOptions.patterns: string[]`)
i kompiluje je bez żadnej walidacji w konstruktorze:

```typescript
// data-masker.ts:42-45
this.compiledPatterns = [
  ...defaultPatterns,
  ...this.options.patterns.map(pattern => new RegExp(pattern, 'g')),
];
```

Skompilowane wzorce są stosowane na **hot path** w `maskString()` (każdy log event,
każda wartość typu string w `event.data`, każde wywołanie z dekoratora CQRS po VS-001):

```typescript
// data-masker.ts:104-118
private maskString(str: string): string {
  if (str.length > this.options.maxStringLength) {
    return '[TRUNCATED:string]';
  }
  let masked = str;
  for (const pattern of this.compiledPatterns) {
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, this.options.replacement);
  }
  return masked;
}
```

**Wektory dostarczenia podatnego wzorca:**

1. Hardcoded literal w kodzie konsumenta (`new DataMasker({ patterns: ['(a+)+$'] })`) — błąd dewelopera.
2. Wzorzec z konfiguracji środowiska (`process.env.LOG_MASK_PATTERNS`, JSON config, remote config service).
3. Wzorzec ładowany z bazy danych / panelu admina / API (dynamiczne reguły maskowania per-tenant).
4. Wzorzec z pliku konfiguracyjnego dostarczonego przez admina aplikacji (multi-tenant).

**Charakterystyka katastroficznego backtrackingu w Node.js:**

- Node.js jest single-threaded — V8 regex engine blokuje cały event loop podczas evaluacji.
- `maxStringLength: 1000` (domyślnie) ogranicza pojedynczy input, ale `(a+)+$` na stringu 30 znaków
  to już sekundy CPU; na 100 znaków — minuty.
- Brak ochrony przez `re2` (Google) ani `safe-regex` — biblioteka musi pozostać dependency-free.
- Każdy log event przepuszczony przez `maskString` to kolejna sekwencja podatna —
  amplifikacja przez wolumen logowania.

**Komponenty w zasięgu analizy:**

- `DataMasker` constructor (linia 27-46) — punkt kompilacji wzorców.
- `maskString()` (linia 104-118) — hot path egzekucji.
- `DEFAULT_PATTERNS` (linia 17-22) — wzorce wewnętrzne biblioteki (email, SSN, CC, telefon).
- `MaskingOptions.patterns` — publiczne pole API.
- Konsument: każda aplikacja używająca `DataMasker` bezpośrednio lub przez VS-001/VS-002.

**Zasięg ekspozycji:** Biblioteka npm — wszystkie aplikacje konsumenckie, które
akceptują `patterns` z dowolnego źródła poza hardcoded literal (czyli **większość**
realistycznych deploymentów multi-tenant lub z dynamiczną konfiguracją).

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| S1 | Aktor podszywa się pod administratora konfiguracji i wstrzykuje wzorzec ReDoS przez panel zarządzania regułami maskowania | Wymaga przejęcia konta admina — poza scope biblioteki |
| S2 | Niewalidowany pattern z zewnętrznego config service — atakujący kompromituje config service i wstrzykuje payload | Poza scope — zależy od architektury konsumenta |

**Ocena:** Wektory spoofing są pre-condition do dostarczenia złośliwego wzorca,
ale **sama biblioteka nie weryfikuje pochodzenia wzorców**. Po wdrożeniu VS-004
(walidacja składni) syntaktycznie poprawne wzorce ReDoS nadal przejdą — walidacja
syntaktyczna ≠ analiza wydajności. **Risk: LOW** (z perspektywy library boundary).

---

### T — Tampering (Manipulacja danymi)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| T1 | Atakujący modyfikuje plik konfiguracyjny / env var / remote config wstrzykując wzorzec catastrophic backtracking | `patterns: ['(a+)+$', '^(a|aa)+$', '(.*a){10}']` |
| T2 | Patch (typosquatting) zależności konsumenta podstawia złośliwy default pattern w wrapperze nad DataMasker | Supply chain — poza scope biblioteki |
| T3 | Programista wprowadza ReDoS przypadkowo, kopiując regex z internetu bez testów wydajności | Brak walidacji = brak feedbacku przy wdrożeniu |

**T1 DREAD:**
- Damage: 3 — pełne zatrzymanie procesu Node.js, niedostępność usługi
- Reproducibility: 3 — pojedyncza linia konfiguracji + jeden log event z dopasowanym stringiem
- Exploitability: 2 — wymaga write access do konfiguracji (zależne od architektury)
- Affected users: 3 — wszyscy użytkownicy aplikacji konsumenckiej (pełna niedostępność)
- Discoverability: 2 — `MaskingOptions.patterns` jest publicznym API, łatwo zauważalne
- **Score: 13/15 → CRITICAL** (przy założeniu zewnętrznego źródła patternów)

**T3 DREAD (niezależnie):**
- Damage: 3, Reproducibility: 3, Exploitability: 1, Affected users: 3, Discoverability: 1
- **Score: 11/15 → HIGH** (programistyczny błąd jest realnym wektorem nawet bez atakującego)

---

### R — Repudiation (Zaprzeczenie)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| R1 | ReDoS zawiesza proces przed dokończeniem zapisu loga → utracony audit trail wydarzenia, które wywołało blokadę | `maskString` blokuje event loop → log nie trafia do sinka |
| R2 | Po crash/restart procesu nie ma śladu wskazującego, że to wzorzec X spowodował hang — w log aggregator brak ostatniej linii loga | Brak `pre-flight log` przed `pattern.replace()` |

**R1+R2:** Realne ale wtórne — primary zagrożenie to DoS, repudiacja jest skutkiem ubocznym.

**DREAD:**
- Damage: 1 — utrudniony post-mortem
- Reproducibility: 3
- Exploitability: 1 — wymaga ataku DoS (T1)
- Affected users: 1 — operations team
- Discoverability: 1
- **Score: 7/15 → LOW-MEDIUM**

---

### I — Information Disclosure (Ujawnienie informacji)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| I1 | ReDoS blokuje `maskString` przed `replace()` na innym wzorcu → log event z PII zostaje wypisany bez maskowania **jeśli implementacja by używała timeoutu** | Hipotetyczne — obecnie blokada jest pełna, brak partial masking |
| I2 | Stack trace błędu (`SyntaxError: Invalid regular expression`) lub long-running stuck process generuje crash dump → wzorce w dump zawierają inline data | Realne przy `process.report` / Node.js diagnostic reports |
| I3 | Error message rzucanego `RangeError` z wzorcem w treści → wzorzec wyciekający do logów → jeśli wzorzec sam zawiera PII (np. literal email), wycieka | Po wdrożeniu VS-004: `throw new RangeError(\`...pattern "${pattern}"\`)` — pattern w komunikacie błędu |

**I3** jest sub-issue do uwzględnienia w implementacji VS-004 — error message nie powinien
zawierać unbounded pattern jeśli ten może zawierać dane konfiguracyjne wrażliwe.
Rekomendacja: ograniczyć pattern w error message do `pattern.slice(0, 100)`.

**DREAD I1+I3:**
- Damage: 2, Reproducibility: 1, Exploitability: 1, Affected users: 2, Discoverability: 2
- **Score: 8/15 → MEDIUM**

---

### D — Denial of Service (Główne zagrożenie VS-004)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| D1 | **CRITICAL** — Catastrophic backtracking blokuje event loop → cała aplikacja Node.js przestaje obsługiwać żądania | `(a+)+$`, `^(a*)*$`, `(a\|aa)+`, `(.*a){10}`, `([a-zA-Z]+)*$` na dopasowanym inpucie |
| D2 | **HIGH** — Amplifikacja: każdy log event z dopasowanym stringiem powiela atak — load balancer kieruje ruch do działającej instancji, kaskadowy DoS klastra | Każdy worker / instance dotknięty tym samym wzorcem |
| D3 | **MEDIUM** — Atakujący z kontrolą nad `event.message` lub `event.data` może celowo generować payloady triggerujące backtracking na **default patterns** | Domyślne wzorce (email/SSN/CC/phone) są umiarkowanie odporne, ale email `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` ma `+` na klasach znaków bez nested quantifier → bezpieczny |
| D4 | **MEDIUM** — Programistyczny błąd: deweloper dodaje wzorzec `\\s*(.*\\s*)*` myśląc o "any whitespace-separated tokens" → przypadkowy ReDoS w QA | Brak validation = błąd produkcyjny |

**D1+D2 DREAD (primary threat):**
- Damage: 3 — pełna niedostępność procesu Node.js (single-threaded event loop)
- Reproducibility: 3 — deterministyczny przy znanym wzorcu + matching input
- Exploitability: 2 — wymaga dostarczenia podatnego wzorca + odpowiedniego inputu
- Affected users: 3 — wszyscy użytkownicy każdej instancji z tym wzorcem
- Discoverability: 2 — `MaskingOptions.patterns` jest publicznie udokumentowane
- **Score: 13/15 → CRITICAL**

**Uwaga:** Task metadata podaje `dread_score: 10` (HIGH), ale ta wartość pochodzi z
SECURITY-AUDIT-2026-05-26 i odzwierciedla ryzyko **przed** uwzględnieniem amplifikacji
przez hot path i amplifikacji multi-instance. Threat model szacuje 13 — zalecam
podniesienie task priority do CRITICAL przy planowaniu (mimo że task jest oznaczony jako `high`).

**Ocena domyślnych wzorców biblioteki (`DEFAULT_PATTERNS`):**

| Wzorzec | Analiza | Ocena |
|---------|---------|-------|
| `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b` (email) | Brak nested quantifier; `+` na klasach znaków deterministyczne | SAFE |
| `\b\d{3}-?\d{2}-?\d{4}\b` (SSN) | Stałe długości, opcjonalne separatory | SAFE |
| `\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b` (CC) | Stałe długości | SAFE |
| `\b\d{3}-?\d{3}-?\d{4}\b` (Phone) | Stałe długości | SAFE |

Default patterny są wolne od ReDoS — ryzyko dotyczy **wyłącznie user-supplied patterns**.

---

### E — Elevation of Privilege (Eskalacja uprawnień)

| ID | Zagrożenie | Wektor |
|----|-----------|--------|
| E1 | Atakujący wywołuje DoS na instancji autoryzacyjnej → rate limiter przestaje działać → możliwy brute force / credential stuffing na innych endpointach | Zależne od architektury konsumenta |
| E2 | Hang procesu loggera → mechanizmy security (audit log, intrusion detection) tracą wpis o aktywności atakującego → eskalacja bez śladu | Dotyczy każdej aplikacji używającej DataMasker dla audit logs |

**E2 DREAD:**
- Damage: 2 — brak audit trail dla aktywności w trakcie hangu
- Reproducibility: 2
- Exploitability: 1 — wymaga koordynacji DoS + akcji
- Affected users: 2
- Discoverability: 1
- **Score: 8/15 → MEDIUM**

---

## DREAD Score Summary

| Zagrożenie | D | R | E | A | Di | Total | Priorytet |
|-----------|---|---|---|---|----|-------|-----------|
| D1+D2 — ReDoS hot path + amplifikacja klastra | 3 | 3 | 2 | 3 | 2 | **13** | CRITICAL |
| T1 — Wstrzyknięcie wzorca przez konfigurację | 3 | 3 | 2 | 3 | 2 | **13** | CRITICAL |
| T3 — Programistyczny błąd (skopiowany regex) | 3 | 3 | 1 | 3 | 1 | **11** | HIGH |
| I1+I3 — Wyciek przez error message / crash dump | 2 | 1 | 1 | 2 | 2 | **8** | MEDIUM |
| E2 — Utrata audit trail w trakcie DoS | 2 | 2 | 1 | 2 | 1 | **8** | MEDIUM |
| R1+R2 — Repudiacja przez utracony log | 1 | 3 | 1 | 1 | 1 | **7** | LOW |

---

## LINDDUN Privacy Analysis

VS-004 jest **przede wszystkim security (DoS)**, ale ma istotne implikacje prywatności
przez powiązanie z VS-001/VS-002.

### L — Linkability

Nie dotyczy bezpośrednio.

### I — Identifiability

Nie dotyczy bezpośrednio (DataMasker chroni przed identyfikacją; ReDoS osłabia tę ochronę).

### N — Non-repudiation (privacy perspective)

Brak.

### D — Detectability

Hang procesu jest natychmiast wykrywalny przez monitoring (healthcheck, CPU spike).
**Ryzyko: LOW** — DoS jest "głośny", paradoksalnie chroniony przez własną widoczność.

### D — Disclosure of information

**Kluczowy efekt uboczny:** Jeśli DataMasker zawiesi się przed zakończeniem maskowania,
dane wrażliwe **nie trafiają do logu** (proces zablokowany) — czyli VS-001/VS-002 paradoksalnie
"chronią się" przez crash. Jednak po implementacji VS-004 (walidacja w konstruktorze)
podatne wzorce nie są nawet kompilowane → istniejące maskowanie działa poprawnie.

**Ryzyko po poprawce:** LOW.

### U — Unawareness

Konsumenci nie są świadomi, że `MaskingOptions.patterns` jest publicznym ABI bez walidacji.
JSDoc warning po VS-004 eliminuje ten gap.

**Ryzyko przed poprawką:** HIGH. **Po poprawce:** LOW.

### N — Non-compliance

- **RODO art. 32** — wymóg "appropriate technical measures" — brak walidacji input do
  mechanizmu ochrony danych (DataMasker) podważa "appropriateness" tej ochrony.
- **NIS2 / DORA** — wymogi resilience: ReDoS w hot path loggera = pojedynczy point of failure.
- **OWASP ASVS V5.3.4** — input validation dla regex patterns.

**Ryzyko przed poprawką:** MEDIUM (wymóg implicit). **Po poprawce:** LOW.

---

## Attack Scenarios (Top 3)

### Scenario A: Production DoS via Config Service

```
Admin / atakujący z dostępem do panelu konfiguracji wprowadza wzorzec
"(a+)+$" jako custom masking rule dla nowego typu pól →
deployment podnosi pody z nową konfiguracją →
pierwsze żądanie z payloadem zawierającym sekwencję 'a' (e-mail, user-agent,
nazwa pliku) trafia do DataMasker.maskString() →
event loop hanguje na pojedynczej linii →
healthcheck failuje → orchestrator restartuje pod →
kolejny pod podnosi się z tą samą konfiguracją → infinite restart loop →
pełna niedostępność usługi
```
DREAD: 13 | Prawdopodobieństwo bez poprawki: HIGH przy dynamic config.

**Mitygacja VS-004 (Option A):** Walidacja syntaktyczna **nie wystarcza** —
`(a+)+$` jest składniowo poprawny.
**Rekomendowana dodatkowa mitygacja:** Heurystyka detekcji nested quantifiers
(`/(\+|\*|\{\d+,\d*\}).*?(\+|\*|\{\d+,\d*\})/` jako szybki pre-check) — opcjonalne,
poza scope VS-004 ale do rozważenia jako VS-004-stretch.

### Scenario B: Developer Mistake in QA → Prod

```
Deweloper dodaje custom pattern dla wewnętrznego formatu ID:
"new DataMasker({ patterns: ['(\\d+)+_internal'] })" →
testy jednostkowe przechodzą (short strings) →
QA przechodzi (rozsądny ruch) →
produkcja: jeden user-agent / długi token w logach triggeruje backtracking →
incident
```
DREAD: 11 | Prawdopodobieństwo: MEDIUM-HIGH (brak walidacji = brak signala dla devleopera).

**Mitygacja VS-004:** Walidacja syntaktyczna **nie pomoże** (wzorzec syntaktycznie poprawny),
ale JSDoc warning + przykłady ReDoS w dokumentacji podnoszą świadomość.

### Scenario C: Multi-tenant Config Tampering

```
Multi-tenant SaaS przechowuje `patterns` per-tenant w bazie danych →
admin tenanta T1 wprowadza wzorzec ReDoS →
shared logger worker processuje logi wszystkich tenantów →
DataMasker jest re-instancjonowany per-event z tenant-specific patterns →
T1 DoS-uje shared worker → cross-tenant impact
```
DREAD: 13 | Prawdopodobieństwo: HIGH przy multi-tenant SaaS z per-tenant config.

**Mitygacja:** Pełna ochrona wymaga `safe-regex` lub timeout wrapper (oba poza scope
biblioteki). VS-004 redukuje powierzchnię ataku tylko dla syntaktycznie niepoprawnych
wzorców (fat-finger config), nie chroni przed świadomym atakiem.

---

## Relacja do VS-001/VS-002/VS-003

| Aspekt | VS-001 (CQRS decorators) | VS-002 (ConsoleProvider) | VS-003 (plural keys) | VS-004 (ReDoS) |
|--------|-------------------------|-------------------------|--------------------|---------------|
| Plik | `cqrs-decorators.ts` | `console-provider.ts` | `data-masker.ts:120-125` | `data-masker.ts:42-45` |
| Kategoria | Info Disclosure | Info Disclosure | Info Disclosure | Denial of Service |
| Hot path? | Tak (per handler) | Tak (per log event) | Tak (per key) | **Tak (per string value)** |
| DREAD | 15 | 12 | 10 | **13** |
| Czy VS-001/002/003 wystarczą? | — | — | — | ❌ Nie — ortogonalny wektor |

**VS-004 jest niezależnym wektorem.** VS-001/002/003 dodały masking jako mitygację dla PII;
VS-004 chroni samą mitygację przed unieruchomieniem. Po VS-001/002 **każdy log event**
może przejść przez `maskString()` → powierzchnia ataku ReDoS rośnie liniowo z wolumenem
logowania. Implementacja VS-004 **przed** wzrostem wolumenu logowania (po VS-001/002)
jest istotna.

---

## Remediation Requirements

### Must Have (VS-004 scope — zgodne z task spec Option A)

| # | Wymaganie | Plik | Priorytet |
|---|-----------|------|-----------|
| R1 | Wrap `new RegExp(pattern, 'g')` w try/catch → `RangeError` z czytelną wiadomością | `data-masker.ts:42-45` | CRITICAL |
| R2 | Error message: `\`DataMasker: invalid regex pattern "${pattern.slice(0, 100)}"\`` — ograniczenie długości aby nie wyciekać dużych payloadów konfiguracji | `data-masker.ts` | HIGH (I3) |
| R3 | Walidacja w konstruktorze (fail-fast), **nie** w `maskString` (hot path) | `data-masker.ts` constructor | CRITICAL |
| R4 | JSDoc na `MaskingOptions.patterns`: ostrzeżenie o ReDoS z przykładami niebezpiecznych wzorców (`(a+)+`, `(.*)*`, `(a\|aa)+`) | `data-masker.ts:3` | HIGH |
| R5 | Test: `new DataMasker({ patterns: ['[invalid'] })` → `RangeError` w konstruktorze | tests | CRITICAL |
| R6 | Test: error message zawiera (skróconą) wartość wzorca | tests | MEDIUM |
| R7 | Test: walidne wzorce kompilują się bez błędu (regression) | tests | HIGH |

### Should Have (poza scope VS-004 — propozycje follow-up)

| # | Wymaganie | Zagrożenie | Komentarz |
|---|-----------|-----------|-----------|
| S1 | Heurystyka detekcji nested quantifiers (regex `/[+*]\w*[+*]/` jako pre-check) | T1/T3 — CRITICAL | Łatwy do wdrożenia, redukuje 80% przypadków programistycznych |
| S2 | Dokumentacja: rekomendacja użycia `re2` lub `safe-regex` w warstwie konsumenta dla dynamicznych patternów | T1 — CRITICAL | Adapter recipe, **nie** dependency biblioteki |
| S3 | Telemetria: licznik `maskString_duration_ms` z timeout warning > 100ms | D1 detection | Wymagałoby breaking change w API |
| S4 | Limit liczby user-supplied patterns (`patterns.length <= 50`) | T1 — DoS amplifikacja | Łatwy do wdrożenia |

### Won't Have (świadomie poza scope)

| # | Decyzja | Uzasadnienie |
|---|---------|--------------|
| W1 | Brak `safe-regex` / `re2` jako hard dependency | Library musi pozostać zero-dep (memory/feedback_no_external_deps) |
| W2 | Brak runtime timeout dla regex evaluation | Node.js nie wspiera natywnie; worker_threads + AbortSignal = overkill dla biblioteki |
| W3 | Brak whitelist patternów | Sprzeczne z elastycznością API |

---

## Backward Compatibility Assessment

| Scenariusz | Przed | Po |
|-----------|-------|-----|
| `new DataMasker()` (default) | OK | OK (bez zmian) |
| `new DataMasker({ patterns: ['\\d+'] })` (walidny) | OK | OK (bez zmian) |
| `new DataMasker({ patterns: ['[invalid'] })` (składnia) | `SyntaxError` z silnika V8, niejasny komunikat | `RangeError` z czytelnym kontekstem |
| `new DataMasker({ patterns: ['(a+)+'] })` (ReDoS) | Kompiluje → DoS w runtime | **Kompiluje → DoS w runtime** (walidacja syntaktyczna nie wykrywa) |

**Zmiana jest backward-compatible dla walidnych patternów.** Konsumenci z niepoprawnymi
wzorcami otrzymują teraz `RangeError` zamiast `SyntaxError` z V8 — technicznie to zmiana
typu wyjątku (`SyntaxError` → `RangeError`), ale:

1. Niepoprawny pattern był **bugiem konsumenta**, nie ścieżką produkcyjną.
2. `RangeError` jest semantycznie poprawniejszy (zakres niepoprawnych wartości input).
3. Komunikat błędu zawiera teraz wartość patternu — łatwiejszy debug.

**Recommendation:** Udokumentować w CHANGELOG jako "fix" (nie "breaking"). Konsumenci
łapiący ogólny `Error` lub `unknown` nie zauważą różnicy.

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION — CRITICAL PRIORITY (uplift z HIGH)**

VS-004 redukuje powierzchnię ataku **tylko dla syntaktycznie niepoprawnych wzorców**
(scenariusze: fat-finger config, opuszczone metaznaki, błędne escape). To realne ryzyko,
ale **nie wyczerpuje wektora ReDoS** — semantycznie podatne wzorce (`(a+)+`) nadal
przechodzą walidację składniową.

**Ryzyko rezydualne po wdrożeniu:**

- **CRITICAL** (akceptowane): świadomy atak przez dostarczenie semantycznie podatnego patternu.
  Mitygacja wymagałaby `re2` lub `safe-regex` — sprzeczne z polityką zero-dep biblioteki.
  Konsumenci akceptujący dynamic patterns z external source muszą sami zaimplementować
  ochronę przed ReDoS (S2 — adapter recipe w dokumentacji).
- **MEDIUM**: programistyczny błąd przy ręcznie wpisywanym patternie — łagodzone przez
  JSDoc warning (R4) i przykłady. **Stretch goal S1 (heurystyka nested quantifiers)
  redukowałaby to do LOW** — rekomendowane jako VS-004 follow-up.
- **LOW**: wyciek wzorca w error message — łagodzone przez `pattern.slice(0, 100)` (R2).

**Sygnalizacja dla planera:** Task `dread_score: 10` w metadanych jest zbyt niski
względem analizy threat modelu (13). Rozważyć podniesienie `priority: critical` lub
zachowanie `high` z notatką, że VS-004 jest częściową mitygacją i należy zaplanować
follow-up dla pełnej ochrony przed świadomym atakiem.

**Bloker dla implementacji:** brak. Można przystąpić zgodnie z planem zadania.

---

_Generated: 2026-05-28 | Method: STRIDE + DREAD + LINDDUN | Task: VS-004 | Audit ref: SEC-LOGGING-001_
