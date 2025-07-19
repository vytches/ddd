# VytchesDDD Global Service Locator - Beginner Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: beginner  
**Domain**: Payment Processing  
**Patterns**: Service Locator, Global Access  
**Dependencies**: @vytches-ddd/di  

## Description

This example demonstrates how to use VytchesDDD's global service locator pattern. The service locator provides a centralized way to resolve services from anywhere in your application, following the MediatR pattern used in enterprise applications.

## Business Context

In complex enterprise applications, you often need to access services from various layers without explicitly passing dependencies through constructors. The global service locator pattern provides a clean way to access registered services while maintaining type safety and avoiding tight coupling.

## Code Example

```typescript
// payment.service.ts
import { DomainService } from '@vytches-ddd/di';
import { Payment, ProcessPaymentData, PaymentStatus } from '../types'; // Import from application

/**
 * Payment service registered with DI system
 */
@DomainService('paymentService')
export class PaymentService {
  private payments: Map<string, Payment> = new Map();
  
  /**
   * Processes a payment
   */
  async processPayment(paymentData: ProcessPaymentData): Promise<Payment> {
    // ⭐ FOCUS: Business logic implementation
    const payment: Payment = {
      id: this.generatePaymentId(),
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: PaymentStatus.PROCESSING,
      method: paymentData.method,
      createdAt: new Date()
    };
    
    // Simulate payment processing
    await this.processWithProvider(payment);
    
    payment.status = PaymentStatus.COMPLETED;
    payment.processedAt = new Date();
    
    this.payments.set(payment.id, payment);
    
    console.log(`Payment processed: ${payment.id}`);
    return payment;
  }
  
  /**
   * Gets payment by ID
   */
  async getPaymentById(id: string): Promise<Payment | null> {
    return this.payments.get(id) || null;
  }
  
  private async processWithProvider(payment: Payment): Promise<void> {
    // Simulate external payment provider
    console.log(`Processing payment ${payment.id} with provider`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  private generatePaymentId(): string {
    return `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// notification.service.ts
import { DomainService } from '@vytches-ddd/di';
import { EmailNotificationData } from '../types'; // Import from application

/**
 * Notification service for sending emails
 */
