# Threat Model: TM-VS-005

**Feature:** CachedPolicy — zamiana 32-bitowego djb2 na bezpieczniejszą funkcję
haszującą klucz cache **Task:** VS-005-policies-cache-key-hash **Date:**
2026-05-28 **Method:** STRIDE + DREAD + LINDDUN **Scope:**
`@vytches/ddd-policies` — `src/decorators/cached-policy.ts`
(`generateCacheKey` + `hashString`)

---

## Context & Attack Surface

`PolicyCachingBehavior` to dekorator cache'ujący wynik polityki
(`Result<T, PolicyViolation>`) w pamięciowej mapie (`Map<string, CacheEntry>`).
Klucz cache budowany jest w `generateCacheKey`:

```typescript
// cached-policy.ts:199-219
private generateCacheKey(request: PolicyRequest<T>): string {
  if (this.config.keyGenerator) {
    return this.config.keyGenerator(request);   // ← consumer override (już istnieje)
  }
  const namespace = this.config.namespace || this.innerPolicy.id;
  let entityKey: string;
  try {
    entityKey = JSON.stringify(request.entity);
  } catch (_error) {
    entityKey = this.generateFallbackKey(request.entity);
  }
  const contextKey =
    `${request.context.userId}_${request.context.tenantId || ''}_${request.context.environment}`;
  return `${namespace}:${contextKey}:${this.hashString(entityKey)}`;
}
```

Funkcja haszująca (djb2, 32-bit):

```typescript
// cached-policy.ts:268-276
private hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // ← no-op: hash AND hash === hash (martwa linia)
  }
  return Math.abs(hash).toString(16); // ← Math.abs zwija +n i -n w jedną wartość
}
```

**Charakterystyka realnej powierzchni ataku (różni się od opisu zadania):**

1. **Hashowany jest TYLKO `entityKey`** — `namespace` i `contextKey`
   (`userId_tenantId_environment`) są w kluczu w postaci jawnej. Kolizja możliwa
   jest **wyłącznie w obrębie tego samego prefixu**: ten sam `namespace` (=
   `innerPolicy.id`) ORAZ ten sam `userId` + `tenantId` + `environment`. To
   **zawęża** wektor „entity A dostaje wynik entity B" względem opisu zadania —
   obie encje muszą należeć do tego samego kontekstu użytkownika/tenanta.

2. **djb2 jest jawny i niekryptograficzny** — kolizje są obliczalne offline.
   Atakujący kontrolujący serializację `request.entity` (np. encja zawierająca
   pola sterowane użytkownikiem) może **celowo** spreparować dwie różne encje o
   identycznym haszu — to wektor groźniejszy niż przypadkowa kolizja birthday
   paradox z opisu zadania.

3. **Realna przestrzeń jest mniejsza niż 32 bity.** `Math.abs(hash)` zwija
   wartości dodatnie i ujemne (np. `n` i `-n`) do jednej reprezentacji →
   gwarantowane kolizje dla par różniących się tylko bitem znaku, efektywna
   przestrzeń ~2³¹. Birthday collision już przy ~65k wpisów w jednym prefixie.

4. **Domeny wrażliwe.** W kontekstach auth/authz (`BlacklistPolicy`,
   `TierPolicy`) kolizja oznacza, że encja X otrzymuje zbuforowaną decyzję
   polityki obliczoną dla encji Y → potencjalna eskalacja (np. zasób, który
   powinien dostać `deny`, dostaje zbuforowany `allow`).

**Komponenty w zasięgu analizy:**

- `generateCacheKey()` (199-219) — konstrukcja klucza, wstrzyknięcie PII do
  prefixu.
- `hashString()` (268-276) — wadliwa funkcja haszująca (główny przedmiot
  VS-005).
- `keyGenerator?` (`PolicyCacheConfig`, linia 21) — **już istniejący** override
  consumera.
- `PolicyCache` (58-154) — in-memory `Map`, brak persystencji, czyszczona przy
  restarcie.

