# Dependency Injection

**Enterprise Dependency Injection** 🔧

Unify your application's dependency management with auto-discovery, framework adapters, and enterprise-grade service location. Built specifically for Domain-Driven Design applications.

✨ **Perfect for**: Large-scale applications, framework integration, bounded context isolation  
🎯 **Best used when**: Managing complex service dependencies across multiple domains  
⚡ **Key benefit**: Single source of truth for all service resolution

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Domain**: Infrastructure  
**Patterns**: dependency-injection, service-locator, auto-discovery, context-isolation  
**Tags**: di:core, di:basic, di:service-locator

## What is Dependency Injection?

Dependency Injection provides a global service locator with auto-discovery, framework adapters, and enterprise-grade DI capabilities for DDD applications.

## Key Features

- **Global Service Locator**: Unified dependency resolution following MediatR pattern
- **Auto-Discovery**: Plugin-based discovery through decorators (@DomainService, @CommandHandler, @QueryHandler)
- **Framework Adapters**: Bridge pattern integration with NestJS, InversifyJS, TSyringe
- **Context Isolation**: Bounded context support for DDD scenarios
- **Service Lifetimes**: Transient, Singleton, and Scoped registration
- **Enterprise Ready**: Production-grade service locator with comprehensive error handling

## When to Use Dependency Injection

### ✅ Perfect Scenarios:

- **Large Applications**: Projects with many services and complex dependencies
- **Framework Integration**: Bridging VytchesDDD with NestJS, Express, or other frameworks
- **Bounded Contexts**: Isolating services within specific domain boundaries
- **Testing**: Easy mocking and dependency substitution
- **Enterprise Applications**: Production systems requiring robust service management

### 🎯 Specific Use Cases:

- **Multi-Module Applications**: Managing dependencies across multiple modules
- **Command/Query Handlers**: Auto-discovering CQRS handlers
- **Service Orchestration**: Coordinating multiple domain services
- **Plugin Architecture**: Dynamically loading and registering services
- **Microservices**: Service discovery and registration patterns

### 💡 Decision Guidelines:

- If you have > 5 services → Use DI for better organization
- If you're using frameworks → Use DI for integration
- If you need testing flexibility → Use DI for easy mocking
- If you have bounded contexts → Use DI for isolation

## When NOT to Use Dependency Injection

### ❌ Avoid in These Scenarios:

- **Simple Applications**: Small apps with < 5 services
- **Prototype/Demo Projects**: Quick experiments or proof-of-concepts
- **Static Dependencies**: Services that never change or need mocking
- **Over-Complex Setup**: When DI adds more complexity than value
- **Performance-Critical Paths**: Hot paths where service resolution overhead matters

### 🚫 Common Anti-Patterns:

- **Service Locator Abuse**: Using DI container as a global service locator everywhere
- **Circular Dependencies**: Services depending on each other circularly
- **God Container**: Registering everything in DI, even simple utilities
- **Runtime Registration**: Registering services at runtime instead of startup
- **Framework Lock-in**: Making domain logic dependent on DI framework

### 💡 Alternative Approaches:

- **Direct Instantiation**: Simply `new Service()` for simple cases
- **Factory Pattern**: Custom factories for complex object creation
- **Builder Pattern**: For objects with many optional parameters
- **Module Pattern**: For organizing related services
- **Composition Root**: Manual composition at application entry point

## Implementation Examples

### Basic Level Implementation

```typescript
# Basic Service Registration - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: Service Registration, Decorator Pattern  
**Dependencies**: @vytches-ddd/di  

## Description

This example demonstrates the fundamental concepts of service registration using the `@DomainService` decorator. You'll learn how to register services with VytchesDDD's dependency injection system and resolve them using the global service locator pattern.

## Business Context

In a typical enterprise application, you need to manage user operations across multiple layers. Instead of manually instantiating services and managing their dependencies, the DI system automatically handles service creation and lifecycle management, leading to cleaner, more maintainable code.

## Code Example

```typescript
// user.service.ts
import { DomainService } from '@vytches-ddd/di';
import { User, CreateUserData } from '../types'; // Import from application

/**
 * User service with basic DI registration
 */
