# @vytches/ddd-logging

<!-- LLM-METADATA
Package: @vytches/ddd-logging
Category: Infrastructure
Purpose: Enterprise logging with DDD-first design, smart context detection, structured logging, and seamless ecosystem integration
Dependencies: @vytches/ddd-contracts
Complexity: Medium
DDD Patterns: Logging Infrastructure, Context Detection, Cross-cutting Concerns
Integration Points: All packages use logging for observability; special integration with CQRS, events, and resilience packages
-->

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-logging.svg)](https://badge.fury.io/js/%40vytches%2Fddd-logging)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise logging with DDD-first design for Domain-Driven Design
> applications**

Domain-Driven Design logging infrastructure with smart context detection,
structured logging, data masking, and seamless integration with the VytchesDDD
ecosystem. Built specifically for DDD patterns with automatic bounded context
detection and comprehensive observability features.

## 📋 Table of Contents

- [Installation](#installation)
- [Key Features](#key-features)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Smart Context Detection](#smart-context-detection)
- [Structured Logging](#structured-logging)
- [Data Masking](#data-masking)
- [CQRS Integration](#cqrs-integration)
- [Result Pattern Integration](#result-pattern-integration)
- [Custom Providers](#custom-providers)
- [Configuration](#configuration)
- [Advanced Usage](#advanced-usage)
- [Integration Patterns](#integration-patterns)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## 🚀 Installation

```bash
# npm
npm install @vytches/ddd-logging

# yarn
yarn add @vytches/ddd-logging

# pnpm
pnpm add @vytches/ddd-logging
```

### Dependencies

```bash
# Required peer dependency
npm install @vytches/ddd-contracts
```

## ✨ Key Features

### DDD-First Design

- **Bounded Context Detection**: Automatically detects and logs bounded contexts
- **Domain Event Logging**: Specialized logging for domain and integration
  events
- **Aggregate State Logging**: Track aggregate state changes with
  `@LogStateChanges`
- **Command/Query Logging**: Built-in CQRS decorators for operations logging

### Smart Context Detection

- **Automatic Class Detection**: Detects class names from stack traces
- **Method Name Detection**: Identifies method names and operation contexts
- **Namespace Resolution**: Resolves module and package contexts
- **Stack Trace Analysis**: Optional stack trace inclusion for debugging

### Structured Logging

- **JSON-based Logging**: Structured logging with rich metadata support
- **Correlation Tracking**: Built-in correlation ID, user ID, tenant ID tracking
- **Event Metadata**: Comprehensive event metadata with timestamps and IDs
- **Hierarchical Contexts**: Parent-child logger relationships

### Data Masking

- **PII Protection**: Automatic masking of sensitive personal information
- **Pattern-based Masking**: Customizable regex patterns for data masking
- **Key-based Masking**: Sensitive key detection and replacement
- **Configurable Replacement**: Custom replacement strings and strategies

### Zero Configuration

- **Sensible Defaults**: Works out of the box with minimal configuration
- **Auto-Detection**: Automatically detects optimal logging strategies
- **Progressive Enhancement**: Add configuration as needed
- **Framework Agnostic**: Works with any Node.js framework

## 🎯 Core Concepts

### Logger Interface

The core logger interface provides structured logging capabilities:

```typescript
interface Logger {
  readonly context: LogContext;
  readonly level: LogLevel;

  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void;

  log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void;
  isLevelEnabled(level: LogLevel): boolean;

  child(contextName: string): Logger;
  withContext(context: Partial<LogContext>): Logger;
  withCorrelationId(correlationId: string): Logger;
  withUserId(userId: string): Logger;
  withTenantId(tenantId: string): Logger;
}
```

### Log Context

Rich context information included with every log entry:

```typescript
interface LogContext {
  name: string;
  boundedContext?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}
```

### Log Event

Structured log event with comprehensive metadata:

```typescript
interface LogEvent {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: Error;
  tags?: string[];
}
```

### Log Provider

Pluggable provider interface for custom logging backends:

```typescript
interface LogProvider {
  readonly name: string;
  write(event: LogEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { Logger } from '@vytches/ddd-logging';

// Zero configuration - automatically detects context
const logger = Logger.create();
logger.info('Application started');

// Explicit context
const userLogger = Logger.forContext('UserService');
userLogger.info('User operation completed', { userId: '123' });

// With correlation tracking
const correlatedLogger = Logger.forContext('OrderService')
  .withCorrelationId('req-123')
  .withUserId('user-456');

correlatedLogger.info('Processing order', { orderId: 'order-789' });
```

### Service Integration

```typescript
import { Logger } from '@vytches/ddd-logging';

class UserService {
  private logger = Logger.forContext(); // Auto-detects "UserService"

  async createUser(userData: CreateUserData): Promise<User> {
    this.logger.info('Creating user', {
      operation: 'createUser',
      email: userData.email, // Automatically masked
    });

    try {
      const user = await this.userRepository.save(User.create(userData));

      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error as Error, {
        email: userData.email,
      });
      throw error;
    }
  }
}
```

### Domain Event Logging

```typescript
import { Logger } from '@vytches/ddd-logging';
import { DomainEvent } from '@vytches/ddd-domain-primitives';

class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly amount: number
  ) {
    super('OrderCreated');
  }
}

class OrderAggregate {
  private logger = Logger.forContext('OrderAggregate');

  create(orderData: CreateOrderData): void {
    this.logger.info('Creating order', {
      customerId: orderData.customerId,
      amount: orderData.amount,
    });

    // Domain logic...

    const event = new OrderCreatedEvent(
      this.id,
      orderData.customerId,
      orderData.amount
    );
    this.addDomainEvent(event);

    this.logger.info('Order created', {
      orderId: this.id,
      event: event.eventType,
    });
  }
}
```

## 🔍 Smart Context Detection

### Automatic Context Detection

```typescript
import { Logger } from '@vytches/ddd-logging';

// Automatically detects class name from stack trace
class PaymentService {
  private logger = Logger.forContext(); // Detects "PaymentService"

  async processPayment(paymentData: PaymentData): Promise<Payment> {
    // Logs: [PaymentService] Processing payment { paymentId: "pay_123" }
    this.logger.info('Processing payment', { paymentId: paymentData.id });

    // Method-specific context
    return await this.executePayment(paymentData);
  }

  private async executePayment(paymentData: PaymentData): Promise<Payment> {
    // Logs: [PaymentService.executePayment] Executing payment processing
    this.logger.debug('Executing payment processing', {
      amount: paymentData.amount,
      currency: paymentData.currency,
    });

    // Implementation...
  }
}
```

### Bounded Context Detection

```typescript
import { Logger } from '@vytches/ddd-logging';

// Bounded context detection from namespace/module structure
namespace OrderManagement {
  export class OrderService {
    private logger = Logger.forContext(); // Detects "OrderManagement.OrderService"

    async createOrder(orderData: CreateOrderData): Promise<Order> {
      // Logs: [OrderManagement] [OrderService] Creating order
      this.logger.info('Creating order', { customerId: orderData.customerId });

      // Implementation...
    }
  }
}

// Manual bounded context specification
class InventoryService {
  private logger = Logger.forContext('InventoryService').withContext({
    boundedContext: 'InventoryManagement',
  });

  async reserveItems(items: ReservationItem[]): Promise<void> {
    // Logs: [InventoryManagement] [InventoryService] Reserving items
    this.logger.info('Reserving items', {
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }
}
```

### Context Hierarchy

```typescript
import { Logger } from '@vytches/ddd-logging';

class OrderProcessingService {
  private logger = Logger.forContext('OrderProcessingService');

  async processOrder(order: Order): Promise<void> {
    // Parent logger context
    this.logger.info('Starting order processing', { orderId: order.id });

    // Child logger for payment processing
    const paymentLogger = this.logger.child('PaymentProcessing');
    paymentLogger.info('Processing payment', { amount: order.total });

    // Child logger for inventory
    const inventoryLogger = this.logger.child('InventoryReservation');
    inventoryLogger.info('Reserving inventory', {
      itemCount: order.items.length,
    });

    // Child logger for shipping
    const shippingLogger = this.logger.child('ShippingArrangement');
    shippingLogger.info('Arranging shipping', {
      address: order.shippingAddress,
    });
  }
}
```

## 📊 Structured Logging

### Rich Metadata Support

```typescript
import { Logger } from '@vytches/ddd-logging';

class UserRegistrationService {
  private logger = Logger.forContext('UserRegistrationService');

  async registerUser(userData: UserRegistrationData): Promise<User> {
    // Structured logging with rich metadata
    this.logger.info('User registration initiated', {
      operation: 'registerUser',
      correlationId: userData.correlationId,
      userAgent: userData.userAgent,
      ipAddress: userData.ipAddress,
      registrationSource: userData.source,
      timestamp: new Date().toISOString(),
      metadata: {
        referrer: userData.referrer,
        campaign: userData.campaign,
        version: '1.0.0',
      },
    });

    try {
      // Validation phase
      this.logger.debug('Validating user data', {
        phase: 'validation',
        email: userData.email, // Will be masked
        hasPassword: !!userData.password,
        acceptedTerms: userData.acceptedTerms,
      });

      // Creation phase
      const user = await this.createUser(userData);

      // Success logging
      this.logger.info('User registration completed', {
        userId: user.id,
        email: user.email, // Will be masked
        createdAt: user.createdAt,
        isActive: user.isActive,
        duration: Date.now() - startTime,
      });

      return user;
    } catch (error) {
      // Error logging with context
      this.logger.error('User registration failed', error as Error, {
        email: userData.email, // Will be masked
        errorCode: (error as any).code,
        phase: 'creation',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

### JSON Output Format

```json
{
  "id": "log_01H9QYXR2D8VCVK9WJMX6F7G3B",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User registration completed",
  "context": {
    "name": "UserRegistrationService",
    "boundedContext": "UserManagement",
    "correlationId": "req-123",
    "userId": "user-456",
    "tenantId": "tenant-789",
    "requestId": "req-abc123",
    "sessionId": "session-xyz789"
  },
  "data": {
    "userId": "user_01H9QYXR2D8VCVK9WJMX6F7G3B",
    "email": "[MASKED]",
    "createdAt": "2024-01-15T10:30:45.120Z",
    "isActive": true,
    "duration": 1250
  },
  "tags": ["user-registration", "success"]
}
```

## 🔐 Data Masking

### Automatic PII Protection

```typescript
import { Logger } from '@vytches/ddd-logging';

// Global masking configuration
Logger.configure({
  masking: {
    enabled: true,
    patterns: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{10,15}\b/g, // Phone numbers
    ],
    sensitiveKeys: [
      'password',
      'passwd',
      'secret',
      'token',
      'key',
      'authorization',
      'email',
      'phone',
      'ssn',
      'creditCard',
      'personalId',
    ],
    replacement: '[MASKED]',
  },
});

class PaymentService {
  private logger = Logger.forContext('PaymentService');

  async processPayment(paymentData: PaymentData): Promise<Payment> {
    // Sensitive data is automatically masked
    this.logger.info('Processing payment', {
      customerId: paymentData.customerId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      creditCard: paymentData.creditCard, // Automatically masked
      email: paymentData.email, // Automatically masked
      billingAddress: {
        street: paymentData.billingAddress.street,
        city: paymentData.billingAddress.city,
        phone: paymentData.billingAddress.phone, // Automatically masked
      },
    });

    // Implementation...
  }
}
```

### Custom Masking Patterns

```typescript
import { Logger, DataMasker } from '@vytches/ddd-logging';

// Custom masking for domain-specific data
const customMasker = new DataMasker({
  patterns: [
    /\b[A-Z]{2}\d{2}[A-Z]{4}\d{10}\b/g, // IBAN
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, // Credit card with spaces
    /\b[A-Z]{2}\d{8}[A-Z]{2}\d{8}\b/g, // Custom ID format
  ],
  sensitiveKeys: [
    'iban',
    'accountNumber',
    'routingNumber',
    'swift',
    'customerId',
    'internalId',
    'referenceNumber',
  ],
  replacement: '[REDACTED]',
});

Logger.configure({
  masking: {
    enabled: true,
    customMasker: customMasker,
  },
});

class BankingService {
  private logger = Logger.forContext('BankingService');

  async transferFunds(transferData: TransferData): Promise<Transfer> {
    // Custom patterns are automatically applied
    this.logger.info('Initiating funds transfer', {
      fromAccount: transferData.fromAccount, // Masked with custom pattern
      toAccount: transferData.toAccount, // Masked with custom pattern
      amount: transferData.amount,
      currency: transferData.currency,
      iban: transferData.iban, // Masked with custom pattern
      swift: transferData.swift, // Masked with custom pattern
      reference: transferData.reference,
    });

    // Implementation...
  }
}
```

## 🎯 CQRS Integration

### Command Logging Decorator

```typescript
import { LogCommands } from '@vytches/ddd-logging';
import { CommandHandler } from '@vytches/ddd-cqrs';

@LogCommands({
  includePayload: true,
  logLevel: 'info',
  maskSensitiveData: true,
})
@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<Result<User, Error>> {
    // Automatic logging:
    // - Command execution start
    // - Command payload (masked)
    // - Execution duration
    // - Success/failure result

    const user = User.create(command.userData);
    const result = await this.userRepository.save(user);

    return result;
  }
}

// Log output:
// [INFO] [Command] Executing CreateUserCommand { handler: "CreateUserHandler", payload: { name: "John", email: "[MASKED]" } }
// [INFO] [Command] CreateUserCommand completed { handler: "CreateUserHandler", duration: "45.32ms", success: true }
```

### Query Logging Decorator

```typescript
import { LogQueries } from '@vytches/ddd-logging';
import { QueryHandler } from '@vytches/ddd-cqrs';

@LogQueries({
  includePayload: true,
  logLevel: 'debug',
  contextName: 'UserQueryHandler',
})
@QueryHandler(GetUserByIdQuery)
class GetUserByIdHandler {
  async execute(query: GetUserByIdQuery): Promise<Result<User | null, Error>> {
    // Automatic logging:
    // - Query execution start
    // - Query parameters
    // - Cache hit/miss information
    // - Result metadata

    const user = await this.userRepository.findById(query.userId);
    return Result.ok(user);
  }
}

// Log output:
// [DEBUG] [Query] Executing GetUserByIdQuery { handler: "GetUserByIdHandler", payload: { userId: "user_123" } }
// [DEBUG] [Query] GetUserByIdQuery completed { handler: "GetUserByIdHandler", duration: "12.45ms", success: true, resultType: "User" }
```

### Generic CQRS Logging

```typescript
import { LogCQRS } from '@vytches/ddd-logging';
import { CommandHandler, QueryHandler } from '@vytches/ddd-cqrs';

@LogCQRS({
  includePayload: true,
  logLevel: 'info',
  maskSensitiveData: true,
})
class OrderCommandHandler {
  @CommandHandler(CreateOrderCommand)
  async createOrder(
    command: CreateOrderCommand
  ): Promise<Result<Order, Error>> {
    // Logs as [CQRS] operation
    return await this.orderService.createOrder(command.orderData);
  }

  @CommandHandler(CancelOrderCommand)
  async cancelOrder(command: CancelOrderCommand): Promise<Result<void, Error>> {
    // Logs as [CQRS] operation
    return await this.orderService.cancelOrder(command.orderId);
  }

  @QueryHandler(GetOrderQuery)
  async getOrder(query: GetOrderQuery): Promise<Result<Order | null, Error>> {
    // Logs as [CQRS] operation
    return await this.orderService.getOrderById(query.orderId);
  }
}
```

### Enhanced Logging Middleware

```typescript
import { EnhancedLoggingMiddleware } from '@vytches/ddd-logging';
import { CommandBus } from '@vytches/ddd-cqrs';

// Enhanced middleware with performance metrics
const loggingMiddleware = new EnhancedLoggingMiddleware({
  logLevel: 'info',
  includePayload: true,
  includeResult: false,
  maskSensitiveData: true,
  performanceThreshold: 1000, // Log warning if operation takes > 1s
  contextEnrichment: context => ({
    ...context,
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  }),
});

const commandBus = new CommandBus();
commandBus.use(loggingMiddleware);

// Usage
await commandBus.execute(new CreateUserCommand(userData));

// Log output includes:
// - Operation context and metadata
// - Performance metrics and warnings
// - Environment information
// - Custom context enrichment
```

## 🔄 Result Pattern Integration

### Result Logging Extensions

```typescript
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

class UserService {
  private logger = Logger.forContext('UserService');

  async createUser(userData: UserData): Promise<Result<User, Error>> {
    return await Result.tryAsync(async () => {
      const user = User.create(userData);
      return await this.userRepository.save(user);
    })
      .tapLog(this.logger, 'User creation completed', {
        includeValue: true,
        logLevel: 'info',
      })
      .tapLogError(this.logger, 'User creation failed', {
        includeError: true,
        logLevel: 'error',
      });
  }
}
```

### Result Middleware

```typescript
import { ResultLoggingMiddleware } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

class PaymentService {
  private logger = Logger.forContext('PaymentService');
  private resultMiddleware = new ResultLoggingMiddleware(this.logger);

  async processPayment(
    paymentData: PaymentData
  ): Promise<Result<Payment, Error>> {
    return this.resultMiddleware.wrap(() => this.executePayment(paymentData), {
      operationName: 'processPayment',
      successMessage: 'Payment processed successfully',
      errorMessage: 'Payment processing failed',
      includeMetadata: true,
    });
  }

  private async executePayment(paymentData: PaymentData): Promise<Payment> {
    // Implementation...
  }
}
```

## 🔌 Custom Providers

### Winston Integration

```typescript
import winston from 'winston';
import { LogProvider, LogEvent } from '@vytches/ddd-logging';

class WinstonProvider implements LogProvider {
  readonly name = 'winston';

  constructor(private winston: winston.Logger) {}

  write(event: LogEvent): void {
    const meta = {
      timestamp: event.timestamp,
      context: event.context,
      logId: event.id,
      ...(event.data && { data: event.data }),
      ...(event.error && {
        error: {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack,
        },
      }),
      ...(event.tags && { tags: event.tags }),
    };

    this.winston.log(event.level, event.message, meta);
  }

  async flush(): Promise<void> {
    // Winston handles flushing automatically
  }

  async close(): Promise<void> {
    this.winston.close();
  }
}

// Usage
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

Logger.configure({
  provider: new WinstonProvider(winstonLogger),
});
```

### Pino Integration

```typescript
import pino from 'pino';
import { LogProvider, LogEvent } from '@vytches/ddd-logging';

class PinoProvider implements LogProvider {
  readonly name = 'pino';

  constructor(private pino: pino.Logger) {}

  write(event: LogEvent): void {
    const obj = {
      logId: event.id,
      context: event.context,
      ...(event.data && { data: event.data }),
      ...(event.error && { err: event.error }),
      ...(event.tags && { tags: event.tags }),
    };

    this.pino[event.level](obj, event.message);
  }

  async flush(): Promise<void> {
    await this.pino.flush();
  }

  async close(): Promise<void> {
    // Pino doesn't have a close method
  }
}

// Usage
const pinoLogger = pino({
  level: 'info',
  formatters: {
    level: label => ({ level: label }),
    bindings: bindings => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'vytches-ddd',
    }),
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
});

Logger.configure({
  provider: new PinoProvider(pinoLogger),
});
```

### Elasticsearch Integration

```typescript
import { Client } from '@elastic/elasticsearch';
import { LogProvider, LogEvent } from '@vytches/ddd-logging';

class ElasticsearchProvider implements LogProvider {
  readonly name = 'elasticsearch';
  private buffer: LogEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private client: Client,
    private options: {
      index: string;
      batchSize?: number;
      flushInterval?: number;
    }
  ) {
    this.options.batchSize = options.batchSize || 100;
    this.options.flushInterval = options.flushInterval || 5000;
    this.setupAutoFlush();
  }

  write(event: LogEvent): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.options.batchSize!) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    const body = events.flatMap(event => [
      { index: { _index: this.options.index } },
      {
        '@timestamp': event.timestamp,
        level: event.level,
        message: event.message,
        context: event.context,
        data: event.data,
        error: event.error
          ? {
              name: event.error.name,
              message: event.error.message,
              stack: event.error.stack,
            }
          : undefined,
        tags: event.tags,
        logId: event.id,
      },
    ]);

    try {
      await this.client.bulk({ body });
    } catch (error) {
      console.error('Failed to write logs to Elasticsearch:', error);
      // Could implement retry logic here
    }
  }

  private setupAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
    await this.client.close();
  }
}

// Usage
const elasticsearchClient = new Client({
  node: 'http://localhost:9200',
  auth: {
    username: 'elastic',
    password: 'changeme',
  },
});

Logger.configure({
  provider: new ElasticsearchProvider(elasticsearchClient, {
    index: 'vytches-ddd-logs',
    batchSize: 50,
    flushInterval: 10000,
  }),
});
```

## ⚙️ Configuration

### Basic Configuration

```typescript
import { Logger, ConsoleProvider } from '@vytches/ddd-logging';

// Basic configuration
Logger.configure({
  level: 'info',
  provider: 'console',
});

// Advanced configuration
Logger.configure({
  level: 'debug',
  provider: new ConsoleProvider({
    colorize: true,
    prettyPrint: true,
  }),
  contextDetection: {
    enabled: true,
    includeStackTrace: false,
  },
  formatting: {
    timestamp: true,
    colorize: true,
    prettyPrint: true,
  },
  masking: {
    enabled: true,
    patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
    sensitiveKeys: ['password', 'secret', 'token'],
    replacement: '[MASKED]',
  },
});
```

### Environment-based Configuration

```typescript
import { Logger } from '@vytches/ddd-logging';

// Production configuration
if (process.env.NODE_ENV === 'production') {
  Logger.configure({
    level: 'info',
    provider: 'console',
    formatting: {
      timestamp: true,
      colorize: false,
      prettyPrint: false,
    },
    masking: {
      enabled: true,
      sensitiveKeys: [
        'password',
        'secret',
        'token',
        'key',
        'auth',
        'email',
        'phone',
        'ssn',
        'creditCard',
      ],
    },
  });
}

// Development configuration
if (process.env.NODE_ENV === 'development') {
  Logger.configure({
    level: 'debug',
    provider: 'console',
    formatting: {
      timestamp: true,
      colorize: true,
      prettyPrint: true,
    },
    contextDetection: {
      enabled: true,
      includeStackTrace: true,
    },
  });
}
```

### Context-specific Configuration

```typescript
import { Logger } from '@vytches/ddd-logging';

// Different configurations for different bounded contexts
const paymentLogger = Logger.forContext('PaymentService').withContext({
  boundedContext: 'PaymentProcessing',
  environment: 'production',
  version: '1.0.0',
});

const auditLogger = Logger.forContext('AuditService').withContext({
  boundedContext: 'Auditing',
  compliance: 'SOX',
  retention: '7years',
});

const debugLogger = Logger.forContext('DebuggingService').withContext({
  boundedContext: 'Development',
  debug: true,
  verboseStackTraces: true,
});
```

## 🔗 Integration Patterns

### Express.js Integration

```typescript
import express from 'express';
import { Logger } from '@vytches/ddd-logging';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  const requestId = uuidv4();

  // Create request-scoped logger
  const requestLogger = Logger.forContext('RequestHandler')
    .withCorrelationId(correlationId)
    .withContext({
      requestId,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

  // Add to response locals
  res.locals.logger = requestLogger;
  res.locals.correlationId = correlationId;
  res.locals.requestId = requestId;

  // Log request start
  requestLogger.info('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
    },
  });

  // Response logging
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    requestLogger.info('Request completed', {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    });
  });

  next();
});

