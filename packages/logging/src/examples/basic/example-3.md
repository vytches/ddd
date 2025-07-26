# Result Pattern Logging

**Version**: 1.0.0 **Package**: @vytches/ddd-logging + @vytches/ddd-utils
**Complexity**: basic **Domain**: Result Pattern Integration **Patterns**:
Success/failure tracking, error context, extensions **Dependencies**:
@vytches/ddd-logging, @vytches/ddd-utils

## Description

Integration between @vytches/ddd-logging and @vytches/ddd-utils Result pattern
for automatic success/failure tracking. This example demonstrates how to extend
Result pattern with logging capabilities for comprehensive operation tracking
and error analysis.

## Business Context

Business operations often use Result pattern to handle success/failure scenarios
without throwing exceptions. Adding automatic logging to Result pattern provides
consistent operation tracking, error analysis, and debugging capabilities across
the entire application without cluttering business logic.

## Code Example

```typescript
// result-pattern-logging.ts
import {
  Logger,
  LogLevel,
  withLogging,
  ResultLogger,
} from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import {
  UserData,
  OrderData,
  ValidationError,
  BusinessError,
  ServiceResponse,
  CreateUserCommand,
  ProcessOrderCommand,
  PaymentData,
  InventoryItem,
} from '../types'; // From your application

// ✅ FOCUS: Result extension with logging
export class ResultPatternLogging {
  private logger = Logger.forContext();

  // ✅ FOCUS: Basic Result logging
  async createUserWithLogging(
    userData: CreateUserCommand
  ): Promise<Result<UserData, Error>> {
    const operationLogger = this.logger.withContext({
      operation: 'createUser',
      userEmail: userData.email, // Will be masked
    });

    try {
      // Validate input
      if (!userData.email || !userData.email.includes('@')) {
        const error = new ValidationError(
          'Invalid email format',
          'email',
          userData.email
        );

        // ⭐ FOCUS: Log failure with context
        operationLogger.error('User creation failed - validation error', {
          error: error,
          field: error.field,
          value: error.value, // Will be masked if sensitive
        });

        return Result.fail(error);
      }

      // Simulate user creation
      const newUser: UserData = {
        id: 'user-' + Date.now(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        createdAt: new Date(),
        isActive: true,
        preferences: userData.initialPreferences || {},
      };

      // ⭐ FOCUS: Log success with context
      operationLogger.info('User created successfully', {
        userId: newUser.id,
        role: newUser.role,
        hasPreferences: !!userData.initialPreferences,
      });

      return Result.success(newUser);
    } catch (error) {
      // ⭐ FOCUS: Log unexpected errors
      operationLogger.error('User creation failed - unexpected error', {
        error: error,
        operation: 'createUser',
      });

      return Result.fail(error as Error);
    }
  }

  // ✅ FOCUS: Using ResultLogger for automatic logging
  async processOrderWithResultLogger(
    orderCommand: ProcessOrderCommand
  ): Promise<Result<OrderData, Error>> {
    // ⭐ FOCUS: Create ResultLogger with context
    const resultLogger = new ResultLogger(this.logger, {
      operation: 'processOrder',
      orderId: orderCommand.orderId,
    });

    return resultLogger.execute(async () => {
      // Validation phase
      const validationResult = await this.validateOrder(orderCommand.orderId);
      if (validationResult.isFailure()) {
        // Automatically logged by ResultLogger
        return validationResult;
      }

      // Payment phase
      const paymentResult = await this.processPayment({
        orderId: orderCommand.orderId,
        amount: 100.0,
        method: 'credit-card',
      });

      if (paymentResult.isFailure()) {
        // Automatically logged with phase context
        return Result.fail(
          new BusinessError('Payment processing failed', 'PAYMENT_FAILED', {
            orderId: orderCommand.orderId,
            reason: paymentResult.error.message,
          })
        );
      }

      // Success - automatically logged
      const order: OrderData = {
        id: orderCommand.orderId,
        customerId: 'customer-123',
        items: [],
        totalAmount: 100.0,
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return Result.success(order);
    });
  }

  // ✅ FOCUS: Result chain with logging at each step
  async completeOrderProcessing(
    orderId: string
  ): Promise<Result<OrderData, Error>> {
    const chainLogger = this.logger.withContext({
      operation: 'completeOrderProcessing',
      orderId,
    });

    // Step 1: Load order
    const loadResult = await this.loadOrder(orderId);
    if (loadResult.isFailure()) {
      chainLogger.error('Failed to load order', {
        step: 'loadOrder',
        error: loadResult.error,
      });
      return loadResult;
    }

    chainLogger.debug('Order loaded successfully', {
      step: 'loadOrder',
      orderStatus: loadResult.value.status,
    });

    // Step 2: Check inventory
    const inventoryResult = await this.checkInventory(loadResult.value.items);
    if (inventoryResult.isFailure()) {
      chainLogger.error('Inventory check failed', {
        step: 'checkInventory',
        error: inventoryResult.error,
        itemCount: loadResult.value.items.length,
      });
      return Result.fail(inventoryResult.error);
    }

    chainLogger.info('Inventory verified', {
      step: 'checkInventory',
      availableItems: inventoryResult.value.length,
    });

    // Step 3: Process shipment
    const shipmentResult = await this.processShipment(loadResult.value);
    if (shipmentResult.isFailure()) {
      chainLogger.error('Shipment processing failed', {
        step: 'processShipment',
        error: shipmentResult.error,
      });
      return Result.fail(shipmentResult.error);
    }

    // Success - log completion
    const completedOrder = {
      ...loadResult.value,
      status: 'shipped' as const,
      shippedAt: new Date(),
    };

    chainLogger.info('Order processing completed successfully', {
      orderId: completedOrder.id,
      totalSteps: 3,
      finalStatus: completedOrder.status,
      processingTime: Date.now() - loadResult.value.createdAt.getTime(),
    });

    return Result.success(completedOrder);
  }

  // ✅ FOCUS: withLogging decorator for automatic Result logging
  @withLogging({
    operationName: 'updateUserPreferences',
    logLevel: 'info',
    includeArgs: true,
    includeResult: true,
    maskSensitiveData: true,
  })
  async updateUserPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<Result<UserData, Error>> {
    // ⭐ FOCUS: Method automatically logged by decorator

    // Validate user exists
    const user = await this.findUserById(userId);
    if (!user) {
      return Result.fail(
        new BusinessError('User not found', 'USER_NOT_FOUND', { userId })
      );
    }

    // Update preferences
    const updatedUser: UserData = {
      ...user,
      preferences: { ...user.preferences, ...preferences },
      updatedAt: new Date(),
    };

    // Return result - success/failure automatically logged
    return Result.success(updatedUser);
  }

  // ✅ FOCUS: Combining multiple Results with aggregate logging
  async bulkProcessOrders(
    orderIds: string[]
  ): Promise<Result<{ successful: string[]; failed: string[] }, Error>> {
    const bulkLogger = this.logger.withContext({
      operation: 'bulkProcessOrders',
      totalOrders: orderIds.length,
    });

    bulkLogger.info('Starting bulk order processing', {
      orderCount: orderIds.length,
    });

    const results = await Promise.all(
      orderIds.map(async orderId => {
        const result = await this.processOrderWithResultLogger({
          orderId,
          processingNotes: 'Bulk processing',
        });

        // Log individual result
        if (result.isSuccess()) {
          bulkLogger.debug('Order processed successfully', { orderId });
        } else {
          bulkLogger.warn('Order processing failed', {
            orderId,
            error: result.error.message,
          });
        }

        return { orderId, result };
      })
    );

    // Aggregate results
    const successful = results
      .filter(r => r.result.isSuccess())
      .map(r => r.orderId);

    const failed = results
      .filter(r => r.result.isFailure())
      .map(r => r.orderId);

    // ⭐ FOCUS: Log aggregate results
    bulkLogger.info('Bulk processing completed', {
      totalProcessed: orderIds.length,
      successCount: successful.length,
      failureCount: failed.length,
      successRate:
        ((successful.length / orderIds.length) * 100).toFixed(2) + '%',
    });

    if (failed.length > 0) {
      bulkLogger.warn('Some orders failed processing', {
        failedOrderIds: failed,
      });
    }

    return Result.success({ successful, failed });
  }

  // ✅ FOCUS: Custom Result logging patterns
  async executeWithDetailedLogging<T>(
    operation: string,
    context: Record<string, any>,
    fn: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    const operationId = `op-${Date.now()}`;
    const operationLogger = this.logger.withContext({
      operationId,
      operation,
      ...context,
    });

    // Log operation start
    operationLogger.info(`Starting operation: ${operation}`, {
      context,
      timestamp: new Date(),
    });

    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      if (result.isSuccess()) {
        // ⭐ FOCUS: Detailed success logging
        operationLogger.info(`Operation succeeded: ${operation}`, {
          operationId,
          duration,
          resultType: result.value?.constructor?.name || 'unknown',
          hasValue: result.value !== null && result.value !== undefined,
        });
      } else {
        // ⭐ FOCUS: Detailed failure logging
        operationLogger.error(`Operation failed: ${operation}`, {
          operationId,
          duration,
          errorType: result.error.constructor.name,
          errorMessage: result.error.message,
          errorCode: (result.error as any).code,
          errorDetails: (result.error as any).details,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // ⭐ FOCUS: Unexpected error logging
      operationLogger.error(`Operation crashed: ${operation}`, {
        operationId,
        duration,
        error: error,
        errorType: 'UnexpectedException',
      });

      return Result.fail(error as Error);
    }
  }

  // ✅ FOCUS: Result pattern with performance tracking
  async performOperationWithMetrics<T>(
    operation: string,
    fn: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    const metricsLogger = this.logger.withContext({
      operation,
      metrics: true,
    });

    const metrics = {
      startTime: Date.now(),
      memoryBefore: process.memoryUsage().heapUsed,
      operation,
    };

    const result = await fn();

    const endMetrics = {
      duration: Date.now() - metrics.startTime,
      memoryAfter: process.memoryUsage().heapUsed,
      memoryDelta: process.memoryUsage().heapUsed - metrics.memoryBefore,
      success: result.isSuccess(),
    };

    // ⭐ FOCUS: Log performance metrics with result
    metricsLogger.info('Operation completed with metrics', {
      operation,
      duration: endMetrics.duration,
      memoryUsed: `${(endMetrics.memoryDelta / 1024 / 1024).toFixed(2)} MB`,
      success: endMetrics.success,
      performanceCategory: this.categorizePerformance(endMetrics.duration),
    });

    return result;
  }

  // Helper methods
  private async validateOrder(
    orderId: string
  ): Promise<Result<boolean, Error>> {
    if (!orderId || orderId.length < 5) {
      return Result.fail(
        new ValidationError('Invalid order ID', 'orderId', orderId)
      );
    }
    return Result.success(true);
  }

  private async processPayment(
    payment: PaymentData
  ): Promise<Result<PaymentData, Error>> {
    // Simulate payment processing
    if (Math.random() > 0.8) {
      return Result.fail(
        new BusinessError('Payment declined', 'PAYMENT_DECLINED')
      );
    }
    return Result.success(payment);
  }

  private async loadOrder(orderId: string): Promise<Result<OrderData, Error>> {
    // Simulate order loading
    if (orderId === 'not-found') {
      return Result.fail(
        new BusinessError('Order not found', 'ORDER_NOT_FOUND')
      );
    }

    const order: OrderData = {
      id: orderId,
      customerId: 'customer-123',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          name: 'Product 1',
          quantity: 2,
          price: 50,
        },
      ],
      totalAmount: 100,
      status: 'pending',
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      updatedAt: new Date(),
    };

    return Result.success(order);
  }

  private async checkInventory(
    items: any[]
  ): Promise<Result<InventoryItem[], Error>> {
    // Simulate inventory check
    if (items.length === 0) {
      return Result.fail(new BusinessError('No items to check', 'EMPTY_ORDER'));
    }

    const inventory: InventoryItem[] = items.map(item => ({
      productId: item.productId,
      available: 10,
      reserved: 2,
      location: 'Warehouse A',
    }));

    return Result.success(inventory);
  }

  private async processShipment(
    order: OrderData
  ): Promise<Result<string, Error>> {
    // Simulate shipment processing
    return Result.success(`SHIP-${order.id}-${Date.now()}`);
  }

  private async findUserById(userId: string): Promise<UserData | null> {
    if (userId === 'not-found') return null;

    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
      preferences: {},
    };
  }

  private categorizePerformance(durationMs: number): string {
    if (durationMs < 100) return 'excellent';
    if (durationMs < 500) return 'good';
    if (durationMs < 1000) return 'acceptable';
    if (durationMs < 5000) return 'slow';
    return 'critical';
  }
}

// ✅ FOCUS: ResultLogger utility class
export class EnhancedResultLogger extends ResultLogger {
  constructor(logger: Logger, context: Record<string, any>) {
    super(logger, context);
  }

  // Override to add custom behavior
  protected onSuccess<T>(value: T, duration: number): void {
    super.onSuccess(value, duration);

    // Add custom success metrics
    this.logger.info('Result success metrics', {
      valueType: value?.constructor?.name || 'unknown',
      processingTime: duration,
      timestamp: new Date(),
    });
  }

  protected onFailure(error: Error, duration: number): void {
    super.onFailure(error, duration);

    // Add custom failure analysis
    this.logger.error('Result failure analysis', {
      errorType: error.constructor.name,
      errorCode: (error as any).code,
      processingTime: duration,
      stackTrace: error.stack,
      timestamp: new Date(),
    });
  }
}

// ✅ FOCUS: Functional approach with Result logging
export const withResultLogging = <T, E extends Error>(
  logger: Logger,
  operation: string
) => {
  return (fn: () => Promise<Result<T, E>>): Promise<Result<T, E>> => {
    return async () => {
      const contextLogger = logger.withContext({ operation });

      contextLogger.debug(`Starting operation: ${operation}`);

      const result = await fn();

      if (result.isSuccess()) {
        contextLogger.info(`Operation succeeded: ${operation}`);
      } else {
        contextLogger.error(`Operation failed: ${operation}`, {
          error: result.error,
        });
      }

      return result;
    };
  };
};
```

