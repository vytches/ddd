# Retry Pattern with Exponential Backoff

**Version**: 1.0.0 **Package**: @vytches/ddd-resilience **Complexity**: Basic
**Domain**: Order Processing **Patterns**: Retry Pattern, Exponential Backoff,
Jitter Strategy **Dependencies**: @vytches/ddd-resilience

## Description

This example demonstrates the retry pattern with exponential backoff for
handling transient failures in order processing. When external services
experience temporary issues, the retry pattern automatically attempts the
operation multiple times with increasing delays to avoid overwhelming the
failing service.

## Business Context

An e-commerce order processing system needs to call inventory and shipping
services to fulfill orders. These external services occasionally experience
transient failures due to network issues, temporary overload, or brief
maintenance windows. The retry pattern ensures orders are processed successfully
despite these temporary issues while avoiding aggressive retries that could
worsen the situation.

## Code Example

```typescript
// order-processing-service.ts
import {
  RetryStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
  RetryResult,
} from '@vytches/ddd-resilience';
import { Order, InventoryItem, NotificationRequest } from './types'; // From your application

// Order processing service with retry strategies
export class OrderProcessingService {
  private inventoryRetryStrategy: RetryStrategy;
  private shippingRetryStrategy: RetryStrategy;
  private notificationRetryStrategy: RetryStrategy;

  constructor() {
    // Configure retry for inventory service (critical path)
    this.inventoryRetryStrategy = ResiliencePolicyBuilder.create()
      .withRetry({
        maxAttempts: 5,
        baseDelay: 1000, // Start with 1 second
        maxDelay: 30000, // Cap at 30 seconds
        backoff: 'exponential', // 1s, 2s, 4s, 8s, 16s
        jitter: true, // Add randomization
        retryCondition: error => this.isRetryableError(error),
      })
      .build();

    // Configure retry for shipping service (less critical)
    this.shippingRetryStrategy = ResiliencePolicyBuilder.create()
      .withRetry({
        maxAttempts: 3,
        baseDelay: 2000, // Start with 2 seconds
        maxDelay: 10000, // Cap at 10 seconds
        backoff: 'linear', // 2s, 4s, 6s
        jitter: false,
        retryCondition: error => this.isTemporaryShippingError(error),
      })
      .build();

    // Configure retry for notifications (non-critical)
    this.notificationRetryStrategy = ResiliencePolicyBuilder.create()
      .withRetry({
        maxAttempts: 2,
        baseDelay: 5000, // Start with 5 seconds
        maxDelay: 15000, // Cap at 15 seconds
        backoff: 'fixed', // Always 5s between attempts
        jitter: true,
        retryCondition: error => error.message.includes('timeout'),
      })
      .build();
  }

  async processOrder(order: Order): Promise<ProcessOrderResult> {
    const startTime = Date.now();
    const context: ResilienceContext = {
      operationId: 'process-order',
      correlationId: order.id,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
    };

    try {
      // Step 1: Reserve inventory with retry
      console.log(`Processing order ${order.id} - reserving inventory`);
      const inventoryResult = await this.reserveInventoryWithRetry(
        order,
        context
      );

      if (!inventoryResult.success) {
        return {
          orderId: order.id,
          success: false,
          error: 'Failed to reserve inventory',
          details: inventoryResult.error,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 2: Create shipping label with retry
      console.log(`Processing order ${order.id} - creating shipping label`);
      const shippingResult = await this.createShippingLabelWithRetry(
        order,
        context
      );

      if (!shippingResult.success) {
        // Rollback inventory reservation
        await this.rollbackInventoryReservation(order.id);

        return {
          orderId: order.id,
          success: false,
          error: 'Failed to create shipping label',
          details: shippingResult.error,
          processingTime: Date.now() - startTime,
        };
      }

      // Step 3: Send confirmation notification (non-blocking)
      console.log(`Processing order ${order.id} - sending notification`);
      this.sendNotificationWithRetry(order, context).catch(error => {
        console.warn(
          `Failed to send notification for order ${order.id}:`,
          error
        );
      });

      return {
        orderId: order.id,
        success: true,
        inventoryReservationId: inventoryResult.data.reservationId,
        shippingTrackingNumber: shippingResult.data.trackingNumber,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`Order processing failed for ${order.id}:`, error);
      return {
        orderId: order.id,
        success: false,
        error: 'Unexpected processing error',
        details: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async reserveInventoryWithRetry(
    order: Order,
    context: ResilienceContext
  ): Promise<RetryResult<InventoryReservation>> {
    return await this.inventoryRetryStrategy.execute(async () => {
      console.log(
        `Attempting inventory reservation for order ${order.id} (attempt ${context.attempt})`
      );

      const reservationRequest = {
        orderId: order.id,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      const response = await fetch('https://inventory-service.api/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': context.correlationId,
        },
        body: JSON.stringify(reservationRequest),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Inventory service error: ${response.status} - ${errorData.message || response.statusText}`
        );
      }

      const reservationData = await response.json();
      return {
        reservationId: reservationData.reservationId,
        expiresAt: new Date(reservationData.expiresAt),
        items: reservationData.items,
      };
    }, context);
  }

  private async createShippingLabelWithRetry(
    order: Order,
    context: ResilienceContext
  ): Promise<RetryResult<ShippingLabel>> {
    return await this.shippingRetryStrategy.execute(async () => {
      console.log(
        `Attempting shipping label creation for order ${order.id} (attempt ${context.attempt})`
      );

      const shippingRequest = {
        orderId: order.id,
        recipientAddress: order.shippingAddress,
        packages: this.calculatePackages(order.items),
        shippingMethod: order.shippingMethod || 'standard',
      };

      const response = await fetch('https://shipping-service.api/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer shipping-api-key',
          'X-Correlation-ID': context.correlationId,
        },
        body: JSON.stringify(shippingRequest),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Shipping service error: ${response.status} - ${errorData.message || response.statusText}`
        );
      }

      const labelData = await response.json();
      return {
        trackingNumber: labelData.trackingNumber,
        labelUrl: labelData.labelUrl,
        estimatedDelivery: new Date(labelData.estimatedDelivery),
      };
    }, context);
  }

  private async sendNotificationWithRetry(
    order: Order,
    context: ResilienceContext
  ): Promise<RetryResult<NotificationResponse>> {
    const notificationRequest: NotificationRequest = {
      id: `notification-${order.id}`,
      recipientId: order.customerId,
      type: 'order_confirmation',
      channel: 'email',
      subject: 'Order Confirmation',
      content: `Your order ${order.id} has been processed successfully.`,
      priority: 'normal',
    };

    return await this.notificationRetryStrategy.execute(async () => {
      console.log(
        `Attempting notification send for order ${order.id} (attempt ${context.attempt})`
      );

      const response = await fetch('https://notification-service.api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': context.correlationId,
        },
        body: JSON.stringify(notificationRequest),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`Notification service error: ${response.status}`);
      }

      const result = await response.json();
      return {
        notificationId: result.notificationId,
        status: result.status,
        deliveredAt: new Date(result.deliveredAt),
      };
    }, context);
  }

  private isRetryableError(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')
    );
  }

  private isTemporaryShippingError(error: Error): boolean {
    // Only retry specific shipping service errors
    return (
      error.message.includes('rate_limited') ||
      error.message.includes('temporarily_unavailable') ||
      error.message.includes('503')
    );
  }

  private calculatePackages(items: any[]): Package[] {
    // Simple packaging logic
    return [
      {
        weight: items.reduce((total, item) => total + (item.weight || 1), 0),
        dimensions: { length: 12, width: 12, height: 6 },
        items: items.length,
      },
    ];
  }

  private async rollbackInventoryReservation(orderId: string): Promise<void> {
    try {
      await fetch(`https://inventory-service.api/reservations/${orderId}`, {
        method: 'DELETE',
      });
      console.log(`Inventory reservation rolled back for order ${orderId}`);
    } catch (error) {
      console.error(
        `Failed to rollback inventory for order ${orderId}:`,
        error
      );
    }
  }

  // Get retry statistics for monitoring
  getRetryStatistics(): RetryStatistics {
    return {
      inventory: this.inventoryRetryStrategy.getStatistics(),
      shipping: this.shippingRetryStrategy.getStatistics(),
      notification: this.notificationRetryStrategy.getStatistics(),
    };
  }
}

