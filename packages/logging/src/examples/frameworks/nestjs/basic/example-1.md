# NestJS Basic Manual Setup

**Version**: 1.0.0 **Package**: @vytches-ddd/logging + NestJS **Complexity**:
basic **Framework**: NestJS **Integration**: Manual setup with standard NestJS
DI **Dependencies**: @nestjs/common, @vytches-ddd/logging

## Description

Basic NestJS integration with manual logger setup using standard NestJS
dependency injection patterns. This example demonstrates simple logging
integration for NestJS applications without complex configurations, focusing on
practical usage patterns for basic applications.

## Business Context

NestJS applications need structured logging that integrates seamlessly with the
framework's architecture. Manual setup provides full control over logger
configuration while maintaining simplicity for basic use cases. This approach
works well for small to medium applications with straightforward logging
requirements.

## Code Example

```typescript
// logging.service.ts - NestJS service wrapper
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Logger, LoggerConfiguration } from '@vytches-ddd/logging';
import {
  UserData,
  OrderData,
  CreateUserRequest,
  ProcessOrderRequest,
} from './types'; // From your app

@Injectable()
export class LoggingService implements OnModuleInit {
  private logger: Logger;

  async onModuleInit() {
    // ⭐ FOCUS: Manual logger initialization
    const config: LoggerConfiguration = {
      level: process.env.LOG_LEVEL || 'info',
      enableConsoleOutput: true,
      enableFileOutput: process.env.NODE_ENV === 'production',

      // Automatic context detection
      contextDetection: {
        enabled: true,
        stackTraceAnalysis: true,
        boundedContextDetection: true,
      },

      // Data masking for sensitive information
      masking: {
        enabled: true,
        sensitiveKeys: [
          'password',
          'apiKey',
          'token',
          'secret',
          'cardNumber',
          'ssn',
        ],
        replacement: '[MASKED]',
        customMaskers: {
          email: (email: string) => {
            const [local, domain] = email.split('@');
            return `${local[0]}***@${domain}`;
          },
        },
      },

      formatting: {
        colorize: process.env.NODE_ENV !== 'production',
        timestamp: true,
        prettyPrint: process.env.NODE_ENV === 'development',
      },
    };

    // Initialize global logger configuration
    Logger.configure(config);
    this.logger = Logger.forContext('LoggingService');

    this.logger.info('Logging service initialized', {
      environment: process.env.NODE_ENV,
      logLevel: config.level,
    });
  }

  // ⭐ FOCUS: Create contextual loggers for services
  createServiceLogger(serviceName: string): Logger {
    return Logger.forContext(serviceName);
  }

  // ⭐ FOCUS: Create operation-specific logger
  createOperationLogger(
    operation: string,
    context: Record<string, any>
  ): Logger {
    return Logger.forContext().withContext({
      operation,
      ...context,
    });
  }

  // ⭐ FOCUS: Log application events
  logApplicationEvent(event: string, data: Record<string, any>): void {
    this.logger.info(`Application event: ${event}`, {
      event,
      data,
      timestamp: new Date(),
    });
  }

  // ⭐ FOCUS: Log errors with context
  logError(error: Error, context?: Record<string, any>): void {
    this.logger.error('Application error', {
      error: error,
      message: error.message,
      stack: error.stack,
      context: context || {},
      timestamp: new Date(),
    });
  }
}

// user.service.ts - Example service using logging
@Injectable()
export class UserService implements OnModuleInit {
  private logger: Logger;

  constructor(private readonly loggingService: LoggingService) {}

  onModuleInit() {
    // ⭐ FOCUS: Get service-specific logger
    this.logger = this.loggingService.createServiceLogger('UserService');
  }

  async createUser(createUserDto: CreateUserRequest): Promise<UserData> {
    // ⭐ FOCUS: Create operation logger with context
    const operationLogger = this.loggingService.createOperationLogger(
      'createUser',
      {
        email: createUserDto.email, // Will be masked
      }
    );

    operationLogger.info('Creating new user', {
      email: createUserDto.email, // Automatically masked
      role: createUserDto.role,
    });

    try {
      // Validate user data
      await this.validateCreateUserRequest(createUserDto);

      // Create user in database
      const user = await this.saveUser(createUserDto);

      // ⭐ FOCUS: Log success with business context
      operationLogger.info('User created successfully', {
        userId: user.id,
        email: user.email, // Masked
        role: user.role,
        isActive: user.isActive,
      });

      // Log application event
      this.loggingService.logApplicationEvent('UserCreated', {
        userId: user.id,
        role: user.role,
      });

      return user;
    } catch (error) {
      // ⭐ FOCUS: Log error with operation context
      this.loggingService.logError(error as Error, {
        operation: 'createUser',
        email: createUserDto.email, // Masked
        role: createUserDto.role,
      });

      throw error;
    }
  }

  async findUserById(id: string): Promise<UserData | null> {
    this.logger.debug('Finding user by ID', { userId: id });

    try {
      const user = await this.loadUserFromDatabase(id);

      if (!user) {
        this.logger.warn('User not found', { userId: id });
        return null;
      }

      this.logger.debug('User found', {
        userId: user.id,
        email: user.email, // Masked
        isActive: user.isActive,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to find user', {
        userId: id,
        error: error,
      });
      throw error;
    }
  }

  async updateUser(
    id: string,
    updateData: Partial<CreateUserRequest>
  ): Promise<UserData> {
    const updateLogger = this.logger.withContext({
      operation: 'updateUser',
      userId: id,
    });

    updateLogger.info('Updating user', {
      userId: id,
      fieldsToUpdate: Object.keys(updateData),
    });

    try {
      const existingUser = await this.findUserById(id);
      if (!existingUser) {
        throw new Error(`User with ID ${id} not found`);
      }

      const updatedUser = await this.updateUserInDatabase(id, updateData);

      updateLogger.info('User updated successfully', {
        userId: updatedUser.id,
        updatedFields: Object.keys(updateData),
        email: updatedUser.email, // Masked
      });

      return updatedUser;
    } catch (error) {
      updateLogger.error('User update failed', {
        userId: id,
        error: error,
        updateData: updateData,
      });
      throw error;
    }
  }

  // Private helper methods
  private async validateCreateUserRequest(
    request: CreateUserRequest
  ): Promise<void> {
    if (!request.email || !request.email.includes('@')) {
      throw new Error('Valid email is required');
    }

    if (!request.name || request.name.length < 2) {
      throw new Error('Name must be at least 2 characters');
    }

    this.logger.debug('User request validated', {
      email: request.email, // Masked
    });
  }

  private async saveUser(request: CreateUserRequest): Promise<UserData> {
    // Simulate user creation
    const user: UserData = {
      id: `user-${Date.now()}`,
      name: request.name,
      email: request.email,
      role: request.role,
      createdAt: new Date(),
      isActive: true,
    };

    this.logger.debug('User saved to database', {
      userId: user.id,
      email: user.email, // Masked
    });

    return user;
  }

  private async loadUserFromDatabase(id: string): Promise<UserData | null> {
    // Simulate database lookup
    if (id === 'user-not-found') {
      return null;
    }

    return {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      createdAt: new Date(),
      isActive: true,
    };
  }

  private async updateUserInDatabase(
    id: string,
    updateData: Partial<CreateUserRequest>
  ): Promise<UserData> {
    // Simulate user update
    const existingUser = await this.loadUserFromDatabase(id);

    return {
      ...existingUser!,
      ...updateData,
      updatedAt: new Date(),
    };
  }
}

// order.service.ts - Another service example
@Injectable()
export class OrderService implements OnModuleInit {
  private logger: Logger;

  constructor(private readonly loggingService: LoggingService) {}

  onModuleInit() {
    this.logger = this.loggingService.createServiceLogger('OrderService');
  }

  async processOrder(orderRequest: ProcessOrderRequest): Promise<OrderData> {
    const operationLogger = this.loggingService.createOperationLogger(
      'processOrder',
      {
        customerId: orderRequest.customerId,
        itemCount: orderRequest.items.length,
      }
    );

    // ⭐ FOCUS: Log order processing start
    operationLogger.info('Starting order processing', {
      customerId: orderRequest.customerId,
      itemCount: orderRequest.items.length,
      totalAmount: orderRequest.totalAmount,
      paymentMethod: orderRequest.paymentMethod,
    });

    const startTime = Date.now();

    try {
      // Step 1: Validate order
      await this.validateOrder(orderRequest);
      operationLogger.debug('Order validation completed');

      // Step 2: Check inventory
      await this.checkInventory(orderRequest.items);
      operationLogger.debug('Inventory check completed');

      // Step 3: Process payment
      const paymentResult = await this.processPayment(orderRequest);
      operationLogger.info('Payment processed', {
        transactionId: paymentResult.transactionId,
        amount: paymentResult.amount,
      });

      // Step 4: Create order
      const order = await this.createOrder(orderRequest, paymentResult);
      const processingTime = Date.now() - startTime;

      // ⭐ FOCUS: Log successful order processing
      operationLogger.info('Order processed successfully', {
        orderId: order.id,
        customerId: order.customerId,
        status: order.status,
        totalAmount: order.totalAmount,
        processingTime,
        itemCount: order.items.length,
      });

      // Log business event
      this.loggingService.logApplicationEvent('OrderProcessed', {
        orderId: order.id,
        customerId: order.customerId,
        amount: order.totalAmount,
      });

      return order;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // ⭐ FOCUS: Log order processing failure
      this.loggingService.logError(error as Error, {
        operation: 'processOrder',
        customerId: orderRequest.customerId,
        processingTime,
        stage: this.determineFailureStage(error as Error),
      });

      throw error;
    }
  }

  private async validateOrder(
    orderRequest: ProcessOrderRequest
  ): Promise<void> {
    if (!orderRequest.items || orderRequest.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (orderRequest.totalAmount <= 0) {
      throw new Error('Order total must be greater than zero');
    }
  }

  private async checkInventory(items: any[]): Promise<void> {
    // Simulate inventory check
    this.logger.debug(`Checking inventory for ${items.length} items`);

    for (const item of items) {
      if (Math.random() > 0.95) {
        // 5% chance of out of stock
        throw new Error(`Item ${item.productId} is out of stock`);
      }
    }
  }

  private async processPayment(
    orderRequest: ProcessOrderRequest
  ): Promise<any> {
    this.logger.info('Processing payment', {
      amount: orderRequest.totalAmount,
      method: orderRequest.paymentMethod,
    });

    // Simulate payment processing
    if (Math.random() > 0.9) {
      // 10% payment failure rate
      throw new Error('Payment processing failed');
    }

    return {
      transactionId: `txn-${Date.now()}`,
      amount: orderRequest.totalAmount,
      status: 'completed',
    };
  }

  private async createOrder(
    orderRequest: ProcessOrderRequest,
    paymentResult: any
  ): Promise<OrderData> {
    const order: OrderData = {
      id: `order-${Date.now()}`,
      customerId: orderRequest.customerId,
      items: orderRequest.items.map(item => ({
        id: `item-${Date.now()}-${item.productId}`,
        productId: item.productId,
        name: `Product ${item.productId}`,
        quantity: item.quantity,
        price: item.price || 10.0,
      })),
      totalAmount: orderRequest.totalAmount,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentInfo: {
        transactionId: paymentResult.transactionId,
        method: orderRequest.paymentMethod,
        status: paymentResult.status,
      },
    };

    this.logger.debug('Order created in database', {
      orderId: order.id,
      itemCount: order.items.length,
    });

    return order;
  }

  private determineFailureStage(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('item') || message.includes('total'))
      return 'validation';
    if (message.includes('stock') || message.includes('inventory'))
      return 'inventory';
    if (message.includes('payment')) return 'payment';
    return 'unknown';
  }
}

// app.module.ts - Module configuration
import { Module } from '@nestjs/common';
import { LoggingService } from './logging/logging.service';
import { UserService } from './user/user.service';
import { OrderService } from './order/order.service';
import { AppController } from './app.controller';

@Module({
  providers: [
    LoggingService, // ⭐ FOCUS: Register logging service first
    UserService,
    OrderService,
  ],
  controllers: [AppController],
  exports: [LoggingService],
})
export class AppModule {}

// app.controller.ts - Controller using logged services
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UserService } from './user/user.service';
import { OrderService } from './order/order.service';
import { LoggingService } from './logging/logging.service';
import { CreateUserRequest, ProcessOrderRequest, ApiResponse } from './types';

@Controller('api')
export class AppController {
  private logger: Logger;

  constructor(
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly loggingService: LoggingService
  ) {
    this.logger = this.loggingService.createServiceLogger('AppController');
  }

  @Post('users')
  async createUser(
    @Body() createUserDto: CreateUserRequest
  ): Promise<ApiResponse<UserData>> {
    try {
      // ⭐ FOCUS: Log API request
      this.logger.info('Create user API request', {
        endpoint: 'POST /api/users',
        email: createUserDto.email, // Masked
        role: createUserDto.role,
      });

      const user = await this.userService.createUser(createUserDto);

      return {
        success: true,
        data: user,
        message: 'User created successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      // ⭐ FOCUS: Log API error
      this.logger.error('Create user API failed', {
        endpoint: 'POST /api/users',
        error: error,
        requestData: createUserDto,
      });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  @Get('users/:id')
  async getUser(
    @Param('id') id: string
  ): Promise<ApiResponse<UserData | null>> {
    try {
      this.logger.debug('Get user API request', {
        endpoint: `GET /api/users/${id}`,
        userId: id,
      });

      const user = await this.userService.findUserById(id);

      return {
        success: true,
        data: user,
        message: user ? 'User found' : 'User not found',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Get user API failed', {
        endpoint: `GET /api/users/${id}`,
        userId: id,
        error: error,
      });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  @Post('orders')
  async processOrder(
    @Body() processOrderDto: ProcessOrderRequest
  ): Promise<ApiResponse<OrderData>> {
    try {
      this.logger.info('Process order API request', {
        endpoint: 'POST /api/orders',
        customerId: processOrderDto.customerId,
        totalAmount: processOrderDto.totalAmount,
        itemCount: processOrderDto.items.length,
      });

      const order = await this.orderService.processOrder(processOrderDto);

      return {
        success: true,
        data: order,
        message: 'Order processed successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Process order API failed', {
        endpoint: 'POST /api/orders',
        customerId: processOrderDto.customerId,
        error: error,
      });

      return {
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    this.logger.debug('Health check requested');

    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }
}
```

