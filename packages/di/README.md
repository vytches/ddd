# @vytches/ddd-di

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-di.svg)](https://badge.fury.io/js/%40vytches%2Fddd-di)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade dependency injection system for Domain-Driven Design**

Global Service Locator with Optional Context Isolation for Dependency Injection
following MediatR pattern.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Service Registration](#service-registration)
- [Auto-Discovery](#auto-discovery)
- [Context Isolation](#context-isolation)
- [Framework Integration](#framework-integration)
- [Advanced Features](#advanced-features)
- [Testing](#testing)
- [Performance](#performance)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-di

# yarn
yarn add @vytches/ddd-di

# pnpm
pnpm add @vytches/ddd-di
```

## ✨ Key Features

### Hybrid Dependency Injection Architecture

The `@vytches/ddd-di` package implements a **hybrid dependency injection
architecture** that provides:

1. **Global service locator by default** (following MediatR pattern)
2. **Optional context isolation** for DDD bounded context scenarios
3. **Framework-agnostic container integration** through adapter pattern
4. **Plugin-based handler discovery** for CQRS, Events, and custom handlers
5. **Progressive enhancement** from simple to complex scenarios

This implementation follows **ADR-0006: Adopt Global Service Locator with
Optional Context Isolation for Dependency Injection**.

## Philosophy: Natural Framework Integration

VytchesDDD DI **enhances** your existing DI framework rather than replacing it.
Your application code continues to use natural dependency injection patterns,
while VytchesDDD components can leverage service location internally when
beneficial.

## Quick Start

### Natural NestJS Integration

```typescript
// Your services use natural NestJS patterns
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository, // Natural DI
    private readonly emailService: EmailService, // Natural DI
    private readonly commandBus: ICommandBus // VytchesDDD component
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(new User(userData));
    await this.emailService.sendWelcomeEmail(user.email);

    // VytchesDDD handles complex routing internally
    await this.commandBus.execute(new UserCreatedCommand(user.id));

    return user;
  }
}

// VytchesDDD components can use service locator internally
@CommandHandler(ProcessComplexBusinessLogicCommand)
export class ComplexBusinessLogicHandler {
  async handle(command: ProcessComplexBusinessLogicCommand): Promise<void> {
    // Service locator useful for complex handlers with many dependencies
    const serviceA = VytchesDDD.resolve<ServiceA>('ServiceA');
    const serviceB = VytchesDDD.resolve<ServiceB>('ServiceB');
    // Complex business logic...
  }
}
```

### Context-Enhanced Usage (DDD scenarios)

```typescript
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

// Setup global container
const globalContainer = new SimpleContainer();
globalContainer.register('EmailService', EmailService);

// Setup context-specific container
const orderContainer = new SimpleContainer();
orderContainer.register('SpecialOrderService', SpecialOrderService);

// Configure both containers
VytchesDDD.configure(globalContainer);
VytchesDDD.configureContext('OrderManagement', orderContainer);

// Smart resolution - context-aware when available, global otherwise
const emailService = VytchesDDD.resolve<EmailService>('EmailService'); // From global
const orderService = VytchesDDD.resolve<SpecialOrderService>(
  'SpecialOrderService',
  'OrderManagement'
); // From context
```

## Core Components

### IDependencyContainer Interface

Framework-agnostic container interface that all adapters implement:

```typescript
interface IDependencyContainer {
  resolve<T>(token: ServiceToken<T>): T;
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void;
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void;
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void;
  isRegistered<T>(token: ServiceToken<T>): boolean;
  getServices(): ServiceDescriptor[];
  createScope?(context?: string): IDependencyContainer;
  dispose?(): void;
}
```

### Service Lifetimes

```typescript
enum ServiceLifetime {
  Transient = 'transient', // New instance each time
  Singleton = 'singleton', // Single instance shared
  Scoped = 'scoped', // Instance scoped to context
}
```

### VytchesDDD Service Locator

Global facade providing enterprise-grade service resolution:

```typescript
class VytchesDDD {
  static configure(container: IDependencyContainer): void;
  static configureContext(
    contextName: string,
    container: IDependencyContainer
  ): void;
  static resolve<T>(token: ServiceToken<T>, context?: string): T;
  static isRegistered<T>(token: ServiceToken<T>, context?: string): boolean;

  // Plugin-based handler discovery
  static registerDiscoveryPlugin(plugin: IHandlerDiscoveryPlugin): void;
  static discoverAndRegisterHandlers(assemblies?: any[]): Promise<void>;

  static reset(): void; // For testing
  static dispose(): void;
}
```

## Container Implementations

### SimpleContainer

Built-in container for testing and simple scenarios:

```typescript
import { SimpleContainer, ServiceLifetime } from '@vytches/ddd-di';

const container = new SimpleContainer();

// Register transient service
container.register('UserService', UserService);

// Register singleton service
container.register('EmailService', EmailService, {
  lifetime: ServiceLifetime.Singleton,
});

// Register with factory
container.registerFactory('DatabaseService', c => {
  const config = c.resolve<Config>('Config');
  return new DatabaseService(config.connectionString);
});

// Register instance
container.registerInstance('Config', { connectionString: 'localhost' });
```

### Container Builder (Fluent API)

```typescript
import { ContainerBuilder, ServiceLifetime } from '@vytches/ddd-di';

const container = new ContainerBuilder()
  .register('UserRepository', UserRepository, {
    lifetime: ServiceLifetime.Singleton,
    tags: ['repository', 'domain'],
  })
  .register('EmailService', EmailService, {
    lifetime: ServiceLifetime.Singleton,
    tags: ['service', 'infrastructure'],
  })
  .registerFactory(
    'UserService',
    c => {
      const userRepo = c.resolve<UserRepository>('UserRepository');
      const emailService = c.resolve<EmailService>('EmailService');
      return new UserService(userRepo, emailService);
    },
    {
      tags: ['service', 'application'],
    }
  )
  .build();
```

## Framework Integration Adapters

**Note**: Framework adapters are documented as conceptual examples in separate
.md files. The DI package provides the `BaseContainerAdapter` foundation without
installing external dependencies.

### Available Adapter Documentation

See the following documentation files for framework integration patterns:

- `docs/INVERSIFY-INTEGRATION.md` - InversifyJS integration patterns
- `docs/TSYRINGE-INTEGRATION.md` - TSyringe integration patterns
- `docs/NESTJS-INTEGRATION.md` - NestJS integration patterns
- `docs/CUSTOM-ADAPTER.md` - Creating custom framework adapters

These documents provide implementation guidance without requiring external
framework installations.

## Advanced Features

### Scoped Containers

```typescript
const container = new SimpleContainer();
container.register('EmailService', EmailService);

// Create request-scoped container
const requestScope = container.createScope('request');
requestScope.registerInstance(
  'RequestContext',
  new RequestContext(userId, requestId)
);

// Services in scope can access both scoped and parent services
const requestService = requestScope.resolve<RequestService>('RequestService');
```

### Service Tags and Metadata

```typescript
container.register('UserRepository', UserRepository, {
  tags: ['repository', 'domain', 'user-context'],
  context: 'UserManagement',
});

// Query by tag
const repositories = container.getServicesByTag('repository');
const domainServices = container.getServicesByTag('domain');
```

## Plugin-Based Handler Discovery

The DI package uses a clean plugin architecture to discover handlers from
different packages **without creating circular dependencies**:

### Core Architecture

```typescript
// DI package provides interfaces - NO dependencies on CQRS/Events
interface IHandlerDiscoveryPlugin {
  readonly name: string;
  discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> | HandlerInfo[];
  isAvailable(): boolean;
}

interface HandlerInfo {
  type: 'command' | 'query' | 'event';
  messageType: Constructor;
  handlerType: Constructor;
  metadata: any;
}
```

### CQRS Plugin Integration (✅ Implemented)

```typescript
import { VytchesDDD } from '@vytches/ddd-di';
import { CQRSDiscoveryPlugin } from '@vytches/ddd-cqrs';

// Register the CQRS plugin
VytchesDDD.registerDiscoveryPlugin(new CQRSDiscoveryPlugin());

// Auto-discover and register all CQRS handlers
await VytchesDDD.discoverAndRegisterHandlers();
```

### Enhanced CQRS Decorators with DI Support (✅ Implemented)

```typescript
// Enhanced existing decorators with DI options
@CommandHandler(CreateOrderCommand, {
  lifetime: 'singleton', // DI service lifetime
  context: 'OrderManagement', // DI context isolation
  tags: ['order', 'business'], // Service tags
  autoRegister: true, // Auto-register with DI (default)
})
export class CreateOrderCommandHandler {
  async handle(command: CreateOrderCommand): Promise<void> {
    // Handler automatically resolved from DI container when command executes
    // Dependencies can be injected via constructor or service locator
    const orderService = VytchesDDD.resolve<OrderService>('OrderService');
    const paymentService = VytchesDDD.resolve<PaymentService>('PaymentService');

    // Business logic with automatic DI resolution
    await orderService.validateOrder(command.orderId);
    await paymentService.processPayment(command.paymentDetails);
  }
}

// Query handlers also support DI options
@QueryHandler(GetOrderQuery, {
  lifetime: 'transient',
  context: 'OrderManagement',
  tags: ['query', 'order'],
})
export class GetOrderQueryHandler {
  async handle(query: GetOrderQuery): Promise<Order> {
    const repository = VytchesDDD.resolve<OrderRepository>('OrderRepository');
    return await repository.findById(query.orderId);
  }
}
```

## Error Handling

The package provides specific error types for different failure scenarios:

```typescript
import {
  ServiceNotFoundError,
  CircularDependencyError,
  ServiceAlreadyRegisteredError,
  ContainerConfigurationError,
  ContainerDisposedError,
} from '@vytches/ddd-di';

try {
  const service = VytchesDDD.resolve<UnknownService>('UnknownService');
} catch (error) {
  if (error instanceof ServiceNotFoundError) {
    console.log(`Service not found: ${error.message}`);
  }
}
```

## Testing Support

### Test Isolation

```typescript
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

describe('UserService', () => {
  let container: SimpleContainer;

  beforeEach(() => {
    container = new SimpleContainer();

    // Register mocks
    container.registerInstance('UserRepository', mockUserRepository);
    container.registerInstance('EmailService', mockEmailService);

    VytchesDDD.configure(container);
  });

  afterEach(() => {
    VytchesDDD.reset(); // Clean global state
    container.dispose();
  });

  it('should create user', () => {
    const userService = VytchesDDD.resolve<UserService>('UserService');
    // Test implementation...
  });
});
```

### Mock Registration

```typescript
const mockRepository = {
  findById: vi.fn().mockResolvedValue({ id: '1', name: 'Test User' }),
  save: vi.fn().mockResolvedValue(true),
};

container.registerInstance('UserRepository', mockRepository);
```

## Package Integration Strategy

This package implements a **unified dependency injection system** that replaces
legacy registry patterns with decorator-based auto-discovery:

### Registry Pattern Replacements

| Legacy Pattern                   | New DI Approach                                       | Status         |
| -------------------------------- | ----------------------------------------------------- | -------------- |
| **CQRSMetadataRegistry**         | Enhanced `@CommandHandler`/`@QueryHandler` decorators | ✅ Complete    |
| **EventBusRegistry**             | `@EventHandler` decorator with auto-discovery         | 🚧 In Progress |
| **DefaultDomainServiceRegistry** | `@DomainService` decorator                            | 🚧 Planned     |
| **PolicyRegistry**               | `@Policy` decorator with domain scoping               | 🚧 Planned     |
| **ACLRegistry**                  | `@ACLAdapter` decorator                               | 🚧 Planned     |
| **ProjectionRegistry**           | `@ProjectionEngine` decorator                         | 🚧 Planned     |
| **MetricRegistry**               | `@MetricCollector` decorator                          | 🚧 Planned     |

### Implementation Example

**New DI Approach (✅ Implemented for CQRS):**

```typescript
// Enhanced decorator-based system with auto-discovery
@CommandHandler(CreateOrderCommand, {
  context: 'orders',
  lifetime: 'singleton',
  autoRegister: true,
  tags: ['order', 'business'],
})
export class CreateOrderCommandHandler {
  async handle(command: CreateOrderCommand): Promise<void> {
    // Automatic service resolution via DI service locator
    const policy = VytchesDDD.resolve<CanCreateOrderPolicy>(
      'CanCreateOrderPolicy'
    );
    const eventBus = VytchesDDD.resolve<OrderEventBus>('OrderEventBus');

    // Business logic with automatic DI resolution
    await policy.validate(command);
    const order = new Order(command.orderData);
    await eventBus.publish(new OrderCreatedEvent(order));
  }
}

// One-time setup with auto-discovery
const container = new SimpleContainer();
container.register('CanCreateOrderPolicy', CanCreateOrderPolicy, {
  context: 'orders',
});
container.register('OrderEventBus', OrderEventBus, { context: 'OrderContext' });

VytchesDDD.configure(container);
VytchesDDD.registerDiscoveryPlugin(new CQRSDiscoveryPlugin());
await VytchesDDD.discoverAndRegisterHandlers(); // All decorated handlers auto-registered
```

### Benefits of New Approach

1. **Zero Configuration**: Decorators eliminate manual registration
2. **Auto-Discovery**: Components automatically discovered through metadata
3. **Unified API**: Consistent pattern across all package types
4. **Context Isolation**: Built-in bounded context support
5. **Framework Integration**: Works with existing DI containers

## Performance Considerations

- **Lazy Resolution**: Services resolved only when needed
- **Singleton Caching**: Singleton instances cached for performance
- **Minimal Runtime Overhead**: Lightweight service resolution algorithm
- **Tree-Shaking Friendly**: Unused handlers eliminated at build time

## Best Practices

### 1. Application Services: Use Framework's Natural DI

```typescript
// ✅ Good: Natural NestJS patterns for your services
@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository, // Framework DI
    private readonly paymentService: PaymentService, // Framework DI
    private readonly commandBus: ICommandBus // VytchesDDD component
  ) {}
}

// ❌ Bad: Service locator in application code
@Injectable()
export class OrderService {
  async processOrder() {
    const repository = VytchesDDD.resolve<OrderRepository>('OrderRepository');
    const payment = VytchesDDD.resolve<PaymentService>('PaymentService');
  }
}
```

### 2. VytchesDDD Components: Can Use Service Locator

```typescript
// ✅ Good: Service locator in VytchesDDD handlers when beneficial
@CommandHandler(ComplexBusinessCommand)
export class ComplexBusinessCommandHandler {
  async handle(command: ComplexBusinessCommand): Promise<void> {
    // Many dependencies - service locator can be cleaner
    const serviceA = VytchesDDD.resolve<ServiceA>('ServiceA');
    const serviceB = VytchesDDD.resolve<ServiceB>('ServiceB');
    const serviceC = VytchesDDD.resolve<ServiceC>('ServiceC');
  }
}

// ✅ Also good: Constructor injection for VytchesDDD handlers
@CommandHandler(SimpleBusinessCommand)
export class SimpleBusinessCommandHandler {
  constructor(
    private readonly domainService: DomainService,
    private readonly repository: Repository
  ) {}
}
```

### 3. Use Contexts for True Domain Boundaries

```typescript
// ✅ Good: Context isolation for bounded contexts
VytchesDDD.configureContext('OrderManagement', orderContainer);
VytchesDDD.configureContext('UserManagement', userContainer);

// Different implementations per context
@CommandHandler(ProcessPaymentCommand, { context: 'OrderManagement' })
export class OrderPaymentHandler {
  async handle(command: ProcessPaymentCommand): Promise<void> {
    // Uses Stripe payment processor (registered in OrderManagement context)
    const processor = VytchesDDD.resolve<PaymentProcessor>('PaymentProcessor');
  }
}
```

### 4. Integration Over Replacement

```typescript
// ✅ Good: Enhance existing DI, don't replace it
@Module({
  imports: [VytchesDDDModule], // Add VytchesDDD capabilities
  providers: [
    UserService, // Keep natural NestJS patterns
    UserRepository, // Keep natural NestJS patterns
    {
      provide: 'ICommandBus', // Register VytchesDDD components
      useClass: CommandBus,
    },
  ],
})
export class UserModule {}
```

## TypeScript Support

Full TypeScript support with generic type resolution:

```typescript
// Type-safe resolution
const userService = VytchesDDD.resolve<UserService>('UserService');
const repository = VytchesDDD.resolve<IUserRepository>('IUserRepository');

// Type-safe registration
container.register<IUserService>('IUserService', UserService);
container.registerFactory<IDatabaseService>('IDatabaseService', createDatabase);
```

## When to Use Service Locator vs Constructor Injection

### ✅ Use Constructor Injection (Preferred)

**Application Services, Controllers, Infrastructure:**

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService
  ) {}
}
```

**Simple VytchesDDD Handlers:**

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  constructor(
    private readonly userService: UserService,
    private readonly eventBus: IEventBus
  ) {}
}
```

### ✅ Use Service Locator (When Beneficial)

**Complex Handlers with Many Dependencies:**

```typescript
@CommandHandler(ComplexBusinessProcessCommand)
export class ComplexBusinessProcessHandler {
  async handle(command: ComplexBusinessProcessCommand): Promise<void> {
    // 8+ dependencies would make constructor unwieldy
    const serviceA = VytchesDDD.resolve<ServiceA>('ServiceA');
    const serviceB = VytchesDDD.resolve<ServiceB>('ServiceB');
    const serviceC = VytchesDDD.resolve<ServiceC>('ServiceC');
    // ... more services
  }
}
```

**Context-Dependent Resolution:**

```typescript
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler {
  async handle(command: ProcessPaymentCommand): Promise<void> {
    // Different payment processor per context
    const processor = VytchesDDD.resolve<PaymentProcessor>(
      'PaymentProcessor',
      command.context
    );
  }
}
```

**Conditional Dependencies:**

```typescript
@CommandHandler(ProcessOrderCommand)
export class ProcessOrderHandler {
  async handle(command: ProcessOrderCommand): Promise<void> {
    // Resolve different services based on business logic
    const processor = command.isExpress
      ? VytchesDDD.resolve<ExpressProcessor>('ExpressProcessor')
      : VytchesDDD.resolve<StandardProcessor>('StandardProcessor');
  }
}
```

## Integration with VytchesDDD Ecosystem

The DI package integrates seamlessly with other VytchesDDD packages:

- **@vytches/ddd-cqrs**: Command/Query handlers use service locator internally
  for routing
- **@vytches/ddd-events**: Event bus and handler registration with context
  awareness
- **@vytches/ddd-domain-services**: Domain service registration and
  context-aware resolution
- **@vytches/ddd-logging**: Structured logging throughout DI operations
- **@vytches/ddd-validation**: Validator service registration with context
  support

## Roadmap

### ✅ Phase 1: Core Infrastructure (Complete)

- ✅ IDependencyContainer interface and adapter pattern
- ✅ VytchesDDD service locator with global and context support
- ✅ Simple container implementation
- ✅ Framework adapter documentation
- ✅ **Automatic handler discovery** - CQRSDiscoveryPlugin implemented

### ✅ Phase 2: CQRS Integration (Complete)

- ✅ Integration with existing @CommandHandler/@QueryHandler/@EventHandler
  decorators
- ✅ Enhanced decorator options for DI context and dependency specification
- ✅ Metadata-based handler registration with existing CQRS infrastructure
- ✅ Automatic service resolution within handlers
- ✅ CQRSDiscoveryPlugin for automatic handler discovery
- ✅ CommandBus/QueryBus DI container integration

### ✅ Phase 3: Framework Component Refactoring (Complete)

- ✅ CommandBus refactoring to use service locator
- ✅ QueryBus and EventBus integration
- ✅ Domain service registration migration
- ✅ Legacy registry removal
- ✅ Plugin-based handler discovery system
- ✅ Automatic handler registration with DI containers

### 🚧 Phase 4: Enhanced Documentation and Examples (In Progress)

- ✅ Framework integration guides as .md documentation files
- ✅ Conceptual examples for each integration pattern
- ✅ Migration guide from legacy registries
- ✅ Complete package documentation
- 🚧 **Remaining**: Update documentation to reflect Phase 2/3 completion
- 🚧 **Remaining**: Additional real-world integration examples

### 🚧 Next Implementation Phases

#### Phase 4A: Complete Event System Integration

- **EventDiscoveryPlugin**: Auto-discovery for `@EventHandler` decorators
- **Event Bus DI Integration**: Full service locator integration in event system
- **Event Context Routing**: Context-aware event handler resolution

#### Phase 4B: Domain Services Integration

- **@DomainService Decorator**: Enhanced decorator with DI options
- **Domain Service Discovery**: Auto-discovery plugin for domain services
- **Context-Aware Domain Logic**: Bounded context isolation for domain services

#### Phase 4C: Business Policies Integration

- **@Policy Decorator**: Domain-scoped policy registration
- **Policy Discovery Plugin**: Auto-discovery for business policies
- **Policy Context Resolution**: Context-specific policy resolution

#### Phase 4D: Infrastructure Integration

- **@ProjectionEngine Decorator**: Projection engine auto-discovery
- **@RuleProvider Decorator**: Validation rule auto-discovery
- **@MetricCollector Decorator**: Observability metrics auto-discovery
- **@ACLAdapter Decorator**: Anti-corruption layer adapter discovery

### 🔮 Future Enhancements

- **Advanced Scoping**: Request-scoped services and transient contexts
- **Performance Optimization**: Lazy loading and caching strategies
- **Monitoring Integration**: DI container metrics and health checks
- **Multi-Tenant Support**: Tenant-aware service resolution

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility during migrations

## License

MIT License - see LICENSE file for details.
