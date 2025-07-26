# Domain Service with Policy Integration - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-services **Complexity**:
intermediate **Domain**: order-management **Patterns**: domain-service,
policy-enforcement, business-rules **Dependencies**: @vytches/ddd-core,
@vytches/ddd-policies

## Description

This example demonstrates how to integrate business policies within domain
services. It shows policy enforcement, validation, and business rule evaluation
as part of service operations.

## Business Context

Business operations often require complex policy enforcement: pricing rules,
discount policies, approval workflows, and regulatory compliance. Domain
services can coordinate policy evaluation while maintaining business rule
integrity.

## Code Example

````typescript
// order-validation.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import {
  PolicyBuilder,
  PolicyContext,
  PolicyRegistry,
} from '@vytches/ddd-policies';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  Customer,
  CreateOrderCommand,
  OrderProcessingResult,
  LoyaltyLevel,
  IOrderRepository,
  ICustomerRepository,
} from '../types';

/**
 * @llm-summary Domain service with integrated business policy enforcement
 * @llm-domain order-management
 * @llm-complexity Medium
 *
 * @description
 * Validates orders using business policies and rules.
 * Enforces pricing policies, discount rules, and approval workflows.
 *
 * @example
 * ```typescript
 * const service = new OrderValidationService(orderRepo, customerRepo, policyRegistry);
 * const result = await service.validateAndProcessOrder(command, context);
 * ```
 */
