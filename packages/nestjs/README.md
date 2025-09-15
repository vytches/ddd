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
npm install @vytches/ddd-nestjs @vytches/ddd-core @vytches/ddd-cqrs @vytches/ddd-events @vytches/ddd-di
# or
yarn add @vytches/ddd-nestjs @vytches/ddd-core @vytches/ddd-cqrs @vytches/ddd-events @vytches/ddd-di
# or
pnpm add @vytches/ddd-nestjs @vytches/ddd-core @vytches/ddd-cqrs @vytches/ddd-events @vytches/ddd-di
```

### Peer Dependencies

The package requires the following peer dependencies:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

### Quick Dependencies Overview

| Package                  | Purpose                           | Required           |
| ------------------------ | --------------------------------- | ------------------ |
| `@vytches/ddd-nestjs`    | NestJS integration                | ✅ Core            |
| `@vytches/ddd-core`      | Meta-package with essentials      | ✅ Core            |
| `@vytches/ddd-cqrs`      | Command/Query buses and handlers  | ✅ For CQRS        |
| `@vytches/ddd-events`    | Event bus and event handling      | ✅ For Events      |
| `@vytches/ddd-di`        | VP-012 Performance & DI container | ✅ For Performance |
| `@vytches/ddd-policies`  | Business policies and validation  | ⚪ Optional        |
| `@vytches/ddd-messaging` | Sagas and messaging patterns      | ⚪ Optional        |

## Quick Start

### 1. Setup with `forRoot()` Method

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { EnhancedCommandBus, EnhancedQueryBus } from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        // Define your bus implementations
        { provide: 'ICommandBus', useClass: EnhancedCommandBus },
        { provide: 'IQueryBus', useClass: EnhancedQueryBus },
        { provide: 'IEventBus', useClass: UnifiedEventBus },
      ],
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

## Handler Registration Guide

### Command Bus Registration & Handlers

#### 1. Register Command Bus

```typescript
// app.module.ts - Enhanced Command Bus Setup
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { ICommandBus, EnhancedCommandBus } from '@vytches/ddd-cqrs';
import { SimpleContainer } from '@vytches/ddd-di';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: ICommandBus,
          useFactory: () => {
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container, {
              timeout: 30000, // 30s timeout
              enableMetrics: true, // Performance monitoring
              enableLogging: true, // Request logging
            });
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

#### 2. Create Command & Handler

```typescript
// commands/create-user.command.ts
import { ICommand } from '@vytches/ddd-cqrs';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly role: 'admin' | 'user' = 'user'
  ) {}
}

// handlers/create-user.handler.ts
import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@vytches/ddd-cqrs';
import { CreateUserCommand } from '../commands/create-user.command';
import { User, CreateUserData } from '../types';
import { VytchesDDD } from '@vytches/ddd-di';
import { UserService } from '../services/user.service';

@Injectable()
@CommandHandler(CreateUserCommand, {
  context: 'UserManagement', // VP-012: Context-based optimization
  timeout: 15000, // Override global timeout
  middleware: ['ValidationMiddleware', 'LoggingMiddleware'],
})
export class CreateUserCommandHandler
  implements ICommandHandler<CreateUserCommand, User>
{
  private readonly userService: UserService;

  constructor() {
    // Bridge Pattern: Get domain service from VytchesDDD
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }

  async execute(command: CreateUserCommand): Promise<User> {
    const userData: CreateUserData = {
      email: command.email,
      name: command.name,
      role: command.role,
    };

    const result = await this.userService.createUser(userData);

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }
}
```

#### 3. Register Handler in Module

```typescript
// user-management.module.ts
import { Module } from '@nestjs/common';
import { CreateUserCommandHandler } from './handlers/create-user.handler';
import { UserService } from './services/user.service';

@Module({
  providers: [
    // ✅ Handlers are auto-discovered when added to providers
    CreateUserCommandHandler,

    // Domain services with DI integration
    UserService,
  ],
})
export class UserManagementModule {}
```

#### 4. Use Command Bus in Controller

```typescript
// user.controller.ts
import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { ICommandBus } from '@vytches/ddd-cqrs';
import { CreateUserCommand } from './commands/create-user.command';
import { CreateUserDto, User } from './types';

@Injectable()
@Controller('users')
export class UserController {
  private readonly commandBus: ICommandBus;

  constructor() {
    // Bridge Pattern: Get command bus from VytchesDDD
    this.commandBus = VytchesDDD.resolve<ICommandBus>(ICommandBus);
  }

  @Post()
  async createUser(@Body() userData: CreateUserDto): Promise<User> {
    const command = new CreateUserCommand(
      userData.email,
      userData.name,
      userData.role
    );

    return await this.commandBus.execute(command);
  }
}
```

### Query Bus Registration & Handlers

#### 1. Register Query Bus

```typescript
// app.module.ts - Enhanced Query Bus Setup
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: IQueryBus,
          useFactory: () => {
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container, {
              timeout: 10000, // 10s timeout for queries
              enableCaching: true, // Query result caching
              enableMetrics: true,
            });
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

#### 2. Create Query & Handler

```typescript
// queries/get-user.query.ts
import { IQuery } from '@vytches/ddd-cqrs';

export class GetUserQuery implements IQuery<User> {
  constructor(public readonly userId: string) {}
}

