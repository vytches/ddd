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

| Co              | Gdzie                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Registry        | **npmjs.org** (publiczny, bez auth)                                   |
| Wersjonowanie   | Fixed — wszystkie pakiety tą samą wersją (lerna.json, `forcePublish`) |
| Branching       | `develop` → `release/*` → `main`                                      |
| Publish tool    | `pnpm publish` (konwertuje `workspace:*`)                             |
| Versioning tool | `lerna version --conventional-commits`                                |

---

## Standardowy Release

Kiedy: masz zmiany na `develop` i chcesz opublikować nową wersję.

```bash
# CLAUDE robi (1-3):

# 1. Utwórz release branch z develop
git checkout develop && git pull
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD

# 2. Check that lerna will count changes from the right tag (it stops and says
#    why if not, see "Process pitfalls"), then bump the versions
#    (versioning ONLY, no build/publish)
pnpm release:preflight
NX_DAEMON=false pnpm lerna version --conventional-commits --yes

# 3. Release branch gotowy — Claude kończy pracę tutaj

# WŁAŚCICIEL robi (4-5):
# 4. Utwórz PR release/YYYY-MM-DD → main i zmerguj
# 5. GitHub Actions → "Release" workflow → Run workflow → publish-only
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

Graduacja do stabilnej — gdy alpha jest przetestowana:

Branch wychodzi z `develop`, tak samo jak przy standardowym release — zgodnie z
sekcją [Branch Strategy](#branch-strategy). Alphy w tym repo są mergowane do
`develop`, a nie do `main`; `main` dostaje wszystko dopiero release'owym PR-em,
więc potrafi być setki commitów z tyłu. Startowanie brancha graduacyjnego z
`main` wyda stabilną wersję z przestarzałego drzewa, bez pracy zrobionej od
ostatniego release'u.

```bash
# CLAUDE robi (1-3):

# 1. Branch z develop
git checkout develop && git pull
git checkout -b release/YYYY-MM-DD
git push -u origin release/YYYY-MM-DD

# 2. Zbumpuj wersje z graduacją (TYLKO wersjonowanie, bez build/publish)
NX_DAEMON=false pnpm lerna version --conventional-commits --conventional-graduate --yes

# 3. Release branch gotowy — Claude kończy pracę tutaj