export class OrderValidationService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly policyRegistry: PolicyRegistry
  ) {
    super('OrderValidationService');
  }

  /**
   * Validates and processes order with policy enforcement
   *
   * @param command - Order creation command
   * @param context - Policy context for evaluation
   * @returns Result containing processing result or error
   */
  async validateAndProcessOrder(
    command: CreateOrderCommand,
    context: PolicyContext
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // Step 1: Get customer for policy evaluation
      const customer = await this.customerRepository.findById(command.userId);
      if (!customer) {
        return Result.failure(
          new Error(`Customer not found: ${command.userId}`)
        );
      }

      // Step 2: Create order for validation
      const order = await this.buildOrder(command, customer);

      // Step 3: Apply order validation policies
      const validationResult = await this.applyOrderValidationPolicies(
        order,
        customer,
        context
      );
      if (validationResult.isFailure()) {
        return Result.failure(validationResult.error);
      }

      // Step 4: Apply pricing policies
      const pricingResult = await this.applyPricingPolicies(
        order,
        customer,
        context
      );
      if (pricingResult.isFailure()) {
        return Result.failure(pricingResult.error);
      }

      // Step 5: Apply discount policies
      const discountResult = await this.applyDiscountPolicies(
        order,
        customer,
        context
      );
      if (discountResult.isSuccess()) {
        // Apply discount to order
        order.totalAmount = discountResult.value.adjustedAmount;
      }

      // Step 6: Check approval policies
      const approvalResult = await this.checkApprovalPolicies(
        order,
        customer,
        context
      );
      if (approvalResult.isFailure()) {
        return Result.failure(approvalResult.error);
      }

      // Step 7: Save validated order
      const savedOrder = await this.orderRepository.save(order);

      const result: OrderProcessingResult = {
        orderId: savedOrder.id,
        status: savedOrder.status,
        inventoryUpdates: [],
        notifications: [],
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new Error(`Order validation failed: ${error.message}`)
      );
    }
  }

  /**
   * Applies order validation policies
   */
  private async applyOrderValidationPolicies(
    order: Order,
    customer: Customer,
    context: PolicyContext
  ): Promise<Result<void, Error>> {
    // Get order validation policy
    const policy = this.policyRegistry.resolve({
      domain: 'order-management',
      id: 'order-validation',
    });

    if (!policy) {
      return Result.failure(new Error('Order validation policy not found'));
    }

    // Execute policy
    const result = await policy.check({ entity: order, context });

    if (result.isFailure()) {
      const violations = result.error.violations;
      const errorMessages = violations.map(v => v.message).join(', ');
      return Result.failure(
        new Error(`Order validation failed: ${errorMessages}`)
      );
    }

    return Result.success();
  }

  /**
   * Applies pricing policies
   */
  private async applyPricingPolicies(
    order: Order,
    customer: Customer,
    context: PolicyContext
  ): Promise<Result<void, Error>> {
    // Create dynamic pricing policy
    const pricingPolicy = PolicyBuilder.create<Order>()
      .withId('pricing-validation')
      .withDomain('order-management')
      .withName('Pricing Validation Policy')
      .must(order => order.totalAmount > 0)
      .withCode('INVALID_AMOUNT')
      .withMessage('Order total must be greater than zero')
      .withSeverity('ERROR')
      .and()
      .must(order => order.totalAmount <= 10000)
      .withCode('AMOUNT_TOO_HIGH')
      .withMessage('Order total exceeds maximum allowed amount')
      .withSeverity('ERROR')
      .when(customer => customer.loyaltyLevel === LoyaltyLevel.BRONZE)
      .then()
      .must(order => order.totalAmount <= 5000)
      .withCode('BRONZE_LIMIT_EXCEEDED')
      .withMessage('Bronze customers have a $5000 order limit')
      .withSeverity('ERROR')
      .build();

    // Execute pricing policy
    const result = await pricingPolicy.check({ entity: order, context });

    if (result.isFailure()) {
      const violations = result.error.violations;
      const errorMessages = violations.map(v => v.message).join(', ');
      return Result.failure(
        new Error(`Pricing validation failed: ${errorMessages}`)
      );
    }

    return Result.success();
  }

  /**
   * Applies discount policies
   */
  private async applyDiscountPolicies(
    order: Order,
    customer: Customer,
    context: PolicyContext
  ): Promise<
    Result<{ adjustedAmount: number; discountApplied: number }, Error>
  > {
    let discountPercentage = 0;

    // Loyalty discount policy
    const loyaltyPolicy = PolicyBuilder.create<Customer>()
      .withId('loyalty-discount')
      .withDomain('order-management')
      .when(customer => customer.loyaltyLevel === LoyaltyLevel.GOLD)
      .then()
      .must(customer => customer.totalSpent >= 10000)
      .withCode('GOLD_DISCOUNT_ELIGIBLE')
      .withMessage('Gold customer eligible for 10% discount')
      .when(customer => customer.loyaltyLevel === LoyaltyLevel.PLATINUM)
      .then()
      .must(customer => customer.totalSpent >= 50000)
      .withCode('PLATINUM_DISCOUNT_ELIGIBLE')
      .withMessage('Platinum customer eligible for 15% discount')
      .build();

    const loyaltyResult = await loyaltyPolicy.check({
      entity: customer,
      context,
    });

    if (loyaltyResult.isSuccess()) {
      switch (customer.loyaltyLevel) {
        case LoyaltyLevel.GOLD:
          discountPercentage = 0.1;
          break;
        case LoyaltyLevel.PLATINUM:
          discountPercentage = 0.15;
          break;
      }
    }

    // Large order discount policy
    const largeOrderPolicy = PolicyBuilder.create<Order>()
      .withId('large-order-discount')
      .withDomain('order-management')
      .when(order => order.totalAmount >= 5000)
      .then()
      .must(order => order.items.length >= 5)
      .withCode('LARGE_ORDER_DISCOUNT_ELIGIBLE')
      .withMessage('Large order eligible for 5% discount')
      .build();

    const largeOrderResult = await largeOrderPolicy.check({
      entity: order,
      context,
    });

    if (largeOrderResult.isSuccess()) {
      discountPercentage = Math.max(discountPercentage, 0.05);
    }

    const discountAmount = order.totalAmount * discountPercentage;
    const adjustedAmount = order.totalAmount - discountAmount;

    return Result.success({
      adjustedAmount,
      discountApplied: discountAmount,
    });
  }

  /**
   * Checks approval policies
   */
  private async checkApprovalPolicies(
    order: Order,
    customer: Customer,
    context: PolicyContext
  ): Promise<Result<void, Error>> {
    // Manager approval policy
    const approvalPolicy = PolicyBuilder.create<Order>()
      .withId('manager-approval')
      .withDomain('order-management')
      .when(order => order.totalAmount > 10000)
      .then()
      .must(order => this.hasManagerApproval(order, context))
      .withCode('MANAGER_APPROVAL_REQUIRED')
      .withMessage('Orders over $10,000 require manager approval')
      .withSeverity('ERROR')
      .when(
        customer =>
          customer.loyaltyLevel === LoyaltyLevel.BRONZE &&
          order.totalAmount > 2000
      )
      .then()
      .must(order => this.hasManagerApproval(order, context))
      .withCode('BRONZE_APPROVAL_REQUIRED')
      .withMessage('Bronze customers need approval for orders over $2,000')
      .withSeverity('ERROR')
      .build();

    const result = await approvalPolicy.check({ entity: order, context });

    if (result.isFailure()) {
      const violations = result.error.violations;
      const errorMessages = violations.map(v => v.message).join(', ');
      return Result.failure(new Error(`Approval required: ${errorMessages}`));
    }

    return Result.success();
  }

  /**
   * Builds order from command
   */
  private async buildOrder(
    command: CreateOrderCommand,
    customer: Customer
  ): Promise<Order> {
    // Calculate total amount (simplified)
    const totalAmount = command.items.reduce(
      (sum, item) => sum + item.quantity * 100,
      0
    );

    return {
      id: this.generateOrderId(),
      userId: command.userId,
      items: command.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: 100, // Simplified pricing
        name: `Product ${item.productId}`,
      })),
      status: 'pending',
      totalAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Checks if order has manager approval
   */
  private hasManagerApproval(order: Order, context: PolicyContext): boolean {
    // In real implementation, this would check approval status
    return context.metadata?.managerApproved === true;
  }

  /**
   * Generates unique order identifier
   */
  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
````

## Key Features

- **Policy Integration**: Seamlessly integrates with @vytches/ddd-policies
- **Business Rules**: Enforces complex business rules through policies
- **Dynamic Policies**: Creates policies based on runtime conditions
- **Conditional Logic**: Uses when/then patterns for complex business logic
- **Error Handling**: Provides detailed policy violation messages
- **Validation Layers**: Multiple validation layers (order, pricing, discount,
  approval)

## Common Pitfalls

- **Policy Ordering**: Be careful about policy execution order
- **Context Propagation**: Ensure proper context is passed to policies
- **Policy Versioning**: Consider policy changes and backward compatibility
- **Performance**: Cache policies when possible to avoid repeated creation
- **Error Messages**: Provide clear, actionable error messages

## Related Examples

- [Event-Driven Domain Service](./example-1.md) - Event-driven patterns
- [Cross-Aggregate Domain Service](./example-3.md) - Advanced coordination
- [Business Policy examples](../../policies/examples/) - Policy creation
  patterns
