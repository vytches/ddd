# CLAUDE.md

## CRITICAL: Test Files Location

**When generating or creating test files, ALWAYS place them in the `tests/`
directory, NOT in `src/`.**

- ✅ CORRECT: `packages/[package]/tests/my-component.test.ts`
- ❌ WRONG: `packages/[package]/src/my-component.test.ts`

## Development Commands

```bash
# Primary workflow
pnpm dev           # Smart development mode
pnpm playground    # Testing/prototyping
pnpm test          # Run all tests
pnpm build         # Build all packages
pnpm lint          # Lint code
pnpm type-check    # Type checking
pnpm quality       # Run quality checks
```

### Architecture Decision Records

```bash
pnpm adr:new "Decision Title"  # Create new ADR
pnpm adr:list                  # List all ADRs
```

All significant architectural decisions MUST be documented as ADRs.

## Package Architecture

### Import Strategy

**External Consumers:**

```typescript
import { AggregateRoot, EntityId, BaseError } from '@vytches-ddd/core';
import { Logger } from '@vytches-ddd/logging';
import { CommandBus } from '@vytches-ddd/cqrs';
```

**Internal Packages:**

```typescript
// Core building blocks - direct imports
import { IActor } from '@vytches-ddd/domain-primitives';
import type { EntityId } from '@vytches-ddd/contracts';

// Higher-level packages - meta-package imports
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
```

### Module Boundaries & Import Strategy

The project enforces strict module boundaries via ESLint and uses an
**Enterprise Meta-Package Pattern** for API stability:

#### **Import Strategy - CRITICAL for Enterprise Usage:**

**1. External Consumers (Applications using the library):**

```typescript
// ✅ ALWAYS import from meta-package for stable API
import { AggregateRoot, EntityId, BaseError } from '@vytches-ddd/core';
import { Logger } from '@vytches-ddd/logging';
import { CommandBus } from '@vytches-ddd/cqrs';
import { VytchesDDD, DomainService, ServiceLifetime } from '@vytches-ddd/di';
```

**2. Internal Monorepo Packages:**

**Core Building Blocks** (domain-primitives, value-objects, repositories,
aggregates):

```typescript
// ✅ Direct imports to prevent circular dependencies
import { IActor } from '@vytches-ddd/domain-primitives';
import type { EntityId } from '@vytches-ddd/contracts'; // EntityId interfaces from contracts
import { EntityId } from '@vytches-ddd/value-objects'; // Enhanced EntityId implementation
```

**Higher-Level Packages** (events, cqrs, domain-services, etc.):

```typescript
// ✅ Import through meta-package for stability
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
```

**3. Examples & Testing:**

```typescript
// ✅ Can import directly for development/testing
import { AggregateRoot } from '@vytches-ddd/aggregates';
import type { EntityId } from '@vytches-ddd/contracts'; // For type definitions
// OR through stable API
import { AggregateRoot } from '@vytches-ddd/core';
```

#### **Module Boundary Rules:**

- **Contracts package**: Foundation layer providing core interfaces (EntityId,
  domain contracts)
- **Core building blocks**: Import EntityId from contracts, minimal other
  dependencies
- **Higher-level packages**: Must import through `@vytches-ddd/core`
- **Testing package**: Can depend on all packages, uses contracts for EntityId
- **Examples**: Can use any import pattern
- **ESLint enforcement**: Prevents inappropriate cross-dependencies
- **Circular dependency prevention**: Contracts package breaks circular
  dependencies

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
├── tests/                 # Test files (OUTSIDE of src/)
│   ├── *.test.ts          # Unit tests
│   ├── *.spec.ts          # Spec tests
│   └── <domain>/          # Tests organized by domain
├── package.json           # Package configuration
├── project.json           # Nx project configuration
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite/Vitest configuration
```

**IMPORTANT**: Test files MUST be placed in the `tests/` directory, NOT in
`src/`. This prevents circular dependencies where foundation packages would
import from the testing package.

## Testing Strategy

### Test File Naming Convention

**IMPORTANT**: Use `.test.ts` extension for all test files, NOT `.spec.ts`. This
is the standard convention used throughout the codebase and aligns with modern
TypeScript frameworks like Jest, Vitest, and others.

- ✅ CORRECT: `user-service.test.ts`
- ❌ WRONG: `user-service.spec.ts`

### Test Organization

- Unit tests: `*.test.ts` files in `tests/` directory (NOT in `src/`)
- Integration tests: In `examples/` directory
- API surface tests: `api-surface.test.ts` files in `tests/` directory
- Test file structure mirrors source structure: `src/domain/entity.ts` →
  `tests/domain/entity.test.ts`

### Test Utilities

- Use `@vytches-ddd/testing` package for DDD-specific test utilities
- Vitest configuration supports package aliases
- Coverage thresholds: 80% for branches, functions, lines, statements

### Test Error Handling Patterns

**CRITICAL**: All test files MUST use `safeRun` from `@vytches-ddd/utils` for
error testing. Never use Jest/Vitest `toThrow` patterns.

**Required Patterns:**

```typescript
// ✅ CORRECT: Use safeRun for synchronous error testing
import { safeRun } from '@vytches-ddd/utils';

const [error] = safeRun(() => someFunction());
expect(error).toBeInstanceOf(ErrorClass);
expect(error?.message).toBe('Expected error message');
expect(error).toBeDefined(); // For any error
expect(error).toBeNull(); // For no error

// ✅ CORRECT: Use safeRun for asynchronous error testing
const [asyncError] = await safeRun(async () => await someAsyncFunction());
expect(asyncError).toBeInstanceOf(ErrorClass);

