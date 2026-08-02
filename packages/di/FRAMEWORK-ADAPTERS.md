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

## Token Identity (Read This Before Writing an Adapter)

Since VF-030 (see ADR-0038), token identity is the **token reference itself** —
never a derived string:

- Adapter-internal maps are keyed by `ServiceToken` directly:
  `Map<ServiceToken, ServiceDescriptor>`. Function/class and symbol tokens key
  by reference; string tokens key by value.
- Two classes that share a `.name` (a normal outcome of per-bounded-context
  Ubiquitous Language) are **distinct** registrations.
- `Symbol('X')` and `Symbol('X')` are **distinct** registrations — they no
  longer collide via their `"Symbol(X)"` string rendering.
- There is **no** `.name` fallback on lookup miss. An unregistered token throws
  `ContainerServiceNotFoundError`.

### `getTokenKey()` is deprecated — display only

`BaseContainerAdapter.getTokenKey(token)` used to be the map key. It is now
**deprecated** and kept only as a human-readable display helper (error messages,
logs); its output is intentionally lossy and MUST NOT be used as a lookup key.

**Migration for existing custom adapters:**

```typescript
// BEFORE (collision-prone — do not do this anymore)
private readonly services = new Map<string, ServiceDescriptor>();
this.services.set(this.getTokenKey(token), descriptor);
const descriptor = this.services.get(this.getTokenKey(token));

// AFTER (reference identity — VF-030)
private readonly services = new Map<ServiceToken, ServiceDescriptor>();
this.services.set(token, descriptor);
const descriptor = this.services.get(token);

// getTokenKey() remains fine for DISPLAY:
throw new Error(`Failed while resolving ${this.getTokenKey(token)}`);
```

No public signature changed — `getTokenKey()` still exists and still returns a
string — but any adapter using it as a map key inherits the collision bug that
VF-030 removed from the built-in adapters.

### Recipe: `Symbol.for()` for cross-context and dual-format tokens

Reference identity requires the registering and resolving sides to see the
**same token object**. Two situations break that — and both have the same fix:

1. **Dual ESM/CJS double-load**: in mixed module graphs (Vitest, apps that reach
   a dual-format package via both `import` and `require`), the package can load
   twice, so `export const CACHE = Symbol('CACHE')` (or a class used as its own
   token) exists as two distinct references.
2. **Tokens intentionally shared across bounded contexts** (platform-wide clock,
   ID generator, …).

Declare such tokens with `Symbol.for()` — the process-wide global symbol
registry returns the same symbol for the same key, across module-graph copies
and realms:

```typescript
// tokens.ts — shared token, stable across ESM/CJS double-load
export const CLOCK_TOKEN = Symbol.for('myapp:platform:clock');

// context A
container.registerInstance(CLOCK_TOKEN, systemClock);

// context B (even if it loaded the package through a different format)
const clock = container.resolve(Symbol.for('myapp:platform:clock'));
```

Always namespace the key (`'org:context:service'`) — the registry is
process-global. Use plain `Symbol('X')` only when you _want_ private,
unshareable identity.

**Caveat:** reference identity holds within one process/realm. It does not
survive process boundaries, `vm` realms (except `Symbol.for()`, whose registry
is shared across realms in one process), or serialization. For cross-process
contracts, use explicit string tokens at the boundary.

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
  // VF-030: keyed by the token itself (reference identity), never by a
  // derived string — see "Token Identity" above.
  private readonly serviceDescriptors = new Map<
    ServiceToken,
    ServiceDescriptor
  >();

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);

    try {
      // NestJS supports both strict and non-strict resolution
      return this.moduleRef.get(token, { strict: false });
    } catch (error) {
      throw new ContainerServiceNotFoundError(token);
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

    this.serviceDescriptors.set(token, descriptor);
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

    this.serviceDescriptors.set(token, descriptor);
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

    this.serviceDescriptors.set(token, descriptor);
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

### Caveat: auto-discovery must not target a ModuleRef-holding adapter

The shipped `NestJSContainerAdapter` (in `@vytches/ddd-nestjs`) resolves
**registry-first** since VP-006b: a token registered on the adapter itself wins
over the NestJS container, and `ModuleRef` is only the fallback for tokens the
adapter does not own (ADR-0014 — VytchesDDD as primary container).

Because of that precedence, do **NOT** point handler/service auto-discovery (any
`discoverAndRegisterHandlers`-style routine that registers bare class tokens as
Transient) at a container adapter that ALSO holds a `ModuleRef`. Registry-first
resolution would then construct dependency-less Transient instances from those
bare class registrations, **shadowing the framework's fully-injected
singletons**. Keep auto-discovery on a dedicated container (e.g. a
`SimpleContainer`), or register the live framework instances via
`registerInstance()` instead of class tokens.

As a safety net, in non-production environments (`NODE_ENV !== 'production'`)
the adapter logs a one-time-per-token warning when it detects a divergent dual
registration — the same token resolvable in both the internal registry and the
NestJS container with different instances. Fix the warning by dropping one of
the two registrations.

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
  // VF-030: the adapter's OWN descriptor map is reference-keyed.
  private readonly serviceDescriptors = new Map<
    ServiceToken,
    ServiceDescriptor
  >();

  constructor(private readonly container: AwilixContainer) {
    super();
  }

  // NOTE: Awilix's native registry is string-keyed — the framework itself
  // requires a string name. Deriving that name from a class/symbol token
  // reintroduces the `.name` collision on the FRAMEWORK side, so prefer
  // explicit STRING tokens with Awilix; the derivation below is a
  // convenience for the single-context case only.
  private toAwilixName(token: ServiceToken): string {
    if (typeof token !== 'string') {
      throw new InvalidRegistrationError(
        this.getTokenKey(token), // display-only rendering
        'AwilixContainerAdapter requires string tokens (Awilix registry is string-keyed)'
      );
    }
    return token;
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);

    try {
      return this.container.resolve(this.toAwilixName(token));
    } catch (error) {
      throw new ContainerServiceNotFoundError(token);
    }
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    const awilixName = this.toAwilixName(token);
    const lifetime = options?.lifetime || ServiceLifetime.Transient;

    const registration = {
      [awilixName]: this.mapLifetime(lifetime, implementation),
    };

    this.container.register(registration);

    // Store descriptor — keyed by the token itself (VF-030)
    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime,
      context: options?.context,
      tags: options?.tags,
    };

    this.serviceDescriptors.set(token, descriptor);
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
  // VF-030: reference-keyed maps — the token IS the key.
  // Never key by getTokenKey() (deprecated, display-only).
  private readonly services = new Map<ServiceToken, ServiceDescriptor>();
  private readonly instances = new Map<ServiceToken, any>();

  constructor(private readonly myContainer: MyContainer) {
    super();
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.validateToken(token);

    // Try framework's native resolution first
    if (this.myContainer.has(token)) {
      return this.myContainer.get<T>(token);
    }

    // Fallback to manual resolution — keyed by the token itself
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new ContainerServiceNotFoundError(token);
    }

    return this.createInstance<T>(descriptor);
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    // Register with your framework (pass the token through unchanged if the
    // framework supports arbitrary token types; only stringify — losing
    // identity — when the framework's registry is string-only, and prefer
    // string tokens in that case)
    this.myContainer.bind(token, implementation);

    // Store descriptor for metadata — keyed by the token itself (VF-030)
    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      context: options?.context,
      tags: options?.tags,
    };

    this.services.set(token, descriptor);
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