# WŁAŚCICIEL robi (4-5):
# 4. Utwórz PR release/YYYY-MM-DD → main i zmerguj
# 5. GitHub Actions → "Release" workflow → Run workflow → publish-only
```

> **Uwaga:** Standardowy `pnpm release` bumpuje alpha → alpha+1 (nie do
> stabilnej). Do graduacji użyj `--conventional-graduate`.

> **Sanity check przed krokiem 2:** >
> `git merge-base --is-ancestor v<ostatnia-alpha> develop` musi przejść. Jeśli
> nie — branch alphowy nie jest w `develop` i graduacja pominie jego zawartość.

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

## Process pitfalls

This section exists because several settings look unnecessary or odd, and each
one answers a specific failure. Read why it is there before you change it.

### 1. Every package gets the same version (`forcePublish`)

In fixed mode lerna bumps **only the packages that changed** since the last tag
by default. A release that touched a single package (0.32.1: only the ESLint
plugin) left `@vytches/ddd` and the rest on the old number, although this guide
says the version is shared. So `lerna.json` sets
`command.version.forcePublish: true`: every release raises all packages and
`lerna.json` to the same version.

The cost: every release also publishes the packages that did not change (same
content, new number). If you ever want to bump only what changed:
`pnpm lerna version patch --no-force-publish --yes`. Note that `lerna changed`
reads this setting too, so it reports everything as changed.

### 2. Lerna has to see the tag of the previous release

Lerna works out "what changed" from the **last tag it can reach**. If that is
not the tag for the version in `lerna.json`, nothing fails: you get a changelog
that repeats work already released, and every package marked as changed. Three
things decide whether lerna sees the tag:

| Condition                                                               | Why                                                                                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tag is **annotated** (`git tag -a`)                                 | The `git describe` lerna uses has no `--tags`, so it skips lightweight tags                                                                                       |
| The release PR is merged with a **merge commit, not a squash**          | A squash collapses the branch into a new commit on `main`; the tagged commit stops being an ancestor of `main`                                                    |
| `lerna.json` sets `includeMergedTags: true` (version, changed, publish) | Lerna searches with `--first-parent` by default, and after a merge commit the tag sits on the second parent, so **a merge commit alone is not enough** without it |

Checked by experiment (lerna 8.2.4): on a throwaway merge commit,
`git describe --first-parent` returned `v0.31.1` and plain `git describe`
returned `v0.32.1`. Lerna with default settings searched from `v0.31.1` and
treated 20 packages as changed. With `includeMergedTags` it searched from
`v0.32.1` and found no changes.

`pnpm release:preflight` (`scripts/release-preflight.mjs`) checks this before
`lerna version` and stops the release with an explanation when the last
reachable tag is not `v<version from lerna.json>`, when that tag is lightweight,
or when someone removed `includeMergedTags`. Do not run `lerna version` while it
exits with an error.

### 3. A squash already happened: what to do

It happened at 0.27, 0.31.0 and 0.32.0. Compare the content first:

```bash
git diff --stat <tag-commit> origin/main    # how does the tag differ from what was released?
```

**The difference is empty** (as with 0.31.0): move the tag to the squash commit.
The content is identical, so nothing is lost.

```bash
git tag -f -a vX.Y.Z origin/main -m "vX.Y.Z"
git push origin :refs/tags/vX.Y.Z
git push origin vX.Y.Z
git describe --tags origin/main            # must return vX.Y.Z
```

**The difference is not empty** (as with 0.32.0: the tag sat before the CI
fixes, and `main` is what went to npm): do **not** move the tag, because it
would describe different content than what was released. Instead, for the
duration of one versioning run, set a **local** annotated tag on the squash
commit so that lerna and `release:preflight` count from the right place, and
restore the original afterwards. Leave the remote tag alone.

```bash
git rev-parse vX.Y.Z                                          # note the original tag object
git tag -f -a vX.Y.Z origin/main -m "temporary, local"        # before lerna version
# ... pnpm release:preflight && pnpm lerna version ... --no-push
git tag -f vX.Y.Z <noted-tag-object>                          # after versioning
```

Do not run `git fetch --tags --force` between creating a new tag and pushing it:
it overwrites the local tag with the remote one.

Merge the next release PR with a merge commit. Its tag then enters the history
of `main`, and later releases need no workaround.

### 4. Publish order

`scripts/publish-packages.sh` publishes packages in dependency order
(`scripts/publish-order.mjs`), not alphabetically. Alphabetically,
`@vytches/ddd` (`packages/enterprise`) reached npm before `events`, `utils` and
`value-objects`, which it depends on by exact version, and for a few minutes
installs failed with a 404 (v0.32.0). Do not replace this with a loop over
`packages/*/`.

### 5. Before you hand a release to the owner

Not everything that breaks the pipeline shows up without trying it. Replay the
jobs of `.github/workflows/ci.yml` locally on the release branch:
`format:check`; `nx affected` for `lint`, `type-check`, `test` and `build`;
`api-extractor` for the four packages; `pnpm deps:check`; `madge`;
`docs-compile-gate:check`; `example-matrix:check`; the quality gates and
`bundle-size-monitor`; `pnpm build` together with the publish smoke test
(`pnpm test:smoke`); `pnpm audit --prod --audit-level moderate`. A new package
needs an entry in `sizeThresholds` in
`scripts/quality-gates/bundle-size-monitor.js`, otherwise it gets the default
100 KB. A `401` in the `npm whoami` step of the "Release" workflow is a problem
with the `NPM_TOKEN` secret (expired, or limited to existing packages), not with
the repo.

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