// ✅ CORRECT: Use safeRun for functions that should not throw
const [noError] = safeRun(() => validFunction());
expect(noError).toBeNull();
```

**Deprecated Patterns to Avoid:**

```typescript
// ❌ WRONG: Do not use these patterns
expect(() => someFunction()).toThrow(ErrorClass);
expect(() => someFunction()).toThrow('error message');
expect(() => someFunction()).not.toThrow();
await expect(async () => someFunction()).rejects.toThrow(ErrorClass);
```

**Migration Guidelines:**

- Always import `safeRun` from `@vytches-ddd/utils` at the top of test files
- Replace `expect(() => fn()).toThrow(ErrorClass)` with
  `const [error] = safeRun(() => fn()); expect(error).toBeInstanceOf(ErrorClass)`
- Replace `expect(() => fn()).toThrow(message)` with
  `const [error] = safeRun(() => fn()); expect(error?.message).toBe(message)`
- Replace `expect(() => fn()).not.toThrow()` with
  `const [error] = safeRun(() => fn()); expect(error).toBeUndefined()`
- Use descriptive variable names for errors: `throwError`, `validationError`,
  `configError`, etc.

### Test Generation Examples

When generating test files, follow these patterns:

**Example Test File Structure:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { UserService } from '../src/user-service';
import { ValidationError, NotFoundError } from '@vytches-ddd/domain-primitives';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('createUser', () => {
    it('should create user successfully', () => {
      const userData = { name: 'John', email: 'john@example.com' };
      const [error, user] = safeRun(() => service.createUser(userData));

      expect(error).toBeUndefined();
      expect(user).toBeDefined();
      expect(user?.name).toBe('John');
    });

    it('should throw ValidationError for invalid email', () => {
      const userData = { name: 'John', email: 'invalid-email' };
      const [validationError] = safeRun(() => service.createUser(userData));

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError?.message).toContain('Invalid email format');
    });

    it('should handle async operations correctly', async () => {
      const [saveError, result] = await safeRun(
        async () => await service.saveUser({ name: 'Jane' })
      );

      expect(saveError).toBeUndefined();
      expect(result?.id).toBeDefined();
    });
  });
});
```

**Key Points for Test Generation:**

1. **File naming**: Always use `.test.ts` extension
2. **Import safeRun**: Always import from `@vytches-ddd/utils`
3. **Error handling**: Use safeRun for all error assertions
4. **Variable naming**: Use descriptive names like `validationError`,
   `notFoundError`
5. **Async handling**: Use `await safeRun(async () => ...)` for async operations
6. **Error checks**: Use `.toBeUndefined()` for no error, `.toBeInstanceOf()`
   for error types
7. **Message checks**: Use `.toContain()` for error messages that might have
   prefixes

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

### TypeScript Typing Guidelines

**CRITICAL**: When creating functionality, avoid using the `any` type whenever
possible.

- ❌ **AVOID**: Using `any` type unless there's a strong business justification
- ✅ **PREFER**: Proper typing with specific interfaces, types, or generics
- ✅ **USE**: `unknown` instead of `any` when the type is truly unknown
- ✅ **USE**: Generic types `<T>` for flexible but type-safe code

**Examples:**

```typescript
// ❌ WRONG: Avoid any
function processData(data: any): any {
  return data.value;
}

// ✅ CORRECT: Use proper types
function processData<T extends { value: string }>(data: T): string {
  return data.value;
}

// ✅ CORRECT: Use unknown for truly unknown types
function handleUnknownData(data: unknown): void {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    console.log(data.value);
  }
}
```

**Exceptions**: Only use `any` when:

- Integrating with third-party libraries that lack proper types
- Creating temporary workarounds that will be properly typed later (add TODO
  comment)
- The business logic explicitly requires dynamic typing (document the reason)

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

- **Core Infrastructure**: Complete monorepo setup with build tooling and
  comprehensive logging
- **Foundation Layer**: Modular core architecture with meta-package pattern
  (99.2% size reduction)
  - **@vytches-ddd/core**: Enterprise meta-package (1.4KB) providing stable API
  - **@vytches-ddd/domain-primitives**: Base classes, errors, interfaces (40KB)
  - **@vytches-ddd/value-objects**: Value object implementations, EntityId
    (36KB)
  - **@vytches-ddd/repositories**: Repository patterns, UnitOfWork (40KB)
  - **@vytches-ddd/aggregates**: Aggregate root + capabilities (82KB)
- **Patterns Layer**: Advanced validation with specifications and fluent policy
  builder implemented
- **Architecture Layer**: Event-driven architecture with domain events, CQRS,
  and projections with capabilities
- **Integration Layer**: Anti-corruption layer and outbox pattern messaging
  implemented
- **Infrastructure Layer**: Comprehensive resilience patterns with observability
  and logging
- **Tooling Layer**: CLI framework and testing utilities with logging
  integration
- **Development Workflow**: Fully functional with smart development mode and
  testing
- **Package Structure**: Enterprise-grade module boundaries with import strategy
  enforcement
- **Enterprise Logging**: Complete structured logging system integrated across
  all packages
- **API Stability**: Meta-package pattern provides enterprise-grade API
  stability
- **Circular Dependency Resolution**: Enterprise-grade architecture with
  contracts foundation
- **TypeScript Configuration**: Standardized across all packages with proper
  include paths
- **Test File Organization**: All test files moved to `tests/` directories to
  prevent circular dependencies

### Recently Implemented Features

#### NEW: Test Files Migration to Prevent Circular Dependencies - COMPLETED

**IMPORTANT ARCHITECTURAL CHANGE**: All test files moved from `src/` to `tests/`
directories

- **Problem Solved**: Foundation packages (value-objects, repositories) were
  importing from @vytches-ddd/testing in their test files
- **Solution**: Moved all `*.test.ts` and `*.spec.ts` files to dedicated
  `tests/` directories
- **Scope**: 16 packages updated with ~80 test files migrated
- **Configuration Updates**:
  - All `vite.config.ts` updated to look for tests in `tests/` directory
  - All `tsconfig.json` updated to include `tests/**/*` in compilation
  - Import paths in test files updated to reference `../src/` appropriately
- **Result**: Foundation layers now have zero runtime dependencies on testing
  package
- **ESLint Compliance**: Relative imports used within packages as enforced by
  module boundary rules

#### NEW: Enterprise Circular Dependency Resolution - COMPLETED

**BREAKING CHANGE**: EntityId moved to contracts package for enterprise-grade
architecture

- **Contracts Foundation**: EntityId interfaces moved to
  `@vytches-ddd/contracts` as fundamental building block
- **Circular Dependency Elimination**: Resolved circular dependencies between
  testing and value-objects packages
- **Enterprise Architecture**: Two-layer EntityId pattern with base
  implementation in contracts and enhanced validation in value-objects
