# NestJS Multi-Context Architecture - Advanced Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: advanced  
**Domain**: Enterprise Multi-Context Platform  
**Patterns**: Multi-Context Architecture, Context Isolation, Enterprise
Integration  
**Dependencies**: @vytches-ddd/di, @nestjs/common, @nestjs/microservices

## Description

This example demonstrates enterprise-grade multi-context architecture using
VytchesDDD with NestJS. It shows how to implement proper bounded context
isolation, cross-context communication, and complex enterprise integration
patterns in a production-ready system.

## Business Context

Large enterprise applications require strict bounded context isolation to
prevent coupling between different business domains. This example shows how to
implement a multi-context e-commerce platform with separate contexts for User
Management, Order Processing, and Payment Processing, each with its own services
and data models.

## Code Example

```typescript
// contexts/user-management/user-management.context.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { User, CreateUserData, UpdateUserData } from '../../types'; // Import from application

/**
 * User Management bounded context
 */
@DomainService({
  serviceId: 'userManagementService',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  autoRegister: true,
})
export class UserManagementService {
  private users: Map<string, User> = new Map();

  /**
   * Creates user within User Management context
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // ⭐ FOCUS: Context-specific user creation
    console.log(`UserManagement: Creating user ${userData.email}`);

    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);

    // Publish domain event within context
    await this.publishUserCreatedEvent(user);

    console.log(`UserManagement: Created user ${user.id}`);
    return user;
  }

  /**
   * Updates user within context
   */
  async updateUser(userId: string, updateData: UpdateUserData): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error(`User not found in UserManagement context: ${userId}`);
    }

    const updatedUser = {
      ...existingUser,
      ...updateData,
      updatedAt: new Date(),
    };

    this.users.set(userId, updatedUser);

    await this.publishUserUpdatedEvent(updatedUser);

    console.log(`UserManagement: Updated user ${userId}`);
    return updatedUser;
  }

  /**
   * Gets user by ID within context
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (user) {
      console.log(`UserManagement: Retrieved user ${userId}`);
    }
    return user || null;
  }

  /**
   * Validates user exists (cross-context query)
   */
  async validateUserExists(userId: string): Promise<boolean> {
    const exists = this.users.has(userId);
    console.log(`UserManagement: User ${userId} exists: ${exists}`);
    return exists;
  }

  private generateUserId(): string {
    return `um_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async publishUserCreatedEvent(user: User): Promise<void> {
    console.log(`UserManagement: Publishing UserCreated event for ${user.id}`);
    // Event publishing logic
  }

  private async publishUserUpdatedEvent(user: User): Promise<void> {
    console.log(`UserManagement: Publishing UserUpdated event for ${user.id}`);
    // Event publishing logic
  }
}
```

```typescript
// contexts/order-processing/order-processing.context.ts
import { DomainService, ServiceLifetime, VytchesDDD } from '@vytches-ddd/di';
import { Order, CreateOrderData, OrderStatus } from '../../types'; // Import from application

/**
 * Order Processing bounded context
 */
@DomainService({
  serviceId: 'orderProcessingService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderProcessing',
  autoRegister: true,
})
export class OrderProcessingService {
  private orders: Map<string, Order> = new Map();

  /**
   * Creates order within Order Processing context
   */
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // ⭐ FOCUS: Context-specific order creation with cross-context validation
    console.log(`OrderProcessing: Creating order for user ${orderData.userId}`);

    // Cross-context validation (through service interface)
    await this.validateUserExists(orderData.userId);

    const order: Order = {
      id: this.generateOrderId(),
      userId: orderData.userId,
      items: orderData.items.map(item => ({
        ...item,
        id: this.generateItemId(),
      })),
      total: this.calculateTotal(orderData.items),
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);

    // Publish domain event within context
    await this.publishOrderCreatedEvent(order);

