# Events - NestJS Manual Setup

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: beginner  
**Framework**: NestJS  
**Approach**: Manual instantiation for beginner-friendly setup  
**Dependencies**: @nestjs/common, @vytches-ddd/events

## Description

Demonstrates basic integration of the Events package with NestJS using manual
instantiation. This approach is perfect for beginners learning the event system
without the complexity of dependency injection frameworks.

## Service Implementation

````typescript
// order-event.service.ts
import { Injectable } from '@nestjs/common';
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { OrderAggregate, OrderRepository, CreateOrderCommand } from '../types'; // ALWAYS import from app

/**
 * @llm-summary NestJS service for order event processing with manual setup
 * @llm-domain Order Management
 * @llm-complexity Simple
 *
 * @description
 * NestJS service that demonstrates manual setup of the Events package
 * for order processing with automatic event publishing.
 *
 * @example
 * ```typescript
 * @Controller('orders')
 * export class OrderController {
 *   constructor(private orderEventService: OrderEventService) {}
 *
 *   @Post()
 *   async createOrder(@Body() command: CreateOrderCommand) {
 *     return await this.orderEventService.createOrder(command);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
@Injectable()
export class OrderEventService {
  private readonly eventBus: UnifiedEventBus;
  private readonly eventDispatcher: UniversalEventDispatcher;
  private readonly orderRepository: OrderRepository;

  constructor() {
    // ⭐ Manual setup - beginner-friendly approach
    this.eventBus = new UnifiedEventBus();
    this.eventDispatcher = new UniversalEventDispatcher(this.eventBus);
    this.orderRepository = new OrderRepository(this.eventDispatcher);

    console.log('✅ Order event service initialized with manual setup');
  }

  /**
   * @llm-summary Creates order with automatic event publishing
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Creates a new order aggregate and saves it through repository,
   * automatically publishing domain events for downstream processing.
   *
   * @param command - Order creation command from HTTP request
   * @returns Promise with created order or error result
   *
   * @example
   * ```typescript
   * const command: CreateOrderCommand = {
   *   userId: 'user-123',
   *   items: [{ productId: 'prod-1', quantity: 2, price: 29.99 }],
   *   shippingAddress: address
   * };
   *
   * const result = await service.createOrder(command);
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async createOrder(command: CreateOrderCommand): Promise<OrderResult> {
    try {
      console.log(`📦 Creating order for user ${command.userId}`);

      // Create order aggregate (adds domain events)
      const orderAggregate = OrderAggregate.create(command);

      // Save through repository - events published automatically
      await this.orderRepository.save(orderAggregate);

      const order = orderAggregate.getOrder();
      console.log(`✅ Order ${order.id} created and events published`);

      return {
        success: true,
        order,
        message: 'Order created successfully',
      };
    } catch (error) {
      console.error('❌ Failed to create order:', error);
      return {
        success: false,
        error: error.message,
        message: 'Order creation failed',
      };
    }
  }

  /**
   * @llm-summary Confirms existing order with event publishing
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Confirms an existing order by updating its status and automatically
   * publishing OrderConfirmed events for payment processing.
   *
   * @param orderId - ID of order to confirm
   * @returns Promise with confirmation result
   *
   * @since 1.0.0
   * @public
   */
  async confirmOrder(orderId: string): Promise<OrderResult> {
    try {
      console.log(`🔄 Confirming order ${orderId}`);

      // Find existing order
      const orderAggregate = await this.orderRepository.findById(orderId);
      if (!orderAggregate) {
        return {
          success: false,
          error: 'Order not found',
          message: `Order ${orderId} does not exist`,
        };
      }

      // Confirm order (adds domain events)
      orderAggregate.confirm();

      // Save changes - events published automatically
      await this.orderRepository.save(orderAggregate);

      const order = orderAggregate.getOrder();
      console.log(`✅ Order ${orderId} confirmed and events published`);

      return {
        success: true,
        order,
        message: 'Order confirmed successfully',
      };
    } catch (error) {
      console.error(`❌ Failed to confirm order ${orderId}:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Order confirmation failed',
      };
    }
  }

  /**
   * @llm-summary Gets order status with event history
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * Retrieves order information including current status and
   * related event processing history.
   *
   * @param orderId - ID of order to retrieve
   * @returns Promise with order information or error
   *
   * @since 1.0.0
   * @public
   */
  async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    try {
      const orderAggregate = await this.orderRepository.findById(orderId);
      if (!orderAggregate) {
        return {
          success: false,
          error: 'Order not found',
          message: `Order ${orderId} does not exist`,
        };
      }

      const order = orderAggregate.getOrder();

      return {
        success: true,
        orderId: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        message: 'Order status retrieved successfully',
      };
    } catch (error) {
      console.error(`❌ Failed to get order status ${orderId}:`, error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve order status',
      };
    }
  }
}

// Result interfaces for HTTP responses
interface OrderResult {
  success: boolean;
  order?: Order;
  error?: string;
  message: string;
}

interface OrderStatusResult {
  success: boolean;
  orderId?: string;
  status?: string;
  total?: number;
  createdAt?: Date;
  updatedAt?: Date;
  error?: string;
  message: string;
}
````

## Controller Integration

```typescript
// order.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { OrderEventService } from './order-event.service';
import { CreateOrderCommand, Order } from '../types'; // ALWAYS import from app

/**
 * @llm-summary NestJS controller for order management with event integration
 * @llm-domain Order Management
 * @llm-complexity Simple
 *
 * @description
 * REST API controller that delegates to OrderEventService for order
 * operations with automatic event publishing.
 *
 * @since 1.0.0
 * @public
 */
@Controller('orders')
export class OrderController {
  constructor(private readonly orderEventService: OrderEventService) {}

  /**
   * @llm-summary Creates new order via HTTP POST
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * HTTP endpoint for creating orders that automatically publishes
   * domain events through the event system.
   *
   * @param command - Order creation data from request body
   * @returns Promise with created order or HTTP error
   *
   * @since 1.0.0
   * @public
   */
  @Post()
  async createOrder(@Body() command: CreateOrderCommand): Promise<Order> {
    // Delegate to event service - events published automatically
    const result = await this.orderEventService.createOrder(command);

    if (!result.success) {
      throw new HttpException(
        { message: result.message, error: result.error },
        HttpStatus.BAD_REQUEST
      );
    }

    return result.order!;
  }

  /**
   * @llm-summary Confirms existing order via HTTP PUT
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * HTTP endpoint for confirming orders that triggers payment
   * processing through automatic event publishing.
   *
   * @param orderId - Order ID from URL parameter
   * @returns Promise with confirmed order or HTTP error
   *
   * @since 1.0.0
   * @public
   */
  @Put(':orderId/confirm')
  async confirmOrder(@Param('orderId') orderId: string): Promise<Order> {
    const result = await this.orderEventService.confirmOrder(orderId);

    if (!result.success) {
      const statusCode =
        result.error === 'Order not found'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { message: result.message, error: result.error },
        statusCode
      );
    }

    return result.order!;
  }

  /**
   * @llm-summary Gets order status via HTTP GET
   * @llm-domain Order Management
   * @llm-complexity Simple
   *
   * @description
   * HTTP endpoint for retrieving order status and processing information.
   *
   * @param orderId - Order ID from URL parameter
   * @returns Promise with order status or HTTP error
   *
   * @since 1.0.0
   * @public
   */
  @Get(':orderId/status')
  async getOrderStatus(@Param('orderId') orderId: string): Promise<any> {
    const result = await this.orderEventService.getOrderStatus(orderId);

    if (!result.success) {
      const statusCode =
        result.error === 'Order not found'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { message: result.message, error: result.error },
        statusCode
      );
    }

    return {
      orderId: result.orderId,
      status: result.status,
      total: result.total,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
```

## Module Configuration

```typescript
// order.module.ts
import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderEventService } from './order-event.service';

/**
 * @llm-summary NestJS module for order management with manual event setup
 * @llm-domain Module Configuration
 * @llm-complexity Simple
 *
 * @description
 * NestJS module that configures order management components with
 * manual event system setup for beginner-friendly integration.
 *
 * @since 1.0.0
 * @public
 */
@Module({
  controllers: [OrderController],
  providers: [OrderEventService],
  exports: [OrderEventService],
})
export class OrderModule {}
```

## Application Setup

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';

@Module({
  imports: [OrderModule],
})
export class AppModule {}

// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Standard NestJS setup
  app.enableCors();
  app.setGlobalPrefix('api');

  await app.listen(3000);
  console.log('🚀 Application is running on: http://localhost:3000');
  console.log('📦 Event system initialized with manual setup');
}

bootstrap();
```

## Key Points

- **Simple Setup**: Manual instantiation makes the event system easy to
  understand for beginners
- **Standard NestJS**: Uses familiar NestJS patterns (Controller, Service,
  Module)
- **Event Integration**: Events published automatically without additional
  complexity
- **Error Handling**: Proper HTTP error responses with meaningful messages
- **Thin Controllers**: Business logic delegated to services, controllers handle
  HTTP concerns only

## Usage Examples

```bash
# Create order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "items": [
      {"productId": "laptop-pro", "quantity": 1, "price": 1299.99}
    ],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "Boston",
      "state": "MA",
      "zipCode": "02101",
      "country": "USA"
    },
    "paymentMethod": "credit_card"
  }'

# Confirm order (triggers payment processing events)
curl -X PUT http://localhost:3000/api/orders/order-123/confirm

# Get order status
curl http://localhost:3000/api/orders/order-123/status
```

## Common Pitfalls

- **❌ Creating Multiple Instances**: Don't create new event bus instances in
  each method
- **❌ Missing Error Handling**: Always handle errors from event publishing
  gracefully
- **❌ Blocking Operations**: Keep HTTP responses fast, let events handle slow
  operations
- **❌ Large Payloads**: Keep event payloads focused on essential information

## Next Steps

- [DI Integration](../intermediate/di-integration.md) - Advanced dependency
  injection setup
- [Event Integration](../intermediate/event-integration.md) - Complex event
  handling patterns
- [Enterprise Setup](../advanced/enterprise-setup.md) - Production-ready
  configuration