@DomainService('userService')
export class UserService {
  /**
   * Creates a new user
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Business logic implementation
    const user: User = {
      id: this.generateId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Simulate database save
    await this.saveToDatabase(user);
    
    return user;
  }
  
  /**
   * Retrieves a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    // ⭐ FOCUS: Service implementation
    return await this.findInDatabase(id);
  }
  
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async saveToDatabase(user: User): Promise<void> {
    // Simulate database operation
    console.log('Saving user to database:', user.id);
  }
  
  private async findInDatabase(id: string): Promise<User | null> {
    // Simulate database lookup
    console.log('Finding user in database:', id);
    return null; // Simplified for example
  }
}
```

```typescript
// app.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { UserService } from './user.service';
import { CreateUserData } from '../types'; // Import from application

/**
 * Application setup and service usage
 */
async function setupApplication(): Promise<void> {
  // ⭐ FOCUS: Configure DI container
  const container = new SimpleContainer();
  await VytchesDDD.configure(container);
  
  // ⭐ FOCUS: Resolve service using global locator
  const userService = VytchesDDD.resolve<UserService>('userService');
  
  // ⭐ FOCUS: Use the service
  const userData: CreateUserData = {
    email: 'john.doe@example.com',
    name: 'John Doe'
  };
  
  const user = await userService.createUser(userData);
  console.log('Created user:', user);
  
  const retrievedUser = await userService.getUserById(user.id);
  console.log('Retrieved user:', retrievedUser);
}

// Run the application
setupApplication().catch(console.error);
```

## Key Features

- **Simple Registration**: Use `@DomainService` decorator with a service identifier
- **Auto-Discovery**: Services are automatically discovered and registered
- **Global Resolution**: Access services anywhere using `VytchesDDD.resolve()`
- **Type Safety**: Full TypeScript support with generic type resolution
- **Zero Configuration**: Works out of the box with sensible defaults

## Common Pitfalls

- **Missing Service ID**: Always provide a unique service identifier in `@DomainService('serviceId')`
- **Forgetting Configuration**: Must call `VytchesDDD.configure()` before resolving services
- **Circular Dependencies**: Avoid services that depend on each other directly
- **Type Mismatches**: Ensure the generic type matches the actual service type when resolving

## Related Examples

- [Service Lifetimes](./example-2.md) - Understanding different service lifetimes
- [VytchesDDD Global Service Locator](./example-3.md) - Advanced service locator usage
- [Auto-Discovery System](../intermediate/example-1.md) - Automatic service discovery
```

### Intermediate Level Implementation

```typescript
# Auto-Discovery System - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: intermediate  
**Domain**: E-commerce Platform  
**Patterns**: Auto-Discovery, Enhanced Decorators, Plugin System  
**Dependencies**: @vytches-ddd/di  

## Description

This example demonstrates VytchesDDD's auto-discovery system that automatically finds and registers services using enhanced decorators. The system scans for decorated classes and registers them with the appropriate configuration, reducing boilerplate code and improving maintainability.

## Business Context

In large enterprise applications, manually registering dozens of services becomes cumbersome and error-prone. Auto-discovery automatically finds services based on decorators, ensuring all services are registered consistently and reducing the risk of missing registrations during deployments.

## Code Example

```typescript
// product.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { User, Product } from '../types'; // Import from application

/**
 * Product service with enhanced auto-discovery configuration
 */
@DomainService({
  serviceId: 'productService',
  lifetime: ServiceLifetime.Singleton,
  context: 'ProductCatalog',
  dependencies: ['auditService', 'cacheService'],
  autoRegister: true,
  timeout: 30000,
  tags: ['catalog', 'products', 'core']
})
export class ProductService {
  private products: Map<string, Product> = new Map();
  
  /**
   * Gets product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    // ⭐ FOCUS: Auto-discovered service implementation
    console.log(`ProductService: Getting product ${id}`);
    return this.products.get(id) || null;
  }
  
  /**
   * Creates a new product
   */
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product: Product = {
      ...productData,
      id: this.generateProductId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.products.set(product.id, product);
    
    console.log(`ProductService: Created product ${product.id}`);
    return product;
  }
  
