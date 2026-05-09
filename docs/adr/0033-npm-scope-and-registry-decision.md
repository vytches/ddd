# ADR-0033: NPM Scope and Public Registry Decision

**Date**: 2026-05-08 **Status**: Accepted **Context**: REL-000 task —
pre-publish scope availability check for v0.25.0-beta.1

## Context

The library has been published to **GitHub Packages**
(`https://npm.pkg.github.com`) under the scope `@vytches/*` since its initial
releases (v0.22.5 onwards). Consumers must configure `.npmrc` with a
`$GITHUB_TOKEN` to install — friction that blocks open-source adoption.

For the upcoming public release `@vytches/ddd@0.25.0-beta.1` (target
2026-05-31), we need to confirm:

1. Whether the `@vytches` scope is available on the public npm registry
   (`https://registry.npmjs.org`)
2. What name we publish under (canonical scope vs fallback)
3. The migration strategy for existing GitHub Packages consumers

This ADR records the scope/registry decisions only; the migration _mechanics_
are owned by REL-011 (separate task).

## Investigation results (2026-05-08)

### Direct HTTP probes against `registry.npmjs.org`

```text
GET https://registry.npmjs.org/@vytches%2Fddd            → HTTP 404
GET https://registry.npmjs.org/@vytches%2Fddd-contracts  → HTTP 404
```

**Conclusion**: the `@vytches/ddd` package name (and by extension the `@vytches`
scope) is **not registered on npmjs.org**. The first publish under
`@vytches/ddd@0.25.0-beta.1` will reserve the scope for our org.

### Caveat — local `.npmrc` interference

`npm view @vytches/ddd` from a developer machine returns the GitHub Packages
metadata, because the user's `~/.npmrc` contains:

```
@vytches:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_***
```

This scope-override has higher precedence than the `--registry` CLI flag. Direct
HTTP probes against `registry.npmjs.org` are the authoritative check.

## Decision

### 1. Scope name: `@vytches`

Keep the existing scope. No fallback name needed — the scope is free on
npmjs.org and consistent with the existing `github.com/vytches/ddd` repository
URL.

### 2. Public registry: `npmjs.org` (canonical)

All v0.25.0+ versions publish to `https://registry.npmjs.org` only.

### 3. GitHub Packages: legacy archive

Versions 0.22.5–0.24.5 remain on GitHub Packages as a legacy archive but receive
no new releases. See REL-011 for the cutover plan.

### 4. GitHub repository: unchanged

`github.com/vytches/ddd` continues to host the source code, issues, PRs, GitHub
Actions, Discussions, and Releases. **GitHub Packages registry ≠ GitHub
repository**; only the registry changes. This was the most common point of
confusion during planning.

## Consequences

### Positive

- `npm install @vytches/ddd` works without authentication tokens
- Open-source adoption unblocked — no `.npmrc` setup required
- Standard ecosystem positioning (matches React, Express, NestJS pattern)
- Provenance signing (SLSA Level 2) becomes possible — npm supports it, GitHub
  Packages does not yet

### Negative

- Existing consumers (`juz-ide-api`) must update their `.npmrc` once
- Two version histories exist (GH Packages 0.22–0.24, npm 0.25+)
- New `NPM_TOKEN` secret to manage in CI

### Neutral

- npmjs.org organization free tier supports unlimited public packages
- Version history split is acceptable; consumers pin to specific versions

## Pre-publish checklist (manual, owner action required)

The decision is recorded; the actual registration on npmjs.com requires the
owner's hands and account credentials. Schedule for **before Block 5** (version
unification / publishConfig) but it is **not** a blocker for Block 1–4
implementation work.

- [ ] Log in / register on npmjs.com (owner email TBD)
- [ ] Enable 2FA — required for provenance, automation, write actions (Settings
      → Two-Factor Authentication → "for authorization and writes")
- [ ] Create organization `vytches` (Free tier — public packages free) →
      https://www.npmjs.com/org/create
- [ ] Generate Granular Access Token for CI: - Scope: `@vytches` - Packages:
      `read+write` - Expiration: 90 days - Save value to GitHub Actions secret
      `NPM_TOKEN`
- [ ] Add backup maintainer with publish rights (bus factor)
- [ ] Verify dry-run publish:
      `pnpm publish --dry-run --registry=https://registry.npmjs.org`

If steps above fail (e.g. scope was registered between this ADR and the
pre-publish moment), fall back to `@vytches-ddd` (with hyphen) and update:

- All 21 `package.json` `name` fields
- README install instructions
- CHANGELOG migration recipe
- `.changeset/config.json` fixed group pattern
- ADR-0033 (this file) to record the override

## Security note (out-of-scope but flagged)

During investigation, the user's `~/.npmrc` (not committed to repo) was found to
contain a GitHub PAT in plain text. This token was logged into the investigating
tool's session output. Owner has been notified; rotation is the owner's call
(see REL-007 for project-level secret hygiene; this is personal hygiene).

## References

- REL-000 task:
  `project-orchestration/tasks/REL-000-npm-org-availability-check.md`
- REL-011 task:
  `project-orchestration/tasks/REL-011-github-packages-to-npm-migration.md`
- ROADMAP: `project-orchestration/ROADMAP-RELEASE-2026-05.md`
- KANBAN: `project-orchestration/KANBAN.md`