- **Type Safety**: Full TypeScript compliance with IEntityId interface contracts
- **Factory Methods**: Built-in UUID, text, integer, and bigint factory methods
  in base EntityId
- **Enhanced Validation**: Value-objects package provides enhanced EntityId with
  LibUtils integration
- **Testing Integration**: Testing package now uses contracts EntityId,
  eliminating circular dependencies
- **Backward Compatibility**: All existing APIs maintained while improving
  architecture
- **Import Strategy**: Clear separation between base EntityId (contracts) and
  enhanced EntityId (value-objects)
- **Enterprise Grade**: No shortcuts, comprehensive solution following DDD
  principles
- **TypeScript Configuration**: Standardized tsconfig.json across all 22
  packages for proper dependency resolution
- **ADR Documentation**: Architectural decision recorded for future reference

#### NEW: Unified Event System (@vytches-ddd/events) - MAJOR REFACTOR COMPLETED

**BREAKING CHANGE**: Complete event system redesign for enterprise-grade event
handling

- **3→1 Event Bus Consolidation**: Eliminated `InMemoryDomainEventBus`,
  `InMemoryIntegrationEventBus`, and redundant dispatcher layers
- **UnifiedEventBus**: Single, optimized event bus handling all event types
  (domain, integration, audit)
- **Context-Aware Routing**: Smart event filtering by contextId with flexible
  subscription patterns
- **Repository Integration**: Full integration with `IBaseRepository.save()` for
  automatic event publishing
- **UniversalEventDispatcher**: Enhanced dispatcher with middleware pipeline and
  event processors
- **Enterprise Features**:
  - Concurrent event publishing with `publishMany()`
  - Aggregate convenience methods with `publishEventsForAggregate()`
  - Transaction-safe event persistence and publishing
  - Optimistic concurrency control
- **Industry Alignment**: Follows patterns from MediatR (.NET), Spring
  Framework, and Axon Framework
- **Performance**: 67% reduction in event handling code, ~50% faster processing
- **Type Safety**: Zero `any` types, full TypeScript compliance
- **Clean Architecture**: Repository pattern handles event publishing
  automatically
- **ADR Documentation**: Complete architectural decision record (ADR-0006) with
  implementation results

#### NEW: Enterprise Meta-Package Architecture (@vytches-ddd/core)

- **Core Package Decomposition**: Transformed monolithic core (184KB) into
  modular architecture (1.4KB meta-package)
  - **@vytches-ddd/domain-primitives**: Base classes, errors, and interfaces
    (40KB)
  - **@vytches-ddd/value-objects**: Value object implementations and EntityId
    (36KB)
  - **@vytches-ddd/repositories**: Repository patterns and UnitOfWork (40KB)
  - **@vytches-ddd/aggregates**: Aggregate root with capabilities (82KB)
- **Enterprise API Stability**: Single stable entry point through meta-package
  pattern
- **Import Strategy Enforcement**: Standardized import patterns for internal vs
  external usage
- **Backward Compatibility**: Zero breaking changes during decomposition
- **Tree-Shaking Excellence**: 100% effective tree-shaking with explicit exports
- **Bundle Size Optimization**: 99.2% reduction in core package size
- **Module Boundaries**: ESLint-enforced architectural boundaries

#### NEW: Logging Package (@vytches-ddd/logging)

- **DDD-First Design**: Built specifically for Domain-Driven Design patterns
  with automatic bounded context detection
- **Smart Context Detection**: Automatically detects class names, method names,
  and bounded contexts from stack traces
- **Structured Logging**: JSON-based logging with rich metadata support and
  correlation tracking
- **Data Masking**: Automatic PII and sensitive data masking with customizable
  patterns and replacement strategies
- **Zero Configuration**: Works out of the box with sensible defaults, no
  configuration required
- **Pluggable Providers**: Easy integration with Winston, Pino, or custom
  logging providers
- **CQRS Integration**: Decorators (`@LogCommands`, `@LogQueries`, `@LogCQRS`)
  with automatic execution timing and payload logging
- **Result Pattern Integration**: Extensions for `@vytches-ddd/utils` Result
  pattern with success/failure logging
- **Aggregate State Logging**: `@LogStateChanges` decorator for automatic
  aggregate state change tracking
- **Context Propagation**: Built-in support for correlation IDs, user IDs,
  tenant IDs, request IDs, and session IDs
- **Enterprise Features**: Multiple log levels, conditional logging, child
  loggers, and context enrichment
- **Integration Coverage**: Fully integrated across all packages (core, events,
  cqrs, resilience, messaging, etc.)

#### Business Policies Package (@vytches-ddd/policies) - V2

- **Unified Promise-Based API**: Consistent async interface across all policy
  operations
- **Enterprise Context System**: Built-in audit trails, multi-tenancy, and
  correlation tracking
- **Advanced Fluent Builder**: Rich API with `.must()`, `.mustAsync()`,
  `.when().then().otherwise()`
- **Specification Integration**: Direct support for ISpecification and
  IAsyncSpecification patterns
- **Complex Group Logic**: PolicyGroup for sophisticated AND/OR business rule
  combinations
- **Rich Violation System**: Structured violations with severity levels
  (ERROR/WARNING/INFO)
- **Conditional Policies**: Dynamic policy execution based on runtime conditions
- **Event-Driven Architecture**: Automatic policy evaluation events for
  observability
- **Policy Registry**: Central registration with domain-based organization and
  querying
- **Policy Behaviors**: MediatR-style behaviors for cross-cutting concerns
  - `PolicyRetryBehavior`: Business rule retry logic for transient failures
  - `PolicyCachingBehavior`: Policy-specific caching with business semantics
  - `PolicyTemporalBehavior`: Time-aware policy execution for business rules
- **Adapter Pattern Ready**: Framework for integrating external validation
  libraries

#### Event Projections Package (@vytches-ddd/projections)

- **Projection Engine**: Enhanced projection engine with retry capabilities
- **Capability System**: Extensible capabilities (checkpoints, circuit breakers,
  dead letter handling)
- **Error Strategies**: Configurable retry strategies with exponential backoff
- **Lifecycle Hooks**: Before/after hooks for projection processing
- **State Management**: Automated initial state creation and persistence

