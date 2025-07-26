# Framework Integration Adapters

This document provides comprehensive guidance for integrating `@vytches/ddd-di`
with popular dependency injection frameworks.

## Supported Frameworks

- [NestJS](#nestjs-integration)
- [InversifyJS](#inversifyjs-integration)
- [TSyringe](#tsyringe-integration)
- [Awilix](#awilix-integration)
- [Custom Framework](#custom-framework-integration)

---

## NestJS Integration

### Installation

```bash
pnpm add @vytches/ddd-di @nestjs/core @nestjs/common
```

### NestJS Container Adapter

```typescript
// src/di/nestjs-container-adapter.ts
import { ModuleRef } from '@nestjs/core';
import { Injectable } from '@nestjs/common';
import { BaseContainerAdapter } from '@vytches/ddd-di';
import {
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceDescriptor,
  ServiceRegistrationOptions,
} from '@vytches/ddd-di';

@Injectable()
export class NestJSContainerAdapter extends BaseContainerAdapter {
  private readonly serviceDescriptors = new Map<string, ServiceDescriptor>();

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);
    const tokenKey = this.getTokenKey(token);

    try {
      // NestJS supports both strict and non-strict resolution
      return this.moduleRef.get(token, { strict: false });
    } catch (error) {
      throw new ServiceNotFoundError(token);
    }
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    // NestJS handles registration through module system
    // This adapter primarily focuses on resolution
    // Store metadata for tracking
    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      context: options?.context,
      tags: options?.tags,
    };

    this.serviceDescriptors.set(this.getTokenKey(token), descriptor);
  }

  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void {
    // NestJS factories are typically handled through providers
    const descriptor: ServiceDescriptor<T> = {
      token,
      factory,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      context: options?.context,
      tags: options?.tags,
    };

    this.serviceDescriptors.set(this.getTokenKey(token), descriptor);
  }

  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    // NestJS instances handled through useValue providers
    const descriptor: ServiceDescriptor<T> = {
      token,
      instance,
      lifetime: ServiceLifetime.Singleton,
      context: options?.context,
      tags: options?.tags,
    };

    this.serviceDescriptors.set(this.getTokenKey(token), descriptor);
  }

  isRegistered<T>(token: ServiceToken<T>): boolean {
    try {
      this.moduleRef.get(token, { strict: false });
      return true;
    } catch {
      return false;
    }
  }

  getServices(): ServiceDescriptor[] {
    return Array.from(this.serviceDescriptors.values());
  }
}
```

### NestJS Module Setup

```typescript
// src/modules/di.module.ts
import { Module, Global } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VytchesDDD } from '@vytches/ddd-di';
import { NestJSContainerAdapter } from '../di/nestjs-container-adapter';

@Global()
@Module({
  providers: [
    {
      provide: 'DI_CONTAINER_ADAPTER',
      useFactory: (moduleRef: ModuleRef) => {
        const adapter = new NestJSContainerAdapter(moduleRef);
        VytchesDDD.configure(adapter);
        return adapter;
      },
      inject: [ModuleRef],
    },
  ],
  exports: ['DI_CONTAINER_ADAPTER'],
})
export class DIModule {}
```

### Usage in NestJS Services

```typescript
// src/services/user.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

@Injectable()
export class UserService {
  async createUser(userData: CreateUserDto): Promise<User> {
    // Resolve through VytchesDDD service locator
    const repository = VytchesDDD.resolve<UserRepository>('UserRepository');
    const emailService = VytchesDDD.resolve<EmailService>('EmailService');

    const user = await repository.save(new User(userData));
    await emailService.sendWelcomeEmail(user.email);

    return user;
  }
}
```

### NestJS Module Registration

```typescript
// src/modules/user.module.ts
import { Module } from '@nestjs/common';
import { DIModule } from './di.module';

@Module({
  imports: [DIModule],
  providers: [
    UserService,
    {
      provide: 'UserRepository',
      useClass: TypeOrmUserRepository,
    },
    {
      provide: 'EmailService',
      useClass: SMTPEmailService,
      scope: Scope.DEFAULT, // Singleton
    },
  ],
  exports: [UserService],
})
export class UserModule {}
```

---

## InversifyJS Integration

### Installation

```bash
pnpm add @vytches/ddd-di inversify reflect-metadata
```

### InversifyJS Setup

```typescript
// src/di/inversify.config.ts
import { Container } from 'inversify';
import { InversifyContainerAdapter, VytchesDDD } from '@vytches/ddd-di';
import 'reflect-metadata';

// Create and configure Inversify container
const container = new Container();

// Register services with Inversify
container
  .bind<UserRepository>('UserRepository')
  .to(TypeOrmUserRepository)
  .inSingletonScope();
container
  .bind<EmailService>('EmailService')
  .to(SMTPEmailService)
  .inSingletonScope();
container.bind<UserService>('UserService').to(UserService).inTransientScope();

// Create adapter and configure VytchesDDD
const adapter = new InversifyContainerAdapter(container);
VytchesDDD.configure(adapter);

export { container, adapter };
```

### Service Registration with Inversify

```typescript
// src/services/user.service.ts
import { injectable, inject } from 'inversify';

@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('EmailService') private emailService: EmailService
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    // Traditional constructor injection with Inversify
    const user = await this.userRepository.save(new User(userData));
    await this.emailService.sendWelcomeEmail(user.email);
    return user;
  }
}

// Alternative: Service Locator pattern
@injectable()
export class OrderService {
  async processOrder(orderId: string): Promise<void> {
    // Use VytchesDDD service locator when needed
    const paymentService = VytchesDDD.resolve<PaymentService>('PaymentService');
    const auditService = VytchesDDD.resolve<AuditService>('AuditService');

    await paymentService.processPayment(orderId);
    await auditService.logOrderProcessed(orderId);
  }
}
```

### Context-Specific Containers

```typescript
// src/di/context-containers.ts
import { Container } from 'inversify';
import { InversifyContainerAdapter, VytchesDDD } from '@vytches/ddd-di';

// Order Management Context
const orderContainer = new Container();
orderContainer
  .bind<SpecialOrderService>('SpecialOrderService')
  .to(SpecialOrderService);
orderContainer.bind<OrderValidator>('OrderValidator').to(ComplexOrderValidator);

const orderAdapter = new InversifyContainerAdapter(orderContainer);
VytchesDDD.configureContext('OrderManagement', orderAdapter);

// User Management Context
const userContainer = new Container();
userContainer.bind<UserAnalytics>('UserAnalytics').to(AdvancedUserAnalytics);
userContainer.bind<UserValidator>('UserValidator').to(EnterpriseUserValidator);

const userAdapter = new InversifyContainerAdapter(userContainer);
VytchesDDD.configureContext('UserManagement', userAdapter);
```

---

## TSyringe Integration

### Installation

```bash
pnpm add @vytches/ddd-di tsyringe reflect-metadata
```

### TSyringe Setup

```typescript
// src/di/tsyringe.config.ts
import { container } from 'tsyringe';
import { TSyringeContainerAdapter, VytchesDDD } from '@vytches/ddd-di';
import 'reflect-metadata';

// Register services with TSyringe
container.registerSingleton<UserRepository>(
  'UserRepository',
  TypeOrmUserRepository
);
container.registerSingleton<EmailService>('EmailService', SMTPEmailService);
container.register<UserService>('UserService', UserService);

// Create adapter and configure VytchesDDD
const adapter = new TSyringeContainerAdapter(container);
VytchesDDD.configure(adapter);

export { container, adapter };
```

### Service Registration with TSyringe

```typescript
// src/services/user.service.ts
import { injectable, inject } from 'tsyringe';

@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('EmailService') private emailService: EmailService
  ) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(new User(userData));
    await this.emailService.sendWelcomeEmail(user.email);
    return user;
  }
}
```

### Factory Registration

```typescript
// src/di/factories.ts
import { container } from 'tsyringe';

// Register factory with TSyringe
container.register('DatabaseService', {
  useFactory: container => {
    const config = container.resolve<Config>('Config');
    const logger = container.resolve<Logger>('Logger');
    return new DatabaseService(config.connectionString, logger);
  },
});
```

---

## Awilix Integration

### Installation

```bash
pnpm add @vytches/ddd-di awilix
```

### Custom Awilix Adapter

```typescript
// src/di/awilix-container-adapter.ts
import { BaseContainerAdapter } from '@vytches/ddd-di';
import { AwilixContainer } from 'awilix';

export class AwilixContainerAdapter extends BaseContainerAdapter {
  private readonly serviceDescriptors = new Map<string, ServiceDescriptor>();

  constructor(private readonly container: AwilixContainer) {
    super();
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);

    try {
      return this.container.resolve(this.getTokenKey(token));
    } catch (error) {
      throw new ServiceNotFoundError(token);
    }
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    const tokenKey = this.getTokenKey(token);
    const lifetime = options?.lifetime || ServiceLifetime.Transient;

    const registration = {
      [tokenKey]: this.mapLifetime(lifetime, implementation),
    };

    this.container.register(registration);

    // Store descriptor
    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime,
      context: options?.context,
      tags: options?.tags,
    };

    this.serviceDescriptors.set(tokenKey, descriptor);
  }

  private mapLifetime(lifetime: ServiceLifetime, implementation: Constructor) {
    switch (lifetime) {
      case ServiceLifetime.Singleton:
        return awilix.asClass(implementation).singleton();
      case ServiceLifetime.Scoped:
        return awilix.asClass(implementation).scoped();
      case ServiceLifetime.Transient:
      default:
        return awilix.asClass(implementation).transient();
    }
  }

  // Implement other required methods...
}
```

### Awilix Setup

```typescript
// src/di/awilix.config.ts
import { createContainer, asClass, asFunction, asValue } from 'awilix';
import { AwilixContainerAdapter, VytchesDDD } from '@vytches/ddd-di';

const container = createContainer();

// Register services with Awilix
container.register({
  userRepository: asClass(TypeOrmUserRepository).singleton(),
  emailService: asClass(SMTPEmailService).singleton(),
  userService: asClass(UserService).transient(),

  // Factory registration
  databaseService: asFunction(({ config, logger }) => {
    return new DatabaseService(config.connectionString, logger);
  }).singleton(),
});

const adapter = new AwilixContainerAdapter(container);
VytchesDDD.configure(adapter);
```

---

## Custom Framework Integration

### Creating a Custom Adapter

```typescript
// src/di/my-framework-adapter.ts
import { BaseContainerAdapter } from '@vytches/ddd-di';

export class MyFrameworkAdapter extends BaseContainerAdapter {
  private readonly services = new Map<string, ServiceDescriptor>();
  private readonly instances = new Map<string, any>();

  constructor(private readonly myContainer: MyContainer) {
    super();
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);
    const tokenKey = this.getTokenKey(token);

    // Try framework's native resolution first
    if (this.myContainer.has(tokenKey)) {
      return this.myContainer.get<T>(tokenKey);
    }

    // Fallback to manual resolution
    const descriptor = this.services.get(tokenKey);
    if (!descriptor) {
      throw new ServiceNotFoundError(token);
    }

    return this.createInstance<T>(descriptor);
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    const tokenKey = this.getTokenKey(token);

    // Register with your framework
    this.myContainer.bind(tokenKey, implementation);

    // Store descriptor for metadata
    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      context: options?.context,
      tags: options?.tags,
    };

    this.services.set(tokenKey, descriptor);
  }

  private createInstance<T>(descriptor: ServiceDescriptor<T>): T {
    // Implement instance creation logic based on your framework's capabilities
    if (descriptor.instance) {
      return descriptor.instance;
    }

    if (descriptor.factory) {
      return descriptor.factory(this);
    }

    if (descriptor.implementation) {
      return new descriptor.implementation();
    }

    throw new Error('No implementation available');
  }

  // Implement other required methods...
}
```

### Framework-Specific Features

```typescript
// src/di/framework-extensions.ts
export class EnhancedFrameworkAdapter extends MyFrameworkAdapter {
  // Add framework-specific features

  registerWithMetadata<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    metadata: FrameworkMetadata
  ): void {
    // Use framework's metadata system
    this.myContainer.bindWithMetadata(token, implementation, metadata);

    // Register with VytchesDDD
    this.register(token, implementation, {
      tags: metadata.tags,
      context: metadata.context,
    });
  }

  resolveWithInterception<T>(token: ServiceToken<T>): T {
    // Apply framework interceptors
    const instance = this.resolve<T>(token);
    return this.myContainer.applyInterceptors(instance);
  }
}
```

---

## Best Practices

### 1. Adapter Selection Guidelines

**Use NestJS Adapter when:**

- Building NestJS applications
- Need integration with NestJS modules and guards
- Want to leverage NestJS's powerful DI system

**Use InversifyJS Adapter when:**

- Need advanced DI features (aspects, decorators)
- Building enterprise applications with complex DI requirements
- Want strong typing and interface-based programming

**Use TSyringe Adapter when:**

- Need lightweight DI solution
- Building Node.js applications outside frameworks
- Want Microsoft-supported DI container

**Use SimpleContainer when:**

- Testing scenarios
- Simple applications without complex DI needs
- Learning DDD patterns

### 2. Hybrid Approaches

```typescript
// Combine multiple containers for different concerns
const mainContainer = new SimpleContainer();
const nestAdapter = new NestJSContainerAdapter(moduleRef);

// Use NestJS for web layer
VytchesDDD.configure(nestAdapter);

// Use SimpleContainer for domain contexts
const orderContainer = new SimpleContainer();
VytchesDDD.configureContext('OrderManagement', orderContainer);
```

### 3. Migration Strategies

**Gradual Migration:**

```typescript
// Phase 1: Keep existing DI, add VytchesDDD
const legacyContainer = getLegacyContainer();
const adapter = new LegacyContainerAdapter(legacyContainer);
VytchesDDD.configure(adapter);

// Phase 2: Migrate services one by one
VytchesDDD.resolve<NewService>('NewService'); // New pattern
legacyContainer.get<OldService>('OldService'); // Old pattern

// Phase 3: Complete migration
// Remove legacy container, use only VytchesDDD
```

### 4. Testing with Adapters

```typescript
describe('Service with Framework Adapter', () => {
  let adapter: MyFrameworkAdapter;
  let mockContainer: MockContainer;

  beforeEach(() => {
    mockContainer = new MockContainer();
    adapter = new MyFrameworkAdapter(mockContainer);
    VytchesDDD.configure(adapter);
  });

  afterEach(() => {
    VytchesDDD.reset();
  });

  it('should resolve service through adapter', () => {
    const mockService = { test: 'value' };
    mockContainer.register('TestService', mockService);

    const resolved = VytchesDDD.resolve<any>('TestService');
    expect(resolved).toBe(mockService);
  });
});
```

---

## Performance Considerations

1. **Adapter Overhead**: Each adapter adds minimal overhead for translation
2. **Caching**: Framework containers handle their own caching
3. **Resolution Path**: Context resolution → Framework resolution → Error
4. **Memory Usage**: Adapters store minimal metadata for VytchesDDD features

---

## Troubleshooting

### Common Issues

**1. Service Not Found Errors**

```typescript
// Check registration in both framework and VytchesDDD
console.log('Framework registered:', myContainer.has('ServiceName'));
console.log('VytchesDDD registered:', VytchesDDD.isRegistered('ServiceName'));
```

**2. Circular Dependencies**

```typescript
// Framework containers handle circular dependencies differently
// Test with your specific container implementation
```

**3. Lifetime Mismatches**

```typescript
// Ensure lifetime mapping is correct for your framework
// Some frameworks have different lifetime semantics
```

### Debug Logging

```typescript
import { Logger } from '@vytches/ddd-logging';

// Enable debug logging for DI operations
Logger.configure({
  level: 'debug',
  contexts: ['*Adapter', 'ServiceLocator'],
});
```

---

## Framework Comparison

| Feature         | NestJS | InversifyJS | TSyringe | Awilix | SimpleContainer |
| --------------- | ------ | ----------- | -------- | ------ | --------------- |
| Auto-discovery  | ✅     | ✅          | ✅       | ✅     | ❌              |
| Decorators      | ✅     | ✅          | ✅       | ❌     | ❌              |
| Scoped lifetime | ✅     | ✅          | ❌       | ✅     | ✅              |
| Factory support | ✅     | ✅          | ✅       | ✅     | ✅              |
| Circular deps   | ✅     | ✅          | ✅       | ✅     | ❌              |
| Bundle size     | Large  | Medium      | Small    | Small  | Tiny            |
| Learning curve  | High   | Medium      | Low      | Low    | Very Low        |

Choose the adapter that best fits your application's needs and constraints.
