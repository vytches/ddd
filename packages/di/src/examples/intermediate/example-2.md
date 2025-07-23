# Context Isolation - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: intermediate  
**Domain**: Multi-Tenant E-commerce  
**Patterns**: Context Isolation, Bounded Context, Multi-Tenancy  
**Dependencies**: @vytches-ddd/di

## Description

This example demonstrates VytchesDDD's context isolation feature, which enables
bounded context support for Domain-Driven Design. Different contexts can have
their own service instances and configurations, preventing cross-context
dependencies and ensuring proper domain boundaries.

## Business Context

In a multi-tenant e-commerce platform, different business contexts (Order
Management, User Management, Payment Processing) need isolated service
instances. This prevents data leakage between contexts and ensures each bounded
context maintains its own configuration and state.

## Code Example

```typescript
// order-management/order.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Order, CreateOrderData } from '../types'; // Import from application

/**
 * Order service in OrderManagement context
 */
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  autoRegister: true,
})
export class OrderManagementOrderService {
  private orders: Map<string, Order> = new Map();
  private readonly contextId: string;

  constructor() {
    this.contextId = 'OrderManagement';
    console.log(`OrderService initialized in context: ${this.contextId}`);
  }

  /**
   * Creates an order in OrderManagement context
   */
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // ⭐ FOCUS: Context-specific order creation
    const order: Order = {
      id: this.generateOrderId(),
      userId: orderData.userId,
      items: orderData.items.map(item => ({
        ...item,
        id: this.generateItemId(),
      })),
      total: this.calculateTotal(orderData.items),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);

    console.log(`OrderManagement: Created order ${order.id}`);
    return order;
  }

  /**
   * Gets order by ID
   */
  async getOrderById(id: string): Promise<Order | null> {
    const order = this.orders.get(id);
    console.log(`OrderManagement: Retrieved order ${id} - Found: ${!!order}`);
    return order || null;
  }

  private generateOrderId(): string {
    return `om_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateItemId(): string {
    return `om_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateTotal(
    items: Array<{ quantity: number; price: number }>
  ): number {
    return items.reduce((total, item) => total + item.quantity * item.price, 0);
  }
}
```

```typescript
// billing/order.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Order } from '../types'; // Import from application

/**
 * Order service in Billing context (different implementation)
 */
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Billing',
  autoRegister: true,
})
export class BillingOrderService {
  private billingOrders: Map<
    string,
    { orderId: string; amount: number; taxAmount: number }
  > = new Map();
  private readonly contextId: string;

  constructor() {
    this.contextId = 'Billing';
    console.log(`OrderService initialized in context: ${this.contextId}`);
  }

  /**
   * Creates billing record for an order
   */
  async createBillingRecord(orderId: string, amount: number): Promise<void> {
    // ⭐ FOCUS: Context-specific billing logic
    const taxAmount = amount * 0.1; // 10% tax

    const billingRecord = {
      orderId,
      amount,
      taxAmount,
    };

    this.billingOrders.set(orderId, billingRecord);

    console.log(`Billing: Created billing record for order ${orderId}`);
  }

  /**
   * Gets billing record by order ID
   */
  async getBillingRecord(
    orderId: string
  ): Promise<{ orderId: string; amount: number; taxAmount: number } | null> {
    const record = this.billingOrders.get(orderId);
    console.log(
      `Billing: Retrieved billing record for ${orderId} - Found: ${!!record}`
    );
    return record || null;
  }
}
```

```typescript
// payment/payment.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Payment, ProcessPaymentData } from '../types'; // Import from application

/**
 * Payment service in PaymentProcessing context
 */
@DomainService({
  serviceId: 'paymentService',
  lifetime: ServiceLifetime.Scoped,
  context: 'PaymentProcessing',
  autoRegister: true,
  dependencies: ['auditService'],
})
export class PaymentProcessingService {
  private payments: Map<string, Payment> = new Map();
  private readonly contextId: string;

  constructor() {
    this.contextId = 'PaymentProcessing';
    console.log(`PaymentService initialized in context: ${this.contextId}`);
  }

  /**
   * Processes payment in PaymentProcessing context
   */
  async processPayment(paymentData: ProcessPaymentData): Promise<Payment> {
    // ⭐ FOCUS: Context-specific payment processing
    const payment: Payment = {
      id: this.generatePaymentId(),
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'PROCESSING',
      method: paymentData.method,
      createdAt: new Date(),
    };

    // Simulate payment processing
    await this.processWithProvider(payment);

    payment.status = 'COMPLETED';
    payment.processedAt = new Date();

    this.payments.set(payment.id, payment);

    console.log(`PaymentProcessing: Processed payment ${payment.id}`);
    return payment;
  }

  private async processWithProvider(payment: Payment): Promise<void> {
    console.log(`PaymentProcessing: Processing with external provider`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private generatePaymentId(): string {
    return `pp_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// shared/audit.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * Shared audit service available in multiple contexts
 */
@DomainService({
  serviceId: 'auditService',
  lifetime: ServiceLifetime.Singleton,
  context: ['OrderManagement', 'Billing', 'PaymentProcessing'], // Multiple contexts
  autoRegister: true,
})
export class SharedAuditService {
  private auditLog: Map<string, AuditLogEntry[]> = new Map();

  /**
   * Logs action with context information
   */
  async logAction(
    context: string,
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    // ⭐ FOCUS: Context-aware audit logging
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
      metadata: {
        ...entry.metadata,
        context,
      },
    };

    const contextLog = this.auditLog.get(context) || [];
    contextLog.push(auditEntry);
    this.auditLog.set(context, contextLog);

    console.log(`Audit: Logged ${entry.action} in context ${context}`);
  }

  /**
   * Gets audit log for specific context
   */
  async getAuditLogForContext(context: string): Promise<AuditLogEntry[]> {
    return this.auditLog.get(context) || [];
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// context-configuration.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';

/**
 * Context isolation configuration
 */
export class ContextConfiguration {
  /**
   * Configures multiple bounded contexts
   */
  static async configure(): Promise<void> {
    // ⭐ FOCUS: Context-specific container configuration

    // OrderManagement context
    const orderContainer = new SimpleContainer();
    orderContainer.registerInstance('orderConfig', {
      maxOrderItems: 50,
      allowBackorders: true,
      timeout: 30000,
    });

    // Billing context
    const billingContainer = new SimpleContainer();
    billingContainer.registerInstance('billingConfig', {
      taxRate: 0.1,
      currency: 'USD',
      timeout: 15000,
    });

    // PaymentProcessing context
    const paymentContainer = new SimpleContainer();
    paymentContainer.registerInstance('paymentConfig', {
      maxRetries: 3,
      timeout: 60000,
      allowedMethods: ['credit_card', 'paypal'],
    });

    // Configure contexts
    await VytchesDDD.configureContext('OrderManagement', orderContainer);
    await VytchesDDD.configureContext('Billing', billingContainer);
    await VytchesDDD.configureContext('PaymentProcessing', paymentContainer);

    console.log('Context isolation configured');
  }
}
```

```typescript
// app.ts
import { VytchesDDD } from '@vytches-ddd/di';
import { ContextConfiguration } from './context-configuration';
import { OrderManagementOrderService } from './order-management/order.service';
import { BillingOrderService } from './billing/order.service';
import { PaymentProcessingService } from './payment/payment.service';
import { SharedAuditService } from './shared/audit.service';
import { CreateOrderData, ProcessPaymentData, PaymentMethod } from '../types'; // Import from application

/**
 * Application demonstrating context isolation
 */
async function demonstrateContextIsolation(): Promise<void> {
  console.log('=== Context Isolation Demo ===\n');

  // ⭐ FOCUS: Configure context isolation
  await ContextConfiguration.configure();

  console.log('1. Context-specific service resolution:');

  // ⭐ FOCUS: Resolve services by context
  const orderService = VytchesDDD.resolve<OrderManagementOrderService>(
    'orderService',
    'OrderManagement'
  );
  const billingService = VytchesDDD.resolve<BillingOrderService>(
    'orderService',
    'Billing'
  );
  const paymentService = VytchesDDD.resolve<PaymentProcessingService>(
    'paymentService',
    'PaymentProcessing'
  );

  // Shared service in multiple contexts
  const auditService = VytchesDDD.resolve<SharedAuditService>(
    'auditService',
    'OrderManagement'
  );

  console.log('\n2. Cross-context workflow:');

  // Create order in OrderManagement context
  const orderData: CreateOrderData = {
    userId: 'user123',
    items: [
      { productId: 'prod1', quantity: 2, price: 25.99 },
      { productId: 'prod2', quantity: 1, price: 15.5 },
    ],
  };

  const order = await orderService.createOrder(orderData);

  // Log in OrderManagement context
  await auditService.logAction('OrderManagement', {
    userId: 'user123',
    action: 'CREATE_ORDER',
    resource: 'Order',
    resourceId: order.id,
  });

  // Create billing record in Billing context
  await billingService.createBillingRecord(order.id, order.total);

  // Log in Billing context
  const billingAuditService = VytchesDDD.resolve<SharedAuditService>(
    'auditService',
    'Billing'
  );
  await billingAuditService.logAction('Billing', {
    userId: 'user123',
    action: 'CREATE_BILLING_RECORD',
    resource: 'BillingRecord',
    resourceId: order.id,
  });

  // Process payment in PaymentProcessing context
  const paymentData: ProcessPaymentData = {
    orderId: order.id,
    amount: order.total,
    currency: 'USD',
    method: PaymentMethod.CREDIT_CARD,
    paymentDetails: {},
  };

  const payment = await paymentService.processPayment(paymentData);

  // Log in PaymentProcessing context
  const paymentAuditService = VytchesDDD.resolve<SharedAuditService>(
    'auditService',
    'PaymentProcessing'
  );
  await paymentAuditService.logAction('PaymentProcessing', {
    userId: 'user123',
    action: 'PROCESS_PAYMENT',
    resource: 'Payment',
    resourceId: payment.id,
  });

  console.log('\n3. Context isolation verification:');

  // Verify different instances in different contexts
  const orderService2 = VytchesDDD.resolve<OrderManagementOrderService>(
    'orderService',
    'OrderManagement'
  );
  const billingService2 = VytchesDDD.resolve<BillingOrderService>(
    'orderService',
    'Billing'
  );

  console.log('Same OrderManagement instance?', orderService === orderService2); // true (singleton)
  console.log('Same Billing instance?', billingService === billingService2); // true (singleton)
  console.log('OrderManagement === Billing?', orderService === billingService); // false (different contexts)

  // Check audit logs by context
  const orderAuditLog =
    await auditService.getAuditLogForContext('OrderManagement');
  const billingAuditLog =
    await billingAuditService.getAuditLogForContext('Billing');
  const paymentAuditLog =
    await paymentAuditService.getAuditLogForContext('PaymentProcessing');

  console.log(`OrderManagement audit entries: ${orderAuditLog.length}`);
  console.log(`Billing audit entries: ${billingAuditLog.length}`);
  console.log(`PaymentProcessing audit entries: ${paymentAuditLog.length}`);
}

// Run the demonstration
demonstrateContextIsolation().catch(console.error);
```

## Key Features

- **Context Isolation**: Each bounded context has its own service instances
- **Context-Specific Configuration**: Different contexts can have different
  configurations
- **Shared Services**: Services can be shared across multiple contexts
- **Context-Aware Resolution**: Resolve services by context for proper isolation
- **DDD Boundary Enforcement**: Maintains proper domain boundaries
- **Multi-Tenancy Support**: Different tenants can have isolated contexts

## Common Pitfalls

- **Context Confusion**: Always specify context when resolving services
- **Shared State**: Be careful with shared state between contexts
- **Configuration Conflicts**: Ensure context-specific configurations don't
  conflict
- **Memory Usage**: Multiple contexts may increase memory usage
- **Cross-Context Dependencies**: Avoid direct dependencies between contexts

## Related Examples

- [Auto-Discovery System](./example-1.md) - Automatic service discovery
- [CQRS Handler Registration](./example-3.md) - Context-aware handler
  registration
- [Framework Integration Patterns](../advanced/example-1.md) - Advanced
  integration patterns
