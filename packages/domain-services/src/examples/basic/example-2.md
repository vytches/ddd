# Domain Service with Repository - Beginner Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-services **Complexity**:
beginner **Domain**: order-management **Patterns**: domain-service,
repository-coordination **Dependencies**: @vytches/ddd-core,
@vytches/ddd-repositories

## Description

This example demonstrates how to create a domain service that coordinates
multiple repositories. It shows proper dependency injection and repository
coordination patterns within a domain service.

## Business Context

Order processing typically involves multiple data sources: orders, products,
inventory, and customers. A domain service can coordinate these repositories
while maintaining transactional consistency and domain boundaries.

## Code Example

````typescript
// order-processing.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  Product,
  CreateOrderCommand,
  OrderCreatedEvent,
  IOrderRepository,
  IProductRepository,
  OrderProcessingResult,
} from '../types';

/**
 * @llm-summary Domain service for order processing operations
 * @llm-domain order-management
 * @llm-complexity Simple
 *
 * @description
 * Coordinates order creation across multiple repositories.
 * Handles product validation, inventory checks, and order persistence.
 *
 * @example
 * ```typescript
 * const service = new OrderProcessingService(orderRepo, productRepo);
 * const result = await service.processOrder({
 *   userId: 'user-123',
 *   items: [{ productId: 'prod-1', quantity: 2 }]
 * });
 * ```
 */
export class OrderProcessingService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productRepository: IProductRepository
  ) {
    super('OrderProcessingService');
  }

  /**
   * Processes a new order with product validation and inventory checks
   *
   * @param command - Order creation command
   * @returns Result containing processing result or error
   */
  async processOrder(
    command: CreateOrderCommand
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // Step 1: Validate order items
      const validation = await this.validateOrderItems(command.items);
      if (validation.isFailure()) {
        return Result.failure(validation.error);
      }

      // Step 2: Check product availability
      const availabilityCheck = await this.checkProductAvailability(
        command.items
      );
      if (availabilityCheck.isFailure()) {
        return Result.failure(availabilityCheck.error);
      }

      // Step 3: Calculate order total
      const totalAmount = await this.calculateOrderTotal(command.items);

      // Step 4: Create order entity
      const order = await this.createOrder(command, totalAmount);

      // Step 5: Save order
      const savedOrder = await this.orderRepository.save(order);

      // Step 6: Update product inventory
      await this.updateProductInventory(command.items);

      // Step 7: Publish domain event
      await this.publishOrderCreatedEvent(savedOrder);

      const result: OrderProcessingResult = {
        orderId: savedOrder.id,
        status: savedOrder.status,
        inventoryUpdates: [],
        notifications: [],
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new Error(`Order processing failed: ${error.message}`)
      );
    }
  }

  /**
   * Validates order items
   */
  private async validateOrderItems(
    items: CreateOrderItemCommand[]
  ): Promise<Result<void, Error>> {
    if (!items || items.length === 0) {
      return Result.failure(new Error('Order must contain at least one item'));
    }

    for (const item of items) {
      if (!item.productId || item.quantity <= 0) {
        return Result.failure(
          new Error('Invalid item: productId and positive quantity required')
        );
      }
    }

    return Result.success();
  }

  /**
   * Checks if all products are available
   */
  private async checkProductAvailability(
    items: CreateOrderItemCommand[]
  ): Promise<Result<void, Error>> {
    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);

      if (!product) {
        return Result.failure(
          new Error(`Product not found: ${item.productId}`)
        );
      }

      if (product.status !== 'active') {
        return Result.failure(
          new Error(`Product not available: ${product.name}`)
        );
      }

      if (product.inventory < item.quantity) {
        return Result.failure(
          new Error(`Insufficient inventory for product: ${product.name}`)
        );
      }
    }

    return Result.success();
  }

  /**
   * Calculates total order amount
   */
  private async calculateOrderTotal(
    items: CreateOrderItemCommand[]
  ): Promise<number> {
    let total = 0;

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        total += product.price * item.quantity;
      }
    }

    return total;
  }

  /**
   * Creates order entity
   */
  private async createOrder(
    command: CreateOrderCommand,
    totalAmount: number
  ): Promise<Order> {
    const orderItems = await this.buildOrderItems(command.items);

    return {
      id: this.generateOrderId(),
      userId: command.userId,
      items: orderItems,
      status: 'pending',
      totalAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Builds order items from command
   */
  private async buildOrderItems(
    items: CreateOrderItemCommand[]
  ): Promise<OrderItem[]> {
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
          name: product.name,
        });
      }
    }

    return orderItems;
  }

  /**
   * Updates product inventory
   */
  private async updateProductInventory(
    items: CreateOrderItemCommand[]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        product.inventory -= item.quantity;
        await this.productRepository.save(product);
      }
    }
  }

  /**
   * Publishes order created domain event
   */
  private async publishOrderCreatedEvent(order: Order): Promise<void> {
    const event: OrderCreatedEvent = {
      orderId: order.id,
      userId: order.userId,
      items: order.items,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    };

    // In real implementation, this would publish to event bus
    console.log('Publishing OrderCreatedEvent:', event);
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

- **Repository Coordination**: Coordinates multiple repositories (orders,
  products)
- **Dependency Injection**: Accepts repositories through constructor injection
- **Transaction Coordination**: Manages multi-step operations with proper error
  handling
- **Business Validation**: Validates products, inventory, and order constraints
- **Domain Events**: Publishes events for decoupled communication
- **Error Propagation**: Uses Result pattern for clean error handling

## Common Pitfalls

- **Avoid Long Transactions**: Keep transactions short and focused
- **Don't Ignore Concurrency**: Consider concurrent access to shared resources
- **Avoid Repository Leakage**: Don't expose repository details outside the
  service
- **Don't Skip Validation**: Always validate inputs and business rules
- **Avoid Inconsistent State**: Ensure all operations succeed or fail together

## Related Examples

- [Basic Domain Service](./example-1.md) - Simple domain service patterns
- [Cross-Aggregate Domain Service](../intermediate/example-3.md) - Advanced
  coordination
- [NestJS Simple Service](../frameworks/nestjs/basic/simple-service.md) -
  Framework integration