// handlers/get-user.handler.ts
import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@vytches/ddd-cqrs';
import { GetUserQuery } from '../queries/get-user.query';
import { User } from '../types';
import { VytchesDDD } from '@vytches/ddd-di';
import { UserService } from '../services/user.service';

@Injectable()
@QueryHandler(GetUserQuery, {
  context: 'UserManagement',
  caching: {
    enabled: true,
    ttl: 60000, // 1 minute cache
    key: query => `user:${query.userId}`,
  },
})
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery, User> {
  private readonly userService: UserService;

  constructor() {
    this.userService = VytchesDDD.resolve<UserService>('userService');
  }

  async execute(query: GetUserQuery): Promise<User> {
    const result = await this.userService.getUserById(query.userId);

    if (result.isFailure()) {
      throw new Error(`User not found: ${query.userId}`);
    }

    return result.value;
  }
}
```

### Event Bus Registration & Handlers

#### 1. Register Event Bus

```typescript
// app.module.ts - Unified Event Bus Setup
import { IEventBus, UnifiedEventBus } from '@vytches/ddd-events';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: IEventBus,
          useFactory: () => {
            return new UnifiedEventBus({
              enableMetrics: true,
              enableRetry: true,
              retryAttempts: 3,
              enableDeadLetterQueue: true,
            });
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

#### 2. Create Domain Event & Handler

```typescript
// events/user-created.event.ts
import { DomainEvent } from '@vytches/ddd-events';

export class UserCreatedEvent extends DomainEvent<{
  userId: string;
  email: string;
  name: string;
  createdAt: Date;
}> {
  constructor(payload: {
    userId: string;
    email: string;
    name: string;
    createdAt: Date;
  }) {
    super('UserCreated', payload, {
      version: 1,
      source: 'UserManagement',
    });
  }
}

// handlers/user-created.handler.ts
import { Injectable } from '@nestjs/common';
import { EventHandler, IEventHandler } from '@vytches/ddd-events';
import { UserCreatedEvent } from '../events/user-created.event';
import { VytchesDDD } from '@vytches/ddd-di';
import { EmailService } from '../services/email.service';

@Injectable()
@EventHandler(UserCreatedEvent, {
  context: 'UserManagement',
  eventContext: 'user-context', // Filter events by context
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoff: 'exponential',
  },
})
export class UserCreatedEventHandler
  implements IEventHandler<UserCreatedEvent>
{
  private readonly emailService: EmailService;

  constructor() {
    this.emailService = VytchesDDD.resolve<EmailService>('emailService');
  }

  async handle(event: UserCreatedEvent): Promise<void> {
    const { userId, email, name } = event.payload;

    // Send welcome email
    await this.emailService.sendWelcomeEmail(email, name);

    // Log user creation
    console.log(`User created: ${name} (${userId})`);
  }
}
```

#### 3. Publishing Events from Domain Services

```typescript
// services/user.service.ts
import { DomainService } from '@vytches/ddd-di';
import { IEventBus } from '@vytches/ddd-events';
import { UserCreatedEvent } from '../events/user-created.event';

@DomainService('userService', {
  context: 'UserManagement',
})
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventBus: IEventBus
  ) {}

  async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
    try {
      const user = User.create(userData);
      await this.userRepository.save(user);

      // Publish domain event
      await this.eventBus.publish(
        new UserCreatedEvent({
          userId: user.id,
          email: user.email,
          name: user.name,
          createdAt: new Date(),
        })
      );

      return Result.success(user);
    } catch (error) {
      return Result.failure(
        new Error(`Failed to create user: ${error.message}`)
      );
    }
  }
}
```

### Advanced Handler Patterns

#### Multiple Event Handlers for Same Event

```typescript
// Send welcome email
@Injectable()
@EventHandler(UserCreatedEvent, { context: 'EmailService' })
export class SendWelcomeEmailHandler
  implements IEventHandler<UserCreatedEvent>
{
  async handle(event: UserCreatedEvent): Promise<void> {
    // Send welcome email logic
  }
}

// Update analytics
@Injectable()
@EventHandler(UserCreatedEvent, { context: 'Analytics' })
export class UpdateUserAnalyticsHandler
  implements IEventHandler<UserCreatedEvent>
{
  async handle(event: UserCreatedEvent): Promise<void> {
    // Update analytics logic
  }
}

// Create user profile
@Injectable()
@EventHandler(UserCreatedEvent, { context: 'ProfileService' })
export class CreateUserProfileHandler
  implements IEventHandler<UserCreatedEvent>
{
  async handle(event: UserCreatedEvent): Promise<void> {
    // Create user profile logic
  }
}
```

#### Context-Filtered Handlers

```typescript
// Only handles events from 'order-context'
@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-context', // Specific context filter
})
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  async handle(event: OrderCreatedEvent): Promise<void> {
    // Only processes events from order context
  }
}

// Handles events from multiple contexts
@EventHandler(InventoryUpdatedEvent, {
  eventContext: ['order-context', 'inventory-context'], // Multiple contexts
})
export class InventoryHandler implements IEventHandler<InventoryUpdatedEvent> {
  async handle(event: InventoryUpdatedEvent): Promise<void> {
    // Processes events from both contexts
  }
}
```

#### Saga Handlers (Long-Running Processes)

```typescript
// sagas/order-processing.saga.ts
import { Injectable } from '@nestjs/common';
import { SagaHandler, ISagaHandler } from '@vytches/ddd-messaging';
import { OrderCreatedEvent, PaymentProcessedEvent } from '../events';

@Injectable()
@SagaHandler('OrderProcessingSaga', {
  context: 'OrderManagement',
  startEvents: [OrderCreatedEvent],
  timeout: 3600000, // 1 hour timeout
})
export class OrderProcessingSaga implements ISagaHandler {
  async handleEvent(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'OrderCreated':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;
      case 'PaymentProcessed':
        await this.handlePaymentProcessed(event as PaymentProcessedEvent);
        break;
    }
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Start payment processing
    console.log(
      `Starting order processing for order: ${event.payload.orderId}`
    );
  }

  private async handlePaymentProcessed(
    event: PaymentProcessedEvent
  ): Promise<void> {
    // Continue with inventory reservation
    console.log(`Payment processed for order: ${event.payload.orderId}`);
  }
}
```

### Handler Registration Summary

| Handler Type       | Decorator                            | Bus Registration                         | Auto-Discovery |
| ------------------ | ------------------------------------ | ---------------------------------------- | -------------- |
| **Command**        | `@CommandHandler(Command, options?)` | `ICommandBus` → `EnhancedCommandBus`     | ✅ Automatic   |
| **Query**          | `@QueryHandler(Query, options?)`     | `IQueryBus` → `EnhancedQueryBus`         | ✅ Automatic   |
| **Event**          | `@EventHandler(Event, options?)`     | `IEventBus` → `UnifiedEventBus`          | ✅ Automatic   |
| **Saga**           | `@SagaHandler(name, options?)`       | `ISagaOrchestrator` → `SagaOrchestrator` | ✅ Automatic   |
| **Domain Service** | `@DomainService(id, options?)`       | VP-012 DI Container                      | ✅ Automatic   |

## VP-012 Performance Optimization

The `@vytches/ddd-nestjs` package includes **VP-012 DI Container Enterprise
Performance Optimization** for applications handling 200+ handlers. This
optimization provides up to **94% performance improvement** and sub-100ms
startup times for enterprise applications.

### Performance Comparison

| Configuration       | Handlers | Startup Time | Performance Mode | Use Case                |
| ------------------- | -------- | ------------ | ---------------- | ----------------------- |
| **forTesting()**    | 1-10     | ~50ms        | Development      | Testing & prototyping   |
| **forRoot()**       | 10-50    | ~200ms       | Standard         | Small applications      |
| **forProduction()** | 50-200   | ~150ms       | Optimized        | Production applications |
| **forEnterprise()** | 200-500+ | **~50ms**    | Enterprise       | Large-scale enterprise  |

### Quick Performance Setup

#### Production Configuration (Recommended)

```typescript
// app.module.ts
@Module({
  imports: [
    VytchesDDDModule.forProduction({
      // VP-012 Performance optimization for production
      performance: {
        contexts: ['UserManagement', 'OrderProcessing'], // Selective discovery
        performanceTarget: 150, // 150ms max startup
        autoOptimize: true,
        parallelRegistration: true,
        preWarmHandlers: true,
      },

      // Performance monitoring
      monitoring: {
        enabled: true,
        warnAt: 100,
        errorAt: 200,
        onPerformanceAlert: (metrics, level) => {
          console.log(`Performance Alert [${level}]:`, metrics);
        },
      },
    }),
  ],
})
export class AppModule {}
```

#### Enterprise Configuration (Maximum Performance)

```typescript
// app.module.ts - Requires pre-compiled registry
@Module({
  imports: [
    VytchesDDDModule.forEnterprise({
      performance: {
        performanceMode: 'enterprise',
        preCompiledRegistry: await generateHandlerRegistry(), // Build-time generation
        skipDiscovery: true, // No runtime discovery
        maxStartupTime: 50, // Aggressive 50ms target
        enterpriseMonitoring: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Migration to VP-012 Performance

#### Before: Standard Configuration

```typescript
// ❌ Standard configuration - slower for large applications
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        { provide: 'ICommandBus', useClass: EnhancedCommandBus },
        { provide: 'IQueryBus', useClass: EnhancedQueryBus },
        { provide: 'IEventBus', useClass: UnifiedEventBus },
      ],
    }),
  ],
})
export class AppModule {}
```

#### After: Production Optimized

```typescript
// ✅ VP-012 optimized - 94% faster startup
@Module({
  imports: [
    VytchesDDDModule.forProduction({
      // Same providers, enhanced with performance optimization
      providers: [
        { provide: 'ICommandBus', useClass: EnhancedCommandBus },
        { provide: 'IQueryBus', useClass: EnhancedQueryBus },
        { provide: 'IEventBus', useClass: UnifiedEventBus },
      ],

      // VP-012 Performance configuration
      performance: {
        performanceMode: 'production',
        contexts: ['UserManagement', 'OrderProcessing'], // Only scan relevant contexts
        autoOptimize: true,
        performanceTarget: 150,
      },

      monitoring: {
        enabled: true,
        autoSuggest: true, // Get optimization suggestions
      },
    }),
  ],
})
export class AppModule {}
```

### Performance Monitoring API

Access performance metrics in your controllers:

```typescript
// system.controller.ts
@Controller('system')
export class SystemController {
  constructor(private readonly explorer: VytchesExplorerService) {}