## Usage Examples

```typescript
// main.ts - Application bootstrap
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // App will automatically initialize logging through LoggingService
  await app.listen(3000);

  console.log('Application is running on http://localhost:3000');
}

bootstrap();

// Example API calls that will generate logs:

// POST /api/users
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "admin"
}

// GET /api/users/user-123

// POST /api/orders
{
  "customerId": "customer-456",
  "items": [
    { "productId": "prod-1", "quantity": 2, "price": 25.00 },
    { "productId": "prod-2", "quantity": 1, "price": 50.00 }
  ],
  "totalAmount": 100.00,
  "paymentMethod": "credit-card"
}
```

## Key Features

- **Simple Manual Setup**: No complex configuration, just manual logger
  initialization
- **NestJS Integration**: Uses standard NestJS dependency injection patterns
- **Service-Specific Loggers**: Each service gets its own contextual logger
- **Operation Logging**: Track business operations with relevant context
- **Error Handling**: Centralized error logging with context preservation
- **API Request Logging**: Controller-level request/response logging
- **Application Events**: Business event logging for important actions
- **Automatic Data Masking**: Sensitive information automatically protected

## Configuration Options

```typescript
// Custom configuration for different environments
const createConfig = (environment: string): LoggerConfiguration => ({
  level: environment === 'development' ? 'debug' : 'info',
  enableConsoleOutput: true,
  enableFileOutput: environment === 'production',

  masking: {
    enabled: true,
    sensitiveKeys:
      environment === 'production'
        ? [
            'password',
            'apiKey',
            'token',
            'secret',
            'cardNumber',
            'ssn',
            'email',
          ]
        : ['password', 'apiKey', 'token', 'secret'], // Less aggressive in dev
    replacement: '[MASKED]',
  },

  formatting: {
    colorize: environment === 'development',
    prettyPrint: environment === 'development',
    timestamp: true,
  },
});
```

## Best Practices

- Initialize `LoggingService` first in module providers array
- Use `createServiceLogger()` for service-specific logging contexts
- Use `createOperationLogger()` for tracking business operations
- Log both successful operations and failures at appropriate levels
- Include relevant business context (user IDs, order IDs, etc.) in logs
- Use structured logging with objects rather than string concatenation
- Handle errors consistently across all services

## Common Pitfalls

- **Late Initialization**: Make sure LoggingService is available before other
  services use it
- **Missing Context**: Always include relevant business context in log entries
- **Wrong Log Levels**: Use debug for development details, info for business
  events, error for failures
- **Sensitive Data**: Ensure masking configuration covers all sensitive fields
- **Performance**: Avoid expensive operations in debug level logs in production

## Related Examples

- [NestJS Service Integration](./example-2.md)
- [NestJS Advanced DI Integration](../intermediate/example-1.md)
- [Basic Logger Setup](../../basic/example-1.md)
