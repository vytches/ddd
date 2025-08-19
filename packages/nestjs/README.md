# @vytches/ddd-nestjs

NestJS adapter for VytchesDDD - Enterprise Domain-Driven Design framework
integration.

[![npm version](https://badge.fury.io/js/@vytches%2Fddd-nestjs.svg)](https://www.npmjs.com/package/@vytches/ddd-nestjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The `@vytches/ddd-nestjs` package provides seamless integration between NestJS
and VytchesDDD, enabling you to leverage Domain-Driven Design patterns in your
NestJS applications with enterprise-grade features.

### Key Features

- **Bridge Pattern Integration**: Seamless connection between NestJS DI and
  VytchesDDD service locator
- **Auto-Discovery**: Automatic detection and registration of DDD decorators
  (`@DomainService`, `@CommandHandler`, `@QueryHandler`)
- **CQRS Integration**: Built-in Command and Query bus configuration with
  middleware support
- **Event System**: Unified event bus integration for domain and integration
  events
- **Testing Support**: Dedicated testing module with mocking capabilities
- **Zero Configuration**: Works out of the box with sensible defaults
- **Enterprise Ready**: Production-grade features with observability and
  resilience patterns

## Installation

```bash
npm install @vytches/ddd-nestjs @vytches/ddd-core
# or
yarn add @vytches/ddd-nestjs @vytches/ddd-core
# or
pnpm add @vytches/ddd-nestjs @vytches/ddd-core
```

### Peer Dependencies

The package requires the following peer dependencies:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick Start

### 1. Basic Setup

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      autoDiscovery: true,
      cqrs: {
        autoRegisterHandlers: true,
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Create a Domain Service

```typescript
// user.service.ts
import { DomainService } from '@vytches/ddd-di';
import { User, CreateUserData } from './types';

@DomainService('userService', {
  context: 'UserManagement',
})
export class UserService {
  async createUser(userData: CreateUserData): Promise<User> {
    // Domain logic implementation
    return User.create(userData);
  }
}
```

### 3. Create a NestJS Controller (Bridge Pattern)

```typescript
// user.controller.ts
import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { UserService } from './user.service';
import { CreateUserData, User } from './types';

@Injectable()
@Controller('users')
export class UserController {
  private readonly userService: UserService;

  constructor() {
    // Bridge Pattern: Get existing instance from VytchesDDD
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }

  @Post()
  async createUser(@Body() userData: CreateUserData): Promise<User> {
    return await this.userService.createUser(userData);
  }
}
```

## Configuration

### forRoot() Configuration

```typescript
VytchesDDDModule.forRoot({
  // Auto-discovery configuration
  autoDiscovery: {
    enabled: true,
    patterns: ['**/*.service.ts', '**/*.handler.ts'],
    contexts: ['UserManagement', 'OrderProcessing'],
    exclude: ['**/*.spec.ts', '**/*.test.ts'],
  },

  // CQRS configuration
  cqrs: {
    autoRegisterHandlers: true,
    middleware: [
      {
        class: LoggingMiddleware,
        options: { logLevel: 'debug' },
      },
      {
        class: ValidationMiddleware,
        contexts: ['UserManagement'],
      },
    ],
    commandBus: {
      timeout: 30000,
      retries: 3,
    },
    queryBus: {
      timeout: 15000,
      cache: true,
    },
  },

  // Event system configuration
  events: {
    eventStore: {
      type: 'memory', // 'memory' | 'postgresql' | 'mongodb'
      config: {},
    },
    eventBus: {
      type: 'unified',
      config: {},
    },
    replay: false,
  },

  // Messaging configuration
  messaging: {
    provider: 'memory', // 'redis' | 'rabbitmq' | 'kafka' | 'memory'
    config: {},
    sagas: true,
  },

  // Container configuration
  container: {
    strict: true,
    debug: false,
  },
});
```

### forRootAsync() Configuration

For dynamic configuration with dependency injection:

```typescript
// config.service.ts
import { Injectable } from '@nestjs/common';
import {
  VytchesDDDOptionsFactory,
  VytchesDDDOptions,
} from '@vytches/ddd-nestjs';

@Injectable()
export class VytchesDDDConfigService implements VytchesDDDOptionsFactory {
  createVytchesDDDOptions(): VytchesDDDOptions {
    return {
      autoDiscovery: process.env.NODE_ENV !== 'production',
      cqrs: {
        autoRegisterHandlers: true,
        commandBus: {
          timeout: parseInt(process.env.COMMAND_TIMEOUT || '30000'),
        },
      },
    };
  }
}

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    VytchesDDDModule.forRootAsync({
      imports: [ConfigModule],
      useClass: VytchesDDDConfigService,
    }),
  ],
})
export class AppModule {}
```

### forFeature() for Module Organization

```typescript
// user.module.ts
@Module({
  imports: [
    VytchesDDDModule.forFeature({
      services: [UserService, UserValidationService],
      handlers: [CreateUserHandler, GetUserHandler],
      eventHandlers: [UserCreatedHandler],
      context: 'UserManagement',
    }),
  ],
  controllers: [UserController],
})
export class UserModule {}
```

## Integration Patterns

### Bridge Pattern (Recommended)

The Bridge Pattern prevents double instance issues and maintains clear
separation between framework and domain logic:

```typescript
@Injectable()
@Controller('orders')
export class OrderController {
  private readonly orderService: OrderService;

  constructor() {
    // ✅ Bridge Pattern: Get existing instance from VytchesDDD
    this.orderService = VytchesDDD.resolve<OrderService>('orderService');
  }

  @Post()
  async createOrder(@Body() orderData: CreateOrderData) {
    // Delegate to domain service
    const result = await this.orderService.createOrder(orderData);

    if (result.isFailure()) {
      throw new BadRequestException(result.error.message);
    }

    return result.value;
  }
}
```

### CQRS Integration

```typescript
// Command Handler with auto-discovery
@CommandHandler(CreateUserCommand, {
  context: 'UserManagement',
  timeout: 30000,
})
export class CreateUserHandler {
  constructor(private readonly userService: UserService) {}

  async execute(command: CreateUserCommand): Promise<Result<User, Error>> {
    return await this.userService.createUser(command.data);
  }
}

// Controller using Command Bus
@Injectable()
@Controller('users')
export class UserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createUser(@Body() userData: CreateUserData) {
    const command = new CreateUserCommand(userData);
    return await this.commandBus.execute(command);
  }
}
```

### Event-Driven Architecture

```typescript
// Domain service with events
@DomainService('orderService')
export class OrderService {
  constructor(private readonly eventBus: UnifiedEventBus) {}

  async createOrder(orderData: CreateOrderData): Promise<Result<Order, Error>> {
    const order = Order.create(orderData);

    // Publish domain event
    await this.eventBus.publish(
      new OrderCreatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        amount: order.totalAmount,
      })
    );

    return Result.success(order);
  }
}

// Event Handler
@EventHandler(OrderCreatedEvent)
export class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent): Promise<void> {
    // Handle the event (send email, update inventory, etc.)
    console.log(`Order ${event.payload.orderId} created`);
  }
}
```

## Testing

### Unit Testing with forTest()

```typescript
// order.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let module: TestingModule;

  beforeEach(async () => {
    const mockPaymentService = {
      processPayment: vi.fn().mockResolvedValue({ success: true }),
    };

    module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forTest({
          mocks: {
            paymentService: mockPaymentService,
          },
          debug: true,
        }),
      ],
      providers: [OrderService],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should create order successfully', async () => {
    const orderData = { customerId: '123', items: [] };
    const result = await service.createOrder(orderData);

    expect(result.isSuccess()).toBe(true);
    expect(result.value.customerId).toBe('123');
  });
});
```

### Integration Testing

```typescript
// app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/users (POST)', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John Doe', email: 'john@example.com' })
      .expect(201)
      .expect(res => {
        expect(res.body.name).toBe('John Doe');
        expect(res.body.id).toBeDefined();
      });
  });
});
```

## Migration Guide

### From Vanilla NestJS to VytchesDDD

#### Before (Vanilla NestJS)

```typescript
// user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private eventEmitter: EventEmitter2
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    const user = this.userRepository.create(userData);
    await this.userRepository.save(user);

    this.eventEmitter.emit('user.created', { userId: user.id });

    return user;
  }
}
```

#### After (With VytchesDDD)

```typescript
// user.service.ts
@DomainService('userService', {
  context: 'UserManagement',
})
export class UserService {
  constructor(
    private userRepository: IUserRepository,
    private eventBus: UnifiedEventBus
  ) {}

  async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
    try {
      const user = User.create(userData);
      await this.userRepository.save(user);

      await this.eventBus.publish(
        new UserCreatedEvent({
          userId: user.id,
          email: user.email,
        })
      );

      return Result.success(user);
    } catch (error) {
      return Result.failure(new UserCreationError(error.message));
    }
  }
}

// user.controller.ts (Bridge Pattern)
@Injectable()
@Controller('users')
export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }

  @Post()
  async createUser(@Body() userData: CreateUserData) {
    const result = await this.userService.createUser(userData);

    if (result.isFailure()) {
      throw new BadRequestException(result.error.message);
    }

    return result.value;
  }
}
```

## API Reference

### VytchesDDDModule

#### Static Methods

- **`forRoot(options?: VytchesDDDOptions): DynamicModule`**

  - Configure the module for the root application
  - Sets up global VytchesDDD integration

- **`forRootAsync(options: VytchesDDDAsyncOptions): DynamicModule`**

  - Configure the module asynchronously with dependency injection
  - Supports factory functions and configuration services

- **`forFeature(options: VytchesDDDFeatureOptions): DynamicModule`**

  - Configure feature-specific services and handlers
  - Used in feature modules for organization

- **`forTest(options?: VytchesDDDTestOptions): DynamicModule`**
  - Configure the module for testing
  - Disables auto-discovery and allows mocking

### NestJSContainerAdapter

#### Methods

- **`resolve<T>(token: ServiceToken<T>): T`**

  - Resolve a service from either NestJS or VytchesDDD container

- **`register<T>(token, implementation, options?): void`**

  - Register a service with the container

- **`registerFactory<T>(token, factory, options?): void`**

  - Register a service using a factory function

- **`registerInstance<T>(token, instance, options?): void`**

  - Register a service instance

- **`isRegistered<T>(token: ServiceToken<T>): boolean`**
  - Check if a service is registered

### Configuration Interfaces

```typescript
interface VytchesDDDOptions {
  autoDiscovery?: boolean | AutoDiscoveryOptions;
  cqrs?: CQRSOptions;
  events?: EventOptions;
  messaging?: MessagingOptions;
  container?: ContainerOptions;
}

interface AutoDiscoveryOptions {
  enabled: boolean;
  patterns?: string[];
  contexts?: string[];
  exclude?: string[];
}

interface CQRSOptions {
  autoRegisterHandlers?: boolean;
  middleware?: MiddlewareConfig[];
  commandBus?: {
    timeout?: number;
    retries?: number;
  };
  queryBus?: {
    timeout?: number;
    cache?: boolean;
  };
}
```

## Best Practices

### 1. Use Bridge Pattern for Controllers

Always use the Bridge Pattern to avoid double instance issues:

```typescript
// ✅ Correct
@Controller('users')
export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }
}

// ❌ Incorrect - causes double instances
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {} // NestJS DI
}
```

### 2. Organize by Bounded Context

```typescript
// user-management.module.ts
@Module({
  imports: [
    VytchesDDDModule.forFeature({
      services: [UserService, UserValidationService],
      handlers: [CreateUserHandler, GetUserHandler],
      context: 'UserManagement',
    }),
  ],
})
export class UserManagementModule {}
```

### 3. Use Result Pattern for Error Handling

```typescript
@DomainService('userService')
export class UserService {
  async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
    try {
      // Business logic
      return Result.success(user);
    } catch (error) {
      return Result.failure(new DomainError(error.message));
    }
  }
}
```

### 4. Leverage Auto-Discovery

```typescript
// services are automatically discovered
@DomainService('orderService', { context: 'OrderManagement' })
export class OrderService {
  /* ... */
}

@CommandHandler(CreateOrderCommand, { context: 'OrderManagement' })
export class CreateOrderHandler {
  /* ... */
}

@QueryHandler(GetOrderQuery, { context: 'OrderManagement' })
export class GetOrderHandler {
  /* ... */
}
```

## Troubleshooting

### Common Issues

#### 1. Service Not Found Error

**Problem**: `Service 'serviceName' not found in container`

**Solution**: Ensure the service is decorated with `@DomainService` and
auto-discovery is enabled:

```typescript
@DomainService('serviceName') // ✅ Add this decorator
export class MyService {
  // ...
}
```

#### 2. Double Instance Issues

**Problem**: Different instances in NestJS and VytchesDDD

**Solution**: Use Bridge Pattern in controllers:

```typescript
// ✅ Correct approach
constructor() {
  this.service = VytchesDDD.resolve<MyService>('myService');
}

// ❌ Avoid NestJS DI for domain services
constructor(private service: MyService) {}
```

#### 3. Auto-Discovery Not Working

**Problem**: Services not being discovered automatically

**Solutions**:

- Check file patterns in configuration
- Ensure decorators are applied correctly
- Verify auto-discovery is enabled
- Check exclude patterns

```typescript
VytchesDDDModule.forRoot({
  autoDiscovery: {
    enabled: true,
    patterns: ['**/*.service.ts', '**/*.handler.ts'], // ✅ Correct patterns
    exclude: ['**/*.spec.ts'], // ✅ Exclude test files
  },
});
```

#### 4. Circular Dependencies

**Problem**: Circular dependency detected

**Solution**: Use the Bridge Pattern and proper service boundaries:

```typescript
// ✅ Break circular dependencies
@DomainService('userService')
export class UserService {
  // Inject interfaces, not concrete classes
  constructor(private userRepository: IUserRepository) {}
}
```

### Debug Mode

Enable debug mode for troubleshooting:

```typescript
VytchesDDDModule.forRoot({
  container: {
    debug: true, // ✅ Enable debug logging
  },
});
```

## Performance Considerations

### 1. Service Lifetime Management

Choose appropriate service lifetimes:

```typescript
@DomainService('userService', {
  lifetime: ServiceLifetime.Singleton, // ✅ For stateless services
})
export class UserService {}

@DomainService('userSessionService', {
  lifetime: ServiceLifetime.Scoped, // ✅ For request-scoped services
})
export class UserSessionService {}
```

### 2. CQRS Caching

Enable query caching for better performance:

```typescript
VytchesDDDModule.forRoot({
  cqrs: {
    queryBus: {
      cache: true, // ✅ Enable query caching
      timeout: 15000,
    },
  },
});
```

### 3. Auto-Discovery Optimization

Optimize auto-discovery patterns:

```typescript
VytchesDDDModule.forRoot({
  autoDiscovery: {
    patterns: [
      'src/**/*.service.ts', // ✅ Specific patterns
      'src/**/*.handler.ts',
    ],
    exclude: [
      '**/*.spec.ts',
      '**/*.test.ts',
      'node_modules/**', // ✅ Exclude unnecessary files
    ],
  },
});
```

## License

MIT © VytchesDDD Team