  @Get('performance')
  getPerformanceMetrics() {
    const metrics = this.explorer.getPerformanceMetrics();
    return {
      startupTime: `${metrics.startupTime}ms`,
      handlersFound: metrics.handlersFound,
      optimized: metrics.optimized,
      recommendations: metrics.suggestions,
    };
  }
}
```

### Performance Optimization Strategies

The VP-012 system automatically selects the best optimization strategy:

1. **Pre-compiled Registry** (94% improvement) - Enterprise mode
2. **Selective Discovery** (67% improvement) - Context filtering
3. **Cached Discovery** (45% improvement) - Discovery result caching
4. **Parallel Discovery** (23% improvement) - Concurrent registration
5. **Standard Discovery** (baseline) - Default reflection-based

### Enterprise Registry Generation

For maximum performance, generate a pre-compiled handler registry:

```bash
# Generate registry at build time
pnpm vytches-ddd optimize performance

# Or programmatically
const registry = await generateHandlerRegistry([
  'src/**/*.handler.ts',
  'src/**/*.service.ts'
]);
```

### VP-012 Enhanced Configuration Patterns

#### Performance Profile Configuration

```typescript
// app.module.ts - Performance Profile Setup
@Module({
  imports: [
    VytchesDDDModule.forPerformanceProfile('enterprise-maximum', {
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        realTimeMonitoring: true,
        adaptiveOptimization: true,
        performanceStrategies: ['pre-compiled', 'selective', 'parallel'],
        monitoringInterval: 5000, // 5s monitoring
        performanceBudget: {
          startupTime: 50, // 50ms budget
          memoryUsage: 50 * 1024 * 1024, // 50MB budget
          discoveryTime: 30, // 30ms budget
        },
      },
      monitoring: {
        enabled: true,
        performanceAlerts: true,
        realTimeAlerts: true,
        metricsCollection: 'detailed',
        alertThresholds: {
          discoveryTime: 100,
          memoryUsage: 100 * 1024 * 1024,
          handlerCount: 500,
        },
        onPerformanceMetrics: metrics => {
          console.log('🎯 VP-012 Metrics:', {
            startupTime: `${metrics.startupTime}ms`,
            handlersFound: metrics.handlersFound,
            optimized: metrics.optimized,
          });
        },
      },
    }),
  ],
})
export class AppModule {}
```

#### Context-Based Performance Optimization

```typescript
// app.module.ts - Context Isolation for Performance
@Module({
  imports: [
    VytchesDDDModule.forContext({
      context: 'OrderManagement',
      bridgeToNestJS: true, // Bridge handlers to NestJS DI
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        performanceMode: 'production',
        contexts: ['OrderManagement'], // Only scan order context
        autoOptimize: true,
        parallelRegistration: true,
        performanceTarget: 100,
      },
      monitoring: {
        enabled: true,
        contextName: 'OrderManagement',
        performanceAlerts: true,
      },
      handlers: {
        include: ['*Order*', '*Payment*'], // Handler name patterns
        exclude: ['*Test*', '*Mock*'],
        prefix: 'OrderMgmt', // NestJS registration prefix
      },
    }),
  ],
})
export class OrderManagementModule {}
```

#### Enhanced Enterprise Configuration

```typescript
// app.module.ts - Enterprise with VP-012 Enhanced
@Module({
  imports: [
    VytchesDDDModule.forEnterprise({
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        performanceMode: 'enterprise',
        performanceProfile: 'enterprise-scale', // VP-012 Enhanced
        preCompiledRegistry: await loadHandlerRegistry(),
        skipDiscovery: true,
        maxStartupTime: 50,
        enterpriseMonitoring: true,
        performanceAlerts: true,
        // VP-012 Enhanced features
        realTimeMonitoring: true,
        adaptiveOptimization: true,
        performanceStrategies: ['pre-compiled', 'cached', 'parallel'],
        performanceBudget: {
          startupTime: 50,
          memoryUsage: 25 * 1024 * 1024, // 25MB limit
          discoveryTime: 0, // No discovery in enterprise mode
        },
      },
      monitoring: {
        enabled: true,
        enterpriseMonitoring: true,
        performanceAlerts: true,
        realTimeAlerts: true,
        metricsCollection: 'detailed',
        onPerformanceAlert: (metrics, level) => {
          // Enterprise alerting integration
          enterpriseAlertingSystem.send({
            level,
            service: 'VytchesDDD',
            metrics: {
              startupTime: metrics.startupTime,
              memoryUsage: metrics.memoryUsage,
              handlersFound: metrics.handlersFound,
            },
          });
        },
      },
    }),
  ],
})
export class EnterpriseAppModule {}
```

#### Development with VP-012 Enhanced Debugging

```typescript
// app.module.ts - Development with Enhanced Debug
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        performanceMode: 'development',
        autoOptimize: false, // Disable for debugging
        debugPerformance: true, // VP-012 Enhanced debugging
        performanceTarget: 1000, // Relaxed for development
        fallback: 'discovery',
      },
      monitoring: {
        enabled: true,
        autoSuggest: true, // Get optimization suggestions
        performanceAlerts: false, // Don't alert in dev
        metricsCollection: 'standard',
        onPerformanceMetrics: metrics => {
          if (metrics.startupTime > 500) {
            console.warn(`⚠️  Slow startup detected: ${metrics.startupTime}ms`);
            console.log(
              '💡 Consider switching to forProduction() for better performance'
            );
          }
        },
      },
    }),
  ],
})
export class DevelopmentModule {}
```

### Performance Presets (Quick Start)

Use pre-configured performance presets for common scenarios:

```typescript
import { PerformancePresets, PresetHelpers } from '@vytches/ddd-nestjs';

