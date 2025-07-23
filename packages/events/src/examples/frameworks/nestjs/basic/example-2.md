# Event System - NestJS DI Integration

**Version**: 1.0.0 **Package**: @vytches-ddd/events **Complexity**: basic
**Domain**: Integration **Patterns**: dependency-injection, service-locator,
event-publishing, nestjs-di **Dependencies**: @nestjs/common,
@vytches-ddd/events, @vytches-ddd/di

## Description

NestJS integration using @vytches-ddd/di service locator pattern for
enterprise-grade dependency injection. This example demonstrates the bridge
pattern to avoid double instance risk while leveraging the VytchesDDD container
for advanced event handling capabilities.

## Business Context

Enterprise applications need sophisticated dependency injection with features
like context isolation, service lifetimes, and decorators. The @vytches-ddd/di
package provides these capabilities while maintaining compatibility with
NestJS's existing DI system through the bridge pattern.

## Code Example

```typescript
// order.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { Order, CreateOrderData, OrderStatus } from './types'; // From your app

// ⭐ FOCUS: Domain service with VytchesDDD DI
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['paymentService', 'inventoryService'],
  autoRegister: true,
})
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: UnifiedEventBus
  ) {}

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    try {
      // ⭐ FOCUS: Business logic with automatic event publishing
      const order = Order.create(orderData);
      await this.orderRepository.save(order); // Publishes OrderCreatedEvent

      return order;
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<Order> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // ⭐ FOCUS: Status change triggers domain events
      order.updateStatus(status);
      await this.orderRepository.save(order); // Publishes OrderStatusChangedEvent

      return order;
    } catch (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }
}

// payment.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { PaymentData, PaymentResult } from './types'; // From your app

@DomainService({
  serviceId: 'paymentService',
  lifetime: ServiceLifetime.Transient,
  context: 'OrderManagement',
})
export class PaymentService {
  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      // ⭐ FOCUS: Payment processing logic
      const result = await this.processWithProvider(paymentData);

      if (result.success) {
        // Payment successful - events published through repository
        return { success: true, transactionId: result.transactionId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  private async processWithProvider(paymentData: PaymentData): Promise<any> {
    // Mock payment provider integration
    return { success: true, transactionId: 'tx_123456' };
  }
}

// order.controller.ts
import { Controller, Post, Put, Body, Param, Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { OrderService } from './order.service';
import { CreateOrderData, OrderStatus } from './types'; // From your app

@Injectable()
@Controller('orders')
export class OrderController {
  private readonly orderService: OrderService;

  constructor() {
    // ⭐ FOCUS: Bridge Pattern - Get existing instance from VytchesDDD
    this.orderService = VytchesDDD.resolve<OrderService>('orderService');
  }

  @Post()
  async createOrder(@Body() orderData: CreateOrderData) {
    // ⭐ FOCUS: Delegate to VytchesDDD instance
    return await this.orderService.createOrder(orderData);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() { status }: { status: OrderStatus }
  ) {
    return await this.orderService.updateOrderStatus(id, status);
  }
}

// inventory.service.ts
import { DomainService } from '@vytches-ddd/di';
import { InventoryItem, ReservationRequest } from './types'; // From your app

@DomainService('inventoryService', {
  context: 'OrderManagement',
})
export class InventoryService {
  async reserveItems(request: ReservationRequest): Promise<boolean> {
    try {
      // ⭐ FOCUS: Inventory reservation logic
      const available = await this.checkAvailability(request.items);

      if (available) {
        await this.createReservation(request);
        return true;
      }

      return false;
    } catch (error) {
      throw new Error(`Inventory reservation failed: ${error.message}`);
    }
  }

  private async checkAvailability(items: InventoryItem[]): Promise<boolean> {
    // Mock inventory check
    return true;
  }

  private async createReservation(request: ReservationRequest): Promise<void> {
    // Mock reservation creation
  }
}

// order.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { OrderController } from './order.controller';

@Module({
  controllers: [OrderController],
})
export class OrderModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ FOCUS: CRITICAL - Initialize VytchesDDD BEFORE framework DI
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);

    // Services are automatically discovered and registered through @DomainService decorators
  }
}

// event-handler.service.ts
import { DomainService } from '@vytches-ddd/di';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { OrderCreatedEvent, OrderStatusChangedEvent } from './types'; // From your app

@DomainService('eventHandlerService')
export class EventHandlerService {
  private readonly eventBus: UnifiedEventBus;

  constructor() {
    this.eventBus = new UnifiedEventBus();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // ⭐ FOCUS: Advanced event handling with DI context
    this.eventBus.subscribe(
      'OrderCreated',
      async (event: OrderCreatedEvent) => {
        // ⭐ FOCUS: Resolve dependencies from VytchesDDD container
        const paymentService = VytchesDDD.resolve<PaymentService>(
          'paymentService',
          'OrderManagement'
        );
        const inventoryService = VytchesDDD.resolve<InventoryService>(
          'inventoryService',
          'OrderManagement'
        );

        try {
          // Process payment
          const paymentResult = await paymentService.processPayment({
            orderId: event.orderId,
            amount: event.totalAmount,
            paymentMethod: event.paymentMethod,
          });

          if (paymentResult.success) {
            // Reserve inventory
            await inventoryService.reserveItems({
              orderId: event.orderId,
              items: event.items,
            });
          }
        } catch (error) {
          console.error('Order processing failed:', error);
        }
      }
    );

    this.eventBus.subscribe(
      'OrderStatusChanged',
      async (event: OrderStatusChangedEvent) => {
        console.log(
          `Order ${event.orderId} status changed to ${event.newStatus}`
        );
        // Additional status change handling
      }
    );
  }
}

// app.module.ts
import { Module } from '@nestjs/common';
import { OrderModule } from './order/order.module';

@Module({
  imports: [OrderModule],
})
export class AppModule {}
```

## Key Features

- **Enterprise DI Integration**: Uses @vytches-ddd/di with NestJS bridge pattern
- **Context Isolation**: Services can be isolated by bounded context
- **Service Lifetimes**: Support for Transient, Singleton, and Scoped services
- **Auto-Discovery**: Services automatically registered through decorators
- **Bridge Pattern**: Avoids double instance risk with existing NestJS services

## Bridge Pattern Benefits

1. **Single Source of Truth**: VytchesDDD container is the primary DI container
2. **No Double Instances**: Bridge pattern prevents duplicate service instances
3. **Advanced Features**: Access to context isolation, service lifetimes, and
   decorators
4. **Framework Compatibility**: Works seamlessly with existing NestJS patterns
5. **Testing Support**: Easy mocking and isolated testing

## Setup Requirements

1. **VytchesDDD First**: Always initialize VytchesDDD container before framework
   DI
2. **Bridge Controllers**: Use factory pattern in controllers to get existing
   instances
3. **No Dual Decorators**: Either `@DomainService` OR `@Injectable`, never both
4. **Context Awareness**: Use context-aware service resolution when needed

## Common Pitfalls

- **Initialization Order**: VytchesDDD must be configured before NestJS module
  initialization
- **Mixed Decorators**: Don't use both `@DomainService` and `@Injectable` on
  same class
- **Instance Duplication**: Always use bridge pattern to avoid creating
  duplicate instances
- **Context Confusion**: Be explicit about context when resolving services

## Related Examples

- [NestJS Manual Setup](./example-1.md)
- [Dependency Injection Patterns](../../../domain-services/examples/frameworks/nestjs/example-2.md)
- [Advanced Event Processing](../intermediate/example-1.md)