**Zasięg ekspozycji:** Biblioteka npm. Realny impact zależy od tego, czy
konsument cache'uje **polityki autoryzacyjne** o tym samym `namespace`/`context`
dla wielu różnych encji.

---

## STRIDE Analysis

### S — Spoofing (Podszywanie)

| ID  | Zagrożenie                                                                                                            | Wektor                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| S1  | Encja podszywa się pod inną poprzez spreparowanie kolizji hasza w obrębie tego samego `userId`/`tenantId`/`namespace` | Atakujący kontroluje pola `request.entity` i oblicza kolizję djb2 offline |

**Ocena:** Spoofing tożsamości użytkownika niemożliwy (`userId`/`tenantId` jawne
w prefixie, nie da się ich sfałszować przez hash). Możliwe natomiast „spoofing
encji" w obrębie własnego kontekstu. **Risk: MEDIUM** (ograniczony do tego
samego kontekstu autoryzacyjnego).

---

### T — Tampering (Manipulacja)

| ID  | Zagrożenie                                                                                                     | Wektor                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| T1  | Zatrucie cache: spreparowana encja kolidująca z kluczem encji o korzystnym (`allow`) wyniku zwraca cudzy wynik | djb2 collision craft; oba w tym samym prefixie |
| T2  | Bug `Math.abs` + martwa linia `hash & hash` zwiększają częstość kolizji ponad nominalne 32 bity                | Defekt implementacyjny, nie wymaga atakującego |

**T1 DREAD (celowy atak):**

- Damage: 3 — błędna decyzja autoryzacyjna (allow zamiast deny)
- Reproducibility: 3 — djb2 deterministyczny i jawny, kolizja obliczalna offline
- Exploitability: 2 — wymaga: tego samego
  `namespace`+`userId`+`tenantId`+`environment`, istniejącego korzystnego wpisu
  w cache, kontroli nad serializacją encji
- Affected users: 2 — ograniczone do encji w obrębie kontekstu
  atakującego/tenanta
- Discoverability: 2 — `hashString` widoczny w źródle publicznego pakietu npm
- **Score: 12/15 → HIGH**

---

### R — Repudiation (Zaprzeczenie)

| ID  | Zagrożenie                                                                                                            | Wektor                                   |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| R1  | Kolizja zwraca zbuforowaną decyzję bez wywołania `innerPolicy.check()` → brak śladu, że decyzja dotyczyła innej encji | Cache hit pomija ścieżkę audytu polityki |

**DREAD:** D:1 R:2 E:1 A:1 Di:1 = **6/15 → LOW**. Wtórne wobec T1.

---

### I — Information Disclosure (Ujawnienie informacji)

| ID  | Zagrożenie                                                                                                                        | Wektor                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| I1  | `contextKey` osadza surowe `userId` i `tenantId` w kluczu cache (in-memory `Map`)                                                 | Heap dump / debugger / wyciek `getMetrics` w przyszłości → korelacja identyfikatorów |
| I2  | `entityKey = JSON.stringify(request.entity)` materializuje pełną encję (potencjalnie PII) jako string w pamięci przed haszowaniem | Transient, ale obecny w heap przed GC                                                |

**Uwaga:** I1/I2 są **pre-existing** (nie wprowadza ich VS-005), ale VS-005
modyfikuje dokładnie ten region kodu — należy je odnotować i rozważyć przy
okazji. Po zamianie na SHA-256 zawartość encji pozostaje jednokierunkowo
zahaszowana (jak obecnie), ale `contextKey` z PII **nie zmienia się**.

**DREAD I1:** D:1 R:2 E:1 A:2 Di:1 = **7/15 → LOW-MEDIUM**

---

### D — Denial of Service

| ID  | Zagrożenie                                                            | Wektor                                                                              |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | SHA-256 na hot path (per cache miss) — koszt CPU vs djb2              | `crypto.createHash` jest szybki; dla typowych `entityKey` (<10 KB) narzut pomijalny |
| D2  | Bardzo duży `entityKey` (głęboka encja) → koszt JSON.stringify + hash | Istnieje już dziś; nie pogarszane przez VS-005                                      |

