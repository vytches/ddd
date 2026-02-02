# ADR-0010: Release Process and Branching Strategy

**Date:** 2025-07-12  
**Status:** Accepted  
**Context:** Final release process for VytchesDDD library with GitHub Packages
and Independent Versioning

## Context

VytchesDDD is an enterprise-grade TypeScript library with 23 packages requiring
consistent, reliable release process. After evaluation, we've chosen
**Independent Versioning with Semantic Versioning** as the optimal strategy for
our DDD library architecture.

## Decision

We adopt **Independent Versioning** where each package maintains its own
semantic version, combined with Git Flow inspired branching strategy and
automated GitHub integration.

## Release Strategy

### **📦 Independent Package Versioning**

Each package evolves independently following semantic versioning:

```bash
@vytches/ddd-core@1.0.0         # Stable meta-package
@vytches/ddd-events@1.2.3       # Active development
@vytches/ddd-logging@0.9.0      # Pre-1.0 evolution
@vytches/ddd-cqrs@2.0.1         # Major version with patch
```

**Why Independent Versioning for DDD:**

- ✅ **Modularity**: DDD patterns are naturally modular
- ✅ **Selective Usage**: Users install only needed packages
- ✅ **Non-blocking Evolution**: Breaking changes in one package don't affect
  others
- ✅ **Clear Dependencies**: Explicit version management per domain

## Branch Strategy

### **Production Branches:**

- `main` - Stable production releases only
- `release/YYYY-MM-DD` - Date-based release preparation branches
- `hotfix/description` - Critical production fixes

### **Development Branches:**

- `develop` - Integration branch for features (optional)
- `feature/description` - Individual feature development

### **Branch Permissions in Lerna:**

```json
{
  "allowBranch": ["main", "release/*", "develop"]
}
```

**Important:** Feature branches (`feature/*`) are intentionally excluded to
enforce proper release workflow where versioning only happens in release
branches.

### **Release Branch Naming Convention:**

**Date-based (RECOMMENDED):**

```bash
release/2025-07-12     # Standard release
release/2025-07-15     # Another release same month
release/2025-07-12-alpha  # Pre-release version
```

**Benefits of date-based naming:**

- ✅ **Unique names** - no conflicts between releases
- ✅ **No cleanup needed** - each release has permanent branch for history
- ✅ **Clear timeline** - easy to see when releases happened
- ✅ **Independent versioning** - branch name doesn't need to match package
  versions

**Alternative naming patterns:**

```bash
release/sprint-42           # Sprint-based
release/milestone-2.1       # Milestone-based
release/security-updates    # Feature collection-based
```

## Release Commands Reference

### **🔍 Investigation & Preview Commands**

```bash
# See what changed since last release
pnpm release:changed

# See detailed diff of changes
pnpm release:diff

# Preview versions without committing
pnpm release:dry

# Complete preview with recommendations
pnpm release:preview
```

### **🚀 Release Commands**

```bash
# Automatic version detection (analyzes conventional commits)
pnpm release:version

# Specific version types (BYPASSES conventional-commits analysis)
pnpm release:major      # Breaking changes (1.0.0 → 2.0.0)
pnpm release:minor      # New features (1.0.0 → 1.1.0) ← USE THIS if auto-detection fails
pnpm release:patch      # Bug fixes (1.0.0 → 1.0.1)

# Pre-release versions
pnpm release:prerelease # Alpha versions (1.0.0 → 1.1.0-alpha.0)
pnpm release:graduate   # Graduate from pre-release to stable
```

**When to use `pnpm release:minor` instead of `pnpm release:version`:**

- When conventional-commits incorrectly detects BREAKING CHANGE from old commits
- When you want to force a specific version bump type across all packages
- When git history contains problematic `BREAKING CHANGE:` markers that can't be
  removed

### **⚡ Quick Release Commands**

```bash
# Full production release
pnpm release           # Full validation + version + publish

# Hotfix release (faster)
pnpm release:hotfix    # Skip full audit, patch version

# Development release
pnpm release:quick     # Basic validation + version only
```

## Complete Release Workflows

### **🎯 Standard Release Process**