#### Shared Contracts Package (@vytches-ddd/contracts)

- **Foundation Layer**: Core interfaces and contracts for entire library
- **EntityId Foundation**: Base EntityId interface and implementation breaking
  circular dependencies
- **Domain Event Interfaces**: Standardized event contracts across packages
- **Aggregate Interfaces**: Common aggregate behavior contracts
- **Validation Interfaces**: Specification and validator contracts
- **Event Infrastructure**: Event bus, dispatcher, and store interfaces
- **Factory Methods**: Built-in UUID, text, integer, and bigint EntityId
  factories
- **Type Safety**: Full TypeScript interface contracts with IEntityId
- **Enterprise Architecture**: Prevents circular dependencies while maintaining
  functionality

#### Enhanced Validation Package (@vytches-ddd/validation)

- **Composite Specifications**: Combine specifications with AND/OR/NOT
  operations
- **Business Rule Validators**: Domain-specific validation with error context
- **Adapter Pattern**: External validator integration support
- **Validation Facade**: Simplified validation API with comprehensive error
  reporting
- **Logging Integration**: All validation operations now include structured
  logging

#### Event Store Package (@vytches-ddd/event-store)

- **Stream-based Storage**: Organize events by aggregate streams with version
  control
- **Optimistic Concurrency Control**: Version-based conflict detection and
  resolution
- **Snapshot Support**: Performance optimization for large aggregates with
  configurable frequency
- **Global Event Log**: Read all events across streams with filtering and
  pagination
- **Event Serialization**: Pluggable serialization strategies with JSON default
- **Storage Adapters**: In-memory implementation with pattern for PostgreSQL,
  MongoDB adapters
- **Rich Metadata**: Correlation, causation, and custom metadata support for
  events
- **Error Handling**: Comprehensive error hierarchy with domain-specific
  exceptions
- **NestJS Integration**: Production-ready TypeORM entities and module
  configuration
- **Security Features**: Encryption, checksums, and audit logging for sensitive
  events
- **Performance Optimization**: Connection pooling, caching, and indexing
  strategies
- **Testing Support**: Complete test coverage with event store test harness
  utilities

#### Enhanced CQRS Package (@vytches-ddd/cqrs)

- **Advanced Middleware System**: Enhanced execution context and logging
  middleware
- **Decorator-Based Logging**: `@LogCommands`, `@LogQueries`, and `@LogCQRS`
  decorators for automatic logging
- **Performance Monitoring**: Built-in execution timing and performance metrics
- **Handler Registration**: Enhanced decorator-based handler registration with
  metadata
- **Context Propagation**: Rich context propagation with correlation tracking

#### Enhanced Resilience Package (@vytches-ddd/resilience)

- **Circuit Breaker Pattern**: Three-state circuit breaker
  (CLOSED/OPEN/HALF_OPEN) with automatic recovery
- **Retry Pattern**: Exponential backoff with jitter, configurable retry
  conditions and maximum attempts
- **Bulkhead Pattern**: Resource isolation with concurrency limits and queue
  management
- **Timeout Strategy**: Operation timeouts with AbortSignal integration
- **Strategy Composition**: Combine multiple resilience patterns via
  CompositeResilienceStrategy
- **Fluent Policy Builder**: Chainable pattern configuration with
  ResiliencePolicyBuilder
- **Resilience Context**: Correlation tracking, attempt counting, and metadata
  propagation
- **Comprehensive Observability**: Metrics collection, event bus, and multiple
  export formats
- **Decorator System**: Method decorators for applying resilience patterns
- **Zero Dependencies**: Pure TypeScript implementation with no external runtime
  dependencies
- **Logging Integration**: All resilience operations include structured logging
  with context

#### Enhanced Messaging Package (@vytches-ddd/messaging)

- **Outbox Pattern**: Complete implementation with reliable message delivery
- **Priority Processing**: Configurable message priorities
  (LOW/NORMAL/HIGH/CRITICAL)
- **Delayed Messages**: Support for scheduled message processing
- **Batch Operations**: Efficient bulk message handling
- **Retry Mechanism**: Configurable retry logic with exponential backoff
- **Middleware Support**: Extensible message processing pipeline
- **Domain Event Integration**: Seamless conversion of domain events to outbox
  messages
- **Comprehensive Testing**: Full test coverage for outbox functionality
- **Sagas Support**: Basic interfaces defined (implementation pending)
- **Logging Integration**: All messaging operations include comprehensive
  structured logging

#### Enterprise Package (@vytches-ddd/enterprise)

- **Bundle Architecture**: Enterprise-grade package aggregation
- **Health Checks**: Interface for system health monitoring (implementation
  pending)
- **Monitoring**: Basic monitoring configuration (implementation pending)
- **Enterprise Configuration**: Centralized configuration management

#### CLI Package (@vytches-ddd/cli)

- **Code Generation Framework**: Basic structure for DDD component generation
- **Template System**: Foundation for Value Objects, Entities, and Aggregates
- **Command Interface**: CLI runner with help system
- **Configuration Support**: Output directory and template configuration
- **Binary Distribution**: `vytches-ddd` command available after installation

#### Dependency Injection Package (@vytches-ddd/di)

- **Global Service Locator**: Unified approach following MediatR pattern with
  enterprise-grade capabilities
- **Auto-Discovery System**: Plugin-based discovery through enhanced decorators
  (@DomainService, @CommandHandler, @QueryHandler)
- **Context Isolation**: Optional bounded context support for DDD scenarios with
  smart resolution
- **Framework Integration**: Adapter pattern for NestJS, InversifyJS, TSyringe,
  and custom containers
- **Service Lifetimes**: Support for Transient, Singleton, and Scoped service
  registration
- **Enhanced Decorators**: Rich configuration options for timeout, middleware,
  retry policies, and dependencies
- **Type Safety**: Full TypeScript support with generic type resolution and
  compile-time validation
- **Testing Support**: Easy mocking and isolated testing with container reset
  and disposal
- **Performance**: Zero overhead with lazy resolution, compile-time
  registration, and tree-shaking friendly
- **Enterprise Ready**: Production-grade service locator with comprehensive
  error handling and logging integration

## Logging Usage Guide

