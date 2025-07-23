# CQRS Integration Logging

**Version**: 1.0.0 **Package**: @vytches-ddd/logging + @vytches-ddd/cqrs
**Complexity**: basic **Domain**: Command/Query Logging **Patterns**:
Decorators, middleware, execution timing **Dependencies**: @vytches-ddd/logging,
@vytches-ddd/cqrs

## Description

Automatic command and query execution logging using decorators. This example
demonstrates how to integrate @vytches-ddd/logging with CQRS patterns for
comprehensive operation tracking, performance monitoring, and debugging.

## Business Context

CQRS applications need automatic logging of all commands and queries for
auditing, performance monitoring, and debugging. The logging should capture
execution context, timing, payloads (with sensitive data masked), and results
without cluttering business logic.

## Code Example

```typescript
// cqrs-logging-integration.ts
import {
  Logger,
  LogCommands,
  LogQueries,
  LogCQRS,
  CQRSLoggingOptions,
} from '@vytches-ddd/logging';
import {
  CommandHandler,
  QueryHandler,
  ICommand,
  IQuery,
} from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';
import {
  CreateUserCommand,
  UpdateUserCommand,
  GetUserQuery,
  GetUsersByRoleQuery,
  CreateOrderCommand,
  ProcessOrderCommand,
  GetOrderQuery,
  GetOrderHistoryQuery,
  UserData,
  OrderData,
  ServiceResponse,
} from '../types'; // From your application

// ✅ FOCUS: Command handler with automatic logging
@LogCommands({
  includePayload: true,
  logLevel: 'info',
  measurePerformance: true,
  maskSensitiveData: true,
})
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  private logger = Logger.forContext(); // Auto-detects "CreateUserCommandHandler"

  async execute(command: CreateUserCommand): Promise<Result<UserData, Error>> {
    // ⭐ FOCUS: Automatic logging happens before and after execution
    // - Command payload logged (with sensitive data masked)
    // - Execution time measured
    // - Success/failure automatically tracked

    try {
      // Business logic
      const user: UserData = {
        id: 'user-' + Date.now(),
        name: command.name,
        email: command.email,
        role: command.role,
        createdAt: new Date(),
        isActive: true,
        preferences: command.initialPreferences || {},
      };

      // Additional business logging if needed
      this.logger.info('User validation passed', {
        email: user.email, // Will be masked
        role: user.role,
      });

      return Result.success(user);
    } catch (error) {
      // Error automatically logged by decorator
      return Result.fail(error);
    }
  }
}

// ✅ FOCUS: Command handler with conditional logging
@LogCommands({
  includePayload: true,
  logLevel: 'info',
  measurePerformance: true,
  condition: (command: UpdateUserCommand) => {
    // Only log updates that change sensitive fields
    return !!(command.email || command.preferences);
  },
})
@CommandHandler(UpdateUserCommand)
export class UpdateUserCommandHandler {
  private logger = Logger.forContext();

  async execute(command: UpdateUserCommand): Promise<Result<UserData, Error>> {
    this.logger.debug('Processing user update', {
      userId: command.userId,
      fieldsToUpdate: Object.keys(command).filter(k => k !== 'userId'),
    });

    try {
      // Simulate user update
      const updatedUser: UserData = {
        id: command.userId,
        name: command.name || 'Existing Name',
        email: command.email || 'existing@example.com',
        role: 'user',
        createdAt: new Date(),
        isActive: true,
        preferences: command.preferences || {},
      };

      return Result.success(updatedUser);
    } catch (error) {
      return Result.fail(error);
    }
  }
}

// ✅ FOCUS: Query handler with performance logging
@LogQueries({
  includePayload: true,
  logLevel: 'debug',
  measurePerformance: true,
  performanceThreshold: 100, // Log warning if query takes > 100ms
})
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler {
  private logger = Logger.forContext();

  async execute(query: GetUserQuery): Promise<Result<UserData | null, Error>> {
    // ⭐ FOCUS: Query automatically logged with timing

    try {
      // Simulate database query
      await this.simulateSlowQuery(50); // 50ms delay

      if (query.userId === 'not-found') {
        this.logger.warn('User not found', { userId: query.userId });
        return Result.success(null);
      }

      const user: UserData = {
        id: query.userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        createdAt: new Date(),
        isActive: true,
        preferences: query.includePreferences ? { theme: 'dark' } : undefined,
      };

      return Result.success(user);
    } catch (error) {
      return Result.fail(error);
    }
  }

  private async simulateSlowQuery(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ✅ FOCUS: Query handler with result count logging
@LogQueries({
  includePayload: true,
  logLevel: 'debug',
  measurePerformance: true,
  includeResultCount: true, // Log number of results
})
@QueryHandler(GetUsersByRoleQuery)
export class GetUsersByRoleQueryHandler {
  private logger = Logger.forContext();

  async execute(
    query: GetUsersByRoleQuery
  ): Promise<Result<UserData[], Error>> {
    try {
      // Simulate fetching users by role
      const users: UserData[] = this.generateMockUsers(
        query.role,
        query.limit || 10
      );

      // ⭐ FOCUS: Result count automatically logged
      this.logger.debug('Users fetched by role', {
        role: query.role,
        requestedLimit: query.limit,
        actualCount: users.length,
      });

      return Result.success(users);
    } catch (error) {
      return Result.fail(error);
    }
  }

  private generateMockUsers(role: string, count: number): UserData[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `user-${role}-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: role,
      createdAt: new Date(),
      isActive: true,
    }));
  }
}

