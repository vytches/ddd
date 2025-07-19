# Basic Business Policy Implementation

**Focus**: E-commerce order validation with basic business rules  
**Domain**: E-commerce  
**Complexity**: Basic  
**Dependencies**: @vytches-ddd/policies, @vytches-ddd/utils

## Business Context

This example demonstrates basic policy validation for an e-commerce system where orders must meet certain criteria before processing:
- VIP customers get special treatment
- Order amounts must be within credit limits
- Inventory must be available

## Implementation

```typescript
// order-validation-policy.ts
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';
import { Result } from '@vytches-ddd/utils';
import { Order, Customer, InventoryItem } from '../types'; // ALWAYS import from app

// Basic specifications for order validation
class MinimumOrderAmountSpec {
  constructor(private minAmount: number) {}
  
  isSatisfiedBy(order: Order): boolean {
    return order.amount >= this.minAmount;
  }
}

class CustomerCreditLimitSpec {
  isSatisfiedBy(order: Order): boolean {
    return order.amount <= order.customer.creditLimit;
  }
}

class InventoryAvailabilitySpec {
  isSatisfiedBy(order: Order): boolean {
    return order.items.every(item => 
      item.requestedQuantity <= item.availableQuantity
    );
  }
}

// ⭐ Basic Order Validation Policy
export class OrderValidationPolicy {
  private policy = PolicyBuilder.create<Order>()
    .withId('order-validation')
    .withDomain('e-commerce')
    .withName('Order Validation Policy')
    .must(new MinimumOrderAmountSpec(10))
    .withCode('ORDER_TOO_SMALL')
    .withMessage('Order amount must be at least $10')
    .withSeverity('ERROR')
    .and()
    .must(new CustomerCreditLimitSpec())
    .withCode('CREDIT_LIMIT_EXCEEDED')
    .withMessage('Order amount exceeds customer credit limit')
    .withSeverity('ERROR')
    .and()
    .must(new InventoryAvailabilitySpec())
    .withCode('INSUFFICIENT_INVENTORY')
    .withMessage('One or more items are out of stock')
    .withSeverity('ERROR')
    .build();

  async validateOrder(order: Order, customerId: string): Promise<Result<Order, Error>> {
    try {
      const context = PolicyContext.create()
        .withUserId(customerId)
        .withRequestId(`order-${order.id}`)
        .withCorrelationId(`validation-${Date.now()}`)
        .build();

      const result = await this.policy.check({ entity: order, context });
      
      if (result.isFailure()) {
        const violations = result.error.violations;
        const errorMessages = violations.map(v => `${v.code}: ${v.message}`).join(', ');
        return Result.failure(new Error(`Order validation failed: ${errorMessages}`));
      }

      return Result.success(order);
    } catch (error) {
      return Result.failure(new Error(`Policy validation error: ${error.message}`));
    }
  }

  // Special handling for VIP customers
  async validateVIPOrder(order: Order, customerId: string): Promise<Result<Order, Error>> {
    try {
      // VIP customers get relaxed minimum order requirement
      const vipPolicy = PolicyBuilder.create<Order>()
        .withId('vip-order-validation')
        .withDomain('e-commerce')
        .withName('VIP Order Validation Policy')
        .must(new MinimumOrderAmountSpec(1)) // Lower minimum for VIP
        .withCode('VIP_ORDER_TOO_SMALL')
        .withMessage('VIP order amount must be at least $1')
        .withSeverity('WARNING')
        .and()
        .must(new CustomerCreditLimitSpec())
        .withCode('VIP_CREDIT_LIMIT_EXCEEDED')
        .withMessage('Order amount exceeds VIP customer credit limit')
        .withSeverity('ERROR')
        .and()
        .must(new InventoryAvailabilitySpec())
        .withCode('VIP_INSUFFICIENT_INVENTORY')
        .withMessage('One or more items are out of stock')
        .withSeverity('ERROR')
        .build();

      const context = PolicyContext.create()
        .withUserId(customerId)
        .withRequestId(`vip-order-${order.id}`)
        .withCorrelationId(`vip-validation-${Date.now()}`)
        .withContext({ customerType: 'VIP' })
        .build();

      const result = await vipPolicy.check({ entity: order, context });
      
      if (result.isFailure()) {
        const violations = result.error.violations;
        const errorMessages = violations.map(v => `${v.code}: ${v.message}`).join(', ');
        return Result.failure(new Error(`VIP order validation failed: ${errorMessages}`));
      }

      return Result.success(order);
    } catch (error) {
      return Result.failure(new Error(`VIP policy validation error: ${error.message}`));
    }
  }
}
```

## Key Features

- **Simple Policy Creation**: Uses PolicyBuilder for fluent policy construction
- **Multiple Specifications**: Combines business rules with AND logic
- **Error Handling**: Comprehensive error messages with violation codes
- **Context Support**: Includes correlation and request tracking
- **VIP Handling**: Demonstrates policy variations for different customer types

## Usage Example

```typescript
// Usage in service
export class OrderService {
  constructor(private orderPolicy: OrderValidationPolicy) {}

  async processOrder(order: Order): Promise<Result<Order, Error>> {
    try {
      // Validate based on customer type
      const validationResult = order.customer.isVIP 
        ? await this.orderPolicy.validateVIPOrder(order, order.customer.id)
        : await this.orderPolicy.validateOrder(order, order.customer.id);

      if (validationResult.isFailure()) {
        return Result.failure(validationResult.error);
      }

      // Process the validated order
      return Result.success(validationResult.value);
    } catch (error) {
      return Result.failure(new Error(`Order processing failed: ${error.message}`));
    }
  }
}
```

## Common Pitfalls

- **Hardcoded Values**: Avoid hardcoding business rules - use configuration
- **Missing Context**: Always provide meaningful context for audit trails
- **Error Handling**: Don't ignore policy violations - handle them appropriately
- **Performance**: Consider caching for frequently used policies