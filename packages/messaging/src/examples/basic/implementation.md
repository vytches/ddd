# Basic Outbox Pattern Implementation

**Focus**: Basic outbox pattern for reliable message delivery in distributed systems  
**Domain**: E-commerce Order Processing  
**Complexity**: Basic  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/utils

## Business Context

This example demonstrates the outbox pattern for reliable message delivery in an e-commerce system:
- Ensures messages are delivered even if the message broker is temporarily unavailable
- Provides transactional consistency between database operations and message publishing
- Handles message deduplication and retry logic
- Supports message prioritization and delayed processing

## Implementation

```typescript
// outbox-message.ts
import { OutboxMessage, MessagePriority } from '@vytches-ddd/messaging';
import { Order, Customer, Product } from '../types'; // ALWAYS import from app

// Domain-specific outbox messages
export interface OrderCreatedMessage extends OutboxMessage {
  type: 'order-created';
  payload: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
    shippingAddress: any;
  };
}

export interface PaymentProcessedMessage extends OutboxMessage {
  type: 'payment-processed';
  payload: {
    orderId: string;
    paymentId: string;
    amount: number;
    paymentMethod: string;
    processedAt: Date;
  };
}

export interface InventoryReservedMessage extends OutboxMessage {
  type: 'inventory-reserved';
  payload: {
    orderId: string;
    reservationId: string;
    items: Array<{
      productId: string;
      quantity: number;
      reservedAt: Date;
    }>;
  };
}

export interface OrderShippedMessage extends OutboxMessage {
  type: 'order-shipped';
  payload: {
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippedAt: Date;
    estimatedDelivery: Date;
  };
}

// outbox-service.ts
import { 
  OutboxService, 
  OutboxMessage, 
  MessagePriority,
  OutboxRepository,
  MessageProcessor
} from '@vytches-ddd/messaging';
import { Result } from '@vytches-ddd/utils';

// ⭐ Basic Outbox Service Implementation
export class OrderOutboxService {
  private outboxService: OutboxService;
  private messageProcessor: MessageProcessor;
  private processingInterval: NodeJS.Timer;

  constructor(
    private outboxRepository: OutboxRepository,
    private messagePublisher: MessagePublisher
  ) {
    this.outboxService = new OutboxService(outboxRepository);
    this.messageProcessor = new MessageProcessor(messagePublisher);
    this.startProcessing();
  }

  // Add message to outbox
  async addMessage(message: OutboxMessage): Promise<Result<void, Error>> {
    try {
      const result = await this.outboxService.addMessage(message);
      
      if (result.isSuccess()) {
        console.log(`Message added to outbox: ${message.type} - ${message.id}`);
      }
      
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to add message to outbox: ${error.message}`));
    }
  }

  // Add multiple messages in batch
  async addMessages(messages: OutboxMessage[]): Promise<Result<void, Error>> {
    try {
      const result = await this.outboxService.addMessages(messages);
      
      if (result.isSuccess()) {
        console.log(`${messages.length} messages added to outbox`);
      }
      
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to add messages to outbox: ${error.message}`));
    }
  }

  // Process pending messages
  async processMessages(): Promise<Result<number, Error>> {
    try {
      const pendingMessages = await this.outboxService.getPendingMessages();
      
      if (pendingMessages.isFailure()) {
        return Result.failure(pendingMessages.error);
      }

      const messages = pendingMessages.value;
      let processedCount = 0;

      for (const message of messages) {
        const result = await this.processMessage(message);
        if (result.isSuccess()) {
          processedCount++;
        }
      }

      return Result.success(processedCount);
    } catch (error) {
      return Result.failure(new Error(`Failed to process messages: ${error.message}`));
    }
  }

  private async processMessage(message: OutboxMessage): Promise<Result<void, Error>> {
    try {
      // Mark message as processing
      await this.outboxService.markMessageAsProcessing(message.id);

      // Process the message
      const result = await this.messageProcessor.process(message);

      if (result.isSuccess()) {
        // Mark message as processed
        await this.outboxService.markMessageAsProcessed(message.id);
        console.log(`Message processed successfully: ${message.type} - ${message.id}`);
      } else {
        // Handle processing failure
        await this.handleProcessingFailure(message, result.error);
      }

      return result;
    } catch (error) {
      await this.handleProcessingFailure(message, error);
      return Result.failure(error);
    }
  }

  private async handleProcessingFailure(message: OutboxMessage, error: Error): Promise<void> {
    const retryCount = (message.retryCount || 0) + 1;
    const maxRetries = 3;

    if (retryCount <= maxRetries) {
      // Schedule retry
      const nextRetry = new Date(Date.now() + (retryCount * 30000)); // 30s, 60s, 90s
      await this.outboxService.scheduleRetry(message.id, nextRetry, retryCount);
      
      console.log(`Message scheduled for retry ${retryCount}/${maxRetries}: ${message.id}`);
    } else {
      // Mark as failed after max retries
      await this.outboxService.markMessageAsFailed(message.id, error.message);
      console.error(`Message failed after ${maxRetries} retries: ${message.id} - ${error.message}`);
    }
  }

  // Start automatic message processing
  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.processMessages();
    }, 10000); // Process every 10 seconds
  }

  // Stop automatic processing
  async stopProcessing(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Process any remaining messages
    await this.processMessages();
  }

  // Get outbox statistics
  async getStatistics(): Promise<{
    pending: number;
    processed: number;
    failed: number;
    processing: number;
  }> {
    const stats = await this.outboxService.getStatistics();
    return {
      pending: stats.pendingCount,
      processed: stats.processedCount,
      failed: stats.failedCount,
      processing: stats.processingCount
    };
  }

  // Retry failed messages
  async retryFailedMessages(): Promise<Result<number, Error>> {
    try {
      const failedMessages = await this.outboxService.getFailedMessages();
      
      if (failedMessages.isFailure()) {
        return Result.failure(failedMessages.error);
      }

      const messages = failedMessages.value;
      let retriedCount = 0;

      for (const message of messages) {
        // Reset retry count and schedule for processing
        await this.outboxService.resetMessageForRetry(message.id);
        retriedCount++;
      }

      return Result.success(retriedCount);
    } catch (error) {
      return Result.failure(new Error(`Failed to retry messages: ${error.message}`));
    }
  }
}

// order-service-with-outbox.ts
import { OrderService } from './order-service';

// ⭐ Order Service with Outbox Integration
export class OrderServiceWithOutbox extends OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private outboxService: OrderOutboxService
  ) {
    super(orderRepository);
  }

  async createOrder(orderData: CreateOrderData): Promise<Result<Order, Error>> {
    try {
      // Create order in database transaction
      const orderResult = await this.orderRepository.create(orderData);
      
      if (orderResult.isFailure()) {
        return Result.failure(orderResult.error);
      }

      const order = orderResult.value;

      // Create outbox message for order creation
      const orderCreatedMessage: OrderCreatedMessage = {
        id: `order-created-${order.id}`,
        type: 'order-created',
        payload: {
          orderId: order.id,
          customerId: order.customerId,
          items: order.items,
          totalAmount: order.totalAmount,
          shippingAddress: order.shippingAddress
        },
        priority: MessagePriority.HIGH,
        createdAt: new Date(),
        scheduledFor: new Date(), // Send immediately
        retryCount: 0
      };

      // Add message to outbox in same transaction
      const outboxResult = await this.outboxService.addMessage(orderCreatedMessage);
      
      if (outboxResult.isFailure()) {
        // Rollback order creation if outbox fails
        await this.orderRepository.delete(order.id);
        return Result.failure(new Error(`Failed to create order: ${outboxResult.error.message}`));
      }

      return Result.success(order);
    } catch (error) {
      return Result.failure(new Error(`Order creation failed: ${error.message}`));
    }
  }

  async processPayment(orderId: string, paymentData: PaymentData): Promise<Result<Payment, Error>> {
    try {
      // Process payment
      const paymentResult = await this.paymentService.processPayment(paymentData);
      
      if (paymentResult.isFailure()) {
        return Result.failure(paymentResult.error);
      }

      const payment = paymentResult.value;

      // Create outbox message for payment processing
      const paymentMessage: PaymentProcessedMessage = {
        id: `payment-processed-${payment.id}`,
        type: 'payment-processed',
        payload: {
          orderId: orderId,
          paymentId: payment.id,
          amount: payment.amount,
          paymentMethod: payment.method,
          processedAt: payment.processedAt
        },
        priority: MessagePriority.HIGH,
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0
      };

      // Add to outbox
      const outboxResult = await this.outboxService.addMessage(paymentMessage);
      
      if (outboxResult.isFailure()) {
        console.error(`Failed to add payment message to outbox: ${outboxResult.error.message}`);
        // Don't fail the payment, just log the error
      }

      return Result.success(payment);
    } catch (error) {
      return Result.failure(new Error(`Payment processing failed: ${error.message}`));
    }
  }

  async reserveInventory(orderId: string, items: OrderItem[]): Promise<Result<InventoryReservation, Error>> {
    try {
      // Reserve inventory
      const reservationResult = await this.inventoryService.reserveItems(items);
      
      if (reservationResult.isFailure()) {
        return Result.failure(reservationResult.error);
      }

      const reservation = reservationResult.value;

      // Create outbox message for inventory reservation
      const inventoryMessage: InventoryReservedMessage = {
        id: `inventory-reserved-${reservation.id}`,
        type: 'inventory-reserved',
        payload: {
          orderId: orderId,
          reservationId: reservation.id,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            reservedAt: new Date()
          }))
        },
        priority: MessagePriority.NORMAL,
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0
      };

      // Add to outbox
      await this.outboxService.addMessage(inventoryMessage);

      return Result.success(reservation);
    } catch (error) {
      return Result.failure(new Error(`Inventory reservation failed: ${error.message}`));
    }
  }

  async shipOrder(orderId: string, shippingData: ShippingData): Promise<Result<Shipment, Error>> {
    try {
      // Create shipment
      const shipmentResult = await this.shippingService.createShipment(shippingData);
      
      if (shipmentResult.isFailure()) {
        return Result.failure(shipmentResult.error);
      }

      const shipment = shipmentResult.value;

      // Create outbox message for order shipping
      const shippingMessage: OrderShippedMessage = {
        id: `order-shipped-${shipment.id}`,
        type: 'order-shipped',
        payload: {
          orderId: orderId,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          shippedAt: shipment.shippedAt,
          estimatedDelivery: shipment.estimatedDelivery
        },
        priority: MessagePriority.NORMAL,
        createdAt: new Date(),
        scheduledFor: new Date(),
        retryCount: 0
      };

      // Add to outbox
      await this.outboxService.addMessage(shippingMessage);

      return Result.success(shipment);
    } catch (error) {
      return Result.failure(new Error(`Order shipping failed: ${error.message}`));
    }
  }

  // Batch operations for better performance
  async createMultipleOrders(ordersData: CreateOrderData[]): Promise<Result<Order[], Error>> {
    try {
      const orders: Order[] = [];
      const outboxMessages: OutboxMessage[] = [];

      // Create all orders
      for (const orderData of ordersData) {
        const orderResult = await this.orderRepository.create(orderData);
        
        if (orderResult.isFailure()) {
          return Result.failure(orderResult.error);
        }

        const order = orderResult.value;
        orders.push(order);

        // Create outbox message
        const message: OrderCreatedMessage = {
          id: `order-created-${order.id}`,
          type: 'order-created',
          payload: {
            orderId: order.id,
            customerId: order.customerId,
            items: order.items,
            totalAmount: order.totalAmount,
            shippingAddress: order.shippingAddress
          },
          priority: MessagePriority.HIGH,
          createdAt: new Date(),
          scheduledFor: new Date(),
          retryCount: 0
        };

        outboxMessages.push(message);
      }

      // Add all messages to outbox in batch
      const outboxResult = await this.outboxService.addMessages(outboxMessages);
      
      if (outboxResult.isFailure()) {
        return Result.failure(outboxResult.error);
      }

      return Result.success(orders);
    } catch (error) {
      return Result.failure(new Error(`Batch order creation failed: ${error.message}`));
    }
  }
}

// message-publisher.ts
export interface MessagePublisher {
  publish(message: OutboxMessage): Promise<Result<void, Error>>;
}

// Simple message publisher implementation
export class SimpleMessagePublisher implements MessagePublisher {
  async publish(message: OutboxMessage): Promise<Result<void, Error>> {
    try {
      // Simulate message publishing (replace with actual message broker)
      console.log(`Publishing message: ${message.type} - ${message.id}`);
      console.log(`Payload:`, JSON.stringify(message.payload, null, 2));
      
      // Simulate network delay
      await this.delay(100);
      
      // Simulate occasional failures (5% failure rate)
      if (Math.random() < 0.05) {
        throw new Error('Message broker temporarily unavailable');
      }
      
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Message publishing failed: ${error.message}`));
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// outbox-repository.ts
import { OutboxMessage } from '@vytches-ddd/messaging';

