# Order Aggregate - NestJS Integration with State Machine

**Focus**: Order state machine aggregate integration with NestJS **Base
Example**: [Basic Order Aggregate](../../basic/example-2.md) **Dependencies**:
@nestjs/common, @vytches/ddd-aggregates, @vytches/ddd-di

## Service Implementation

```typescript
// order-aggregate.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { EntityId } from '@vytches/ddd-domain-primitives';
import {
  Order,
  CreateOrderData,
  OrderItem,
  ShippingAddress,
  OrderStatus,
  PaymentInfo,
} from './types'; // From your application

@Injectable()
export class OrderAggregateService {
  private readonly logger = new Logger(OrderAggregateService.name);

  // ✅ FOCUS: Order creation with validation
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');

      // Use library factory with business validation
      const orderAggregate = OrderAggregateClass.create(
        orderData.customerId,
        orderData.items,
        orderData.shippingAddress
      );

      const order = orderAggregate.toSnapshot();

      this.logger.log(
        `Order created: ${order.id} for customer ${orderData.customerId}`
      );
      return order;
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: State machine operations
  async confirmOrder(
    orderId: string,
    paymentInfo: PaymentInfo
  ): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library state transition method
      orderAggregate.confirm(paymentInfo);

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Order confirmed: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to confirm order: ${error.message}`);
      throw error;
    }
  }

  async startProcessing(orderId: string): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library method with state validation
      orderAggregate.startProcessing();

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Order processing started: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to start processing order: ${error.message}`);
      throw error;
    }
  }

  async shipOrder(orderId: string, trackingNumber: string): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library shipping method
      orderAggregate.ship(trackingNumber, new Date());

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Order shipped: ${orderId}, tracking: ${trackingNumber}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to ship order: ${error.message}`);
      throw error;
    }
  }

  async completeOrder(orderId: string): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library completion method
      orderAggregate.complete();

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Order completed: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to complete order: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library cancellation with business rules
      orderAggregate.cancel(reason);

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Order cancelled: ${orderId}, reason: ${reason}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Order item management
  async addItemToOrder(orderId: string, item: OrderItem): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library method with business validation
      orderAggregate.addItem(item);

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(
        `Item added to order: ${orderId}, item: ${item.productId}`
      );
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to add item to order: ${error.message}`);
      throw error;
    }
  }

  async removeItemFromOrder(
    orderId: string,
    productId: string
  ): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library method
      orderAggregate.removeItem(productId);

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(
        `Item removed from order: ${orderId}, product: ${productId}`
      );
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to remove item from order: ${error.message}`);
      throw error;
    }
  }

  async updateShippingAddress(
    orderId: string,
    address: ShippingAddress
  ): Promise<Order> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library method with validation
      orderAggregate.updateShippingAddress(address);

      const updatedOrder = orderAggregate.toSnapshot();

      this.logger.log(`Shipping address updated: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Failed to update shipping address: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Query methods
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      return orderAggregate.toSnapshot();
    } catch (error) {
      this.logger.warn(`Order not found: ${orderId}`);
      return null;
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus | null> {
    try {
      const order = await this.getOrderById(orderId);
      return order?.status || null;
    } catch (error) {
      this.logger.warn(`Failed to get order status: ${orderId}`);
      return null;
    }
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    // In real implementation, this would query a read model or repository
    // For example purposes, we'll return mock data
    this.logger.log(`Retrieving orders for customer: ${customerId}`);
    return []; // Mock implementation
  }

  // ✅ FOCUS: State machine validation
  async getValidTransitions(orderId: string): Promise<OrderStatus[]> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library method to get valid state transitions
      return orderAggregate.getValidTransitions();
    } catch (error) {
      this.logger.error(`Failed to get valid transitions: ${error.message}`);
      return [];
    }
  }

  async canTransitionTo(
    orderId: string,
    targetStatus: OrderStatus
  ): Promise<boolean> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      // Use library validation method
      return orderAggregate.canTransitionTo(targetStatus);
    } catch (error) {
      this.logger.error(`Failed to validate transition: ${error.message}`);
      return false;
    }
  }

  // ✅ FOCUS: Domain events access
  async getOrderDomainEvents(orderId: string): Promise<any[]> {
    try {
      const OrderAggregateClass = VytchesDDD.resolve<any>('OrderAggregate');
      const orderAggregate = await this.loadOrderAggregate(
        orderId,
        OrderAggregateClass
      );

      return orderAggregate.getUncommittedEvents();
    } catch (error) {
      this.logger.error(`Failed to get domain events: ${error.message}`);
      return [];
    }
  }

  // Helper method for aggregate loading
  private async loadOrderAggregate(
    orderId: string,
    OrderAggregateClass: any
  ): Promise<any> {
    // Mock implementation - in reality would load from event store or repository
    return OrderAggregateClass.fromSnapshot({
      id: orderId,
      customerId: 'customer-123',
      items: [],
      totalAmount: 0,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// order.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { OrderAggregateService } from './order-aggregate.service';

@Module({
  providers: [OrderAggregateService],
  exports: [OrderAggregateService],
})
export class OrderModule implements OnModuleInit {
  async onModuleInit() {
    // Initialize VytchesDDD container
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

**Key Points:**

- Integrates order state machine logic with NestJS
- Provides state transition validation through library methods
- Handles order lifecycle management with proper error handling
- Maintains clean separation between framework and domain logic
- Exposes domain events for integration with other bounded contexts

**Integration Benefits:**

1. **State Management**: Proper state machine implementation through library
2. **Business Rules**: Order business logic encapsulated in aggregate
3. **Event Sourcing**: Access to domain events for integration patterns
4. **Validation**: Built-in state transition validation
5. **Error Handling**: Comprehensive error handling for all operations

**Usage Example:**

```typescript
// order.controller.ts
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderAggregateService) {}

  @Post()
  async createOrder(@Body() orderData: CreateOrderData) {
    return await this.orderService.createOrder(orderData);
  }

  @Put(':id/confirm')
  async confirmOrder(
    @Param('id') id: string,
    @Body() paymentInfo: PaymentInfo
  ) {
    return await this.orderService.confirmOrder(id, paymentInfo);
  }

  @Put(':id/ship')
  async shipOrder(
    @Param('id') id: string,
    @Body('trackingNumber') trackingNumber: string
  ) {
    return await this.orderService.shipOrder(id, trackingNumber);
  }

  @Get(':id/transitions')
  async getValidTransitions(@Param('id') id: string) {
    return await this.orderService.getValidTransitions(id);
  }
}
```
