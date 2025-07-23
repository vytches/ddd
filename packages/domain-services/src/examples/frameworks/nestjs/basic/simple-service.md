# Simple NestJS Domain Service - Basic

**Focus**: Simple domain service integration with NestJS **Base Example**:
[Domain Service with Repository](../../../basic/example-2.md) **Dependencies**:
@nestjs/common, @vytches-ddd/core

## Service Implementation

```typescript
// order-processing.service.ts
import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { Result } from '@vytches-ddd/utils';
import {
  Order,
  CreateOrderCommand,
  OrderProcessingResult,
  IOrderRepository,
  IProductRepository,
} from '../types';

@Injectable()
export class OrderProcessingService extends BaseDomainService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productRepository: IProductRepository
  ) {
    super('OrderProcessingService');
  }

  /**
   * Processes order with product validation
   */
  async processOrder(
    command: CreateOrderCommand
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // ⭐ FOCUS: Domain service orchestration pattern
      const validation = await this.validateOrderItems(command.items);
      if (validation.isFailure()) {
        return Result.failure(validation.error);
      }

      const availabilityCheck = await this.checkProductAvailability(
        command.items
      );
      if (availabilityCheck.isFailure()) {
        return Result.failure(availabilityCheck.error);
      }

      const totalAmount = await this.calculateOrderTotal(command.items);
      const order = await this.createOrder(command, totalAmount);
      const savedOrder = await this.orderRepository.save(order);

      await this.updateProductInventory(command.items);
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

  private async publishOrderCreatedEvent(order: Order): Promise<void> {
    const event = {
      orderId: order.id,
      userId: order.userId,
      items: order.items,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    };

    console.log('Publishing OrderCreatedEvent:', event);
  }

  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Controller Integration

```typescript
// order.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { OrderProcessingService } from './order-processing.service';
import { CreateOrderCommand } from '../types';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderProcessingService: OrderProcessingService
  ) {}

  @Post()
  async processOrder(@Body() command: CreateOrderCommand) {
    // ⭐ FOCUS: Thin wrapper around domain service
    const result = await this.orderProcessingService.processOrder(command);

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }
}
```

## Module Configuration

```typescript
// order.module.ts
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderProcessingService } from './order-processing.service';

@Module({
  controllers: [OrderController],
  providers: [
    OrderProcessingService,
    // Repository providers would be injected here
    {
      provide: 'IOrderRepository',
      useClass: OrderRepository,
    },
    {
      provide: 'IProductRepository',
      useClass: ProductRepository,
    },
  ],
  exports: [OrderProcessingService],
})
export class OrderModule {}
```

## Key Points

- **Repository Coordination**: Shows how to coordinate multiple repositories
- **Validation Layer**: Implements proper validation before processing
- **Event Publishing**: Demonstrates event publishing patterns
- **Error Handling**: Uses Result pattern for clean error handling
- **NestJS Integration**: Standard NestJS dependency injection patterns

## Related Examples

- [Manual Setup](./manual-setup.md) - Simple manual instantiation
- [Domain Service with Repository](../../../basic/example-2.md) - Core library
  patterns
- [Event Integration](../intermediate/event-integration.md) - Advanced event
  patterns
