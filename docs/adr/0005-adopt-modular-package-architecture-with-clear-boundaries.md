# 5. Adopt Modular Package Architecture with Clear Boundaries

Date: 2025-07-05

## Status

2025-07-05 accepted

## Context

VytchesDDD implements Domain-Driven Design patterns and needs to organize its
codebase in a way that reflects clear architectural boundaries and separation of
concerns. The library has grown to include 19 packages across different
architectural layers.

### Architectural Complexity Challenges

1. **Package Dependencies**: Need clear rules about which packages can depend on
   others
2. **Circular Dependencies**: Risk of circular dependencies between packages
3. **Layer Violations**: Preventing higher-level packages from depending on
   lower-level ones inappropriately
4. **Consumer Confusion**: Users need to understand which packages to use
   together
5. **Maintenance Overhead**: Changes in foundational packages affect many
   dependent packages

### Domain-Driven Design Principles

- **Bounded Contexts**: Each package should represent a clear bounded context
- **Dependency Direction**: Dependencies should flow in one direction (from
  high-level to low-level)
- **Separation of Concerns**: Each package should have a single, well-defined
  responsibility
- **Interface Segregation**: Packages should depend only on interfaces they need

### Current Package Landscape

19 packages organized across different concerns:

- Foundation (core, utils, contracts, logging)
- Patterns (validation, policies, domain-services)
- Architecture (events, cqrs, projections)
- Integration (acl, messaging)
- Infrastructure (resilience, enterprise)
- Tooling (cli, testing)

## Decision

We will adopt a **Layered Modular Architecture** with clear package boundaries
and dependency rules:

### Architectural Layers

```text
┌─────────────────────────────────────────────────────────────┐
│                    TOOLING LAYER                            │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │     cli     │  │   testing    │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                        │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │ resilience  │  │ enterprise   │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                 INTEGRATION LAYER                           │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │     acl     │  │  messaging   │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                 ARCHITECTURE LAYER                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   events    │  │     cqrs     │  │ projections  │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   PATTERNS LAYER                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ validation  │  │   policies   │  │domain-services│       │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  FOUNDATION LAYER                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │    core     │  │    utils     │  │  contracts   │        │
│  │(meta-pkg)   │  │              │  │              │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   logging   │  │domain-prims  │  │value-objects │        │
│  │             │  │              │  │              │        │
│  └─────────────┘  └──────────────┘  └──────────────┘        │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │repositories │  │  aggregates  │                          │
│  │             │  │              │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules

1. **Downward Dependencies Only**: Packages can only depend on packages in lower
   layers
2. **No Circular Dependencies**: Strict prevention of circular dependencies
3. **Horizontal Independence**: Packages within same layer should not depend on
   each other (except through contracts)
4. **Foundation Exceptions**: Core building blocks can have minimal direct
   dependencies

### Package Boundaries

**Foundation Layer Rules**:

- `core` (meta-package): Re-exports from domain-primitives, value-objects,
  repositories, aggregates
- `domain-primitives`: No dependencies except Node.js built-ins
- `value-objects`: Can depend on domain-primitives
- `repositories`: Can depend on domain-primitives, value-objects
- `aggregates`: Can depend on domain-primitives, value-objects, repositories
- `utils`: No DDD dependencies (pure utilities)
- `contracts`: Shared interfaces only, minimal dependencies
- `logging`: Zero dependencies (pure TypeScript implementation)

**Higher Layer Rules**:

- Must import from `@vytches-ddd/core` for stability
- Can depend on lower layers through stable APIs
- Cannot bypass layer boundaries

### Import Strategy Enforcement

```typescript
// ✅ External consumers
import { AggregateRoot, EntityId } from '@vytches-ddd/core';

// ✅ Internal foundation packages (direct imports to avoid circles)
import { IActor } from '@vytches-ddd/domain-primitives';
import { EntityId } from '@vytches-ddd/value-objects';

// ✅ Higher-level packages (through meta-package)
import { AggregateRoot } from '@vytches-ddd/core';
import { Logger } from '@vytches-ddd/logging';

// ❌ Layer violations (prevented by ESLint)
import { EntityId } from '@vytches-ddd/value-objects'; // in events package
```

### ESLint Rule Enforcement

```javascript
// Module boundary enforcement
'@nx/enforce-module-boundaries': [
  'error',
  {
    allow: [],
    depConstraints: [
      {
        sourceTag: 'scope:foundation',
        onlyDependOnLibsWithTags: ['scope:foundation']
      },
      {
        sourceTag: 'scope:patterns',
        onlyDependOnLibsWithTags: ['scope:foundation', 'scope:patterns']
      }
      // ... other layer rules
    ]
  }
]
```

## Consequences

### Positive Consequences

- **Clear Architecture**: Well-defined layers prevent architectural drift
- **Dependency Clarity**: Explicit rules about what can depend on what
- **Maintainability**: Changes are contained within appropriate boundaries
- **Consumer Guidance**: Clear patterns for which packages to use together
- **Circular Prevention**: Automated prevention of circular dependencies
- **Scalability**: Architecture scales with new packages and features
- **Team Understanding**: Clear mental model for where code belongs
- **Quality Assurance**: Automated enforcement of architectural rules

### Negative Consequences

- **Initial Complexity**: More complex than flat package structure
- **Learning Curve**: Developers need to understand layer architecture
- **Import Strategy**: Need to learn when to use direct vs meta-package imports
- **Build Coordination**: More complex build orchestration across layers
- **Refactoring Overhead**: Moving code between layers requires careful
  consideration

### Neutral Consequences

- **Documentation Burden**: Need to document architectural principles clearly
- **Tooling Dependency**: Relies on ESLint and Nx for boundary enforcement
- **Package Count**: More packages to manage but with clear purposes

### Implementation Details

- **ESLint Integration**: Automated boundary enforcement through linting
- **Nx Tags**: Package tagging system for layer identification
- **Build Dependencies**: Proper build order based on dependency graph
- **Import Validation**: Automated validation of import patterns
- **Documentation**: Clear guidelines for package placement and dependencies

### Success Metrics

- ✅ Zero circular dependencies across all packages
- ✅ ESLint rules prevent inappropriate cross-dependencies
- ✅ Clear documentation of layer responsibilities
- ✅ All packages tagged with appropriate layer information
- ✅ Build system respects dependency order
- ✅ Import patterns consistently followed across codebase

### Package Responsibilities

**Foundation**: Core DDD building blocks, utilities, logging **Patterns**:
Business rules, policies, domain services  
**Architecture**: Event-driven patterns, CQRS, projections **Integration**:
External system integration patterns **Infrastructure**: Cross-cutting
infrastructure concerns **Tooling**: Development and testing utilities
