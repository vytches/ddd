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
pnpm dev:policies
pnpm dev:projections
pnpm dev:validation
pnpm dev:domain-services
pnpm dev:acl
pnpm dev:messaging
pnpm dev:resilience
pnpm dev:enterprise
pnpm dev:cli
pnpm dev:testing
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
├── @vytches-ddd/utils (Common utilities)
└── @vytches-ddd/contracts (Shared interfaces and contracts)

Patterns Layer:
├── @vytches-ddd/validation (Business rules, specifications)
├── @vytches-ddd/policies (Business policies, policy builder)
└── @vytches-ddd/domain-services (Domain services, domain logic coordination)

Architecture Layer:
├── @vytches-ddd/events (Event-driven architecture, domain events)
├── @vytches-ddd/cqrs (Command Query Responsibility Segregation)
└── @vytches-ddd/projections (Event projections, read models)

Integration Layer:
├── @vytches-ddd/acl (Anti-Corruption Layer)
└── @vytches-ddd/messaging (Outbox pattern, sagas)

Infrastructure Layer:
├── @vytches-ddd/resilience (Circuit breakers, retry patterns)
└── @vytches-ddd/enterprise (Health checks, monitoring)

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
- **Event Projections**: Read model generation from events with capabilities
- **Business Policies**: Fluent policy builder with specifications and validations
- **Validation Specifications**: Composite specifications and business rules
- **Outbox Pattern**: Reliable message delivery
- **Resilience Patterns**: Circuit breakers, retry, bulkhead, timeout strategies
- **Observability**: Metrics collection, monitoring, and event-driven telemetry
- **Shared Contracts**: Common interfaces across domain boundaries

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

- **Core Infrastructure**: Complete monorepo setup with build tooling
- **Foundation Layer**: Core value objects, entities, aggregates, and utilities implemented
- **Patterns Layer**: Advanced validation with specifications and fluent policy builder implemented
- **Architecture Layer**: Event-driven architecture with domain events, CQRS, and projections with capabilities
- **Integration Layer**: Anti-corruption layer and outbox pattern messaging implemented
- **Infrastructure Layer**: Comprehensive resilience patterns with observability
- **Tooling Layer**: CLI framework and testing utilities available  
- **Development Workflow**: Fully functional with smart development mode and testing
- **Package Structure**: Well-defined dependencies with strict module boundaries

### Recently Implemented Features

#### Business Policies Package (@vytches-ddd/policies)

- **Fluent Policy Builder**: Chain policies with `.must()`, `.mustAsync()`, `.and()`, `.or()`
- **Composite Policies**: Group policies with AND/OR logic
- **Conditional Policies**: Apply policies based on runtime conditions with `.when().then().otherwise()`
- **Violation Management**: Structured policy violations with severity levels
- **Policy Registry**: Central registration and retrieval of domain policies

#### Event Projections Package (@vytches-ddd/projections)

- **Projection Engine**: Enhanced projection engine with retry capabilities
- **Capability System**: Extensible capabilities (checkpoints, circuit breakers, dead letter handling)
- **Error Strategies**: Configurable retry strategies with exponential backoff
- **Lifecycle Hooks**: Before/after hooks for projection processing
- **State Management**: Automated initial state creation and persistence

#### Shared Contracts Package (@vytches-ddd/contracts)

- **Domain Event Interfaces**: Standardized event contracts across packages
- **Aggregate Interfaces**: Common aggregate behavior contracts
- **Validation Interfaces**: Specification and validator contracts
- **Event Infrastructure**: Event bus, dispatcher, and store interfaces

#### Enhanced Validation Package (@vytches-ddd/validation)

- **Composite Specifications**: Combine specifications with AND/OR/NOT operations
- **Business Rule Validators**: Domain-specific validation with error context
- **Adapter Pattern**: External validator integration support
- **Validation Facade**: Simplified validation API with comprehensive error reporting

#### Resilience Package (@vytches-ddd/resilience)

- **Circuit Breaker Pattern**: Three-state circuit breaker (CLOSED/OPEN/HALF_OPEN) with automatic recovery
- **Retry Pattern**: Exponential backoff with jitter, configurable retry conditions and maximum attempts
- **Bulkhead Pattern**: Resource isolation with concurrency limits and queue management
- **Timeout Strategy**: Operation timeouts with AbortSignal integration
- **Strategy Composition**: Combine multiple resilience patterns via CompositeResilienceStrategy
- **Fluent Policy Builder**: Chainable pattern configuration with ResiliencePolicyBuilder
- **Resilience Context**: Correlation tracking, attempt counting, and metadata propagation
- **Comprehensive Observability**: Metrics collection, event bus, and multiple export formats
- **Decorator System**: Method decorators for applying resilience patterns
- **Zero Dependencies**: Pure TypeScript implementation with no external runtime dependencies

#### Messaging Package (@vytches-ddd/messaging)

- **Outbox Pattern**: Complete implementation with reliable message delivery
- **Priority Processing**: Configurable message priorities (LOW/NORMAL/HIGH/CRITICAL)
- **Delayed Messages**: Support for scheduled message processing
- **Batch Operations**: Efficient bulk message handling
- **Retry Mechanism**: Configurable retry logic with exponential backoff
- **Middleware Support**: Extensible message processing pipeline
- **Domain Event Integration**: Seamless conversion of domain events to outbox messages
- **Comprehensive Testing**: Full test coverage for outbox functionality
- **Sagas Support**: Basic interfaces defined (implementation pending)

#### Enterprise Package (@vytches-ddd/enterprise)

- **Bundle Architecture**: Enterprise-grade package aggregation
- **Health Checks**: Interface for system health monitoring (implementation pending)
- **Monitoring**: Basic monitoring configuration (implementation pending)
- **Enterprise Configuration**: Centralized configuration management

#### CLI Package (@vytches-ddd/cli)

- **Code Generation Framework**: Basic structure for DDD component generation
- **Template System**: Foundation for Value Objects, Entities, and Aggregates
- **Command Interface**: CLI runner with help system
- **Configuration Support**: Output directory and template configuration
- **Binary Distribution**: `vytches-ddd` command available after installation

### Key Files to Understand

- `tsconfig.base.json`: TypeScript path mappings and compilation settings
- `.eslintrc.json`: Module boundary rules and code style enforcement
- `nx.json`: Build system configuration and caching
- `vitest.config.ts`: Test configuration with package aliases
- `package.json`: Development scripts and workflow commands
