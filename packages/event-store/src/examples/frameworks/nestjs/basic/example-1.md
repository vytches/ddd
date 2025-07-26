# Event Store - NestJS Basic Manual Setup

**Focus**: Basic Event Store usage in NestJS with manual instantiation **Base
Example**: [Event Store Basic Usage](../../../basic/usage.md) **Dependencies**:
@nestjs/common, @vytches/ddd-event-store

## Service Implementation

```typescript
// event-store.service.ts
import { Injectable } from '@nestjs/common';
import {
  InMemoryEventStore,
  EventStoreOptions,
} from '@vytches/ddd-event-store';
import { DomainEvent } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import { OrderEvent, InventoryEvent } from './types'; // From your app

@Injectable()
export class EventStoreService {
  private readonly eventStore: InMemoryEventStore;

  constructor() {
    // ⭐ FOCUS: Manual event store setup (beginner-friendly)
    const options: EventStoreOptions = {
      enableSnapshots: true,
      snapshotFrequency: 50,
    };
    this.eventStore = new InMemoryEventStore(options);
  }

  // ✅ FOCUS: Thin wrapper around event store
  async appendEvents(
    streamId: string,
    events: DomainEvent[]
  ): Promise<Result<void, Error>> {
    try {
      return await this.eventStore.appendEvents(streamId, events);
    } catch (error) {
      throw new Error(`Failed to append events: ${error.message}`);
    }
  }

  async readEvents(streamId: string): Promise<Result<DomainEvent[], Error>> {
    try {
      const result = await this.eventStore.readStream(streamId);
      return result.isSuccess()
        ? Result.ok(result.value.events)
        : Result.fail(result.error);
    } catch (error) {
      throw new Error(`Failed to read events: ${error.message}`);
    }
  }

  async getAllEvents(): Promise<Result<DomainEvent[], Error>> {
    try {
      return await this.eventStore.getAllEvents();
    } catch (error) {
      throw new Error(`Failed to get all events: ${error.message}`);
    }
  }
}
```

## Module Configuration

```typescript
// event-store.module.ts
import { Module } from '@nestjs/common';
import { EventStoreService } from './event-store.service';

@Module({
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}
```

## Usage Example

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { OrderCreatedEvent, OrderEvent } from './types'; // From your app

@Injectable()
export class OrderService {
  constructor(private readonly eventStore: EventStoreService) {}

  async createOrder(orderData: OrderData): Promise<void> {
    // ⭐ FOCUS: Simple event creation and storage
    const event = new OrderCreatedEvent(
      orderData.orderId,
      orderData.customerId,
      orderData.items,
      orderData.total
    );

    const result = await this.eventStore.appendEvents(
      `order-${orderData.orderId}`,
      [event]
    );

    if (result.isFailure()) {
      throw new Error(`Order creation failed: ${result.error.message}`);
    }
  }

  async getOrderHistory(orderId: string): Promise<OrderEvent[]> {
    const result = await this.eventStore.readEvents(`order-${orderId}`);

    if (result.isSuccess()) {
      return result.value.filter(event =>
        event.eventType.startsWith('Order')
      ) as OrderEvent[];
    }

    throw new Error(`Failed to get order history: ${result.error.message}`);
  }
}
```

**Key Points:**

- Simple manual instantiation for beginners
- Focus on event store usage, not DI complexity
- Standard NestJS patterns for framework integration
- Clear error handling with Result pattern
