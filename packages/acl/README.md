# @vytches/ddd-acl

<!-- LLM-METADATA
Package: @vytches/ddd-acl
Category: Integration
Purpose: Anti-Corruption Layer for external system integration with domain model protection, translation, and middleware support
Dependencies: @vytches/ddd-core, @vytches/ddd-validation
Complexity: High
DDD Patterns: Anti-Corruption Layer, Model Translation, Adapter Pattern, Integration Layer
Integration Points: Protects domain model from external systems; integrates with repositories, CQRS, and domain services
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-acl.svg)](https://badge.fury.io/js/%40vytches%2Fddd-acl)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Anti-Corruption Layer for external system integration with domain model
> protection**

Enterprise-grade Anti-Corruption Layer implementation for Domain-Driven Design
applications. Provides model translation, adapter patterns, middleware support,
and comprehensive integration capabilities while protecting your domain model
from external system changes.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [ACL Adapters](#acl-adapters)
- [Model Translation](#model-translation)
- [Middleware System](#middleware-system)
- [Registry Management](#registry-management)
- [Typed Operations](#typed-operations)
- [Error Handling](#error-handling)
- [Application Services](#application-services)
- [Advanced Usage](#advanced-usage)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-acl

# yarn
yarn add @vytches/ddd-acl

# pnpm
pnpm add @vytches/ddd-acl
```

### Dependencies

```bash
# Required peer dependencies
npm install @vytches/ddd-core @vytches/ddd-validation
```

## ✨ Key Features

### Domain Model Protection

- **Anti-Corruption Layer**: Isolates domain model from external system changes
- **Model Translation**: Bidirectional translation between domain and external
  models
- **Validation Integration**: Comprehensive validation for both domain and
  external models
- **Type Safety**: Full TypeScript support with strict type checking

### Adapter Pattern

- **Base ACL Adapter**: Foundation for all external system integrations
- **Enhanced ACL Adapter**: Advanced features with middleware and typed
  operations
- **Simple ACL Adapter**: Lightweight implementation for basic scenarios
- **Context Information**: Rich metadata about external system integration

### Middleware System

- **Request/Response Middleware**: Intercept and modify requests/responses
- **Error Handling Middleware**: Centralized error handling and transformation
- **Logging Middleware**: Comprehensive logging for integration operations
- **Retry Middleware**: Automatic retry logic for transient failures

### Registry Management

- **ACL Registry**: Centralized management of ACL adapters
- **Context Registry**: Bounded context-specific adapter management
- **Versioned Registry**: Support for multiple adapter versions
- **Dynamic Registration**: Runtime adapter registration and discovery

### Typed Operations

- **Type-Safe Operations**: Strongly typed operation definitions
- **Business Rule Validation**: Operation-specific business rule validation
- **Operation Metadata**: Rich metadata for operation documentation
- **Result Pattern**: Consistent error handling with Result pattern

## 🎯 Core Concepts

### ACL Adapter Interface

The core interface for all ACL adapters:

```typescript
interface IACLAdapter<TDomainModel, TExternalModel, TResult = any> {
  execute(
    operation: string,
    domainModel: TDomainModel,
    options?: ExecuteOptions
  ): Promise<Result<TResult, ACLError>>;

  fetch(identifier: string): Promise<Result<TDomainModel, ACLError>>;
  supportsOperation(operation: string): boolean;
  getContextInfo(): ACLContextInfo;
}

interface ExecuteOptions {
  version?: string;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
  correlationId?: string;
}
```

### Model Translator Interface

For domain-external model translation:

```typescript
interface IModelTranslator<TDomain, TExternal> {
  toExternal(domainModel: TDomain): TExternal;
  fromExternal(externalModel: TExternal): TDomain;
  validateDomain?(domainModel: TDomain): Result<void, Error>;
  validateExternal?(externalModel: TExternal): Result<void, Error>;
}
```

### External API Interface

For external system communication:

```typescript
interface IExternalAPI<TExternalModel, TResult> {
  execute(operation: string, model: TExternalModel): Promise<TResult>;
  fetch(identifier: string): Promise<TExternalModel>;
  healthCheck(): Promise<boolean>;
}
```

## 🚀 Quick Start

### Basic ACL Adapter Setup

```typescript
import { SimpleACLAdapter, BaseModelTranslator } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

// Domain model
interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

// External API model
interface ExternalUser {
  user_id: string;
  full_name: string;
  email_address: string;
  status: 'active' | 'inactive';
}

// Model translator
class UserTranslator extends BaseModelTranslator<User, ExternalUser> {
  toExternal(user: User): ExternalUser {
    return {
      user_id: user.id,
      full_name: user.name,
      email_address: user.email,
      status: user.isActive ? 'active' : 'inactive',
    };
  }

  fromExternal(externalUser: ExternalUser): User {
    return {
      id: externalUser.user_id,
      name: externalUser.full_name,
      email: externalUser.email_address,
      isActive: externalUser.status === 'active',
    };
  }
}

// External API implementation
class UserAPI implements IExternalAPI<ExternalUser, any> {
  async execute(operation: string, model: ExternalUser): Promise<any> {
    switch (operation) {
      case 'create':
        return await this.createUser(model);
      case 'update':
        return await this.updateUser(model);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  async fetch(identifier: string): Promise<ExternalUser> {
    const response = await fetch(`/api/users/${identifier}`);
    return await response.json();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  private async createUser(user: ExternalUser): Promise<{ id: string }> {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return await response.json();
  }

  private async updateUser(user: ExternalUser): Promise<{ updated: boolean }> {
    const response = await fetch(`/api/users/${user.user_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return await response.json();
  }
}

// Create ACL adapter
const userAdapter = SimpleACLAdapter.create<User, ExternalUser>(
  'UserManagement',
  'ExternalUserAPI',
  new UserTranslator(),
  new UserAPI(),
  ['create', 'update', 'fetch']
);
```

### Using the ACL Adapter

```typescript
import { safeRun } from '@vytches/ddd-utils';

// Create user through ACL
const user: User = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  isActive: true,
};

const [error, result] = await safeRun(async () => {
  return await userAdapter.execute('create', user);
});

if (error) {
  console.error('Failed to create user:', error.message);
} else {
  console.log('User created successfully:', result);
}

// Fetch user through ACL
const [fetchError, fetchedUser] = await safeRun(async () => {
  return await userAdapter.fetch('123');
});

if (fetchError) {
  console.error('Failed to fetch user:', fetchError.message);
} else {
  console.log('User fetched:', fetchedUser);
}
```

## 🔧 ACL Adapters

### Base ACL Adapter

```typescript
import { BaseACLAdapter } from '@vytches/ddd-acl';

class CustomACLAdapter<TDomain, TExternal> extends BaseACLAdapter<
  TDomain,
  TExternal
> {
  constructor(
    contextInfo: ACLContextInfo,
    translator: IModelTranslator<TDomain, TExternal>,
    externalAPI: IExternalAPI<TExternal, any>
  ) {
    super(contextInfo, translator, externalAPI);
  }

  protected async performOperation(
    operation: string,
    externalModel: TExternal,
    options?: ExecuteOptions
  ): Promise<Result<any, ACLError>> {
    try {
      // Custom operation logic
      const result = await this.externalAPI.execute(operation, externalModel);
      return Result.ok(result);
    } catch (error) {
      return Result.fail(
        new ACLError(
          `Operation failed: ${error.message}`,
          this.contextInfo.contextName,
          operation
        )
      );
    }
  }
}
```

### Enhanced ACL Adapter

```typescript
import { EnhancedACLAdapter } from '@vytches/ddd-acl';

// Create enhanced adapter with middleware support
const enhancedAdapter = EnhancedACLAdapter.create<User, ExternalUser>(
  'UserManagement',
  'ExternalUserAPI',
  new UserTranslator(),
  new UserAPI(),
  ['create', 'update', 'delete']
);

// Add middleware
enhancedAdapter
  .use(loggingMiddleware)
  .use(retryMiddleware)
  .use(validationMiddleware);

// Use typed operations
const createUserOperation = new TypedOperation<User, { id: string }>({
  name: 'create',
  validateBusinessRules: (user: User) => {
    if (!user.email.includes('@')) {
      return Result.fail(new Error('Invalid email format'));
    }
    return Result.ok();
  },
});

const [error, result] = await safeRun(async () => {
  return await enhancedAdapter.executeTyped(createUserOperation, user);
});
```

## 🔄 Model Translation

### Basic Translation

```typescript
import { BaseModelTranslator } from '@vytches/ddd-acl';

class OrderTranslator extends BaseModelTranslator<Order, ExternalOrder> {
  toExternal(order: Order): ExternalOrder {
    return {
      order_id: order.id,
      customer_id: order.customerId,
      items: order.items.map(item => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      total_amount: order.totalAmount,
      status: order.status.toLowerCase(),
      created_at: order.createdAt.toISOString(),
    };
  }

  fromExternal(externalOrder: ExternalOrder): Order {
    return Order.create({
      id: externalOrder.order_id,
      customerId: externalOrder.customer_id,
      items: externalOrder.items.map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
      totalAmount: externalOrder.total_amount,
      status: externalOrder.status.toUpperCase() as OrderStatus,
      createdAt: new Date(externalOrder.created_at),
    });
  }
}
```

### Translation with Validation

```typescript
import { BaseModelTranslator } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class ValidatedOrderTranslator extends BaseModelTranslator<
  Order,
  ExternalOrder
> {
  toExternal(order: Order): ExternalOrder {
    // Translation logic here
    return externalOrder;
  }

  fromExternal(externalOrder: ExternalOrder): Order {
    // Translation logic here
    return order;
  }

  validateDomain(order: Order): Result<void, Error> {
    if (!order.id) {
      return Result.fail(new Error('Order ID is required'));
    }

    if (order.items.length === 0) {
      return Result.fail(new Error('Order must have at least one item'));
    }

    if (order.totalAmount <= 0) {
      return Result.fail(new Error('Order total must be positive'));
    }

    return Result.ok();
  }

  validateExternal(externalOrder: ExternalOrder): Result<void, Error> {
    if (!externalOrder.order_id) {
      return Result.fail(new Error('External order ID is required'));
    }

    if (!externalOrder.items || externalOrder.items.length === 0) {
      return Result.fail(new Error('External order must have items'));
    }

    return Result.ok();
  }
}
```

## 🎛️ Middleware System

### Basic Middleware

```typescript
import { BaseACLMiddleware } from '@vytches/ddd-acl';

class LoggingMiddleware extends BaseACLMiddleware {
  async execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    const startTime = Date.now();

    console.log(`[ACL] Starting operation: ${operation}`, {
      correlationId: options.correlationId,
      metadata: options.metadata,
    });

    const result = await next();

    const duration = Date.now() - startTime;

    if (result.isSuccess) {
      console.log(`[ACL] Operation completed: ${operation}`, {
        duration,
        correlationId: options.correlationId,
      });
    } else {
      console.error(`[ACL] Operation failed: ${operation}`, {
        duration,
        error: result.error.message,
        correlationId: options.correlationId,
      });
    }

    return result;
  }
}
```

### Retry Middleware

```typescript
import { BaseACLMiddleware } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class RetryMiddleware extends BaseACLMiddleware {
  constructor(
    private maxRetries: number = 3,
    private baseDelay: number = 1000
  ) {
    super();
  }

  async execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    let lastError: ACLError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await next();

      if (result.isSuccess) {
        return result;
      }

      lastError = result.error;

      // Don't retry on the last attempt
      if (attempt < this.maxRetries) {
        // Check if error is retryable
        if (this.isRetryableError(result.error)) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
          continue;
        } else {
          break;
        }
      }
    }

    return Result.fail(lastError!);
  }

  private isRetryableError(error: ACLError): boolean {
    return (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('503') ||
      error.message.includes('502')
    );
  }

  private calculateDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Validation Middleware

```typescript
import { BaseACLMiddleware } from '@vytches/ddd-acl';
import { Result } from '@vytches/ddd-utils';

class ValidationMiddleware extends BaseACLMiddleware {
  async execute<T>(
    operation: string,
    domainModel: any,
    options: ExecuteOptions,
    next: () => Promise<Result<T, ACLError>>
  ): Promise<Result<T, ACLError>> {
    // Pre-execution validation
    const validationResult = await this.validateRequest(
      operation,
      domainModel,
      options
    );

    if (validationResult.isFailure) {
      return Result.fail(
        new ACLError(
          `Validation failed: ${validationResult.error.message}`,
          'ValidationMiddleware',
          operation
        )
      );
    }

    const result = await next();

    // Post-execution validation
    if (result.isSuccess) {
      const responseValidation = await this.validateResponse(
        operation,
        result.value
      );

      if (responseValidation.isFailure) {
        return Result.fail(
          new ACLError(
            `Response validation failed: ${responseValidation.error.message}`,
            'ValidationMiddleware',
            operation
          )
        );
      }
    }

    return result;
  }

  private async validateRequest(
    operation: string,
    domainModel: any,
    options: ExecuteOptions
  ): Promise<Result<void, Error>> {
    // Implement request validation logic
    if (!domainModel) {
      return Result.fail(new Error('Domain model is required'));
    }

    if (!operation) {
      return Result.fail(new Error('Operation is required'));
    }

    return Result.ok();
  }

  private async validateResponse(
    operation: string,
    response: any
  ): Promise<Result<void, Error>> {
    // Implement response validation logic
    if (response === null || response === undefined) {
      return Result.fail(new Error('Response cannot be null or undefined'));
    }

    return Result.ok();
  }
}
```

## 📚 Registry Management

### Basic Registry Usage

```typescript
import { ACLRegistry } from '@vytches/ddd-acl';

const registry = new ACLRegistry();

// Register adapters
registry.register('UserManagement', 'ExternalUserAPI', userAdapter);
registry.register('OrderManagement', 'ExternalOrderAPI', orderAdapter);

// Resolve adapters
const userACL = registry.resolve<User, ExternalUser>(
  'UserManagement',
  'ExternalUserAPI'
);
const orderACL = registry.resolve<Order, ExternalOrder>(
  'OrderManagement',
  'ExternalOrderAPI'
);

// Use resolved adapter
const [error, result] = await safeRun(async () => {
  return await userACL.execute('create', user);
});
```

### Context-Specific Registry

```typescript
import { ContextACLRegistry } from '@vytches/ddd-acl';

const contextRegistry = new ContextACLRegistry();

// Register adapters for specific contexts
contextRegistry.registerForContext(
  'UserManagement',
  'production',
  userProdAdapter
);
contextRegistry.registerForContext(
  'UserManagement',
  'staging',
  userStagingAdapter
);
contextRegistry.registerForContext(
  'UserManagement',
  'development',
  userDevAdapter
);

// Resolve adapter for specific context
const currentEnv = process.env.NODE_ENV || 'development';
const userACL = contextRegistry.resolveForContext<User, ExternalUser>(
  'UserManagement',
  currentEnv
);
```

### Versioned Registry

```typescript
import { VersionedACLRegistry } from '@vytches/ddd-acl';

const versionedRegistry = new VersionedACLRegistry();

// Register different versions
versionedRegistry.registerVersion('UserAPI', 'v1', userAdapterV1);
versionedRegistry.registerVersion('UserAPI', 'v2', userAdapterV2);

// Resolve specific version
const userACLV1 = versionedRegistry.resolveVersion<User, ExternalUser>(
  'UserAPI',
  'v1'
);
const userACLV2 = versionedRegistry.resolveVersion<User, ExternalUser>(
  'UserAPI',
  'v2'
);

// Use with version option
const [error, result] = await safeRun(async () => {
  return await userACLV2.execute('create', user, { version: 'v2' });
});
```

## 🎯 Typed Operations

### Basic Typed Operations

```typescript
import { TypedOperation } from '@vytches/ddd-acl';

// Define typed operation
const createUserOperation = new TypedOperation<
  User,
  { id: string; status: string }
>({
  name: 'create',
  description: 'Create a new user in the external system',
  validateBusinessRules: (user: User) => {
    if (!user.email || !user.email.includes('@')) {
      return Result.fail(new Error('Valid email is required'));
    }

    if (!user.name || user.name.length < 2) {
      return Result.fail(new Error('Name must be at least 2 characters'));
    }

    return Result.ok();
  },
});

// Use typed operation
const [error, result] = await safeRun(async () => {
  return await enhancedAdapter.executeTyped(createUserOperation, user);
});

if (result) {
  console.log('User created with ID:', result.id);
  console.log('Status:', result.status);
}
```

### Complex Typed Operations

```typescript
// Define complex operation with validation
const processOrderOperation = new TypedOperation<Order, OrderProcessingResult>({
  name: 'processOrder',
  description: 'Process order with payment and inventory validation',
  validateBusinessRules: (order: Order) => {
    // Validate order structure
    if (!order.customerId) {
      return Result.fail(new Error('Customer ID is required'));
    }

    if (order.items.length === 0) {
      return Result.fail(new Error('Order must have at least one item'));
    }

    // Validate business rules
    if (order.totalAmount > 10000 && !order.isApproved) {
      return Result.fail(new Error('Large orders require approval'));
    }

    // Validate inventory
    for (const item of order.items) {
      if (item.quantity <= 0) {
        return Result.fail(new Error('Item quantity must be positive'));
      }
    }

    return Result.ok();
  },
});

// Use complex operation
const [error, processingResult] = await safeRun(async () => {
  return await orderAdapter.executeTyped(processOrderOperation, order);
});

if (processingResult) {
  console.log('Order processed:', processingResult.orderId);
  console.log('Payment status:', processingResult.paymentStatus);
  console.log('Inventory updated:', processingResult.inventoryUpdated);
}
```

## ⚠️ Error Handling

### ACL Error Types

```typescript
import {
  ACLError,
  TranslationError,
  AdapterNotFoundError,
} from '@vytches/ddd-acl';

// Handle specific error types
const [error, result] = await safeRun(async () => {
  return await userAdapter.execute('create', user);
});

if (error) {
  if (error instanceof TranslationError) {
    console.error('Translation failed:', error.message);
    console.error('Field:', error.field);
    console.error('Context:', error.context);
  } else if (error instanceof AdapterNotFoundError) {
    console.error('Adapter not found:', error.message);
    console.error('Context:', error.context);
    console.error('External System:', error.externalSystem);
  } else if (error instanceof ACLError) {
    console.error('ACL operation failed:', error.message);
    console.error('Context:', error.context);
    console.error('Operation:', error.operation);
  }
}
```

### Custom Error Handling

```typescript
class CustomACLError extends ACLError {
  constructor(
    message: string,
    context: string,
    operation: string,
    public readonly errorCode: string,
    public readonly retryable: boolean = false
  ) {
    super(message, context, operation);
    this.name = 'CustomACLError';
  }
}

// Use custom error in adapter
class CustomUserAdapter extends BaseACLAdapter<User, ExternalUser> {
  protected async performOperation(
    operation: string,
    externalModel: ExternalUser,
    options?: ExecuteOptions
  ): Promise<Result<any, ACLError>> {
    try {
      const result = await this.externalAPI.execute(operation, externalModel);
      return Result.ok(result);
    } catch (error) {
      const isRetryable = error.status >= 500 && error.status < 600;

      return Result.fail(
        new CustomACLError(
          error.message,
          this.contextInfo.contextName,
          operation,
          error.code || 'UNKNOWN_ERROR',
          isRetryable
        )
      );
    }
  }
}
```

## 🏢 Application Services

### Basic Application Service

```typescript
import { BaseApplicationService } from '@vytches/ddd-acl';

class UserApplicationService extends BaseApplicationService {
  constructor(
    private userRepository: IUserRepository,
    private userACL: IACLAdapter<User, ExternalUser>
  ) {
    super();
  }

  async createUser(userData: CreateUserData): Promise<Result<User, Error>> {
    return await this.executeWithTransaction(async () => {
      // Create domain user
      const user = User.create(userData);

      // Save to repository
      const savedUser = await this.userRepository.save(user);

      // Sync with external system
      const [syncError] = await safeRun(async () => {
        return await this.userACL.execute('create', savedUser);
      });

      if (syncError) {
        throw new Error(`Failed to sync user: ${syncError.message}`);
      }

      return savedUser;
    });
  }

  async updateUser(
    userId: string,
    updates: UpdateUserData
  ): Promise<Result<User, Error>> {
    return await this.executeWithTransaction(async () => {
      // Get existing user
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Apply updates
      const updatedUser = existingUser.update(updates);

      // Save to repository
      const savedUser = await this.userRepository.save(updatedUser);

      // Sync with external system
      const [syncError] = await safeRun(async () => {
        return await this.userACL.execute('update', savedUser);
      });

      if (syncError) {
        throw new Error(`Failed to sync user updates: ${syncError.message}`);
      }

      return savedUser;
    });
  }
}
```

### Complex Application Service

```typescript
class OrderApplicationService extends BaseApplicationService {
  constructor(
    private orderRepository: IOrderRepository,
    private paymentACL: IACLAdapter<Payment, ExternalPayment>,
    private inventoryACL: IACLAdapter<InventoryItem, ExternalInventoryItem>,
    private notificationACL: IACLAdapter<Notification, ExternalNotification>
  ) {
    super();
  }

  async processOrder(
    orderData: ProcessOrderData
  ): Promise<Result<OrderProcessingResult, Error>> {
    return await this.executeWithTransaction(async () => {
      // Create order
      const order = Order.create(orderData);

      // Reserve inventory
      const [inventoryError, inventoryResult] = await safeRun(async () => {
        return await this.inventoryACL.execute('reserve', {
          items: order.items,
          orderId: order.id,
        });
      });

      if (inventoryError) {
        throw new Error(
          `Inventory reservation failed: ${inventoryError.message}`
        );
      }

      // Process payment
      const [paymentError, paymentResult] = await safeRun(async () => {
        return await this.paymentACL.execute('process', {
          amount: order.totalAmount,
          customerId: order.customerId,
          orderId: order.id,
        });
      });

      if (paymentError) {
        // Rollback inventory reservation
        await this.inventoryACL.execute('release', {
          items: order.items,
          orderId: order.id,
        });

        throw new Error(`Payment processing failed: ${paymentError.message}`);
      }

      // Update order status
      order.markAsPaid();

      // Save order
      const savedOrder = await this.orderRepository.save(order);

      // Send notification
      const [notificationError] = await safeRun(async () => {
        return await this.notificationACL.execute('send', {
          customerId: order.customerId,
          type: 'order_confirmed',
          orderId: order.id,
        });
      });

      if (notificationError) {
        // Log but don't fail the order
        console.warn(
          `Failed to send notification: ${notificationError.message}`
        );
      }

      return {
        orderId: savedOrder.id,
        paymentStatus: paymentResult.status,
        inventoryReserved: inventoryResult.reserved,
        notificationSent: !notificationError,
      };
    });
  }
}
```

## 🔗 Integration Patterns

### Repository Integration

```typescript
class UserRepositoryWithACL implements IUserRepository {
  constructor(
    private baseRepository: IUserRepository,
    private userACL: IACLAdapter<User, ExternalUser>
  ) {}

  async save(user: User): Promise<User> {
    // Save to local repository
    const savedUser = await this.baseRepository.save(user);

    // Sync with external system
    const [syncError] = await safeRun(async () => {
      return await this.userACL.execute('sync', savedUser);
    });

    if (syncError) {
      console.warn(
        `Failed to sync user to external system: ${syncError.message}`
      );
    }

    return savedUser;
  }

  async findById(id: string): Promise<User | null> {
    // Try local repository first
    let user = await this.baseRepository.findById(id);

    if (!user) {
      // Try external system
      const [fetchError, externalUser] = await safeRun(async () => {
        return await this.userACL.fetch(id);
      });

      if (!fetchError && externalUser) {
        // Save to local repository for future use
        user = await this.baseRepository.save(externalUser);
      }
    }

    return user;
  }
}
```

### Event-Driven Integration

```typescript
import { DomainEventHandler } from '@vytches/ddd-events';

@DomainEventHandler(UserCreatedEvent)
class UserCreatedEventHandler {
  constructor(private userACL: IACLAdapter<User, ExternalUser>) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    const [error] = await safeRun(async () => {
      return await this.userACL.execute('create', event.user);
    });

    if (error) {
      console.error(
        `Failed to sync user creation to external system: ${error.message}`
      );
      // Could emit a failure event or trigger retry logic
    }
  }
}

@DomainEventHandler(UserUpdatedEvent)
class UserUpdatedEventHandler {
  constructor(private userACL: IACLAdapter<User, ExternalUser>) {}

  async handle(event: UserUpdatedEvent): Promise<void> {
    const [error] = await safeRun(async () => {
      return await this.userACL.execute('update', event.user);
    });

    if (error) {
      console.error(
        `Failed to sync user update to external system: ${error.message}`
      );
    }
  }
}
```

### CQRS Integration

```typescript
import { CommandHandler, QueryHandler } from '@vytches/ddd-cqrs';

@CommandHandler(CreateUserCommand)
class CreateUserCommandHandler {
  constructor(
    private userRepository: IUserRepository,
    private userACL: IACLAdapter<User, ExternalUser>
  ) {}

  async handle(command: CreateUserCommand): Promise<Result<string, Error>> {
    const [error, result] = await safeRun(async () => {
      // Create user in domain
      const user = User.create(command.userData);

      // Save to repository
      const savedUser = await this.userRepository.save(user);

      // Sync with external system
      const [syncError] = await safeRun(async () => {
        return await this.userACL.execute('create', savedUser);
      });

      if (syncError) {
        throw new Error(`External system sync failed: ${syncError.message}`);
      }

      return savedUser.id;
    });

    if (error) {
      return Result.fail(error);
    }

    return Result.ok(result);
  }
}

@QueryHandler(GetUserQuery)
class GetUserQueryHandler {
  constructor(
    private userRepository: IUserRepository,
    private userACL: IACLAdapter<User, ExternalUser>
  ) {}

  async handle(query: GetUserQuery): Promise<Result<User, Error>> {
    const [error, user] = await safeRun(async () => {
      // Try local repository first
      let user = await this.userRepository.findById(query.userId);

      if (!user) {
        // Try external system
        const [fetchError, externalUser] = await safeRun(async () => {
          return await this.userACL.fetch(query.userId);
        });

        if (!fetchError && externalUser) {
          user = externalUser;
        }
      }

      return user;
    });

    if (error) {
      return Result.fail(error);
    }

    if (!user) {
      return Result.fail(new Error('User not found'));
    }

    return Result.ok(user);
  }
}
```

## 🧪 Testing

### Unit Testing ACL Adapters

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-testing';

describe('UserACLAdapter', () => {
  let adapter: SimpleACLAdapter<User, ExternalUser>;
  let mockAPI: jest.Mocked<IExternalAPI<ExternalUser, any>>;
  let translator: UserTranslator;

  beforeEach(() => {
    mockAPI = {
      execute: jest.fn(),
      fetch: jest.fn(),
      healthCheck: jest.fn(),
    };

    translator = new UserTranslator();

    adapter = SimpleACLAdapter.create(
      'TestContext',
      'TestAPI',
      translator,
      mockAPI,
      ['create', 'update']
    );
  });

  describe('execute', () => {
    it('should execute create operation successfully', async () => {
      const user: User = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
      };

      mockAPI.execute.mockResolvedValue({ id: '123', status: 'created' });

      const [error, result] = await safeRun(async () => {
        return await adapter.execute('create', user);
      });

      expect(error).toBeUndefined();
      expect(result).toEqual({ id: '123', status: 'created' });
      expect(mockAPI.execute).toHaveBeenCalledWith('create', {
        user_id: '123',
        full_name: 'John Doe',
        email_address: 'john@example.com',
        status: 'active',
      });
    });

    it('should handle unsupported operations', async () => {
      const user: User = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
      };

      const [error] = await safeRun(async () => {
        return await adapter.execute('unsupported', user);
      });

      expect(error).toBeInstanceOf(ACLError);
      expect(error?.message).toContain('Operation not supported');
    });
  });

  describe('fetch', () => {
    it('should fetch user successfully', async () => {
      const externalUser: ExternalUser = {
        user_id: '123',
        full_name: 'John Doe',
        email_address: 'john@example.com',
        status: 'active',
      };

      mockAPI.fetch.mockResolvedValue(externalUser);

      const [error, user] = await safeRun(async () => {
        return await adapter.fetch('123');
      });

      expect(error).toBeUndefined();
      expect(user).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
      });
    });

    it('should handle fetch errors', async () => {
      mockAPI.fetch.mockRejectedValue(new Error('User not found'));

      const [error] = await safeRun(async () => {
        return await adapter.fetch('nonexistent');
      });

      expect(error).toBeInstanceOf(ACLError);
      expect(error?.message).toContain('User not found');
    });
  });
});
```

### Integration Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleTestHarness } from '@vytches/ddd-testing';

describe('User Integration with External System', () => {
  let harness: SimpleTestHarness;
  let userService: UserApplicationService;
  let userACL: IACLAdapter<User, ExternalUser>;

  beforeEach(async () => {
    harness = new SimpleTestHarness({
      autoCleanup: true,
      setupFn: async () => {
        // Setup test database
        await setupTestDatabase();

        // Setup external API mock
        const mockAPI = new MockExternalUserAPI();
        userACL = SimpleACLAdapter.create(
          'TestContext',
          'TestAPI',
          new UserTranslator(),
          mockAPI,
          ['create', 'update']
        );

        // Setup application service
        userService = new UserApplicationService(
          new TestUserRepository(),
          userACL
        );
      },
    });

    await harness.initialize();
    await harness.setup();
  });

  it('should create user and sync with external system', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      isActive: true,
    };

    const [error, result] = await harness.safeExecute(async () => {
      return await userService.createUser(userData);
    });

    expect(error).toBeUndefined();
    expect(result).toBeDefined();
    expect(result?.name).toBe('John Doe');

    // Verify external system was called
    const externalUser = await mockAPI.getCreatedUser(result!.id);
    expect(externalUser).toBeDefined();
    expect(externalUser?.full_name).toBe('John Doe');
  });

  it('should handle external system failures gracefully', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      isActive: true,
    };

    // Configure external API to fail
    mockAPI.configureFail(true);

    const [error] = await harness.safeExecute(async () => {
      return await userService.createUser(userData);
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('Failed to sync user');
  });
});
```

## 🎯 Best Practices

### ACL Design Principles

1. **Domain Model Protection**: Always protect your domain model from external
   changes
2. **Translation Layer**: Use dedicated translators for all external
   integrations
3. **Error Isolation**: Isolate external system errors from domain logic
4. **Middleware Usage**: Use middleware for cross-cutting concerns
5. **Type Safety**: Leverage TypeScript for compile-time safety

### Translation Best Practices

1. **Bidirectional Translation**: Always implement both directions
2. **Validation**: Validate both domain and external models
3. **Immutability**: Keep translations pure and side-effect free
4. **Error Handling**: Provide clear error messages for translation failures
5. **Performance**: Optimize for common translation scenarios

### Error Handling Guidelines

1. **Specific Error Types**: Use specific error types for different scenarios
2. **Retry Logic**: Implement retry logic for transient failures
3. **Fallback Strategies**: Provide fallback mechanisms where possible
4. **Logging**: Log all external system interactions
5. **Monitoring**: Monitor external system health and performance

### Testing Strategies

1. **Unit Testing**: Test adapters and translations in isolation
2. **Integration Testing**: Test complete workflows with external systems
3. **Mock External APIs**: Use mocks for reliable testing
4. **Error Scenarios**: Test all error scenarios and edge cases
5. **Performance Testing**: Test performance under load

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

# Run tests
pnpm test

# Build package
pnpm build

# Run ACL-specific tests
pnpm test:packages:acl
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