## Usage Examples

```typescript
// Initialize the logging service
const resultLogging = new ResultPatternLogging();

// Example 1: Basic Result logging
const userResult = await resultLogging.createUserWithLogging({
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'admin',
});

if (userResult.isFailure()) {
  console.error('User creation failed:', userResult.error.message);
  // Error already logged with context
}

// Example 2: Using ResultLogger
const orderResult = await resultLogging.processOrderWithResultLogger({
  orderId: 'order-789',
  processingNotes: 'Express shipping',
});

// Automatic logging of success/failure with context

// Example 3: Chain operations with logging
const completionResult =
  await resultLogging.completeOrderProcessing('order-123');

if (completionResult.isSuccess()) {
  console.log('Order shipped:', completionResult.value.status);
}

// Example 4: Bulk operations with aggregate logging
const bulkResult = await resultLogging.bulkProcessOrders([
  'order-1',
  'order-2',
  'order-3',
  'order-4',
  'order-5',
]);

if (bulkResult.isSuccess()) {
  console.log('Successful orders:', bulkResult.value.successful);
  console.log('Failed orders:', bulkResult.value.failed);
}

// Example 5: Custom operation logging
const customResult = await resultLogging.executeWithDetailedLogging(
  'complexCalculation',
  { userId: 'user-123', type: 'financial' },
  async () => {
    // Complex business logic
    const result = await performComplexCalculation();
    return result > 0
      ? Result.success(result)
      : Result.fail(new BusinessError('Calculation failed', 'CALC_ERROR'));
  }
);

// Example 6: Performance tracking
const metricsResult = await resultLogging.performOperationWithMetrics(
  'dataProcessing',
  async () => {
    // Heavy data processing
    const processed = await processLargeDataset();
    return Result.success(processed);
  }
);

// Example 7: Using functional approach
const logger = Logger.forContext();
const loggedOperation = withResultLogging(logger, 'validatePayment');

const validationResult = await loggedOperation(async () => {
  const isValid = await validatePaymentMethod('credit-card');
  return isValid
    ? Result.success(true)
    : Result.fail(new ValidationError('Invalid payment method'));
});

// Example 8: Using enhanced ResultLogger
const enhancedLogger = new EnhancedResultLogger(Logger.forContext(), {
  service: 'payment',
  region: 'us-east-1',
});

const enhancedResult = await enhancedLogger.execute(async () => {
  // Business operation with enhanced logging
  return await processPaymentWithEnhancedTracking();
});
```

