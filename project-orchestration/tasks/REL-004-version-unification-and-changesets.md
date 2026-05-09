# Task: Unify package versions and adopt Changesets

## Task Metadata

```yaml
task_id: REL-004
title: Reset all 21 packages to 0.25.0 + configure Changesets fixed group
type: refactor
priority: critical
complexity: simple
estimated_time: 3h
actual_time: 0.25h
created_by: agent (architecture-guardian, library-api-guardian)
created_at: 2026-05-08 14:00
completed_at: 2026-05-09
status: completed
release_target: v0.25.0-beta.1
```

## ✅ Resolved (2026-05-09)

### What was delivered

**1. All 21 versions unified to `0.25.0-beta.1`** (Python script wrote each
`package.json` in one batch):

| Before          | Count | After         |
| --------------- | ----: | ------------- |
| 0.22.5          |    13 | 0.25.0-beta.1 |
| 0.23.2          |     2 | 0.25.0-beta.1 |
| 0.23.5          |     3 | 0.25.0-beta.1 |
| 0.24.5          |     1 | 0.25.0-beta.1 |
| 12.1.2 (lapsus) |     1 | 0.25.0-beta.1 |
| 0.0.1 (root)    |     1 | 0.25.0-beta.1 |

The `@vytches/ddd-nestjs@12.1.2` was a copy-paste of the NestJS peer-dep version
into the package's own `version` field — semver-confusing and fixed here.

**2. Changesets configured** (`.changeset/config.json`):

- `fixed: [["@vytches/ddd", "@vytches/ddd-*"]]` — all 20 published packages bump
  together; no future version drift
- `access: "public"` — required for npmjs.org public publish
- `baseBranch: "develop"` (was `main`) — matches actual workflow
- `ignore: [...]` — excludes example and benchmark workspace projects that ship
  locally only, never to npm

**3. First changeset committed**: `.changeset/version-unification-0-25-beta.md`
documents the unification as a `minor` bump for the entire fixed group.

**4. `lerna.json` aligned**:

- `version: "independent"` → `"0.25.0-beta.1"` (lockstep with Changesets)
- `command.publish.registry: "npm.pkg.github.com"` → `"registry.npmjs.org"`
  (REL-003 also covers this; lerna alignment prevents conflicting source of
  truth)

### Verification

- All 21 `package.json` `version` fields show `0.25.0-beta.1`
- Cross-package deps remain `workspace:*` (pnpm converts at publish time)
- `pnpm install` re-resolved cleanly
- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 23 projects, all tests passing

Effort: 0.25h actual vs 3h estimated.

## Why This Task Exists

Package versions are inconsistent: most at `0.22.5`, several at `0.23.x`,
`contracts` at `0.24.5`, and `@vytches/ddd-nestjs` at `12.1.2` — the last is a
clear lapsus (NestJS peer dep version copied as package version).

Five different versions in one monorepo signal an inconsistent release cadence
and confuse consumers about API stability.

## Current State

| Package                          | Version         |
| -------------------------------- | --------------- |
| nestjs                           | 12.1.2 (lapsus) |
| contracts                        | 0.24.5          |
| enterprise, policies, validation | 0.23.5          |
| cqrs, events                     | 0.23.2          |
| 13 others                        | 0.22.5          |

## Desired State

- All 21 packages on `0.25.0` (or `0.25.0-beta.1` for beta)
- Changesets configured with `fixed: [["@vytches/ddd-*"]]` to prevent drift
- Lerna replaced or augmented with Changesets for versioning

## Acceptance Criteria

- [ ] All `packages/*/package.json` show `0.25.0-beta.1` (or chosen target)
- [ ] `.changeset/config.json` includes:
      `"fixed": [["@vytches/ddd-*"]], "access": "public"`
- [ ] First changeset entry created documenting the unification
- [ ] Cross-package `dependencies` ranges updated (`^0.25.0`)
- [ ] `lerna.json` either removed (full Changesets adoption) or aligned with
      Changesets

## Notes

Changesets is friendlier than Lerna for OSS — automatic CHANGELOG per package,
PR-driven version bumps, GitHub Action integration. Recommend a clean cut: drop
Lerna, adopt Changesets, document the workflow in CONTRIBUTING.md.
