# VytchesDDD Release Process

## Overview

The release process is **semi-automated**. Agents prepare and validate
everything locally, but the actual publish to npm and GitHub is performed
manually by the maintainer.

## Release Workflow

### Phase 1: Preparation (Automated)

The orchestrator and agents handle:

1. **Version Management**

   - Update package versions
   - Generate changelog from commits
   - Update documentation

2. **Quality Validation**

   - Run full test suite
   - Security vulnerability scan
   - Bundle size verification
   - Performance regression check

3. **Prerelease Verification**
   ```bash
   pnpm prerelease          # Local validation
   pnpm build               # Build all packages
   npm publish --dry-run    # Simulate publish
   ```

### Phase 2: Manual Release (Human)

After agents confirm everything is ready:

1. **Review Release Checklist**

   ```markdown
   - [ ] All tests passing
   - [ ] No security vulnerabilities
   - [ ] Bundle sizes acceptable
   - [ ] Changelog updated
   - [ ] Version bumped correctly
   - [ ] Documentation current
   ```

2. **Execute Release Commands**

   ```bash
   # Final local verification
   pnpm prerelease

   # If everything looks good, proceed:
   git checkout main
   git pull origin main

   # Create release commit
   git add .
   git commit -m "chore: release v$(node -p "require('./package.json').version")"

   # Tag the release
   git tag -a v$(node -p "require('./package.json').version") -m "Release v$(node -p "require('./package.json').version")"

   # Push to GitHub
   git push origin main --tags

   # Publish to npm (manual decision per package)
   pnpm publish --filter="@vytches/ddd-core"
   # ... repeat for other packages as needed
   ```

## Agent Responsibilities

### Tech Lead

- Version strategy decision
- Breaking change assessment
- Release notes review

### Testing Excellence

- Full test suite execution
- Coverage verification
- Regression testing

### Security Audit

- Vulnerability scanning
- Dependency audit
- Security clearance

### Performance Optimizer

- Bundle size check
- Performance benchmarks
- Tree-shaking validation

### Documentation Master

- Changelog generation
- README updates
- API documentation

### Project Orchestrator

- Coordinate all checks
- Generate release checklist
- Prepare draft release notes

## Release Types

### Patch Release (x.x.1)

- Bug fixes only
- No API changes
- Backward compatible

### Minor Release (x.1.0)

- New features
- Backward compatible
- Deprecations allowed

### Major Release (1.0.0)

- Breaking changes
- Major refactoring
- API redesign

## Prerelease Validation

The `pnpm prerelease` command performs:

1. **Build Verification**

   - All packages build successfully
   - TypeScript compilation passes
   - Bundle generation works

2. **Test Verification**

   - Unit tests pass
   - Integration tests pass
   - Coverage meets thresholds

3. **Package Validation**

   - package.json valid
   - Dependencies resolved
   - Peer dependencies satisfied

4. **Publish Simulation**
   - Dry run successful
   - File list correct
   - Size within limits

## Release Checklist Template

```markdown
## Release Checklist for v[VERSION]

### Automated Checks ✅

- [ ] `pnpm prerelease` passes
- [ ] All tests passing (1460+ tests)
- [ ] Coverage >80% for all packages
- [ ] No security vulnerabilities
- [ ] Bundle sizes within limits
- [ ] No circular dependencies
- [ ] TypeScript strict mode compliant
- [ ] `pnpm validate:api` passes — the public API of contracts, events,
      value-objects and enterprise matches the committed `api-report/` baselines

### Documentation ✅

- [ ] CHANGELOG.md updated
- [ ] README.md current
- [ ] API documentation generated
- [ ] Migration guide (if breaking changes)
- [ ] Examples updated

### Manual Verification 🔍

- [ ] Breaking changes documented
- [ ] **Behavioral BC checklist run** — for every change in this release that
      touches an existing public symbol whose TypeScript signature is unchanged
      (or only additively widened), `docs/process/behavioral-bc-checklist.md`
      has been answered and the conclusion is recorded in the PR and the
      CHANGELOG
- [ ] Deprecation warnings added
- [ ] Version bump appropriate
- [ ] Git history clean
- [ ] Branch up to date with main

### Release Decision 🚀

- [ ] Ready for npm publish
- [ ] GitHub release draft prepared
- [ ] Announcement ready
```