```bash
# 1. Complete feature development (NO VERSIONING in features!)
git checkout -b feature/add-retry-mechanism
git commit -m "feat(events): add retry mechanism for failed events"
git commit -m "test(events): add comprehensive retry tests"
git push origin feature/add-retry-mechanism
# Create PR: feature → main (or develop)

# 2. When ready for release, create date-based release branch
git checkout -b release/$(date +%Y-%m-%d)

# 3. Merge all completed features (if using develop branch)
git merge develop  # Contains all merged features

# 4. Preview what will be released (ALL commits since last release)
pnpm release:preview
pnpm release:collect  # See all feat/fix commits

# 5. Run automatic versioning (analyzes ALL merged commits)
pnpm release:version
# ↳ Lerna analyzes ALL conventional commits since last release
# ↳ Suggests versions for each changed package based on ALL changes
# ↳ Creates version commits and git tags for affected packages

# 6. Review generated changes
git log --oneline -5
git show HEAD  # Review version commit

# 7. Push release branch with tags (CRITICAL: --tags sends git tags to GitHub)
git push origin release/$(date +%Y-%m-%d) --tags

# 8. Create Pull Request to main
gh pr create --title "Release $(date +%Y.%m.%d)" --body "Automated release"

# 9. After PR merge: GitHub Actions automatically:
#    - Publishes packages to GitHub Packages
#    - Creates GitHub Release with notes
#    - Attaches build artifacts
```

### **🚨 Hotfix Process**

```bash
# 1. Branch from main (not develop!)
git checkout main
git pull origin main
git checkout -b hotfix/security-patch

# 2. Make critical fixes
# Edit code, add tests, commit with conventional commits

# 3. Quick release
pnpm release:hotfix
# ↳ Skips full audit, creates patch version

# 4. Push and create urgent PR
git push origin hotfix/security-patch --tags
gh pr create --title "HOTFIX: Critical security patch" --urgency=high
```

### **🧪 Pre-release Process**

```bash
# 1. Create pre-release versions with date-based branch
git checkout -b release/$(date +%Y-%m-%d)-alpha
pnpm release:prerelease
# ↳ Creates versions like 1.1.0-alpha.0

# 2. Test alpha versions
pnpm publish # to alpha tag

# 3. Graduate to stable when ready
git checkout -b release/$(date +%Y-%m-%d)
pnpm release:graduate
# ↳ 1.1.0-alpha.0 → 1.1.0
```

## Conventional Commits for Automatic Versioning

### **Commit Message Format**

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### **Version Bump Rules**

```bash
# PATCH version (1.0.0 → 1.0.1)
fix(core): resolve circular dependency
docs: update README examples
style: fix linting issues
test: add comprehensive test coverage

# MINOR version (1.0.0 → 1.1.0)
feat(events): add retry mechanism
feat(logging): implement structured logging
perf(core): optimize EntityId validation (non-breaking)

# MAJOR version (1.0.0 → 2.0.0) - Breaking changes
feat!(core): redesign EntityId API                    # Exclamation mark
fix!(events): change event handler signature          # Exclamation mark
refactor!(logging): restructure Logger interface      # Exclamation mark

# OR using BREAKING CHANGE footer:
feat(core): add enhanced EntityId validation

BREAKING CHANGE: EntityId.create() now requires explicit type parameter.
The old EntityId.create(value) is replaced with EntityId.create(value, type).

# OR combining both for maximum clarity:
feat!(core): redesign EntityId API

BREAKING CHANGE:
- EntityId.create() now requires type parameter
- Removed deprecated EntityId.fromString() method
- Changed return type of EntityId.validate() to Result<EntityId, ValidationError>
```

### **⚠️ CRITICAL: Never Use "BREAKING CHANGE: None"**

**DO NOT** write `BREAKING CHANGE: None` or similar in commit messages!

```bash
# ❌ WRONG - Parser sees "BREAKING CHANGE:" prefix and triggers MAJOR bump!
fix(nestjs): fix handler registration

BREAKING CHANGE: None - all changes maintain backward compatibility

# ✅ CORRECT - Simply omit the BREAKING CHANGE section if there are none
fix(nestjs): fix handler registration

Fixed handler registration by using class tokens instead of strings.
```

**Why this matters:**

- Conventional-commits parser detects `BREAKING CHANGE:` as a trigger for major
  version bump
- The parser does NOT understand "None" or "No breaking changes" after the colon
- This caused `@vytches/ddd-nestjs` to jump from 1.1.x to 11.0.0 due to repeated
  false BREAKING CHANGE markers
- Once in git history, these markers affect ALL future releases until manually
  fixed

### **Examples of Good Commit Messages**

