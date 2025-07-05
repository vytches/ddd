# 1. Adopt Monorepo Architecture with Nx and PNPM Workspaces

Date: 2025-07-05

## Status

2025-07-05 accepted

## Context

VytchesDDD is an enterprise-grade TypeScript library implementing Domain-Driven Design patterns. The library consists of multiple interconnected packages:

- Core building blocks (domain-primitives, value-objects, repositories, aggregates)
- Architectural patterns (events, CQRS, projections)
- Integration patterns (ACL, messaging)
- Infrastructure patterns (resilience, enterprise)
- Tooling (CLI, testing, logging)

Key challenges that led to this decision:

1. **Package Interdependencies**: Many packages depend on each other (e.g., logging used across all packages)
2. **Shared Development Environment**: Need consistent TypeScript configuration, linting, and testing across all packages
3. **Coordinated Releases**: Changes in core packages affect dependent packages
4. **Developer Experience**: Simplify development workflow across multiple related packages
5. **Build Optimization**: Efficient building and caching across packages

## Decision

We will adopt a monorepo architecture using:

1. **PNPM Workspaces** for package management and dependency resolution
2. **Nx** for build system orchestration, caching, and task coordination
3. **Lerna** for versioning and publishing coordination
4. **Unified tooling** across all packages (TypeScript, ESLint, Prettier, Vitest)

### Repository Structure

```text
vytches-ddd/
├── packages/          # All library packages
│   ├── core/          # Meta-package for stable API
│   ├── domain-primitives/
│   ├── value-objects/
│   ├── events/
│   └── ...
├── examples/          # Usage examples and testing
├── tools/            # Build tools and utilities
├── scripts/          # Development workflow automation
└── docs/             # Documentation and ADRs
```

### Package Management Strategy

- **PNPM Workspaces**: Efficient dependency management with symbolic linking
- **Workspace Dependencies**: Use `workspace:*` for internal package dependencies
- **Shared Dev Dependencies**: Common tools installed at workspace root
- **Package Isolation**: Each package maintains its own `package.json` for publishing

### Build System Strategy

- **Nx Task Pipeline**: Orchestrated build, test, and lint tasks
- **Incremental Builds**: Build only affected packages
- **Parallel Execution**: Maximize build performance with parallel task execution
- **Caching**: Aggressive caching of build artifacts and test results

## Consequences

### Positive Consequences

- **Simplified Dependency Management**: Single `pnpm install` for entire workspace
- **Consistent Tooling**: Shared configuration for TypeScript, ESLint, Prettier
- **Efficient Development**: Hot reload and watch mode across packages
- **Atomic Changes**: Single commit can update multiple related packages
- **Build Performance**: Nx caching and parallel execution significantly improve build times
- **Type Safety**: Proper TypeScript path mapping enables full IntelliSense across packages
- **Testing Integration**: Unified test running and coverage reporting
- **Release Coordination**: Lerna enables coordinated versioning and publishing

### Negative Consequences

- **Repository Size**: Larger repository with all packages in single repo
- **Initial Complexity**: More complex initial setup compared to separate repositories
- **Tool Dependencies**: Dependent on Nx, PNPM, and Lerna ecosystem
- **Merge Conflicts**: Potential for more merge conflicts in shared configuration files
- **Build Time**: Initial build time for entire workspace can be longer

### Neutral Consequences

- **Learning Curve**: Team needs to understand monorepo development patterns
- **CI/CD Adaptation**: Need to adapt CI/CD pipelines for monorepo structure
- **Documentation**: Need to maintain documentation for monorepo workflows

### Implementation Details

- **Package Boundaries**: Enforced via ESLint rules to prevent inappropriate cross-dependencies
- **Import Strategy**: Meta-package pattern provides stable API for external consumers
- **Development Scripts**: Automated scripts for common development tasks
- **Quality Gates**: Automated quality monitoring and validation
