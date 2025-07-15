# @vytches-ddd/testing

<!-- LLM-METADATA
Package: @vytches-ddd/testing
Category: Testing
Purpose: Comprehensive testing utilities and DDD-specific testing helpers for Domain-Driven Design patterns
Dependencies: @vytches-ddd/utils
Complexity: Medium
DDD Patterns: Test Harness, Test Data Builders, Time Control, Safe Execution
Integration Points: All packages use testing utilities; special patterns for aggregates, domain events, CQRS, and repositories
-->

[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Ftesting.svg)](https://badge.fury.io/js/%40vytches-ddd%2Ftesting)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Comprehensive testing utilities and DDD-specific testing helpers for Domain-Driven Design patterns**

Testing infrastructure specifically designed for Domain-Driven Design applications. Provides safe execution utilities, test harnesses, test data builders, time control mechanisms, and specialized testing patterns for aggregates, domain events, CQRS operations, and repositories.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Safe Execution](#safe-execution)
- [Test Harness](#test-harness)
- [Time Control](#time-control)
- [Test Data Builders](#test-data-builders)
- [DDD Testing Patterns](#ddd-testing-patterns)
- [Error Testing](#error-testing)
- [Async Testing](#async-testing)
- [Integration Testing](#integration-testing)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches-ddd/testing

# yarn
yarn add @vytches-ddd/testing

# pnpm
pnpm add @vytches-ddd/testing
```

### Dependencies

```bash
# Required peer dependency
npm install @vytches-ddd/utils
```

## ✨ Key Features

### Safe Execution
- **SafeRun Pattern**: Functional error handling for tests without try/catch
- **Type-Safe Error Testing**: Proper error handling with specific error types
- **Enhanced Error Context**: DDD-specific error handling with context information
- **Timeout Support**: Safe execution with configurable timeouts

### Test Harness System
- **Base Test Harness**: Foundation for all testing scenarios
- **Lifecycle Management**: Proper setup/teardown with resource management
- **Resource Tracking**: Automatic cleanup of test resources
- **State Management**: Track harness state and errors

### Time Control
- **Test Clock**: Deterministic time control for testing
- **Time Scenarios**: Builder pattern for complex time-based tests
- **Time Freezing**: Freeze time for consistent test execution
- **Time Advancement**: Controlled time progression in tests

### Test Data Builders
- **Entity Builders**: Create test entities with realistic data
- **Domain Event Builders**: Generate domain events for testing
- **User Builders**: Create test users with various scenarios
- **Sequence Generation**: Generate sequential test data

### DDD-Specific Testing
- **Aggregate Testing**: Specialized patterns for aggregate testing
- **Domain Event Testing**: Test domain event publication and handling
- **CQRS Testing**: Command and query handler testing utilities
- **Repository Testing**: Test repository patterns and persistence

## 🎯 Core Concepts

### SafeRun Pattern

The SafeRun pattern provides functional error handling for tests:

```typescript
// SafeRun result type
type SafeRunResult<T, E extends Error = Error> = readonly [E | undefined, T | undefined];

// Synchronous version
function safeRun<T, E extends Error = Error>(fn: () => T): SafeRunResult<T, E>

// Asynchronous version
function safeRun<T, E extends Error = Error>(fn: () => Promise<T>): Promise<SafeRunResult<T, E>>

// Enhanced testing version with context
function safeRunTest<T, E extends Error = Error>(
  fn: () => T | Promise<T>,
  context?: string
): SafeRunResult<T, E> | Promise<SafeRunResult<T, E>>

// With timeout support
function safeRunWithTimeout<T, E extends Error = Error>(
  fn: () => Promise<T>,
  timeoutMs: number,
  context?: string
): Promise<SafeRunResult<T, E | Error>>
```

### Test Harness Interface

Test harness provides structured testing infrastructure:

```typescript
interface TestHarnessOptions {
  autoCleanup?: boolean;
  enableTimeFreezing?: boolean;
  setupTimeout?: number;
  teardownTimeout?: number;
  verbose?: boolean;
}

interface TestHarnessState {
  readonly isInitialized: boolean;
  readonly isSetup: boolean;
  readonly setupTime: Date | null;
  readonly teardownTime: Date | null;
  readonly resourceCount: number;
  readonly hasErrors: boolean;
}

abstract class TestHarness {
  async initialize(): Promise<this>;
  async setup(): Promise<this>;
  async teardown(): Promise<this>;
  async reset(): Promise<this>;
  async dispose(): Promise<void>;
  getState(): TestHarnessState;
  getErrors(): readonly Error[];
}
```

### Test Data Builders

Builder pattern for creating test data:

```typescript
class TestDataBuilder {
  static sequence(options?: SequenceOptions): TestDataBuilder;
  static random(options?: RandomOptions): TestDataBuilder;
  withId(id: string): this;
  withTimestamp(timestamp: Date): this;
  build<T>(): T;
}

class EntityIdBuilder {
  static uuid(): EntityIdBuilder;
  static integer(value?: number): EntityIdBuilder;
  static text(value?: string): EntityIdBuilder;
  build(): string;
}
```

## 🚀 Quick Start

### Basic SafeRun Usage

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/testing';

describe('UserService', () => {
  it('should create user successfully', () => {
    const [error, user] = safeRun(() => {
      return userService.createUser({ name: 'John', email: 'john@example.com' });
    });

    expect(error).toBeUndefined();
    expect(user).toBeDefined();
    expect(user?.name).toBe('John');
  });

  it('should handle validation errors', () => {
    const [validationError] = safeRun(() => {
      return userService.createUser({ name: '', email: 'invalid' });
    });

    expect(validationError).toBeInstanceOf(ValidationError);
    expect(validationError?.message).toContain('Invalid email');
  });
});
```

### Basic Test Harness Usage

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleTestHarness } from '@vytches-ddd/testing';

describe('OrderService', () => {
  let harness: SimpleTestHarness;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      verbose: false,
      setupFn: async () => {
        // Custom setup logic
        await database.connect();
      },
      teardownFn: async () => {
        // Custom teardown logic
        await database.disconnect();
      }
    });

    await harness.initialize();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
    await harness.dispose();
  });

  it('should process orders', async () => {
    const [error, result] = harness.safeExecute(async () => {
      return await orderService.processOrder(testOrder);
    });

    expect(error).toBeUndefined();
    expect(result).toBeDefined();
  });
});
```

## 🔧 Safe Execution

### Synchronous Error Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, expectError, expectSuccess } from '@vytches-ddd/testing';

describe('ValidationService', () => {
  it('should validate email format', () => {
    const [error] = safeRun(() => {
      return validationService.validateEmail('invalid-email');
    });

    const validationError = expectError(ValidationError)([error, undefined]);
    expect(validationError.message).toContain('Invalid email format');
    expect(validationError.field).toBe('email');
  });

  it('should accept valid email', () => {
    const result = safeRun(() => {
      return validationService.validateEmail('user@example.com');
    });

    const validEmail = expectSuccess(result);
    expect(validEmail).toBe('user@example.com');
  });
});
```

### Asynchronous Error Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, safeRunTest, expectError } from '@vytches-ddd/testing';

describe('UserRepository', () => {
  it('should save user to database', async () => {
    const [error, savedUser] = await safeRun(async () => {
      return await userRepository.save(testUser);
    });

    expect(error).toBeUndefined();
    expect(savedUser).toBeDefined();
    expect(savedUser?.id).toBeTruthy();
  });

  it('should handle database connection errors', async () => {
    const [dbError] = await safeRunTest(async () => {
      await databaseConnection.disconnect();
      return await userRepository.save(testUser);
    }, 'database-connection-test');

    const connectionError = expectError(DatabaseConnectionError)([dbError, undefined]);
    expect(connectionError.data?.testContext).toBe('database-connection-test');
  });
});
```

### Timeout Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRunWithTimeout, expectError } from '@vytches-ddd/testing';

describe('ExternalService', () => {
  it('should timeout on slow operations', async () => {
    const [timeoutError] = await safeRunWithTimeout(
      async () => {
        return await externalService.slowOperation();
      },
      1000, // 1 second timeout
      'slow-operation-test'
    );

    expect(timeoutError).toBeInstanceOf(Error);
    expect(timeoutError?.message).toContain('Operation timed out after 1000ms');
    expect(timeoutError?.message).toContain('slow-operation-test');
  });

  it('should complete before timeout', async () => {
    const [error, result] = await safeRunWithTimeout(
      async () => {
        return await externalService.fastOperation();
      },
      5000, // 5 second timeout
      'fast-operation-test'
    );

    expect(error).toBeUndefined();
    expect(result).toBeDefined();
  });
});
```

## 🏗️ Test Harness

### Custom Test Harness

```typescript
import { TestHarness, TestResourceBuilder } from '@vytches-ddd/testing';

class DatabaseTestHarness extends TestHarness {
  private database: Database | null = null;
  private transactions: Transaction[] = [];

  protected async performInitialization(): Promise<void> {
    // Initialize database connection
    this.database = await Database.connect(testConfig);
    
    // Register database as a resource
    const dbResource = TestResourceBuilder.create('database', 'main')
      .withDisposal(async () => {
        await this.database?.close();
      })
      .build();
    
    this.registerResource(dbResource);
  }

  protected async performSetup(): Promise<void> {
    // Start transaction for test isolation
    const transaction = await this.database!.beginTransaction();
    this.transactions.push(transaction);
    
    // Register transaction as a resource
    const txResource = TestResourceBuilder.create('transaction', `tx-${Date.now()}`)
      .withDisposal(async () => {
        await transaction.rollback();
      })
      .build();
    
    this.registerResource(txResource);
  }

  protected async performTeardown(): Promise<void> {
    // Rollback all transactions
    for (const transaction of this.transactions) {
      await transaction.rollback();
    }
    this.transactions = [];
  }

  protected async performReset(): Promise<void> {
    // Clean up any test data
    await this.database?.clearTestData();
  }

  protected async performDisposal(): Promise<void> {
    // Final cleanup
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
  }

  // Helper methods for tests
  async createTestUser(userData: Partial<User>): Promise<User> {
    this.ensureSetup();
    return await this.database!.users.create(userData);
  }

  async getTestUser(id: string): Promise<User | null> {
    this.ensureSetup();
    return await this.database!.users.findById(id);
  }
}
```

### Using Custom Test Harness

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('User Integration Tests', () => {
  let harness: DatabaseTestHarness;

  beforeEach(async () => {
    harness = new DatabaseTestHarness({
      autoCleanup: true,
      verbose: process.env.NODE_ENV === 'development'
    });

    await harness.initialize();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.teardown();
    await harness.dispose();
  });

  it('should create and retrieve user', async () => {
    const [createError, user] = await harness.safeExecute(async () => {
      return await harness.createTestUser({ name: 'John', email: 'john@test.com' });
    });

    expect(createError).toBeUndefined();
    expect(user).toBeDefined();

    const [getError, retrievedUser] = await harness.safeExecute(async () => {
      return await harness.getTestUser(user!.id);
    });

    expect(getError).toBeUndefined();
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.name).toBe('John');
  });
});
```

## ⏰ Time Control

### Basic Time Control

```typescript
import { describe, it, expect } from 'vitest';
import { TestClock, withTestClock } from '@vytches-ddd/testing';

describe('TimeBasedService', () => {
  it('should handle time-based operations', () => {
    const testClock = TestClock.create();
    const startTime = new Date('2023-01-01T00:00:00Z');
    
    testClock.setTime(startTime);
    
    const service = new TimeBasedService();
    const result = service.processTimeBasedOperation();
    
    expect(result.timestamp).toEqual(startTime);
    
    // Advance time by 1 hour
    testClock.advance({ hours: 1 });
    
    const laterResult = service.processTimeBasedOperation();
    expect(laterResult.timestamp).toEqual(new Date('2023-01-01T01:00:00Z'));
    
    testClock.restore();
  });

  it('should test with automatic time restoration', () => {
    withTestClock(testClock => {
      testClock.setTime(new Date('2023-01-01T00:00:00Z'));
      
      const service = new TimeBasedService();
      const result = service.getCurrentTime();
      
      expect(result).toEqual(new Date('2023-01-01T00:00:00Z'));
    }); // Clock automatically restored here
  });
});
```

### Time Scenario Builder

```typescript
import { describe, it, expect } from 'vitest';
import { TimeScenarioBuilder } from '@vytches-ddd/testing';

describe('ScheduledTaskService', () => {
  it('should process scheduled tasks over time', () => {
    const scenario = TimeScenarioBuilder.create()
      .startAt(new Date('2023-01-01T09:00:00Z'))
      .step('Initial state', clock => {
        const tasks = taskService.getPendingTasks();
        expect(tasks).toHaveLength(0);
      })
      .advanceBy({ hours: 1 })
      .step('First task scheduled', clock => {
        taskService.scheduleTask('task1', clock.now());
        const tasks = taskService.getPendingTasks();
        expect(tasks).toHaveLength(1);
      })
      .advanceBy({ hours: 2 })
      .step('Task should be processed', clock => {
        taskService.processPendingTasks();
        const tasks = taskService.getPendingTasks();
        expect(tasks).toHaveLength(0);
      })
      .build();

    scenario.execute();
  });
});
```

## 🏗️ Test Data Builders

### Entity Builders

```typescript
import { describe, it, expect } from 'vitest';
import { EntityIdBuilder, UserBuilder, TestDataBuilder } from '@vytches-ddd/testing';

describe('User Management', () => {
  it('should create users with different ID types', () => {
    // UUID-based entity ID
    const uuidId = EntityIdBuilder.uuid().build();
    expect(uuidId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    // Integer-based entity ID
    const intId = EntityIdBuilder.integer(42).build();
    expect(intId).toBe('42');

    // Text-based entity ID
    const textId = EntityIdBuilder.text('user_123').build();
    expect(textId).toBe('user_123');
  });

  it('should create test users with builder pattern', () => {
    const user = UserBuilder.create()
      .withId(EntityIdBuilder.uuid().build())
      .withName('John Doe')
      .withEmail('john@example.com')
      .withAge(30)
      .withActive(true)
      .build();

    expect(user.id).toBeTruthy();
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.age).toBe(30);
    expect(user.active).toBe(true);
  });

  it('should generate sequential test data', () => {
    const builder = TestDataBuilder.sequence({
      start: 1,
      prefix: 'user_',
      suffix: '@test.com'
    });

    const user1 = builder.build<{ id: string; email: string }>();
    const user2 = builder.build<{ id: string; email: string }>();

    expect(user1.id).toBe('user_1');
    expect(user1.email).toBe('user_1@test.com');
    expect(user2.id).toBe('user_2');
    expect(user2.email).toBe('user_2@test.com');
  });
});
```

### Domain Event Builders

```typescript
import { describe, it, expect } from 'vitest';
import { DomainEventBuilder } from '@vytches-ddd/testing';

describe('Domain Events', () => {
  it('should create domain events with builder', () => {
    const event = DomainEventBuilder.create('UserCreated')
      .withAggregateId('user-123')
      .withPayload({
        name: 'John Doe',
        email: 'john@example.com'
      })
      .withVersion(1)
      .withTimestamp(new Date('2023-01-01T00:00:00Z'))
      .build();

    expect(event.eventType).toBe('UserCreated');
    expect(event.aggregateId).toBe('user-123');
    expect(event.payload.name).toBe('John Doe');
    expect(event.version).toBe(1);
    expect(event.timestamp).toEqual(new Date('2023-01-01T00:00:00Z'));
  });

  it('should generate event sequences', () => {
    const events = DomainEventBuilder.sequence('UserEvent')
      .withAggregateId('user-123')
      .withPayload({ action: 'created' })
      .generateEvents(3);

    expect(events).toHaveLength(3);
    expect(events[0].version).toBe(1);
    expect(events[1].version).toBe(2);
    expect(events[2].version).toBe(3);
  });
});
```

## 🎯 DDD Testing Patterns

### Aggregate Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, expectError, expectSuccess } from '@vytches-ddd/testing';

describe('OrderAggregate', () => {
  it('should create order with valid data', () => {
    const [error, order] = safeRun(() => {
      return OrderAggregate.create({
        customerId: 'customer-123',
        items: [{ productId: 'product-1', quantity: 2, price: 10.00 }]
      });
    });

    const createdOrder = expectSuccess([error, order]);
    expect(createdOrder.customerId).toBe('customer-123');
    expect(createdOrder.items).toHaveLength(1);
    expect(createdOrder.status).toBe('created');
  });

  it('should validate business rules', () => {
    const [businessError] = safeRun(() => {
      return OrderAggregate.create({
        customerId: 'customer-123',
        items: [] // Invalid: empty items
      });
    });

    const validationError = expectError(BusinessRuleViolationError)([businessError, undefined]);
    expect(validationError.rule).toBe('ORDER_MUST_HAVE_ITEMS');
  });

  it('should handle domain events', () => {
    const [error, order] = safeRun(() => {
      return OrderAggregate.create({
        customerId: 'customer-123',
        items: [{ productId: 'product-1', quantity: 1, price: 10.00 }]
      });
    });

    const createdOrder = expectSuccess([error, order]);
    const events = createdOrder.getUncommittedEvents();
    
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('OrderCreated');
    expect(events[0].aggregateId).toBe(createdOrder.id);
  });
});
```

### Repository Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun, expectSuccess, TestHarness } from '@vytches-ddd/testing';

describe('UserRepository', () => {
  let harness: TestHarness;
  let repository: UserRepository;

  beforeEach(async () => {
    harness = new DatabaseTestHarness();
    await harness.initialize();
    await harness.setup();
    
    repository = new UserRepository(harness.getDatabase());
  });

  it('should save and retrieve user', async () => {
    const user = User.create('John Doe', 'john@example.com');
    
    const [saveError, savedUser] = await safeRun(async () => {
      return await repository.save(user);
    });

    const saved = expectSuccess([saveError, savedUser]);
    expect(saved.id).toBe(user.id);

    const [getError, retrievedUser] = await safeRun(async () => {
      return await repository.findById(user.id);
    });

    const retrieved = expectSuccess([getError, retrievedUser]);
    expect(retrieved?.name).toBe('John Doe');
  });

  it('should handle optimistic concurrency', async () => {
    const user = User.create('John Doe', 'john@example.com');
    await repository.save(user);

    // Simulate concurrent modification
    const user1 = await repository.findById(user.id);
    const user2 = await repository.findById(user.id);

    user1?.updateName('John Smith');
    user2?.updateName('John Jones');

    await repository.save(user1!);

    const [concurrencyError] = await safeRun(async () => {
      return await repository.save(user2!);
    });

    expect(concurrencyError).toBeInstanceOf(OptimisticConcurrencyError);
  });
});
```

### CQRS Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, expectSuccess, expectError } from '@vytches-ddd/testing';

describe('CreateUserHandler', () => {
  it('should handle valid command', async () => {
    const command = new CreateUserCommand('John Doe', 'john@example.com');
    const handler = new CreateUserHandler(userRepository, eventBus);

    const [error, result] = await safeRun(async () => {
      return await handler.handle(command);
    });

    const handlerResult = expectSuccess([error, result]);
    expect(handlerResult.userId).toBeTruthy();
  });

  it('should validate command', async () => {
    const invalidCommand = new CreateUserCommand('', ''); // Invalid data
    const handler = new CreateUserHandler(userRepository, eventBus);

    const [validationError] = await safeRun(async () => {
      return await handler.handle(invalidCommand);
    });

    const commandError = expectError(CommandValidationError)([validationError, undefined]);
    expect(commandError.field).toBe('name');
  });
});

describe('GetUserHandler', () => {
  it('should handle valid query', async () => {
    const query = new GetUserQuery('user-123');
    const handler = new GetUserHandler(userRepository);

    const [error, result] = await safeRun(async () => {
      return await handler.handle(query);
    });

    const userResult = expectSuccess([error, result]);
    expect(userResult.id).toBe('user-123');
  });

  it('should handle user not found', async () => {
    const query = new GetUserQuery('nonexistent-user');
    const handler = new GetUserHandler(userRepository);

    const [notFoundError] = await safeRun(async () => {
      return await handler.handle(query);
    });

    const userNotFoundError = expectError(UserNotFoundError)([notFoundError, undefined]);
    expect(userNotFoundError.userId).toBe('nonexistent-user');
  });
});
```

## 🧪 Integration Testing

### End-to-End Test Scenarios

```typescript
import { describe, it, expect } from 'vitest';
import { SimpleTestHarness, safeRun, expectSuccess } from '@vytches-ddd/testing';

describe('Order Processing E2E', () => {
  let harness: SimpleTestHarness;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      enableTimeFreezing: true,
      setupFn: async () => {
        await setupTestDatabase();
        await setupTestEventBus();
        await setupTestServices();
      }
    });

    await harness.initialize();
    await harness.setup();
  });

  it('should process complete order workflow', async () => {
    // Create customer
    const [customerError, customer] = await harness.safeExecute(async () => {
      return await customerService.createCustomer({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    const createdCustomer = expectSuccess([customerError, customer]);

    // Create order
    const [orderError, order] = await harness.safeExecute(async () => {
      return await orderService.createOrder({
        customerId: createdCustomer.id,
        items: [{ productId: 'product-1', quantity: 2, price: 10.00 }]
      });
    });

    const createdOrder = expectSuccess([orderError, order]);
    expect(createdOrder.status).toBe('created');

    // Process payment
    const [paymentError, payment] = await harness.safeExecute(async () => {
      return await paymentService.processPayment({
        orderId: createdOrder.id,
        amount: 20.00,
        method: 'credit_card'
      });
    });

    const processedPayment = expectSuccess([paymentError, payment]);
    expect(processedPayment.status).toBe('completed');

    // Verify order is paid
    const [updatedOrderError, updatedOrder] = await harness.safeExecute(async () => {
      return await orderService.getOrder(createdOrder.id);
    });

    const finalOrder = expectSuccess([updatedOrderError, updatedOrder]);
    expect(finalOrder.status).toBe('paid');
  });
});
```

### Event-Driven Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, DomainEventBuilder } from '@vytches-ddd/testing';

describe('Event-Driven Workflow', () => {
  it('should handle event chain', async () => {
    const eventBus = new TestEventBus();
    const eventStore = new TestEventStore();
    
    // Create initial event
    const orderCreatedEvent = DomainEventBuilder.create('OrderCreated')
      .withAggregateId('order-123')
      .withPayload({
        customerId: 'customer-123',
        totalAmount: 100.00
      })
      .build();

    // Publish event
    const [publishError] = await safeRun(async () => {
      return await eventBus.publish(orderCreatedEvent);
    });

    expect(publishError).toBeUndefined();

    // Verify event was stored
    const [storeError, storedEvents] = await safeRun(async () => {
      return await eventStore.getEventsForAggregate('order-123');
    });

    expect(storeError).toBeUndefined();
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents?.[0].eventType).toBe('OrderCreated');

    // Verify event handlers were called
    const [handlerError, handlerResults] = await safeRun(async () => {
      return await eventBus.waitForHandlers();
    });

    expect(handlerError).toBeUndefined();
    expect(handlerResults?.handled).toHaveLength(1);
  });
});
```

## 📚 Advanced Usage

### Custom Error Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRun, expectError } from '@vytches-ddd/testing';

class CustomBusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'CustomBusinessError';
  }
}

describe('Custom Error Handling', () => {
  it('should handle custom error types', () => {
    const [error] = safeRun(() => {
      throw new CustomBusinessError('Invalid operation', 'INVALID_OP', 'operation');
    });

    const businessError = expectError(CustomBusinessError)([error, undefined]);
    expect(businessError.code).toBe('INVALID_OP');
    expect(businessError.field).toBe('operation');
  });
});
```

### Performance Testing

```typescript
import { describe, it, expect } from 'vitest';
import { safeRunWithTimeout, TestClock } from '@vytches-ddd/testing';

describe('Performance Testing', () => {
  it('should complete operations within time limit', async () => {
    const startTime = performance.now();
    
    const [error, result] = await safeRunWithTimeout(
      async () => {
        return await heavyComputationService.processLargeDataset();
      },
      5000, // 5 second timeout
      'performance-test'
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(error).toBeUndefined();
    expect(result).toBeDefined();
    expect(duration).toBeLessThan(5000);
  });

  it('should test time-based performance', () => {
    const testClock = TestClock.create();
    testClock.setTime(new Date('2023-01-01T00:00:00Z'));

    const startTime = testClock.now();
    
    // Simulate time-consuming operation
    testClock.advance({ seconds: 30 });
    
    const service = new TimeBasedService(testClock);
    const result = service.processWithTimeout(60000); // 60 second timeout

    expect(result.success).toBe(true);
    expect(result.processingTime).toBe(30000); // 30 seconds

    testClock.restore();
  });
});
```

## 🎯 Best Practices

### Error Testing Best Practices

1. **Use SafeRun Consistently**: Always use safeRun instead of try/catch in tests
2. **Specific Error Types**: Test for specific error types, not generic Error
3. **Error Context**: Use safeRunTest with context for better error messages
4. **Descriptive Variable Names**: Use descriptive names like `validationError`, `dbError`
5. **Test Both Cases**: Always test both success and error scenarios

### Test Harness Best Practices

1. **Resource Management**: Always use test harness for resource cleanup
2. **Setup/Teardown**: Implement proper setup and teardown in harnesses
3. **State Tracking**: Monitor harness state for debugging
4. **Error Handling**: Handle errors gracefully in teardown
5. **Resource Registration**: Register all resources for automatic cleanup

### Time Control Best Practices

1. **Deterministic Testing**: Use TestClock for predictable time-based tests
2. **Time Restoration**: Always restore time after tests
3. **Scenario Building**: Use TimeScenarioBuilder for complex time flows
4. **Clock Isolation**: Use separate clocks for different test scenarios
5. **Performance Considerations**: Be aware of time advancement performance

### Test Data Best Practices

1. **Builder Pattern**: Use builders for complex test data creation
2. **Realistic Data**: Generate realistic test data that matches production
3. **Data Isolation**: Ensure test data doesn't interfere between tests
4. **Sequence Generation**: Use sequence builders for consistent test data
5. **Cleanup Strategy**: Clean up test data after each test

## 🧪 Testing Examples

### Complete Test Suite Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SimpleTestHarness,
  safeRun,
  expectSuccess,
  expectError,
  EntityIdBuilder,
  UserBuilder,
  DomainEventBuilder,
  TestClock,
  withTestClock
} from '@vytches-ddd/testing';

