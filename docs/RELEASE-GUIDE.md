# Release Guide

Jedyne źródło prawdy o procesie releaseowania. ADR-0010 i ADR-0016 są archiwalne
— ten plik je zastępuje.

---

## Podział odpowiedzialności (KRYTYCZNE dla Claude Code)

| Kto        | Co robi                                                           |
| ---------- | ----------------------------------------------------------------- |
| Claude     | Przygotowuje release branch + bumps wersje lerna + pushuje branch |
| Właściciel | Merge PR do `main` + publikacja npm ręcznie przez GitHub Actions  |

**Claude NIE uruchamia `pnpm build` ani `pnpm publish:packages`.** **Claude NIE
uruchamia `pnpm release` (który robi version + build + publish).** **Claude
uruchamia TYLKO: `pnpm lerna version ... --yes` (samo wersjonowanie).**

Publish odbywa się ręcznie przez właściciela w GitHub Actions: → Actions →
"Release" workflow → `workflow_dispatch` → `publish-only`

---

## Stan aktualny

| Co              | Gdzie                                                 |
| --------------- | ----------------------------------------------------- |
| Registry        | **npmjs.org** (publiczny, bez auth)                   |
| Wersjonowanie   | Fixed — wszystkie pakiety tą samą wersją (lerna.json) |
| Branching       | `develop` → `release/*` → `main`                      |
| Publish tool    | `pnpm publish` (konwertuje `workspace:*`)             |
| Versioning tool | `lerna version --conventional-commits`                |

---

## Standardowy Release

Kiedy: masz zmiany na `develop` i chcesz opublikować nową wersję.

```bash
# CLAUDE robi (1-3):

# 1. Utwórz release branch z develop
git checkout develop && git pull
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD

# 2. Zbumpuj wersje (TYLKO wersjonowanie, bez build/publish)
NX_DAEMON=false pnpm lerna version --conventional-commits --yes

# 3. Release branch gotowy — Claude kończy pracę tutaj

# WŁAŚCICIEL robi (4-5):
# 4. Utwórz PR release/YYYY-MM-DD → main i zmerguj
# 5. GitHub Actions → "Release" workflow → Run workflow → publish-only
```

Co robi `pnpm release`:

1. `lerna version --conventional-commits --yes` — bumpuje wersje na podstawie
   commitów (feat → minor, fix → patch), tworzy commit + tagi, pushuje
   automatycznie
2. `pnpm build` — buduje wszystkie pakiety
3. `pnpm publish:packages` — publikuje na npmjs.org (`pnpm publish` konwertuje
   `workspace:*` do konkretnych wersji)

```bash
# 3. PR do main
gh pr create --title "Release $(date +%Y-%m-%d)" --body "Release"
# Po review → merge
```

---

## Hotfix

Kiedy: krytyczny bug na produkcji.

```bash
git checkout main && git pull
git checkout -b hotfix/opis-problemu
git push -u origin hotfix/opis-problemu

# Napraw, commituj
git commit -m "fix(package): opis naprawy"

pnpm release:hotfix   # = patch bump + build + publish

# PR do main
gh pr create --title "HOTFIX: opis-problemu"
```

---

## Pre-release (Alpha / Beta)

Kiedy: chcesz przetestować zmiany z konsumentem zanim wydasz stabilną wersję.

```bash
# 1. Branch z develop
git checkout develop
git checkout -b release/YYYY-MM-DD-alpha
git push -u origin release/YYYY-MM-DD-alpha

# 2. Publikuj alpha (nie nadpisuje dist-tag latest)
pnpm release:alpha   # → 0.26.0 staje się 0.27.0-alpha.0
```

Testowanie w projekcie konsumenckim:

```bash
npm install @vytches/ddd@alpha
```

Kolejne alpha po poprawkach:

```bash
pnpm release:alpha   # → alpha.1, alpha.2, itd.
```

Graduacja do stabilnej — po zmergowaniu do main:

```bash
git checkout main && git pull
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD
pnpm lerna version --conventional-commits --conventional-graduate --yes
pnpm build && pnpm publish:packages
```

> **Uwaga:** Standardowy `pnpm release` bumpuje alpha → alpha+1 (nie do
> stabilnej). Do graduacji użyj `--conventional-graduate`.

---

## Publish-only (bez wersjonowania)

Kiedy: wersje są już ustawione, chcesz tylko zbudować i opublikować.

```bash
pnpm build
pnpm publish:packages
```

---

## Force Publish

Kiedy: lerna nie widzi zmian (bo dotyczyły tylko root files, docs, CI).