## Log Output Examples

```json
// Success logging
{
  "level": "info",
  "message": "User created successfully",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "context": {
    "className": "ResultPatternLogging",
    "methodName": "createUserWithLogging",
    "operation": "createUser",
    "userEmail": "j***@example.com"
  },
  "data": {
    "userId": "user-1234567890",
    "role": "admin",
    "hasPreferences": false
  }
}

// Failure logging
{
  "level": "error",
  "message": "Operation failed: processOrder",
  "timestamp": "2024-01-20T10:30:01.000Z",
  "context": {
    "operationId": "op-1234567890",
    "operation": "processOrder",
    "orderId": "order-789"
  },
  "data": {
    "duration": 250,
    "errorType": "BusinessError",
    "errorMessage": "Payment processing failed",
    "errorCode": "PAYMENT_FAILED",
    "errorDetails": {
      "orderId": "order-789",
      "reason": "Insufficient funds"
    }
  }
}

// Performance metrics logging
{
  "level": "info",
  "message": "Operation completed with metrics",
  "timestamp": "2024-01-20T10:30:02.000Z",
  "context": {
    "operation": "dataProcessing",
    "metrics": true
  },
  "data": {
    "operation": "dataProcessing",
    "duration": 3456,
    "memoryUsed": "12.45 MB",
    "success": true,
    "performanceCategory": "slow"
  }
}
```

