# Task: Rewrite README + verify QUICK_START before publication

## Task Metadata

```yaml
task_id: REL-006
title: Cut README to 200 lines, fix QUICK_START.md inaccuracies, remove fictional packages
type: documentation
priority: critical
complexity: medium
estimated_time: 6h
created_by: agent (documentation-master, developer-experience)
created_at: 2026-05-08 14:00
status: planned
release_target: v0.25.0-beta.1
depends_on: REL-001 (CLI deprecation), REL-005 (API cleanup)
```

## Why This Task Exists

README is 1362 lines and has three documentation defects that mislead first-time
visitors:

1. References three non-existent packages: `@vytches/ddd-event-store`,
   `@vytches/ddd-core`, `@vytches/ddd-cli` — including code examples importing
   from them
2. Reklamuje "Saga Orchestration" jako feature, mimo świadomej decyzji o braku
   sag w bibliotece (memory: `feedback_no_saga.md`)
3. QUICK_START.md line 160 calls `npx @vytches/ddd init-context` — the binary
   does not exist
4. QUICK_START.md line 65–68 demonstrates `validate()` as `boolean` return —
   matches current bug in `BaseValueObject` (REL-009 covers fix)

## Current State

- README.md: 1362 lines, mixing landing copy with enterprise patterns
- QUICK_START.md: 190 lines, three broken references
- `docs/JSDOC_EXAMPLES_ROADMAP.md` Last Updated 2025-08-09 (stale 9 months)
- No "Why @vytches/ddd?" section in first 100 lines
- No comparison vs alternatives (NestJS DDD, MikroORM-DDD)

## Desired State

- README ≤ 250 lines: badges + 1-paragraph value prop + 15-line example +
  install + links to docs
- `docs/landing/` (or split README sections) holds the long-form content
- QUICK_START.md: AI Assistant Integration section rewritten for LLM-first
  approach (per REL-001)
- All 3 fictional packages purged from prose and code samples
- Saga section removed; replaced with "Design decisions: no sagas, no adapters,
  dependency-free" (1-paragraph rationale + ADR links)

## Acceptance Criteria

### README
- [ ] Length ≤ 250 lines
- [ ] First 30 lines: name, badges, 2-sentence value prop, single install command
- [ ] Single 15-line code example demonstrating Aggregate + Event + Command
- [ ] "Why @vytches/ddd?" section in first 100 lines (positioning vs alternatives)
- [ ] "Design Decisions" section with bullet points: no sagas, no adapters,
      dependency-free, framework-agnostic — link to ADRs
- [ ] All references to `@vytches/ddd-event-store`, `@vytches/ddd-core`,
      `@vytches/ddd-cli` removed
- [ ] No mention of Saga as feature
- [ ] LLM-first onboarding section (replaces CLI section)

### QUICK_START.md
- [ ] Lines 154–168 (AI Assistant Integration) rewritten — references
      `pnpm llm:bundle` workflow, not `npx ... init-context`
- [ ] Linked example `examples/quickstart/` verified to compile and pass tests
- [ ] Required tsconfig flags listed (strict: true, emitDecoratorMetadata for nestjs)
- [ ] Note re. `validate()` updated to reflect `Result<void>` migration after REL-009

### Discovery
- [ ] CHANGELOG generated from full git history via `conventional-changelog-cli`
      (already in devDeps)
- [ ] `docs/JSDOC_EXAMPLES_ROADMAP.md` either updated or moved to internal docs