  private generateProductId(): string {
    return `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// inventory.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';

/**
 * Inventory service with auto-discovery
 */
@DomainService({
  serviceId: 'inventoryService',
  lifetime: ServiceLifetime.Transient,
  context: 'InventoryManagement',
  autoRegister: true,
  middleware: ['loggingMiddleware', 'validationMiddleware'],
  retryPolicy: {
    maxAttempts: 3,
    baseDelay: 1000
  }
})
export class InventoryService {
  private inventory: Map<string, number> = new Map();
  
  /**
   * Checks product availability
   */
  async checkAvailability(productId: string): Promise<number> {
    // ⭐ FOCUS: Auto-discovered service with middleware
    console.log(`InventoryService: Checking availability for ${productId}`);
    return this.inventory.get(productId) || 0;
  }
  
  /**
   * Reserves inventory
   */
  async reserveInventory(productId: string, quantity: number): Promise<boolean> {
    const available = await this.checkAvailability(productId);
    
    if (available >= quantity) {
      this.inventory.set(productId, available - quantity);
      console.log(`InventoryService: Reserved ${quantity} units of ${productId}`);
      return true;
    }
    
    console.log(`InventoryService: Insufficient inventory for ${productId}`);
    return false;
  }
}
```

```typescript
// audit.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * Audit service with auto-discovery
 */
@DomainService({
  serviceId: 'auditService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Compliance',
  autoRegister: true,
  priority: 10, // High priority for early registration
  healthCheck: true
})
export class AuditService {
  private auditLog: AuditLogEntry[] = [];
  
  /**
   * Logs an audit entry
   */
  async logAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    // ⭐ FOCUS: Auto-discovered audit service
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date()
    };
    
    this.auditLog.push(auditEntry);
    
    console.log(`AuditService: Logged action ${entry.action} for ${entry.resource}`);
  }
  
  /**
   * Gets audit log for a resource
   */
  async getAuditLog(resourceId: string): Promise<AuditLogEntry[]> {
    return this.auditLog.filter(entry => entry.resourceId === resourceId);
  }
  
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// cache.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { CacheConfig } from '../types'; // Import from application

/**
 * Cache service with conditional auto-discovery
 */
@DomainService({
  serviceId: 'cacheService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Infrastructure',
  autoRegister: true,
  condition: () => process.env.NODE_ENV === 'production', // Conditional registration
  factory: (container) => {
    const config: CacheConfig = {
      provider: 'memory',
      ttl: 300000, // 5 minutes
      maxSize: 1000
    };
    return new CacheService(config);
  }
})
export class CacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  
  constructor(private config: CacheConfig) {}
  
  /**
   * Gets cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // ⭐ FOCUS: Auto-discovered cache service
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`CacheService: Cache hit for ${key}`);
    return cached.value;
  }
  
  /**
   * Sets cached value
   */
  async set(key: string, value: any): Promise<void> {
    const expiry = Date.now() + this.config.ttl;
    this.cache.set(key, { value, expiry });
    
    console.log(`CacheService: Cached value for ${key}`);
  }
}
```

```typescript
// discovery-configuration.ts
import { VytchesDDD, SimpleContainer, DiscoveryOptions } from '@vytches-ddd/di';

/**
 * Auto-discovery configuration
 */
export class DiscoveryConfiguration {
  /**
   * Configures auto-discovery with custom options
   */
  static async configure(): Promise<void> {
    const container = new SimpleContainer();
    
    // ⭐ FOCUS: Enhanced auto-discovery configuration
    const discoveryOptions: DiscoveryOptions = {
      // Scan specific directories
      scanPaths: [
        './src/services',
        './src/handlers',
        './src/repositories'
      ],
      
      // Include/exclude patterns
      include: ['**/*.service.ts', '**/*.handler.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      
      // Discovery settings
      enableAutoRegistration: true,
      enableDependencyValidation: true,
      enableCircularDependencyDetection: true,
      
      // Lifecycle hooks
      onServiceDiscovered: (serviceId, metadata) => {
        console.log(`Discovered service: ${serviceId}`, metadata);
      },
      
      onServiceRegistered: (serviceId, registration) => {
        console.log(`Registered service: ${serviceId}`, registration);
      },
      
      onDiscoveryComplete: (discoveredServices) => {
        console.log(`Auto-discovery complete. Found ${discoveredServices.length} services`);
      }
    };
    
    // Configure with discovery options
    await VytchesDDD.configure(container, discoveryOptions);
  }
}
```

```typescript
// app.ts
import { VytchesDDD } from '@vytches-ddd/di';
import { DiscoveryConfiguration } from './discovery-configuration';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';

/**
 * Application demonstrating auto-discovery
 */
async function demonstrateAutoDiscovery(): Promise<void> {
  console.log('=== Auto-Discovery System Demo ===\n');
  
  // ⭐ FOCUS: Configure auto-discovery
  await DiscoveryConfiguration.configure();
  
  console.log('\n1. Auto-discovered services:');
  const discoveredServices = VytchesDDD.getRegisteredServices();
  discoveredServices.forEach(serviceId => {
    console.log(`  - ${serviceId}`);
  });
  
  console.log('\n2. Using auto-discovered services:');
  
  // ⭐ FOCUS: Resolve auto-discovered services
  const productService = VytchesDDD.resolve<ProductService>('productService');
  const inventoryService = VytchesDDD.resolve<InventoryService>('inventoryService');
  const auditService = VytchesDDD.resolve<AuditService>('auditService');
  const cacheService = VytchesDDD.resolve<CacheService>('cacheService');
  
  // Create and use services
  const product = await productService.createProduct({
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99,
    category: 'Electronics',
    sku: 'LAP-001'
  });
  
  await inventoryService.reserveInventory(product.id, 5);
  
  await auditService.logAction({
    userId: 'user123',
    action: 'CREATE_PRODUCT',
    resource: 'Product',
    resourceId: product.id
  });
  
  await cacheService.set('recent-product', product);
  
  console.log('\n3. Service dependencies and metadata:');
  const productServiceMetadata = VytchesDDD.getServiceMetadata('productService');
  console.log('ProductService metadata:', productServiceMetadata);
}

// Run the demonstration
demonstrateAutoDiscovery().catch(console.error);
```

## Key Features

- **Automatic Registration**: Services are automatically found and registered
- **Enhanced Decorators**: Rich configuration options in `@DomainService`
- **Dependency Validation**: Validates service dependencies during discovery
- **Circular Dependency Detection**: Prevents circular dependency issues
- **Conditional Registration**: Register services based on runtime conditions
- **Custom Factories**: Support for custom service creation logic
- **Lifecycle Hooks**: Hooks for discovery and registration events

## Common Pitfalls

- **Missing Auto-Register**: Set `autoRegister: true` for automatic discovery
- **Circular Dependencies**: Avoid services that depend on each other during construction
- **Scan Path Configuration**: Ensure scan paths include all service locations
- **Context Isolation**: Be careful with context-specific services
- **Factory Dependencies**: Custom factories should handle their own dependencies

## Related Examples

- [Basic Service Registration](../basic/example-1.md) - Simple service registration
- [Context Isolation](./example-2.md) - Bounded context support
- [CQRS Handler Registration](./example-3.md) - Automatic handler registration
```

### Advanced Level Implementation

```typescript
# Framework Integration Patterns - Advanced Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: advanced  
**Domain**: Enterprise Multi-Framework Architecture  
**Patterns**: Framework Integration, Adapter Pattern, Bridge Pattern  
**Dependencies**: @vytches-ddd/di, NestJS, InversifyJS, TSyringe  

## Description

This example demonstrates advanced patterns for integrating VytchesDDD's DI system with popular frameworks like NestJS, InversifyJS, and TSyringe. It shows how to create adapters, avoid double instance risks, and maintain clean boundaries between framework and domain services.

## Business Context

Enterprise applications often need to integrate with multiple frameworks or migrate between them. Using adapter patterns allows you to keep your domain logic framework-agnostic while leveraging each framework's strengths. This approach provides flexibility and reduces migration costs.

## Code Example

```typescript
// domain/user-domain.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { User, CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * Core domain service - framework agnostic
 */
@DomainService({
  serviceId: 'userDomainService',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  autoRegister: true,
  dependencies: ['auditService', 'validationService']
})
export class UserDomainService {
  private users: Map<string, User> = new Map();
  
  /**
   * Creates a new user with domain logic
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Pure domain logic, no framework dependencies
    console.log(`UserDomainService: Creating user ${userData.email}`);
    
    // Domain validation
    await this.validateUserData(userData);
    
    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    
    // Domain events, business rules, etc.
    await this.publishUserCreatedEvent(user);
    
    console.log(`UserDomainService: Created user ${user.id}`);
    return user;
  }
  
  /**
   * Updates user with domain logic
   */
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const updatedUser = {
      ...existingUser,
      ...userData,
      updatedAt: new Date()
    };
    
    this.users.set(userId, updatedUser);
    
    await this.publishUserUpdatedEvent(updatedUser);
    
    console.log(`UserDomainService: Updated user ${userId}`);
    return updatedUser;
  }
  
  /**
   * Gets user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }
  
  private async validateUserData(userData: CreateUserData): Promise<void> {
    // Domain validation logic
    if (!userData.email || !userData.name) {
      throw new Error('Email and name are required');
    }
  }
  
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async publishUserCreatedEvent(user: User): Promise<void> {
    // Domain event publishing
    console.log(`Publishing UserCreated event for ${user.id}`);
  }
  
  private async publishUserUpdatedEvent(user: User): Promise<void> {
    // Domain event publishing
    console.log(`Publishing UserUpdated event for ${user.id}`);
  }
}
```

```typescript
// adapters/nestjs-adapter.ts
import { Injectable, OnModuleInit, ModuleRef } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { UserDomainService } from '../domain/user-domain.service';

/**
 * NestJS adapter for VytchesDDD integration
 */
export class NestJSVytchesDDDAdapter implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}
  
  async onModuleInit(): Promise<void> {
    // ⭐ FOCUS: Initialize VytchesDDD before NestJS DI
    await VytchesDDD.configure();
    
    console.log('NestJS adapter initialized with VytchesDDD');
  }
}

/**
 * Bridge service for NestJS integration
 */
@Injectable()
export class NestJSUserService {
  private readonly userDomainService: UserDomainService;
  
  constructor() {
    // ⭐ FOCUS: Bridge pattern - get existing instance from VytchesDDD
    this.userDomainService = VytchesDDD.resolve<UserDomainService>('userDomainService');
  }
  
  /**
   * NestJS service delegates to domain service
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Thin wrapper around domain service
    return await this.userDomainService.createUser(userData);
  }
  
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    return await this.userDomainService.updateUser(userId, userData);
  }
  
  async getUserById(userId: string): Promise<User | null> {
    return await this.userDomainService.getUserById(userId);
  }
}

/**
 * Factory provider for complex scenarios
 */
export const UserServiceProvider = {
  provide: 'USER_SERVICE',
  useFactory: (): UserDomainService => {
    const instance = VytchesDDD.resolve<UserDomainService>('userDomainService');
    if (!instance) {
      throw new Error('UserDomainService not found in VytchesDDD container');
    }
    return instance;
  },
};
```

```typescript
// adapters/inversify-adapter.ts
import { Container, inject, injectable } from 'inversify';
import { VytchesDDD } from '@vytches-ddd/di';
import { UserDomainService } from '../domain/user-domain.service';

/**
 * InversifyJS adapter for VytchesDDD integration
 */
export class InversifyVytchesDDDAdapter {
  private container: Container;
  
  constructor() {
    this.container = new Container();
  }
  
  /**
   * Configures InversifyJS to work with VytchesDDD
   */
  async configure(): Promise<Container> {
    // ⭐ FOCUS: Initialize VytchesDDD first
    await VytchesDDD.configure();
    
    // Bind VytchesDDD services to InversifyJS container
    this.container.bind<UserDomainService>('UserDomainService').toDynamicValue(() => {
      return VytchesDDD.resolve<UserDomainService>('userDomainService');
    });
    
    console.log('InversifyJS adapter configured with VytchesDDD');
    return this.container;
  }
}

/**
 * InversifyJS service using VytchesDDD
 */
@injectable()
export class InversifyUserService {
  constructor(
    @inject('UserDomainService') private userDomainService: UserDomainService
  ) {}
  
  /**
   * InversifyJS service delegates to domain service
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Uses injected VytchesDDD service
    return await this.userDomainService.createUser(userData);
  }
  
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    return await this.userDomainService.updateUser(userId, userData);
  }
  
  async getUserById(userId: string): Promise<User | null> {
    return await this.userDomainService.getUserById(userId);
  }
}
```

```typescript
// adapters/tsyringe-adapter.ts
import { container, injectable, singleton } from 'tsyringe';
import { VytchesDDD } from '@vytches-ddd/di';
import { UserDomainService } from '../domain/user-domain.service';

/**
 * TSyringe adapter for VytchesDDD integration
 */
export class TSyringeVytchesDDDAdapter {
  /**
   * Configures TSyringe to work with VytchesDDD
   */
  static async configure(): Promise<void> {
    // ⭐ FOCUS: Initialize VytchesDDD first
    await VytchesDDD.configure();
    
    // Register VytchesDDD services in TSyringe
    container.register<UserDomainService>('UserDomainService', {
      useFactory: () => VytchesDDD.resolve<UserDomainService>('userDomainService')
    });
    
    console.log('TSyringe adapter configured with VytchesDDD');
  }
}

/**
 * TSyringe service using VytchesDDD
 */
@injectable()
@singleton()
export class TSyringeUserService {
  constructor(
    private userDomainService: UserDomainService = container.resolve<UserDomainService>('UserDomainService')
  ) {}
  
  /**
   * TSyringe service delegates to domain service
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Uses TSyringe-injected VytchesDDD service
    return await this.userDomainService.createUser(userData);
  }
  
  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    return await this.userDomainService.updateUser(userId, userData);
  }
  
  async getUserById(userId: string): Promise<User | null> {
    return await this.userDomainService.getUserById(userId);
  }
}
```

```typescript
// adapters/generic-adapter.ts
import { VytchesDDD } from '@vytches-ddd/di';

/**
 * Generic adapter interface for any framework
 */
export interface FrameworkAdapter<T> {
  configure(frameworkContainer: T): Promise<void>;
  getBridgeService<TService>(serviceId: string): TService;
}

/**
 * Generic framework adapter implementation
 */
export class GenericFrameworkAdapter<T> implements FrameworkAdapter<T> {
  private frameworkContainer: T | null = null;
  
  /**
   * Configures the adapter with any framework container
   */
  async configure(frameworkContainer: T): Promise<void> {
    this.frameworkContainer = frameworkContainer;
    
    // ⭐ FOCUS: Always initialize VytchesDDD first
    await VytchesDDD.configure();
    
    console.log('Generic framework adapter configured');
  }
  
  /**
   * Gets bridge service from VytchesDDD
   */
  getBridgeService<TService>(serviceId: string): TService {
    const service = VytchesDDD.resolve<TService>(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found in VytchesDDD container`);
    }
    return service;
  }
}

