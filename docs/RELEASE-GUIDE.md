# Release Guide

Praktyczny przewodnik krok-po-kroku. Szczegoly techniczne w
[ADR-0010](adr/0010-release-process-and-branching-strategy.md).

## Standardowy Release

Kiedy: masz zmiany na main i chcesz opublikowac nowa wersje.

```bash
# 1. Przejdz na main
git checkout main
git pull

# 2. Utworz release branch
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD

# 3. Opublikuj (jedno polecenie robi wszystko)
pnpm release

# 4. PR do main (zeby wersje wrocily do main)
#    Utworz na GitHubie: release/YYYY-MM-DD → main
#    Po review → merge
```

Co robi `pnpm release`:

1. Bumpuje wersje na podstawie commitow (feat → minor, fix → patch)
2. Tworzy commit z nowymi wersjami + tagi
3. Pushuje commit i tagi automatycznie
4. Buduje wszystkie pakiety
5. Publikuje na GitHub Packages (dist-tag: `latest`)

## Pre-release (Alpha/Beta)

Kiedy: masz duzo zmian i chcesz je przetestowac zanim wydasz stabilna wersje.

### Faza 1: Publikacja alpha

```bash
# 1. Utworz release branch z develop (lub main)
git checkout develop
git checkout -b release/YYYY-MM-DD-alpha
git push -u origin release/YYYY-MM-DD-alpha

# 2. Opublikuj alpha
pnpm release:alpha
```

Wersje: `0.22.4` → `0.22.5-alpha.0` Dist-tag: `alpha` (nie nadpisuje `latest`)

### Faza 2: Testowanie

```bash
# W projekcie konsumenckim:
pnpm add @vytches/ddd-contracts@alpha @vytches/ddd-events@alpha
```

Jesli cos nie dziala — fix na develop, merge do release brancha, powtorz:

```bash
pnpm release:alpha    # → alpha.1, alpha.2, itd.
```

### Faza 3: Stabilny release

```bash
# 1. Zmerguj alpha branch do main (PR na GitHubie)
# 2. Utworz nowy release branch z main
git checkout main && git pull
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD

# 3. Graduuj alpha do stabilnej
pnpm lerna version --conventional-commits --conventional-graduate --yes

# 4. Zbuduj i opublikuj
pnpm build
pnpm publish:packages

# 5. PR do main
```

Wersje: `0.22.5-alpha.0` → `0.22.5` Dist-tag: `latest`

**UWAGA:** Standardowy `pnpm release` bumpuje alpha do alpha+1 (nie do
stabilnej). Do graduacji alpha → stabilna uzyj:
`pnpm lerna version --conventional-graduate`.

## Hotfix

Kiedy: krytyczny bug na produkcji, trzeba szybko wydac patch.

```bash
git checkout main && git pull
git checkout -b hotfix/opis-problemu
git push -u origin hotfix/opis-problemu

# Napraw buga, commituj
git commit -m "fix(package): opis naprawy"

# Wydaj patch
pnpm release:hotfix

# PR do main
```

## Publish-only (bez wersjonowania)

Kiedy: wersje juz sa ustawione, chcesz tylko zbudowac i opublikowac.

```bash
pnpm build
pnpm publish:packages
```

## Dry run (podglad zmian)

```bash
pnpm release:changed     # Jakie pakiety sie zmienily?
pnpm release:preview      # Co zostanie wydane?
DRY_RUN=true pnpm publish:packages   # Co zostaloby opublikowane?
```

## Dostepne komendy

| Komenda                | Co robi                                   |
| ---------------------- | ----------------------------------------- |
| `pnpm release`         | Pelny release: version + build + publish  |
| `pnpm release:alpha`   | Alpha pre-release                         |
| `pnpm release:beta`    | Beta pre-release                          |
| `pnpm release:hotfix`  | Patch hotfix                              |
| `pnpm release:publish` | Tylko build + publish (bez wersjonowania) |
| `pnpm release:changed` | Pokaz zmienione pakiety                   |
| `pnpm release:preview` | Podglad co zostanie wydane                |

## Instalacja pakietow (konsument)

### Jednorazowa konfiguracja

```bash
echo "@vytches:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=TWOJ_GITHUB_PAT" >> ~/.npmrc
```

Token potrzebuje scope `packages:read` (konsument) lub `packages:write`
(publikacja).

### Instalacja

```bash
# Stabilna wersja (latest)
pnpm add @vytches/ddd-contracts

# Alpha
pnpm add @vytches/ddd-contracts@alpha

# Konkretna wersja
pnpm add @vytches/ddd-contracts@0.24.5
```

## FAQ

**Q: `pnpm release` bumpuje do alpha+1 zamiast stabilnej?** A: Uzyj
`pnpm lerna version --conventional-graduate --yes` zamiast `pnpm release`.

**Q: Lerna crashuje z "minimatch is not a function"?** A: Overrides w
package.json sa unbounded. Napraw:

```bash
sed -i 's/">=3.1.4"/">=3.1.4 <4.0.0"/' package.json
sed -i 's/">=7.4.8"/">=7.4.8 <8.0.0"/' package.json
sed -i 's/">=9.0.7"/">=9.0.7 <10.0.0"/' package.json
sed -i 's/">=2.0.3"/">=2.0.3 <3.0.0"/' package.json
pnpm install --ignore-scripts
```

**Q: "tag already exists" error?** A: Usun stare tagi:
`git tag -l "*alpha.1" | xargs git tag -d`

**Q: Publish fails with 401 Unauthorized?** A: Brak tokenu w `~/.npmrc`. Dodaj:

```
@vytches:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=TWOJ_GITHUB_PAT
```

**Q: EUNCOMMIT error?** A: Commituj wszystkie zmiany przed `pnpm release`.
