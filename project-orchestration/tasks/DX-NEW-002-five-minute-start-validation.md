# Task: 5-minute start validation — measure & guarantee onboarding time

## Task Metadata

```yaml
task_id: DX-NEW-002
title: Validate "from npm install to passing test in <5 min" on a fresh environment
type: research
priority: high
complexity: medium
estimated_time: 3h
created_by: human (production-quality decision 2026-05-08)
created_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
depends_on:
  - REL-006 (README + QUICK_START fixed)
  - REL-007 (peer deps cleaned — no AI SDK warnings)
  - REL-010 (LLM bundle pipeline ready)
goal: production-grade DX claim, not marketing copy
```

## Why This Task Exists

The README and QUICK_START.md promise "Build your first DDD aggregate in under
5 minutes". After REL-006 the docs will be polished, but **no one will have
actually validated the claim on a fresh environment**. For a production
library, this is unacceptable: the headline DX promise must be tested like any
other production guarantee.

Common silent friction sources we won't notice in our development environment:

- `npm install @vytches/ddd` triggers peer dep warnings → confusion
- TypeScript `tsconfig.json` defaults reject the example code
- NestJS users need `emitDecoratorMetadata: true` — undocumented
- Examples reference symbols that exist in source but not in published `dist`
- Network: large bundle slow to download on broadband
- `node` version requirement (`>=22.19.0`) rejects users on 20.x

## Acceptance Criteria

### Validation procedure (must run twice — pass/fail by stopwatch)

- [ ] Spin up fresh Docker container (`node:22-alpine`)
- [ ] No global tooling, no cached npm modules
- [ ] Start timer
- [ ] Execute QUICK_START.md verbatim, copy-pasting commands
- [ ] Stop timer when first test passes (e.g. `Order.create()` test)
- [ ] **Target: ≤5 minutes on broadband (≤100 Mbps)**
- [ ] Repeat with NestJS variant (consumer using `@vytches/ddd-nestjs`)

### Friction inventory

- [ ] Document every paper cut found (warning, error, missing config, surprising
      step) into a friction-log markdown file
- [ ] For each friction point: 1-line cause + 1-line fix + ticket reference
- [ ] If any friction puts run >5 min: file blocker bug for REL-006/REL-007

### Automation

- [ ] Save the validation as `scripts/validate-quickstart.sh` so anyone can run
      it with one command
- [ ] CI workflow: scheduled weekly run on main + on every release PR
- [ ] If validation fails (>5 min or test fails), CI blocks release

### Documentation

- [ ] Add 1-line claim to README: "Validated on fresh node:22-alpine: median
      time-to-first-test = X minutes" with badge if possible
- [ ] Document required tsconfig flags in QUICK_START.md
      (`strict: true`, `emitDecoratorMetadata: true` for NestJS, etc.)
- [ ] Document required Node.js version + how to check it

## Specific friction points to verify upfront (don't rediscover)

From DX agent + critical-reviewer reports (2026-05-08):

1. `@vytches/ddd-testing` peer deps `@anthropic-ai/sdk`, `openai` produce
   warnings (REL-007 should fix — verify)
2. `examples/quickstart/` requires `pnpm` and clone — need npm-only path
3. `BaseValueObject` example shows `validate(): boolean` — verify it still
   works exactly as written after REL-009 verification
4. `npx @vytches/ddd init-context` reference removed (REL-001 + REL-006)
5. Saga-related sections that confuse new users (REL-006)

## Effort breakdown

| Step | Hours |
|---|---|
| Docker container + harness setup | 0.5h |
| First validation run + friction logging | 0.5h |
| Fix top 3 friction points (or open tickets) | 1h |
| `validate-quickstart.sh` + CI integration | 0.5h |
| README badge + numbers | 0.5h |

## Why now (not post-release)

The first impression of `@vytches/ddd` is the difference between 100 stars
and 10K. If beta launches and Hacker News users find the quickstart doesn't
work, the brand is permanently damaged. Run this **before** the first
public publish, not after.