    console.log(`OrderProcessing: Created order ${order.id}`);
    return order;
  }

  /**
   * Updates order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<Order> {
    const existingOrder = this.orders.get(orderId);
    if (!existingOrder) {
      throw new Error(`Order not found in OrderProcessing context: ${orderId}`);
    }

    const updatedOrder = {
      ...existingOrder,
      status,
      updatedAt: new Date(),
    };

    this.orders.set(orderId, updatedOrder);

    await this.publishOrderStatusUpdatedEvent(updatedOrder);

    console.log(
      `OrderProcessing: Updated order ${orderId} status to ${status}`
    );
    return updatedOrder;
  }

  /**
   * Gets order by ID within context
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (order) {
      console.log(`OrderProcessing: Retrieved order ${orderId}`);
    }
    return order || null;
  }

  /**
   * Gets orders by user ID
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    const orders = Array.from(this.orders.values()).filter(
      order => order.userId === userId
    );
    console.log(
      `OrderProcessing: Retrieved ${orders.length} orders for user ${userId}`
    );
    return orders;
  }

  private async validateUserExists(userId: string): Promise<void> {
    // ⭐ FOCUS: Cross-context validation through service interface
    try {
      // This would typically be done through events or API calls
      // For demo, we'll use a simplified approach
      console.log(`OrderProcessing: Validating user ${userId} exists`);
      // Assume validation passes
    } catch (error) {
      throw new Error(`User validation failed: ${userId}`);
    }
  }

  private generateOrderId(): string {
    return `op_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateItemId(): string {
    return `op_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotal(
    items: Array<{ quantity: number; price: number }>
  ): number {
    return items.reduce((total, item) => total + item.quantity * item.price, 0);
  }

  private async publishOrderCreatedEvent(order: Order): Promise<void> {
    console.log(
      `OrderProcessing: Publishing OrderCreated event for ${order.id}`
    );
  }

  private async publishOrderStatusUpdatedEvent(order: Order): Promise<void> {
    console.log(
      `OrderProcessing: Publishing OrderStatusUpdated event for ${order.id}`
    );
  }
}
```

```typescript
// contexts/payment-processing/payment-processing.context.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Payment, ProcessPaymentData, PaymentStatus } from '../../types'; // Import from application

/**
 * Payment Processing bounded context
 */
@DomainService({
  serviceId: 'paymentProcessingService',
  lifetime: ServiceLifetime.Singleton,
  context: 'PaymentProcessing',
  autoRegister: true,
})
export class PaymentProcessingService {
  private payments: Map<string, Payment> = new Map();

  /**
   * Processes payment within Payment Processing context
   */
  async processPayment(paymentData: ProcessPaymentData): Promise<Payment> {
    // ⭐ FOCUS: Context-specific payment processing
    console.log(
      `PaymentProcessing: Processing payment for order ${paymentData.orderId}`
    );

    // Cross-context validation
    await this.validateOrderExists(paymentData.orderId);

    const payment: Payment = {
      id: this.generatePaymentId(),
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: PaymentStatus.PROCESSING,
      method: paymentData.method,
      createdAt: new Date(),
    };

    // Simulate payment processing
    await this.processWithProvider(payment);

    payment.status = PaymentStatus.COMPLETED;
    payment.processedAt = new Date();

    this.payments.set(payment.id, payment);

    // Publish domain event within context
    await this.publishPaymentProcessedEvent(payment);

    console.log(`PaymentProcessing: Processed payment ${payment.id}`);
    return payment;
  }