/**
 * Framework-agnostic service factory
 */
export class ServiceFactory {
  /**
   * Creates service bridge for any framework
   */
  static createBridge<TService>(serviceId: string): TService {
    // ⭐ FOCUS: Framework-agnostic service access
    return VytchesDDD.resolve<TService>(serviceId);
  }
  
  /**
   * Creates lazy service bridge
   */
  static createLazyBridge<TService>(serviceId: string): () => TService {
    return () => VytchesDDD.resolve<TService>(serviceId);
  }
}
```

```typescript
// integration/multi-framework-app.ts
import { NestJSVytchesDDDAdapter, NestJSUserService } from '../adapters/nestjs-adapter';
import { InversifyVytchesDDDAdapter, InversifyUserService } from '../adapters/inversify-adapter';
import { TSyringeVytchesDDDAdapter, TSyringeUserService } from '../adapters/tsyringe-adapter';
import { GenericFrameworkAdapter } from '../adapters/generic-adapter';
import { CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * Multi-framework application demonstrating integration patterns
 */
export class MultiFrameworkApplication {
  private nestjsAdapter: NestJSVytchesDDDAdapter;
  private inversifyAdapter: InversifyVytchesDDDAdapter;
  private genericAdapter: GenericFrameworkAdapter<any>;
  
  constructor() {
    this.nestjsAdapter = new NestJSVytchesDDDAdapter(null as any); // Simplified
    this.inversifyAdapter = new InversifyVytchesDDDAdapter();
    this.genericAdapter = new GenericFrameworkAdapter();
  }
  
  /**
   * Demonstrates NestJS integration
   */
  async demonstrateNestJSIntegration(): Promise<void> {
    console.log('\n=== NestJS Integration ===');
    
    // ⭐ FOCUS: Initialize NestJS adapter
    await this.nestjsAdapter.onModuleInit();
    
    const nestjsService = new NestJSUserService();
    
    const userData: CreateUserData = {
      email: 'nestjs@example.com',
      name: 'NestJS User'
    };
    
    const user = await nestjsService.createUser(userData);
    console.log('NestJS created user:', user.id);
    
    const retrievedUser = await nestjsService.getUserById(user.id);
    console.log('NestJS retrieved user:', retrievedUser?.name);
  }
  
  /**
   * Demonstrates InversifyJS integration
   */
  async demonstrateInversifyIntegration(): Promise<void> {
    console.log('\n=== InversifyJS Integration ===');
    
    // ⭐ FOCUS: Configure InversifyJS adapter
    const container = await this.inversifyAdapter.configure();
    
    const inversifyService = container.get<InversifyUserService>(InversifyUserService);
    
    const userData: CreateUserData = {
      email: 'inversify@example.com',
      name: 'InversifyJS User'
    };
    
    const user = await inversifyService.createUser(userData);
    console.log('InversifyJS created user:', user.id);
    
    const retrievedUser = await inversifyService.getUserById(user.id);
    console.log('InversifyJS retrieved user:', retrievedUser?.name);
  }
  
  /**
   * Demonstrates TSyringe integration
   */
  async demonstrateTSyringeIntegration(): Promise<void> {
    console.log('\n=== TSyringe Integration ===');
    
    // ⭐ FOCUS: Configure TSyringe adapter
    await TSyringeVytchesDDDAdapter.configure();
    
    const tsyringeService = new TSyringeUserService();
    
    const userData: CreateUserData = {
      email: 'tsyringe@example.com',
      name: 'TSyringe User'
    };
    
    const user = await tsyringeService.createUser(userData);
    console.log('TSyringe created user:', user.id);
    
    const retrievedUser = await tsyringeService.getUserById(user.id);
    console.log('TSyringe retrieved user:', retrievedUser?.name);
  }
  
  /**
   * Demonstrates generic adapter usage
   */
  async demonstrateGenericIntegration(): Promise<void> {
    console.log('\n=== Generic Integration ===');
    
    // ⭐ FOCUS: Configure generic adapter
    await this.genericAdapter.configure({});
    
    const userService = this.genericAdapter.getBridgeService<UserDomainService>('userDomainService');
    
    const userData: CreateUserData = {
      email: 'generic@example.com',
      name: 'Generic User'
    };
    
    const user = await userService.createUser(userData);
    console.log('Generic created user:', user.id);
    
    const retrievedUser = await userService.getUserById(user.id);
    console.log('Generic retrieved user:', retrievedUser?.name);
  }
  
  /**
   * Runs all integration demonstrations
   */
  async runAllDemonstrations(): Promise<void> {
    console.log('=== Multi-Framework Integration Demo ===');
    
    await this.demonstrateNestJSIntegration();
    await this.demonstrateInversifyIntegration();
    await this.demonstrateTSyringeIntegration();
    await this.demonstrateGenericIntegration();
    
    console.log('\n=== All integrations completed ===');
  }
}
```

```typescript
// app.ts
import { MultiFrameworkApplication } from './integration/multi-framework-app';

/**
 * Application demonstrating framework integration patterns
 */
async function demonstrateFrameworkIntegration(): Promise<void> {
  const app = new MultiFrameworkApplication();
  
  try {
    await app.runAllDemonstrations();
  } catch (error) {
    console.error('Framework integration failed:', error);
  }
}

// Run the demonstration
demonstrateFrameworkIntegration().catch(console.error);
```

## Key Features

- **Framework Agnostic**: Domain services remain independent of any framework
- **Adapter Pattern**: Clean integration with multiple frameworks
- **Bridge Pattern**: Prevents double instance risks
- **Lazy Resolution**: Services resolved only when needed
- **Generic Adapters**: Reusable patterns for any framework
- **Initialization Order**: VytchesDDD always initialized first
- **Clean Boundaries**: Clear separation between domain and framework concerns

## Common Pitfalls

- **Double Instance Risk**: Never use both framework DI and VytchesDDD DI for the same service
- **Initialization Order**: Always initialize VytchesDDD before framework DI
- **Service Leakage**: Keep domain services framework-agnostic
- **Circular Dependencies**: Avoid circular dependencies between adapters
- **Context Confusion**: Ensure proper context isolation between frameworks

## Related Examples

- [Context Isolation](../intermediate/example-2.md) - Bounded context support
- [Custom Container Implementation](./example-2.md) - Building custom containers
- [Enterprise Production Patterns](./example-3.md) - Production-ready patterns
```



## Use Cases

## Use Case Example for @vytches-ddd/di

This example shows how to use the di package in your application:

```typescript
import { VytchesDDD } from '@vytches-ddd/di';

// Initialize the service
const service = new VytchesDDD();

// Use the service
const result = await service.execute({
  // Your input data
});

if (result.isSuccess()) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.message);
}
```


## Common Pitfalls

### 🕳️ Pitfall 1: Service Locator Anti-Pattern

**Problem**: Using DI container as a global service locator everywhere.

```typescript
// ❌ WRONG: Service locator abuse
class SomeService {
  doSomething() {
    const otherService = VytchesDDD.resolve('otherService');
    // This creates hidden dependencies
  }
}
```

**Solution**: Use constructor injection.

```typescript
// ✅ CORRECT: Constructor injection
class SomeService {
  constructor(private otherService: OtherService) {}
  
  doSomething() {
    this.otherService.doSomething();
  }
}
```

### 🕳️ Pitfall 2: Circular Dependencies

**Problem**: Services depending on each other circularly.

**Solution**: Refactor to break the cycle or use events for decoupling.

### 🕳️ Pitfall 3: Framework Lock-in

**Problem**: Making domain logic dependent on DI framework.

**Solution**: Use interfaces and keep domain logic DI-agnostic.

## Troubleshooting

## Troubleshooting

### 🔍 Problem: Service Not Found

**Symptoms**: `Service 'myService' not found in container`

**Solution**:
1. Check if service is registered with `@DomainService`
2. Verify VytchesDDD.configure() was called
3. Check service ID matches registration

### 🔍 Problem: Circular Dependencies

**Symptoms**: `Circular dependency detected`

**Solutions**:
1. Use factory pattern to break cycles
2. Refactor to remove circular dependencies
3. Use events for decoupling

### 🔍 Problem: Framework Integration Issues

**Symptoms**: Services not working with NestJS/Express

**Solutions**:
1. Use Bridge Pattern for framework integration
2. Initialize VytchesDDD before framework DI
3. Don't mix framework and VytchesDDD DI decorators

### 🔍 Problem: Performance Issues

**Symptoms**: Slow service resolution

**Solutions**:
1. Use singleton lifetime for expensive services
2. Avoid recursive service resolution
3. Profile container performance

## Performance Considerations

## Performance Considerations

### ⚡ Optimization Strategies

#### 1. **Service Lifetimes**
Choose appropriate lifetimes for services.

```typescript
// ✅ Singleton for expensive services
@DomainService('expensiveService', { 
  lifetime: ServiceLifetime.Singleton 
})
class ExpensiveService {
  // Heavy initialization
}

// ✅ Transient for lightweight services
@DomainService('lightService', { 
  lifetime: ServiceLifetime.Transient 
})
class LightService {
  // Light operations
}
```

#### 2. **Lazy Loading**
Load services only when needed.

#### 3. **Service Resolution**
Minimize service resolution in hot paths.

#### 4. **Memory Management**
Properly dispose of services when no longer needed.

### 📊 Performance Metrics

- **Service Resolution**: < 0.1ms per service lookup
- **Memory Usage**: Monitor singleton service memory
- **Container Size**: Keep container lean
- **Registration Time**: Optimize startup performance

---

*Generated with @vytches-ddd/cli on 2025-07-18T12:03:27.861Z*  
