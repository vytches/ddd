# Task: Build LLM-first generation pipeline (replaces CLI)

## Task Metadata

```yaml
task_id: REL-010
title: Single-command pipeline producing AI-ready library context bundle
type: feature
priority: high
complexity: simple
estimated_time: 4h
created_by: human (LLM-first decision 2026-05-08)
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (critical-reviewer: 60% infra exists from VF-014 + DX-002)
status: planned
release_target: v0.25.0-beta.1
depends_on: REL-001 (CLI deprecation)
builds_on:
  - VF-014-llm-optimized-documentation (docs/llm-context.md + verify script)
  - DX-002-repomix-ai-quick-start (repomix.config.json)
```

## ✅ Already Done (do NOT repeat)

- `repomix.config.json` correctly configured (DX-002)
- `docs/llm-context.md` 639 lines, auto-verified (VF-014)
- `scripts/verify-llm-context.mjs --strict` exists
- 14 `jsdoc:*` scripts in root `package.json`
- `LLMGUIDE.md` in 11 of 21 packages

## Remaining Scope (only this)

- Add 4 new scripts to root `package.json`:
  - `llm:bundle` — runs `npx repomix` with current config, output to
    `dist/llm-bundle.md`
  - `llm:context` — wrapper for existing `jsdoc:generate` flow that
    regenerates `docs/llm-context.md`
  - `llm:verify` — alias for `node scripts/verify-llm-context.mjs --strict`
  - `llm:guides` — runs `jsdoc-generator.js` to fill missing `LLMGUIDE.md`
- Add `llm:verify` to `prerelease` script (already covers `lint`, `test`, etc.)
- Add `LLMGUIDE.md` to `files` field of every package
- Document the workflow in README "AI-Assisted Setup" section (coupled with
  REL-006)

## Why This Task Exists

Strategic shift: `@vytches/ddd` does not ship a CLI. Instead, the library is
"AI-native" — developers paste a generated context bundle into Claude Code,
Cursor, or GitHub Copilot, and the AI scaffolds aggregates / value objects /
handlers correctly.

Existing infrastructure (already in repo):

- `repomix.config.json` — includes `packages/*/src`, READMEs, package.json
- `scripts/jsdoc-generator.js` family — produces JSDoc + LLMGUIDE.md
- `scripts/verify-llm-context.mjs` — keeps `docs/llm-context.md` in sync
- `LLMGUIDE.md` in 9 of 21 packages

Gaps:

- No single `pnpm llm:bundle` command
- Inconsistent LLMGUIDE coverage (12 packages missing)
- No published artifact for consumers (e.g. `@vytches/ddd/llm-context.md` in dist)
- No documented workflow: "How to seed your AI assistant with @vytches/ddd context"

## Desired State

```bash
# As library author:
pnpm llm:bundle           # generates dist/llm-bundle.md (full context)
pnpm llm:context           # regenerates docs/llm-context.md from sources
pnpm llm:verify            # CI gate: docs in sync with code
pnpm llm:guides            # ensures LLMGUIDE.md exists for all 21 packages

# As library consumer:
npm install @vytches/ddd
# Then in CLAUDE.md / .cursorrules / Copilot instructions:
@./node_modules/@vytches/ddd/llm-context.md
```

## Acceptance Criteria

### Scripts in root `package.json`
- [ ] `llm:bundle` — runs repomix with current config, outputs `dist/llm-bundle.md`
- [ ] `llm:context` — regenerates `docs/llm-context.md` (currently manual)
- [ ] `llm:verify` — calls `scripts/verify-llm-context.mjs --strict`
- [ ] `llm:guides` — generates missing LLMGUIDE.md files using `jsdoc-generator.js`

### Distribution
- [ ] Each published package includes `llm-context.md` in `dist/` (in `files`)
- [ ] `@vytches/ddd` (enterprise meta-package) ships an aggregated
      `llm-context.md` covering all sub-packages

### Documentation
- [ ] New section in README: "AI-Assisted Development with @vytches/ddd"
- [ ] One short example for: Claude Code, Cursor, GitHub Copilot Workspaces, Aider
- [ ] Step: copy context, paste reference into AI config, ask AI to generate
      first aggregate

### Quality gate
- [ ] `prerelease` script includes `llm:verify` (fails build on docs drift)
- [ ] CI workflow runs `llm:guides --check` on PR (no missing guides allowed)

## Notes

This is the headline marketing differentiator: "Other DDD libraries ask you
to read 1000 pages of docs. @vytches/ddd asks you to paste one file into your
AI assistant." Reflect this in marketing copy + README hero.
