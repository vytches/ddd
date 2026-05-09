# Task: Switch publishConfig from GitHub Packages to public npm

## Task Metadata

```yaml
task_id: REL-003
title: Configure all 20 packages for public npmjs.org with provenance
type: refactor
priority: critical
complexity: simple
estimated_time: 3h
created_by: agent (architecture-guardian, security-audit, documentation-master)
created_at: 2026-05-08 14:00
status: parked (awaiting maintainer npmjs.com setup, code-side ready)
release_target: v0.25.0-beta.1
```

## Why This Task Exists

Every `package.json` currently has:

```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com",
  "access": "restricted"
}
```

This blocks `npm install @vytches/ddd` for anyone without a GitHub token. README
claims "From NPM (coming soon)" — coming soon **is now**.

## Current State

- 20 packages publish to GitHub Packages, restricted access
- Consumers must configure `.npmrc` with `$GITHUB_TOKEN`
- `release.yml` workflow uses `pnpm publish` without `--provenance`
- Permissions block lacks `id-token: write`

## Desired State

- All packages publish to `https://registry.npmjs.org` with `access: public`
- npm provenance enabled (SLSA Level 2 signature)
- README install instructions: single `npm install @vytches/ddd` line

## Acceptance Criteria

- [ ] All 20 `packages/*/package.json`: `publishConfig.registry` →
      `https://registry.npmjs.org`, `access` → `public`
- [ ] `release.yml`: add `permissions: { id-token: write, contents: read }`
- [ ] `scripts/publish-packages.sh` adds `--provenance` to `pnpm publish`
- [ ] NPM 2FA enforced on org account (org-level setting, not repo)
- [ ] Smoke test: dry-run `pnpm publish --registry=https://registry.npmjs.org`
      for one package on a feature branch
- [ ] README "Install" section reduced to single command, no `.npmrc` setup

## Risk

Once published as `@vytches/ddd@0.25.0-beta.1`, the name on public npm is ours.
Have a fallback name (`@vytches/ddd-core` or scoped under a personal account)
ready if `@vytches` org is unavailable on npm.
