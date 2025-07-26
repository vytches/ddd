# @vytches/ddd-cqrs

<!-- LLM-METADATA
Package: @vytches/ddd-cqrs
Category: Architecture
Purpose: Command Query Responsibility Segregation (CQRS) implementation with decorators, middleware, and execution context
Dependencies: @vytches/ddd-domain-primitives, @vytches/ddd-utils, @vytches/ddd-di
Complexity: High
DDD Patterns: Command Pattern, Query Pattern, CQRS, Handler Pattern, Mediator Pattern
Integration Points: @vytches/ddd-di, @vytches/ddd-events, @vytches/ddd-logging, @vytches/ddd-validation
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-cqrs.svg)](https://badge.fury.io/js/%40vytches%2Fddd-cqrs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise-grade CQRS implementation with decorators, middleware, and
> automatic handler discovery**

Complete Command Query Responsibility Segregation (CQRS) implementation with
decorator-based handler registration, execution context, middleware pipeline,
and seamless integration with dependency injection.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Command Handling](#command-handling)
- [Query Handling](#query-handling)
- [Middleware System](#middleware-system)
- [Decorator System](#decorator-system)
- [Execution Context](#execution-context)
- [Integration with DI](#integration-with-di)
- [Advanced Usage](#advanced-usage)
- [Performance](#performance)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-cqrs

# yarn
yarn add @vytches/ddd-cqrs

# pnpm
pnpm add @vytches/ddd-cqrs
```

### Peer Dependencies

```bash
# Required for full functionality
npm install @vytches/ddd-domain-primitives @vytches/ddd-utils @vytches/ddd-di
```

## ✨ Key Features

### CQRS Architecture

- **Command Bus**: Executes commands that modify state
- **Query Bus**: Executes queries that read state
- **Handler Discovery**: Automatic handler registration with decorators
- **Middleware Pipeline**: Extensible middleware for cross-cutting concerns

### Enterprise Features

- **Execution Context**: Rich context propagation with correlation tracking
- **Performance Monitoring**: Built-in execution timing and metrics
- **Validation Integration**: Seamless validation with @vytches/ddd-validation
- **Logging Integration**: Automatic logging with @vytches/ddd-logging

### Developer Experience

- **Decorator-Based**: Simple @CommandHandler and @QueryHandler decorators
- **Type Safety**: Full TypeScript support with generic typing
- **DI Integration**: Automatic dependency injection with @vytches/ddd-di
- **Testing Support**: Built-in testing utilities and mocks

## 🎯 Core Concepts

### Command Query Responsibility Segregation (CQRS)

CQRS is a pattern that separates read and write operations for a data store.
Commands perform updates and queries return data.

```typescript
// Command - Changes system state
interface ICommand {
  readonly type: string;
  readonly timestamp: Date;
  readonly correlationId: string;
}

// Query - Returns data without side effects
interface IQuery<TResult> {
  readonly type: string;
  readonly timestamp: Date;
  readonly correlationId: string;
}

// Handler interfaces
interface ICommandHandler<TCommand extends ICommand> {
  handle(command: TCommand, context: ExecutionContext): Promise<void>;
}

interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
  handle(query: TQuery, context: ExecutionContext): Promise<TResult>;
}
```

### Command Bus

The command bus routes commands to their appropriate handlers:

```typescript
interface ICommandBus {
  execute<TCommand extends ICommand>(
    command: TCommand,
    context?: Partial<ExecutionContext>
  ): Promise<void>;

  executeMany<TCommand extends ICommand>(
    commands: TCommand[],
    context?: Partial<ExecutionContext>
  ): Promise<void>;
}
```

### Query Bus

The query bus routes queries to their appropriate handlers:

```typescript
interface IQueryBus {
  execute<TQuery extends IQuery<TResult>, TResult>(
    query: TQuery,
    context?: Partial<ExecutionContext>
  ): Promise<TResult>;

  executeMany<TQuery extends IQuery<TResult>, TResult>(
    queries: TQuery[],
    context?: Partial<ExecutionContext>
  ): Promise<TResult[]>;
}
```

## 🚀 Quick Start

### 1. Basic Command Setup

```typescript
import { ICommand, CommandHandler, ICommandHandler } from '@vytches/ddd-cqrs';
import { ExecutionContext } from '@vytches/ddd-cqrs';

// Define a command
class CreateUserCommand implements ICommand {
  readonly type = 'CreateUserCommand';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly name: string,
    public readonly email: string,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}

// Create a command handler
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler
  implements ICommandHandler<CreateUserCommand>
{
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: IEventBus
  ) {}

  async handle(
    command: CreateUserCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Business logic
    const user = User.create(command.name, command.email);

    // Persist changes
    await this.userRepository.save(user);

    // Publish domain events
    await this.eventBus.publishMany(user.getUncommittedEvents());

    // Log success
    context.logger.info('User created successfully', {
      userId: user.id.value,
      email: user.email,
    });
  }
}
```

### 2. Basic Query Setup

```typescript
import { IQuery, QueryHandler, IQueryHandler } from '@vytches/ddd-cqrs';

// Define a query
class GetUserByIdQuery implements IQuery<UserDto> {
  readonly type = 'GetUserByIdQuery';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly userId: string,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}

// Define the result type
interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a query handler
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdQueryHandler
  implements IQueryHandler<GetUserByIdQuery, UserDto>
{
  constructor(private readonly userRepository: UserRepository) {}

  async handle(
    query: GetUserByIdQuery,
    context: ExecutionContext
  ): Promise<UserDto> {
    const user = await this.userRepository.findById(query.userId);

    if (!user) {
      throw new NotFoundError(`User with id ${query.userId} not found`);
    }

    return {
      id: user.id.value,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
```

### 3. Using the Buses

```typescript
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
import { VytchesDDD } from '@vytches/ddd-di';

// Setup (typically in your application bootstrap)
const commandBus = VytchesDDD.resolve<CommandBus>('CommandBus');
const queryBus = VytchesDDD.resolve<QueryBus>('QueryBus');

// Execute commands
const createUserCommand = new CreateUserCommand('John Doe', 'john@example.com');
await commandBus.execute(createUserCommand);

// Execute queries
const getUserQuery = new GetUserByIdQuery('user-123');
const user = await queryBus.execute(getUserQuery);

console.log('User:', user);
```

## 📚 Command Handling

### Command Definition

```typescript
import { ICommand } from '@vytches/ddd-cqrs';

class UpdateUserProfileCommand implements ICommand {
  readonly type = 'UpdateUserProfileCommand';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly userId: string,
    public readonly updates: {
      name?: string;
      email?: string;
      phone?: string;
    },
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}
```

### Command Handler with Validation

```typescript
import { CommandHandler, ICommandHandler } from '@vytches/ddd-cqrs';
import { LogCommands } from '@vytches/ddd-cqrs';
import { Validate } from '@vytches/ddd-validation';

@CommandHandler(UpdateUserProfileCommand)
@LogCommands({ includePayload: true, logLevel: 'info' })
export class UpdateUserProfileCommandHandler
  implements ICommandHandler<UpdateUserProfileCommand>
{
  constructor(
    private readonly userRepository: UserRepository,
    private readonly validator: IValidator,
    private readonly eventBus: IEventBus
  ) {}

  async handle(
    command: UpdateUserProfileCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Validate command
    await this.validator.validate(command, UserUpdateValidationRules);

    // Load aggregate
    const user = await this.userRepository.findById(command.userId);
    if (!user) {
      throw new NotFoundError(`User ${command.userId} not found`);
    }

    // Apply business logic
    if (command.updates.name) {
      user.changeName(command.updates.name);
    }

    if (command.updates.email) {
      user.changeEmail(command.updates.email);
    }

    if (command.updates.phone) {
      user.changePhone(command.updates.phone);
    }

    // Persist changes
    await this.userRepository.save(user);

    // Publish events
    await this.eventBus.publishMany(user.getUncommittedEvents());

    context.logger.info('User profile updated', {
      userId: command.userId,
      updatedFields: Object.keys(command.updates),
    });
  }
}
```

### Batch Command Processing

```typescript
import { CommandBus } from '@vytches/ddd-cqrs';

const commandBus = VytchesDDD.resolve<CommandBus>('CommandBus');

// Process multiple commands in batch
const commands = [
  new CreateUserCommand('John', 'john@example.com'),
  new CreateUserCommand('Jane', 'jane@example.com'),
  new CreateUserCommand('Bob', 'bob@example.com'),
];

await commandBus.executeMany(commands, {
  correlationId: 'batch-user-creation-123',
  userId: 'admin-user',
  tenantId: 'tenant-1',
});
```

## 🔍 Query Handling

### Query Definition

```typescript
import { IQuery } from '@vytches/ddd-cqrs';

class GetUsersByRoleQuery implements IQuery<UserDto[]> {
  readonly type = 'GetUsersByRoleQuery';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly role: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}
```

### Query Handler with Caching

```typescript
import { QueryHandler, IQueryHandler } from '@vytches/ddd-cqrs';
import { LogQueries } from '@vytches/ddd-cqrs';
import { Cacheable } from '@vytches/ddd-caching';

@QueryHandler(GetUsersByRoleQuery)
@LogQueries({ logLevel: 'debug' })
@Cacheable({ ttl: 300, keyGenerator: query => `users-by-role-${query.role}` })
export class GetUsersByRoleQueryHandler
  implements IQueryHandler<GetUsersByRoleQuery, UserDto[]>
{
  constructor(private readonly userRepository: UserRepository) {}

  async handle(
    query: GetUsersByRoleQuery,
    context: ExecutionContext
  ): Promise<UserDto[]> {
    const users = await this.userRepository.findByRole(
      query.role,
      query.limit,
      query.offset
    );

    return users.map(user => ({
      id: user.id.value,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }));
  }
}
```

### Complex Query with Joins

```typescript
class GetUserOrderHistoryQuery implements IQuery<UserOrderHistoryDto> {
  readonly type = 'GetUserOrderHistoryQuery';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly userId: string,
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}

interface UserOrderHistoryDto {
  user: UserDto;
  orders: OrderSummaryDto[];
  totalSpent: number;
  orderCount: number;
}

@QueryHandler(GetUserOrderHistoryQuery)
export class GetUserOrderHistoryQueryHandler
  implements IQueryHandler<GetUserOrderHistoryQuery, UserOrderHistoryDto>
{
  constructor(
    private readonly userRepository: UserRepository,
    private readonly orderRepository: OrderRepository
  ) {}

  async handle(
    query: GetUserOrderHistoryQuery,
    context: ExecutionContext
  ): Promise<UserOrderHistoryDto> {
    // Load user
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new NotFoundError(`User ${query.userId} not found`);
    }

    // Load orders with filters
    const orders = await this.orderRepository.findByUserId(
      query.userId,
      query.startDate,
      query.endDate
    );

    // Calculate aggregates
    const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

    return {
      user: {
        id: user.id.value,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      orders: orders.map(order => ({
        id: order.id.value,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
      })),
      totalSpent,
      orderCount: orders.length,
    };
  }
}
```

## 🔧 Middleware System

### Built-in Middleware

```typescript
import {
  ValidationMiddleware,
  LoggingMiddleware,
  PerformanceMiddleware,
  AuthorizationMiddleware,
} from '@vytches/ddd-cqrs';

// Configure middleware pipeline
const commandBus = new CommandBus([
  new ValidationMiddleware(),
  new AuthorizationMiddleware(),
  new LoggingMiddleware(),
  new PerformanceMiddleware(),
]);
```

### Custom Middleware

```typescript
import { ICommandMiddleware, IQueryMiddleware } from '@vytches/ddd-cqrs';

// Command middleware
export class AuditMiddleware implements ICommandMiddleware {
  async handle<TCommand extends ICommand>(
    command: TCommand,
    context: ExecutionContext,
    next: () => Promise<void>
  ): Promise<void> {
    // Pre-execution
    await this.auditService.logCommandStart(command, context);

    try {
      await next();

      // Post-execution success
      await this.auditService.logCommandSuccess(command, context);
    } catch (error) {
      // Post-execution error
      await this.auditService.logCommandError(command, context, error);
      throw error;
    }
  }
}

// Query middleware
export class CachingMiddleware implements IQueryMiddleware {
  async handle<TQuery extends IQuery<TResult>, TResult>(
    query: TQuery,
    context: ExecutionContext,
    next: () => Promise<TResult>
  ): Promise<TResult> {
    const cacheKey = this.generateCacheKey(query);

    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      context.logger.debug('Cache hit', { cacheKey });
      return cached;
    }

    // Execute query
    const result = await next();

    // Cache result
    await this.cache.set(cacheKey, result, { ttl: 300 });

    return result;
  }
}
```

## 🎯 Decorator System

### Enhanced Command Handler Decorator

```typescript
import { CommandHandler } from '@vytches/ddd-cqrs';

@CommandHandler(CreateOrderCommand, {
  // DI options
  lifetime: 'transient',
  context: 'OrderManagement',
  tags: ['order', 'business'],

  // Execution options
  timeout: 30000,
  retries: 3,

  // Middleware
  middleware: [ValidationMiddleware, AuthorizationMiddleware],

  // Logging
  logging: {
    includePayload: true,
    logLevel: 'info',
    maskSensitiveData: true,
  },
})
export class CreateOrderCommandHandler {
  async handle(
    command: CreateOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Handler automatically configured with all options
  }
}
```

### Enhanced Query Handler Decorator

```typescript
import { QueryHandler } from '@vytches/ddd-cqrs';

@QueryHandler(GetOrderDetailsQuery, {
  // DI options
  lifetime: 'singleton',
  context: 'OrderManagement',

  // Caching
  cache: {
    ttl: 300,
    keyGenerator: query => `order-${query.orderId}`,
    tags: ['order', 'details'],
  },

  // Performance
  timeout: 5000,

  // Logging
  logging: {
    logLevel: 'debug',
    includeResult: false,
  },
})
export class GetOrderDetailsQueryHandler {
  async handle(
    query: GetOrderDetailsQuery,
    context: ExecutionContext
  ): Promise<OrderDetailsDto> {
    // Handler automatically configured with caching and performance monitoring
  }
}
```

### Logging Decorators

```typescript
import { LogCommands, LogQueries, LogCQRS } from '@vytches/ddd-cqrs';

// Command-specific logging
@LogCommands({
  includePayload: true,
  logLevel: 'info',
  maskFields: ['password', 'creditCard'],
})
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  // Automatic logging of command execution
}

// Query-specific logging
@LogQueries({
  logLevel: 'debug',
  includeResult: true,
  maxResultLength: 1000,
})
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler {
  // Automatic logging of query execution
}

// Universal CQRS logging
@LogCQRS({
  logLevel: 'info',
  includeContext: true,
  includePerformance: true,
})
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentCommandHandler {
  // Automatic logging for all CQRS operations
}
```

## 🔄 Execution Context

### Context Properties

```typescript
interface ExecutionContext {
  // Correlation tracking
  correlationId: string;
  causationId?: string;

  // User and tenant context
  userId?: string;
  tenantId?: string;

  // Request context
  requestId?: string;
  sessionId?: string;

  // Execution metadata
  timestamp: Date;
  executionId: string;

  // Performance tracking
  startTime: number;

  // Logging
  logger: ILogger;

  // Custom metadata
  metadata: Record<string, any>;
}
```

### Context Usage

```typescript
@CommandHandler(ProcessOrderCommand)
export class ProcessOrderCommandHandler {
  async handle(
    command: ProcessOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Use correlation tracking
    context.logger.info('Processing order', {
      orderId: command.orderId,
      correlationId: context.correlationId,
      userId: context.userId,
    });

    // Add custom metadata
    context.metadata.orderProcessingStage = 'validation';

    // Pass context to other services
    await this.paymentService.processPayment(
      command.paymentDetails,
      context.correlationId
    );

    // Update metadata
    context.metadata.orderProcessingStage = 'completed';
  }
}
```

### Context Propagation

```typescript
// Context is automatically propagated through the execution chain
const context = {
  correlationId: 'req-123',
  userId: 'user-456',
  tenantId: 'tenant-789',
};

// Execute command with context
await commandBus.execute(new CreateOrderCommand(orderData), context);

// Context is available in all handlers and middleware
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler {
  async handle(
    command: CreateOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Context contains all the propagated information
    console.log('Correlation ID:', context.correlationId); // 'req-123'
    console.log('User ID:', context.userId); // 'user-456'
    console.log('Tenant ID:', context.tenantId); // 'tenant-789'
  }
}
```

## 🔗 Integration with DI

### Automatic Handler Registration

```typescript
import { VytchesDDD } from '@vytches/ddd-di';
import { CQRSDiscoveryPlugin } from '@vytches/ddd-cqrs';

// Register the CQRS discovery plugin
VytchesDDD.registerDiscoveryPlugin(new CQRSDiscoveryPlugin());

// Auto-discover and register all handlers
await VytchesDDD.discoverAndRegisterHandlers();

// Handlers are now available through service locator
const commandBus = VytchesDDD.resolve<CommandBus>('CommandBus');
const queryBus = VytchesDDD.resolve<QueryBus>('QueryBus');
```

### Service Locator in Handlers

```typescript
@CommandHandler(ComplexBusinessCommand)
export class ComplexBusinessCommandHandler {
  async handle(
    command: ComplexBusinessCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Use service locator for complex dependencies
    const userService = VytchesDDD.resolve<UserService>('UserService');
    const orderService = VytchesDDD.resolve<OrderService>('OrderService');
    const paymentService = VytchesDDD.resolve<PaymentService>('PaymentService');
    const notificationService = VytchesDDD.resolve<NotificationService>(
      'NotificationService'
    );

    // Complex business logic with multiple services
    await userService.validateUser(command.userId);
    const order = await orderService.createOrder(command.orderData);
    await paymentService.processPayment(command.paymentData);
    await notificationService.sendOrderConfirmation(order);
  }
}
```

### Context-Aware Resolution

```typescript
@CommandHandler(ProcessPaymentCommand, { context: 'OrderManagement' })
export class ProcessPaymentCommandHandler {
  async handle(
    command: ProcessPaymentCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Resolve services from specific context
    const paymentProcessor = VytchesDDD.resolve<PaymentProcessor>(
      'PaymentProcessor',
      'OrderManagement'
    );

    await paymentProcessor.processPayment(command.paymentDetails);
  }
}
```

## 🔧 Advanced Usage

### Saga Pattern with CQRS

```typescript
@CommandHandler(StartOrderProcessingSagaCommand)
export class StartOrderProcessingSagaCommandHandler {
  async handle(
    command: StartOrderProcessingSagaCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Create saga instance
    const saga = new OrderProcessingSaga(command.orderId);

    // Start saga with initial command
    const nextCommands = await saga.handle(command, context);

    // Execute follow-up commands
    for (const nextCommand of nextCommands) {
      await this.commandBus.execute(nextCommand, context);
    }

    // Persist saga state
    await this.sagaRepository.save(saga);
  }
}
```

### Event-Driven Command Processing

```typescript
@CommandHandler(ProcessOrderCommand)
export class ProcessOrderCommandHandler {
  async handle(
    command: ProcessOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Process the order
    const order = await this.orderService.processOrder(command.orderData);

    // Generate follow-up commands based on events
    const events = order.getUncommittedEvents();

    for (const event of events) {
      const followUpCommands =
        await this.commandGeneratorService.generateCommands(event);

      for (const followUpCommand of followUpCommands) {
        await this.commandBus.execute(followUpCommand, context);
      }
    }
  }
}
```

### Query Composition

```typescript
@QueryHandler(GetOrderSummaryQuery)
export class GetOrderSummaryQueryHandler {
  async handle(
    query: GetOrderSummaryQuery,
    context: ExecutionContext
  ): Promise<OrderSummaryDto> {
    // Compose multiple queries
    const [order, customer, payments] = await Promise.all([
      this.queryBus.execute(new GetOrderDetailsQuery(query.orderId), context),
      this.queryBus.execute(
        new GetCustomerDetailsQuery(query.customerId),
        context
      ),
      this.queryBus.execute(new GetOrderPaymentsQuery(query.orderId), context),
    ]);

    // Combine results
    return {
      order,
      customer,
      payments,
      totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
    };
  }
}
```

## ⚡ Performance

### Execution Timing

```typescript
// Automatic performance monitoring
@CommandHandler(ProcessLargeDataCommand)
@LogCommands({ includePerformance: true })
export class ProcessLargeDataCommandHandler {
  async handle(
    command: ProcessLargeDataCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Execution time automatically tracked and logged
    await this.dataProcessingService.processLargeDataset(command.dataset);
  }
}
```

### Batch Processing

```typescript
// Optimize batch operations
const commands = largeDataset.map(data => new ProcessDataCommand(data));

// Process in batches for better performance
const batchSize = 100;
for (let i = 0; i < commands.length; i += batchSize) {
  const batch = commands.slice(i, i + batchSize);
  await commandBus.executeMany(batch, context);
}
```

### Caching Strategies

```typescript
@QueryHandler(GetProductCatalogQuery)
export class GetProductCatalogQueryHandler {
  private cache = new Map<string, ProductCatalogDto>();

  async handle(
    query: GetProductCatalogQuery,
    context: ExecutionContext
  ): Promise<ProductCatalogDto> {
    const cacheKey = `catalog-${query.categoryId}-${query.version}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Load from database
    const catalog = await this.catalogService.getProductCatalog(
      query.categoryId
    );

    // Cache result
    this.cache.set(cacheKey, catalog);

    return catalog;
  }
}
```

## 🧪 Testing

### Unit Testing Handlers

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockExecutionContext } from '@vytches/ddd-cqrs/testing';

describe('CreateUserCommandHandler', () => {
  let handler: CreateUserCommandHandler;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockEventBus: jest.Mocked<IEventBus>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      publishMany: jest.fn(),
    };

    mockContext = createMockExecutionContext();

    handler = new CreateUserCommandHandler(mockRepository, mockEventBus);
  });

  it('should create user successfully', async () => {
    // Arrange
    const command = new CreateUserCommand('John Doe', 'john@example.com');

    // Act
    await handler.handle(command, mockContext);

    // Assert
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        email: 'john@example.com',
      })
    );
    expect(mockEventBus.publishMany).toHaveBeenCalled();
  });

  it('should handle validation errors', async () => {
    // Arrange
    const command = new CreateUserCommand('', 'invalid-email');

    // Act & Assert
    await expect(handler.handle(command, mockContext)).rejects.toThrow(
      ValidationError
    );
  });
});
```

### Integration Testing

```typescript
import { TestCommandBus, TestQueryBus } from '@vytches/ddd-cqrs/testing';

describe('Order Management Integration', () => {
  let commandBus: TestCommandBus;
  let queryBus: TestQueryBus;

  beforeEach(() => {
    commandBus = new TestCommandBus();
    queryBus = new TestQueryBus();

    // Register handlers
    commandBus.registerHandler(
      CreateOrderCommand,
      new CreateOrderCommandHandler()
    );
    queryBus.registerHandler(GetOrderQuery, new GetOrderQueryHandler());
  });

  it('should create and retrieve order', async () => {
    // Create order
    const createCommand = new CreateOrderCommand(orderData);
    await commandBus.execute(createCommand);

    // Retrieve order
    const getQuery = new GetOrderQuery(createCommand.orderId);
    const order = await queryBus.execute(getQuery);

    // Verify
    expect(order).toBeDefined();
    expect(order.id).toBe(createCommand.orderId);
  });
});
```

### Mock Utilities

```typescript
import {
  createMockCommandBus,
  createMockQueryBus,
} from '@vytches/ddd-cqrs/testing';

// Mock command bus
const mockCommandBus = createMockCommandBus();
mockCommandBus.execute.mockResolvedValue(undefined);

// Mock query bus
const mockQueryBus = createMockQueryBus();
mockQueryBus.execute.mockResolvedValue(mockUserDto);

// Use in tests
await mockCommandBus.execute(new CreateUserCommand('John', 'john@example.com'));
const user = await mockQueryBus.execute(new GetUserQuery('user-123'));
```

## 🏆 Best Practices

### Command Design

```typescript
// ✅ Good: Immutable command with clear intent
class CreateUserCommand implements ICommand {
  readonly type = 'CreateUserCommand';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly role: UserRole,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}

// ❌ Bad: Mutable command with unclear intent
class UserCommand {
  public action: string;
  public data: any;
  public timestamp: Date;
}
```

### Query Design

```typescript
// ✅ Good: Specific query with typed result
class GetUsersByDepartmentQuery implements IQuery<UserDto[]> {
  readonly type = 'GetUsersByDepartmentQuery';
  readonly timestamp = new Date();
  readonly correlationId: string;

  constructor(
    public readonly departmentId: string,
    public readonly includeInactive: boolean = false,
    correlationId?: string
  ) {
    this.correlationId = correlationId || crypto.randomUUID();
  }
}

// ❌ Bad: Generic query with untyped result
class GenericQuery {
  public entity: string;
  public filters: any;
}
```

### Handler Responsibilities

```typescript
// ✅ Good: Single responsibility, clear dependencies
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler {
  constructor(
    private readonly orderService: OrderService,
    private readonly eventBus: IEventBus
  ) {}

  async handle(
    command: CreateOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Single responsibility: create order
    const order = await this.orderService.createOrder(command.orderData);
    await this.eventBus.publishMany(order.getUncommittedEvents());
  }
}

// ❌ Bad: Multiple responsibilities, unclear dependencies
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler {
  async handle(
    command: CreateOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Too many responsibilities
    await this.validateUser(command.userId);
    await this.checkInventory(command.items);
    await this.processPayment(command.payment);
    await this.sendEmail(command.email);
    await this.updateAnalytics(command.data);
  }
}
```

### Error Handling

```typescript
// ✅ Good: Specific error handling
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentCommandHandler {
  async handle(
    command: ProcessPaymentCommand,
    context: ExecutionContext
  ): Promise<void> {
    try {
      await this.paymentService.processPayment(command.paymentDetails);
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw new PaymentFailedError(
          'Insufficient funds',
          command.paymentDetails.amount
        );
      }

      if (error instanceof InvalidCardError) {
        throw new PaymentFailedError(
          'Invalid card details',
          command.paymentDetails.cardNumber
        );
      }

      // Re-throw unexpected errors
      throw error;
    }
  }
}
```

## 🔗 Integration Patterns

### Event-Driven Architecture

```typescript
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler {
  async handle(
    command: CreateOrderCommand,
    context: ExecutionContext
  ): Promise<void> {
    // Create order aggregate
    const order = Order.create(command.orderData);

    // Persist aggregate
    await this.orderRepository.save(order);

    // Publish domain events automatically
    await this.eventBus.publishMany(order.getUncommittedEvents());
  }
}

// Event handlers can trigger additional commands
@EventHandler(OrderCreatedEvent)
export class OrderCreatedEventHandler {
  async handle(
    event: OrderCreatedEvent,
    context: ExecutionContext
  ): Promise<void> {
    // Trigger inventory reservation
    await this.commandBus.execute(
      new ReserveInventoryCommand(event.orderId, event.items),
      context
    );

    // Trigger payment processing
    await this.commandBus.execute(
      new ProcessPaymentCommand(event.orderId, event.paymentDetails),
      context
    );
  }
}
```

### Saga Orchestration

```typescript
@CommandHandler(StartOrderProcessingSagaCommand)
export class StartOrderProcessingSagaCommandHandler {
  async handle(
    command: StartOrderProcessingSagaCommand,
    context: ExecutionContext
  ): Promise<void> {
    const saga = new OrderProcessingSaga(command.orderId);

    // Define saga steps
    const steps = [
      () =>
        this.commandBus.execute(
          new ValidateOrderCommand(command.orderId),
          context
        ),
      () =>
        this.commandBus.execute(
          new ReserveInventoryCommand(command.orderId),
          context
        ),
      () =>
        this.commandBus.execute(
          new ProcessPaymentCommand(command.orderId),
          context
        ),
      () =>
        this.commandBus.execute(
          new FulfillOrderCommand(command.orderId),
          context
        ),
    ];

    // Execute saga
    await saga.execute(steps, context);
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see our
[Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/ddd.git
cd ddd

# Install dependencies
pnpm install

# Build package
pnpm build --filter=@vytches/ddd-cqrs

# Run tests
pnpm test --filter=@vytches/ddd-cqrs

# Run in development mode
pnpm dev --filter=@vytches/ddd-cqrs
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the [@vytches/ddd-core](https://github.com/vytches/ddd) ecosystem**

For more information, visit the [main documentation](../../README.md).