**Ocena:** SHA-256 to ~kilka µs dla typowych kluczy — **nie** wprowadza realnego
DoS. **Risk: LOW**. (Wektor ReDoS z VS-004 nie dotyczy tego pliku.)

---

### E — Elevation of Privilege (Najważniejsze zagrożenie VS-005)

| ID  | Zagrożenie                                                                                                                         | Wektor                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **HIGH** — Kolizja klucza w polityce autoryzacyjnej → encja dziedziczy `allow` przeznaczone dla innej encji w tym samym kontekście | `BlacklistPolicy`/`TierPolicy` cache'owane z `cacheFailures` → zbuforowany pozytywny wynik trafia do encji, która powinna dostać `deny` |
| E2  | Przypadkowa kolizja (birthday) przy >65k encji w jednym prefixie → losowe błędne decyzje                                           | Probabilistyczne; framing z opisu zadania                                                                                               |

**E1 DREAD (celowy):** = T1 = **12/15 → HIGH**

**E2 DREAD (przypadkowy — framing zadania):**

- Damage: 3, Reproducibility: 2, Exploitability: 1, Affected: 2,
  Discoverability: 1
- **Score: 9/15 → MEDIUM** (zgodne z `dread_score: 9` w metadanych zadania)

---

## DREAD Score Summary

| Zagrożenie                                          | D   | R   | E   | A   | Di  | Total  | Priorytet  |
| --------------------------------------------------- | --- | --- | --- | --- | --- | ------ | ---------- |
| T1/E1 — Celowa kolizja djb2 → bypass autoryzacji    | 3   | 3   | 2   | 2   | 2   | **12** | HIGH       |
| E2 — Przypadkowa kolizja birthday (framing zadania) | 3   | 2   | 1   | 2   | 1   | **9**  | MEDIUM     |
| I1 — PII (`userId`/`tenantId`) jawne w kluczu cache | 1   | 2   | 1   | 2   | 1   | **7**  | LOW-MEDIUM |
| R1 — Brak śladu kolizyjnej decyzji w audycie        | 1   | 2   | 1   | 1   | 1   | **6**  | LOW        |
| D1 — Narzut CPU SHA-256 na hot path                 | 1   | 1   | 1   | 1   | 1   | **5**  | LOW        |

**Sygnalizacja:** Metadane zadania (`dread_score: 9`) odzwierciedlają wektor
**przypadkowej** kolizji (E2). Threat model identyfikuje groźniejszy wektor
**celowej** kolizji (T1/E1 = 12, HIGH), bo djb2 jest jawny i trywialnie
kolizyjny. Rekomendacja: rozważyć podniesienie do `priority: high` (już jest
`high` — utrzymać; nie obniżać do `medium` mimo niskiego nominalnego dread).

---

## LINDDUN Privacy Analysis

PII dotykane: `userId`, `tenantId` (w `contextKey`), pola encji w `entityKey`.

### L — Linkability

`contextKey` (`userId_tenantId_environment`) tworzy stabilny prefix klucza dla
wszystkich polityk danego użytkownika → klucze tego samego użytkownika są
linkowalne między politykami. **Ryzyko: MEDIUM** (in-memory; eskaluje przy heap
dump). Pre-existing, nie pogarszane przez VS-005.

### I — Identifiability

Surowe identyfikatory w kluczu = bezpośrednia identyfikowalność z poziomu
zawartości `Map`. **Rekomendacja (poza scope, S1 niżej):** rozważyć haszowanie
również `contextKey`. **Ryzyko: MEDIUM.**

### N — Non-repudiation

Brak istotnych implikacji.

### D — Detectability

Wpis w cache potwierdza, że dana (`userId`, `entity`) była ewaluowana.
Marginalne. **Ryzyko: LOW.**

### D — Disclosure of information

