# Task: Unify package versions and adopt Changesets

## Task Metadata

```yaml
task_id: REL-004
title: Reset all 21 packages to 0.25.0 + configure Changesets fixed group
type: refactor
priority: critical
complexity: simple
estimated_time: 3h
created_by: agent (architecture-guardian, library-api-guardian)
created_at: 2026-05-08 14:00
status: planned
release_target: v0.25.0-beta.1
```

## Why This Task Exists

Package versions are inconsistent: most at `0.22.5`, several at `0.23.x`,
`contracts` at `0.24.5`, and `@vytches/ddd-nestjs` at `12.1.2` — the last is
a clear lapsus (NestJS peer dep version copied as package version).

Five different versions in one monorepo signal an inconsistent release cadence
and confuse consumers about API stability.

## Current State

| Package | Version |
|---|---|
| nestjs | 12.1.2 (lapsus) |
| contracts | 0.24.5 |
| enterprise, policies, validation | 0.23.5 |
| cqrs, events | 0.23.2 |
| 13 others | 0.22.5 |

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