// Microservice preset (10-50 handlers)
@Module({
  imports: [
    PerformancePresets.microservice({
      contexts: ['PaymentProcessing'],
    }),
  ],
})
export class PaymentModule {}

// Monolith preset (100-300 handlers)
@Module({
  imports: [
    PerformancePresets.monolith({
      contexts: ['UserManagement', 'OrderProcessing', 'Billing'],
    }),
  ],
})
export class AppModule {}

// High-traffic preset (300+ handlers)
@Module({
  imports: [
    PerformancePresets.highTraffic({
      contexts: ['OrderProcessing'],
      preCompiledRegistry: await loadRegistry(),
    }),
  ],
})
export class EnterpriseModule {}

// Environment-based configuration
@Module({
  imports: [
    PresetHelpers.forEnvironment(process.env.NODE_ENV, {
      contexts: ['UserManagement'],
    }),
  ],
})
export class AppModule {}
```

#### Available Presets:

| Preset           | Handler Count | Startup Target | Use Case                      |
| ---------------- | ------------- | -------------- | ----------------------------- |
| `microservice()` | 10-50         | ~100ms         | Small services, serverless    |
| `monolith()`     | 100-300       | ~200ms         | Traditional applications      |
| `highTraffic()`  | 300+          | ~75ms          | Enterprise, high-load systems |
| `development()`  | Any           | ~500ms         | Local development, debugging  |
| `testing()`      | Any           | No limit       | Unit/integration tests        |

## Configuration with `forRoot()` Method

### Basic Setup (Most Common)

```typescript
// app.module.ts
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        { provide: 'ICommandBus', useClass: EnhancedCommandBus },
        { provide: 'IQueryBus', useClass: EnhancedQueryBus },
        { provide: 'IEventBus', useClass: UnifiedEventBus },
      ],
    }),
  ],
})
export class AppModule {}