Po SHA-256 zawartość encji pozostaje jednokierunkowa (poprawa: SHA-256 jest
odporny na preimage, djb2 nie). `contextKey` z PII bez zmian. **Ryzyko po
poprawce: LOW** (dla `entityKey`).

### U — Unawareness

Konsument może nie wiedzieć, że surowe `userId`/`tenantId` lądują w kluczach
cache. JSDoc na `keyGenerator`/`namespace` mógłby to wyjaśnić. **Ryzyko:
LOW-MEDIUM.**

### N — Non-compliance

- **RODO art. 32** — słaby hash chroniący decyzje autoryzacyjne podważa
  „appropriate technical measures". SHA-256 adresuje to dla `entityKey`.
- **OWASP ASVS V6.2 / V1.6** — odpowiednie funkcje kryptograficzne; djb2 nie
  spełnia.

**Ryzyko przed poprawką: MEDIUM. Po poprawce (SHA-256): LOW.**

---

## Attack Scenarios (Top 2)

### Scenario A: Celowy bypass autoryzacji przez kolizję (T1/E1)

```
Konsument cache'uje BlacklistPolicy z cacheFailures=true, namespace stały, per userId/tenant →
atakujący (legalny user tego tenanta) wywołuje politykę dla encji E_good → wynik `allow` zbuforowany
pod kluczem ns:uid_tid_env:H(E_good) →
atakujący oblicza offline encję E_bad spełniającą hashString(JSON(E_bad)) == hashString(JSON(E_good)),
gdzie E_bad normalnie dostałaby `deny` →
żądanie z E_bad trafia w cache hit → zwrócony `allow` bez wywołania innerPolicy.check() →
autoryzacja ominięta
```

DREAD: 12 (HIGH). Warunek: ten sam prefix kontekstu + cache'owany korzystny
wynik.

**Mitygacja VS-005 (SHA-256):** ✅ skuteczna — SHA-256 jest odporny na kolizje,
craft offline staje się obliczeniowo niewykonalny. To **główne uzasadnienie**
zadania.

### Scenario B: Przypadkowa kolizja w wysokim wolumenie (E2)

```
Polityka cache'owana dla >65k różnych encji w obrębie tego samego userId/tenant/namespace →
birthday paradox → dwie różne encje mapują na ten sam klucz →
encja dostaje zbuforowaną decyzję sąsiada → niedeterministyczny błąd autoryzacji/biznesowy
```

DREAD: 9 (MEDIUM). **Mitygacja VS-005 (SHA-256, 128-bit):** ✅ kolizje
statystycznie nieosiągalne.

---

## Remediation Requirements

### Must Have (scope VS-005)

| #   | Wymaganie                                                                                                                                                                                | Plik                       | Priorytet |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------- |
| R1  | Zamiana djb2 na SHA-256 (128-bit, `slice(0, 32)`). **Użyć Web Crypto `globalThis.crypto.subtle.digest('SHA-256', …)`, NIE `node:crypto`** — patrz AR-1 niżej. Funkcja staje się `async`. | `cached-policy.ts:268`     | HIGH      |
| R2  | Usunąć martwą linię `hash = hash & hash` i zależność od `Math.abs` (znika wraz z djb2)                                                                                                   | `cached-policy.ts:273-275` | MEDIUM    |
| R3  | Test: 1000+ różnych encji → 1000 unikalnych kluczy (0 kolizji)                                                                                                                           | tests                      | HIGH      |
| R4  | Test: determinizm — ta sama encja → ten sam klucz                                                                                                                                        | tests                      | HIGH      |
| R5  | Test: `keyGenerator` nadpisuje domyślne haszowanie (regresja istniejącego API)                                                                                                           | tests                      | HIGH      |

### Should Have (poza scope — propozycje follow-up)

| #   | Wymaganie                                                                                                   | Zagrożenie      | Komentarz                             |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------- |
| S1  | Rozważyć haszowanie/skracanie `contextKey` (PII `userId`/`tenantId` w kluczu in-memory)                     | I1, LINDDUN L/I | Osobny task — zmiana semantyki klucza |
| S2  | JSDoc na `keyGenerator`/`namespace`: ostrzeżenie, że domyślny klucz zawiera surowe identyfikatory kontekstu | U (Unawareness) | Tani dodatek dokumentacyjny           |

