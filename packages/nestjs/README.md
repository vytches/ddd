# @vytches/ddd-nestjs

Simple, clean NestJS integration for VytchesDDD - Enterprise Domain-Driven
Design framework.

[![npm version](https://badge.fury.io/js/@vytches%2Fddd-nestjs.svg)](https://www.npmjs.com/package/@vytches/ddd-nestjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

The `@vytches/ddd-nestjs` package provides simple, clean integration between
NestJS and VytchesDDD, following proven @nestjs/cqrs patterns for maximum
familiarity and reliability.

### Key Features

- **Simple & Clean**: ~250 lines of code following @nestjs/cqrs patterns
- **Auto-Discovery**: Automatic handler registration using NestJS
  DiscoveryService
- **Custom Provider Tokens**: Support for interface tokens (IEventBus =>
  UnifiedEventBus)
- **CQRS Integration**: Command, Query, and Event bus support
- **No Temporal Coupling**: Synchronous discovery during module initialization
- **Testing Support**: Built-in forTesting() method with pre-configured buses
- **Production Ready**: Battle-tested patterns from @nestjs/cqrs

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

### 1. Setup with `register()` Method

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { ICommandBus, IQueryBus, IEventBus } from '@vytches/ddd-cqrs';
import { EnhancedCommandBus, EnhancedQueryBus } from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';

@Module({
  imports: [
    VytchesDDDModule.register({
      providers: [
        // Define your bus implementations
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      autoRegisterHandlers: true, // Default: true
      autoRegisterProcessManagers: true, // Default: true
      autoRegisterSagas: true, // Default: true
      isGlobal: true, // Make available everywhere
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

## Configuration with `register()` Method

### Basic Setup (Most Common)

```typescript
// app.module.ts
@Module({
  imports: [
    VytchesDDDModule.register({
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      isGlobal: true, // Available everywhere
    }),
  ],
})
export class AppModule {}

// Additional infrastructure in AppModule
@Module({
  imports: [
    VytchesDDDModule.register({
      /* ... */
    }),
  ],
  providers: [
    // Optional: Add EventStore, Saga, etc. as needed
    { provide: IEventStore, useClass: PostgresEventStore },
    { provide: ISagaOrchestrator, useClass: SagaOrchestrator },
  ],
})
export class AppModule {}
```

### Using in Domain Modules

```typescript
// order.module.ts
@Module({
  providers: [
    // Just list your handlers - they're auto-registered!
    CreateOrderHandler,
    UpdateOrderHandler,
    GetOrderHandler,

    // Process Managers
    OrderProcessManager,

    // Sagas
    OrderCompensationSaga,

    // Regular services
    OrderService,
    OrderRepository,
  ],
})
export class OrderModule {
  // No onModuleInit needed - auto-registration handles everything!
}
```

### Service Usage with Abstract Tokens

```typescript
@Injectable()
export class OrderService {
  constructor(
    // Use abstract tokens directly!
    @Inject(ICommandBus) private commandBus: ICommandBus,
    @Inject(IQueryBus) private queryBus: IQueryBus,
    @Inject(IEventBus) private eventBus: IEventBus
  ) {}

  async createOrder(data: CreateOrderData) {
    return this.commandBus.execute(new CreateOrderCommand(data));
  }
}
```

### Custom Module Wrapper

```typescript
// shared/ddd.module.ts
@Global()
@Module({})
export class DDDModule {
  static forRoot(): DynamicModule {
    return {
      module: DDDModule,
      imports: [
        VytchesDDDModule.register({
          providers: [
            { provide: ICommandBus, useClass: EnhancedCommandBus },
            { provide: IQueryBus, useClass: EnhancedQueryBus },
            { provide: IEventBus, useClass: UnifiedEventBus },
          ],
          autoRegisterHandlers: true,
          autoRegisterProcessManagers: true,
          autoRegisterSagas: true,
          isGlobal: true,
        }),
      ],
      exports: [VytchesDDDModule],
    };
  }
}

// Then in AppModule
@Module({
  imports: [DDDModule.forRoot()],
})
export class AppModule {}
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

- **`register(options: RegisterOptions): DynamicModule`**

  - Configure the module with explicit provider configuration
  - Supports auto-registration of handlers, process managers, and sagas
  - Makes the module globally available with `isGlobal: true`

- **`forTest(options?: VytchesDDDTestOptions): DynamicModule`**
  - Configure the module for testing
  - Allows mocking and debugging

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
interface RegisterOptions {
  providers: any[]; // Array of provider configurations
  autoRegisterHandlers?: boolean; // Auto-register @CommandHandler/@QueryHandler (default: true)
  autoRegisterProcessManagers?: boolean; // Auto-register @ProcessManager (default: true)
  autoRegisterSagas?: boolean; // Auto-register @Saga (default: true)
  autoRegisterProjections?: boolean; // Auto-register projections (default: false)
  isGlobal?: boolean; // Make module globally available
}

// Provider configuration follows NestJS standard pattern
interface ProviderConfig {
  provide: any; // Token (can be abstract class, string, symbol)
  useClass?: any; // Implementation class
  useValue?: any; // Direct value
  useFactory?: Function; // Factory function
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
  providers: [
    // Domain services
    UserService,
    UserValidationService,

    // Handlers
    CreateUserHandler,
    GetUserHandler,
    UpdateUserHandler,

    // Event handlers
    UserCreatedEventHandler,
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

#### 3. Handlers Not Being Registered

**Problem**: Handlers not being registered automatically

**Solutions**:

- Ensure handlers are added to module providers
- Check that auto-registration flags are enabled
- Verify decorators are applied correctly

```typescript
@Module({
  providers: [
    // ✅ Add handlers to providers
    CreateOrderHandler,
    GetOrderHandler,
  ],
  imports: [
    VytchesDDDModule.register({
      providers: [
        /* bus providers */
      ],
      autoRegisterHandlers: true, // ✅ Enable auto-registration
    }),
  ],
})
export class OrderModule {}
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
// Use forTest() for debugging
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

@Module({
  imports: [
    VytchesDDDModule.forTest({
      debug: true, // ✅ Enable debug logging
    }),
  ],
})
export class TestModule {}
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

### 2. Handler Registration

Auto-registration improves performance by reducing boilerplate:

```typescript
VytchesDDDModule.register({
  providers: [
    /* ... */
  ],
  autoRegisterHandlers: true, // ✅ Automatic handler registration
  autoRegisterProcessManagers: true, // ✅ Automatic process manager registration
  autoRegisterSagas: true, // ✅ Automatic saga registration
});
```

### 3. Global Module Configuration

Make the module globally available to avoid reimporting:

```typescript
VytchesDDDModule.register({
  providers: [
    /* ... */
  ],
  isGlobal: true, // ✅ Available everywhere without reimporting
});
```

## License

MIT © VytchesDDD Team
