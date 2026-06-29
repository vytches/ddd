# Threat Model: TM-VS-014

**Feature:** `configureDiagnostics({ sink, level })` — publiczne API kontroli
diagnostyki wewnętrznej biblioteki (wstrzykiwany sink + poziom) **Task:**
VS-014-internal-diagnostics-control-api **Date:** 2026-06-18 **Method:**
STRIDE + DREAD + LINDDUN **Scope:** `@vytches/ddd-contracts` —
`src/diagnostics/diagnostics-sink.ts` (nowy: `DiagnosticsSink`,
`DiagnosticsLevel`, `DiagnosticsOptions`, `configureDiagnostics`,
`currentSink`/`currentLevel`), `src/internal-logger.ts` (refactor → delegacja),
`src/index.ts` (export); re-export `@vytches/ddd-enterprise` `src/index.ts`.
**ADR:** [0037](../../adr/0037-internal-diagnostics-control-sink-injection.md)

---

## Context & Attack Surface

VS-014 zamienia stały shim `console.warn`/`console.error` (`internal-logger.ts`)
na **publiczne, kontrolowalne API**: konsument może wstrzyknąć własny `sink`
(callback) i ustawić `level`. Trzy nowe elementy powierzchni:

1. **Callback konsumenta wołany przez bibliotekę.** Biblioteka wywołuje
   `currentSink.warn(...)` / `.error(...)` **wewnątrz własnych ścieżek
   sterowania** (~25 call-site'ów: „no handler found", misconfiguration). Sink
   to kod dostarczony z zewnątrz — jego zachowanie (rzucanie wyjątków,
   blokowanie, rekurencja) wpływa na bibliotekę.
2. **Globalny mutowalny stan procesu.** `configureDiagnostics` zapisuje
   module-private `currentSink`/`currentLevel` — semantyka **last-write-wins**
   na poziomie całego procesu Node. Każdy moduł (w tym zależność tranzytywna)
   może go nadpisać.
3. **Niezmiennik prywatności (load-bearing).** ADR-0037 i VS-013 deklarują:
   `internalLogger` otrzymuje **wyłącznie metadane** (nazwy, `error.message`) —
   nigdy payloadów komend/zapytań/eventów, stanu agregatów ani PII. Sink jest
   nowym, konsumencko-kontrolowanym ujściem tych danych, więc **cała ochrona PII
   opiera się na dyscyplinie call-site'ów** — VS-014 nie dodaje maskowania.

**Charakter zmiany:** czysto **addytywna** (nowe eksporty, brak zmian sygnatur)
→ non-breaking, minor (v0.4.0). VS-014 **nie** wprowadza uwierzytelniania, nie
przetwarza nowej kategorii PII per se — przenosi istniejący kanał diagnostyczny
spod kontroli biblioteki pod kontrolę konsumenta. Ryzyko koncentruje się na
**dostępności** (sink jako część ścieżki sterowania) i **utrzymaniu niezmiennika
PII** (sink jako nowe ujście).

**Zasięg ekspozycji:** biblioteka npm — dotyczy **każdej aplikacji
konsumenckiej** wstrzykującej sink; stan globalny dotyczy całego procesu.

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID  | Zagrożenie                                                                                                                                              | Wektor                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| S1  | Brak modelu tożsamości — `configureDiagnostics` nie uwierzytelnia wołającego; dowolny moduł w procesie może podmienić sink (patrz T1, to samo zjawisko) | = T1 (stan globalny); wymaga wykonania kodu już w procesie |

**Ocena: brak nowego istotnego wektora podszywania.** Biblioteka nie ma granicy
tożsamości; „podmiana sinka" to manipulacja stanem (T1), nie spoofing.

---

### T — Tampering (Manipulacja)

| ID  | Zagrożenie                                                                                                                                                                                                                                    | Wektor                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| T1  | **Hijack kanału diagnostycznego przez stan globalny**: zależność tranzytywna woła `configureDiagnostics({ sink: złośliwy })` lub `{ level: 'silent' }` → przechwytuje metadane biblioteki lub wycisza ostrzeżenia, których konsument oczekuje | Last-write-wins, proces-global; wymaga kodu w procesie           |
| T2  | **Mutacja współdzielonej referencji `context`**: jeśli call-site przekazuje do `sink` żywą referencję do wewnętrznego obiektu (nie kopię), sink może ją zmutować i wpłynąć na stan/przebieg biblioteki                                        | Sink + przekazana referencja zamiast kopii/wartości prymitywnych |

**T1 DREAD:**

- D: 2 — wyciszenie diagnostyki / przechwycenie metadanych konfiguracji
- R: 2 — deterministyczne dla atakującego z kodem w procesie
- E: 1 — wymaga już wykonania złośliwego/wadliwego kodu w procesie (nie zdalny
  input)
- A: 1 — konsumenci z niezaufaną zależnością tranzytywną
- Di: 1 — subtelne (cicha podmiana)
- **Score: 7/15 → MEDIUM (dolny)**

**T2 DREAD:** D:1 R:1 E:1 A:1 Di:1 = **5/15 → LOW** (mitygacja: przekazywać do
sinka metadane jako wartości/kopie, nie żywe referencje — patrz R5).

---

### R — Repudiation (Zaprzeczenie)

| ID  | Zagrożenie                                                                                                                                                                                                       | Wektor                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| R1  | **Utrata śladu diagnostycznego**: `level: 'silent'` lub sink połykający wpisy tłumi ostrzeżenia o misconfiguration/„no handler found" → konsument traci sygnał do troubleshootingu i audytu błędnej konfiguracji | Świadomy wybór konsumenta (`silent`) lub wadliwy sink |

**Ocena:** Zachowanie zamierzone (`silent` to feature), ale niesie ryzyko
„cichej" błędnej konfiguracji. **DREAD:** D:1 R:2 E:1 A:1 Di:1 = **6/15 → LOW**.
Rekomendacja: dokumentacja sink-contractu + default `'warn'` (privacy/safety by
default — biblioteka domyślnie mówi głośno).

---

### I — Information Disclosure (Ujawnienie informacji)

| ID  | Zagrożenie                                                                                                                                                                                                                                                            | Wektor                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| I1  | **Złamanie niezmiennika PII**: jeśli którykolwiek (obecny lub przyszły) call-site przekaże do `internalLogger` payload komendy/eventu, stan agregatu lub PII w `message`/`context`, dane trafią do konsumenckiego sinka (potencjalnie do zewnętrznej agregacji logów) | Regresja dyscypliny call-site; sink trwale persystujący logi |
| I2  | **Wrażliwe dane w obiekcie `Error`**: parametr `error?: Error` przekazywany do `sink.error` w całości — `message`/`stack` mogą osadzać wartość, która wywołała błąd (np. odrzucony input), nawet gdy `context` jest czystymi metadanymi                               | Błąd skonstruowany z osadzonym fragmentem payloadu           |

**I1 DREAD:**

- D: 2 — PII w kanale konsumenta; może być routowane do zewnętrznego loga (np.
  Pino → agregacja)
- R: 2 — reprodukowalne tylko jeśli call-site przekaże payload; **dziś
  niezmiennik trzyma** (zweryfikowane w VS-013 2026-06-01) → ryzyko regresyjne
- E: 2 — wymaga przyszłej regresji w call-site; bez atakującego
- A: 2 — konsumenci wstrzykujący sink
- Di: 2 — widoczne przy przeglądaniu logów
- **Score: 10/15 → MEDIUM (górny)** — **najważniejszy niezmiennik do
  utrzymania.** Eskaluje do HIGH, jeśli audyt wykryje choć jeden call-site
  przekazujący payload.

**I2 DREAD:** D:2 R:2 E:2 A:1 Di:2 = **9/15 → MEDIUM**. Mitygacja: konwencja —
do `internalLogger.error` przekazywać `Error` biblioteczny/metadanowy, nigdy
błąd niosący surowy payload; sink-contract ostrzega, że `Error` traktować jako
potencjalnie wrażliwy.

---

### D — Denial of Service

| ID  | Zagrożenie                                                                                                                                                                                                                                                    | Wektor                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| D1  | **Wyjątek z sinka propaguje w ścieżkę sterowania biblioteki**: jeśli `sink.warn`/`sink.error` rzuci, a delegacja nie izoluje wywołania, wyjątek wypływa w miejscu logowania (np. ścieżka dispatch „no handler found") → zaburza/wywraca operację biblioteczną | Sink wadliwy/złośliwy rzucający wyjątek |
| D2  | **Rekurencja/reentrancy**: sink, który sam loguje przez bibliotekę → `internalLogger` → sink → … → przepełnienie stosu                                                                                                                                        | Sink wołający z powrotem kod biblioteki |
| D3  | **Sink blokujący/ciężki (sync)**: kosztowna praca synchroniczna w sinku blokuje ścieżkę wywołania biblioteki (event loop)                                                                                                                                     | Sink z synchronicznym I/O               |

**D1 DREAD:**

- D: 2 — operacja biblioteczna przerwana nieoczekiwanym wyjątkiem ze ścieżki
  diagnostycznej
- R: 3 — deterministyczne: sink rzucający **zawsze** wywraca dany call-path
- E: 2 — wymaga wadliwego sinka; konsumencko-kontrolowane, bez zdalnego
  atakującego
- A: 2 — każdy konsument z błędnym sinkiem
- Di: 2 — ujawnia się przy pierwszym diagnostycznym wywołaniu
- **Score: 11/15 → HIGH** — **główne, w pełni kontrolowalne implementacyjnie
  zagrożenie VS-014.**

**D2 DREAD:** D:1 R:1 E:1 A:1 Di:1 = **5/15 → LOW** (mitygacja: guard reentrancy
lub jasne ostrzeżenie w kontrakcie „nie loguj z sinka"). **D3 DREAD:** D:1 R:2
E:1 A:1 Di:1 = **6/15 → LOW** (kontrakt: sink ma być szybki/nieblokujący;
biblioteka nie awaitsuje sinka).

---

### E — Elevation of Privilege (Eskalacja uprawnień)

| ID  | Zagrożenie                                                                                                                                                                                                      | Wektor |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| E1  | Brak modelu uprawnień w bibliotece — `configureDiagnostics` nie nadaje zdolności wykraczających poza to, co już ma kod w procesie. Sink wykonuje się w kontekście stosu biblioteki, ale to i tak kod konsumenta | n/d    |

**Ocena: brak istotnego ryzyka EoP.** Jedyny niuans (mutacja współdzielonej
referencji) ujęto jako T2.

---

## DREAD Score Summary

| Zagrożenie                                                           | D   | R   | E   | A   | Di  | Total  | Priorytet |
| -------------------------------------------------------------------- | --- | --- | --- | --- | --- | ------ | --------- |
| D1 — Wyjątek z sinka propaguje w ścieżkę sterowania biblioteki       | 2   | 3   | 2   | 2   | 2   | **11** | HIGH      |
| I1 — Złamanie niezmiennika PII → payload do konsumenckiego sinka     | 2   | 2   | 2   | 2   | 2   | **10** | MEDIUM↑   |
| I2 — Wrażliwe dane osadzone w obiekcie `Error` przekazanym do sinka  | 2   | 2   | 2   | 1   | 2   | **9**  | MEDIUM    |
| T1 — Hijack kanału diagnostycznego przez globalny stan (tranzytywny) | 2   | 2   | 1   | 1   | 1   | **7**  | MEDIUM↓   |
| R1 — Utrata śladu diagnostycznego (`silent`/sink połyka)             | 1   | 2   | 1   | 1   | 1   | **6**  | LOW       |
| D3 — Sink blokujący/ciężki blokuje ścieżkę wywołania                 | 1   | 2   | 1   | 1   | 1   | **6**  | LOW       |
| T2 — Mutacja współdzielonej referencji `context` przez sink          | 1   | 1   | 1   | 1   | 1   | **5**  | LOW       |
| D2 — Rekurencja sink → internalLogger → sink                         | 1   | 1   | 1   | 1   | 1   | **5**  | LOW       |

**Sygnalizacja:** Metadane zadania klasyfikują VS-014 jako DX/feature
(„medium"). Threat model wskazuje **dwa** elementy wymagające twardej mitygacji
**przed merge**: izolacja sinka (D1, HIGH — implementacyjnie w pełni
rozwiązywalna) oraz audyt niezmiennika PII (I1, MEDIUM↑ — eskaluje do HIGH,
jeśli choć jeden call-site przekazuje payload). Reszta to LOW/dokumentacja.

---

## LINDDUN Privacy Analysis

PII dotykane **pośrednio**: VS-014 nie loguje PII z założenia, ale tworzy nowy,
konsumencko-kontrolowany kanał, którego bezpieczeństwo zależy w 100% od
utrzymania niezmiennika „metadane-only".

### L — Linkability

Sink otrzymuje wyłącznie metadane biblioteczne (nazwy handlerów, typy) — brak
korelowalnych identyfikatorów użytkownika, **dopóki niezmiennik trzyma**.
Ryzyko: LOW (przy I1 niezłamanym).

### I — Identifiability

Metadane (nazwy klas/handlerów, `error.message` biblioteczny) nie identyfikują
osoby. **Ryzyko: LOW**, eskaluje, jeśli I2 (Error z osadzonym inputem) lub I1
zachodzi.

### N — Non-repudiation

Bez implikacji — kanał diagnostyczny nie jest dowodem prawnym.

### D — Detectability

`level: 'silent'` redukuje liczbę wpisów → mniejsza wykrywalność problemów (R1),
ale i mniejsza powierzchnia ujawnienia. Neutralne dla prywatności.

### D — Disclosure of information

**Główny wektor (I1/I2).** Sink to nowe ujście. Ochrona = niezmiennik
metadata-only + izolacja `Error`. Wymaga audytu ~25 call-site'ów i testu
strażniczego. **Ryzyko: MEDIUM** (regresyjne), redukowalne do LOW przez R2/R3.

### U — Unawareness

Konsument dostarczający sink może nie wiedzieć, że (a) odpowiada teraz za
sanityzację/retencję tego, co biblioteka przekaże, (b) `Error` może nieść
wrażliwy fragment. **Ryzyko: LOW-MEDIUM** — łagodzone jawnym kontraktem sinka
(R3) ostrzegającym „traktuj otrzymane dane jako potencjalnie wrażliwe".

### N — Non-compliance

- **RODO art. 5(1)(c)** (minimalizacja) — niezmiennik metadata-only **wspiera**
  zgodność; jego złamanie (I1) tworzy niezamierzony transfer PII do zewnętrznego
  loggera konsumenta.
- **RODO art. 25** (privacy by default) — default `level: 'warn'` + brak
  payloadów = dobry stan domyślny.

**Ryzyko prywatności netto: LOW-MEDIUM**, warunkowane utrzymaniem niezmiennika.

---

## Attack / Failure Scenarios (Top 2)

### Scenario A: Wadliwy sink wywraca operację biblioteki (D1)

```
Konsument: configureDiagnostics({ sink: { warn(m,c){ pino.warn(c,m) }, error(m,e,c){ throw ... } } })
  (np. sink rzuca przy serializacji cyklicznego context, albo transport loggera padł)
Biblioteka: ścieżka dispatch nie znajduje handlera → internalLogger.error('no handler', err, {type})
  → delegacja woła currentSink.error(...) → sink RZUCA →
  jeśli delegacja NIE izoluje (try/catch) → wyjątek wypływa w ścieżce dispatch →
  operacja konsumenta wywraca się z błędu pochodzącego z KANAŁU DIAGNOSTYCZNEGO, nie z logiki biznesowej
```

DREAD: 11 (HIGH). **Mitygacja R1 (try/catch + fallback):** ✅ izolacja sinka —
diagnostyka nigdy nie może wywrócić ścieżki, którą diagnozuje.

### Scenario B: Regresja call-site przecieka PII do konsumenckiego sinka (I1)

```
Przyszła zmiana: w handlerze dodano internalLogger.warn('rejected command', { command })
  // command zawiera { email, ssn }
Konsument: configureDiagnostics({ sink: pinoSink })  // pino → zewnętrzna agregacja logów
  → sink.warn('rejected command', { command: { email, ssn } }) →
  PII trafia do zewnętrznego systemu logów przez kanał, który z kontraktu miał nieść tylko metadane
```

DREAD: 10 (MEDIUM↑, HIGH po wystąpieniu). **Mitygacja R2/R3:** ✅ audyt
call-site'ów + test strażniczy (spy-sink asercja „brak kluczy payloadu") +
kontrakt sinka „metadane-only".

---

## Remediation Requirements

### Must Have (scope VS-014, przed merge)

| #   | Wymaganie                                                                                                                                                                                                                                                                                                                             | Plik                                   | Priorytet |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------- |
| R1  | **Izolacja sinka**: każde wywołanie `currentSink.warn/error` opakować w `try/catch`. Wyjątek z sinka **nigdy** nie może propagować w ścieżkę sterowania biblioteki. Fallback: cichy `console.error` o awarii sinka (jednorazowo/throttled), bez re-throw.                                                                             | `diagnostics-sink.ts` (delegacja)      | **HIGH**  |
| R2  | **Audyt niezmiennika PII**: przejść ~25 call-site'ów `internalLogger.*` i potwierdzić, że `message`/`context`/`error` niosą wyłącznie metadane (nazwy, typy, `error.message` biblioteczny) — nigdy payloadów/stanu/PII. Wynik udokumentować (NFR „invariant audit").                                                                  | wszystkie call-site'y `internalLogger` | **HIGH**  |
| R3  | **Kontrakt sinka w JSDoc** na `DiagnosticsSink`: (a) może być wołany **synchronicznie w trakcie operacji biblioteki**; (b) **musi nie rzucać** i nie blokować; (c) otrzymuje **metadane biblioteczne**, ale traktować je jako **potencjalnie wrażliwe** (zwłaszcza `Error`); (d) **nie logować z sinka** z powrotem przez bibliotekę. | `DiagnosticsSink` (JSDoc)              | **HIGH**  |
| R4  | **Test strażniczy PII**: spy-sink przechwytuje wszystkie wywołania w teście integracyjnym typowej ścieżki „no handler found"/misconfig i asercja, że przekazane `context` nie zawiera kluczy payloadu (`command`, `query`, `event`, `payload`, `state`).                                                                              | `tests/diagnostics/*.test.ts`          | **HIGH**  |
| R5  | **Test izolacji**: sink rzucający w `warn` i w `error` → operacja biblioteczna **nie** rzuca; fallback wykonany.                                                                                                                                                                                                                      | `tests/diagnostics/*.test.ts`          | **HIGH**  |
| R6  | **Default safety**: brak `configureDiagnostics` ⇒ console sink + `level: 'warn'` (głośny default); `currentSink`/`currentLevel` **nieeksportowane** (brak monkeypatch).                                                                                                                                                               | `diagnostics-sink.ts`                  | HIGH      |

### Should Have (poza krytycznym scope)

| #   | Wymaganie                                                                                                                                                   | Zagrożenie | Komentarz                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| S1  | Przekazywać do sinka `context` jako płytką kopię/wartości prymitywne, nie żywą referencję wewnętrznego obiektu                                              | T2         | Tani; neutralizuje mutację współdzielonej referencji       |
| S2  | Guard reentrancy (flaga „w trakcie emisji") **lub** wyraźne ostrzeżenie w kontrakcie, by nie logować z sinka                                                | D2         | Edge case; ostrzeżenie w R3 zwykle wystarcza               |
| S3  | Dokumentacja: `configureDiagnostics` jest **process-global, last-write-wins** — w środowisku z wieloma konsumentami meta-pakietu ostatnie wywołanie wygrywa | T1/R1      | Już zapisane w Risk Assessment zadania; powtórzyć w README |
| S4  | Lint/konwencja: zakaz przekazywania całych obiektów komend/eventów do `internalLogger.*` (ochrona niezmiennika I1 w przyszłości)                            | I1         | Trwała ochrona regresyjna ponad jednorazowy audyt R2       |

### Won't Have

| #   | Decyzja                                                       | Uzasadnienie                                                                                                                                             |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Brak maskowania/sanityzacji PII w bibliotece (np. DataMasker) | Niezmiennik = „nie loguj PII u źródła"; maskowanie to obowiązek sinka konsumenta ([[feedback_logging_internal_only]], DataMasker anulowany w VS-009/010) |
| W2  | Brak nowych zależności npm                                    | Biblioteka dependency-free ([[feedback_no_external_deps]])                                                                                               |
| W3  | Brak uwierzytelniania `configureDiagnostics`                  | Biblioteka nie ma modelu tożsamości; stan globalny = świadomy trade-off (ADR-0037)                                                                       |

---

## Backward Compatibility Assessment

| Scenariusz                                    | Przed                         | Po (VS-014)                                           |
| --------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Sygnatura publicznego API                     | brak control API              | **+ nowe eksporty** (addytywne) ✅                    |
| `internalLogger` (call-site'y, ~25)           | `console.warn/error` bezpośr. | delegacja do `currentSink` — **bez zmian wywołań** ✅ |
| Konsument bez konfiguracji                    | console, oba poziomy          | console, `level: 'warn'` — **identyczne** ✅          |
| `internalLogger` mutowalny (footgun)          | reassignowalny `const`        | enkapsulowany (private state) — **naprawione** ✅     |
| api-surface snapshot (contracts + enterprise) | —                             | intencjonalna aktualizacja (governed)                 |

**Zmiana backward-compatible** (addytywna). library-api-guardian potwierdza
non-breaking → minor (v0.4.0).

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION** — z dwoma blokującymi wymaganiami (R1, R2/R4).

VS-014 to poprawna decyzja DX (kontrolowalna diagnostyka, koniec footguna
mutowalnego `const`). Nie wprowadza uwierzytelniania ani nowej kategorii PII,
ale przenosi kanał diagnostyczny pod kontrolę konsumenta, co rodzi dwa realne
ryzyka:

- **D1 (11, HIGH)** — wyjątek z konsumenckiego sinka może wypłynąć w ścieżkę
  sterowania biblioteki. **W pełni rozwiązywalne** izolacją (try/catch +
  fallback, R1/R5). To jedyne HIGH i jest implementacyjnie domknięte.
- **I1 (10, MEDIUM↑)** — niezmiennik „metadane-only" jest load-bearing; sink to
  nowe ujście. Wymaga jednorazowego audytu ~25 call-site'ów (R2) + testu
  strażniczego (R4) + kontraktu sinka (R3). Eskaluje do HIGH, jeśli audyt
  znajdzie payload na którymkolwiek call-site.

Pozostałe wektory są LOW/MEDIUM-dolne i adresowane dokumentacją/kontraktem
(T1/T2/I2/R1/D2/D3). **Brak zagrożenia nierozwiązywalnego.**

**Blokery dla merge:** R1 (izolacja sinka) + R2/R4 (audyt + test niezmiennika
PII). Bez nich nie mergować.

**Ryzyko rezydualne po wdrożeniu:**

- **LOW:** globalny stan (T1) — process-global last-write-wins; świadomy
  trade-off (ADR-0037), udokumentowany.
- **LOW:** `Error` z osadzonym wrażliwym fragmentem (I2) — łagodzone konwencją +
  kontraktem sinka; pełna eliminacja poza scope (zależy od dyscypliny
  call-site).

---

_Generated: 2026-06-18 | Method: STRIDE + DREAD + LINDDUN | Task: VS-014 |
ADR-0037 | Related: [[feedback_logging_internal_only]], TM-VS-009
(resolved-by-removal)_
