# Task: CLI Deprecation → LLM-First Generation Approach

## Task Metadata

```yaml
task_id: REL-001
title: Deprecate @vytches/ddd-cli, pivot to LLM-first scaffolding
type: refactor
priority: critical
complexity: simple
estimated_time: 4h
created_by: human
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (critical-reviewer: VF-013 already removed CLI package; scope reduced)
status: planned
release_target: v0.25.0-beta.1 (end of May 2026)
supersedes:
  - VI-001-cli-enhancement (work-items, CANCELLED)
builds_on:
  - VF-013-library-simplification (CLI package deletion already done)
  - VF-014-llm-optimized-documentation (LLM docs infra exists)
  - DX-002-repomix-ai-quick-start (repomix.config.json done)
```

## ✅ Already Done (do NOT repeat)

- `packages/cli/` package source/dist already removed by VF-013 (only
  `node_modules/` and `.tsbuildinfo` skeleton remain — these are the cleanup
  scope, not the package itself)
- `repomix.config.json` exists and is correctly configured (DX-002)
- `docs/llm-context.md` (639 lines) exists and is auto-verified by
  `scripts/verify-llm-context.mjs` (VF-014)
- 11 of 21 packages already ship `LLMGUIDE.md` (acl, aggregates, contracts,
  cqrs, events, nestjs, policies, repositories, testing, validation,
  value-objects)

## Remaining Scope (only this)

- Delete the empty `packages/cli/` directory (skeleton causing
  `MultipleProjectsWithSameNameError` in Nx — see REL-002)
- Remove dead scripts from root `package.json`: `cli`, `cli:generate`,
  `cli:domain`, `docs:generate`, `docs:bundle`, `docs:find`, `docs:validate`,
  `playground`, `playground:fresh`, `playground:new` (all CLI-dependent)
- Generate `LLMGUIDE.md` for the 10 missing packages: `di`,
  `domain-primitives`, `domain-services`, `enterprise`, `logging`,
  `messaging`, `projections`, `resilience`, `utils` (use
  `scripts/jsdoc-generator.js`)
- Remove all references to `npx @vytches/ddd init-context` from README +
  QUICK_START.md (coupled with REL-006)

## Domain Context

```yaml
bounded_context: DeveloperExperience
patterns:
  - LLM-first documentation
  - JSDoc generators
  - Repomix bundling
  - Per-package LLMGUIDE.md
```

## Why This Task Exists

User decision (2026-05-08): library does **not** ship a CLI. Developer onboarding
relies on AI-assisted code generation (Claude Code, Cursor, Copilot) reading
LLM-optimized context files instead of running scaffold commands.

We already have the infrastructure:

- `repomix.config.json` includes `packages/*/src`, `packages/*/README.md`,
  `packages/*/package.json`, `README.md`, `QUICK_START.md`
- `scripts/jsdoc-generator.js` + `inject-yaml-jsdoc-ast.js` family
- `scripts/verify-llm-context.mjs` keeps `docs/llm-context.md` in sync with
  `enterprise/src/index.ts`
- 9 packages already ship `LLMGUIDE.md`

What is missing: explicit removal of CLI surface, single `pnpm llm:bundle`
entry point, and consistency across all 21 packages.

## Current State

- `packages/cli/` exists but `dist/` is missing (never builds in release path)
- `package.json` exposes `cli`, `cli:generate`, `cli:domain`, `docs:generate`
  scripts that depend on CLI
- README + QUICK_START reference `npx @vytches/ddd init-context` (not built)
- `LLMGUIDE.md` exists in only 9 of 21 packages

## Desired State

- `packages/cli/` removed (or marked `private: true` with `files: []`)
- Root `package.json` scripts cleaned: `cli*`, `docs*` removed; new
  `llm:bundle`, `llm:context`, `llm:verify` added
- `LLMGUIDE.md` present in all 21 packages (auto-generated from JSDoc)
- README + QUICK_START purged of any `npx @vytches/ddd ...` mention
- New section in README: "AI-Assisted Setup" — pasting context into
  CLAUDE.md / .cursorrules / GitHub Copilot Workspaces

## Acceptance Criteria

### Functional

- [ ] `packages/cli/` deleted from monorepo OR marked private with empty `files`
- [ ] All `cli:*` and `docs:*` scripts removed from root `package.json`
- [ ] New `llm:bundle` script generates `dist/llm-bundle.md` via repomix
- [ ] New `llm:context` script regenerates `docs/llm-context.md` from sources
- [ ] All 21 packages contain `LLMGUIDE.md` (use `jsdoc-generator.js`)
- [ ] `README.md` references neither `cli:*` nor `npx ... init-context`
- [ ] `QUICK_START.md` line 154-168 (AI Assistant Integration) rewritten
- [ ] `CHANGELOG.md` documents removal under BREAKING CHANGES

### Documentation

- [ ] New section "Using @vytches/ddd with AI assistants" in README
- [ ] One-liner each for: Claude Code, Cursor, GitHub Copilot, Aider
- [ ] Example: how to seed `.claude/CLAUDE.md` with library context

## Definition of Done

- [ ] No reference to `@vytches/ddd-cli` in any published package
- [ ] `pnpm install -g @vytches/ddd-cli` would 404 after publish
- [ ] All 21 LLMGUIDE.md files reviewed for accuracy
- [ ] Verified by running `pnpm llm:bundle` end-to-end on clean checkout

## Notes

CLI sunset is a hard decision — communicate clearly in beta release notes.
The library is now positioned as: "DDD building blocks + LLM context = AI
generates your code". This differentiates @vytches/ddd from competing libs.