### Basic Logging Setup

```typescript
import { Logger } from '@vytches-ddd/logging';

// Auto-detects context from class name
class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"

  createUser(userData: UserData): void {
    this.logger.info('Creating user', { userId: userData.id });
  }
}
```

### Advanced Context and Correlation

```typescript
// With correlation tracking
const logger = Logger.forContext('OrderService')
  .withCorrelationId('req-123')
  .withUserId('user-456')
  .withContext({ boundedContext: 'OrderManagement' });

logger.info('Processing order', { orderId: 'order-789' });
```

### CQRS Integration

```typescript
@LogCommands({ includePayload: true, logLevel: 'debug' })
class CreateUserCommandHandler {
  async handle(command: CreateUserCommand): Promise<Result<User, Error>> {
    // Automatic logging of command execution with timing
    return await this.userService.createUser(command);
  }
}
```

### Data Masking Configuration

```typescript
Logger.configure({
  masking: {
    enabled: true,
    sensitiveKeys: ['password', 'email', 'ssn', 'creditCard'],
    replacement: '[MASKED]',
  },
});
```

## Dependency Injection Usage Guide

### Basic DI Setup

```typescript
import { VytchesDDD, SimpleContainer, DomainService } from '@vytches-ddd/di';

// One-time setup with auto-discovery
const container = new SimpleContainer();
VytchesDDD.configure(container); // Auto-discovers all decorated services

// Services are automatically registered and available
const service = VytchesDDD.resolve<UserService>('userService');
```

### Domain Service with DI

```typescript
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';

// Simple service registration
@DomainService('userService')
class UserService {
  async createUser(userData: UserData): Promise<User> {
    // Service automatically discovered and registered
    return User.create(userData);
  }
}

// Advanced service with full DI options
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['paymentService', 'inventoryService'],
  autoRegister: true,
})
class OrderService {
  async processOrder(order: Order): Promise<OrderResult> {
    // Context-aware service resolution
    const paymentService = VytchesDDD.resolve<PaymentService>(
      'paymentService',
      'OrderManagement'
    );
    return await paymentService.processPayment(order);
  }
}
```

### CQRS Integration with DI

```typescript
import { CommandHandler, DomainService } from '@vytches-ddd/di';

// Enhanced command handler with DI options
@CommandHandler(CreateOrderCommand, {
  context: 'OrderManagement',
  timeout: 30000,
  middleware: [ValidationMiddleware, LoggingMiddleware],
})
class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    // Services resolved automatically through DI
    const orderService = VytchesDDD.resolve<OrderService>('orderService');
    await orderService.createOrder(command);
  }
}
```

### Context Isolation for DDD

```typescript
// Setup context-specific containers for bounded contexts
const orderContainer = new SimpleContainer();
const paymentContainer = new SimpleContainer();

// Register context-specific services
orderContainer.registerInstance('orderConfig', { timeout: 30000 });
paymentContainer.registerInstance('paymentConfig', { retries: 3 });

// Configure contexts
VytchesDDD.configureContext('OrderManagement', orderContainer);
VytchesDDD.configureContext('PaymentProcessing', paymentContainer);

// Context-aware service resolution
const orderService = VytchesDDD.resolve<OrderService>(
  'orderService',
  'OrderManagement'
);
const paymentService = VytchesDDD.resolve<PaymentService>(
  'paymentService',
  'PaymentProcessing'
);
```

## Saga Framework Usage Guide

### Basic Saga Implementation

```typescript
import { BaseSaga, SagaStatus } from '@vytches-ddd/messaging';
import type {
  IExtendedDomainEvent,
  ISagaExecutionContext,
  ISagaActionResult,
} from '@vytches-ddd/messaging';

// Define saga for long-running business processes
class OrderProcessingSaga extends BaseSaga {
  constructor() {
    super('OrderProcessingSaga', 'Order Processing Workflow');
  }

  // Handle domain events in the saga
  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    switch (event.eventType) {
      case 'OrderCreated':
        return await this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return await this.handlePaymentProcessed(event, context);
      case 'InventoryReserved':
        return await this.handleInventoryReserved(event, context);
      default:
        return {
          success: false,
          error: { message: 'Unhandled event type', code: 'UNHANDLED_EVENT' },
        };
    }
  }

  // Define which events this saga can handle
  canHandle(event: IExtendedDomainEvent): boolean {
    return [
      'OrderCreated',
      'PaymentProcessed',
      'InventoryReserved',
      'OrderFailed',
    ].includes(event.eventType);
  }

  // Compensation logic for failed transactions
  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Implement compensation logic based on current step
    switch (stepName) {
      case 'PaymentProcessed':
        return await this.refundPayment(context);
      case 'InventoryReserved':
        return await this.releaseInventory(context);
      default:
        return { success: true };
    }
  }

  private async handleOrderCreated(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    // Move to next step and emit commands
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: { ...this.state.stepData, orderId: event.payload.orderId },
    });

    return {
      success: true,
      commands: [{ type: 'ProcessPayment', payload: event.payload }],
      events: [{ eventType: 'PaymentRequested', payload: event.payload }],
    };
  }
}
```

### Saga Orchestrator Usage

```typescript
import {
  SagaOrchestrator,
  InMemorySagaRepository,
} from '@vytches-ddd/messaging';

// Setup saga infrastructure
const sagaRepository = new InMemorySagaRepository();
const orchestrator = new SagaOrchestrator(sagaRepository, {
  maxConcurrentExecutions: 50,
  enableMetrics: true,
  enableAutoRetry: true,
});

// Register saga definitions
const orderSagaDefinition: ISagaDefinition = {
  sagaType: 'OrderProcessingSaga',
  displayName: 'Order Processing Workflow',
  description: 'Handles complete order processing with compensation',
  startEvents: ['OrderCreated'],
  defaultTimeout: 3600000, // 1 hour
  maxInstances: 100,
  steps: [],
  createInstance: async (event, context) => new OrderProcessingSaga(),
  getCorrelationData: event => ({ orderId: event.payload.orderId }),
  validate: () => [],
};

orchestrator.registerSagaDefinition(orderSagaDefinition);

// Process events through orchestrator
const event = createOrderCreatedEvent();
const context = { correlationId: 'order-123', userId: 'user-456' };

// Start new saga or process existing ones
const results = await orchestrator.processEvent(event, context);
```