// ✅ FOCUS: Command handler with custom logging options
@LogCommands({
  includePayload: true,
  logLevel: 'info',
  measurePerformance: true,
  maskSensitiveData: true,
  customLogData: (command: CreateOrderCommand) => ({
    customerId: command.customerId,
    itemCount: command.items.length,
    paymentMethod: command.paymentMethod,
    // Add business-specific context
    orderType: command.items.length > 5 ? 'bulk' : 'standard',
  }),
})
@CommandHandler(CreateOrderCommand)
export class CreateOrderCommandHandler {
  private logger = Logger.forContext();

  async execute(
    command: CreateOrderCommand
  ): Promise<Result<OrderData, Error>> {
    // ⭐ FOCUS: Custom log data added to automatic logging

    try {
      // Calculate order total
      const totalAmount = command.items.reduce(
        (sum, item) => sum + item.quantity * 10, // Mock price
        0
      );

      const order: OrderData = {
        id: 'order-' + Date.now(),
        customerId: command.customerId,
        items: command.items.map(item => ({
          id: 'item-' + Date.now(),
          productId: item.productId,
          name: 'Product',
          quantity: item.quantity,
          price: 10,
        })),
        totalAmount,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentInfo: {
          method: command.paymentMethod,
          // Sensitive data will be masked
          cardNumber:
            command.paymentMethod === 'credit-card'
              ? '1234-5678-9012-3456'
              : undefined,
        },
      };

      this.logger.info('Order created successfully', {
        orderId: order.id,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
      });

      return Result.success(order);
    } catch (error) {
      return Result.fail(error);
    }
  }
}

// ✅ FOCUS: Using @LogCQRS for both commands and queries
@LogCQRS({
  commands: {
    includePayload: true,
    logLevel: 'info',
    measurePerformance: true,
  },
  queries: {
    includePayload: true,
    logLevel: 'debug',
    measurePerformance: true,
  },
})
export class OrderService {
  private logger = Logger.forContext();

