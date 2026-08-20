# Task: PolicyCache v2 — silently-inverted cacheFailures option + unbounded growth

## Task Metadata

```yaml
task_id: VB-006
title:
  PolicyCache v2 — fix silently-inverted cacheFailures, bound cache growth, fix
  latent LRU leak
type: bug
priority: critical
complexity: medium
estimated_time: 3-4h
created_by: agent (analysis VP-012-hotpath-quickwins, consultation 2026-08-20)
created_at: 2026-08-20
status: backlog
release_target: post-first-publish OK
package: '@vytches/ddd-policies'
findings: [B1, B2, B3, F14_boczne, F16_konsultacja_KOREKTA]
```

## Dlaczego

Znalezione przy okazji audytu VP-012c (ten sam plik, `cached-policy.ts`), poza
zakresem tamtego taska (decyzja D4). Panel ocenił priorytet **wyższy niż
VP-012** — to jest ten task, nie kolejny quick-fix przy okazji.

1. **B2 — martwy przełącznik bezpieczeństwa (najpilniejsze)**:
   `cached-policy.ts:508` — `cacheFailures: options.cacheFailures || true`.
   `false || true` = `true` zawsze — opcja jest nieoperacyjna. W
   `forExpensivePolicy()` (linia ~476/490, tworzy politykę przez fabrykę z
   jawnym `cacheFailures: false`) świadoma decyzja konsumenta o NIE-cache'owaniu
   odmów autoryzacji jest po cichu odwracana. JSDoc klasy explicite ostrzega
   przed cache'owaniem deny/allow w politykach autoryzacyjnych — to jest bug
   logiczny w bezpośrednim konflikcie z własną dokumentacją, nie dług
   techniczny. Fix: `??` zamiast `||`.
2. **B1 — nieograniczony wzrost pamięci**: `PolicyCache.set()` (linia ~132)
   przyjmuje `maxSize?: number` jako opcjonalny parametr — limit rozmiaru
   egzekwowany tylko `if (maxSize && ...)`. Fabryki `create()` / `withTTL()` /
   `withCustomKey()` mogą nie przekazać `maxSize` w ogóle → cache rośnie bez
   końca. Wymaga mini-decyzji projektowej: sensowny domyślny `maxSize` vs
   wymuszony (wymagany parametr) vs sweeper TTL działający niezależnie od
   rozmiaru — nie jest to prosta łatka jednej linii.
3. **B3 — latentny LRU node leak**: przy re-`set()` na istniejący klucz węzeł
   LRU może osierocieć się bez usunięcia starego wpisu z listy. Dziś
   nieosiągalny przez `check()` (miss zawsze robi `delete()`+`removeNode()`
   przed `set()`), ale to przypadkowa ochrona, nie gwarancja kontraktu metody
   `set()` — każdy przyszły bezpośredni wywołujący `set()` na istniejącym kluczu
   odziedziczy leak.

Jeden wspólny task (nie trzy osobne PR-y), bo to trzy objawy jednego braku:
`PolicyCache` nie ma spójnego kontraktu limitów/sweep/LRU. Łatanie ich osobno w
krótkim odstępie na tej samej strukturze węzłów zwiększa ryzyko regresji
(decyzja D4, zmieniona po konsultacji 2026-08-20 vs pierwotna rekomendacja
panelu, która sugerowała B2 osobno).

**Ostrzeżenie**: numery linii powyżej mogą się przesunąć — VP-012c (`2963a684`)
już zmienił ten plik (redukcja `generateCacheKey()` do jednego digestu).
Zweryfikuj przez `grep -n cacheFailures` / `grep -n maxSize` przed
implementacją, nie ufaj ślepo numerom z tego pliku.

## Acceptance Criteria

1. [ ] `cacheFailures` faktycznie respektuje jawne `false` przekazane przez
       konsumenta (`??` zamiast `||`) — test: `forExpensivePolicy()` z jawnym
       `cacheFailures: false` NIE cache'uje odmowy.
2. [ ] Zero pozostałych wystąpień wzorca `options.X || <literal>` gdziekolwiek
       indziej w pliku (ten typ buga lubi występować wielokrotnie w jednym
       pliku, patrz D4 uzasadnienie) — sprawdzone grepem.
3. [ ] `PolicyCache` ma spójny, udokumentowany kontrakt limitu rozmiaru —
       decyzja: domyślny `maxSize` sensowny dla typowego użycia, LUB wymagany
       parametr, LUB sweeper TTL niezależny od rozmiaru. Uzasadnij wybór w
       komentarzu/JSDoc, nie tylko w commicie.
4. [ ] LRU node leak przy re-`set()` na istniejącym kluczu naprawiony i pokryty
       testem, który go faktycznie odtwarza (nie polega na przypadkowej ochronie
       przez `check()`).
5. [ ] Nowy test kontraktowy `policy-cache-config.contract.spec.ts` (decyzja D4)
       pilnujący zgodności JSDoc↔zachowanie dla WSZYSTKICH opcji configu w tym
       pliku, nie tylko `cacheFailures` — żeby ten sam typ regresji nie wrócił
       cicho przy przyszłej zmianie.
6. [ ] Zero zmian publicznego API poza tym co jest jawnie potrzebne do naprawy
       kontraktu limitu (jeśli decyzja z AC3 wymaga zmiany sygnatury — to jest
       wtedy świadoma, udokumentowana zmiana, nie przypadkowa).

## Uwaga

To NIE jest rozszerzenie VP-012 — osobny task na wyraźne życzenie panelu
(priorytet wyższy niż VP-012, decyzja D4). `/analyze VB-006` zalecane przed
implementacją — decyzja o kontrakcie limitu (AC3) to realny wybór projektowy,
nie oczywista łatka.

## References

- Odkryte i uzasadnione w:
  `project-orchestration/analysis/VP-012-hotpath-quickwins.analysis.md`
  (F14_boczne, F16_konsultacja_KOREKTA, decyzja D4)