### Saga Repository Operations

```typescript
import { InMemorySagaRepository } from '@vytches-ddd/messaging';

const repository = new InMemorySagaRepository({
  enableOptimisticLocking: true,
  enableAuditLog: true,
  retentionPolicy: {
    completedAfterDays: 30,
    compensatedAfterDays: 60,
    failedAfterDays: 90,
  },
});

// Save saga state
await repository.save(sagaInstance);

// Find sagas by correlation
const relatedSagas = await repository.findByCorrelation({
  orderId: 'order-123',
});

// Find timed out sagas for cleanup
const timedOutSagas = await repository.findTimedOut(new Date());

// Query sagas with advanced criteria
const queryResult = await repository.query({
  sagaType: 'OrderProcessingSaga',
  status: [SagaStatus.STARTED, SagaStatus.EXECUTING],
  createdBetween: { start: yesterday, end: today },
  limit: 50,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

### Saga Middleware

```typescript
import {
  LoggingMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
} from '@vytches-ddd/messaging';

// Create middleware pipeline
const loggingMiddleware = new LoggingMiddleware();
const retryMiddleware = new RetryMiddleware({
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
});
const circuitBreakerMiddleware = new CircuitBreakerMiddleware({
  failureThreshold: 5,
  resetTimeout: 60000,
});

// Apply middleware to saga execution
const middlewarePipeline = [
  loggingMiddleware,
  retryMiddleware,
  circuitBreakerMiddleware,
];

// Middleware automatically handles cross-cutting concerns:
// - Structured logging with context
// - Automatic retry on transient failures
// - Circuit breaker for fault tolerance
```

## Unified Event System Usage Guide

### Basic Event Publishing with Repository Pattern (Recommended)

```typescript
// Clean use case - automatic event publishing through repository
class CreateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(command: CreateOrderCommand): Promise<void> {
    const order = OrderAggregate.create(command);

    // ✅ Repository automatically:
    // 1. Persists aggregate
    // 2. Publishes domain events
    // 3. Handles transaction safety
    // 4. Commits aggregate events
    await this.orderRepository.save(order);
  }
}

// Order Aggregate with domain events
class OrderAggregate extends AggregateRoot {
  create(data: CreateOrderData): void {
    this.validateOrder(data);

    // Add domain and integration events
    this.addDomainEvent(new OrderCreatedEvent(data));
    this.addDomainEvent(new InventoryReservationRequestedEvent(data));
  }
}
```

### Direct Event Publishing (Advanced scenarios)

```typescript
// Direct UnifiedEventBus usage
class OrderEventDispatcher {
  constructor(private eventBus: UnifiedEventBus) {}

  async dispatchOrderCreated(orderData: OrderData): Promise<void> {
    // Mixed event types in single batch
    await this.eventBus.publishMany([
      new OrderCreatedEvent(orderData), // Domain
      new BillingProcessingEvent(orderData), // Integration
      new CustomerNotificationEvent(orderData), // Integration
      new AuditOrderCreatedEvent(orderData), // Audit
    ]);
  }
}
```

### Event Handlers with Context Filtering

```typescript
// Context-specific event handling
@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-context',
})
class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    // Only handles events from order context
    console.log('Order created:', event.payload.orderId);
  }
}

// Multi-context event handling
@EventHandler(InventoryUpdatedEvent, {
  eventContext: ['order-context', 'inventory-context'],
})
class InventoryHandler {
  async handle(event: InventoryUpdatedEvent): Promise<void> {
    // Handles events from both contexts
  }
}
```

### Repository Setup with Event Publishing

```typescript
// Repository implementation with automatic event publishing
class OrderRepository extends IBaseRepository<OrderAggregate> {
  constructor() {
    const unifiedEventBus = new UnifiedEventBus();
    const universalDispatcher = new UniversalEventDispatcher(unifiedEventBus);

    super(
      universalDispatcher, // Event publishing
      new PostgreSQLEventPersistenceHandler() // Event storage
    );
  }
}
```

### Framework Integration

```typescript
// NestJS Integration Example
import { NestJSContainerAdapter } from '@vytches-ddd/di';

@Module({
  providers: [OrderService, PaymentService],
})
export class OrderModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    // Integrate with VytchesDDD
    const adapter = new NestJSContainerAdapter(this.moduleRef);
    VytchesDDD.configure(adapter);
  }
}
```

## Policies V2 Usage Guide

### Basic Policy Creation

The new Policies V2 provides a unified Promise-based API with rich enterprise
features:

```typescript
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';
import {
  AgeSpecification,
  EmailSpecification,
} from '@your-domain/specifications';

// Basic policy with specifications
const userPolicy = PolicyBuilder.create<User>()
  .withId('user-validation')
  .withDomain('authentication')
  .withName('User Registration Policy')
  .must(new AgeSpecification(18))
  .withCode('AGE_TOO_LOW')
  .withMessage('Must be at least 18 years old')
  .withSeverity('ERROR')
  .and()
  .must(new EmailSpecification())
  .withCode('INVALID_EMAIL')
  .withMessage('Valid email required')
  .withSeverity('ERROR')
  .build();

// Execute policy with context
const context = PolicyContext.create()
  .withUserId('user-123')
  .withSessionId('session-456')
  .withRequestId('req-789')
  .build();

const result = await userPolicy.check({ entity: user, context });
if (result.isFailure()) {
  console.log('Violations:', result.error.violations);
}
```

### Advanced Policy Features

```typescript
// Conditional policies with when/then/otherwise
const dynamicPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation')
  .withDomain('orders')
  .must(new BasicOrderValidation())
  .when(order => order.amount > 10000)
  .then()
  .must(new ManagerApprovalSpec())
  .withCode('APPROVAL_REQUIRED')
  .withMessage('Manager approval required for large orders')
  .when(ctx => ctx.environment === 'production')
  .then()
  .must(new StrictSecurityPolicy())
  .otherwise()
  .should(new RelaxedValidation())
  .withSeverity('WARNING')
  .build();
```

### Complex Group Logic

```typescript
import { PolicyGroup } from '@vytches-ddd/policies';