@DomainService('notificationService')
export class NotificationService {
  /**
   * Sends an email notification
   */
  async sendEmail(notificationData: EmailNotificationData): Promise<void> {
    // ⭐ FOCUS: Email sending logic
    console.log(`Sending email to: ${notificationData.to}`);
    console.log(`Subject: ${notificationData.subject}`);
    console.log(`Body: ${notificationData.body}`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log(`Email sent successfully to ${notificationData.to}`);
  }
  
  /**
   * Sends payment confirmation email
   */
  async sendPaymentConfirmation(paymentId: string, userEmail: string): Promise<void> {
    await this.sendEmail({
      to: userEmail,
      subject: 'Payment Confirmation',
      body: `Your payment ${paymentId} has been processed successfully.`
    });
  }
}
```

```typescript
// order-fulfillment.service.ts
import { DomainService, VytchesDDD } from '@vytches-ddd/di';
import { PaymentService } from './payment.service';
import { NotificationService } from './notification.service';
import { Order, ProcessPaymentData, PaymentMethod } from '../types'; // Import from application

/**
 * Order fulfillment service that uses global service locator
 */
@DomainService('orderFulfillmentService')
export class OrderFulfillmentService {
  /**
   * Fulfills an order using global service locator
   */
  async fulfillOrder(order: Order, userEmail: string): Promise<void> {
    try {
      // ⭐ FOCUS: Resolve services using global locator
      const paymentService = VytchesDDD.resolve<PaymentService>('paymentService');
      const notificationService = VytchesDDD.resolve<NotificationService>('notificationService');
      
      console.log(`Fulfilling order: ${order.id}`);
      
      // Process payment
      const paymentData: ProcessPaymentData = {
        orderId: order.id,
        amount: order.total,
        currency: 'USD',
        method: PaymentMethod.CREDIT_CARD,
        paymentDetails: {}
      };
      
      const payment = await paymentService.processPayment(paymentData);
      
      // Send confirmation
      await notificationService.sendPaymentConfirmation(payment.id, userEmail);
      
      console.log(`Order ${order.id} fulfilled successfully`);
      
    } catch (error) {
      console.error(`Failed to fulfill order ${order.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Processes refund using service locator
   */
  async processRefund(paymentId: string, userEmail: string): Promise<void> {
    // ⭐ FOCUS: Global service resolution from any method
    const paymentService = VytchesDDD.resolve<PaymentService>('paymentService');
    const notificationService = VytchesDDD.resolve<NotificationService>('notificationService');
    
    const payment = await paymentService.getPaymentById(paymentId);
    
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    
    console.log(`Processing refund for payment: ${paymentId}`);
    
    // Send refund notification
    await notificationService.sendEmail({
      to: userEmail,
      subject: 'Refund Processed',
      body: `Your refund of $${payment.amount} has been processed.`
    });
    
    console.log(`Refund processed for payment: ${paymentId}`);
  }
}
```

```typescript
// app.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { Order, OrderStatus } from '../types'; // Import from application

/**
 * Application demonstrating global service locator
 */
async function demonstrateServiceLocator(): Promise<void> {
  // ⭐ FOCUS: Configure DI container
  const container = new SimpleContainer();
  await VytchesDDD.configure(container);
  
  console.log('=== Global Service Locator Demo ===\n');
  
  // ⭐ FOCUS: Resolve main service
  const fulfillmentService = VytchesDDD.resolve<OrderFulfillmentService>('orderFulfillmentService');
  
  // Create sample order
  const order: Order = {
    id: 'order_123',
    userId: 'user_456',
    items: [
      { id: 'item_1', productId: 'prod_1', quantity: 2, price: 25.99 },
      { id: 'item_2', productId: 'prod_2', quantity: 1, price: 15.50 }
    ],
    total: 67.48,
    status: OrderStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // ⭐ FOCUS: Service internally uses global locator
  console.log('1. Fulfilling order...');
  await fulfillmentService.fulfillOrder(order, 'customer@example.com');
  
  console.log('\n2. Processing refund...');
  await fulfillmentService.processRefund('payment_123', 'customer@example.com');
  
  // ⭐ FOCUS: Direct resolution from anywhere
  console.log('\n3. Direct service resolution:');
  const paymentService = VytchesDDD.resolve<PaymentService>('paymentService');
  const payment = await paymentService.getPaymentById('payment_123');
  console.log('Payment found:', payment ? 'Yes' : 'No');
}

// Run the demonstration
demonstrateServiceLocator().catch(console.error);
```

```typescript
// utility.ts
import { VytchesDDD } from '@vytches-ddd/di';
import { NotificationService } from './notification.service';

/**
 * Utility functions using global service locator
 */
export class EmailUtils {
  /**
   * Sends welcome email using global service locator
   */
  static async sendWelcomeEmail(userEmail: string, userName: string): Promise<void> {
    // ⭐ FOCUS: Access services from static context
    const notificationService = VytchesDDD.resolve<NotificationService>('notificationService');
    
    await notificationService.sendEmail({
      to: userEmail,
      subject: 'Welcome to Our Platform',
      body: `Hello ${userName}, welcome to our platform!`
    });
  }
  
  /**
   * Sends system alert using global service locator
   */
  static async sendSystemAlert(message: string): Promise<void> {
    // ⭐ FOCUS: Global access without constructor injection
    const notificationService = VytchesDDD.resolve<NotificationService>('notificationService');
    
    await notificationService.sendEmail({
      to: 'admin@example.com',
      subject: 'System Alert',
      body: message
    });
  }
}
```

## Key Features

- **Global Access**: Resolve services from anywhere in your application
- **Type Safety**: Full TypeScript support with generic type resolution
- **MediatR Pattern**: Follows enterprise patterns from .NET MediatR
- **Centralized Resolution**: Single point of service resolution
- **No Constructor Injection**: Access services without explicit dependencies

## Common Pitfalls

- **Service Not Registered**: Ensure services are registered before resolution
- **Circular Dependencies**: Avoid services that resolve each other during construction
- **Testing Complexity**: Global state can make unit testing more complex
- **Service Identifier Typos**: Use constants for service identifiers to avoid typos
- **Missing Configuration**: Must call `VytchesDDD.configure()` before any resolution

## Related Examples

- [Basic Service Registration](./example-1.md) - Simple service registration
- [Service Lifetimes](./example-2.md) - Understanding service lifetimes
- [Auto-Discovery System](../intermediate/example-1.md) - Automatic service discovery