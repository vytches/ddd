# DX-002: Repomix AI Quick Start Generator

**Priority**: 88 (HIGH) **Agent**: developer-experience **Timeline**: 2-3 days
**Status**: Active **Created**: 2025-08-15

## Problem Statement

Developers need <15 minutes to first success, but current getting started
documentation is overwhelming (29K+ lines). We have repomix.config.json
configured but not leveraged for AI-assisted quick start generation.

## Context

Existing repomix infrastructure:

```json
// repomix.config.json already configured
{
  "include": [
    "packages/*/src/**/*.ts",
    "packages/*/README.md",
    "packages/*/package.json",
    "README.md",
    "QUICK_START.md"
  ]
}
```

Benefits:

- Always synchronized with actual codebase
- Filters out tests, build artifacts, config noise
- Perfect input for AI interface discovery
- Zero maintenance required once set up

## Success Metrics

- [ ] AI-generated quick start in <5 minutes reading time
- [ ] Always synchronized with actual codebase
- [ ] Zero manual maintenance required
- [ ] Covers core DDD patterns using existing APIs

## Action Items

1. [ ] Create repomix-powered quick start pipeline

   - Use existing `npx repomix` to generate current library overview
   - Create AI prompt templates for quick start generation
   - Test AI output quality with actual library state

2. [ ] AI prompt engineering for library discovery

   - Develop prompts that extract core patterns from repomix output
   - Focus on existing APIs: AggregateRoot, AggregateBuilder, EntityId
   - Generate realistic examples using actual method signatures

3. [ ] Generate context-aware getting started guides

   - Create framework-agnostic quick start (5 minutes)
   - Generate NestJS-specific quick start using existing patterns
   - Ensure examples use only existing, verified APIs

4. [ ] Integrate with existing CLI for seamless experience
   - Add `pnpm cli quick-start --generate` command
   - Use repomix output as context for CLI suggestions
   - Create interactive quick start using existing CLI commands

## Technical Requirements

**Leverage existing infrastructure only**:

- Use configured repomix.config.json
- Generate from actual TypeScript interfaces and implementations
- No new APIs - only document existing AggregateRoot, AggregateBuilder, etc.
- Integrate with existing CLI structure

## Example Output

Target quick start structure:

```typescript
// Generated from actual library APIs via repomix
import { AggregateRoot, EntityId } from '@vytches/ddd-core';

// 1. Create Entity ID (2 minutes)
const orderId = EntityId.createWithRandomUUID();

// 2. Create Aggregate (2 minutes)
const order = new AggregateRoot({ id: orderId, version: 0 });

// 3. Add Domain Event (1 minute)
order.addDomainEvent(new OrderCreatedEvent({ orderId: orderId.getValue() }));
```

## Definition of Done

- [ ] `npx repomix` generates comprehensive library overview
- [ ] AI pipeline transforms repomix output into 5-minute quick start
- [ ] Generated examples use only existing APIs (verified via compilation)
- [ ] Quick start includes: aggregate creation, events, basic patterns
- [ ] Integration with existing CLI: `pnpm cli quick-start --generate`
- [ ] Documentation is always current with actual codebase

## Dependencies

- repomix.config.json (already configured)
- Existing CLI infrastructure
- AI/LLM access for content generation
- Current TypeScript interfaces and implementations

## Notes

This leverages our existing powerful repomix configuration to solve the
"overwhelming documentation" problem. By using actual codebase as input, we
ensure the quick start is always accurate and current.