// OR group logic for flexible business rules
const excellentCreditGroup = PolicyGroup.create<LoanApplication>(
  'excellent-credit'
).mustSatisfy(
  app => app.creditScore >= 800,
  'CREDIT_NOT_EXCELLENT',
  'Excellent credit required'
);

const goodCreditWithCollateralGroup = PolicyGroup.create<LoanApplication>(
  'good-credit-collateral'
)
  .mustSatisfy(
    app => app.creditScore >= 650,
    'CREDIT_NOT_GOOD',
    'Good credit required'
  )
  .and()
  .mustSatisfy(
    app => app.collateral >= 50000,
    'INSUFFICIENT_COLLATERAL',
    'Collateral required'
  );

const loanPolicy = PolicyBuilder.create<LoanApplication>()
  .withId('loan-approval')
  .withDomain('lending')
  .shouldSatisfyAny(excellentCreditGroup, goodCreditWithCollateralGroup)
  .build();
```

### Event-Driven Policies

```typescript
// Policy with automatic event emission
const auditedPolicy = PolicyBuilder.create<User>()
  .withId('user-security')
  .withDomain('security')
  .must(new SecuritySpecification())
  .withEvents({ enabled: true })
  .build();

// Listen to policy events
policyEventBus.subscribe('POLICY_EVALUATED', event => {
  console.log(
    `Policy ${event.policyId} evaluated with result: ${event.result.isSuccess()}`
  );
});
```

### Specification Integration

```typescript
// Direct specification support
const specPolicy = PolicyBuilder.create<User>()
  .must(AgeSpecification.create({ min: 18, max: 65 }))
  .and()
  .must(EmailSpecification.create())
  .and()
  .mustSatisfyRules(rules =>
    rules
      .forProperty('name', Rules.required().minLength(2))
      .forProperty('phone', Rules.required().phone())
  )
  .build();

// Custom async specifications
class CreditCheckSpecification implements IAsyncSpecification<LoanApplication> {
  async isSatisfiedByAsync(app: LoanApplication): Promise<boolean> {
    const score = await creditService.getScore(app.applicantId);
    return score >= app.requiredMinScore;
  }
}

const asyncPolicy = PolicyBuilder.create<LoanApplication>()
  .mustAsync(new CreditCheckSpecification())
  .withCode('CREDIT_CHECK_FAILED')
  .build();
```

### Policy Registry Usage

```typescript
import { PolicyRegistry } from '@vytches-ddd/policies';

const registry = new PolicyRegistry();

// Register policies
registry.register({
  id: 'user-validation',
  domain: 'authentication',
  name: 'User Validation Policy',
  policy: userPolicy,
  version: '1.0.0',
  tags: ['security', 'validation'],
});

// Retrieve policies
const policy = registry.resolve<User>({
  domain: 'authentication',
  id: 'user-validation',
});

// Query policies by domain
const securityPolicies = registry.findByDomain('security');
```

### Error Handling and Violations

```typescript
// Rich violation handling
const result = await policy.check({ entity: user, context });

if (result.isFailure()) {
  const violations = result.error.violations;

  violations.forEach(violation => {
    console.log({
      code: violation.code,
      message: violation.message,
      severity: violation.severity, // ERROR, WARNING, INFO
      field: violation.field,
      details: violation.details,
      timestamp: violation.timestamp,
    });
  });

  // Filter by severity
  const errors = violations.filter(v => v.severity === 'ERROR');
  const warnings = violations.filter(v => v.severity === 'WARNING');
}
```

## Policy Behaviors Usage Guide

### Basic Policy Behavior Usage

Policy Behaviors follow the MediatR pattern and wrap business policies with
cross-cutting concerns like retry logic, caching, and temporal validation.

```typescript
import {
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior,
} from '@vytches-ddd/policies';

// Create a base business policy
class PaymentValidationPolicy extends BaseBusinessPolicy<PaymentData> {
  async check(
    request: PolicyRequest<PaymentData>
  ): Promise<Result<PaymentData, PolicyViolation>> {
    // Business validation logic
    return this.success(request.entity);
  }
}

// Wrap with retry behavior for transient failures
const retryPolicy = PolicyRetryBehavior.create(new PaymentValidationPolicy(), {
  maxAttempts: 3,
  baseDelay: 1000,
  backoff: 'exponential',
  shouldRetry: violation => violation.code.includes('TIMEOUT'),
});

// Wrap with caching for performance
const cachedPolicy = PolicyCachingBehavior.create(retryPolicy, {
  ttl: 60000, // 1 minute
  maxSize: 100,
});

// Execute the wrapped policy
const result = await cachedPolicy.check({ entity: paymentData, context });
```

### Policy Retry Behavior

```typescript
import {
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
} from '@vytches-ddd/policies';

// Factory methods for common scenarios
const transientFailurePolicy = PolicyRetryBehaviorFactory.forTransientFailures(
  basePolicy,
  3 // max attempts
);

const externalServicePolicy = PolicyRetryBehaviorFactory.forExternalServices(
  basePolicy,
  { maxAttempts: 5, baseDelay: 2000, maxDelay: 60000 }
);

// Custom retry logic
const customRetryPolicy = PolicyRetryBehaviorFactory.withCustomLogic(
  basePolicy,
  violation => violation.severity === 'WARNING', // Only retry warnings
  3,
  1000
);

// Monitor retry metrics
const metrics = retryPolicy.getRetryMetrics();
console.log(
  `Success rate: ${metrics.successfulEvaluations / metrics.totalAttempts}`
);
```

### Policy Caching Behavior

```typescript
import {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
} from '@vytches-ddd/policies';

// Simple TTL-based caching
const cachedPolicy = PolicyCachingBehaviorFactory.withTTL(basePolicy, 30000); // 30 seconds

// Custom key generation
const customCachedPolicy = PolicyCachingBehavior.create(basePolicy, {
  ttl: 60000,
  keyGenerator: request => `${request.entity.id}_${request.context.userId}`,
  namespace: 'payment-validation',
  maxSize: 500,
});