// Route handlers
app.get('/users/:id', async (req, res) => {
  const logger = res.locals.logger.child('GetUserHandler');

  try {
    logger.info('Fetching user', { userId: req.params.id });

    const user = await userService.getUserById(req.params.id);

    logger.info('User fetched successfully', {
      userId: user.id,
      email: user.email, // Will be masked
    });

    res.json(user);
  } catch (error) {
    logger.error('Failed to fetch user', error as Error, {
      userId: req.params.id,
    });

    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### NestJS Integration

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@vytches/ddd-logging';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const logger = Logger.forContext(
      `${context.getClass().name}.${context.getHandler().name}`
    )
      .withCorrelationId(request.headers['x-correlation-id'])
      .withUserId(request.user?.id)
      .withContext({
        method: request.method,
        path: request.path,
        controller: context.getClass().name,
        handler: context.getHandler().name,
      });

    logger.info('Request received', {
      method: request.method,
      path: request.path,
      params: request.params,
      query: request.query,
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: result => {
          const duration = Date.now() - startTime;
          logger.info('Request completed successfully', {
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            resultType: result?.constructor?.name,
          });
        },
        error: error => {
          const duration = Date.now() - startTime;
          logger.error('Request failed', error, {
            statusCode: response.statusCode,
            duration: `${duration}ms`,
            errorType: error.constructor?.name,
          });
        },
      })
    );
  }
}