// Additional infrastructure in AppModule
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      /* ... */
    }),
  ],
  providers: [
    // Optional: Add EventStore, Saga, etc. as needed
    { provide: 'IEventStore', useClass: PostgresEventStore },
    { provide: 'ISagaOrchestrator', useClass: SagaOrchestrator },
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
        VytchesDDDModule.forRoot({
          providers: [
            { provide: 'ICommandBus', useClass: EnhancedCommandBus },
            { provide: 'IQueryBus', useClass: EnhancedQueryBus },
            { provide: 'IEventBus', useClass: UnifiedEventBus },
          ],
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

- **`forRoot(options: VytchesDDDModuleOptions): DynamicModule`**

  - Configure the module with explicit provider configuration
  - Supports automatic handler discovery and registration
  - Provides global access to VytchesDDD services

- **`forTesting(): DynamicModule`**
  - Simple configuration for testing and basic usage
  - Pre-configured with test-ready bus implementations

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
interface VytchesDDDModuleOptions {
  providers?: Provider[]; // Array of provider configurations
  imports?: ModuleMetadata['imports']; // Additional imports for the module
  exports?: ModuleMetadata['exports']; // Additional exports beyond the default explorer service
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
    VytchesDDDModule.forRoot({
      providers: [
        /* bus providers */
      ],
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

### Enhanced Error Messages and Debugging

VP-012 provides enhanced error messages with actionable suggestions:

```typescript
// Example error output with actionable guidance
/*
🚨 VytchesExplorer: Handler discovery failed
❌ Error: Performance target exceeded: 250ms > 200ms

🔧 Suggested Solutions:
1. Increase the performanceTarget value (e.g., from 200ms to 300ms)
2. Enable parallelRegistration for faster handler registration
3. Use selective discovery by specifying contexts: ["YourContext"]

📊 Current Configuration:
- Performance Mode: production
- Auto Optimize: true
- Contexts: all
- Fallback Strategy: discovery

📚 More help: https://docs.vytches.com/ddd/nestjs/troubleshooting
*/
```

#### Configuration Suggestions API

Get personalized optimization suggestions:

```typescript
// system.controller.ts
@Controller('system')
export class SystemController {
  constructor(private readonly explorer: VytchesExplorerService) {}

  @Get('suggestions')
  getOptimizationSuggestions() {
    return {
      suggestions: this.explorer.getConfigurationSuggestions(),
      currentMetrics: this.explorer.getPerformanceMetrics(),
    };
  }
}

// Example response:
/*
{
  "suggestions": [
    "Your startup time is high (>300ms). Consider upgrading to forProduction() configuration",
    "You have 150 handlers but no optimization. Use forProduction() or forEnterprise()",
    "Switch from development to production mode for better performance"
  ],
  "currentMetrics": {
    "startupTime": 320,
    "handlersFound": 150,
    "optimized": false,
    "performanceMode": "development"
  }
}
*/
```

### Debug Mode

Enable debug mode for troubleshooting:

```typescript
// Development preset with debug mode
@Module({
  imports: [
    PerformancePresets.development({
      debugMode: true, // ✅ Enhanced debug logging
    }),
  ],
})
export class DevelopmentModule {}

// Or manual configuration
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      performance: {
        debugPerformance: true, // ✅ Detailed performance logging
        fallback: 'discovery',
      },
      monitoring: {
        enabled: true,
        autoSuggest: true, // ✅ Get optimization suggestions
      },
    }),
  ],
})
export class DebugModule {}
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
VytchesDDDModule.forRoot({
  providers: [
    /* ... */
  ],
});
```

### 3. Global Module Configuration

Make the module globally available to avoid reimporting:

```typescript
VytchesDDDModule.forRoot({
  global: true, // ✅ Makes module globally available
  providers: [
    /* ... */
  ],
});
```

## Context-Based Isolation Examples

### Bounded Context Separation

```typescript
// user-management.module.ts
@Module({
  imports: [
    VytchesDDDModule.forContext('UserManagement', {
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        contexts: ['UserManagement'], // Isolated context
        performanceMode: 'production',
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserManagementModule {}

// order-management.module.ts
@Module({
  imports: [
    VytchesDDDModule.forContext('OrderManagement', {
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
      performance: {
        contexts: ['OrderManagement'], // Separate context
        performanceMode: 'production',
      },
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderManagementModule {}
```

### Context-Aware Handler Resolution

```typescript
// Handlers automatically isolated by context
@CommandHandler(CreateUserCommand, {
  context: 'UserManagement', // Only available in UserManagement context
})
export class CreateUserCommandHandler {}

@CommandHandler(CreateOrderCommand, {
  context: 'OrderManagement', // Only available in OrderManagement context
})
export class CreateOrderCommandHandler {}
```

## Testing Integration

### Test Module Setup

```typescript
// user.service.spec.ts
import { Test } from '@nestjs/testing';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

describe('UserService', () => {
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forTesting({
          // Pre-configured test buses with mocking capabilities
          enableMocking: true,
          isolated: true, // Isolated test environment
        }),
      ],
      providers: [UserService, CreateUserCommandHandler],
    }).compile();

    // Auto-discovery happens automatically
    await module.init();
  });

  // Your tests...
});
```

### Performance Testing

```typescript
// performance.spec.ts
describe('VP-012 Performance', () => {
  it('should meet startup performance targets', async () => {
    const startTime = Date.now();

    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forProduction({
          performance: {
            performanceTarget: 150, // 150ms target
            autoOptimize: true,
          },
        }),
      ],
    }).compile();

    await module.init();
    const startupTime = Date.now() - startTime;

    expect(startupTime).toBeLessThan(150); // VP-012 performance guarantee
  });
});
```

## Common Patterns & Best Practices

### 1. Handler Error Handling

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  async execute(command: CreateUserCommand): Promise<Result<User, Error>> {
    try {
      const user = await this.userService.createUser(command);
      return Result.success(user);
    } catch (error) {
      // Structured error handling
      return Result.failure(
        new DomainError('USER_CREATION_FAILED', error.message)
      );
    }
  }
}
```

### 2. Event Publishing Patterns

```typescript
// From aggregate (recommended)
class UserAggregate extends AggregateRoot {
  create(data: CreateUserData): void {
    // Business logic
    this.addDomainEvent(new UserCreatedEvent(data));
  }
}

// Repository automatically publishes events
await this.userRepository.save(userAggregate);
```

### 3. Query Caching

```typescript
@QueryHandler(GetUserQuery, {
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    keyGenerator: query => `user:${query.userId}`,
  },
})
export class GetUserQueryHandler {
  async execute(query: GetUserQuery): Promise<User> {
    // Results automatically cached
    return await this.userRepository.findById(query.userId);
  }
}
```

## Best Practices for Performance

### Handler Registration Strategies

#### **Recommended: VytchesDDD Auto-Discovery**

```typescript
// ✅ RECOMMENDED: Auto-discovery for optimal performance
@Module({
  imports: [
    VytchesDDDModule.forContext('UserManagement', {
      // VP-012 optimization - parallel handler discovery
      autoDiscovery: true,
      performance: {
        contexts: ['UserManagement'], // Selective context scanning
        performanceMode: 'production',
        parallelRegistration: true, // 67% faster registration
        performanceTarget: 100,
      },
    }),
  ],
  providers: [
    // ✅ Domain services (explicit registration)
    UserService,
    UserRepository,
    EmailService,

    // ✅ Handlers auto-discovered (performance optimized)
    // UserCreatedHandler, <- discovered automatically
    // CreateUserCommandHandler, <- discovered automatically
    // GetUserQueryHandler, <- discovered automatically
  ],
})
export class UserManagementModule {}
```

**Benefits:**

- **🔥 67-94% faster startup** - VP-012 parallel registration
- **📊 Performance monitoring** - automatic metrics and alerts
- **🎯 Context isolation** - bounded context handler filtering
- **⚡ Smart caching** - discovery results cached between restarts

#### **Alternative: Direct NestJS Registration**

```typescript
// ✅ ALTERNATIVE: Direct registration for explicit control
@Module({
  imports: [
    VytchesDDDModule.forContext('UserManagement', {
      // Only performance optimization, no auto-discovery
      performance: {
        contexts: ['UserManagement'],
        performanceMode: 'production',
      },
    }),
  ],
  providers: [
    UserService,
    UserRepository,
    EmailService,

    // ✅ Explicit handler registration
    UserCreatedHandler, // Registered with NestJS DI
    CreateUserCommandHandler, // Then discovered by VytchesDDD
    GetUserQueryHandler, // Standard NestJS flow
  ],
})
export class UserManagementModule {}
```

**When to use:**

- Testing scenarios (easier mocking)
- Small applications (< 50 handlers)
- Maximum control over registration timing

### Performance Optimization Levels

#### **Level 1: Basic Optimization** (23% improvement)

```typescript
VytchesDDDModule.forRoot({
  performance: {
    parallelRegistration: true, // Basic parallel processing
  },
});
```

#### **Level 2: Cached Discovery** (45% improvement)

```typescript
VytchesDDDModule.forRoot({
  performance: {
    enableCaching: true,
    cacheStrategy: 'memory', // Cache discovery results
    parallelRegistration: true,
  },
});
```

#### **Level 3: Selective Discovery** (67% improvement)

```typescript
VytchesDDDModule.forProduction({
  performance: {
    contexts: ['UserManagement', 'OrderProcessing'], // Only scan specific contexts
    performanceTarget: 150,
    autoOptimize: true,
    parallelRegistration: true,
  },
});
```

#### **Level 4: Enterprise Mode** (94% improvement)

```typescript
VytchesDDDModule.forEnterprise({
  performance: {
    performanceMode: 'enterprise',
    preCompiledRegistry: await generateHandlerRegistry(), // Build-time optimization
    skipDiscovery: true, // Zero runtime discovery
    maxStartupTime: 50,
  },
});
```

### Handler Dependencies - Full NestJS DI Support

VytchesDDD auto-discovery **fully supports NestJS dependency injection**:

```typescript
@Injectable()
@EventHandler(UserCreatedEvent)
export class UserCreatedHandler {
  constructor(
    private readonly emailService: EmailService, // ✅ NestJS DI works
    private readonly userRepository: UserRepository, // ✅ Standard injection
    private readonly logger: Logger, // ✅ Built-in services
    private readonly configService: ConfigService, // ✅ Configuration
    @Inject('CACHE_SERVICE')
    private readonly cache: CacheService, // ✅ Custom providers
    @Optional()
    private readonly optional?: OptionalService // ✅ Optional dependencies
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    // ✅ All NestJS dependencies available and working
    const config = this.configService.get('email.templates');
    this.logger.log('Processing user created event', {
      userId: event.payload.userId,
    });

    await this.emailService.sendWelcomeEmail(event.payload.email);
    await this.cache.set(`user:${event.payload.userId}`, event.payload);
  }
}
```

**VytchesDDD Bridge Pattern:**

- Uses NestJS `ModuleRef` to resolve dependencies
- Maintains full compatibility with NestJS DI container
- Supports custom providers, factories, and injection tokens
- Works with guards, interceptors, and pipes

### Context-Based Architecture Patterns

#### **Pattern 1: Global Buses + Context Discovery (Recommended)**

```typescript
// libs/shared/vytches-global.module.ts
@Global()
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      global: true,
      providers: [
        { provide: IEventBus, useClass: UnifiedEventBus }, // ✅ Single instance for integration events
        { provide: ICommandBus, useClass: EnhancedCommandBus }, // ✅ Global command processing
        { provide: IQueryBus, useClass: EnhancedQueryBus }, // ✅ Global query processing
      ],
      performance: {
        performanceMode: 'production',
        autoOptimize: true,
      },
    }),
  ],
  exports: [ICommandBus, IQueryBus, IEventBus],
})
export class VytchesGlobalModule {}

