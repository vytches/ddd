# Task: Migrate from GitHub Packages to public npmjs.org

## Task Metadata

```yaml
task_id: REL-011
title:
  Strategy + execution for moving @vytches/* from GitHub Packages to public npm
type: refactor
priority: critical
complexity: medium
estimated_time: 3h
created_by: human (production-quality decision 2026-05-08)
created_at: 2026-05-08
status: parked (awaiting REL-003 + maintainer npm setup)
release_target: v0.25.0-beta.1
depends_on:
  - REL-000 (npm scope confirmed available)
  - REL-003 (publishConfig switched to npmjs.org)
  - REL-004 (version unified)
sequence_position: just before final publish
```

## Why This Task Exists

The library currently lives on GitHub Packages (`https://npm.pkg.github.com`,
`access: restricted`) under `@vytches/*`. Consumers must configure `.npmrc` with
`$GITHUB_TOKEN` to install — friction that blocks open-source adoption. REL-003
changes the registry config; this task handles the **migration strategy** (what
happens to existing GH Packages versions, when consumers should switch,
dual-publishing window, etc.).

## Migration strategy options

### Option A — Hard cutover (recommended, simplest)

- v0.25.0-beta.1 onwards: publish only to npmjs.org
- GH Packages: stop publishing, leave existing versions as legacy archive
- Consumers (`juz-ide-api`): update `.npmrc` to point to npmjs.org, drop
  `$GITHUB_TOKEN` requirement
- Old versions (0.22.5–0.24.5) remain on GH Packages, never republished

**Pros**: clean, no maintenance overhead, signals serious public commitment.
**Cons**: consumers pinning `^0.24.0` won't auto-update; require manual lockfile
update. **Mitigation**: 1-week notice + migration recipe in CHANGELOG +
`juz-ide-api` smoke test verifies migration works before public announce.

### Option B — Dual publish for transition (3 months)

- Publish to both registries simultaneously via two `pnpm publish` calls in CI
- Announce sunset date for GH Packages (e.g. 2026-09-01)
- Auto-update existing consumers transparently

**Pros**: zero consumer break. **Cons**: ongoing CI complexity, two version
histories to keep in sync, two sets of credentials to maintain. **Recommended
only if** there are external consumers we don't control.

### Option C — Mirror history (republish 0.22–0.24 to npm)

- Republish all historical versions to npmjs.org so install history is
  continuous
- Risk: package names may already be taken on npm
- Risk: legal/tag mismatch between registries

**Pros**: pretends migration never happened. **Cons**: complex, error-prone,
often impossible. Not recommended.

## Recommendation

**Option A (hard cutover)** for v0.25.0-beta.1. The library's only known
consumer is `juz-ide-api` (memory: silverhand's own project). We control both
sides — no real third-party consumers exist yet to protect. Hard cutover is
clean and signals "this is now a public npm library, not an internal GH Packages
artifact".

## Acceptance Criteria

### Pre-publish (this task)

- [ ] Decision recorded in ADR (`docs/adr/0043-github-to-npm-migration.md`) with
      chosen option + rationale
- [ ] CHANGELOG `## [0.25.0-beta.1]` entry: "Registry: now publishing to
      npmjs.org. GitHub Packages versions remain as legacy archive."
- [ ] Migration recipe in CHANGELOG: ``` # Old (.npmrc):
      @vytches:registry=https://npm.pkg.github.com
      //npm.pkg.github.com/:\_authToken=${GITHUB_TOKEN}

      # New:
      # nothing — drop the @vytches:registry line, default registry works
      ```

- [ ] `juz-ide-api` `.npmrc` migration documented (delete the @vytches scope
      override; drop `$GITHUB_TOKEN` env requirement)

### CI/CD

- [ ] `release.yml`: GH Packages publish step removed
- [ ] `release.yml`: npmjs.org publish enabled with `--provenance` (REL-003
      handles provenance; this just ensures the registry is correctly targeted)
- [ ] Verify NPM_TOKEN secret added to GitHub Actions (org-level, with 2FA)
- [ ] First publish: dry-run via
      `pnpm publish --registry=https://registry.npmjs.org --dry-run`

### Smoke test (post-publish, separate task)

- [ ] On a clean machine without `$GITHUB_TOKEN`: `npm install @vytches/ddd`
      succeeds, no warnings, no auth prompt
- [ ] `juz-ide-api` lockfile updated to npm registry, all 16K tests pass

### Post-publish announcement

- [ ] GitHub repo README: badge for npmjs.org version replaces GH Packages badge
- [ ] Pinned issue or release notes explaining the migration
- [ ] If any users exist on GH Packages: email/issue notification 4 weeks before
      sunset (we don't expect any external consumers right now, but check
      `npm view @vytches/ddd` GH Packages downloads first)

## Effort breakdown (3h)

| Step                                                          | Hours |
| ------------------------------------------------------------- | ----- |
| Write ADR + decision                                          | 0.5h  |
| CHANGELOG migration recipe + verify                           | 0.5h  |
| `release.yml` cleanup (GH publish removal, npm publish setup) | 1h    |
| Dry-run + smoke verification on test branch                   | 1h    |

## Risks

- **NPM_TOKEN not configured** — fail to publish. Mitigation: configure in Phase
  0 alongside REL-000 npm org check. Test with a no-op tag first.
- **Name squatting** — if `@vytches` was taken between REL-000 check and
  publish, fall back to scope chosen in REL-000.
- **GH Packages downloads ≠ 0** — someone external may be using it. Run
  `npm view @vytches/ddd@<latest> --registry=https://npm.pkg.github.com` and
  check download stats before sunsetting.