## Key Features

- **Automatic Success/Failure Logging**: Log Result outcomes without cluttering
  business logic
- **Context Preservation**: Maintain operation context throughout Result chains
- **Error Details Capture**: Comprehensive error information for debugging
- **Performance Tracking**: Built-in duration and memory usage tracking
- **Bulk Operation Support**: Aggregate logging for batch processing
- **Flexible Integration**: Decorators, utilities, and functional approaches
- **Type Safety**: Full TypeScript support with Result<T, E> types

## Best Practices

- Use `ResultLogger` for operations that need detailed tracking
- Add operation context early and maintain it through chains
- Log at appropriate levels (error for failures, info for success, debug for
  details)
- Include business context in error logging for better debugging
- Use performance tracking for critical operations
- Implement bulk logging for batch operations to avoid log spam

## Common Pitfalls

- **Over-logging Result Details**: Don't log entire Result values if they
  contain large data
- **Missing Context**: Always provide operation context for meaningful logs
- **Ignoring Performance**: Track duration for operations that might be slow
- **Duplicate Logging**: Avoid logging the same failure at multiple levels
- **Sensitive Data**: Ensure Result values don't expose sensitive information

## Related Examples

- [Basic Logger Setup](./example-1.md)
- [CQRS Integration Logging](./example-2.md)
- [NestJS Service Integration](../frameworks/nestjs/basic/example-2.md)