### API surface baselines — the two commands (VF-037)

There are exactly two, and the difference between them is the whole point:

| command                   | mode         | what it does                                                                                                                                                                    |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm validate:api`       | comparison   | Builds, runs `fix:dts`, then **compares** the generated report against the committed `api-report/*.api.md`. Exits non-zero on any difference. This is what CI runs on every PR. |
| `pnpm validate:api:local` | regeneration | Same build, but **overwrites** the baselines with the newly generated reports. Run this only when the API change is intended.                                                   |

Both build and run `fix:dts` first. That matters: api-extractor analysing an
unprocessed `dist/` walks into implementation code and dies with an internal
error at `packages/aggregates/src/core/aggregate-root.builder.ts:167`, which
reads like a compiler bug and is not one — it just means the build step was
skipped.

When the PR gate fires, the fix is:

1. Read the reported drift. Decide whether the API change was intended.
2. If intended: `pnpm validate:api:local`, then commit the regenerated baselines
   **as their own commit**, separate from the code change, so the surface diff
   is reviewable on its own.
3. If not intended: fix the code, not the baseline.

Never edit an `api-report/*.api.md` by hand — it is generated output, and
`packages/*/api-report/` is in `.prettierignore` for the same reason (a
`prettier --write` from lint-staged reformats it into permanent mismatch).

The gate deliberately fails on **one** thing: the public API shape drifted from
its baseline. Doc-comment problems (tsdoc syntax, unresolved `{@link}` targets)
are silenced in `api-extractor.base.json` so they cannot fail it — they belong
in the linter, where they block nobody. A gate that fires for things the reader
cannot act on is a gate that gets `|| true`-ed back to death; that is exactly
how the previous generation of this one died.

### Behavioral BC checklist — how the releaser runs it

The "Behavioral BC checklist run" item above is a step performed by hand, not an
automated check, and it cannot be delegated to the gates. Type-check,
api-extractor `.api.md` diffs and `api-surface.test.ts` compare **shapes**; a
clean surface diff says the signatures did not move, and says nothing about
whether existing call sites now behave differently at runtime.

For each change in the release range that modifies an existing public
class/function while leaving its exported signature identical (or only
additively widened), walk
[`docs/process/behavioral-bc-checklist.md`](../docs/process/behavioral-bc-checklist.md)
and record the answer:

- If the answer is "behavioral break", the release is a **major** bump with a
  `BREAKING CHANGE:` entry and migration notes — regardless of what the
  TypeScript diff suggests.
- If the answer is "additive, opted-in, pinned by a regression test on the
  no-opt-in path", it ships as a minor/patch, and that conclusion is written
  down rather than left implied. See the VF-036 worked example at the bottom of
  the checklist for what a clean "additive" answer looks like.

Four prior occurrences are catalogued in the checklist; three were behavioral
breaks and one was not. The checklist's job is to force the question, not to
force the classification.

## Rollback Plan

If issues are discovered post-release:

1. **Immediate Actions**

   ```bash
   # Unpublish if within 72 hours (npm policy)
   npm unpublish @vytches/ddd-[package]@[version]

   # Or deprecate if too late
   npm deprecate @vytches/ddd-[package]@[version] "Critical issue found"
   ```

2. **Fix and Re-release**
   - Create hotfix branch
   - Fix issue
   - Bump patch version
   - Fast-track release

## Common Issues

### Issue: Prerelease Fails

**Solution**: Check individual package builds, fix errors, retry

### Issue: Dry Run Fails

**Solution**: Verify npm authentication, check package.json

### Issue: Version Conflicts

**Solution**: Use lerna version management, ensure consistency

### Issue: Bundle Size Regression

**Solution**: Run performance optimization workflow before release

## Release Schedule

- **Patch releases**: As needed for critical fixes
- **Minor releases**: Bi-weekly or when features ready
- **Major releases**: Quarterly or for significant changes

## Notes

- Always run `pnpm prerelease` before manual publish
- Never force push to main branch
- Always create GitHub release with notes
- Monitor npm downloads post-release
- Check GitHub issues for immediate feedback