// Supporting types
interface ProcessOrderResult {
  orderId: string;
  success: boolean;
  inventoryReservationId?: string;
  shippingTrackingNumber?: string;
  error?: string;
  details?: string;
  processingTime: number;
}

interface InventoryReservation {
  reservationId: string;
  expiresAt: Date;
  items: any[];
}

interface ShippingLabel {
  trackingNumber: string;
  labelUrl: string;
  estimatedDelivery: Date;
}

interface NotificationResponse {
  notificationId: string;
  status: string;
  deliveredAt: Date;
}

interface Package {
  weight: number;
  dimensions: { length: number; width: number; height: number };
  items: number;
}

interface RetryStatistics {
  inventory: any;
  shipping: any;
  notification: any;
}

// Usage example
const orderProcessor = new OrderProcessingService();

const sampleOrder: Order = {
  id: 'order-123',
  customerId: 'customer-456',
  items: [
    {
      productId: 'product-789',
      productName: 'Wireless Headphones',
      quantity: 1,
      unitPrice: 99.99,
      totalPrice: 99.99,
      sku: 'WH-001',
    },
  ],
  totalAmount: 99.99,
  currency: 'USD',
  status: 'pending',
  shippingAddress: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
  },
  billingAddress: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Process order with automatic retries
orderProcessor
  .processOrder(sampleOrder)
  .then(result => {
    if (result.success) {
      console.log('Order processed successfully:', result);
    } else {
      console.log('Order processing failed:', result.error);
    }

    // Check retry statistics
    const stats = orderProcessor.getRetryStatistics();
    console.log('Retry statistics:', stats);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
  });
```

## Key Features

- **Exponential Backoff**: Automatically increases delay between retries
- **Jitter**: Adds randomization to prevent thundering herd
- **Retry Conditions**: Configurable logic for which errors to retry
- **Different Strategies**: Linear, exponential, and fixed backoff options
- **Statistics Tracking**: Monitor retry attempts and success rates
- **Timeout Integration**: Prevents hanging operations

## Backoff Strategies

1. **Exponential**: 1s, 2s, 4s, 8s, 16s (doubles each time)
2. **Linear**: 2s, 4s, 6s, 8s, 10s (increases by fixed amount)
3. **Fixed**: 5s, 5s, 5s, 5s, 5s (same delay each time)

## Common Pitfalls

- **No Maximum Delay**: Exponential backoff without upper bound
- **No Jitter**: All clients retrying at same intervals
- **Retrying Non-Transient Errors**: Wasting resources on permanent failures
- **Too Many Attempts**: Overwhelming already struggling services

## Related Examples

- [Circuit Breaker Pattern](./example-1.md)
- [Bulkhead Pattern](./example-3.md)
- [Composite Resilience Strategy](../intermediate/example-2.md)
