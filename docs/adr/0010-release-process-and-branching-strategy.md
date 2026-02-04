# ADR-0010: Release Process and Branching Strategy

**Date:** 2025-07-12 **Status:** Accepted (Updated 2026-02-04) **Context:**
Release process for VytchesDDD library with GitHub Packages and Independent
Versioning

## Context

VytchesDDD is an enterprise-grade TypeScript library with 21 packages requiring
consistent, reliable release process. We use **Independent Versioning with
Semantic Versioning** combined with a release-branch workflow.

### Technical Background: workspace:\* Protocol

Packages in this monorepo use pnpm's `workspace:*` protocol for internal
dependencies. This protocol must be converted to actual version numbers during
publish. **Only `pnpm publish` handles this conversion** - `lerna publish` and
`npm publish` do not. For this reason, we use `lerna version` for versioning and
`pnpm publish` (via `pnpm publish:packages`) for publishing.

## Decision

We adopt **Independent Versioning** where each package maintains its own
semantic version. Versioning is handled by `lerna version` (conventional
commits). Publishing is handled by `pnpm publish` (converts `workspace:*`).

## Release Process - Step by Step

### Standard Release (A to Z)

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create release branch
git checkout -b release/YYYY-MM-DD

# 3. Push branch to remote (required by lerna version)
git push origin release/YYYY-MM-DD

# 4. Release: version + build + publish (single command)
pnpm release
#    Internally runs:
#    - lerna version --conventional-commits --yes  (bump versions, create commit + tags)
#    - pnpm build                                  (build all packages)
#    - pnpm publish:packages                       (pnpm publish per package)

# 5. Push version commit and tags
git push origin release/YYYY-MM-DD --tags

# 6. Create PR to main and merge
gh pr create --title "Release YYYY-MM-DD" --body "Release"
# After review → merge PR
```

### Hotfix Release

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/description

# 2. Make fixes, commit with conventional commits
git commit -m "fix(package): description of fix"

# 3. Push branch to remote
git push origin hotfix/description

# 4. Hotfix release (forces patch bump)
pnpm release:hotfix

# 5. Push version commit and tags
git push origin hotfix/description --tags

# 6. Create urgent PR to main
gh pr create --title "HOTFIX: description"
```

### Pre-release (Alpha/Beta)

```bash
# 1. Create release branch
git checkout -b release/YYYY-MM-DD-alpha

# 2. Push to remote
git push origin release/YYYY-MM-DD-alpha

# 3. Create alpha versions
pnpm release:alpha    # or pnpm release:beta

# 4. Push
git push origin release/YYYY-MM-DD-alpha --tags
```

## Available Commands

### Investigation

```bash
pnpm release:changed       # See what packages changed since last release
pnpm release:collect       # See all feat/fix commits since last tag
pnpm release:preview       # Preview what will be released
```

### Release

```bash
pnpm release               # Full release: version (auto) + build + publish
pnpm release:hotfix        # Hotfix: patch version + build + publish
pnpm release:alpha         # Alpha pre-release + build + publish
pnpm release:beta          # Beta pre-release + build + publish
```

### Manual Steps (if needed separately)

```bash
pnpm release:version                 # Only bump versions (lerna version)
pnpm release:version patch --yes     # Force patch bump
pnpm build                           # Only build packages
pnpm publish:packages                # Only publish (requires prior build)
pnpm release:publish                 # Build + publish (without versioning)
```

### Force Publish (when lerna sees no changes)

Lerna only detects changes inside `packages/*/`. If changes are in root files
only (scripts, CI config), lerna won't bump. Use `--force-publish`:

```bash
pnpm release:version patch --force-publish --yes
pnpm build
pnpm publish:packages
```

## Independent Package Versioning

Each package evolves independently following semantic versioning:

```bash
@vytches/ddd-core@1.0.0         # Stable meta-package
@vytches/ddd-events@1.2.3       # Active development
@vytches/ddd-logging@0.9.0      # Pre-1.0 evolution
@vytches/ddd-cqrs@2.0.1         # Major version with patch
```

**Why Independent Versioning:**

- Modularity: DDD patterns are naturally modular
- Selective Usage: Users install only needed packages
- Non-blocking Evolution: Breaking changes in one package don't affect others
- Clear Dependencies: Explicit version management per domain

## Branch Strategy

### Production Branches

- `main` - Stable production releases only. Never publish directly from main.
- `release/YYYY-MM-DD` - Release preparation. Publish happens here.
- `hotfix/description` - Critical production fixes. Publish happens here.

### Development Branches

- `feature/description` - Individual feature development. No versioning.

### Branch Permissions (lerna.json)

```json
{
  "version": {
    "allowBranch": ["main", "master", "release/*", "hotfix/*"]
  }
}
```

Feature branches are intentionally excluded to enforce proper release workflow.

### Release Branch Naming

