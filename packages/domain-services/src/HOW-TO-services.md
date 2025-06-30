# Domain Services in DomainTS

## Overview

Domain Services are a crucial tactical pattern in Domain-Driven Design (DDD) that encapsulate domain logic which doesn't naturally fit within entities or value objects. The DomainTS library provides a comprehensive, modular implementation of domain services, allowing you to organize and manage complex business operations while maintaining clean separation of concerns.

This guide will walk you through the Domain Services module, explaining its components, how they work together, and best practices for implementation.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Domain Service Interfaces](#domain-service-interfaces)
3. [Base Implementations](#base-implementations)
4. [Service Registration and Discovery](#service-registration-and-discovery)
5. [Service Container and Dependency Injection](#service-container-and-dependency-injection)
6. [Fluent API for Service Configuration](#fluent-api-for-service-configuration)
7. [Event Integration](#event-integration)
8. [Transactional Operations](#transactional-operations)
9. [Async Initialization](#async-initialization)
10. [Best Practices](#best-practices)
11. [Complete Example](#complete-example)

## Concepts Overview

Before diving into implementation details, let's understand what each concept means and when to use it:

### 1. Core Concepts

**What**: Fundamental principles and patterns of Domain Services in DDD.

**Why important**: Provides the theoretical foundation for understanding how Domain Services fit into the broader DDD approach.

**When to use**: When starting with DDD or designing your domain model.

**Examples**:

- Implementing business rules that span multiple entities
- Coordinating operations across aggregates
- Implementing domain processes like validation, calculation, or transformation

### 2. Domain Service Interfaces

**What**: The contract definitions for domain services in your application.

**Why important**: Interfaces define capabilities, promote loose coupling, and enable polymorphism.

**When to use**: When defining what a domain service can do or when implementing dependency injection.

**Examples**:

- Basic service identification via `IDomainService`
- Event publication capability via `IEventBusAware`
- Transaction participation via `IUnitOfWorkAware`
- Lifecycle management via `IAsyncDomainService`

### 3. Base Implementations

**What**: Ready-to-extend abstract classes implementing the service interfaces.

**Why important**: Reduces boilerplate code and ensures consistent implementation.

**When to use**: When creating new domain services to avoid reimplementing common functionality.

**Examples**:

- Use `BaseDomainService` for simple services
- Use `EventAwareDomainService` for services that publish domain events
- Use `UnitOfWorkAwareDomainService` for services requiring transactional consistency
- Use `AsyncDomainService` for services with async initialization needs

### 4. Service Registration and Discovery

**What**: Mechanisms for registering services and locating them by identifier.

**Why important**: Enables dependency resolution and service location without tight coupling.

**When to use**: When organizing services and managing their lifecycle in your application.

**Examples**:

- Maintaining a catalog of all available services
- Finding services by ID at runtime
- Checking if a specific service is available
- Managing service lifecycles (registration, retrieval, removal)

### 5. Service Container and Dependency Injection

**What**: Infrastructure for managing service dependencies and their initialization order.

**Why important**: Automates the complex task of resolving dependencies and initializing services.

**When to use**: In applications with multiple services that depend on each other.

**Examples**:

- Resolving a complex dependency graph of services
- Automatic wiring of infrastructure components (event bus, unit of work)
- Detecting circular dependencies
- Ensuring services are initialized in the correct order

### 6. Fluent API for Service Configuration

**What**: Expressive builder pattern API for configuring services.

**Why important**: Makes service configuration more readable and less error-prone.

**When to use**: When setting up services with complex configurations or dependencies.

**Examples**:

- Building a service with multiple dependencies
- Configuring a service with specific infrastructure
- Creating and registering services in a single chain
- Building a custom service registry

### 7. Event Integration

**What**: Infrastructure for domain services to publish and subscribe to domain events.

**Why important**: Enables loose coupling through event-driven communication.

**When to use**: When services need to communicate state changes or trigger processes.

**Examples**:

- Publishing events when important domain operations complete
- Notifying other parts of the system about state changes
- Implementing event sourcing patterns
- Creating audit trails of domain operations

### 8. Transactional Operations

**What**: Support for executing operations in a transactional context.

**Why important**: Ensures atomicity and consistency across aggregates.

**When to use**: When operations affect multiple aggregates or require all-or-nothing semantics.

**Examples**:

- Transferring items between orders
- Processing a payment and updating order status
- Coordinating inventory adjustments across multiple products
- Recording complex business operations that must succeed or fail as a unit

### 9. Async Initialization

**What**: Support for asynchronous service initialization and cleanup.

**Why important**: Enables resources that require async setup/teardown to be properly managed.

**When to use**: When services rely on external resources or need async configuration.

**Examples**:

- Connecting to external APIs or databases
- Setting up event subscriptions
- Loading cached data
- Initializing complex resources that require async operations

### 10. Best Practices

**What**: Recommended patterns and approaches for domain service implementation.

**Why important**: Helps avoid common pitfalls and ensures alignment with DDD principles.

**When to use**: Throughout your domain service implementations.

**Examples**:

- Keeping services stateless
- Properly defining transaction boundaries
- Organizing services by bounded context
- Effective error handling strategies

## Core Concepts

In DDD, Domain Services:

- Implement operations that involve multiple aggregates
- Represent processes or transformations that are stateless
- Encapsulate complex domain logic that doesn't belong to any specific entity
- Coordinate activities across different parts of the domain

The DomainTS implementation follows these principles while providing additional infrastructure for:

- Dependency injection and service location
- Integration with domain events
- Transactional consistency through Unit of Work pattern
- Asynchronous initialization and resource management

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

To simplify implementation, the library provides base classes for common service types:

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

Choose the appropriate base class based on your service's needs. For example, if your service needs to publish events and perform transactions, extend `UnitOfWorkAwareDomainService`.

## Service Registration and Discovery

To make services available throughout your application, DomainTS provides a registry system:

```typescript
interface IDomainServiceRegistry {
  register<T extends IDomainService>(service: T, serviceId?: string): void;
  get<T extends IDomainService>(serviceId: string): T | undefined;
  has(serviceId: string): boolean;
  remove(serviceId: string): boolean;
  getAll(): Map<string, IDomainService>;
  clear(): void;
}
```

The library includes a default implementation (`DefaultDomainServiceRegistry`) and a singleton access point (`GlobalServiceRegistry`):

```typescript
// Using the default registry
const registry = new DefaultDomainServiceRegistry();
registry.register(new MyDomainService("my-service"));
const service = registry.get<MyDomainService>("my-service");

// Using the global registry
const globalRegistry = GlobalServiceRegistry.getInstance();
globalRegistry.register(new MyDomainService("global-service"));
const globalService = globalRegistry.get<MyDomainService>("global-service");
```

## Service Container and Dependency Injection

For more complex scenarios with service dependencies, DomainTS provides a container:

```typescript
const container = new DomainServiceContainer();

// Register services with dependencies
container.registerFactory('orderService', 
  () => new OrderService(), 
  ['productService', 'customerService']);

container.registerFactory('productService', 
  () => new ProductService());

container.registerFactory('customerService', 
  () => new CustomerService());

// Initialize all services (resolving dependencies)
container.initializeServices();

// Retrieve a service
const orderService = container.getService<OrderService>('orderService');
```

The container:

- Tracks dependencies between services
- Ensures initialization in the correct order
- Detects circular dependencies
- Configures services with infrastructure components

## Fluent API for Service Configuration

For a more expressive way to configure services, use the builder pattern:

```typescript
// Using ServiceRegistryBuilder
const registry = new ServiceRegistryBuilder()
  .withEventBus(eventBus)
  .withUnitOfWork(unitOfWork)
  .register(new LoggingService())
  .build();

// Using ServiceBuilder
const orderService = new ServiceBuilder<OrderService>(registry, 'orderService', 
  (productRepo, customerRepo) => new OrderService(productRepo, customerRepo))
  .dependsOn('productRepository')
  .dependsOn('customerRepository')
  .withEventBus(eventBus)
  .buildAndRegister();
```

This approach provides:

- Type-safe dependency injection
- Fluent configuration of infrastructure components
- Clear visualization of service dependencies

## Event Integration

Domain Services often need to publish domain events. The `EventAwareDomainService` base class makes this simple:

```typescript
class OrderProcessingService extends EventAwareDomainService {
  constructor() {
    super('order-processor');
  }
  
  processOrder(order: Order): void {
    // Process order logic...
    
    // Publish domain event
    this.publishEvent(new OrderProcessedEvent(order.id));
  }
}
```

Services can be configured with an event bus:

- Automatically by the service container
- Explicitly through the builder API
- Manually by calling `setEventBus()`

## Transactional Operations

For operations that span multiple aggregates, use transactional domain services:

```typescript
class OrderManagementService extends UnitOfWorkAwareDomainService {
  constructor() {
    super('order-manager');
  }
  
  async transferOrderItems(sourceOrderId: string, targetOrderId: string): Promise<void> {
    return this.executeInTransaction(async () => {
      const orderRepo = this.getRepository<OrderRepository>('orderRepository');
      
      const sourceOrder = await orderRepo.findById(sourceOrderId);
      const targetOrder = await orderRepo.findById(targetOrderId);
      
      // Transfer logic...
      
      await orderRepo.save(sourceOrder);
      await orderRepo.save(targetOrder);
    });
  }
}
```

The `executeInTransaction` method:

- Begins a transaction automatically
- Commits on successful completion
- Rolls back if an error occurs
- Coordinates event publication after commit

## Async Initialization

Services that need asynchronous setup or cleanup can use the async lifecycle:

```typescript
@DomainService({
  serviceId: 'external-api-service',
  async: true
})
class ExternalApiService extends AsyncDomainService {
  private client: ApiClient;
  
  constructor() {
    super('external-api-service');
  }
  
  async initialize(): Promise<void> {
    this.client = await ApiClient.connect();
    // Setup is complete, service is ready to use
  }
  
  async dispose(): Promise<void> {
    await this.client.disconnect();
    // Resources are released
  }
  
  async fetchData(id: string): Promise<Data> {
    return this.client.getData(id);
  }
}
```

Async services:

- Are initialized by the container during `initializeServices()`
- Can be explicitly initialized using the builder API
- Should be awaited before use

## Best Practices

When implementing domain services with DomainTS:

1. **Use the right base class**: Choose the appropriate base class based on your service's needs.

2. **Keep services stateless**: Domain services should not maintain state between operations. Use aggregates for stateful domain concepts.

3. **Service ID conventions**: Use consistent naming for service IDs, like 'order-processor' or 'customer-manager'.

4. **Avoid circular dependencies**: Design your services to avoid circular dependencies, which will cause initialization failures.

5. **Transactional boundaries**: Place transaction boundaries at the highest appropriate level - typically within domain service methods.

6. **Service responsibilities**: Each service should have a single, focused responsibility within the domain.

7. **Use dependency injection**: Prefer constructor injection via the container or builder rather than manual service location.

8. **Domain event publication**: Publish domain events to communicate important domain changes to other parts of the system.

9. **Error handling**: Use the Result pattern or exceptions consistently within your services.

## Complete Example

Here's a complete example of defining, registering, and using domain services:

```typescript
// Define domain service
@DomainService({
  serviceId: 'order-processor',
  dependencies: ['order-repository', 'payment-service'],
  transactional: true,
  publishesEvents: true
})
class OrderProcessingService extends UnitOfWorkAwareDomainService {
  constructor(
    private orderRepository: OrderRepository,
    private paymentService: PaymentService
  ) {
    super('order-processor');
  }
  
  async processOrder(orderId: string): Promise<Result<Order, Error>> {
    return this.executeInTransaction(async () => {
      // Retrieve order from repository
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        return Result.failure(new Error(`Order ${orderId} not found`));
      }
      
      // Process payment
      const paymentResult = await this.paymentService.processPayment(
        order.customerId, 
        order.totalAmount
      );
      
      if (paymentResult.isFailure()) {
        return Result.failure(paymentResult.error);
      }
      
      // Update order status
      order.markAsPaid(paymentResult.value.transactionId);
      await this.orderRepository.save(order);
      
      return Result.success(order);
    });
  }
}

// Register and configure services
const eventBus = new InMemoryEventBus();
const unitOfWork = new DatabaseUnitOfWork(eventBus);

// Setup repositories
const orderRepo = new SqlOrderRepository();
unitOfWork.registerRepository('order-repository', orderRepo);

// Configure service container
const container = new DomainServiceContainer(
  undefined, // Use default registry
  eventBus,
  () => unitOfWork
);

// Register services
container.registerFactory('payment-service', 
  () => new PaymentService());

container.registerFactory('order-processor', 
  () => new OrderProcessingService(
    container.getService<OrderRepository>('order-repository')!,
    container.getService<PaymentService>('payment-service')!
  ),
  ['order-repository', 'payment-service']
);

// Initialize all services
container.initializeServices();

// Use the service
const orderProcessor = container.getService<OrderProcessingService>('order-processor')!;
const result = await orderProcessor.processOrder('order-123');

if (result.isSuccess()) {
  console.log(`Order processed: ${result.value.id}`);
} else {
  console.error(`Order processing failed: ${result.error.message}`);
}
```

## Conclusion

Domain Services in DomainTS provide a powerful, flexible implementation of this important DDD pattern. By leveraging the provided interfaces, base classes, and infrastructure components, you can create domain services that are:

- Focused on domain logic
- Properly integrated with domain events
- Transaction-aware
- Easily testable
- Well-organized with clear dependencies

This enables you to implement complex domain processes while maintaining a clean, maintainable codebase aligned with DDD principles.