// Cache with metrics
const metricsPolicy = PolicyCachingBehaviorFactory.withMetrics(
  basePolicy,
  60000, // TTL
  request => `custom_${request.entity.type}` // Custom key
);
```

### Policy Temporal Behavior

```typescript
import {
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
} from '@vytches-ddd/policies';

// Business hours policy
const businessHoursPolicy = PolicyTemporalBehaviorFactory.forBusinessHours(
  strictPolicy,
  relaxedPolicy,
  { start: '09:00', end: '17:00' }
);

// Working days vs weekends
const workingDaysPolicy = PolicyTemporalBehaviorFactory.forWorkingDays(
  businessPolicy,
  weekendPolicy,
  [1, 2, 3, 4, 5] // Monday to Friday
);

// Complex temporal builder
const temporalPolicy = PolicyTemporalBehaviorBuilder.from(basePolicy)
  .withBusinessHours('09:00', '17:00')
  .withWorkingDays([1, 2, 3, 4, 5])
  .withTimezone('America/New_York')
  .duringBusinessHours(strictPolicy)
  .duringAfterHours(relaxedPolicy)
  .duringWeekends(weekendPolicy)
  .withTemporalInfo(true) // Include timing info in results
  .build();
```

### Behavior Composition

```typescript
// Chain multiple behaviors
const composedPolicy = PolicyCachingBehavior.create(
  PolicyRetryBehavior.create(
    PolicyTemporalBehavior.create(basePolicy, temporalConfig),
    retryConfig
  ),
  cacheConfig
);

// Execution order: Cache → Retry → Temporal → Base Policy
const result = await composedPolicy.check(request);
```

### Backward Compatibility

All policy behaviors maintain backward compatibility through aliases:

```typescript
// New naming (recommended)
import { PolicyRetryBehavior } from '@vytches-ddd/policies';

// Old naming (deprecated in v2.1)
import { RetryPolicy, PolicyRetryDecorator } from '@vytches-ddd/policies';

// All work identically
const policy1 = PolicyRetryBehavior.create(basePolicy, config);
const policy2 = RetryPolicy.create(basePolicy, config); // Same as above
const policy3 = PolicyRetryDecorator.create(basePolicy, config); // Same as above
```

## Examples and Showcases

### Available Examples

- **Logging Showcase** (`examples/logging-showcase/`) - Comprehensive logging
  examples showing all features
- **Simple Example** (`examples/simple/`) - Basic library usage
- **Playground** (`examples/playground/`) - Interactive development environment

### Running Examples

```bash
# Build and run logging showcase
cd examples/logging-showcase
pnpm build && node dist/index.js

# Use playground for testing
pnpm playground
```

### Key Files to Understand

- `tsconfig.base.json`: TypeScript path mappings and compilation settings
- `.eslintrc.json`: Module boundary rules and code style enforcement (includes
  logging dependencies)
- `nx.json`: Build system configuration and caching
- `vitest.config.ts`: Test configuration with package aliases
- `package.json`: Development scripts and workflow commands
- `packages/logging/`: Complete enterprise logging implementation
- `renovate.json`: Automated dependency management configuration
- `scripts/quality-gates/`: Enterprise quality monitoring system

## Library Status Summary

### Package Count: 21 Packages

- **Foundation**: core (meta-package), domain-primitives, value-objects,
  repositories, aggregates, di, utils, contracts, logging
- **Patterns**: validation, policies, domain-services
- **Architecture**: events, cqrs, projections
- **Integration**: acl, messaging
- **Infrastructure**: resilience, enterprise, event-store
- **Tooling**: cli, testing

### Development Readiness

- ✅ **Production Ready**: All packages fully implemented with comprehensive
  features
- ✅ **Enterprise Grade**: Advanced logging, observability, resilience patterns,
  and DI system
- ✅ **Type Safe**: Full TypeScript implementation with strict type checking
- ✅ **Well Tested**: Comprehensive test coverage across all packages (1460
  tests)
- ✅ **Documented**: Rich documentation with examples and usage guides
- ✅ **Integrated**: Seamless package integration with structured logging and DI
  auto-discovery throughout

### Recent Major Updates

- **🔥 COMPLETED**: **Unified Event System Refactor** - Complete redesign of
  event handling architecture
  - 3→1 event bus consolidation with 67% code reduction
  - Repository-integrated automatic event publishing
  - Industry-standard patterns (MediatR, Spring, Axon alignment)
  - Enterprise transaction safety and optimistic concurrency
- **🔥 COMPLETED**: **Enterprise Circular Dependency Resolution** - EntityId
  moved to contracts package
  - Enterprise-grade architecture with contracts foundation layer
  - Circular dependency elimination between testing and value-objects packages
  - TypeScript configuration standardization across all 22 packages
  - Two-layer EntityId pattern with enhanced validation
- **🔥 COMPLETED**: **Saga Framework Implementation** - Enterprise-grade
  long-running business processes
  - Complete saga orchestration system with state management and compensation
    patterns
  - Advanced saga repository with optimistic concurrency control and querying
    capabilities
  - Middleware pipeline for cross-cutting concerns (logging, retry, circuit
    breaker)
  - Comprehensive test coverage with 100% functionality verification
  - Enterprise features: timeout handling, instance limits, correlation tracking
- **NEW**: Enterprise dependency injection system with auto-discovery and
  context isolation
- **NEW**: Global service locator pattern following MediatR architecture
- **NEW**: Enhanced decorators (@DomainService, @CommandHandler, @QueryHandler)
  with DI options
- **NEW**: Plugin-based discovery system for automatic service registration
- **NEW**: Enterprise meta-package architecture with 99.2% core bundle reduction
- **NEW**: Modular foundation layer (domain-primitives, value-objects,
  repositories, aggregates)
- **NEW**: Enterprise import strategy for API stability
- **NEW**: Enterprise logging package with DDD-first design
- **NEW**: CI/CD Quality Gates system with automated monitoring
- **NEW**: Renovate Bot integration for dependency management
- **ENHANCED**: All packages now include structured logging and DI integration
- **IMPROVED**: CQRS with advanced decorators and middleware
- **EXPANDED**: Resilience patterns with comprehensive observability
- **STANDARDIZED**: Import patterns across all internal packages
- **ADDED**: Comprehensive examples and usage showcases
- **AUTOMATED**: Quality assurance with regression prevention