```bash
pnpm release:version patch --force-publish --yes
pnpm build
pnpm publish:packages
```

---

## Podgląd i diagnostyka

```bash
pnpm release:changed      # Które pakiety się zmieniły?
pnpm release:preview      # Co zostanie wydane?
DRY_RUN=true pnpm publish:packages   # Dry run publish
pnpm release:collect      # Lista feat/fix commitów od ostatniego tagu
```

---

## Dostępne komendy

| Komenda                | Co robi                                   |
| ---------------------- | ----------------------------------------- |
| `pnpm release`         | Pełny release: version + build + publish  |
| `pnpm release:alpha`   | Alpha pre-release                         |
| `pnpm release:beta`    | Beta pre-release                          |
| `pnpm release:hotfix`  | Patch hotfix                              |
| `pnpm release:publish` | Tylko build + publish (bez wersjonowania) |
| `pnpm release:changed` | Pokaż zmienione pakiety                   |
| `pnpm release:preview` | Podgląd co zostanie wydane                |
| `pnpm release:collect` | Commity feat/fix od ostatniego tagu       |

---

## Conventional Commits → Version Bump

```bash
# PATCH (0.26.0 → 0.26.1)
fix(cqrs): resolve handler registration race
docs: update README examples
test: add coverage for outbox retry

# MINOR (0.26.0 → 0.27.0)
feat(messaging): add exponential backoff for outbox retry
perf(aggregates): optimize apply() single-pass enrichment

# MAJOR (0.26.0 → 1.0.0)
feat!(contracts): redesign IEventBus interface

# lub footer:
feat(contracts): redesign IEventBus interface

BREAKING CHANGE: IEventBus.publish() now requires metadata object.
```

> **NIGDY nie pisz `BREAKING CHANGE: None`** — to wyzwala MAJOR bump!

---

## Branch Strategy

```
develop          ← cała aktywna praca
  └─ release/*   ← tylko tutaj można robić pnpm release (lerna.json allowBranch)
       └─ main   ← stabilne tagi, merge po release
  └─ hotfix/*    ← krytyczne patche z main
```

Lerna blokuje `lerna version` poza `release/*` i `hotfix/*` — to celowe, żeby
nie wersjonować przypadkowo z feature branches.

---

## Instalacja pakietów (konsument)

Pakiety są publiczne na npmjs.com — żadnej konfiguracji nie trzeba.

```bash
# Meta-paczka (wszystko w jednym)
npm install @vytches/ddd

# Indywidualne pakiety
npm install @vytches/ddd-aggregates @vytches/ddd-cqrs @vytches/ddd-events

# Alpha/Beta (testowanie pre-release)
npm install @vytches/ddd@alpha
npm install @vytches/ddd@beta

# Konkretna wersja
npm install @vytches/ddd@0.26.0
```

---

## Błędy i recovery

**`pnpm release` bumpuje alpha → alpha+1 zamiast stabilnej**

```bash
pnpm lerna version --conventional-graduate --yes
pnpm build && pnpm publish:packages
```

**"tag already exists" error**

```bash
git tag -l "*alpha.1" | xargs git tag -d
```

**Publish fails z 401 Unauthorized**

Brak tokenu npm. Ustaw `NPM_TOKEN` w GitHub Secrets → Actions lub lokalnie:

```bash
npm login   # loguje do npmjs.org i zapisuje token do ~/.npmrc
```

**Release przerwany po `lerna version`, przed publish**

```bash
git reset --hard HEAD~1          # cofnij commit wersji
git tag -d @vytches/ddd@x.y.z    # usuń tag (jeśli istnieje)
# napraw problem, potem:
pnpm release
```

**409 Conflict (wersja już istnieje na registry)**

```bash
pnpm release:version patch --force-publish --yes
pnpm build && pnpm publish:packages
```

**EUNCOMMIT error**

Commituj wszystkie zmiany przed `pnpm release`.

---

## Dlaczego pnpm publish, nie lerna publish

`lerna publish` używa `npm publish`, który **nie konwertuje** `workspace:*` do
rzeczywistych wersji. Konsumenci dostaliby pakiety z literalnym
`"@vytches/ddd-acl": "workspace:*"` w dependencies — co łamie instalację.

`pnpm publish` konwertuje `workspace:*` automatycznie (np. `"0.26.0"`). Dlatego:
**lerna tylko wersjonuje**, **pnpm publikuje**.

---

_Zastępuje: ADR-0010 (release process), ADR-0016 (GitHub Packages —
zmigrowaliśmy do npmjs.org w REL-011, 2026-05-22)_
