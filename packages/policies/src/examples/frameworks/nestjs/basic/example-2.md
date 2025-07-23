# Policy Specification Integration in NestJS

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: basic  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: specification-pattern, business-rules, validation  
**Dependencies**: @nestjs/common, @vytches-ddd/policies

## Description

Integration of specification pattern with @vytches-ddd/policies in NestJS
applications, demonstrating business rule composition and reusable validation
logic using manual instantiation.

## Business Context

Business applications often have complex validation rules that need to be
composed and reused across different contexts. This example shows how to
integrate specification patterns with policies for flexible business rule
management.

## Code Example

```typescript
// order-validation.service.ts
import { Injectable } from '@nestjs/common';
import {
  PolicyBuilder,
  PolicyResult,
  ISpecification,
  SpecificationBuilder,
} from '@vytches-ddd/policies';
import { Order, OrderItem, Customer } from './types'; // From your application

/**
 * NestJS service demonstrating specification pattern integration
 * Shows reusable business rule composition
 */
@Injectable()
export class OrderValidationService {
  private readonly orderValidationPolicy;
  private readonly minimumOrderValueSpec: ISpecification<Order>;
  private readonly validCustomerSpec: ISpecification<Order>;
  private readonly itemAvailabilitySpec: ISpecification<Order>;

  constructor() {
    // ⭐ FOCUS: Create reusable specifications
    this.minimumOrderValueSpec = SpecificationBuilder.create<Order>()
      .withRule(order => order.totalValue >= 10.0)
      .withErrorCode('ORDER_VALUE_TOO_LOW')
      .withErrorMessage('Order must be at least $10.00')
      .build();

    this.validCustomerSpec = SpecificationBuilder.create<Order>()
      .withRule(
        order => order.customer.isActive && !order.customer.isBlacklisted
      )
      .withErrorCode('INVALID_CUSTOMER')
      .withErrorMessage('Customer account is not valid for orders')
      .build();

    this.itemAvailabilitySpec = SpecificationBuilder.create<Order>()
      .withRule(order => order.items.every(item => item.inStock))
      .withErrorCode('ITEMS_NOT_AVAILABLE')
      .withErrorMessage('One or more items are out of stock')
      .build();

    // ⭐ FOCUS: Compose specifications into policy
    this.orderValidationPolicy = PolicyBuilder.create<Order>()
      .withId('order-validation')
      .withName('Order Validation Policy')
      .withDomain('orders')
      .must(this.minimumOrderValueSpec)
      .and()
      .must(this.validCustomerSpec)
      .and()
      .must(this.itemAvailabilitySpec)
      .build();
  }

  /**
   * ✅ FOCUS: Comprehensive order validation using composed specifications
   */
  async validateOrder(orderData: {
    items: OrderItem[];
    customer: Customer;
    totalValue: number;
  }): Promise<PolicyResult<Order>> {
    try {
      const order: Order = {
        id: `order-${Date.now()}`,
        items: orderData.items,
        customer: orderData.customer,
        totalValue: orderData.totalValue,
        status: 'pending',
        createdAt: new Date(),
      };

      // Policy validation with specification composition
      return await this.orderValidationPolicy.check({
        entity: order,
        context: {
          operation: 'order-creation',
          customerId: orderData.customer.id,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Order validation failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Individual specification validation for targeted checks
   */
  async checkMinimumOrderValue(order: Order): Promise<boolean> {
    try {
      return await this.minimumOrderValueSpec.isSatisfiedBy(order);
    } catch (error) {
      throw new Error(`Minimum order value check failed: ${error.message}`);
    }
  }

  /**
   * ✅ FOCUS: Specification composition for custom validation scenarios
   */
  async validatePriorityOrder(order: Order): Promise<PolicyResult<Order>> {
    try {
      // Create priority-specific policy with different minimum value
      const priorityMinimumSpec = SpecificationBuilder.create<Order>()
        .withRule(order => order.totalValue >= 50.0)
        .withErrorCode('PRIORITY_ORDER_VALUE_TOO_LOW')
        .withErrorMessage('Priority orders must be at least $50.00')
        .build();

      const priorityPolicy = PolicyBuilder.create<Order>()
        .withId('priority-order-validation')
        .withName('Priority Order Validation')
        .withDomain('orders')
        .must(priorityMinimumSpec)
        .and()
        .must(this.validCustomerSpec)
        .and()
        .must(this.itemAvailabilitySpec)
        .build();

      return await priorityPolicy.check({
        entity: order,
        context: {
          operation: 'priority-order-creation',
          priority: 'high',
        },
      });
    } catch (error) {
      throw new Error(`Priority order validation failed: ${error.message}`);
    }
  }
}
```

## Key Features

- **📋 Specification Pattern**: Reusable business rule components
- **🔗 Rule Composition**: Flexible combination of validation logic
- **🎯 Targeted Validation**: Individual specification checking
- **🏗️ Policy Building**: Specification-based policy construction

## Integration Benefits

### **Reusability**

- **Modular Rules**: Specifications can be reused across different policies
- **Composition Flexibility**: Mix and match business rules as needed
- **Test Isolation**: Individual specifications are easily testable

### **Maintainability**

- **Single Responsibility**: Each specification handles one business rule
- **Clear Semantics**: Specifications express business logic clearly
- **Easy Extension**: New rules can be added without modifying existing code

## Common Pitfalls

- **❌ Over-Specification**: Don't create specifications for trivial validations
- **❌ Specification Coupling**: Keep specifications independent of each other
- **❌ Complex Logic**: Use composition instead of complex single specifications

## Related Examples

- [Example 1: Basic Policy Usage](./example-1.md) - Simple policy integration
  patterns
- [Basic: Specification Pattern](../../basic/example-2.md) - Core specification
  usage
- [Intermediate: Policy Behaviors](../intermediate/example-1.md) - Advanced
  policy enhancement patterns
