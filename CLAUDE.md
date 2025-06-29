# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Primary Development Workflow

```bash
# Smart development mode - auto-detects packages based on recent changes
pnpm dev

# Playground mode - for testing and prototyping
pnpm playground

# Package-specific development (auto-includes dependencies)
pnpm dev:core
pnpm dev:events
pnpm dev:cqrs
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Test specific areas
pnpm test:affected
pnpm test:package <package-name>
```

### Build & Validation

```bash
# Build all packages
pnpm build

# Build only affected packages
pnpm build:affected

# Validate exports and bundles
pnpm validate

# Lint code
pnpm lint

# Type check
pnpm type-check
```

### Utilities

```bash
# Clean all build artifacts
pnpm clean

# View dependency graph
pnpm graph

# Format code
pnpm format
```

## Project Architecture

### Monorepo Structure

- **packages/**: All library packages organized by domain
- **examples/**: Usage examples and testing playgrounds
- **tools/**: Build tools and development utilities
- **scripts/**: Development workflow automation

### Package Dependency Hierarchy

```
Foundation Layer:
├── @vytches-ddd/core (Value Objects, Entities, Aggregates)
└── @vytches-ddd/utils (Common utilities)

Patterns Layer:
├── @vytches-ddd/validation (Business rules, specifications)
└── @vytches-ddd/policies (Business policies)

Architecture Layer:
├── @vytches-ddd/events (Event-driven architecture)
├── @vytches-ddd/cqrs (Command Query Responsibility Segregation)
└── @vytches-ddd/projections (Event projections, read models)

Integration Layer:
├── @vytches-ddd/acl (Anti-Corruption Layer)
└── @vytches-ddd/messaging (Outbox pattern, sagas)

Infrastructure Layer:
└── @vytches-ddd/resilience (Circuit breakers, retry patterns)

Tooling Layer:
├── @vytches-ddd/testing (Test utilities)
└── @vytches-ddd/cli (Code generation tools)
```

### Key Architectural Patterns

This project implements enterprise-grade Domain-Driven Design patterns:

- **Value Objects**: Immutable objects representing domain concepts
- **Entities**: Objects with identity and lifecycle management
- **Aggregates**: Consistency boundaries for domain operations
- **Domain Events**: Event-driven architecture for loose coupling
- **CQRS**: Command Query Responsibility Segregation
- **Anti-Corruption Layer**: External system integration patterns
- **Event Projections**: Read model generation from events
- **Outbox Pattern**: Reliable message delivery
- **Circuit Breakers**: Resilience patterns for external dependencies

### Module Boundaries

The project enforces strict module boundaries via ESLint:

- Core packages have minimal dependencies
- Higher-level packages can depend on foundation layers
- Testing package can depend on all other packages
- Examples can use any package

## Development Workflow

### Recommended Development Flow

1. Use `pnpm playground` for feature development and testing
2. The playground automatically watches core packages and provides hot reload
3. Edit packages in `packages/*/src/` and test in `examples/playground/src/`
4. Tests run automatically on file changes

### Working with Specific Packages

- Use `pnpm dev:<package-name>` to focus on specific packages
- Dependencies are automatically included in watch mode
- TypeScript paths are configured for seamless imports

### Package Structure Convention

Each package follows this structure:

```
packages/<package-name>/
├── src/
│   ├── index.ts           # Main export file
│   ├── <domain>/          # Domain-specific code
│   └── types/             # Type definitions
├── package.json           # Package configuration
├── project.json           # Nx project configuration
└── tsconfig.json          # TypeScript configuration
```

## Testing Strategy

### Test Organization

- Unit tests: `*.test.ts` files alongside source code
- Integration tests: In `examples/` directory
- API surface tests: `api-surface.test.ts` files

### Test Utilities

- Use `@vytches-ddd/testing` package for DDD-specific test utilities
- Vitest configuration supports package aliases
- Coverage thresholds: 80% for branches, functions, lines, statements

## Code Style & Quality

### TypeScript Configuration

- Strict mode enabled with additional checks
- Exact optional property types
- No unchecked indexed access
- No implicit returns or fallthrough cases

### ESLint Rules

- Explicit function return types required
- Consistent type imports preferred
- Module boundary enforcement
- No unused variables (except underscore-prefixed)

### Conventions

- Use interfaces over type aliases
- Prefer type imports for better tree-shaking
- Follow established patterns for new components
- Maintain consistency with existing code style

## Enterprise Features

### Bundle Strategies

- **Core Bundle**: Core building blocks (core + utils + validation)
- **Advanced Bundle**: Core + event-driven patterns (+ events + cqrs +
  projections)
- **Enterprise Bundle**: All features (+ acl + policies + messaging +
  resilience)

### Development Tooling

- Smart development mode detects changes automatically
- Package-specific workflows with dependency resolution
- Comprehensive validation and analysis scripts
- Automated bundle size and export validation

## Notes for Development

### Current State

- Project is in initial setup phase with complete infrastructure
- Core DDD implementations are placeholder/minimal
- Development workflow and tooling are fully functional
- Package structure and dependencies are well-defined

### Key Files to Understand

- `tsconfig.base.json`: TypeScript path mappings and compilation settings
- `.eslintrc.json`: Module boundary rules and code style enforcement
- `nx.json`: Build system configuration and caching
- `vitest.config.ts`: Test configuration with package aliases
- `package.json`: Development scripts and workflow commands