// contexts/user-management/user-management.module.ts
@Module({
  imports: [
    // ✅ Context-specific discovery only, uses global buses
    VytchesDDDModule.forContext('UserManagement', {
      performance: {
        contexts: ['UserManagement'], // Selective discovery
        performanceTarget: 100,
      },
    }),
  ],
  providers: [UserService, UserRepository], // Only domain services
})
export class UserManagementModule {}
```

**Benefits:**

- **🔄 Integration events work** - single EventBus instance across contexts
- **⚡ Simple DI** - no complex provider mapping per module
- **🎯 Performance optimized** - context-specific discovery
- **📊 Centralized monitoring** - global performance metrics

#### **Pattern 2: Context-Isolated Buses (Advanced)**

```typescript
@Module({
  imports: [
    VytchesDDDModule.forContext('UserManagement', {
      providers: [
        // ✅ Context-specific bus instances
        {
          provide: ICommandBus,
          useFactory: () =>
            new EnhancedCommandBus({
              middleware: [ValidationMiddleware, AuditMiddleware], // Context-specific middleware
            }),
        },
        {
          provide: IEventBus,
          useFactory: () =>
            new UnifiedEventBus({
              contextId: 'UserManagement', // Isolated event processing
            }),
        },
      ],
      performance: {
        contexts: ['UserManagement'],
        performanceMode: 'production',
      },
    }),
  ],
})
export class UserManagementModule {}
```

**When to use:**

- Different middleware requirements per context
- Strict domain isolation needed
- Context-specific performance tuning
- Independent scaling per bounded context

### Performance Monitoring and Alerts

#### **Real-time Performance Tracking**

```typescript
VytchesDDDModule.forProduction({
  monitoring: {
    enabled: true,
    warnAt: 100, // Warn if startup > 100ms
    errorAt: 200, // Error if startup > 200ms
    onPerformanceAlert: (metrics, level) => {
      console.log(`Performance Alert [${level}]:`, {
        startupTime: `${metrics.startupTime}ms`,
        handlersFound: metrics.handlersFound,
        optimizationStrategy: metrics.strategy,
        suggestions: metrics.suggestions,
      });

      // Integrate with monitoring systems
      if (level === 'error') {
        datadogClient.increment('vytches.performance.startup.error');
        slackNotifier.send(
          `Performance regression detected: ${metrics.startupTime}ms`
        );
      }
    },
  },
});
```

#### **Performance Metrics API**

```typescript
@Controller('system')
export class SystemController {
  constructor(private readonly explorer: VytchesExplorerService) {}

