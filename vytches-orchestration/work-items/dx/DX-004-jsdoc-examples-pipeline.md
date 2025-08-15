# DX-004: JSDoc-to-Examples Pipeline

**Priority**: 82 (HIGH) **Agent**: library-expert + developer-experience
(PARALLEL) **Timeline**: 4-5 days **Status**: Active **Created**: 2025-08-15

## Problem Statement

Enhanced Metadata System V2 has rich YAML metadata files, but they're not
automatically converted to working TypeScript examples. We need to leverage
existing metadata infrastructure to generate examples that are always in sync.

## Context

Existing Enhanced Metadata System V2:

```
docs/examples/domain/
├── aggregates/
│   ├── aggregate-root.yaml
│   └── aggregate-builder.yaml
├── value-objects/
│   └── entity-id.yaml
└── repositories/
    └── base-repository.yaml
```

Available scripts:

- scripts/inject-yaml-jsdoc-ast.js
- scripts/enhanced-jsdoc-placement.js
- Enhanced Metadata System V2 processing

## Success Metrics

- [ ] Automated example generation from existing YAML metadata
- [ ] Perfect sync between docs and working examples
- [ ] Zero manual example maintenance
- [ ] Examples compile and run successfully

## Action Items

1. [ ] Build YAML → TypeScript examples generator (library-expert)

   - Extend existing inject-yaml-jsdoc-ast.js script
   - Parse YAML @extract blocks for example code
   - Generate .ts files from YAML example metadata

2. [ ] Use existing Enhanced Metadata System V2 (developer-experience)

   - Leverage current YAML files in docs/examples/domain/
   - Extract @extract blocks with typescript code
   - Ensure examples use only existing APIs

3. [ ] Integrate with existing CLI examples command (developer-experience)

   - Add generated examples to CLI examples browsing
   - Create `vytches-ddd examples --from-docs` command
   - Link generated examples to CLI scaffolding

4. [ ] Create automated sync pipeline (library-expert)
   - Run YAML → examples generation in build process
   - Ensure generated examples compile successfully
   - Add validation step to CI pipeline

## Technical Requirements

**Leverage existing metadata infrastructure**:

- Use Enhanced Metadata System V2 YAML files as source
- Extract @extract blocks containing typescript examples
- Generate compilable .ts files in examples/ directory
- Integrate with existing CLI examples command

## Example YAML Input

```yaml
# docs/examples/domain/aggregates/aggregate-root.yaml
methods:
  constructor:
    examples:
      - id: 'basic'
        code: |
          const aggregate = new AggregateRoot({
            id: EntityId.fromText('order-123'),
            version: 0
          });
```

## Example Generated Output

```typescript
// examples/generated/aggregates/aggregate-root-basic.ts
import { AggregateRoot, EntityId } from '@vytches/ddd-core';

// Generated from: docs/examples/domain/aggregates/aggregate-root.yaml
const aggregate = new AggregateRoot({
  id: EntityId.fromText('order-123'),
  version: 0,
});
```

## Definition of Done

- [ ] YAML metadata files generate working TypeScript examples
- [ ] Generated examples use only existing APIs (no SimpleAggregate, etc.)
- [ ] Examples compile successfully with current library version
- [ ] CLI `vytches-ddd examples --from-docs` shows generated examples
- [ ] Pipeline runs automatically during build process
- [ ] Zero manual maintenance required for example synchronization

## Dependencies

- Enhanced Metadata System V2 YAML files
- inject-yaml-jsdoc-ast.js script (to extend)
- Existing CLI examples command infrastructure
- TypeScript compilation pipeline

## Notes

This creates a powerful automated pipeline that ensures our examples are always
current with the actual library APIs. By leveraging existing Enhanced Metadata
System V2, we get documentation and examples from a single source of truth.
