# Framework Integration Patterns - Advanced Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: advanced  
**Domain**: Enterprise Multi-Framework Architecture  
**Patterns**: Framework Integration, Adapter Pattern, Bridge Pattern  
**Dependencies**: @vytches-ddd/di, NestJS, InversifyJS, TSyringe

## Description

This example demonstrates advanced patterns for integrating VytchesDDD's DI
system with popular frameworks like NestJS, InversifyJS, and TSyringe. It shows
how to create adapters, avoid double instance risks, and maintain clean
boundaries between framework and domain services.

## Business Context

Enterprise applications often need to integrate with multiple frameworks or
migrate between them. Using adapter patterns allows you to keep your domain
logic framework-agnostic while leveraging each framework's strengths. This
approach provides flexibility and reduces migration costs.

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
  dependencies: ['auditService', 'validationService'],
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
      updatedAt: new Date(),
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
      updatedAt: new Date(),
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
    this.userDomainService =
      VytchesDDD.resolve<UserDomainService>('userDomainService');
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
    this.container
      .bind<UserDomainService>('UserDomainService')
      .toDynamicValue(() => {
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
      useFactory: () =>
        VytchesDDD.resolve<UserDomainService>('userDomainService'),
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
    private userDomainService: UserDomainService = container.resolve<UserDomainService>(
      'UserDomainService'
    )
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
import {
  NestJSVytchesDDDAdapter,
  NestJSUserService,
} from '../adapters/nestjs-adapter';
import {
  InversifyVytchesDDDAdapter,
  InversifyUserService,
} from '../adapters/inversify-adapter';
import {
  TSyringeVytchesDDDAdapter,
  TSyringeUserService,
} from '../adapters/tsyringe-adapter';
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
      name: 'NestJS User',
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

    const inversifyService =
      container.get<InversifyUserService>(InversifyUserService);

    const userData: CreateUserData = {
      email: 'inversify@example.com',
      name: 'InversifyJS User',
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
      name: 'TSyringe User',
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

    const userService =
      this.genericAdapter.getBridgeService<UserDomainService>(
        'userDomainService'
      );

    const userData: CreateUserData = {
      email: 'generic@example.com',
      name: 'Generic User',
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

- **Double Instance Risk**: Never use both framework DI and VytchesDDD DI for
  the same service
- **Initialization Order**: Always initialize VytchesDDD before framework DI
- **Service Leakage**: Keep domain services framework-agnostic
- **Circular Dependencies**: Avoid circular dependencies between adapters
- **Context Confusion**: Ensure proper context isolation between frameworks

## Related Examples

- [Context Isolation](../intermediate/example-2.md) - Bounded context support
- [Custom Container Implementation](./example-2.md) - Building custom containers
- [Enterprise Production Patterns](./example-3.md) - Production-ready patterns
