# ADR-0021: Circular Dependency Resolution

## Status

Accepted

## Date

2025-08-18

## Context

The VytchesDDD monorepo experienced critical circular dependency issues that
prevented proper compilation and violated clean architecture principles. The
main circular dependency chains were:

1. `@vytches/ddd-core` → `@vytches/ddd-repositories` → `@vytches/ddd-testing` →
   `@vytches/ddd-core`
2. `@vytches/ddd-logging` → `@vytches/ddd-testing` → `@vytches/ddd-core` →
   `@vytches/ddd-logging`

These circular dependencies caused:

- Build failures and compilation errors
- Inability to properly tree-shake bundles
- Violation of dependency inversion principle
- Tight coupling between packages that should be independent
- Increased bundle sizes (core package was 184KB)

## Decision

We implemented a three-phase approach to resolve circular dependencies:

### Phase 1: Breaking Circular Chains (Completed)

1. **Testing Package Isolation**: Removed dependencies on higher-level packages,
   making testing depend only on contracts and domain-primitives
2. **Logging Package Independence**: Removed testing dependencies from logging
   package
3. **Core Meta-Package Optimization**: Removed repositories and process-managers
   from core exports, reducing bundle to 0.82KB (99.5% reduction)
4. **Module Boundary Fixes**: Fixed all cross-layer imports in events and
   domain-services packages

### Phase 2: Architectural Reinforcement (In Progress)

1. **ESLint Rules Update**: Enforced stricter module boundaries to prevent
   future violations
2. **Testing Contracts**: Created testing interfaces in contracts package for
   proper abstraction
3. **Documentation**: Added ADRs and migration guides

### Phase 3: Quality Assurance (Planned)

1. **CI/CD Integration**: Add circular dependency checks to build pipeline
2. **Monitoring**: Implement bundle size and architecture monitoring

## Architectural Principles

The resolution follows these principles:

1. **Dependency Inversion**: High-level modules should not depend on low-level
   modules
2. **Clean Layering**: Clear separation between foundation, core, and
   application layers
3. **Single Responsibility**: Each package has a focused, well-defined purpose
4. **Interface Segregation**: Use contracts/interfaces to avoid concrete
   dependencies

### Layer Structure

```
Foundation Layer (no upward dependencies):
├── contracts        (interfaces and types)
├── utils           (utilities)
└── domain-primitives (base classes and errors)

Core Layer (depends only on foundation):
├── value-objects   (value object implementations)
├── testing         (testing utilities)
├── logging         (logging infrastructure)
└── validation      (validation framework)

Domain Layer (depends on foundation and core):
├── aggregates      (aggregate roots)
├── repositories    (repository patterns)
├── events          (event system)
└── domain-services (domain service patterns)

Application Layer (can depend on all lower layers):
├── cqrs            (command/query separation)
├── policies        (business policies)
├── messaging       (messaging patterns)
├── projections     (event projections)
└── process-managers (process orchestration)

Meta-Packages (re-export combinations):
├── core            (fundamental building blocks)
└── enterprise      (complete feature set)
```

## Consequences

### Positive

- **Clean Architecture**: Proper layering with no circular dependencies
- **Better Tree-Shaking**: 99.5% reduction in core bundle size
- **Improved Maintainability**: Clear boundaries between packages
- **Faster Builds**: Reduced dependency chains improve compilation speed
- **Type Safety**: Maintained full TypeScript type safety
- **Testability**: Testing package can be used anywhere without causing cycles

### Negative

- **Breaking Changes**: External consumers must update import paths
- **Migration Effort**: Existing applications need to update imports
- **Learning Curve**: Developers need to understand new architecture

### Neutral

- **More Explicit Imports**: Users must import from specific packages rather
  than core
- **Increased Package Count**: More granular packages to maintain
- **Documentation Updates**: All examples and documentation need updates

## Migration Guide

For applications using the library:

### Before

```typescript
import {
  AggregateRoot,
  IRepository,
  IUnitOfWork,
  Logger,
} from '@vytches/ddd-core';
```

### After

```typescript
import { AggregateRoot } from '@vytches/ddd-aggregates';
// or
import { AggregateRoot } from '@vytches/ddd-core'; // still works

import { IRepository, IUnitOfWork } from '@vytches/ddd-repositories';
import { Logger } from '@vytches/ddd-logging';
```

## Validation

The following checks ensure the resolution is working:

1. **Build Check**: `pnpm build` - All packages build successfully
2. **Type Check**: `pnpm type-check` - No TypeScript errors
3. **Circular Check**: `npx madge --circular packages/*/src/index.ts` - No
   cycles between core packages
4. **Bundle Size**: Core package < 1KB (currently 0.82KB)
5. **ESLint**: `pnpm lint` - No module boundary violations

## References

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Madge - Module Dependency Checker](https://github.com/pahen/madge)

## Related ADRs

- ADR-0001: Monorepo Structure
- ADR-0005: Meta-Package Pattern
- ADR-0006: Unified Event System
