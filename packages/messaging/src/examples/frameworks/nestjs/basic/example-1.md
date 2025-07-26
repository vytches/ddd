# NestJS Outbox Pattern Integration - Manual Setup

**Version**: 1.0.0  
**Package**: @vytches/ddd-messaging  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Manual setup of outbox pattern with NestJS dependency injection

## Description

This example shows how to manually integrate the @vytches/ddd-messaging outbox
pattern with NestJS using standard framework patterns and manual service
instantiation.

## Business Context

An e-commerce order service needs reliable message delivery when orders are
created. Using manual setup provides clear understanding of dependencies and
full control over configuration.

## Code Example

```typescript
// order.service.ts - Domain service using outbox pattern
import { Injectable } from '@nestjs/common';
import {
  OutboxMessageHandler,
  OutboxMessage,
  MessagePriority,
} from '@vytches/ddd-messaging';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Order } from './types'; // From your application

@Injectable()
export class OrderService {
  private outboxHandler: OutboxMessageHandler;

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private entityManager: EntityManager
  ) {
    // Manual outbox handler setup
    this.outboxHandler = new OutboxMessageHandler({
      storage: this.createOutboxStorage(),
      publisher: this.createMessagePublisher(),
      batchSize: 50,
      pollInterval: 5000,
    });
  }

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    return await this.entityManager.transaction(async tx => {
      // 1. Create and save order
      const order = this.orderRepository.create(orderData);
      const savedOrder = await tx.save(order);

      // 2. Store outbox messages in same transaction
      const outboxMessages = [
        OutboxMessage.create({
          messageType: 'OrderCreated',
          payload: {
            orderId: savedOrder.id,
            customerId: savedOrder.customerId,
            amount: savedOrder.totalAmount,
          },
          targetService: 'inventory-service',
          priority: MessagePriority.HIGH,
        }),
        OutboxMessage.create({
          messageType: 'SendConfirmationEmail',
          payload: {
            orderId: savedOrder.id,
            customerEmail: orderData.customerEmail,
            orderSummary: this.generateOrderSummary(savedOrder),
          },
          targetService: 'notification-service',
          priority: MessagePriority.NORMAL,
          delay: 5000, // 5 second delay
        }),
      ];

      await this.outboxHandler.storeMessages(outboxMessages, tx);

      return savedOrder;
    });
  }

  async processPayment(
    orderId: string,
    paymentData: PaymentData
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) throw new Error('Order not found');

    await this.entityManager.transaction(async tx => {
      // Update order status
      order.status = 'payment_processing';
      await tx.save(order);

      // Queue payment processing message
      const paymentMessage = OutboxMessage.create({
        messageType: 'ProcessPayment',
        payload: { orderId, paymentData },
        targetService: 'payment-service',
        priority: MessagePriority.HIGH,
        retryPolicy: {
          maxAttempts: 5,
          backoffType: 'exponential',
          initialDelay: 1000,
        },
      });

      await this.outboxHandler.storeMessages([paymentMessage], tx);
    });
  }

  // Start outbox processing when service initializes
  async onModuleInit(): Promise<void> {
    await this.outboxHandler.startProcessing();
  }

  // Stop processing on shutdown
  async onModuleDestroy(): Promise<void> {
    await this.outboxHandler.stopProcessing();
  }

  private createOutboxStorage() {
    // Custom storage implementation using TypeORM
    return {
      async store(messages: OutboxMessage[], tx: EntityManager): Promise<void> {
        const entities = messages.map(msg =>
          tx.create('OutboxEntry', {
            id: msg.id,
            messageType: msg.messageType,
            payload: JSON.stringify(msg.payload),
            targetService: msg.targetService,
            status: 'pending',
            createdAt: new Date(),
            priority: msg.priority,
          })
        );
        await tx.save(entities);
      },

      async getPendingMessages(batchSize: number): Promise<OutboxMessage[]> {
        const entries = await this.entityManager.find('OutboxEntry', {
          where: { status: 'pending' },
          order: { createdAt: 'ASC' },
          take: batchSize,
        });

        return entries.map(entry =>
          OutboxMessage.create({
            id: entry.id,
            messageType: entry.messageType,
            payload: JSON.parse(entry.payload),
            targetService: entry.targetService,
            priority: entry.priority,
          })
        );
      },
    };
  }

  private createMessagePublisher() {
    return {
      async publish(message: OutboxMessage): Promise<void> {
        // Integrate with your messaging system (RabbitMQ, Kafka, etc.)
        try {
          await this.messagingClient.publish(
            message.targetService,
            message.messageType,
            message.payload
          );
        } catch (error) {
          throw new Error(`Failed to publish message: ${error.message}`);
        }
      },
    };
  }

  private generateOrderSummary(order: Order) {
    return {
      items: order.items,
      total: order.totalAmount,
      currency: order.currency,
      estimatedDelivery: this.calculateDeliveryDate(order),
    };
  }
}

// order.controller.ts - NestJS controller using the service
import { Controller, Post, Body, Param } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, ProcessPaymentDto } from './dto'; // From your application

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    try {
      const order = await this.orderService.createOrder(createOrderDto);
      return {
        success: true,
        orderId: order.id,
        status: 'processing',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post(':id/payment')
  async processPayment(
    @Param('id') orderId: string,
    @Body() paymentDto: ProcessPaymentDto
  ) {
    try {
      await this.orderService.processPayment(orderId, paymentDto);
      return {
        success: true,
        message: 'Payment processing initiated',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// order.module.ts - NestJS module configuration
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity'; // From your application

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

## Key Features

- **Manual Setup**: Full control over outbox handler configuration and
  dependencies
- **Framework Integration**: Uses standard NestJS patterns (@Injectable,
  lifecycle hooks)
- **Transaction Safety**: Ensures messages are stored in same database
  transaction
- **Error Handling**: Proper error handling and rollback scenarios
- **Type Safety**: Full TypeScript support with proper interfaces

## Benefits of Manual Setup

- **Learning**: Understand exactly how outbox pattern works
- **Control**: Full control over configuration and behavior
- **Debugging**: Easy to trace issues and customize behavior
- **Flexibility**: Can adapt to specific business requirements

## Common Pitfalls

- **Memory Leaks**: Ensure outbox processing is stopped on module destruction
- **Transaction Boundaries**: Always store outbox messages within business
  transaction
- **Error Handling**: Handle publisher failures gracefully to avoid data loss
- **Resource Management**: Properly manage database connections and message
  broker connections

## Related Examples

- [Advanced DI Integration](/packages/messaging/src/examples/frameworks/nestjs/intermediate/example-1.md)
- [Saga Orchestration](/packages/messaging/src/examples/intermediate/example-1.md)
- [Event Integration](/packages/events/src/examples/frameworks/nestjs/basic/example-1.md)