describe('User Domain - Complete Test Suite', () => {
  let harness: SimpleTestHarness;
  let userService: UserService;
  let userRepository: UserRepository;
  let eventBus: EventBus;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      enableTimeFreezing: true,
      verbose: false
    });

    await harness.initialize();
    await harness.setup();

    userRepository = new TestUserRepository();
    eventBus = new TestEventBus();
    userService = new UserService(userRepository, eventBus);
  });

  afterEach(async () => {
    await harness.teardown();
    await harness.dispose();
  });

  describe('User Creation', () => {
    it('should create user with valid data', async () => {
      const userId = EntityIdBuilder.uuid().build();
      const userData = UserBuilder.create()
        .withId(userId)
        .withName('John Doe')
        .withEmail('john@example.com')
        .build();

      const [error, user] = await harness.safeExecute(async () => {
        return await userService.createUser(userData);
      });

      const createdUser = expectSuccess([error, user]);
      expect(createdUser.id).toBe(userId);
      expect(createdUser.name).toBe('John Doe');
      expect(createdUser.email).toBe('john@example.com');
    });

    it('should emit domain event on creation', async () => {
      const userData = UserBuilder.create()
        .withName('Jane Doe')
        .withEmail('jane@example.com')
        .build();

      const [error, user] = await harness.safeExecute(async () => {
        return await userService.createUser(userData);
      });

      const createdUser = expectSuccess([error, user]);
      const events = eventBus.getPublishedEvents();

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('UserCreated');
      expect(events[0].aggregateId).toBe(createdUser.id);
    });
  });

  describe('Time-Based Operations', () => {
    it('should handle user expiration', () => {
      withTestClock(testClock => {
        const startTime = new Date('2023-01-01T00:00:00Z');
        testClock.setTime(startTime);

        const user = UserBuilder.create()
          .withName('Test User')
          .withEmail('test@example.com')
          .withExpirationDate(new Date('2023-01-02T00:00:00Z'))
          .build();

        expect(user.isExpired()).toBe(false);

        // Advance time to expiration
        testClock.advance({ days: 1 });
        
        expect(user.isExpired()).toBe(true);
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle validation errors', async () => {
      const invalidData = UserBuilder.create()
        .withName('') // Invalid: empty name
        .withEmail('invalid-email') // Invalid: bad email format
        .build();

      const [validationError] = await harness.safeExecute(async () => {
        return await userService.createUser(invalidData);
      });

      const error = expectError(ValidationError)([validationError, undefined]);
      expect(error.field).toBe('name');
    });

    it('should handle duplicate email', async () => {
      const user1 = UserBuilder.create()
        .withName('User 1')
        .withEmail('same@example.com')
        .build();

      const user2 = UserBuilder.create()
        .withName('User 2')
        .withEmail('same@example.com') // Same email
        .build();

      // Create first user
      await harness.safeExecute(async () => {
        return await userService.createUser(user1);
      });

      // Try to create second user with same email
      const [duplicateError] = await harness.safeExecute(async () => {
        return await userService.createUser(user2);
      });

      const error = expectError(DuplicateEmailError)([duplicateError, undefined]);
      expect(error.email).toBe('same@example.com');
    });
  });
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/vytches/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build package
pnpm build

# Run testing-specific tests
pnpm test:packages:testing
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our [main documentation](../../README.md).