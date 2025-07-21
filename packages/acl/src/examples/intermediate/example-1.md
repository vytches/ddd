# ACL with Caching and Resilience

**Version**: 1.0.0  
**Package**: @vytches-ddd/acl  
**Complexity**: Intermediate  
**Domain**: Order Management  
**Patterns**: Anti-Corruption Layer, Caching, Circuit Breaker  
**Dependencies**: @vytches-ddd/acl, @vytches-ddd/resilience, @vytches-ddd/core

## Description

This example demonstrates an advanced Anti-Corruption Layer that includes caching for performance optimization and resilience patterns for handling external system failures.

## Business Context

An order management system integrates with multiple external services (inventory, payment, shipping) that may be slow or unreliable. The ACL provides caching and fault tolerance to ensure system reliability.

## Code Example

```typescript
// resilient-order.acl.ts
import { AntiCorruptionLayer, IDataTranslator, CachingACLDecorator } from '@vytches-ddd/acl';
import { CircuitBreaker, RetryPolicy } from '@vytches-ddd/resilience';
import { Result } from '@vytches-ddd/utils';
import { Order, ThirdPartyOrderData, OrderSubmissionRequest } from '../types'; // From your application

// Enhanced translator with validation
export class OrderDataTranslator implements IDataTranslator<ThirdPartyOrderData, Order> {
  translate(external: ThirdPartyOrderData): Result<Order, Error> {
    try {
      // Comprehensive validation
      const validationResult = this.validateExternalData(external);
      if (validationResult.isFailure()) {
        return validationResult;
      }

      const order: Order = {
        id: external.order_reference,
        customerId: external.buyer_id,
        items: external.line_items.map(item => ({
          productId: item.product_sku,
          quantity: item.qty,
          unitPrice: item.price_per_unit,
          totalPrice: item.line_total
        })),
        totalAmount: external.grand_total,
        currency: external.currency,
        status: this.mapOrderStatus(external.order_state),
        createdAt: new Date(external.timestamp * 1000),
        shippingAddress: {
          street: external.delivery_address.address_line_1,
          city: external.delivery_address.city,
          postalCode: external.delivery_address.zip_code,
          country: external.delivery_address.country_code
        }
      };

      return Result.success(order);
    } catch (error) {
      return Result.failure(new Error(`Order translation failed: ${error.message}`));
    }
  }

  private validateExternalData(data: ThirdPartyOrderData): Result<void, Error> {
    if (!data.order_reference) {
      return Result.failure(new Error('Missing order reference'));
    }

    if (!data.buyer_id) {
      return Result.failure(new Error('Missing buyer ID'));
    }

    if (!data.line_items || data.line_items.length === 0) {
      return Result.failure(new Error('Order must have at least one item'));
    }

    if (data.grand_total <= 0) {
      return Result.failure(new Error('Order total must be positive'));
    }

    return Result.success(undefined);
  }

  private mapOrderStatus(externalStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'new': 'pending',
      'processing': 'confirmed',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'rejected': 'cancelled'
    };

    return statusMap[externalStatus.toLowerCase()] || 'pending';
  }
}

// Resilient ACL with caching and circuit breaker
export class ResilientOrderACL extends AntiCorruptionLayer<ThirdPartyOrderData, Order> {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;

  constructor(private externalOrderAPI: ExternalOrderAPI) {
    super(new OrderDataTranslator());
    
    // Configure circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 30000 // 30 seconds
    });

    // Configure retry policy
    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 1000,
      backoffStrategy: 'exponential',
      maxDelay: 10000
    });
  }

  async getOrder(orderId: string): Promise<Result<Order, Error>> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        try {
          const externalData = await this.externalOrderAPI.getOrder(orderId);
          return this.translateData(externalData);
        } catch (error) {
          return Result.failure(new Error(`Failed to get order: ${error.message}`));
        }
      });
    });
  }

  async submitOrder(request: OrderSubmissionRequest): Promise<Result<Order, Error>> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        try {
          // Convert domain order to external format
          const externalData = this.convertToExternalFormat(request.order);
          
          // Submit to external system
          const submittedData = await this.externalOrderAPI.submitOrder({
            order: externalData,
            validate_inventory: request.validateInventory,
            send_notification: request.notifyCustomer
          });

          return this.translateData(submittedData);
        } catch (error) {
          return Result.failure(new Error(`Order submission failed: ${error.message}`));
        }
      });
    });
  }

  async getOrdersByCustomer(customerId: string, limit: number = 10): Promise<Result<Order[], Error>> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        try {
          const externalOrders = await this.externalOrderAPI.getOrdersByCustomer(customerId, limit);
          
          const orders: Order[] = [];
          const errors: string[] = [];

          for (const externalOrder of externalOrders) {
            const result = this.translateData(externalOrder);
            if (result.isSuccess()) {
              orders.push(result.value);
            } else {
              errors.push(`Order ${externalOrder.order_reference}: ${result.error.message}`);
            }
          }

          if (orders.length === 0 && errors.length > 0) {
            return Result.failure(new Error(`All orders failed: ${errors.join(', ')}`));
          }

          return Result.success(orders);
        } catch (error) {
          return Result.failure(new Error(`Failed to get customer orders: ${error.message}`));
        }
      });
    });
  }

  private convertToExternalFormat(order: Order): ThirdPartyOrderData {
    return {
      order_reference: order.id,
      buyer_id: order.customerId,
      line_items: order.items.map(item => ({
        product_sku: item.productId,
        qty: item.quantity,
        price_per_unit: item.unitPrice,
        line_total: item.totalPrice
      })),
      grand_total: order.totalAmount,
      currency: order.currency,
      order_state: this.convertOrderStatus(order.status),
      timestamp: Math.floor(order.createdAt.getTime() / 1000),
      delivery_address: {
        address_line_1: order.shippingAddress.street,
        city: order.shippingAddress.city,
        zip_code: order.shippingAddress.postalCode,
        country_code: order.shippingAddress.country
      }
    };
  }

  private convertOrderStatus(status: Order['status']): string {
    const statusMap: Record<Order['status'], string> = {
      'pending': 'new',
      'confirmed': 'processing',
      'shipped': 'shipped',
      'delivered': 'delivered',
      'cancelled': 'cancelled'
    };

    return statusMap[status] || 'new';
  }
}

// Cached ACL decorator for performance
export class CachedOrderACL {
  private cachedACL: CachingACLDecorator<ThirdPartyOrderData, Order>;

  constructor(baseACL: ResilientOrderACL) {
    this.cachedACL = new CachingACLDecorator(baseACL, {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      keyGenerator: (method, args) => `${method}_${args.join('_')}`
    });
  }

  async getOrder(orderId: string): Promise<Result<Order, Error>> {
    return this.cachedACL.execute('getOrder', [orderId]);
  }

  async getOrdersByCustomer(customerId: string, limit?: number): Promise<Result<Order[], Error>> {
    return this.cachedACL.execute('getOrdersByCustomer', [customerId, limit || 10]);
  }

  // No caching for mutations
  async submitOrder(request: OrderSubmissionRequest): Promise<Result<Order, Error>> {
    // Clear related cache entries
    this.cachedACL.invalidatePattern(`getOrdersByCustomer_${request.order.customerId}`);
    
    // Execute without caching
    return (this.cachedACL as any).baseACL.submitOrder(request);
  }
}

// Usage in domain service
export class OrderManagementService {
  constructor(private orderACL: CachedOrderACL) {}

  async processCustomerOrder(request: OrderSubmissionRequest): Promise<Result<Order, Error>> {
    // Submit order through resilient ACL
    const result = await this.orderACL.submitOrder(request);
    
    if (result.isSuccess()) {
      // Additional domain logic can be added here
      console.log(`Order ${result.value.id} processed successfully`);
    }
    
    return result;
  }

  async getCustomerOrderHistory(customerId: string): Promise<Result<Order[], Error>> {
    // Benefit from caching for repeated requests
    return await this.orderACL.getOrdersByCustomer(customerId);
  }
}

// External API interface
interface ExternalOrderAPI {
  getOrder(id: string): Promise<ThirdPartyOrderData>;
  submitOrder(request: ExternalOrderSubmission): Promise<ThirdPartyOrderData>;
  getOrdersByCustomer(customerId: string, limit: number): Promise<ThirdPartyOrderData[]>;
}

interface ExternalOrderSubmission {
  order: ThirdPartyOrderData;
  validate_inventory: boolean;
  send_notification: boolean;
}
```

## Key Features

- **Circuit Breaker**: Prevents cascading failures when external system is down
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Caching**: Performance optimization for frequently accessed data
- **Data Validation**: Comprehensive validation of external data before translation
- **Cache Invalidation**: Smart cache invalidation for data consistency

## Common Pitfalls

- **Cache Inconsistency**: Implement proper cache invalidation strategies
- **Retry Storms**: Use jitter in retry delays to prevent synchronized retries
- **Circuit Breaker Tuning**: Monitor and adjust thresholds based on actual usage

## Related Examples

- [Multi-System Integration](/packages/acl/src/examples/intermediate/example-2.md)
- [Enterprise ACL Orchestration](/packages/acl/src/examples/advanced/example-1.md)