  @CommandHandler(ProcessOrderCommand)
  async processOrder(
    command: ProcessOrderCommand
  ): Promise<Result<OrderData, Error>> {
    // ⭐ FOCUS: Automatically logged as command

    try {
      this.logger.info('Starting order processing', {
        orderId: command.orderId,
        processingNotes: command.processingNotes,
      });

      // Simulate order processing
      const processedOrder: OrderData = {
        id: command.orderId,
        customerId: 'customer-123',
        items: [],
        totalAmount: 100,
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return Result.success(processedOrder);
    } catch (error) {
      this.logger.error('Order processing failed', {
        orderId: command.orderId,
        error: error,
      });
      return Result.fail(error);
    }
  }

  @QueryHandler(GetOrderQuery)
  async getOrder(
    query: GetOrderQuery
  ): Promise<Result<OrderData | null, Error>> {
    // ⭐ FOCUS: Automatically logged as query

    try {
      if (query.orderId === 'not-found') {
        return Result.success(null);
      }

      const order: OrderData = {
        id: query.orderId,
        customerId: 'customer-123',
        items: query.includeItems
          ? [
              {
                id: 'item-1',
                productId: 'product-1',
                name: 'Sample Product',
                quantity: 2,
                price: 50,
              },
            ]
          : [],
        totalAmount: 100,
        status: 'delivered',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return Result.success(order);
    } catch (error) {
      return Result.fail(error);
    }
  }
}

// ✅ FOCUS: Query with complex filtering and performance concerns
@LogQueries({
  includePayload: true,
  logLevel: 'debug',
  measurePerformance: true,
  performanceThreshold: 200,
  warnOnSlowQuery: true,
  slowQueryThreshold: 500,
})
@QueryHandler(GetOrderHistoryQuery)
export class GetOrderHistoryQueryHandler {
  private logger = Logger.forContext();

  async execute(
    query: GetOrderHistoryQuery
  ): Promise<Result<OrderData[], Error>> {
    const queryLogger = this.logger.withContext({
      queryType: 'order-history',
      customerId: query.customerId,
    });

    try {
      queryLogger.debug('Fetching order history', {
        dateRange: {
          start: query.startDate,
          end: query.endDate,
        },
        filters: {
          status: query.status,
          limit: query.limit,
        },
      });

      // Simulate complex query
      await this.simulateSlowQuery(300); // Will trigger performance warning

      const orders: OrderData[] = this.generateMockOrderHistory(
        query.customerId,
        query.limit || 100
      );

      // ⭐ FOCUS: Performance automatically tracked and warned if slow
      queryLogger.info('Order history fetched', {
        resultCount: orders.length,
        dateRange: `${query.startDate?.toISOString()} - ${query.endDate?.toISOString()}`,
      });

      return Result.success(orders);
    } catch (error) {
      queryLogger.error('Order history query failed', {
        error: error,
        queryParams: query,
      });
      return Result.fail(error);
    }
  }

  private async simulateSlowQuery(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockOrderHistory(
    customerId: string,
    count: number
  ): OrderData[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `order-${customerId}-${i}`,
      customerId,
      items: [],
      totalAmount: Math.random() * 1000,
      status: ['pending', 'processing', 'shipped', 'delivered'][
        Math.floor(Math.random() * 4)
      ] as any,
      createdAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ),
      updatedAt: new Date(),
    }));
  }
}

// ✅ FOCUS: Custom CQRS logging configuration
export class CQRSLoggingConfiguration {
  static setupGlobalLogging(): void {
    // Configure global CQRS logging defaults
    const globalOptions: CQRSLoggingOptions = {
      commands: {
        includePayload: true,
        logLevel: 'info',
        measurePerformance: true,
        maskSensitiveData: true,
        performanceThreshold: 1000, // 1 second for commands
        customSerializer: (command: any) => {
          // Custom serialization logic
          return JSON.stringify(command, null, 2);
        },
      },
      queries: {
        includePayload: true,
        logLevel: 'debug',
        measurePerformance: true,
        performanceThreshold: 500, // 500ms for queries
        includeResultCount: true,
        warnOnSlowQuery: true,
        slowQueryThreshold: 1000,
      },
    };

    // Apply global configuration
    Logger.configureCQRSLogging(globalOptions);
  }

  static setupPerformanceMonitoring(): void {
    // Setup performance monitoring for CQRS
    Logger.onCQRSPerformanceThresholdExceeded(event => {
      console.warn('Performance threshold exceeded:', {
        type: event.type,
        name: event.name,
        duration: event.duration,
        threshold: event.threshold,
      });

      // Could send to monitoring service
      // monitoringService.recordSlowOperation(event);
    });
  }
}
```

## Usage Examples

```typescript
// Setup global CQRS logging configuration
CQRSLoggingConfiguration.setupGlobalLogging();
CQRSLoggingConfiguration.setupPerformanceMonitoring();

// Execute commands with automatic logging
const createUserHandler = new CreateUserCommandHandler();
const createUserCommand: CreateUserCommand = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'admin',
  initialPreferences: {
    theme: 'dark',
    notifications: true,
  },
};

const userResult = await createUserHandler.execute(createUserCommand);
// Logs:
// - Command execution started
// - Command payload (email masked)
// - Execution time
// - Success/failure result

