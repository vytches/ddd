# Domain Services in VytchesDDD

## Overview

Domain Services are a crucial tactical pattern in Domain-Driven Design (DDD)
that encapsulate domain logic which doesn't naturally fit within entities or
value objects. The VytchesDDD library provides a comprehensive, modern
implementation of domain services using decorator-based auto-discovery through
the VytchesDDD DI system.

This guide will walk you through the Domain Services module, explaining its
components, how they work together, and best practices for implementation.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Domain Service Interfaces](#domain-service-interfaces)
3. [Base Implementations](#base-implementations)
4. [Modern DI-Based Registration](#modern-di-based-registration)
5. [Decorator-Based Auto-Discovery](#decorator-based-auto-discovery)
6. [Event Integration](#event-integration)
7. [Transactional Operations](#transactional-operations)
8. [Context Isolation for DDD](#context-isolation-for-ddd)
9. [Best Practices](#best-practices)
10. [Complete Example](#complete-example)

## Concepts Overview

Before diving into implementation details, let's understand what each concept
means and when to use it:

### 1. Core Concepts

**What**: Fundamental principles and patterns of Domain Services in DDD.

**Why important**: Provides the theoretical foundation for understanding how
Domain Services fit into the broader DDD approach.

**When to use**: When starting with DDD or designing your domain model.

**Examples**:

- Implementing business rules that span multiple entities
- Coordinating operations across aggregates
- Implementing domain processes like validation, calculation, or transformation

### 2. Domain Service Interfaces

**What**: The contract definitions for domain services in your application.

**Why important**: Interfaces define capabilities, promote loose coupling, and
enable polymorphism.

**When to use**: When defining what a domain service can do or when implementing
dependency injection.

**Examples**:

- Basic service identification via `IDomainService`
- Event publication capability via `IEventBusAware`
- Transaction participation via `IUnitOfWorkAware`
- Lifecycle management via `IAsyncDomainService`

### 3. Base Implementations

**What**: Ready-to-extend abstract classes implementing the service interfaces.

**Why important**: Reduces boilerplate code and ensures consistent
implementation.

**When to use**: When creating new domain services to avoid reimplementing
common functionality.

**Examples**:

- Use `BaseDomainService` for simple services
- Use `EventAwareDomainService` for services that publish domain events
- Use `UnitOfWorkAwareDomainService` for services requiring transactional
  consistency
- Use `AsyncDomainService` for services with async initialization needs

### 4. Modern DI-Based Registration

**What**: Decorator-based service registration through VytchesDDD DI system.

**Why important**: Eliminates manual registration boilerplate and provides
auto-discovery.

**When to use**: For all domain services in modern VytchesDDD applications.

**Examples**:

- `@DomainService('userService')` for simple registration
- `@DomainService({ serviceId, context, lifetime })` for advanced scenarios
- Automatic dependency resolution and lifecycle management

### 5. Decorator-Based Auto-Discovery

**What**: Automatic service discovery and registration through decorators.

**Why important**: Zero-configuration service registration with type safety.

**When to use**: Instead of manual registry patterns for all services.

**Examples**:

- Services decorated with `@DomainService` are automatically discovered
- `VytchesDDD.configure()` finds and registers all decorated services
- Context-aware service resolution for bounded contexts

## Core Concepts

In DDD, Domain Services:

- Implement operations that involve multiple aggregates
- Represent processes or transformations that are stateless
- Encapsulate complex domain logic that doesn't belong to any specific entity
- Coordinate activities across different parts of the domain

The VytchesDDD implementation follows these principles while providing modern
infrastructure for:

- Decorator-based auto-discovery through VytchesDDD DI
- Context isolation for bounded contexts
- Integration with domain events
- Transactional consistency through Unit of Work pattern
- Framework-agnostic DI container adapters

## Domain Service Interfaces

The foundation of the Domain Services module is the `IDomainService` interface:

```typescript
interface IDomainService {
  readonly serviceId?: string;
}
```

This minimal interface is extended by more specialized interfaces:

```typescript
interface IEventBusAware {
  setEventBus(eventBus: IEventBus): void;
}

interface IUnitOfWorkAware {
  setUnitOfWork(unitOfWork: IUnitOfWork): void;
  clearUnitOfWork(): void;
}

interface IAsyncDomainService extends IDomainService {
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

These interfaces define capabilities that services can implement:

- **IEventBusAware**: For services that need to publish domain events
- **IUnitOfWorkAware**: For services that participate in transactions
- **IAsyncDomainService**: For services with asynchronous initialization/cleanup

## Base Implementations

To simplify implementation, the library provides base classes for common service
types:

```typescript
// Base class for all domain services
abstract class BaseDomainService implements IDomainService {
  constructor(public readonly serviceId: string) {}
}

// For services that publish events
abstract class EventAwareDomainService
  extends BaseDomainService
  implements IEventBusAware {
  // Implementation details...
}

// For services that need transactions
abstract class UnitOfWorkAwareDomainService
  extends EventAwareDomainService
  implements IUnitOfWorkAware {
  // Implementation details...
}

// For services with async lifecycle
abstract class AsyncDomainService
  extends BaseDomainService
  implements IAsyncDomainService {
  // Implementation details...
}
```

Choose the appropriate base class based on your service's needs. For example, if
your service needs to publish events and perform transactions, extend
`UnitOfWorkAwareDomainService`.

## Modern DI-Based Registration

**NEW**: VytchesDDD uses a modern decorator-based approach instead of manual
registries:

### Basic Service Registration

```typescript
import { DomainService } from '@vytches/ddd-domain-services';

// Simple auto-discovery
@DomainService('userService')
class UserService extends BaseDomainService {
  constructor() {
    super('userService');
  }

  async createUser(userData: UserData): Promise<User> {
    return User.create(userData);
  }
}
```

### Advanced Service Registration

```typescript
import { DomainService, ServiceLifetime } from '@vytches/ddd-domain-services';

@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['paymentService', 'inventoryService'],
  autoRegister: true,
})
class OrderService extends EventAwareDomainService {
  constructor() {
    super('orderService');
  }

  async processOrder(order: Order): Promise<OrderResult> {
    // Dependencies are automatically resolved
    const paymentService = VytchesDDD.resolve<PaymentService>('paymentService');
    return await paymentService.processPayment(order);
  }
}
```

### System Setup

```typescript
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

// One-time setup with auto-discovery
const container = new SimpleContainer();
VytchesDDD.configure(container); // Auto-discovers all decorated services

// Services are automatically available
const userService = VytchesDDD.resolve<UserService>('userService');
const orderService = VytchesDDD.resolve<OrderService>('orderService');
```

## Decorator-Based Auto-Discovery

The VytchesDDD DI system provides several decorators for service registration:

### Domain Service Decorator

```typescript
// Basic usage
@DomainService('serviceId')
class MyService extends BaseDomainService {}

// Advanced usage with all options
@DomainService({
  serviceId: 'advanced-service',
  lifetime: ServiceLifetime.Singleton,
  context: 'BoundedContext',
  dependencies: ['dependency1', 'dependency2'],
  tags: ['business', 'core'],
  autoRegister: true,
  transactional: true,
  publishesEvents: true,
  async: false,
})
class AdvancedService extends UnitOfWorkAwareDomainService {}
```

### Integration with CQRS

```typescript
import { CommandHandler, QueryHandler } from '@vytches/ddd-cqrs';

// Command handlers are also auto-discovered
@CommandHandler(CreateUserCommand, {
  context: 'UserManagement',
  timeout: 30000,
})
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    // Services resolved automatically
    const userService = VytchesDDD.resolve<UserService>('userService');
    await userService.createUser(command);
  }
}
```

## Event Integration

Domain Services can easily publish domain events using the base classes:

```typescript
@DomainService('orderProcessor')
class OrderProcessingService extends EventAwareDomainService {
  constructor() {
    super('orderProcessor');
  }

  processOrder(order: Order): void {
    // Process order logic...

    // Publish domain event
    this.publishEvent(new OrderProcessedEvent(order.id));
  }
}
```

Event buses are automatically configured by the VytchesDDD DI system when
services implement `IEventBusAware`.

## Transactional Operations

For operations that span multiple aggregates, use transactional domain services:

```typescript
@DomainService({
  serviceId: 'orderManager',
  transactional: true,
})
class OrderManagementService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('orderManager');
  }

  async transferOrderItems(
    sourceOrderId: string,
    targetOrderId: string
  ): Promise<void> {
    return this.executeInTransaction(async () => {
      const orderRepo = VytchesDDD.resolve<OrderRepository>('orderRepository');

      const sourceOrder = await orderRepo.findById(sourceOrderId);
      const targetOrder = await orderRepo.findById(targetOrderId);

      // Transfer logic...

      await orderRepo.save(sourceOrder);
      await orderRepo.save(targetOrder);
    });
  }
}
```

## Context Isolation for DDD

VytchesDDD supports bounded context isolation for large domain models:

```typescript
// Register services in specific contexts
@DomainService({
  serviceId: 'orderService',
  context: 'OrderManagement',
})
class OrderService extends BaseDomainService {}

@DomainService({
  serviceId: 'paymentService',
  context: 'PaymentProcessing',
})
class PaymentService extends BaseDomainService {}

// Setup context-specific containers
const orderContainer = new SimpleContainer();
const paymentContainer = new SimpleContainer();

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

## Best Practices

When implementing domain services with VytchesDDD:

1. **Use decorators**: Always use `@DomainService` decorator for automatic
   discovery instead of manual registration.

2. **Choose the right base class**: Select the appropriate base class based on
   your service's needs (events, transactions, async lifecycle).

3. **Keep services stateless**: Domain services should not maintain state
   between operations. Use aggregates for stateful domain concepts.

4. **Service ID conventions**: Use consistent naming for service IDs, like
   'userService' or 'orderProcessor'.

5. **Context isolation**: Use bounded context isolation for large applications
   with multiple domains.

6. **Dependency resolution**: Use `VytchesDDD.resolve()` for service
   dependencies rather than constructor injection (which is handled
   automatically).

7. **Transactional boundaries**: Use `UnitOfWorkAwareDomainService` and
   `executeInTransaction()` for cross-aggregate operations.

8. **Event publication**: Use `EventAwareDomainService` base class for services
   that need to publish domain events.

9. **Async services**: Mark services with `async: true` in decorator options if
   they need asynchronous initialization.

10. **Framework integration**: Use adapter patterns for integration with
    existing DI frameworks like NestJS or InversifyJS.

## Complete Example

Here's a complete example using the modern VytchesDDD DI approach:

```typescript
// Define domain service with decorator
@DomainService({
  serviceId: 'orderProcessor',
  context: 'OrderManagement',
  dependencies: ['orderRepository', 'paymentService'],
  transactional: true,
  publishesEvents: true,
})
class OrderProcessingService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('orderProcessor');
  }

  async processOrder(orderId: string): Promise<Result<Order, Error>> {
    return this.executeInTransaction(async () => {
      // Resolve dependencies automatically
      const orderRepository =
        VytchesDDD.resolve<OrderRepository>('orderRepository');
      const paymentService =
        VytchesDDD.resolve<PaymentService>('paymentService');

      // Retrieve order from repository
      const order = await orderRepository.findById(orderId);
      if (!order) {
        return Result.failure(new Error(`Order ${orderId} not found`));
      }

      // Process payment
      const paymentResult = await paymentService.processPayment(
        order.customerId,
        order.totalAmount
      );

      if (paymentResult.isFailure()) {
        return Result.failure(paymentResult.error);
      }

      // Update order status
      order.markAsPaid(paymentResult.value.transactionId);
      await orderRepository.save(order);

      // Event published automatically by EventAwareDomainService
      this.publishEvent(new OrderProcessedEvent(order.id));

      return Result.success(order);
    });
  }
}

// Register supporting services
@DomainService('paymentService')
class PaymentService extends BaseDomainService {
  constructor() {
    super('paymentService');
  }

  async processPayment(
    customerId: string,
    amount: number
  ): Promise<Result<Payment, Error>> {
    // Payment processing logic...
    return Result.success(new Payment(customerId, amount));
  }
}

// One-time application setup
const container = new SimpleContainer();
VytchesDDD.configure(container); // Auto-discovers all decorated services

// Services are immediately available
const orderProcessor =
  VytchesDDD.resolve<OrderProcessingService>('orderProcessor');
const result = await orderProcessor.processOrder('order-123');

if (result.isSuccess()) {
  console.log(`Order processed: ${result.value.id}`);
} else {
  console.error(`Order processing failed: ${result.error.message}`);
}
```

## Migration from Legacy Patterns

If you're migrating from legacy registry patterns, here's the transformation:

### Old Pattern (Removed)

```typescript
// ❌ OLD: Manual registry patterns
const registry = new DefaultDomainServiceRegistry();
const globalRegistry = GlobalServiceRegistry.getInstance();
const builder = new ServiceRegistryBuilder()
  .register(new UserService(), 'userService')
  .build();

const container = new DomainServiceContainer(registry);
container.initializeServices();
```

### New Pattern (Current)

```typescript
// ✅ NEW: Decorator-based auto-discovery
@DomainService('userService')
class UserService extends BaseDomainService {}

// Zero configuration
VytchesDDD.configure(container);
const userService = VytchesDDD.resolve<UserService>('userService');
```

## Conclusion

Domain Services in VytchesDDD provide a modern, decorator-based implementation
of this important DDD pattern. By leveraging the VytchesDDD DI system, you can
create domain services that are:

- Automatically discovered and registered
- Properly integrated with domain events
- Transaction-aware with Unit of Work support
- Context-isolated for bounded contexts
- Framework-agnostic with adapter support
- Zero-configuration with excellent developer experience

This enables you to implement complex domain processes while maintaining a
clean, maintainable codebase aligned with DDD principles and modern TypeScript
development practices.