// In-memory outbox repository for demonstration
export class InMemoryOutboxRepository implements OutboxRepository {
  private messages: Map<string, OutboxMessage> = new Map();

  async save(message: OutboxMessage): Promise<Result<void, Error>> {
    try {
      this.messages.set(message.id, { ...message });
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Failed to save message: ${error.message}`));
    }
  }

  async saveMany(messages: OutboxMessage[]): Promise<Result<void, Error>> {
    try {
      for (const message of messages) {
        this.messages.set(message.id, { ...message });
      }
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Failed to save messages: ${error.message}`));
    }
  }

  async findPendingMessages(limit: number = 100): Promise<Result<OutboxMessage[], Error>> {
    try {
      const now = new Date();
      const pending = Array.from(this.messages.values())
        .filter(msg => 
          msg.status === 'pending' && 
          msg.scheduledFor <= now
        )
        .sort((a, b) => {
          // Sort by priority then by creation date
          if (a.priority !== b.priority) {
            return this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        })
        .slice(0, limit);

      return Result.success(pending);
    } catch (error) {
      return Result.failure(new Error(`Failed to find pending messages: ${error.message}`));
    }
  }

  async updateStatus(messageId: string, status: string): Promise<Result<void, Error>> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        return Result.failure(new Error(`Message not found: ${messageId}`));
      }

      message.status = status;
      message.updatedAt = new Date();
      
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Failed to update message status: ${error.message}`));
    }
  }

  async updateRetryCount(messageId: string, retryCount: number, nextRetry: Date): Promise<Result<void, Error>> {
    try {
      const message = this.messages.get(messageId);
      if (!message) {
        return Result.failure(new Error(`Message not found: ${messageId}`));
      }

      message.retryCount = retryCount;
      message.scheduledFor = nextRetry;
      message.status = 'pending';
      message.updatedAt = new Date();
      
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Failed to update retry count: ${error.message}`));
    }
  }

  private getPriorityValue(priority: MessagePriority): number {
    switch (priority) {
      case MessagePriority.CRITICAL: return 4;
      case MessagePriority.HIGH: return 3;
      case MessagePriority.NORMAL: return 2;
      case MessagePriority.LOW: return 1;
      default: return 2;
    }
  }
}
```

## Key Features

- **Transactional Outbox**: Messages are stored in the same transaction as business data
- **Automatic Processing**: Background processing of pending messages
- **Retry Logic**: Exponential backoff with configurable retry limits
- **Message Prioritization**: Critical messages processed first
- **Batch Operations**: Efficient batch processing of multiple messages
- **Failure Handling**: Robust error handling with dead letter support

## Usage Example

```typescript
// Usage in application
export class OrderController {
  constructor(
    private orderService: OrderServiceWithOutbox,
    private outboxService: OrderOutboxService
  ) {}

  async createOrder(orderData: CreateOrderData): Promise<Result<Order, Error>> {
    try {
      // Create order with outbox pattern
      const result = await this.orderService.createOrder(orderData);
      
      if (result.isFailure()) {
        return Result.failure(result.error);
      }

      // Order created and message added to outbox
      // Background processor will handle message delivery
      
      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Order creation failed: ${error.message}`));
    }
  }

  async getOutboxStatistics(): Promise<{
    pending: number;
    processed: number;
    failed: number;
    processing: number;
  }> {
    return await this.outboxService.getStatistics();
  }

  async retryFailedMessages(): Promise<Result<number, Error>> {
    return await this.outboxService.retryFailedMessages();
  }
}
```

## Common Pitfalls

- **Transaction Boundaries**: Ensure outbox messages are saved in the same transaction as business data
- **Message Ordering**: Consider message ordering requirements for your use case
- **Duplicate Processing**: Implement idempotent message handlers
- **Message Size**: Keep message payloads reasonable to avoid performance issues
- **Cleanup Strategy**: Implement cleanup of old processed messages
- **Monitoring**: Monitor outbox processing to detect issues early