### ⚠️ Korekta zakresu zadania (rozbieżność spec ↔ kod)

| #   | Ustalenie                                                                                                                                                                                                                                                           | Konsekwencja                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Zadanie postuluje dodanie `cacheKeyFn?` do `CachedPolicyConfig`. **W kodzie typ nazywa się `PolicyCacheConfig` i JUŻ posiada `keyGenerator?: (request) => string`**, w pełni realizujący „Option C" (`generateCacheKey` zwraca `keyGenerator(request)` gdy podany). | **NIE dodawać** zduplikowanego `cacheKeyFn` — to złamałoby spójność API i wprowadziło dwa równoległe mechanizmy. Implementacja powinna ograniczyć się do R1/R2 + testy. Zaktualizować acceptance criteria zadania. |
| C2  | Zadanie wskazuje plik `tests/decorators/cached-policy.test.ts` i symbol `CachedPolicyConfig`.                                                                                                                                                                       | Zweryfikować rzeczywiste nazwy przed edycją; klasa to `PolicyCachingBehavior`.                                                                                                                                     |

### Won't Have

| #   | Decyzja                                                 | Uzasadnienie                                                         |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| W1  | Brak nowych zależności npm                              | `node:crypto` jest wbudowany (memory: [[feedback_no_external_deps]]) |
| W2  | Brak persystencji/wersjonowania cache między restartami | Cache in-memory; restart = wyczyszczenie (akceptowane w zadaniu)     |

---

## Backward Compatibility Assessment

| Scenariusz                                                        | Przed    | Po (SHA-256)                                                 |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| Sygnatura publicznego API (`PolicyCacheConfig`, `check`, factory) | —        | **Bez zmian** ✅                                             |
| `keyGenerator` consumera                                          | działa   | **Bez zmian** ✅ (ścieżka przed haszowaniem)                 |
| Wartość klucza dla tej samej encji                                | hex djb2 | hex SHA-256 (32 znaki) — **inna wartość**                    |
| Cache w pamięci po deployu                                        | —        | Inwalidacja (inny hash) → restart = cold cache (akceptowane) |

**Zmiana jest backward-compatible na poziomie API.** Jedyny efekt runtime: stare
klucze nie pasują do nowych → cold cache po wdrożeniu (zadanie to akceptuje,
cache jest in-memory).

---

## Agent Review Findings (2026-05-28)

Threat model został zrecenzowany przez 4 agenty specjalistyczne
(ddd-patterns-expert, library-api-guardian, architecture-guardian,
performance-optimizer). Konsensus: PROCEED. Poniżej ustalenia wpływające na
implementację i follow-up.

### AR-1 — Crypto API: Web Crypto zamiast `node:crypto` (BLOKUJĄCE dla implementacji)

**Rozstrzygnięcie: użyć `globalThis.crypto.subtle.digest('SHA-256', …)`, NIE
`node:crypto`.**

Precedens w codebase: `packages/contracts/src/events/domain-event-utils.ts`
**celowo unika** `import … from 'node:crypto'`, ponieważ Vite
(`externalize-workspace`, stosowany dla pattern layer) eksternalizuje builtiny
`node:` i psuje bundle platform-agnostyczny. `engines >= 22.19.0` gwarantuje
dostępność `crypto.subtle`. Implikacja: `subtle.digest` jest **async** →
`hashString` → `Promise<string>`, `generateCacheKey` → async. `check()`
(cached-policy.ts:175) jest **już async**, więc publiczny interfejs
`IBusinessPolicy` **nie ulega zmianie**. Rozbieżność: library-api-guardian uznał
`node:crypto` (sync) za akceptowalne dla targetu Node/NestJS — odrzucone na
rzecz spójności z istniejącym wzorcem.

### AR-2 — `cacheKeyFn` potwierdzone jako redundantne (3/4 agentów)