```bash
feat(cqrs): add command validation middleware
fix(events): handle race condition in event publishing
docs(readme): add installation instructions for GitHub Packages
perf(logging): optimize structured log formatting
test(utils): add comprehensive safeRun test coverage
chore(deps): update development dependencies
```

## GitHub Integration

### **🏷️ Git Tags Created**

```bash
# Package-specific tags (created by Lerna)
@vytches/ddd-core@1.0.0
@vytches/ddd-events@1.2.3
@vytches/ddd-logging@0.9.0

# Simplified version tags
v1.0.0  # for @vytches/ddd-core@1.0.0
v1.2.3  # for @vytches/ddd-events@1.2.3
```

**CRITICAL: Always use `--tags` flag when pushing release branches:**

```bash
# ✅ CORRECT: Sends git tags to GitHub (required for GitHub Releases)
git push origin release/2025-07-12 --tags

# ❌ WRONG: Tags remain local only, GitHub Releases won't work
git push origin release/2025-07-12
```

**Why `--tags` is essential:**

- 🏷️ GitHub Releases require git tags on remote repository
- 📦 GitHub Packages publishing triggered by tag push
- 🔄 CI/CD workflows depend on tag availability
- 📋 Automatic changelog generation needs tag history

### **📦 GitHub Packages Publishing**

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

### **🎯 GitHub Releases**

Each package version creates a GitHub Release with:

- **Automated release notes** from conventional commits
- **Package version matrix** showing all current versions
- **Build artifacts** (.tar.gz, .zip) for offline usage
- **Installation instructions** for GitHub Packages

### **📋 Release Content Example**

````markdown
## 📦 VytchesDDD v1.2.0

### 📋 Package Versions in this Release:

- @vytches/ddd-core@1.2.0 (updated)
- @vytches/ddd-events@1.1.0 (unchanged)
- @vytches/ddd-logging@0.9.1 (updated)

### ✨ Features

- feat(core): add enhanced EntityId validation
- feat(logging): implement correlation tracking

### 🐛 Bug Fixes

- fix(events): resolve memory leak in event handlers

### 🚀 Installation

```bash
npm install @vytches/ddd-core@^1.2.0 --registry=https://npm.pkg.github.com
```
````

````

## Quality Gates

Every release must pass:
- ✅ **Format Check**: Prettier validation
- ✅ **Linting**: ESLint validation across all packages
- ✅ **Type Checking**: TypeScript compilation
- ✅ **Testing**: 1460+ unit tests
- ✅ **Building**: All packages build successfully
- ✅ **Quality Gates**: Bundle size, API surface, performance
- ✅ **Security Audit**: Dependency vulnerability scan

## Automation Workflows

### **Release Workflow (`.github/workflows/release.yml`)**
**Triggers:**
- Push to `main` branch
- Manual workflow dispatch
- Git tags (`v*`)

**Actions:**
1. Install dependencies and build packages
2. Run comprehensive test suite
3. Validate quality gates
4. Publish packages to GitHub Packages
5. Update package versions in repository

### **GitHub Release Workflow (`.github/workflows/github-release.yml`)**
**Triggers:**
- Git tags (`v*`)

**Actions:**
1. Build and test all packages
2. Create release artifacts
3. Generate package version matrix
4. Create GitHub Release with automated notes
5. Attach downloadable assets

## Error Recovery

### **Failed Release Recovery**
```bash
# If release fails mid-process
git reset --hard HEAD~1  # Undo version commit
git tag -d v1.2.0        # Delete created tag
pnpm release:dry         # Check what would happen
pnpm release:version     # Retry release
````

### **Rollback Published Package**

```bash
# Deprecate problematic version
npm deprecate @vytches/ddd-core@1.2.0 "Critical bug - use v1.2.1+" --registry=https://npm.pkg.github.com

# Release immediate patch
pnpm release:hotfix
```

### **Emergency Procedures**

```bash
# Skip full validation for critical security fixes
pnpm release:hotfix

# Force specific version (bypass conventional commits)
pnpm lerna version 1.2.1 --no-conventional-commits --no-push