  @Get('performance')
  getPerformanceMetrics() {
    const metrics = this.explorer.getPerformanceMetrics();

    return {
      startupTime: `${metrics.startupTime}ms`,
      handlersFound: metrics.handlersFound,
      optimizationStrategy: metrics.strategy,
      cacheHitRate: `${metrics.cacheHitRate}%`,
      recommendations: metrics.suggestions,
      status: metrics.startupTime < 100 ? 'optimal' : 'needs-optimization',
    };
  }

  @Get('performance/recommendations')
  getOptimizationRecommendations() {
    const metrics = this.explorer.getPerformanceMetrics();

    const recommendations = [];

    if (metrics.handlersFound > 200) {
      recommendations.push({
        type: 'optimization',
        message: 'Consider using forEnterprise() for 200+ handlers',
        expectedImprovement: '94% faster startup',
      });
    }

    if (metrics.startupTime > 300) {
      recommendations.push({
        type: 'context-filtering',
        message: 'Enable selective context discovery',
        expectedImprovement: '67% faster startup',
      });
    }

    return { recommendations };
  }
}
```

### Testing Performance Optimizations

#### **Performance Testing Framework**

```typescript
describe('VP-012 Performance Guarantees', () => {
  it('should meet production startup targets', async () => {
    const startTime = Date.now();

    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forProduction({
          performance: {
            performanceTarget: 150, // 150ms target
            autoOptimize: true,
            contexts: ['UserManagement'],
          },
        }),
      ],
    }).compile();

    await module.init();
    const startupTime = Date.now() - startTime;

    expect(startupTime).toBeLessThan(150); // VP-012 production guarantee
  });

  it('should meet enterprise startup targets', async () => {
    const startTime = Date.now();

    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forEnterprise({
          performance: {
            performanceTarget: 50, // Aggressive 50ms target
            preCompiledRegistry: mockRegistry,
            skipDiscovery: true,
          },
        }),
      ],
    }).compile();

    await module.init();
    const startupTime = Date.now() - startTime;

    expect(startupTime).toBeLessThan(50); // VP-012 enterprise guarantee
  });
});
```

#### **Handler Registration Performance Tests**

```typescript
describe('Handler Registration Performance', () => {
  it('should register 100+ handlers in under 200ms', async () => {
    const handlers = Array.from({ length: 100 }, (_, i) =>
      createMockHandler(`Handler${i}`)
    );

    const startTime = Date.now();

    await Promise.all(
      handlers.map(handler => explorer.registerHandler(handler, 'TestContext'))
    );

    const registrationTime = Date.now() - startTime;

    expect(registrationTime).toBeLessThan(200);
    expect(handlers).toHaveLength(100);
  });
});
```

### Migration Guidelines

#### **From Standard NestJS CQRS to VytchesDDD**

```typescript
// BEFORE: Standard @nestjs/cqrs
@Module({
  imports: [CqrsModule],
  providers: [
    CreateUserCommandHandler,
    GetUserQueryHandler,
    UserCreatedEventHandler,
  ],
})
export class UserModule {}