DDD + API + architektura potwierdzają C1: `keyGenerator?` w `PolicyCacheConfig`
w pełni realizuje „Option C" (Strategy pattern). Dodanie `cacheKeyFn`
zaśmieciłoby publiczne API dwoma równoległymi mechanizmami. **Nie
implementować.** Obowiązkowy test regresji `keyGenerator` (R5).

### AR-3 — Nowe znaleziska (poza scope VS-005 — follow-up)

| #   | Znalezisko                                                                                                                                                    | Źródło                            | Waga   | Rekomendacja                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| F1  | Klucz z `JSON.stringify(całej encji)` zamiast tożsamości agregatu (`aggregateId:version`) — niestabilny przy value objects / transient fields / wersjonowaniu | DDD                               | HIGH   | Domyślną serializację udokumentować jako _fallback_; promować `keyGenerator` dla encji z naturalnym ID |
| F2  | `cacheFailures=true` w politykach autoryzacyjnych (`BlacklistPolicy`) — cache'owanie decyzji deny/allow opóźnia odwołanie o TTL                               | DDD                               | HIGH   | JSDoc warning: niebezpieczne w domenach security                                                       |
| F3  | LRU eviction **O(n)** w `PolicyCache.set` (107-121), ~6.5 µs/eksmisję przy `maxSize=1000` — realny bottleneck przy miss flood                                 | perf                              | MEDIUM | Osobny task: O(1) LRU (Map + doubly-linked list, zero-dep)                                             |
| F4  | PII (`userId`/`tenantId`) jawne w `contextKey` — privacy-by-design                                                                                            | DDD + architektura + LINDDUN (I1) | MEDIUM | Osobny task: opcja `contextKeyHasher?` / haszowanie prefixu                                            |
| F5  | Brak `"engines"` w `package.json` pakietu policies (tylko w root)                                                                                             | API + architektura                | LOW    | Dodać `"engines": { "node": ">=22.19.0" }` dla jawności kontraktu                                      |

### AR-4 — Wydajność: zmiana neutralna lub korzystna

SHA-256 (natywny C) jest **szybszy niż djb2** (JS) dla encji >~4 KB; dla
typowych encji narzut 0.2–0.4 µs/call — pomijalny (~2-3 ms/s CPU przy 10k
check/s). `slice(0,32)` (128-bit) potwierdzone jako optymalny kompromis rozmiar
klucza ↔ odporność na kolizje. Hash **nie jest** bottleneckiem (F3 jest).

---

## Threat Model Verdict

**PROCEED WITH IMPLEMENTATION — priorytet HIGH (utrzymać).**

SHA-256 skutecznie eliminuje **oba** wektory kolizji: celowy (T1/E1 = 12, HIGH —
djb2 jawny i trywialnie kolizyjny) oraz przypadkowy (E2 = 9, MEDIUM — birthday
przy ~65k wpisów). To czysta, backward-compatible poprawka bez nowych
zależności.

**Krytyczna uwaga dla implementera:** zakres zadania jest częściowo nieaktualny
— `keyGenerator` (Option C) **już istnieje** w `PolicyCacheConfig`.
Implementacja musi ograniczyć się do wymiany `hashString` (R1/R2) i testów
(R3–R5); **nie dodawać** zduplikowanego `cacheKeyFn`.

**Ryzyko rezydualne po wdrożeniu:**

- **LOW-MEDIUM** (akceptowane, follow-up S1): surowe `userId`/`tenantId`
  pozostają jawne w kluczu in-memory (`contextKey`). Poza scope VS-005 — osobny
  task prywatnościowy.
- **LOW**: narzut CPU SHA-256 na hot path — pomijalny.

**Bloker dla implementacji:** brak (poza korektą zakresu C1/C2 — do
zaktualizowania w zadaniu).

---

_Generated: 2026-05-28 | Method: STRIDE + DREAD + LINDDUN | Task: VS-005 | Audit
ref: SEC-POLICIES-001_
