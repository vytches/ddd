# Event Sourced Shopping Cart - NestJS Integration

**Focus**: Event sourced shopping cart with NestJS and @vytches-ddd/di
integration  
**Base Example**: [Event Sourced Shopping Cart](../../intermediate/example-1.md)
**Dependencies**: @nestjs/common, @vytches-ddd/aggregates, @vytches-ddd/di,
@vytches-ddd/events

## Advanced Service Implementation

```typescript
// event-sourced-cart.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EntityId } from '@vytches-ddd/domain-primitives';
import {
  ShoppingCart,
  CartItem,
  CreateCartData,
  CartSnapshot,
  PriceCalculation,
  DiscountCode,
  ShippingMethod,
} from './types'; // From your application

@Injectable()
export class EventSourcedCartService {
  private readonly logger = new Logger(EventSourcedCartService.name);

  // ✅ FOCUS: Event sourced cart creation
  async createCart(
    customerId: string,
    currency: string = 'USD'
  ): Promise<ShoppingCart> {
    try {
      // Get EventSourcedShoppingCartAggregate from VytchesDDD
      const CartAggregateClass = VytchesDDD.resolve<any>(
        'EventSourcedShoppingCartAggregate'
      );

      // Use library factory method for event sourced aggregate
      const cartAggregate = CartAggregateClass.create(customerId, currency);

      const cart = cartAggregate.toSnapshot();

      this.logger.log(
        `Event sourced cart created: ${cart.id} for customer ${customerId}`
      );
      return cart;
    } catch (error) {
      this.logger.error(
        `Failed to create event sourced cart: ${error.message}`
      );
      throw error;
    }
  }

  // ✅ FOCUS: Event sourced reconstruction from event history
  async getCartFromEventHistory(cartId: string): Promise<ShoppingCart> {
    try {
      const CartAggregateClass = VytchesDDD.resolve<any>(
        'EventSourcedShoppingCartAggregate'
      );

      // In real implementation, get events from event store
      const events = await this.getCartEventHistory(cartId);

      // Use library method to reconstruct from events
      const cartAggregate = CartAggregateClass.fromEvents(
        EntityId.fromString(cartId),
        events
      );

      const cart = cartAggregate.toSnapshot();

      this.logger.log(
        `Cart reconstructed from ${events.length} events: ${cartId}`
      );
      return cart;
    } catch (error) {
      this.logger.error(
        `Failed to reconstruct cart from events: ${error.message}`
      );
      throw error;
    }
  }

  // ✅ FOCUS: Optimized reconstruction with snapshots
  async getCartWithSnapshotOptimization(cartId: string): Promise<ShoppingCart> {
    try {
      const CartAggregateClass = VytchesDDD.resolve<any>(
        'EventSourcedShoppingCartAggregate'
      );

      // Get latest snapshot and events after snapshot
      const snapshotData = await this.getLatestSnapshot(cartId);
      const eventsAfterSnapshot = await this.getEventsAfterSnapshot(
        cartId,
        snapshotData?.version || 0
      );

      let cartAggregate;

      if (snapshotData) {
        // Use library method for snapshot + incremental events
        cartAggregate = CartAggregateClass.fromSnapshotAndEvents(
          EntityId.fromString(cartId),
          snapshotData,
          eventsAfterSnapshot
        );

        this.logger.log(
          `Cart loaded from snapshot (v${snapshotData.version}) + ${eventsAfterSnapshot.length} events`
        );
      } else {
        // Fall back to full event replay
        const allEvents = await this.getCartEventHistory(cartId);
        cartAggregate = CartAggregateClass.fromEvents(
          EntityId.fromString(cartId),
          allEvents
        );

        this.logger.log(
          `Cart loaded from full event history: ${allEvents.length} events`
        );
      }

      return cartAggregate.toSnapshot();
    } catch (error) {
      this.logger.error(
        `Failed to load cart with snapshot optimization: ${error.message}`
      );
      throw error;
    }
  }

  // ✅ FOCUS: Cart item operations with event sourcing
  async addItemToCart(cartId: string, item: CartItem): Promise<ShoppingCart> {
    try {
      // Load cart with event sourcing
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method - generates domain event automatically
      cartAggregate.addItem(item);

      // Persist new events (in real implementation)
      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const updatedCart = cartAggregate.toSnapshot();

      this.logger.log(
        `Item added to cart ${cartId}: ${item.productId} x${item.quantity}`
      );
      return updatedCart;
    } catch (error) {
      this.logger.error(`Failed to add item to cart: ${error.message}`);
      throw error;
    }
  }

  async updateItemQuantity(
    cartId: string,
    productId: string,
    quantity: number
  ): Promise<ShoppingCart> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for quantity update
      cartAggregate.updateItemQuantity(productId, quantity);

      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const updatedCart = cartAggregate.toSnapshot();

      this.logger.log(
        `Item quantity updated in cart ${cartId}: ${productId} -> ${quantity}`
      );
      return updatedCart;
    } catch (error) {
      this.logger.error(`Failed to update item quantity: ${error.message}`);
      throw error;
    }
  }

  async removeItemFromCart(
    cartId: string,
    productId: string
  ): Promise<ShoppingCart> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for item removal
      cartAggregate.removeItem(productId);

      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const updatedCart = cartAggregate.toSnapshot();

      this.logger.log(`Item removed from cart ${cartId}: ${productId}`);
      return updatedCart;
    } catch (error) {
      this.logger.error(`Failed to remove item from cart: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Advanced cart operations with event sourcing
  async applyDiscountCode(
    cartId: string,
    discountCode: string
  ): Promise<ShoppingCart> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for discount application
      await cartAggregate.applyDiscountCode(discountCode);

      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const updatedCart = cartAggregate.toSnapshot();

      this.logger.log(
        `Discount code applied to cart ${cartId}: ${discountCode}`
      );
      return updatedCart;
    } catch (error) {
      this.logger.error(`Failed to apply discount code: ${error.message}`);
      throw error;
    }
  }

  async updateShippingMethod(
    cartId: string,
    shippingMethod: ShippingMethod
  ): Promise<ShoppingCart> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for shipping update
      cartAggregate.updateShippingMethod(shippingMethod);

      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const updatedCart = cartAggregate.toSnapshot();

      this.logger.log(
        `Shipping method updated for cart ${cartId}: ${shippingMethod.type}`
      );
      return updatedCart;
    } catch (error) {
      this.logger.error(`Failed to update shipping method: ${error.message}`);
      throw error;
    }
  }

  async calculateCartTotals(cartId: string): Promise<PriceCalculation> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for price calculation
      const calculation = cartAggregate.calculateTotals();

      this.logger.log(
        `Cart totals calculated for ${cartId}: ${calculation.grandTotal}`
      );
      return calculation;
    } catch (error) {
      this.logger.error(`Failed to calculate cart totals: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Temporal queries with event sourcing
  async getCartAtPoint(cartId: string, timestamp: Date): Promise<ShoppingCart> {
    try {
      const CartAggregateClass = VytchesDDD.resolve<any>(
        'EventSourcedShoppingCartAggregate'
      );

      // Get events up to specific timestamp
      const eventsUpToTimestamp = await this.getCartEventsUpTo(
        cartId,
        timestamp
      );

      // Use library method for temporal reconstruction
      const cartAggregate = CartAggregateClass.fromEvents(
        EntityId.fromString(cartId),
        eventsUpToTimestamp
      );

      const historicalCart = cartAggregate.toSnapshot();

      this.logger.log(
        `Historical cart state retrieved for ${cartId} at ${timestamp.toISOString()}`
      );
      return historicalCart;
    } catch (error) {
      this.logger.error(
        `Failed to get cart at point in time: ${error.message}`
      );
      throw error;
    }
  }

  async getCartVersionHistory(cartId: string): Promise<CartSnapshot[]> {
    try {
      const events = await this.getCartEventHistory(cartId);
      const snapshots: CartSnapshot[] = [];

      const CartAggregateClass = VytchesDDD.resolve<any>(
        'EventSourcedShoppingCartAggregate'
      );

      // Create snapshots at key points in cart history
      let currentEvents: any[] = [];

      for (const event of events) {
        currentEvents.push(event);

        // Create snapshot every 5 events or at significant events
        if (currentEvents.length % 5 === 0 || this.isSignificantEvent(event)) {
          const aggregate = CartAggregateClass.fromEvents(
            EntityId.fromString(cartId),
            currentEvents
          );

          snapshots.push({
            ...aggregate.toSnapshot(),
            snapshotAt: event.occurredAt,
            eventCount: currentEvents.length,
          });
        }
      }

      this.logger.log(
        `Cart version history retrieved: ${snapshots.length} snapshots`
      );
      return snapshots;
    } catch (error) {
      this.logger.error(`Failed to get cart version history: ${error.message}`);
      return [];
    }
  }

  // ✅ FOCUS: Event sourcing performance operations
  async createSnapshot(cartId: string): Promise<boolean> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method to create snapshot
      const snapshot = cartAggregate.createSnapshot();

      // Persist snapshot (mock implementation)
      await this.persistSnapshot(cartId, snapshot);

      this.logger.log(
        `Snapshot created for cart ${cartId} at version ${snapshot.version}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to create snapshot: ${error.message}`);
      return false;
    }
  }

  async clearCart(cartId: string): Promise<ShoppingCart> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Use library method for cart clearing
      cartAggregate.clear();

      await this.persistCartEvents(
        cartId,
        cartAggregate.getUncommittedEvents()
      );

      const clearedCart = cartAggregate.toSnapshot();

      this.logger.log(`Cart cleared: ${cartId}`);
      return clearedCart;
    } catch (error) {
      this.logger.error(`Failed to clear cart: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Event stream access for integration
  async getCartEventStream(cartId: string): Promise<any[]> {
    try {
      const cartAggregate = await this.loadEventSourcedCart(cartId);

      // Get all committed and uncommitted events
      const committedEvents = await this.getCartEventHistory(cartId);
      const uncommittedEvents = cartAggregate.getUncommittedEvents();

      const allEvents = [...committedEvents, ...uncommittedEvents];

      this.logger.log(
        `Cart event stream retrieved: ${allEvents.length} events`
      );
      return allEvents;
    } catch (error) {
      this.logger.error(`Failed to get cart event stream: ${error.message}`);
      return [];
    }
  }

  // ✅ FOCUS: Analytics and reporting from events
  async getCartAnalytics(cartId: string): Promise<any> {
    try {
      const events = await this.getCartEventHistory(cartId);

      // Use library methods to analyze event patterns
      const analytics = {
        totalEvents: events.length,
        itemAdditions: events.filter(e => e.eventType === 'ItemAdded').length,
        itemRemovals: events.filter(e => e.eventType === 'ItemRemoved').length,
        priceRecalculations: events.filter(
          e => e.eventType === 'PriceRecalculated'
        ).length,
        discountsApplied: events.filter(e => e.eventType === 'DiscountApplied')
          .length,
        firstActivity: events.length > 0 ? events[0].occurredAt : null,
        lastActivity:
          events.length > 0 ? events[events.length - 1].occurredAt : null,
        averageSessionTime: this.calculateAverageSessionTime(events),
        abandonmentRisk: this.calculateAbandonmentRisk(events),
      };

      this.logger.log(`Cart analytics calculated for ${cartId}`);
      return analytics;
    } catch (error) {
      this.logger.error(`Failed to calculate cart analytics: ${error.message}`);
      return {};
    }
  }

  // Private helper methods
  private async loadEventSourcedCart(cartId: string): Promise<any> {
    const CartAggregateClass = VytchesDDD.resolve<any>(
      'EventSourcedShoppingCartAggregate'
    );

    // Try snapshot optimization first
    try {
      return await this.getCartWithSnapshotOptimization(cartId);
    } catch {
      // Fall back to full event replay
      const events = await this.getCartEventHistory(cartId);
      return CartAggregateClass.fromEvents(EntityId.fromString(cartId), events);
    }
  }

  private async getCartEventHistory(cartId: string): Promise<any[]> {
    // Mock implementation - in reality would query event store
    return [
      { eventType: 'CartCreated', cartId, occurredAt: new Date() },
      {
        eventType: 'ItemAdded',
        cartId,
        productId: 'product-1',
        quantity: 2,
        occurredAt: new Date(),
      },
    ];
  }

  private async getEventsAfterSnapshot(
    cartId: string,
    version: number
  ): Promise<any[]> {
    // Mock implementation
    return [];
  }

  private async getLatestSnapshot(cartId: string): Promise<any> {
    // Mock implementation
    return null;
  }

  private async getCartEventsUpTo(
    cartId: string,
    timestamp: Date
  ): Promise<any[]> {
    const allEvents = await this.getCartEventHistory(cartId);
    return allEvents.filter(event => event.occurredAt <= timestamp);
  }

  private async persistCartEvents(
    cartId: string,
    events: any[]
  ): Promise<void> {
    // Mock implementation - in reality would persist to event store
    this.logger.debug(`Persisting ${events.length} events for cart ${cartId}`);
  }

  private async persistSnapshot(cartId: string, snapshot: any): Promise<void> {
    // Mock implementation
    this.logger.debug(
      `Persisting snapshot for cart ${cartId} at version ${snapshot.version}`
    );
  }

  private isSignificantEvent(event: any): boolean {
    return ['CartCreated', 'DiscountApplied', 'CartCleared'].includes(
      event.eventType
    );
  }

  private calculateAverageSessionTime(events: any[]): number {
    if (events.length < 2) return 0;

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    return (
      (lastEvent.occurredAt.getTime() - firstEvent.occurredAt.getTime()) /
      (1000 * 60)
    ); // minutes
  }

  private calculateAbandonmentRisk(events: any[]): number {
    // Simple risk calculation based on event patterns
    const lastEventTime =
      events.length > 0 ? events[events.length - 1].occurredAt : new Date();
    const timeSinceLastActivity =
      (Date.now() - lastEventTime.getTime()) / (1000 * 60); // minutes

    if (timeSinceLastActivity > 30) return 0.8; // High risk
    if (timeSinceLastActivity > 15) return 0.5; // Medium risk
    return 0.2; // Low risk
  }
}

// event-sourced-cart.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { EventSourcedCartService } from './event-sourced-cart.service';

@Module({
  providers: [EventSourcedCartService],
  exports: [EventSourcedCartService],
})
export class EventSourcedCartModule implements OnModuleInit {
  async onModuleInit() {
    // Initialize VytchesDDD container with event sourcing support
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

**Key Points:**

- Complete event sourcing implementation with NestJS integration
- Snapshot optimization for performance with large event histories
- Temporal queries allowing point-in-time cart reconstruction
- Analytics and reporting capabilities from event streams
- Advanced cart operations with full audit trail

**Integration Benefits:**

1. **Complete Audit Trail**: Every cart change is captured as an event
2. **Temporal Queries**: Ability to see cart state at any point in time
3. **Performance Optimization**: Snapshot support for fast reconstruction
4. **Analytics Ready**: Rich event data for business analytics
5. **Conflict Resolution**: Event sourcing handles concurrent modifications

**Usage Example:**

```typescript
// cart.controller.ts
@Controller('carts')
export class CartController {
  constructor(private readonly cartService: EventSourcedCartService) {}

  @Post(':id/items')
  async addItem(@Param('id') id: string, @Body() item: CartItem) {
    return await this.cartService.addItemToCart(id, item);
  }

  @Get(':id/history')
  async getCartHistory(@Param('id') id: string) {
    return await this.cartService.getCartVersionHistory(id);
  }

  @Get(':id/analytics')
  async getAnalytics(@Param('id') id: string) {
    return await this.cartService.getCartAnalytics(id);
  }

  @Get(':id/at/:timestamp')
  async getCartAtTime(
    @Param('id') id: string,
    @Param('timestamp') timestamp: string
  ) {
    const date = new Date(timestamp);
    return await this.cartService.getCartAtPoint(id, date);
  }
}
```
