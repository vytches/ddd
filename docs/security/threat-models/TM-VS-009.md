# Threat Model: TM-VS-009

> **STATUS: RESOLVED-BY-REMOVAL (2026-06-01).** Cała powierzchnia
> (`@LogCommands` / `@LogQueries` / `@LogCQRS` w `@vytches/ddd-logging`) została
> usunięta wraz z warstwą logowania aplikacyjnego — patrz **VS-013** (remove
> application-logging layer). Zagrożenia z tego modelu nie mają już
> zastosowania: nie ma dekoratorów CQRS ani `DataMaskera`. Niezmiennik:
> `internalLogger` loguje wyłącznie metadane biblioteki (nazwy, `error.message`)
> — nigdy payloadów/PII (zweryfikowane na wszystkich call-site'ach 2026-06-01).
> Zadania VS-009/010(datamasker)/011/012 anulowane jako bezprzedmiotowe.

**Feature:** CQRS decorators (`@LogCommands`/`@LogQueries`/`@LogCQRS`) —
owijanie tylko metody `handle` zamiast wszystkich metod prototype **Task:**
VS-009-logging-cqrs-decorator-all-methods **Date:** 2026-05-29 **Method:**
STRIDE + DREAD + LINDDUN **Scope:** `@vytches/ddd-logging` —
`src/integration/cqrs-decorators.ts` (`LogCommands`, `LogQueries`, `LogCQRS`,
`createLoggingWrapper`, `CQRSLoggingOptions`)

---

> **Korekta po analizie 5 agentów + ustaleniu konsumenta (2026-05-29):** default
> to **`['execute', 'handle']`**, nie `['handle']`. Biblioteka ma dwa kontrakty
> handlerów: Command/Query → `execute` (`ICommandHandler`/`IQueryHandler`,
> `packages/cqrs/.../handler.interface.ts:4-10`) oraz event handler → `handle`
> (`IEventHandler`, `contracts/events/event-handler-interface.ts:23`, sygnatura
> `Promise<void> | void`). Dekoratory klas (`@LogCQRS` itd.) są jedynym
> narzędziem do logowania OBU (brak dedykowanego class-decoratora dla eventów).
> Default `['execute', 'handle']` jest backward-compatible (dziś owijane jest
> wszystko) i **nie** wskrzesza wektora T1/E1: groźne guardy (`canHandle`/
> `authorize` → `boolean`) pozostają poza listą; sync `handle` zwracające `void`
> jest bezpieczne. Analiza zagrożeń poniżej jest niezależna od nazwy metody.

## Context & Attack Surface

Dekoratory CQRS przechwytują wykonanie handlerów i logują operację (opcjonalnie
z payloadem, opcjonalnie maskowanym przez `DataMasker` — patrz
[TM-VS-001](./TM-VS-001.md)). **VS-009 nie dodaje nowej powierzchni ataku —
zawęża istniejącą.** Threat model dokumentuje zatem zagrożenie zamykane przez tę
poprawkę (SEC-LOGGING-005) oraz weryfikuje, że zmiana nie wprowadza nowych
wektorów.

Aktualny defekt (`cqrs-decorators.ts:31-45`, identyczny w trzech dekoratorach):

```typescript
const originalMethods = Object.getOwnPropertyNames(target.prototype);
for (const methodName of originalMethods) {
  if (methodName === 'constructor') continue;        // pomijany TYLKO constructor
  const originalMethod = target.prototype[methodName];
  if (typeof originalMethod !== 'function') continue;
  target.prototype[methodName] = createLoggingWrapper(...); // owija WSZYSTKO
}
```

`createLoggingWrapper` (`:100`) zwraca **`async function`**:

```typescript
return async function (this, ...args) {
  /* ... */ return await originalMethod.apply(this, args);
};
```

**Charakterystyka realnej powierzchni ataku (kluczowa, różni się od framingu
zadania):**

1. **Koercja sync → async (najgroźniejsze).** Owinięcie metody
   **synchronicznej** (getter, `validate()`, `canHandle()`, `authorize()`,
   `isAllowed()`) zamienia jej zwracaną wartość w `Promise`. `Promise` jest
   **zawsze truthy**, więc konsument robiący `if (this.validate(cmd)) {...}` lub
   `if (this.canHandle(cmd))` przechodzi warunek **bezwarunkowo** → cichy bypass
   walidacji/autoryzacji. To wektor groźniejszy niż „nadmiarowe logowanie" z
   opisu zadania — ma konsekwencję EoP, nie tylko hałas w logach.

2. **Nadmiarowe logowanie PII przez metody pomocnicze.** Przy
   `includePayload: true` wrapper loguje `args[0]` **każdej** owiniętej metody.
   `DataMasker` jest skonfigurowany pod pola **komendy** (`sensitiveFields`), a
   metody pomocnicze przyjmują inne kształty argumentów (value object, surowa
   wartość, encja) — pola spoza listy `sensitiveFields` trafiają do logów
   niezamaskowane (regex email/SSN/karta nadal działa, więc to częściowa
   ochrona). Rozszerza to powierzchnię SEC-LOGGING-005 ponad sam `handle`.

3. **Side-effect przy dekoracji.** `target.prototype[methodName]` dla
   właściwości akcesorów (getter zdefiniowany na prototypie) **wywołuje getter w
   czasie dekoracji**. Przy klasie z getterem o efekcie ubocznym to
   nieoczekiwane wykonanie podczas ładowania modułu.

4. **Owijanie wszystkiego = koszt + zaszumiony audyt.** Każda metoda instancji
   owinięta w async wrapper (overhead + microtask scheduling); logi handlera
   mieszają operacje biznesowe z metodami pomocniczymi → spadek signal-to-noise
   w audycie.

**Zasięg ekspozycji:** biblioteka npm — defekt dotyka **wszystkich aplikacji
konsumenckich** stosujących dekoratory na klasach z więcej niż jedną metodą.

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID  | Zagrożenie                                                                             | Wektor |
| --- | -------------------------------------------------------------------------------------- | ------ |
| S1  | Brak nowego wektora podszywania — dekorator nie dotyka tożsamości ani uwierzytelniania | n/d    |

**Ocena: brak istotnego ryzyka.** VS-009 nie zmienia ścieżki tożsamości.

---

### T — Tampering (Manipulacja)

| ID  | Zagrożenie                                                                                                                                                     | Wektor                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| T1  | **Koercja sync→async**: owinięta metoda synchroniczna zwraca `Promise` zamiast wartości → manipulacja logiką sterującą konsumenta (warunek zawsze truthy)      | Defekt implementacyjny obecnego kodu; nie wymaga atakującego |
| T2  | Mutacja `target.prototype[methodName]` na współdzielonym prototypie — zamierzona, ale szeroka (wszystkie metody) zwiększa ryzyko kolizji z innymi dekoratorami | Wielokrotna dekoracja / dziedziczenie                        |

**T1 DREAD (defekt zamykany przez VS-009):**

- Damage: 3 — ominięty `validate`/`canHandle` → błędna decyzja sterująca
  (potencjalna walidacja/autoryzacja)
- Reproducibility: 2 — deterministyczny, **pod warunkiem** że klasa ma metodę
  synchroniczną używaną w warunku
- Exploitability: 2 — bez atakującego; wyzwalany normalnym użyciem klasy z
  metodami pomocniczymi + dekorator
- Affected users: 2 — konsumenci dekorujący klasy o wielu metodach
- Discoverability: 2 — subtelny (truthiness `Promise`), trudny do zauważenia w
  review
- **Score: 11/15 → HIGH** ← główne uzasadnienie VS-009

**Mitygacja VS-009:** ✅ owijanie tylko `handle` (już async) eliminuje koercję
metod synchronicznych w całości.

---

### R — Repudiation (Zaprzeczenie)

| ID  | Zagrożenie                                                                                                                     | Wektor                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| R1  | Po poprawce metody pomocnicze nie są logowane — utrata śladu, jeśli konsument (przypadkowo) polegał na ich logowaniu w audycie | Zmiana zakresu logowania |

**Ocena:** Metody pomocnicze nie są operacjami biznesowymi — `handle` pozostaje
audytowane. Zmiana **poprawia** signal-to-noise. **DREAD:** D:1 R:1 E:1 A:1 Di:1
= **5/15 → LOW**. Rekomendacja: changelog/JSDoc odnotowujące zawężenie zakresu.

---

### I — Information Disclosure (Ujawnienie informacji)

| ID  | Zagrożenie                                                                                                                                                       | Wektor                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| I1  | **Nadmiarowa ekspozycja PII**: przy `includePayload: true` metody pomocnicze logują `args[0]` o kształcie spoza `sensitiveFields` → pola niezamaskowane w logach | Klasa wielometodowa + `includePayload: true` |
| I2  | Side-effect getter przy dekoracji może zmaterializować/zalogować stan wrażliwy w czasie ładowania modułu                                                         | Getter z efektem ubocznym na prototypie      |

**I1 DREAD (defekt zamykany przez VS-009):**

- Damage: 2 — PII w polach, których operator nie zamierzał logować (regex nadal
  łapie email/SSN/kartę → częściowa ochrona)
- Reproducibility: 3 — każde wywołanie metody pomocniczej przy
  `includePayload: true`
- Exploitability: 2 — wymaga `includePayload: true` + klasy wielometodowej
- Affected users: 2 — konsumenci tej konfiguracji
- Discoverability: 2 — widoczne przy przeglądaniu logów
- **Score: 11/15 → HIGH** (rozszerzenie SEC-LOGGING-005 / I1 z TM-VS-001)

**Mitygacja VS-009:** ✅ logowany payload tylko z `handle` → powierzchnia PII
zawężona do faktycznej komendy/zapytania.

---

### D — Denial of Service

| ID  | Zagrożenie                                                                                     | Wektor               |
| --- | ---------------------------------------------------------------------------------------------- | -------------------- |
| D1  | Owijanie wszystkich metod → narzut per-call + scheduling microtask dla każdej metody instancji | Defekt obecnego kodu |

**Ocena:** Realny, ale niski narzut. **DREAD:** D:1 R:2 E:1 A:1 Di:1 = **6/15 →
LOW**. Mitygacja VS-009: ✅ owijana jedna metoda → narzut tylko na `handle`.

---

### E — Elevation of Privilege (Eskalacja uprawnień)

| ID  | Zagrożenie                                                                                                                                       | Wektor                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| E1  | **HIGH** — owinięty synchroniczny guard (`canHandle`/`authorize`/`isAllowed`) zwraca truthy `Promise` → ominięcie kontroli dostępu w konsumencie | = T1; metoda strażnicza używana w `if (...)` zawsze przechodzi |

**E1 DREAD:** = T1 = **11/15 → HIGH**. To konsekwencja koercji sync→async, gdy
owinięta metoda pełni rolę strażnika. **Mitygacja VS-009:** ✅ pełna (guard nie
jest owijany, chyba że jawnie w `methodsToWrap`).

---

### Nowe wektory wprowadzone przez poprawkę (analiza zmiany)

| ID  | Zagrożenie                                                                                                                                                                                                                                           | DREAD                           | Ocena |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----- |
| N1  | `methodsToWrap?: string[]` indeksuje prototyp dowolnym stringiem — config czasu dekoracji (developer), **nie** runtime input użytkownika; `'__proto__'`→ akcesor `Object.prototype` (typeof `object` → pominięty), `'constructor'` już strażnikowany | D:1 R:1 E:1 A:1 Di:1 = **5/15** | LOW   |
| N2  | Warning gdy żadna metoda z `methodsToWrap` nie istnieje — loguje nazwę klasy (minimalna informacja)                                                                                                                                                  | D:1 R:1 E:1 A:1 Di:1 = **5/15** | LOW   |

**Wniosek:** poprawka **nie wprowadza** zagrożenia HIGH/MEDIUM. N1 łagodzony
defensywnie (patrz Remediation R3).

---

## DREAD Score Summary

| Zagrożenie                                                       | D   | R   | E   | A   | Di  | Total  | Priorytet |
| ---------------------------------------------------------------- | --- | --- | --- | --- | --- | ------ | --------- |
| T1/E1 — Koercja sync→async owiniętego guarda → bypass kontroli   | 3   | 2   | 2   | 2   | 2   | **11** | HIGH      |
| I1 — Nadmiarowa ekspozycja PII przez metody pomocnicze (payload) | 2   | 3   | 2   | 2   | 2   | **11** | HIGH      |
| D1 — Narzut owijania wszystkich metod                            | 1   | 2   | 1   | 1   | 1   | **6**  | LOW       |
| R1 — Utrata śladu metod pomocniczych po zawężeniu                | 1   | 1   | 1   | 1   | 1   | **5**  | LOW       |
| N1 — `methodsToWrap` arbitralny string (nowy, config-time)       | 1   | 1   | 1   | 1   | 1   | **5**  | LOW       |

**Sygnalizacja:** Metadane zadania (`dread_score: 8`) odzwierciedlają framing
„nadmiarowe logowanie". Threat model identyfikuje, że pełna powierzchnia
obecnego defektu jest **wyższa** — koercja sync→async (T1/E1 = 11, HIGH) niesie
konsekwencję EoP, a nie tylko hałas/PII. Rekomendacja: utrzymać
`priority: high`.

---

## LINDDUN Privacy Analysis

PII dotykane pośrednio przez ścieżkę `includePayload`/`DataMasker` (email,
hasło, token, dane osobowe — jak w [TM-VS-001](./TM-VS-001.md)). **VS-009 jest
zmianą redukującą ryzyko prywatności.**

### L — Linkability

Mniej logowanych metod → mniejszy ślad korelowalnych payloadów per handler.
**Ryzyko: maleje** (zawężenie do `handle`).

### I — Identifiability

Metody pomocnicze nie logują już identyfikujących argumentów. **Ryzyko po
poprawce: LOW** (przed: payloady pomocnicze mogły zawierać surowe identyfikatory
poza zakresem `sensitiveFields`).

### N — Non-repudiation

Bez istotnych implikacji (handler nadal audytowany).

### D — Detectability

Mniej wpisów logów = mniejsza powierzchnia do wykrycia obecności danych
wrażliwych. **Ryzyko: maleje.**

### D — Disclosure of information

Główny zysk: payload logowany **tylko** z faktycznej komendy/zapytania, gdzie
`sensitiveFields` jest dopasowany. **Ryzyko po poprawce: LOW.**

### U — Unawareness

Konsument może nie wiedzieć, że stara wersja logowała **wszystkie** metody.
JSDoc na `methodsToWrap` powinien wyjaśnić domyślne zachowanie (`['handle']`).
**Ryzyko: LOW-MEDIUM**, łagodzone przez R4.

### N — Non-compliance

- **RODO art. 5(1)(c)** (minimalizacja) — owijanie wszystkich metod i logowanie
  ich payloadów było sprzeczne z minimalizacją; zawężenie do `handle`
  **poprawia** zgodność.
- **RODO art. 25** (privacy by default) — domyślnie `['handle']` to lepszy
  domyślny stan ochronny.

**Ryzyko przed poprawką: MEDIUM. Po poprawce: LOW.**

---

## Attack Scenarios (Top 2)

### Scenario A: Cichy bypass walidacji/autoryzacji przez koercję sync→async (T1/E1)

```
Konsument: klasa handlera z synchroniczną metodą strażniczą
  class TransferHandler { canHandle(cmd): boolean { return cmd.amount <= this.limit } async handle(cmd) {...} }
@LogCQRS() owija WSZYSTKIE metody → canHandle staje się async → zwraca Promise →
konsument: if (handler.canHandle(cmd)) handler.handle(cmd)  // Promise zawsze truthy →
canHandle przechodzi bezwarunkowo → handle wykonany dla komendy, która powinna być odrzucona →
ominięcie kontroli (np. limitu/autoryzacji)
```

DREAD: 11 (HIGH). Warunek: klasa z synchroniczną metodą sterującą + dekorator.
**Mitygacja VS-009 (owijać tylko `handle`):** ✅ skuteczna — guard nietknięty.

### Scenario B: Wyciek PII przez payload metody pomocniczej (I1)

```
@LogCommands({ includePayload: true, sensitiveFields: ['password'] }) na klasie z
  handle(cmd) + enrich(userProfile)  // userProfile zawiera { ssn, address }
enrich(userProfile) owinięty → args[0]=userProfile logowany; sensitiveFields=['password']
nie pokrywa ssn/address (regex łapie SSN, ale nie 'address') →
adres trafia do logów niezamaskowany
```

DREAD: 11 (HIGH). **Mitygacja VS-009:** ✅ `enrich` nie jest owijany → payload
logowany tylko z `handle`, gdzie `sensitiveFields` jest dobrany.

---

## Remediation Requirements

### Must Have (scope VS-009)

| #   | Wymaganie                                                                                                                                                                                                    | Plik                       | Priorytet |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------- |
| R1  | Iterować po `options.methodsToWrap ?? ['execute', 'handle']` zamiast `Object.getOwnPropertyNames(prototype)` — wyekstrahować wspólną `applyLoggingDecorator(target, opType, options)` dla trzech dekoratorów | `cqrs-decorators.ts:29-87` | HIGH      |
| R2  | Gdy żadna metoda z listy nie istnieje na prototypie → `logger.warn` + graceful skip (bez throw)                                                                                                              | `cqrs-decorators.ts`       | HIGH      |
| R3  | Defensywnie: dla każdej nazwy z `methodsToWrap` weryfikować `typeof prototype[name] === 'function'` ORAZ pomijać `constructor` (utrzymać istniejący strażnik) — neutralizuje N1                              | `cqrs-decorators.ts`       | MEDIUM    |
| R4  | JSDoc na `methodsToWrap` w `CQRSLoggingOptions`: domyślnie `['handle']`, ostrzeżenie że dodanie metod synchronicznych je „asyncuje"                                                                          | `CQRSLoggingOptions`       | HIGH      |
| R5  | Test: klasa `handle`+`validate` → tylko `handle` owinięte/logowane (`validate` zwraca wartość synchronicznie, nie `Promise`)                                                                                 | tests                      | HIGH      |
| R6  | Test: `methodsToWrap: ['handle','execute']` → obie owinięte; brak `handle` → warn bez throw                                                                                                                  | tests                      | HIGH      |
| R7  | Test regresji: handler z samym `handle` → zachowanie niezmienione (backward-compat)                                                                                                                          | tests                      | HIGH      |

### Should Have (poza scope — follow-up)

| #   | Wymaganie                                                                                                                                                                                                                   | Zagrożenie | Komentarz                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| S1  | Rozważyć ostrzeżenie/odmowę owijania metody, która nie jest `async` (wykryta przez `originalMethod.constructor.name !== 'AsyncFunction'`) — jawna ochrona przed koercją sync→async również w trybie jawnego `methodsToWrap` | T1/E1      | Edge case; AsyncFunction detection niepełny dla zwykłych fn zwracających Promise |
| S2  | Changelog/MIGRATION nota: zawężenie zakresu logowania to zmiana zachowania (bugfix) — patrz Backward Compatibility                                                                                                          | R1         | Tani dodatek dokumentacyjny                                                      |

### Won't Have

| #   | Decyzja                                                            | Uzasadnienie                                                  |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| W1  | Brak nowych zależności npm                                         | Biblioteka dependency-free ([[feedback_no_external_deps]])    |
| W2  | Brak automatycznego wykrywania „metod biznesowych" przez refleksję | Jawny whitelist `methodsToWrap` jest prostszy i przewidywalny |

---

## Backward Compatibility Assessment

| Scenariusz                                                        | Przed                    | Po (`methodsToWrap: ['handle']`)                          |
| ----------------------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| Sygnatura publicznego API (`CQRSLoggingOptions`, trzy dekoratory) | —                        | **Bez zmian** ✅ (`methodsToWrap?` to opcjonalny dodatek) |
| Klasa z samą metodą `handle`                                      | `handle` owinięte        | `handle` owinięte — **bez zmian** ✅                      |
| Klasa z `handle` + metodami pomocniczymi                          | wszystkie owinięte (bug) | tylko `handle` owinięte (**zmiana zachowania = fix**)     |
| Metoda synchroniczna pomocnicza zwracała `Promise` (bug)          | `Promise` (truthy)       | zwraca surową wartość — **naprawione** ✅                 |
| Konsument polegający na logowaniu metody pomocniczej              | logowana                 | niezalogowana → użyć `methodsToWrap: ['handle','<inna>']` |

**Zmiana jest backward-compatible na poziomie API** (dodanie opcjonalnego pola).
Zawężenie domyślnego zakresu logowania to **świadomy bugfix** (niezamierzony
poprzedni behavior) — należy odnotować w changelogu (S2).

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION — priorytet HIGH (utrzymać).**

VS-009 to **zmiana netto redukująca ryzyko**. Zamyka dwa wektory HIGH obecnego
defektu (SEC-LOGGING-005):

- **T1/E1 (11, HIGH)** — koercja sync→async owiniętych metod strażniczych →
  potencjalny cichy bypass walidacji/autoryzacji w konsumencie. Owijanie tylko
  `handle` (już async) eliminuje go w całości.
- **I1 (11, HIGH)** — nadmiarowa ekspozycja PII przez payloady metod
  pomocniczych poza zakresem `sensitiveFields`. Zawężenie do `handle` ogranicza
  powierzchnię PII.

Poprawka **nie wprowadza** nowych zagrożeń HIGH/MEDIUM — jedyny nowy element
(`methodsToWrap`, N1) to config czasu dekoracji (developer), nie runtime input,
łagodzony defensywnym strażnikiem `typeof === 'function'` + pominięcie
`constructor` (R3).

**Ryzyko rezydualne po wdrożeniu:**

- **LOW:** konsument może jawnie dodać metodę synchroniczną do `methodsToWrap` i
  ponownie wywołać koercję sync→async — łagodzone JSDoc (R4) i opcjonalnie
  ostrzeżeniem o nie-async metodzie (S1, follow-up).
- **LOW:** utrata logów metod pomocniczych dla konsumentów, którzy (przypadkowo)
  na nich polegali — adresowalne przez `methodsToWrap` + nota w changelogu (S2).

**Bloker dla implementacji:** brak.

---

_Generated: 2026-05-29 | Method: STRIDE + DREAD + LINDDUN | Task: VS-009 | Audit
ref: SEC-LOGGING-005 (patrz TM-VS-001)_
