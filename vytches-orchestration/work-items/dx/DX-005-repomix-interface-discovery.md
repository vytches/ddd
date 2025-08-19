# DX-005: Repomix Interface Discovery

**Priority**: 78 (MEDIUM-HIGH) **Agent**: developer-experience +
strategic-vision (PARALLEL) **Timeline**: 5-6 days **Status**: Active
**Created**: 2025-08-15

## Problem Statement

Developers struggle with API discovery across 22 packages. We have repomix
configured to capture entire project structure, but it's not being used for
AI-assisted interface discovery and simplified API exploration.

## Context

Repomix captures complete project structure:

```json
// repomix.config.json includes:
"include": [
  "packages/*/src/**/*.ts",    // All TypeScript interfaces and types
  "packages/*/README.md",      // Package documentation
  "packages/*/package.json"    // Package boundaries and exports
]
```

This provides:

- All TypeScript interfaces across 22 packages
- Real implementation patterns and method signatures
- Package dependencies and boundaries
- Export structures and public APIs

## Success Metrics

- [ ] AI-assisted API exploration using repomix output
- [ ] Simplified interface discovery for core patterns
- [ ] Better developer onboarding through guided API discovery
- [ ] Context-aware API recommendations

## Action Items

1. [ ] Create AI-powered API discovery from repomix output
       (developer-experience)

   - Use `npx repomix` to generate complete project overview
   - Create AI prompts for interface pattern extraction
   - Focus on core DDD patterns: aggregates, entities, repositories, events

2. [ ] Generate simplified interface overviews (developer-experience)

   - Extract key interfaces from repomix output: IAggregate, IRepository, etc.
   - Create beginner-friendly interface summaries
   - Show relationships between interfaces across packages

3. [ ] Build contextual API recommendations (strategic-vision)

   - Analyze repomix output for common usage patterns
   - Create "if you're doing X, use Y" recommendations
   - Generate framework-specific guidance (NestJS, Express, etc.)

4. [ ] Integrate with existing documentation system (developer-experience)
   - Link repomix-discovered APIs to Enhanced Metadata System V2
   - Create cross-references between packages
   - Add to existing CLI for interactive exploration

## Technical Requirements

**Leverage repomix infrastructure only**:

- Use existing repomix.config.json configuration
- Generate from actual TypeScript interfaces (not creating new ones)
- Focus on discovering existing APIs, not simplifying them
- Integrate with existing CLI and documentation

## Example API Discovery Output

Target discoveries from repomix:

```typescript
// Discovered from repomix analysis
Core DDD Patterns Available:
- AggregateRoot (packages/aggregates) - Base aggregate with events
- EntityId (packages/value-objects) - Strongly-typed identifiers
- IRepository (packages/repositories) - Repository pattern interface
- UnifiedEventBus (packages/events) - Event publishing and handling
- CommandBus/QueryBus (packages/cqrs) - CQRS implementation

Common Patterns:
- Creating Aggregates: new AggregateRoot() or AggregateBuilder.create()
- Entity IDs: EntityId.createWithRandomUUID() or EntityId.fromText()
- Events: aggregate.addDomainEvent() + eventBus.publish()
```

## Definition of Done

- [ ] AI analysis of repomix output identifies core DDD patterns
- [ ] Simplified interface discovery guides for 5 main packages
- [ ] Contextual recommendations: "For X use case, try Y package"
- [ ] Integration with CLI: `vytches-ddd discover --pattern aggregate`
- [ ] Cross-package relationship mapping from actual code structure
- [ ] Framework-specific discovery guides based on actual implementations

## Dependencies

- repomix.config.json (already configured)
- AI/LLM access for pattern analysis
- Existing CLI infrastructure for integration
- Enhanced Metadata System V2 for cross-references

## Notes

This uses our existing repomix configuration to solve the "overwhelming choice"
problem. By analyzing actual code structure rather than creating simplified
versions, we help developers discover what's already there without adding
complexity.
