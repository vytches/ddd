# Basic Logger Setup

**Version**: 1.0.0 **Package**: @vytches-ddd/logging **Complexity**: basic
**Domain**: Structured Logging **Patterns**: Context detection, data masking,
configuration **Dependencies**: @vytches-ddd/logging

## Description

Basic logger setup with automatic context detection, data masking for sensitive
information, and foundational configuration. This example demonstrates the core
features of @vytches-ddd/logging package for structured application logging.

## Business Context

Applications need reliable, structured logging that automatically captures
relevant context (class names, method names, bounded contexts) while protecting
sensitive data through automatic masking. This foundation enables effective
debugging, monitoring, and compliance.

## Code Example

```typescript
// basic-logger-setup.ts
import { Logger, LogLevel, LoggerConfiguration } from '@vytches-ddd/logging';
import {
  UserData,
  OrderData,
  LoggingConfig,
  LogContext,
  DatabaseConfig,
} from '../types'; // From your application

// ✅ FOCUS: Basic logger configuration with context detection
export class BasicLoggerSetup {
  private logger: Logger;

  constructor() {
    this.setupLogger();
  }

  private setupLogger(): void {
    // Basic logger configuration
    const config: LoggingConfig = {
      level: 'info',
      enableConsoleOutput: true,
      enableFileOutput: false, // Keep it simple for basic setup

      // ⭐ FOCUS: Automatic context detection
      contextDetection: {
        enabled: true,
        stackTraceAnalysis: true,
        boundedContextDetection: true,
      },

      // ⭐ FOCUS: Data masking configuration
      masking: {
        enabled: true,
        sensitiveKeys: [
          'password',
          'apiKey',
          'token',
          'secret',
          'cardNumber',
          'ssn',
          'phoneNumber',
        ],
        replacement: '[MASKED]',
        customMaskers: {
          email: (email: string) => {
            // Show first character and domain, mask the rest
            const [local, domain] = email.split('@');
            return `${local[0]}***@${domain}`;
          },
        },
      },

      // Basic formatting
      formatting: {
        colorize: true,
        timestamp: true,
        prettyPrint: false, // Use JSON for production
      },
    };

    // Initialize logger with configuration
    this.logger = Logger.create(config);

    console.log('✅ Basic logger configured successfully');
  }

  // ✅ FOCUS: Context detection in action
  demonstrateContextDetection(): void {
    // Logger automatically detects:
    // - Class name: BasicLoggerSetup
    // - Method name: demonstrateContextDetection
    // - Bounded context: from package structure

    this.logger.info('Context detection demonstration', {
      feature: 'automatic-context',
      detectedFrom: 'stack-trace-analysis',
    });

    // Manual context enrichment (optional)
    this.logger
      .withContext({
        userId: 'user-123',
        sessionId: 'session-456',
        operationName: 'context-demo',
      })
      .info('Enhanced context logging', {
        customData: 'additional information',
      });
  }

  // ✅ FOCUS: Data masking demonstration
  demonstrateDataMasking(): void {
    const sensitiveUserData: UserData = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
      sensitiveData: {
        ssn: '123-45-6789',
        phoneNumber: '+1-555-123-4567',
        address: '123 Main St, City, State 12345',
      },
    };

    // ⭐ FOCUS: Automatic data masking
    this.logger.info('User data logged with automatic masking', {
      userData: sensitiveUserData,
      operation: 'user-registration',
    });

    // Output will show:
    // - email: "j***@example.com"
    // - ssn: "[MASKED]"
    // - phoneNumber: "[MASKED]"

    const databaseConfig: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      username: 'app_user',
      password: 'super-secret-password',
      database: 'app_db',
      ssl: true,
    };

    // ⭐ FOCUS: Configuration logging with masking
    this.logger.info('Database configuration loaded', {
      config: databaseConfig,
      // password will be automatically masked as "[MASKED]"
      timestamp: new Date(),
    });
  }

  // ✅ FOCUS: Different log levels
  demonstrateLogLevels(): void {
    // Error logging with context
    this.logger.error('Critical error occurred', {
      errorCode: 'DB_CONNECTION_FAILED',
      attemptNumber: 3,
      maxRetries: 5,
    });

    // Warning with business context
    this.logger.warn('Performance threshold exceeded', {
      responseTime: 2500,
      threshold: 2000,
      endpoint: '/api/users',
    });

    // Info for business events
    this.logger.info('User successfully registered', {
      userId: 'user-789',
      registrationMethod: 'email',
      marketingOptIn: true,
    });

    // Debug for development
    this.logger.debug('Processing order items', {
      orderId: 'order-456',
      itemCount: 3,
      processingStage: 'validation',
    });
  }

  // ✅ FOCUS: Error logging with stack traces
  demonstrateErrorLogging(): void {
    try {
      // Simulate an error
      this.simulateBusinessOperation();
    } catch (error) {
      // ⭐ FOCUS: Error logging with full context
      this.logger.error('Business operation failed', {
        error: error,
        operation: 'order-processing',
        userId: 'user-123',
        orderId: 'order-456',
        // Stack trace and context automatically captured
      });

      // You can also log just the error message
      this.logger.error(error.message, {
        errorType: error.constructor.name,
        businessContext: 'payment-processing',
      });
    }
  }

  private simulateBusinessOperation(): void {
    throw new Error('Simulated business operation failure');
  }

  // ✅ FOCUS: Structured logging for business events
  logBusinessEvent(eventType: string, eventData: any): void {
    this.logger.info(`Business event: ${eventType}`, {
      eventType,
      eventData,
      timestamp: new Date(),
      // Context automatically detected
    });
  }

  // ✅ FOCUS: Performance logging
  async logOperationPerformance<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    this.logger.debug(`Starting operation: ${operationName}`, {
      operationName,
      startTime: new Date(),
    });

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.logger.info(`Operation completed: ${operationName}`, {
        operationName,
        duration,
        success: true,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(`Operation failed: ${operationName}`, {
        operationName,
        duration,
        success: false,
        error: error,
        timestamp: new Date(),
      });

      throw error;
    }
  }
}

// ✅ FOCUS: Usage example in different contexts
export class UserService {
  private logger = Logger.forContext(); // Automatically detects "UserService"

  async createUser(userData: UserData): Promise<UserData> {
    this.logger.info('Creating new user', {
      email: userData.email, // Will be masked automatically
      role: userData.role,
      operation: 'user-creation',
    });

    try {
      // Simulate user creation
      const newUser: UserData = {
        ...userData,
        id: 'user-' + Date.now(),
        createdAt: new Date(),
        isActive: true,
      };

      this.logger.info('User created successfully', {
        userId: newUser.id,
        email: newUser.email, // Masked
        role: newUser.role,
        createdAt: newUser.createdAt,
      });

      return newUser;
    } catch (error) {
      this.logger.error('User creation failed', {
        email: userData.email, // Masked
        error: error,
        operation: 'user-creation',
      });
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserData | null> {
    this.logger.debug('Fetching user by ID', { userId });

    try {
      // Simulate user lookup
      const user = await this.mockUserLookup(userId);

      if (!user) {
        this.logger.warn('User not found', { userId });
        return null;
      }

      this.logger.info('User fetched successfully', {
        userId: user.id,
        email: user.email, // Masked
        isActive: user.isActive,
      });

      return user;
    } catch (error) {
      this.logger.error('User fetch failed', {
        userId,
        error: error,
      });
      throw error;
    }
  }

  private async mockUserLookup(userId: string): Promise<UserData | null> {
    // Mock implementation
    if (userId === 'user-not-found') {
      return null;
    }

    return {
      id: userId,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
    };
  }
}

// ✅ FOCUS: Order processing service example
export class OrderService {
  private logger = Logger.forContext(); // Auto-detects "OrderService"

  async processOrder(orderData: OrderData): Promise<OrderData> {
    // ⭐ FOCUS: Business operation logging with context
    this.logger.info('Processing order', {
      orderId: orderData.id,
      customerId: orderData.customerId,
      itemCount: orderData.items.length,
      totalAmount: orderData.totalAmount,
      // Payment info will be masked automatically
      paymentMethod: orderData.paymentInfo?.method,
    });

    const operationLogger = this.logger.withContext({
      orderId: orderData.id,
      customerId: orderData.customerId,
      operationName: 'order-processing',
    });

    try {
      // Step 1: Validate order
      operationLogger.debug('Validating order data');
      await this.validateOrder(orderData);

      // Step 2: Process payment
      operationLogger.info('Processing payment', {
        amount: orderData.totalAmount,
        paymentMethod: orderData.paymentInfo?.method,
        // cardNumber automatically masked
      });
      await this.processPayment(orderData);

      // Step 3: Update inventory
      operationLogger.debug('Updating inventory');
      await this.updateInventory(orderData.items);

      // Step 4: Complete order
      const processedOrder = {
        ...orderData,
        status: 'processing' as const,
        updatedAt: new Date(),
      };

      operationLogger.info('Order processed successfully', {
        orderId: processedOrder.id,
        newStatus: processedOrder.status,
        processingTime: Date.now() - orderData.createdAt.getTime(),
      });

      return processedOrder;
    } catch (error) {
      operationLogger.error('Order processing failed', {
        error: error,
        orderStatus: orderData.status,
        stage: this.determineFailureStage(error),
      });
      throw error;
    }
  }

  private async validateOrder(orderData: OrderData): Promise<void> {
    // Mock validation
    if (orderData.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
  }

  private async processPayment(orderData: OrderData): Promise<void> {
    // Mock payment processing
    if (!orderData.paymentInfo?.method) {
      throw new Error('Payment method required');
    }
  }

  private async updateInventory(items: any[]): Promise<void> {
    // Mock inventory update
    this.logger.debug(`Updating inventory for ${items.length} items`);
  }

  private determineFailureStage(error: Error): string {
    if (error.message.includes('item')) return 'validation';
    if (error.message.includes('payment')) return 'payment';
    if (error.message.includes('inventory')) return 'inventory';
    return 'unknown';
  }
}
```

