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

### Documentation ✅

- [ ] CHANGELOG.md updated
- [ ] README.md current
- [ ] API documentation generated
- [ ] Migration guide (if breaking changes)
- [ ] Examples updated

### Manual Verification 🔍

- [ ] Breaking changes documented
- [ ] Deprecation warnings added
- [ ] Version bump appropriate
- [ ] Git history clean
- [ ] Branch up to date with main

### Release Decision 🚀

- [ ] Ready for npm publish
- [ ] GitHub release draft prepared
- [ ] Announcement ready
```

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