  /**
   * Gets payment by ID within context
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const payment = this.payments.get(paymentId);
    if (payment) {
      console.log(`PaymentProcessing: Retrieved payment ${paymentId}`);
    }
    return payment || null;
  }

  /**
   * Gets payments by order ID
   */
  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    const payments = Array.from(this.payments.values()).filter(
      payment => payment.orderId === orderId
    );
    console.log(
      `PaymentProcessing: Retrieved ${payments.length} payments for order ${orderId}`
    );
    return payments;
  }

  private async validateOrderExists(orderId: string): Promise<void> {
    // ⭐ FOCUS: Cross-context validation
    console.log(`PaymentProcessing: Validating order ${orderId} exists`);
    // Assume validation passes
  }

  private async processWithProvider(payment: Payment): Promise<void> {
    console.log(`PaymentProcessing: Processing with external provider`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private generatePaymentId(): string {
    return `pp_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async publishPaymentProcessedEvent(payment: Payment): Promise<void> {
    console.log(
      `PaymentProcessing: Publishing PaymentProcessed event for ${payment.id}`
    );
  }
}
```

```typescript
// context-configuration/context-manager.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';

/**
 * Context manager for multi-context architecture
 */
export class ContextManager {
  private static contexts: Map<string, any> = new Map();

  /**
   * Configures all bounded contexts
   */
  static async configureContexts(): Promise<void> {
    console.log('ContextManager: Configuring bounded contexts...');

    // ⭐ FOCUS: Context-specific container configuration

    // UserManagement context
    const userContainer = new SimpleContainer();
    userContainer.registerInstance('userConfig', {
      maxUsers: 10000,
      enableProfilePictures: true,
      passwordPolicy: 'strong',
    });

    // OrderProcessing context
    const orderContainer = new SimpleContainer();
    orderContainer.registerInstance('orderConfig', {
      maxOrderItems: 100,
      allowBackorders: false,
      autoConfirm: true,
    });

    // PaymentProcessing context
    const paymentContainer = new SimpleContainer();
    paymentContainer.registerInstance('paymentConfig', {
      maxRetries: 3,
      timeout: 30000,
      supportedMethods: ['credit_card', 'paypal', 'bank_transfer'],
    });

    // Configure contexts in VytchesDDD
    await VytchesDDD.configureContext('UserManagement', userContainer);
    await VytchesDDD.configureContext('OrderProcessing', orderContainer);
    await VytchesDDD.configureContext('PaymentProcessing', paymentContainer);

    this.contexts.set('UserManagement', userContainer);
    this.contexts.set('OrderProcessing', orderContainer);
    this.contexts.set('PaymentProcessing', paymentContainer);

    console.log('ContextManager: All contexts configured');
  }

  /**
   * Gets service from specific context
   */
  static getContextService<T>(contextName: string, serviceId: string): T {
    const service = VytchesDDD.resolve<T>(serviceId, contextName);
    if (!service) {
      throw new Error(
        `Service ${serviceId} not found in context ${contextName}`
      );
    }
    return service;
  }

  /**
   * Gets all configured contexts
   */
  static getConfiguredContexts(): string[] {
    return Array.from(this.contexts.keys());
  }
}
```

```typescript
// cross-context/context-integration.service.ts
import { Injectable } from '@nestjs/common';
import { ContextManager } from '../context-configuration/context-manager';
import { UserManagementService } from '../contexts/user-management/user-management.context';
import { OrderProcessingService } from '../contexts/order-processing/order-processing.context';
import { PaymentProcessingService } from '../contexts/payment-processing/payment-processing.context';
import {
  User,
  Order,
  Payment,
  CreateUserData,
  CreateOrderData,
  ProcessPaymentData,
} from '../types'; // Import from application

/**
 * Cross-context integration service
 */
@Injectable()
export class ContextIntegrationService {
  private userManagementService: UserManagementService;
  private orderProcessingService: OrderProcessingService;
  private paymentProcessingService: PaymentProcessingService;

  constructor() {
    // ⭐ FOCUS: Resolve services from different contexts
    this.userManagementService =
      ContextManager.getContextService<UserManagementService>(
        'UserManagement',
        'userManagementService'
      );

    this.orderProcessingService =
      ContextManager.getContextService<OrderProcessingService>(
        'OrderProcessing',
        'orderProcessingService'
      );

    this.paymentProcessingService =
      ContextManager.getContextService<PaymentProcessingService>(
        'PaymentProcessing',
        'paymentProcessingService'
      );
  }

  /**
   * Complete order workflow across contexts
   */
  async completeOrderWorkflow(
    userData: CreateUserData,
    orderData: CreateOrderData,
    paymentData: ProcessPaymentData
  ): Promise<{ user: User; order: Order; payment: Payment }> {
    try {
      // ⭐ FOCUS: Cross-context workflow orchestration
      console.log('ContextIntegration: Starting complete order workflow...');

      // Step 1: Create user in UserManagement context
      const user = await this.userManagementService.createUser(userData);

      // Step 2: Create order in OrderProcessing context
      const orderDataWithUserId = {
        ...orderData,
        userId: user.id,
      };
      const order =
        await this.orderProcessingService.createOrder(orderDataWithUserId);

      // Step 3: Process payment in PaymentProcessing context
      const paymentDataWithOrderId = {
        ...paymentData,
        orderId: order.id,
      };
      const payment = await this.paymentProcessingService.processPayment(
        paymentDataWithOrderId
      );

      // Step 4: Update order status after successful payment
      await this.orderProcessingService.updateOrderStatus(
        order.id,
        'PROCESSING'
      );

      console.log(
        'ContextIntegration: Complete order workflow finished successfully'
      );

      return { user, order, payment };
    } catch (error) {
      console.error(
        'ContextIntegration: Complete order workflow failed:',
        error
      );
      throw error;
    }
  }

  /**
   * Gets user order history across contexts
   */
  async getUserOrderHistory(userId: string): Promise<{
    user: User | null;
    orders: Order[];
    payments: Payment[];
  }> {
    try {
      // ⭐ FOCUS: Cross-context data aggregation
      console.log(
        `ContextIntegration: Getting order history for user ${userId}`
      );

      // Get user from UserManagement context
      const user = await this.userManagementService.getUserById(userId);

      // Get orders from OrderProcessing context
      const orders =
        await this.orderProcessingService.getOrdersByUserId(userId);

      // Get payments for all orders from PaymentProcessing context
      const payments: Payment[] = [];
      for (const order of orders) {
        const orderPayments =
          await this.paymentProcessingService.getPaymentsByOrderId(order.id);
        payments.push(...orderPayments);
      }

      console.log(
        `ContextIntegration: Retrieved history for user ${userId}: ${orders.length} orders, ${payments.length} payments`
      );

      return { user, orders, payments };
    } catch (error) {
      console.error(
        'ContextIntegration: Failed to get user order history:',
        error
      );
      throw error;
    }
  }

  /**
   * Validates cross-context data consistency
   */
  async validateDataConsistency(userId: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // ⭐ FOCUS: Cross-context validation
      console.log(
        `ContextIntegration: Validating data consistency for user ${userId}`
      );

      // Check user exists
      const user = await this.userManagementService.getUserById(userId);
      if (!user) {
        issues.push(`User ${userId} not found in UserManagement context`);
      }

      // Check orders
      const orders =
        await this.orderProcessingService.getOrdersByUserId(userId);

      // Check payments for orders
      for (const order of orders) {
        const payments =
          await this.paymentProcessingService.getPaymentsByOrderId(order.id);
        if (payments.length === 0) {
          issues.push(`No payments found for order ${order.id}`);
        }
      }

      const consistent = issues.length === 0;

      console.log(
        `ContextIntegration: Data consistency for user ${userId}: ${consistent ? 'CONSISTENT' : 'INCONSISTENT'}`
      );

      return { consistent, issues };
    } catch (error) {
      console.error(
        'ContextIntegration: Data consistency validation failed:',
        error
      );
      issues.push(`Validation failed: ${error.message}`);
      return { consistent: false, issues };
    }
  }
}
```

```typescript
// nestjs/multi-context.controller.ts
import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ContextIntegrationService } from '../cross-context/context-integration.service';
import {
  CreateUserData,
  CreateOrderData,
  ProcessPaymentData,
  OrderStatus,
} from '../types'; // Import from application

/**
 * Multi-context controller demonstrating cross-context operations
 */
@Controller('multi-context')
export class MultiContextController {
  constructor(
    private readonly contextIntegrationService: ContextIntegrationService
  ) {}

  /**
   * Complete order workflow across all contexts
   */
  @Post('complete-order')
  async completeOrderWorkflow(
    @Body()
    requestData: {
      userData: CreateUserData;
      orderData: CreateOrderData;
      paymentData: ProcessPaymentData;
    }
  ) {
    // ⭐ FOCUS: Cross-context workflow endpoint
    return await this.contextIntegrationService.completeOrderWorkflow(
      requestData.userData,
      requestData.orderData,
      requestData.paymentData
    );
  }

  /**
   * Gets user order history from multiple contexts
   */
  @Get('user/:userId/history')
  async getUserOrderHistory(@Param('userId') userId: string) {
    return await this.contextIntegrationService.getUserOrderHistory(userId);
  }

  /**
   * Validates data consistency across contexts
   */
  @Get('user/:userId/validate')
  async validateDataConsistency(@Param('userId') userId: string) {
    return await this.contextIntegrationService.validateDataConsistency(userId);
  }
}
```

```typescript
// nestjs/multi-context.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ContextManager } from '../context-configuration/context-manager';
import { ContextIntegrationService } from '../cross-context/context-integration.service';
import { MultiContextController } from './multi-context.controller';

/**
 * Multi-context module orchestrating all bounded contexts
 */
@Module({
  controllers: [MultiContextController],
  providers: [ContextIntegrationService],
  exports: [ContextIntegrationService],
})
export class MultiContextModule implements OnModuleInit {
  /**
   * Initialize all bounded contexts
   */
  async onModuleInit() {
    // ⭐ FOCUS: Initialize all contexts during module initialization
    console.log(
      'MultiContextModule: Initializing multi-context architecture...'
    );

    await ContextManager.configureContexts();

    const configuredContexts = ContextManager.getConfiguredContexts();
    console.log(
      `MultiContextModule: Initialized ${configuredContexts.length} contexts:`,
      configuredContexts
    );
  }
}
```

```typescript
// nestjs/app.module.ts
import { Module } from '@nestjs/common';
import { MultiContextModule } from './multi-context.module';

/**
 * Root application module
 */
@Module({
  imports: [MultiContextModule],
})
export class AppModule {}
```

```typescript
// test/multi-context.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MultiContextModule } from '../nestjs/multi-context.module';
import { ContextIntegrationService } from '../cross-context/context-integration.service';
import { ContextManager } from '../context-configuration/context-manager';
import {
  CreateUserData,
  CreateOrderData,
  ProcessPaymentData,
  PaymentMethod,
} from '../types'; // Import from application

describe('Multi-Context Architecture', () => {
  let contextIntegrationService: ContextIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [MultiContextModule],
    }).compile();

    contextIntegrationService = module.get<ContextIntegrationService>(
      ContextIntegrationService
    );
  });

  it('should configure all contexts', async () => {
    const contexts = ContextManager.getConfiguredContexts();

    expect(contexts).toContain('UserManagement');
    expect(contexts).toContain('OrderProcessing');
    expect(contexts).toContain('PaymentProcessing');
  });

  it('should complete order workflow across contexts', async () => {
    const userData: CreateUserData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    const orderData: CreateOrderData = {
      userId: '', // Will be set by the workflow
      items: [
        { productId: 'prod1', quantity: 2, price: 25.99 },
        { productId: 'prod2', quantity: 1, price: 15.5 },
      ],
    };

    const paymentData: ProcessPaymentData = {
      orderId: '', // Will be set by the workflow
      amount: 67.48,
      currency: 'USD',
      method: PaymentMethod.CREDIT_CARD,
      paymentDetails: {},
    };

    const result = await contextIntegrationService.completeOrderWorkflow(
      userData,
      orderData,
      paymentData
    );

    expect(result.user).toBeDefined();
    expect(result.order).toBeDefined();
    expect(result.payment).toBeDefined();

    expect(result.user.email).toBe(userData.email);
    expect(result.order.userId).toBe(result.user.id);
    expect(result.payment.orderId).toBe(result.order.id);
  });

  it('should get user order history across contexts', async () => {
    // First complete an order workflow
    const userData: CreateUserData = {
      email: 'history@example.com',
      name: 'History User',
    };

    const orderData: CreateOrderData = {
      userId: '',
      items: [{ productId: 'prod1', quantity: 1, price: 50.0 }],
    };

    const paymentData: ProcessPaymentData = {
      orderId: '',
      amount: 50.0,
      currency: 'USD',
      method: PaymentMethod.CREDIT_CARD,
      paymentDetails: {},
    };

    const workflowResult =
      await contextIntegrationService.completeOrderWorkflow(
        userData,
        orderData,
        paymentData
      );

    // Then get the history
    const history = await contextIntegrationService.getUserOrderHistory(
      workflowResult.user.id
    );

    expect(history.user).toBeDefined();
    expect(history.orders).toHaveLength(1);
    expect(history.payments).toHaveLength(1);

    expect(history.user?.id).toBe(workflowResult.user.id);
    expect(history.orders[0].id).toBe(workflowResult.order.id);
    expect(history.payments[0].id).toBe(workflowResult.payment.id);
  });

  it('should validate data consistency across contexts', async () => {
    // Complete an order workflow
    const userData: CreateUserData = {
      email: 'consistency@example.com',
      name: 'Consistency User',
    };

    const orderData: CreateOrderData = {
      userId: '',
      items: [{ productId: 'prod1', quantity: 1, price: 30.0 }],
    };

    const paymentData: ProcessPaymentData = {
      orderId: '',
      amount: 30.0,
      currency: 'USD',
      method: PaymentMethod.CREDIT_CARD,
      paymentDetails: {},
    };

    const result = await contextIntegrationService.completeOrderWorkflow(
      userData,
      orderData,
      paymentData
    );

    // Validate consistency
    const validation = await contextIntegrationService.validateDataConsistency(
      result.user.id
    );

    expect(validation.consistent).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });
});
```

## Key Features

- **Bounded Context Isolation**: Each context has its own services and data
- **Cross-Context Communication**: Proper integration between contexts
- **Context-Specific Configuration**: Each context can have different
  configurations
- **Enterprise Integration**: Production-ready patterns for large applications
- **Data Consistency Validation**: Cross-context validation capabilities
- **Workflow Orchestration**: Complex workflows spanning multiple contexts

## Common Pitfalls

- **Context Leakage**: Prevent direct dependencies between contexts
- **Data Consistency**: Ensure data consistency across contexts
- **Performance**: Be mindful of cross-context communication overhead
- **Transaction Management**: Handle distributed transactions carefully
- **Error Handling**: Proper error handling across context boundaries

## Related Examples

- [Bridge Pattern Implementation](../intermediate/example-1.md) - Basic bridge
  patterns
- [Custom Provider Factory](../intermediate/example-2.md) - Advanced provider
  patterns
- [Context Isolation](../../intermediate/example-2.md) - Context isolation
  patterns
