# Multi-System Integration with Composite ACL

**Version**: 1.0.0  
**Package**: @vytches-ddd/acl  
**Complexity**: Intermediate  
**Domain**: E-commerce Platform  
**Patterns**: Composite ACL, System Orchestration, Data Aggregation  
**Dependencies**: @vytches-ddd/acl, @vytches-ddd/events, @vytches-ddd/core

## Description

This example demonstrates how to integrate multiple external systems through a composite ACL that orchestrates data from different sources while maintaining consistency and handling partial failures.

## Business Context

An e-commerce platform needs to aggregate product information from multiple suppliers, payment processing from different gateways, and shipping data from various carriers, all through a unified interface.

## Code Example

```typescript
// composite-ecommerce.acl.ts
import { CompositeACL, IDataAggregator } from '@vytches-ddd/acl';
import { DomainEvent, EventBus } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { 
  Product, 
  PaymentResult, 
  Customer, 
  Order,
  ExternalCustomerData,
  LegacyInventoryData,
  ExternalPaymentResponse 
} from '../types'; // From your application

// Product aggregation from multiple suppliers
export class ProductAggregationACL implements IDataAggregator<Product> {
  constructor(
    private supplierACLs: Map<string, SupplierACL>,
    private eventBus: EventBus
  ) {}

  async aggregateProduct(productId: string): Promise<Result<Product, Error>> {
    const productResults: Array<{ supplier: string; result: Result<Product, Error> }> = [];
    
    // Query all suppliers concurrently
    const promises = Array.from(this.supplierACLs.entries()).map(async ([supplierId, acl]) => {
      try {
        const result = await acl.getProduct(productId);
        return { supplier: supplierId, result };
      } catch (error) {
        return { 
          supplier: supplierId, 
          result: Result.failure(new Error(`Supplier ${supplierId} failed: ${error.message}`))
        };
      }
    });

    const results = await Promise.all(promises);
    productResults.push(...results);

    // Find the best result (prioritize successful results)
    const successfulResults = productResults.filter(r => r.result.isSuccess());
    
    if (successfulResults.length === 0) {
      const errors = productResults.map(r => r.result.error?.message).join(', ');
      await this.publishProductRetrievalFailed(productId, errors);
      return Result.failure(new Error(`No supplier could provide product ${productId}: ${errors}`));
    }

    // Use the first successful result or implement priority logic
    const bestResult = this.selectBestProduct(successfulResults);
    
    // Enrich with data from other sources if available
    const enrichedProduct = await this.enrichProductData(bestResult.result.value, successfulResults);
    
    await this.publishProductAggregated(productId, enrichedProduct, successfulResults.length);
    
    return Result.success(enrichedProduct);
  }

  private selectBestProduct(results: Array<{ supplier: string; result: Result<Product, Error> }>): { supplier: string; result: Result<Product, Error> } {
    // Priority order: premium suppliers first
    const priorityOrder = ['premium-supplier', 'wholesale-supplier', 'dropship-supplier'];
    
    for (const priority of priorityOrder) {
      const match = results.find(r => r.supplier === priority);
      if (match) return match;
    }
    
    // Default to first successful result
    return results[0];
  }

  private async enrichProductData(
    baseProduct: Product, 
    allResults: Array<{ supplier: string; result: Result<Product, Error> }>
  ): Promise<Product> {
    let enrichedProduct = { ...baseProduct };
    
    // Aggregate inventory quantities from all suppliers
    let totalQuantity = baseProduct.availability.quantity;
    
    for (const { result } of allResults) {
      if (result.isSuccess() && result.value.id === baseProduct.id) {
        totalQuantity += result.value.availability.quantity;
      }
    }
    
    enrichedProduct.availability.quantity = totalQuantity;
    
    return enrichedProduct;
  }

  private async publishProductAggregated(productId: string, product: Product, sourceCount: number): Promise<void> {
    await this.eventBus.publish(new DomainEvent('ProductAggregated', {
      productId,
      product,
      sourceCount,
      timestamp: new Date()
    }));
  }

  private async publishProductRetrievalFailed(productId: string, errors: string): Promise<void> {
    await this.eventBus.publish(new DomainEvent('ProductRetrievalFailed', {
      productId,
      errors,
      timestamp: new Date()
    }));
  }
}

// Composite e-commerce ACL orchestrating multiple systems
export class ECommerceCompositeACL extends CompositeACL {
  private customerACL: CustomerManagementACL;
  private productAggregationACL: ProductAggregationACL;
  private paymentACL: PaymentProcessingACL;
  private shippingACL: ShippingManagementACL;

  constructor(
    customerACL: CustomerManagementACL,
    productAggregationACL: ProductAggregationACL,
    paymentACL: PaymentProcessingACL,
    shippingACL: ShippingManagementACL,
    private eventBus: EventBus
  ) {
    super([customerACL, productAggregationACL, paymentACL, shippingACL]);
    
    this.customerACL = customerACL;
    this.productAggregationACL = productAggregationACL;
    this.paymentACL = paymentACL;
    this.shippingACL = shippingACL;
  }

  async processCompleteOrder(orderId: string): Promise<Result<CompleteOrderResult, Error>> {
    try {
      // Step 1: Get order details
      const orderResult = await this.getOrderDetails(orderId);
      if (orderResult.isFailure()) {
        return Result.failure(orderResult.error);
      }
      
      const order = orderResult.value;

      // Step 2: Validate customer (with fallback to guest checkout)
      const customerResult = await this.validateCustomer(order.customerId);
      
      // Step 3: Verify product availability from all suppliers
      const productValidationResult = await this.validateOrderProducts(order);
      if (productValidationResult.isFailure()) {
        await this.publishOrderValidationFailed(orderId, 'Product validation failed');
        return Result.failure(productValidationResult.error);
      }

      // Step 4: Process payment
      const paymentResult = await this.processOrderPayment(order);
      if (paymentResult.isFailure()) {
        await this.publishOrderValidationFailed(orderId, 'Payment failed');
        return Result.failure(paymentResult.error);
      }

      // Step 5: Arrange shipping
      const shippingResult = await this.arrangeShipping(order);
      if (shippingResult.isFailure()) {
        // Payment succeeded but shipping failed - handle compensation
        await this.handleShippingFailure(order, paymentResult.value);
        return Result.failure(shippingResult.error);
      }

      const result: CompleteOrderResult = {
        order,
        customer: customerResult.isSuccess() ? customerResult.value : null,
        payment: paymentResult.value,
        shipping: shippingResult.value
      };

      await this.publishOrderProcessed(orderId, result);
      
      return Result.success(result);
    } catch (error) {
      await this.publishOrderProcessingError(orderId, error.message);
      return Result.failure(new Error(`Order processing failed: ${error.message}`));
    }
  }

  private async validateCustomer(customerId: string): Promise<Result<Customer, Error>> {
    try {
      return await this.customerACL.getCustomer(customerId);
    } catch (error) {
      // Customer validation failed - allow guest checkout
      return Result.failure(new Error(`Customer validation failed: ${error.message}`));
    }
  }

  private async validateOrderProducts(order: Order): Promise<Result<Product[], Error>> {
    const productValidations = order.items.map(async (item) => {
      const productResult = await this.productAggregationACL.aggregateProduct(item.productId);
      
      if (productResult.isFailure()) {
        return Result.failure(new Error(`Product ${item.productId} not available`));
      }

      const product = productResult.value;
      if (product.availability.quantity < item.quantity) {
        return Result.failure(new Error(`Insufficient stock for ${item.productId}`));
      }

      return Result.success(product);
    });

    const results = await Promise.all(productValidations);
    const failures = results.filter(r => r.isFailure());
    
    if (failures.length > 0) {
      const errors = failures.map(f => f.error.message).join(', ');
      return Result.failure(new Error(`Product validation failed: ${errors}`));
    }

    const products = results.map(r => r.value);
    return Result.success(products);
  }

  private async processOrderPayment(order: Order): Promise<Result<PaymentResult, Error>> {
    const paymentRequest = {
      orderId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      customerId: order.customerId,
      paymentMethod: {
        type: 'credit_card' as const,
        details: {}
      }
    };

    return await this.paymentACL.processPayment(paymentRequest);
  }

  private async arrangeShipping(order: Order): Promise<Result<ShippingResult, Error>> {
    const shippingRequest = {
      orderId: order.id,
      items: order.items,
      shippingAddress: order.shippingAddress,
      preferredCarrier: 'fastest'
    };

    return await this.shippingACL.arrangeShipping(shippingRequest);
  }

  private async handleShippingFailure(order: Order, payment: PaymentResult): Promise<void> {
    // Implement compensation logic - refund payment
    await this.publishShippingCompensationRequired(order.id, payment.transactionId);
    
    // Could trigger automatic refund or manual review
    try {
      await this.paymentACL.refundPayment(payment.transactionId);
    } catch (error) {
      // Log refund failure for manual intervention
      await this.publishRefundFailed(order.id, payment.transactionId, error.message);
    }
  }

  // Event publishing methods
  private async publishOrderProcessed(orderId: string, result: CompleteOrderResult): Promise<void> {
    await this.eventBus.publish(new DomainEvent('OrderProcessedSuccessfully', {
      orderId,
      customerId: result.order.customerId,
      totalAmount: result.order.totalAmount,
      paymentId: result.payment.transactionId,
      timestamp: new Date()
    }));
  }

  private async publishOrderValidationFailed(orderId: string, reason: string): Promise<void> {
    await this.eventBus.publish(new DomainEvent('OrderValidationFailed', {
      orderId,
      reason,
      timestamp: new Date()
    }));
  }

  private async publishOrderProcessingError(orderId: string, error: string): Promise<void> {
    await this.eventBus.publish(new DomainEvent('OrderProcessingError', {
      orderId,
      error,
      timestamp: new Date()
    }));
  }

  private async publishShippingCompensationRequired(orderId: string, paymentId: string): Promise<void> {
    await this.eventBus.publish(new DomainEvent('ShippingCompensationRequired', {
      orderId,
      paymentId,
      timestamp: new Date()
    }));
  }

  private async publishRefundFailed(orderId: string, paymentId: string, error: string): Promise<void> {
    await this.eventBus.publish(new DomainEvent('RefundFailed', {
      orderId,
      paymentId,
      error,
      timestamp: new Date()
    }));
  }

  private async getOrderDetails(orderId: string): Promise<Result<Order, Error>> {
    // Implementation would retrieve order from domain repository
    // This is simplified for the example
    throw new Error('Implementation depends on your order repository');
  }
}

// Result types
interface CompleteOrderResult {
  order: Order;
  customer: Customer | null;
  payment: PaymentResult;
  shipping: ShippingResult;
}

interface ShippingResult {
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: Date;
  cost: number;
}

interface ShippingRequest {
  orderId: string;
  items: Order['items'];
  shippingAddress: Order['shippingAddress'];
  preferredCarrier: string;
}

// External ACL interfaces (simplified)
interface SupplierACL {
  getProduct(productId: string): Promise<Result<Product, Error>>;
}

interface PaymentProcessingACL {
  processPayment(request: any): Promise<Result<PaymentResult, Error>>;
  refundPayment(transactionId: string): Promise<Result<void, Error>>;
}

interface ShippingManagementACL {
  arrangeShipping(request: ShippingRequest): Promise<Result<ShippingResult, Error>>;
}
```

## Key Features

- **Multi-System Orchestration**: Coordinates multiple external systems
- **Data Aggregation**: Combines data from multiple sources intelligently
- **Partial Failure Handling**: Graceful degradation when some systems fail
- **Event-Driven Integration**: Publishes events for observability and integration
- **Compensation Logic**: Handles rollback scenarios when operations fail

## Common Pitfalls

- **Cascading Failures**: Implement proper isolation between systems
- **Data Consistency**: Handle eventual consistency across systems
- **Performance**: Consider parallel execution and timeouts for each system

## Related Examples

- [Enterprise ACL Orchestration](/packages/acl/src/examples/advanced/example-1.md)
- [Event-Driven Integration](/packages/acl/src/examples/advanced/example-2.md)