## Usage Examples

```typescript
// Initialize and demonstrate basic logging
const basicSetup = new BasicLoggerSetup();

// Context detection demonstration
basicSetup.demonstrateContextDetection();

// Data masking demonstration
basicSetup.demonstrateDataMasking();

// Different log levels
basicSetup.demonstrateLogLevels();

// Error logging
basicSetup.demonstrateErrorLogging();

// Business event logging
basicSetup.logBusinessEvent('UserRegistered', {
  userId: 'user-123',
  email: 'user@example.com', // Will be masked
  registrationSource: 'web',
});

// Performance logging
const userService = new UserService();
await basicSetup.logOperationPerformance('createUser', async () => {
  return await userService.createUser({
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    id: '',
    createdAt: new Date(),
    isActive: true,
  });
});

// Service usage with automatic context
const orderService = new OrderService();
const order: OrderData = {
  id: 'order-123',
  customerId: 'customer-456',
  items: [
    {
      id: '1',
      productId: 'product-1',
      name: 'Widget',
      quantity: 2,
      price: 10.0,
    },
  ],
  totalAmount: 20.0,
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  paymentInfo: {
    method: 'credit-card',
    cardNumber: '1234-5678-9012-3456', // Will be masked
    expiryDate: '12/25',
  },
};

await orderService.processOrder(order);
```