// Usage in controllers
@Injectable()
export class UserController {
  private logger = Logger.forContext('UserController');

  constructor(private userService: UserService) {}

  @Get(':id')
  async getUser(@Param('id') id: string): Promise<User> {
    this.logger.info('Getting user', { userId: id });

    const user = await this.userService.findById(id);

    this.logger.info('User retrieved', {
      userId: user.id,
      email: user.email, // Will be masked
    });

    return user;
  }
}
```

### Event-Driven Architecture Integration

```typescript
import { Logger } from '@vytches/ddd-logging';
import { DomainEvent, IntegrationEvent } from '@vytches/ddd-events';

class EventLoggingService {
  private logger = Logger.forContext('EventLoggingService');

  async logDomainEvent(event: DomainEvent): Promise<void> {
    this.logger.info('Domain event occurred', {
      eventType: event.eventType,
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      aggregateVersion: event.aggregateVersion,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
      causationId: event.causationId,
      eventData: event.eventData,
    });
  }

  async logIntegrationEvent(event: IntegrationEvent): Promise<void> {
    this.logger.info('Integration event published', {
      eventType: event.eventType,
      eventId: event.eventId,
      publishedAt: event.publishedAt,
      correlationId: event.correlationId,
      source: event.source,
      destination: event.destination,
      eventData: event.eventData,
    });
  }
}

