# DX-001: Fix JSDoc CI/CD Pipeline

**Priority**: 95 (CRITICAL) **Agent**: library-expert **Timeline**: 1-2 days
**Status**: Active **Created**: 2025-08-15

## Problem Statement

16+ JSDoc commands work locally but fail in CI environment:

- `pnpm jsdoc:inject:all` works locally, fails in CI
- Enhanced Metadata System V2 ready but blocked by CI issues
- inject-yaml-jsdoc-ast.js and enhanced-jsdoc-placement.js exist but not
  CI-compatible

## Context

Available JSDoc infrastructure:

```bash
pnpm jsdoc:generate      # Generates JSDoc from YAML metadata
pnpm jsdoc:inject:all    # Injects docs into .d.ts files
pnpm jsdoc:verify        # Verifies correctness
pnpm jsdoc:publish       # Publishes HTML docs
pnpm jsdoc:serve         # Local docs server
```

Scripts ready:

- scripts/inject-yaml-jsdoc-ast.js
- scripts/enhanced-jsdoc-placement.js
- scripts/verify-jsdoc-injection.js

## Success Metrics

- [ ] 100% CI JSDoc generation success rate
- [ ] All .d.ts files properly documented in CI
- [ ] HTML docs published automatically in CI
- [ ] Enhanced Metadata System V2 fully operational

## Action Items

1. [ ] Debug CI environment JSDoc failures

   - Check CI environment differences vs local
   - Verify all dependencies available in CI
   - Test inject-yaml-jsdoc-ast.js in CI environment

2. [ ] Fix inject-yaml-jsdoc-ast.js CI compatibility

   - Ensure proper file path resolution in CI
   - Handle CI-specific environment variables
   - Test AST injection pipeline end-to-end

3. [ ] Ensure enhanced-jsdoc-placement.js works in CI

   - Verify TypeScript compilation compatibility
   - Check file system permissions in CI
   - Test placement algorithm with CI file structure

4. [ ] Test full pipeline: YAML → AST → .d.ts → HTML
   - Integration test of complete documentation pipeline
   - Verify HTML output quality and completeness
   - Ensure generated docs are deployable

## Technical Requirements

**Zero new functionality** - only fix existing infrastructure:

- Use existing YAML metadata files in docs/examples/domain/
- Leverage current Enhanced Metadata System V2
- Fix only CI environment compatibility issues

## Definition of Done

- [ ] `pnpm jsdoc:inject:all` succeeds in CI
- [ ] `pnpm jsdoc:verify` passes in CI
- [ ] `pnpm jsdoc:publish` generates complete HTML docs
- [ ] All 22 packages have properly injected JSDoc
- [ ] CI pipeline includes JSDoc generation step
- [ ] Documentation is automatically published

## Dependencies

- Enhanced Metadata System V2 YAML files
- inject-yaml-jsdoc-ast.js script
- CI environment configuration
- TypeScript compilation pipeline

## Notes

This is CRITICAL PATH for all other DX improvements. Without working JSDoc
pipeline, we cannot leverage Enhanced Metadata System V2 for automated
documentation generation.