// Execute queries with automatic logging
const getUserHandler = new GetUserQueryHandler();
const getUserQuery: GetUserQuery = {
  userId: 'user-123',
  includePreferences: true,
};

const queryResult = await getUserHandler.execute(getUserQuery);
// Logs:
// - Query execution started
// - Query parameters
// - Execution time
// - Result (with sensitive data masked)

// Complex query with performance warnings
const orderHistoryHandler = new GetOrderHistoryQueryHandler();
const historyQuery: GetOrderHistoryQuery = {
  customerId: 'customer-123',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  status: 'delivered',
  limit: 50,
};

const historyResult = await orderHistoryHandler.execute(historyQuery);
// Logs:
// - Query execution with parameters
// - Performance warning if > 200ms
// - Result count
// - Total execution time

// Using the combined service approach
const orderService = new OrderService();

const processCommand: ProcessOrderCommand = {
  orderId: 'order-456',
  processingNotes: 'Express shipping requested',
};

const processResult = await orderService.processOrder(processCommand);
// Automatically logged as command

const getOrderQuery: GetOrderQuery = {
  orderId: 'order-456',
  includeItems: true,
};

const orderResult = await orderService.getOrder(getOrderQuery);
// Automatically logged as query
```

## Log Output Examples

```json
// Command execution log
{
  "level": "info",
  "message": "Executing command: CreateUserCommand",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "context": {
    "className": "CreateUserCommandHandler",
    "methodName": "execute",
    "boundedContext": "UserManagement"
  },
  "data": {
    "commandType": "CreateUserCommand",
    "payload": {
      "name": "Jane Smith",
      "email": "j***@example.com",
      "role": "admin",
      "initialPreferences": "[OBJECT]"
    },
    "executionStarted": "2024-01-20T10:30:00.000Z"
  }
}

// Command success log
{
  "level": "info",
  "message": "Command executed successfully: CreateUserCommand",
  "timestamp": "2024-01-20T10:30:00.150Z",
  "context": {
    "className": "CreateUserCommandHandler",
    "methodName": "execute"
  },
  "data": {
    "commandType": "CreateUserCommand",
    "executionTime": 150,
    "success": true,
    "resultType": "UserData"
  }
}

// Query performance warning
{
  "level": "warn",
  "message": "Query exceeded performance threshold: GetOrderHistoryQuery",
  "timestamp": "2024-01-20T10:30:01.000Z",
  "context": {
    "className": "GetOrderHistoryQueryHandler",
    "methodName": "execute"
  },
  "data": {
    "queryType": "GetOrderHistoryQuery",
    "executionTime": 350,
    "threshold": 200,
    "resultCount": 50,
    "parameters": {
      "customerId": "customer-123",
      "dateRange": "30 days"
    }
  }
}
```

## Key Features

- **Automatic Command Logging**: Log command execution with timing and results
- **Automatic Query Logging**: Log query execution with performance tracking
- **Sensitive Data Masking**: Automatically mask sensitive data in payloads
- **Performance Monitoring**: Track and warn on slow operations
- **Conditional Logging**: Log only when specific conditions are met
- **Custom Log Data**: Add business-specific context to automatic logs
- **Result Count Tracking**: Automatically log number of results for queries
- **Flexible Configuration**: Configure logging per handler or globally

## Best Practices

- Use `@LogCommands` for all command handlers to ensure audit trail
- Use `@LogQueries` with appropriate log levels (debug for reads, info for
  complex queries)
- Set performance thresholds based on your application's SLAs
- Include custom log data for business-critical context
- Use conditional logging to reduce noise in high-frequency operations
- Configure global defaults to ensure consistent logging across all handlers

## Common Pitfalls

- **Over-logging Query Results**: Be careful with large result sets in debug
  logs
- **Missing Performance Thresholds**: Set appropriate thresholds for your use
  case
- **Logging Sensitive Payloads**: Ensure sensitive data masking is configured
- **Wrong Log Levels**: Use debug for queries, info for commands
- **Missing Context**: Add custom log data for business-specific information

## Related Examples

- [Basic Logger Setup](./example-1.md)
- [Result Pattern Logging](./example-3.md)
- [NestJS Service Integration](../frameworks/nestjs/basic/example-2.md)