// Enhanced event bus with logging
class LoggingEventBus {
  private logger = Logger.forContext('EventBus');

  async publish(event: DomainEvent | IntegrationEvent): Promise<void> {
    const eventLogger = this.logger.child(`${event.eventType}Handler`);

    eventLogger.info('Publishing event', {
      eventType: event.eventType,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    try {
      await this.eventBus.publish(event);

      eventLogger.info('Event published successfully', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
    } catch (error) {
      eventLogger.error('Failed to publish event', error as Error, {
        eventType: event.eventType,
        eventId: event.eventId,
      });
      throw error;
    }
  }
}
```

## 🧪 Testing

### Logger Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Logger, LogEvent } from '@vytches/ddd-logging';

describe('Logger', () => {
  let logger: Logger;
  let mockProvider: MockLogProvider;

  beforeEach(() => {
    mockProvider = new MockLogProvider();
    Logger.configure({ provider: mockProvider });
    logger = Logger.forContext('TestService');
  });

  describe('basic logging', () => {
    it('should log info messages', () => {
      logger.info('Test message', { key: 'value' });

      expect(mockProvider.events).toHaveLength(1);
      expect(mockProvider.events[0].level).toBe('info');
      expect(mockProvider.events[0].message).toBe('Test message');
      expect(mockProvider.events[0].data).toEqual({ key: 'value' });
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { context: 'test' });

      expect(mockProvider.events).toHaveLength(1);
      expect(mockProvider.events[0].level).toBe('error');
      expect(mockProvider.events[0].message).toBe('Error occurred');
      expect(mockProvider.events[0].error).toBe(error);
      expect(mockProvider.events[0].data).toEqual({ context: 'test' });
    });
  });

  describe('context', () => {
    it('should include context in log events', () => {
      const contextualLogger = logger.withContext({
        boundedContext: 'TestContext',
        userId: 'user123',
      });

      contextualLogger.info('Test message');

      expect(mockProvider.events[0].context).toEqual({
        name: 'TestService',
        boundedContext: 'TestContext',
        userId: 'user123',
      });
    });

    it('should create child loggers', () => {
      const childLogger = logger.child('ChildService');
      childLogger.info('Child message');

      expect(mockProvider.events[0].context.name).toBe('ChildService');
    });
  });

  describe('correlation tracking', () => {
    it('should track correlation ID', () => {
      const correlatedLogger = logger.withCorrelationId('corr-123');
      correlatedLogger.info('Correlated message');

      expect(mockProvider.events[0].context.correlationId).toBe('corr-123');
    });

    it('should track user ID', () => {
      const userLogger = logger.withUserId('user-456');
      userLogger.info('User message');

      expect(mockProvider.events[0].context.userId).toBe('user-456');
    });
  });
});

class MockLogProvider implements LogProvider {
  readonly name = 'mock';
  readonly events: LogEvent[] = [];

  write(event: LogEvent): void {
    this.events.push(event);
  }

  flush(): void {
    // No-op for testing
  }

  close(): void {
    this.events.length = 0;
  }
}
```

### Data Masking Testing

```typescript
import { describe, it, expect } from 'vitest';
import { Logger, DataMasker } from '@vytches/ddd-logging';

describe('DataMasker', () => {
  let masker: DataMasker;
  let logger: Logger;
  let mockProvider: MockLogProvider;

  beforeEach(() => {
    masker = new DataMasker({
      patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
      sensitiveKeys: ['password', 'secret', 'token'],
      replacement: '[MASKED]',
    });

    mockProvider = new MockLogProvider();
    Logger.configure({
      provider: mockProvider,
      masking: { enabled: true, customMasker: masker },
    });
    logger = Logger.forContext('TestService');
  });

  it('should mask email addresses', () => {
    logger.info('User registration', {
      email: 'user@example.com',
      name: 'John Doe',
    });

    expect(mockProvider.events[0].data).toEqual({
      email: '[MASKED]',
      name: 'John Doe',
    });
  });

  it('should mask sensitive keys', () => {
    logger.info('Authentication', {
      username: 'john',
      password: 'secret123',
      token: 'jwt-token-here',
    });

    expect(mockProvider.events[0].data).toEqual({
      username: 'john',
      password: '[MASKED]',
      token: '[MASKED]',
    });
  });

  it('should mask nested objects', () => {
    logger.info('User data', {
      user: {
        id: '123',
        email: 'user@example.com',
        profile: {
          name: 'John',
          secret: 'hidden-value',
        },
      },
    });

    expect(mockProvider.events[0].data).toEqual({
      user: {
        id: '123',
        email: '[MASKED]',
        profile: {
          name: 'John',
          secret: '[MASKED]',
        },
      },
    });
  });
});
```

### CQRS Integration Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LogCommands, LogQueries } from '@vytches/ddd-logging';
import { safeRun } from '@vytches/ddd-utils';

describe('CQRS Logging Integration', () => {
  let mockProvider: MockLogProvider;

  beforeEach(() => {
    mockProvider = new MockLogProvider();
    Logger.configure({ provider: mockProvider });
  });

  describe('LogCommands decorator', () => {
    it('should log command execution', async () => {
      @LogCommands({ includePayload: true, logLevel: 'info' })
      class TestCommandHandler {
        async handle(command: { id: string; name: string }): Promise<void> {
          // Command implementation
        }
      }

      const handler = new TestCommandHandler();
      await handler.handle({ id: '123', name: 'test' });

      expect(mockProvider.events).toHaveLength(2); // Start and completion
      expect(mockProvider.events[0].message).toContain('Executing');
      expect(mockProvider.events[1].message).toContain('completed');
    });

    it('should log command failures', async () => {
      @LogCommands({ includePayload: true, logLevel: 'info' })
      class FailingCommandHandler {
        async handle(command: { id: string }): Promise<void> {
          throw new Error('Command failed');
        }
      }

      const handler = new FailingCommandHandler();
      const [error] = await safeRun(() => handler.handle({ id: '123' }));

      expect(error).toBeInstanceOf(Error);
      expect(mockProvider.events).toHaveLength(2); // Start and failure
      expect(mockProvider.events[1].message).toContain('failed');
      expect(mockProvider.events[1].level).toBe('error');
    });
  });

  describe('LogQueries decorator', () => {
    it('should log query execution', async () => {
      @LogQueries({ includePayload: true, logLevel: 'debug' })
      class TestQueryHandler {
        async handle(query: { id: string }): Promise<{ data: string }> {
          return { data: 'test-data' };
        }
      }

      const handler = new TestQueryHandler();
      const result = await handler.handle({ id: '123' });

      expect(result.data).toBe('test-data');
      expect(mockProvider.events).toHaveLength(2); // Start and completion
      expect(mockProvider.events[0].level).toBe('debug');
      expect(mockProvider.events[1].level).toBe('debug');
    });
  });
});
```

## 🎯 Best Practices

### Logging Levels

```typescript
import { Logger } from '@vytches/ddd-logging';

class UserService {
  private logger = Logger.forContext('UserService');

  async createUser(userData: UserData): Promise<User> {
    // TRACE: Very detailed information, typically only of interest when diagnosing problems
    this.logger.trace('Entering createUser method', {
      inputValidation: true,
      userData: userData, // Only in development
    });

    // DEBUG: Detailed information for debugging
    this.logger.debug('Validating user data', {
      email: userData.email,
      hasPassword: !!userData.password,
      dataSize: JSON.stringify(userData).length,
    });

    // INFO: General information about application flow
    this.logger.info('Creating new user', {
      email: userData.email,
      registrationSource: userData.source,
    });

    try {
      const user = await this.userRepository.save(User.create(userData));

      // INFO: Successful operations
      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        createdAt: user.createdAt,
      });

      return user;
    } catch (error) {
      // ERROR: Error events that might still allow the application to continue
      this.logger.error('Failed to create user', error as Error, {
        email: userData.email,
        errorType: error.constructor.name,
      });

      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    // WARN: Potentially harmful situations
    this.logger.warn('User deletion requested', {
      userId,
      operation: 'DELETE',
      impact: 'permanent',
    });

    try {
      await this.userRepository.delete(userId);

      // INFO: Successful completion
      this.logger.info('User deleted successfully', { userId });
    } catch (error) {
      // FATAL: Very severe error events that will presumably lead the application to abort
      this.logger.fatal(
        'Critical failure during user deletion',
        error as Error,
        {
          userId,
          operation: 'DELETE',
          impact: 'data_integrity',
        }
      );

      throw error;
    }
  }
}
```

### Structured Logging

```typescript
import { Logger } from '@vytches/ddd-logging';

class OrderService {
  private logger = Logger.forContext('OrderService');

  async processOrder(orderData: OrderData): Promise<Order> {
    // Use consistent structure for similar operations
    const operationContext = {
      operation: 'processOrder',
      orderId: orderData.id,
      customerId: orderData.customerId,
      totalAmount: orderData.totalAmount,
      itemCount: orderData.items.length,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Order processing initiated', operationContext);

    try {
      // Payment processing with structured context
      const paymentContext = {
        ...operationContext,
        phase: 'payment',
        paymentMethod: orderData.paymentMethod,
        amount: orderData.totalAmount,
      };

      this.logger.info('Processing payment', paymentContext);
      const payment = await this.paymentService.processPayment(
        orderData.payment
      );

      // Inventory reservation with structured context
      const inventoryContext = {
        ...operationContext,
        phase: 'inventory',
        itemsToReserve: orderData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      this.logger.info('Reserving inventory', inventoryContext);
      await this.inventoryService.reserveItems(orderData.items);

      // Success logging with comprehensive context
      const successContext = {
        ...operationContext,
        result: 'success',
        paymentId: payment.id,
        processingTime: Date.now() - startTime,
        finalStatus: 'completed',
      };

      this.logger.info('Order processed successfully', successContext);

      return order;
    } catch (error) {
      // Error logging with context preservation
      const errorContext = {
        ...operationContext,
        result: 'error',
        errorType: error.constructor.name,
        errorMessage: error.message,
        processingTime: Date.now() - startTime,
        finalStatus: 'failed',
      };

      this.logger.error(
        'Order processing failed',
        error as Error,
        errorContext
      );
      throw error;
    }
  }
}
```

### Correlation and Tracing

```typescript
import { Logger } from '@vytches/ddd-logging';
import { v4 as uuidv4 } from 'uuid';

class OrderProcessingService {
  private logger = Logger.forContext('OrderProcessingService');

  async processOrder(
    orderData: OrderData,
    context: ProcessingContext
  ): Promise<Order> {
    // Create operation-specific correlation ID
    const operationId = uuidv4();

    // Create enriched logger with full context
    const operationLogger = this.logger
      .withCorrelationId(context.correlationId)
      .withUserId(context.userId)
      .withTenantId(context.tenantId)
      .withContext({
        operationId,
        operationType: 'order-processing',
        requestId: context.requestId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      });

    operationLogger.info('Order processing started', {
      orderId: orderData.id,
      customerId: orderData.customerId,
      operationId,
      traceId: context.traceId,
    });

    try {
      // Payment processing with inherited context
      const paymentLogger = operationLogger.child('PaymentProcessor');
      const payment = await this.processPayment(
        orderData.payment,
        paymentLogger
      );

      // Inventory processing with inherited context
      const inventoryLogger = operationLogger.child('InventoryProcessor');
      await this.reserveInventory(orderData.items, inventoryLogger);

      // Shipping processing with inherited context
      const shippingLogger = operationLogger.child('ShippingProcessor');
      await this.arrangeShipping(orderData.shipping, shippingLogger);

      operationLogger.info('Order processing completed', {
        orderId: orderData.id,
        paymentId: payment.id,
        operationId,
        duration: Date.now() - startTime,
      });

      return order;
    } catch (error) {
      operationLogger.error('Order processing failed', error as Error, {
        orderId: orderData.id,
        operationId,
        failurePoint: this.identifyFailurePoint(error),
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  private async processPayment(
    paymentData: PaymentData,
    logger: Logger
  ): Promise<Payment> {
    logger.info('Payment processing initiated', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      method: paymentData.method,
    });

    // Implementation with consistent logging...
  }
}
```

### Performance Monitoring

```typescript
import { Logger } from '@vytches/ddd-logging';

class PerformanceMonitoringService {
  private logger = Logger.forContext('PerformanceMonitoringService');

  async monitoredOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    thresholds: {
      warning: number;
      error: number;
    } = { warning: 1000, error: 5000 }
  ): Promise<T> {
    const startTime = Date.now();
    const operationId = uuidv4();

    this.logger.info('Operation started', {
      operationName,
      operationId,
      startTime: new Date(startTime).toISOString(),
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      // Log based on performance thresholds
      if (duration > thresholds.error) {
        this.logger.error(
          'Operation completed with critical performance issue',
          {
            operationName,
            operationId,
            duration: `${duration}ms`,
            threshold: `${thresholds.error}ms`,
            severity: 'critical',
          }
        );
      } else if (duration > thresholds.warning) {
        this.logger.warn('Operation completed with performance warning', {
          operationName,
          operationId,
          duration: `${duration}ms`,
          threshold: `${thresholds.warning}ms`,
          severity: 'warning',
        });
      } else {
        this.logger.info('Operation completed successfully', {
          operationName,
          operationId,
          duration: `${duration}ms`,
          performance: 'optimal',
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Operation failed', error as Error, {
        operationName,
        operationId,
        duration: `${duration}ms`,
        failureType: error.constructor.name,
      });

      throw error;
    }
  }
}

// Usage
class UserService {
  private logger = Logger.forContext('UserService');
  private performanceMonitor = new PerformanceMonitoringService();

  async createUser(userData: UserData): Promise<User> {
    return await this.performanceMonitor.monitoredOperation(
      'createUser',
      () => this.executeUserCreation(userData),
      { warning: 500, error: 2000 }
    );
  }

  private async executeUserCreation(userData: UserData): Promise<User> {
    // Implementation...
  }
}
```

### Security and Compliance

```typescript
import { Logger } from '@vytches/ddd-logging';

// Security-focused logging configuration
Logger.configure({
  masking: {
    enabled: true,
    patterns: [
      // PII patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b\d{10,15}\b/g, // Phone numbers

      // Security tokens
      /bearer\s+[a-zA-Z0-9\-._~+\/]+=*/gi, // Bearer tokens
      /api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9\-._~+\/]+=*/gi, // API keys

      // Financial data
      /\b[A-Z]{2}\d{2}[A-Z]{4}\d{10}\b/g, // IBAN
      /\b\d{9}\b/g, // Routing numbers
    ],
    sensitiveKeys: [
      // Authentication
      'password',
      'passwd',
      'secret',
      'token',
      'key',
      'authorization',
      'auth',
      'credential',
      'bearer',
      'apikey',
      'api_key',

      // Personal information
      'email',
      'phone',
      'ssn',
      'social_security',
      'personalId',
      'firstName',
      'lastName',
      'fullName',
      'address',
      'zipCode',

      // Financial
      'creditCard',
      'credit_card',
      'cardNumber',
      'cvv',
      'cvv2',
      'accountNumber',
      'account_number',
      'routingNumber',
      'iban',

      // Business sensitive
      'salary',
      'revenue',
      'profit',
      'cost',
      'pricing',
      'discount',
    ],
    replacement: '[REDACTED]',
  },
});

class AuditLoggingService {
  private logger = Logger.forContext('AuditLoggingService').withContext({
    boundedContext: 'Auditing',
    compliance: 'SOX,GDPR,HIPAA',
    retention: '7years',
  });

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.logger.warn('Security event detected', {
      eventType: event.type,
      eventId: event.id,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: event.timestamp,
      severity: event.severity,
      description: event.description,
      mitigationActions: event.mitigationActions,
      complianceFlags: event.complianceFlags,
    });
  }

  async logDataAccess(access: DataAccessEvent): Promise<void> {
    this.logger.info('Data access logged', {
      accessType: access.type,
      resourceId: access.resourceId,
      resourceType: access.resourceType,
      userId: access.userId,
      permission: access.permission,
      result: access.result,
      timestamp: access.timestamp,
      dataClassification: access.dataClassification,
      auditTrail: access.auditTrail,
    });
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

# Run tests
pnpm test

# Build package
pnpm build

# Run logging-specific tests
pnpm test:packages:logging

# Run logging examples
cd examples/logging-showcase
pnpm build && node dist/index.js
```

### Package Scripts

```bash
# Development
pnpm dev                 # Watch mode development
pnpm build              # Build for production
pnpm clean              # Clean build artifacts

# Testing
pnpm test               # Run tests
pnpm test:watch         # Watch mode testing
pnpm test:coverage      # Run with coverage

# Quality
pnpm lint               # Lint code
pnpm type-check         # TypeScript type checking
pnpm quality            # Run quality checks
```

## 📄 License

This project is licensed under the MIT License - see the
[LICENSE](../../LICENSE) file for details.

---

**Part of the VytchesDDD Enterprise Suite**

For more information about the complete VytchesDDD ecosystem, visit our
[main documentation](../../README.md).
