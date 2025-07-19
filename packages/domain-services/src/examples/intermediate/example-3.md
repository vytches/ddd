# Cross-Aggregate Domain Service - Intermediate Example

**Version**: 1.0.0
**Package**: @vytches-ddd/domain-services
**Complexity**: intermediate
**Domain**: order-management
**Patterns**: domain-service, cross-aggregate, transaction-coordination
**Dependencies**: @vytches-ddd/core, @vytches-ddd/aggregates

## Description

This example demonstrates a domain service that coordinates operations across multiple aggregates. It shows proper transaction coordination, consistency management, and aggregate interaction patterns.

## Business Context

Some business operations span multiple aggregates (Order, Customer, Inventory, Payment). Domain services provide a way to coordinate these operations while maintaining aggregate boundaries and ensuring consistency.

## Code Example

```typescript
// order-coordination.service.ts
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { AggregateRoot, UnitOfWork } from '@vytches-ddd/aggregates';
import { Result } from '@vytches-ddd/utils';
import { 
  Order, 
  Customer, 
  Product, 
  Payment,
  CreateOrderCommand, 
  OrderProcessingResult,
  IOrderRepository,
  ICustomerRepository,
  IProductRepository,
  IPaymentRepository
} from '../types';

/**
 * @llm-summary Domain service coordinating operations across multiple aggregates
 * @llm-domain order-management
 * @llm-complexity Medium
 * 
 * @description
 * Coordinates order processing across Order, Customer, Product, and Payment aggregates.
 * Ensures consistency and proper transaction boundaries.
 * 
 * @example
 * ```typescript
 * const service = new OrderCoordinationService(repositories, unitOfWork);
 * const result = await service.processCompleteOrder(command);
 * ```
 */
export class OrderCoordinationService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly productRepository: IProductRepository,
    private readonly paymentRepository: IPaymentRepository,
    private readonly unitOfWork: UnitOfWork
  ) {
    super('OrderCoordinationService');
  }

  /**
   * Processes complete order across multiple aggregates
   * 
   * @param command - Order creation command
   * @returns Result containing processing result or error
   */
  async processCompleteOrder(command: CreateOrderCommand): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // Start unit of work for transaction coordination
      await this.unitOfWork.begin();

      // Step 1: Validate customer aggregate
      const customerResult = await this.validateCustomer(command.userId);
      if (customerResult.isFailure()) {
        await this.unitOfWork.rollback();
        return Result.failure(customerResult.error);
      }
      const customer = customerResult.value;

      // Step 2: Validate and reserve inventory
      const inventoryResult = await this.validateAndReserveInventory(command.items);
      if (inventoryResult.isFailure()) {
        await this.unitOfWork.rollback();
        return Result.failure(inventoryResult.error);
      }
      const reservedProducts = inventoryResult.value;

      // Step 3: Create order aggregate
      const orderResult = await this.createOrder(command, customer, reservedProducts);
      if (orderResult.isFailure()) {
        await this.unitOfWork.rollback();
        return Result.failure(orderResult.error);
      }
      const order = orderResult.value;

      // Step 4: Process payment
      const paymentResult = await this.processPayment(order, customer);
      if (paymentResult.isFailure()) {
        await this.unitOfWork.rollback();
        return Result.failure(paymentResult.error);
      }
      const payment = paymentResult.value;

      // Step 5: Update customer aggregate
      await this.updateCustomerOrder(customer, order);

      // Step 6: Commit all changes
      await this.unitOfWork.commit();

      const result: OrderProcessingResult = {
        orderId: order.id,
        status: order.status,
        paymentId: payment.id,
        inventoryUpdates: reservedProducts.map(p => ({
          productId: p.id,
          quantityReserved: this.getReservedQuantity(p.id, command.items),
          success: true
        })),
        notifications: []
      };

      return Result.success(result);

    } catch (error) {
      await this.unitOfWork.rollback();
      return Result.failure(new Error(`Order coordination failed: ${error.message}`));
    }
  }

  /**
   * Validates customer aggregate
   */
  private async validateCustomer(userId: string): Promise<Result<Customer, Error>> {
    const customer = await this.customerRepository.findById(userId);
    
    if (!customer) {
      return Result.failure(new Error(`Customer not found: ${userId}`));
    }

    // Business rule: Customer must be active
    if (customer.status === 'inactive' || customer.status === 'suspended') {
      return Result.failure(new Error(`Customer account is ${customer.status}`));
    }

    return Result.success(customer);
  }

  /**
   * Validates and reserves inventory across product aggregates
   */
  private async validateAndReserveInventory(
    items: CreateOrderItemCommand[]
  ): Promise<Result<Product[], Error>> {
    const reservedProducts: Product[] = [];

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      
      if (!product) {
        return Result.failure(new Error(`Product not found: ${item.productId}`));
      }

      if (product.status !== 'active') {
        return Result.failure(new Error(`Product not available: ${product.name}`));
      }

      if (product.inventory < item.quantity) {
        return Result.failure(new Error(`Insufficient inventory for ${product.name}`));
      }

      // Reserve inventory
      product.inventory -= item.quantity;
      
      // Register for unit of work
      this.unitOfWork.registerDirty(product);
      
      reservedProducts.push(product);
    }

    return Result.success(reservedProducts);
  }

  /**
   * Creates order aggregate
   */
  private async createOrder(
    command: CreateOrderCommand, 
    customer: Customer, 
    products: Product[]
  ): Promise<Result<Order, Error>> {
    
    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (const item of command.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;
        
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          name: product.name
        });
      }
    }

    const order: Order = {
      id: this.generateOrderId(),
      userId: customer.id,
      items: orderItems,
      status: 'pending',
      totalAmount,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Register for unit of work
    this.unitOfWork.registerNew(order);
    
    return Result.success(order);
  }

  /**
   * Processes payment through payment aggregate
   */
  private async processPayment(order: Order, customer: Customer): Promise<Result<Payment, Error>> {
    const payment: Payment = {
      id: this.generatePaymentId(),
      orderId: order.id,
      amount: order.totalAmount,
      status: 'pending',
      method: 'credit_card', // Simplified
      processedAt: new Date()
    };

    // Business rule: Check customer payment limit
    if (customer.loyaltyLevel === 'bronze' && order.totalAmount > 5000) {
      return Result.failure(new Error('Payment amount exceeds customer limit'));
    }

    // Simulate payment processing
    payment.status = 'completed';
    payment.processedAt = new Date();

    // Register for unit of work
    this.unitOfWork.registerNew(payment);
    
    return Result.success(payment);
  }

  /**
   * Updates customer aggregate with order information
   */
  private async updateCustomerOrder(customer: Customer, order: Order): Promise<void> {
    // Update customer statistics
    customer.totalSpent += order.totalAmount;
    
    // Update loyalty level based on spending
    if (customer.totalSpent >= 50000 && customer.loyaltyLevel !== 'platinum') {
      customer.loyaltyLevel = 'platinum';
    } else if (customer.totalSpent >= 25000 && customer.loyaltyLevel === 'bronze') {
      customer.loyaltyLevel = 'gold';
    } else if (customer.totalSpent >= 10000 && customer.loyaltyLevel === 'bronze') {
      customer.loyaltyLevel = 'silver';
    }

    // Register for unit of work
    this.unitOfWork.registerDirty(customer);
  }

  /**
   * Handles order cancellation across aggregates
   */
  async cancelOrder(orderId: string, reason: string): Promise<Result<void, Error>> {
    try {
      await this.unitOfWork.begin();

      // Step 1: Get order aggregate
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        await this.unitOfWork.rollback();
        return Result.failure(new Error(`Order not found: ${orderId}`));
      }

      if (order.status === 'cancelled' || order.status === 'delivered') {
        await this.unitOfWork.rollback();
        return Result.failure(new Error(`Cannot cancel order with status: ${order.status}`));
      }

      // Step 2: Update order status
      order.status = 'cancelled';
      order.updatedAt = new Date();
      this.unitOfWork.registerDirty(order);

      // Step 3: Restore inventory
      await this.restoreInventory(order.items);

      // Step 4: Process refund if payment exists
      const payments = await this.paymentRepository.findByOrderId(orderId);
      for (const payment of payments) {
        if (payment.status === 'completed') {
          payment.status = 'refunded';
          this.unitOfWork.registerDirty(payment);
        }
      }

      // Step 5: Update customer statistics
      const customer = await this.customerRepository.findById(order.userId);
      if (customer) {
        customer.totalSpent -= order.totalAmount;
        this.unitOfWork.registerDirty(customer);
      }

      await this.unitOfWork.commit();
      return Result.success();

    } catch (error) {
      await this.unitOfWork.rollback();
      return Result.failure(new Error(`Order cancellation failed: ${error.message}`));
    }
  }

  /**
   * Restores inventory for cancelled order
   */
  private async restoreInventory(items: OrderItem[]): Promise<void> {
    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        product.inventory += item.quantity;
        this.unitOfWork.registerDirty(product);
      }
    }
  }

  /**
   * Gets reserved quantity for product
   */
  private getReservedQuantity(productId: string, items: CreateOrderItemCommand[]): number {
    const item = items.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  }

  /**
   * Generates unique order identifier
   */
  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates unique payment identifier
   */
  private generatePaymentId(): string {
    return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Key Features

- **Cross-Aggregate Coordination**: Coordinates operations across multiple aggregates
- **Transaction Management**: Uses UnitOfWork pattern for consistency
- **Aggregate Boundaries**: Respects aggregate boundaries and consistency rules
- **Rollback Handling**: Proper rollback on failures
- **Business Rules**: Enforces business rules across aggregates
- **State Management**: Manages aggregate state changes consistently

## Common Pitfalls

- **Long Transactions**: Keep transactions short to avoid deadlocks
- **Aggregate Leakage**: Don't expose aggregate internals across boundaries
- **Consistency**: Ensure eventual consistency when immediate consistency isn't possible
- **Error Handling**: Handle partial failures gracefully
- **Performance**: Consider performance implications of cross-aggregate operations

## Related Examples

- [Event-Driven Domain Service](./example-1.md) - Event-driven coordination
- [Domain Service with Policy Integration](./example-2.md) - Policy enforcement
- [Saga-Orchestrated Domain Service](../advanced/example-1.md) - Long-running processes