// AFTER: VytchesDDD with performance optimization
@Module({
  imports: [
    VytchesDDDModule.forProduction({
      performance: {
        contexts: ['UserManagement'],
        performanceTarget: 100,
        autoOptimize: true,
      },
    }),
  ],
  providers: [
    // ✅ Only domain services - handlers auto-discovered
    UserService,
    UserRepository,
  ],
})
export class UserModule {}
```

**Migration steps:**

1. Replace `CqrsModule` with `VytchesDDDModule.forProduction()`
2. Remove handler providers (they'll be auto-discovered)
3. Add performance configuration for your context
4. Test startup performance improvements

#### **Performance Optimization Checklist**

- [ ] **Context Filtering**: Use `contexts: ['SpecificContext']` instead of
      scanning all files
- [ ] **Auto-Discovery**: Enable `autoDiscovery: true` for VP-012 optimization
- [ ] **Performance Mode**: Use `forProduction()` or `forEnterprise()` in
      production
- [ ] **Monitoring**: Enable performance monitoring with alerts
- [ ] **Caching**: Enable discovery result caching for repeated startups
- [ ] **Testing**: Add performance tests with startup time guarantees
- [ ] **Global Buses**: Use single bus instances for integration events
- [ ] **Handler Filtering**: Use `include/exclude` patterns for selective
      registration

## License

MIT © VytchesDDD Team