```bash
release/2026-02-04         # Standard release
release/2026-02-04-1       # Second release same day
release/2026-02-04-alpha   # Pre-release
hotfix/security-patch      # Hotfix
```

## Conventional Commits

### Commit Message Format

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Version Bump Rules

```bash
# PATCH (1.0.0 -> 1.0.1)
fix(core): resolve circular dependency
docs: update README examples
test: add test coverage

# MINOR (1.0.0 -> 1.1.0)
feat(events): add retry mechanism
perf(core): optimize EntityId validation

# MAJOR (1.0.0 -> 2.0.0)
feat!(core): redesign EntityId API
# or with footer:
feat(core): redesign EntityId API

BREAKING CHANGE: EntityId.create() now requires type parameter.
```

### CRITICAL: Never Use "BREAKING CHANGE: None"

```bash
# WRONG - triggers MAJOR bump!
fix(nestjs): fix handler registration

BREAKING CHANGE: None

# CORRECT - omit BREAKING CHANGE section entirely
fix(nestjs): fix handler registration
```

## Authentication

### Local Development (terminal publishing)

Add to `~/.npmrc`:

```
@vytches:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

Token needs `packages:write` scope.

### CI (GitHub Actions)

Token is set automatically via workflow:

```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Technical Architecture

### Why pnpm publish instead of lerna publish

`lerna publish` internally uses `npm publish` which does NOT convert pnpm's
`workspace:*` protocol to actual version numbers. This caused published packages
to contain literal `"@vytches/ddd-acl": "workspace:*"` in dependencies, breaking
installation for consumers.

`pnpm publish` automatically converts `workspace:*` to the resolved version
(e.g., `"@vytches/ddd-acl": "0.22.0"`). The `publish:packages` script
(`scripts/publish-packages.sh`) iterates over all packages and runs
`pnpm publish` for each one.

### How pnpm release works internally

```
pnpm release
  |
  ├── lerna version --conventional-commits --yes
  |     ├── Analyzes conventional commits since last tag
  |     ├── Determines version bump per package (patch/minor/major)
  |     ├── Updates package.json versions
  |     ├── Creates git commit "chore: publish releases"
  |     └── Creates git tags (@vytches/ddd-core@1.2.0, etc.)
  |
  ├── pnpm build
  |     └── Builds all packages (dist/ directories)
  |
  └── pnpm publish:packages (scripts/publish-packages.sh)
        └── For each package with dist/:
              └── pnpm publish --registry=https://npm.pkg.github.com
                    └── Converts workspace:* to actual versions
                    └── Publishes to GitHub Packages
```

## GitHub Integration

### Git Tags

Lerna creates package-specific tags:

```bash
@vytches/ddd-core@1.0.0
@vytches/ddd-events@1.2.3
```

Always push with `--tags` after release.

### GitHub Packages

All packages publish to `https://npm.pkg.github.com` with restricted access.

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

### CI Workflow (`.github/workflows/release.yml`)

The CI workflow supports manual dispatch with options:

- **auto** - Standard release with conventional commits
- **patch/minor/major** - Force specific bump type
- **hotfix** - Quick validation + patch bump
- **publish-only** - Skip versioning, only publish existing versions

CI uses the same `pnpm publish` approach (via `scripts/publish-packages.sh`).

## Quality Gates

Every release must pass:

- Format Check (Prettier)
- Linting (ESLint)
- Type Checking (TypeScript)
- Testing (1460+ unit tests)
- Building (all packages)
- Quality Gates (bundle size, API surface)

## Error Recovery

### Failed Release Recovery

```bash
# If release fails mid-process (after lerna version, before publish)
git reset --hard HEAD~1          # Undo version commit
git tag -d @vytches/ddd-core@x.y.z  # Delete created tags
pnpm release                     # Retry
```

### Version Already Exists on Registry

```bash
# If publish fails with 409 Conflict, bump to new version
pnpm release:version patch --force-publish --yes
pnpm build
pnpm publish:packages
```

### Rollback Published Package

```bash
# Deprecate problematic version
npm deprecate @vytches/ddd-core@1.2.0 "Critical bug - use v1.2.1+" \
  --registry=https://npm.pkg.github.com

# Release immediate patch
pnpm release:hotfix
```

## Package Installation for Users

### One-time Setup

```bash
echo "@vytches:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
```

### Installing Packages

```bash
# Core packages
pnpm add @vytches/ddd-core

# Event-driven architecture
pnpm add @vytches/ddd-events @vytches/ddd-cqrs

# Full enterprise suite
pnpm add @vytches/ddd-core @vytches/ddd-events @vytches/ddd-cqrs @vytches/ddd-logging
```

---

**Implementation Status:** Fully Implemented **Last Updated:** 2026-02-04 **Next
Review:** When library reaches 1.0.0 stable

**References:**

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Lerna Independent Mode](https://lerna.js.org/docs/features/version-and-publish#independent-mode)
- [GitHub Packages Documentation](https://docs.github.com/en/packages)