## Key Features

- **Automatic Context Detection**: Detects class names, method names, and
  bounded contexts from stack traces
- **Data Masking**: Automatically masks sensitive information (passwords, API
  keys, card numbers, etc.)
- **Structured Logging**: JSON-based structured logs for better parsing and
  analysis
- **Multiple Log Levels**: Error, warn, info, debug levels with appropriate
  context
- **Performance Logging**: Built-in operation timing and performance tracking
- **Business Event Logging**: Structured logging for business operations and
  events

## Configuration Options

```typescript
// Advanced configuration example
const advancedConfig: LoggingConfig = {
  level: 'debug',
  enableConsoleOutput: true,
  enableFileOutput: true,

  contextDetection: {
    enabled: true,
    stackTraceAnalysis: true,
    boundedContextDetection: true,
  },

  masking: {
    enabled: true,
    sensitiveKeys: [
      'password',
      'secret',
      'token',
      'apiKey',
      'cardNumber',
      'ssn',
      'phoneNumber',
      'address',
    ],
    replacement: '[REDACTED]',
    customMaskers: {
      email: email => email.replace(/(.{1}).*@/, '$1***@'),
      phone: phone => phone.replace(/\d(?=\d{4})/g, '*'),
    },
  },

  formatting: {
    colorize: process.env.NODE_ENV === 'development',
    timestamp: true,
    prettyPrint: process.env.NODE_ENV === 'development',
  },
};
```

## Best Practices

- Use `Logger.forContext()` in classes for automatic context detection
- Configure data masking for all sensitive fields early in development
- Use appropriate log levels (error for failures, info for business events,
  debug for development)
- Include relevant context in log messages (user IDs, operation names,
  correlation IDs)
- Use structured logging with objects rather than string concatenation
- Log both successful operations and failures for comprehensive auditing

## Common Pitfalls

- **Logging Sensitive Data**: Always configure masking before production
  deployment
- **Over-logging**: Avoid logging at debug level in production without log level
  filtering
- **Missing Context**: Include relevant business context (user ID, operation
  name) in log entries
- **Performance Impact**: Be mindful of logging performance in high-throughput
  operations
- **Log Level Configuration**: Set appropriate log levels for different
  environments

## Related Examples

- [CQRS Integration Logging](./example-2.md)
- [Result Pattern Logging](./example-3.md)
- [NestJS Manual Setup](../frameworks/nestjs/basic/example-1.md)