# If specific packet bump needed:
pnpm lerna version patch --scope=@vytches/ddd-nestjs
```

### **🔧 Troubleshooting: Package Getting Unexpected Major Bump**

**Symptom:** A package (e.g., `@vytches/ddd-nestjs`) keeps getting major version
bumps (11.0.0 → 12.0.0) when only minor/patch changes were made.

**Cause:** Old commits in git history contain `BREAKING CHANGE: None` or similar
patterns. The conventional-commits parser sees `BREAKING CHANGE:` prefix and
triggers major bump, ignoring the "None" part.

**Diagnosis:**

```bash
# Check what conventional-changelog sees for the package
cd packages/nestjs && npx conventional-changelog --preset angular --release-count 1

# Look for BREAKING CHANGES section in the output
```

**Solution:**

```bash
# Option 1: Force minor bump for ALL packages (RECOMMENDED)
NX_DAEMON=false pnpm lerna version minor --no-push --no-git-tag-version

# Option 2: Force specific version for single package
pnpm lerna version --force-publish=@vytches/ddd-nestjs --no-push

# Option 3: Manually set version before release
# Edit packages/nestjs/package.json to desired version
# Then run: pnpm lerna version --no-push --conventional-commits --force-publish
```

**Prevention:**

- NEVER write `BREAKING CHANGE: None` in commit messages
- If no breaking changes, simply omit the BREAKING CHANGE section entirely
- Review commit messages in PRs for accidental BREAKING CHANGE markers

## Package Installation for Users

### **One-time Setup**

```bash
# Configure npm for GitHub Packages
echo "@vytches/ddd-core:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
```

### **Installing Packages**

```bash
# Core packages for basic DDD
npm install @vytches/ddd-core

# Event-driven architecture
npm install @vytches/ddd-events @vytches/ddd-cqrs

# Full enterprise suite
npm install @vytches/ddd-core @vytches/ddd-events @vytches/ddd-cqrs @vytches/ddd-logging @vytches/ddd-messaging
```

## Benefits of This Approach

### **📈 For Development Team**

- **🔄 Automated Process**: Minimal manual intervention
- **📋 Consistent Versioning**: Semantic versioning enforced automatically
- **🔍 Full Traceability**: Every release tracked with commits, tags, and PRs
- **🚀 Fast Hotfixes**: Emergency releases within minutes
- **📝 Auto Documentation**: Release notes generated from conventional commits

### **👥 For Library Users**

- **🎯 Selective Installation**: Install only needed packages
- **📚 Clear Versioning**: Semantic versions are meaningful
- **🔒 Stable Dependencies**: Non-breaking updates are safe
- **📋 Migration Guides**: Breaking changes clearly documented
- **🔍 Version Transparency**: Know exactly what you're getting

### **🏢 For Enterprise**

- **🛡️ Quality Assured**: Multiple validation layers prevent bad releases
- **📊 Audit Trail**: Complete history of all changes
- **🔐 Security**: Regular security audits and rapid patching
- **📈 Scalability**: Process scales with library growth
- **🤝 Integration**: Seamless GitHub ecosystem integration

## Comparison with Alternatives

### **✅ Why Independent over Fixed Versioning**

```bash
# Independent (chosen)
@vytches/ddd-core@1.0.0      # Stable
@vytches/ddd-events@2.3.1    # Evolving rapidly
@vytches/ddd-logging@0.9.0   # Pre-release

# Fixed versioning (not chosen)
@vytches/ddd-core@1.0.0      # Forced sync
@vytches/ddd-events@1.0.0    # Held back
@vytches/ddd-logging@1.0.0   # Premature stable
```

### **✅ Why Semantic over Date-based Versioning**

```bash
# Semantic (chosen)
@vytches/ddd-core@1.2.0      # Clear breaking change policy

# Date-based (not chosen)
@vytches/ddd-core@2025.07.12 # What changed? Breaking changes?
```

## Compliance & Standards

- **📏 Semantic Versioning**: Strict adherence to SemVer 2.0
- **📝 Conventional Commits**: Required for automatic versioning
- **🔍 Quality Gates**: All releases pass comprehensive testing
- **📚 Documentation**: Every release includes generated changelog
- **🔐 Security**: Automated security audits before publishing
- **🏷️ Git Flow**: Standardized branching strategy
- **📦 GitHub Integration**: Native GitHub Packages and Releases

---

**Implementation Status:** ✅ **Fully Implemented** **Last Updated:** 2026-02-02
**Next Review:** When library reaches 1.0.0 stable

**References:**

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Lerna Independent Mode](https://lerna.js.org/docs/features/version-and-publish#independent-mode)
- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Enterprise Monorepo Best Practices](https://nx.dev/concepts/more-concepts/monorepo-tag-and-release)
