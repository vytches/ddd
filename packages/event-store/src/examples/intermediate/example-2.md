# Stream-Based Projections

**Version**: 1.0.0 **Package**: @vytches-ddd/event-store **Complexity**:
intermediate **Domain**: Architecture **Patterns**: stream-processing,
read-models, projection-building, cqrs-read-side **Dependencies**:
@vytches-ddd/event-store, @vytches-ddd/projections, @vytches-ddd/events

## Description

Building read models and projections directly from event streams with real-time
updates, sophisticated aggregation patterns, and efficient query optimization.
This example demonstrates advanced projection strategies for complex business
intelligence and reporting requirements.

## Business Context

Modern applications need multiple views of the same data for different
purposes - operational dashboards, analytics reports, search indices, and
customer-facing displays. Stream-based projections allow real-time maintenance
of these views while keeping the write-side optimized for business operations.

## Code Example

```typescript
// stream-projections.ts
import {
  InMemoryEventStore,
  JsonEventSerializer,
} from '@vytches-ddd/event-store';
import { DomainEvent, EntityId } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
import { OrderSummaryProjection, CustomerOrderHistory } from './types'; // From your app

// ⭐ FOCUS: Advanced projection engine with real-time updates
export class StreamProjectionEngine {
  private readonly eventStore: InMemoryEventStore;
  private readonly logger = Logger.forContext('StreamProjectionEngine');
  private readonly projectionStore = new Map<string, any>();
  private readonly subscriptions = new Map<string, ProjectionSubscription[]>();

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new JsonEventSerializer(),
      enableSnapshots: false,
    });
  }

  async buildOrderSummaryProjection(): Promise<
    Result<OrderSummaryProjection, Error>
  > {
    try {
      this.logger.info('Building order summary projection');

      const projection: OrderSummaryProjection = {
        orderId: '',
        customerId: '',
        status: 'draft',
        totalAmount: 0,
        currency: 'USD',
        itemCount: 0,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      // ⭐ FOCUS: Query all order-related streams
      const allStreams = await this.eventStore.getAllStreamIds();
      const orderStreams = allStreams.filter(id => id.startsWith('order-'));

      for (const streamId of orderStreams) {
        const orderId = streamId.replace('order-', '');

        const orderProjection = await this.buildSingleOrderProjection(orderId);

        if (orderProjection.isSuccess()) {
          // Store individual order projection
          this.projectionStore.set(
            `order-summary-${orderId}`,
            orderProjection.value
          );
        }
      }

      this.logger.info('Order summary projection built', {
        totalOrders: orderStreams.length,
      });

      return Result.ok(projection);
    } catch (error) {
      return Result.fail(
        new Error(`Order summary projection failed: ${error.message}`)
      );
    }
  }

  async buildSingleOrderProjection(
    orderId: string
  ): Promise<Result<OrderSummaryProjection, Error>> {
    try {
      const streamId = `order-${orderId}`;

      // ⭐ FOCUS: Read all events for this order
      const readResult = await this.eventStore.readStream(streamId);

      if (readResult.isFailure()) {
        return Result.fail(readResult.error);
      }

      const events = readResult.value.events;

      if (events.length === 0) {
        return Result.fail(new Error(`No events found for order ${orderId}`));
      }

      // ⭐ FOCUS: Build projection by replaying events
      let projection: OrderSummaryProjection = {
        orderId,
        customerId: '',
        status: 'draft',
        totalAmount: 0,
        currency: 'USD',
        itemCount: 0,
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      for (const event of events) {
        projection = this.applyEventToOrderProjection(projection, event);
      }

      return Result.ok(projection);
    } catch (error) {
      return Result.fail(
        new Error(`Single order projection failed: ${error.message}`)
      );
    }
  }

  private applyEventToOrderProjection(
    projection: OrderSummaryProjection,
    event: DomainEvent
  ): OrderSummaryProjection {
    const updated = { ...projection };

    switch (event.eventType) {
      case 'OrderCreated':
        const createdEvent = event as OrderCreatedEvent;
        updated.customerId = createdEvent.customerId;
        updated.totalAmount = createdEvent.totalAmount;
        updated.currency = createdEvent.currency;
        updated.itemCount = createdEvent.items.length;
        updated.status = 'draft';
        updated.createdAt = event.timestamp;
        updated.lastUpdated = event.timestamp;
        break;

      case 'OrderItemAdded':
        const itemAddedEvent = event as OrderItemAddedEvent;
        updated.itemCount++;
        updated.totalAmount +=
          itemAddedEvent.unitPrice * itemAddedEvent.quantity;
        updated.lastUpdated = event.timestamp;
        break;

      case 'OrderItemRemoved':
        const itemRemovedEvent = event as OrderItemRemovedEvent;
        updated.itemCount = Math.max(0, updated.itemCount - 1);
        updated.totalAmount = Math.max(
          0,
          updated.totalAmount -
            itemRemovedEvent.unitPrice * itemRemovedEvent.quantity
        );
        updated.lastUpdated = event.timestamp;
        break;

      case 'OrderStatusChanged':
        const statusEvent = event as OrderStatusChangedEvent;
        updated.status = statusEvent.newStatus;
        updated.lastUpdated = event.timestamp;
        break;

      case 'OrderDiscountApplied':
        const discountEvent = event as OrderDiscountAppliedEvent;
        updated.totalAmount -= discountEvent.discountAmount;
        updated.lastUpdated = event.timestamp;
        break;
    }

    return updated;
  }

  async buildCustomerOrderHistoryProjection(): Promise<
    Result<Map<string, CustomerOrderHistory>, Error>
  > {
    try {
      this.logger.info('Building customer order history projection');

      const customerHistories = new Map<string, CustomerOrderHistory>();

      // ⭐ FOCUS: Process all order projections to build customer history
      const orderProjections = this.getAllOrderProjections();

      for (const orderProjection of orderProjections) {
        const customerId = orderProjection.customerId;

        if (!customerHistories.has(customerId)) {
          customerHistories.set(customerId, {
            customerId,
            totalOrders: 0,
            totalSpent: 0,
            averageOrderValue: 0,
            lastOrderDate: undefined,
            preferredCategories: [],
          });
        }

        const history = customerHistories.get(customerId)!;

        // ⭐ FOCUS: Aggregate customer data
        history.totalOrders++;
        history.totalSpent += orderProjection.totalAmount;
        history.averageOrderValue = history.totalSpent / history.totalOrders;

        if (
          !history.lastOrderDate ||
          orderProjection.createdAt > history.lastOrderDate
        ) {
          history.lastOrderDate = orderProjection.createdAt;
        }

        customerHistories.set(customerId, history);
      }

      this.logger.info('Customer order history projection built', {
        totalCustomers: customerHistories.size,
      });

      return Result.ok(customerHistories);
    } catch (error) {
      return Result.fail(
        new Error(`Customer history projection failed: ${error.message}`)
      );
    }
  }

  async buildRealTimeAnalyticsProjection(): Promise<
    Result<AnalyticsProjection, Error>
  > {
    try {
      this.logger.info('Building real-time analytics projection');

      const analytics: AnalyticsProjection = {
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        ordersByStatus: {},
        revenueByHour: {},
        topCustomers: [],
        conversionRate: 0,
        lastUpdated: new Date(),
      };

      // ⭐ FOCUS: Aggregate across all order projections
      const orderProjections = this.getAllOrderProjections();

      for (const order of orderProjections) {
        // Revenue and order metrics
        analytics.totalOrders++;
        analytics.totalRevenue += order.totalAmount;

        // Status distribution
        analytics.ordersByStatus[order.status] =
          (analytics.ordersByStatus[order.status] || 0) + 1;

        // Revenue by hour
        const hour = order.createdAt.getHours();
        analytics.revenueByHour[hour] =
          (analytics.revenueByHour[hour] || 0) + order.totalAmount;
      }

      // ⭐ FOCUS: Calculate derived metrics
      analytics.averageOrderValue =
        analytics.totalOrders > 0
          ? analytics.totalRevenue / analytics.totalOrders
          : 0;

      // Build customer rankings
      const customerHistoryResult =
        await this.buildCustomerOrderHistoryProjection();

      if (customerHistoryResult.isSuccess()) {
        const customerHistories = Array.from(
          customerHistoryResult.value.values()
        );

        analytics.topCustomers = customerHistories
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 10)
          .map(customer => ({
            customerId: customer.customerId,
            totalSpent: customer.totalSpent,
            orderCount: customer.totalOrders,
          }));
      }

      analytics.lastUpdated = new Date();

      this.logger.info('Real-time analytics projection built', {
        totalRevenue: analytics.totalRevenue,
        totalOrders: analytics.totalOrders,
        averageOrderValue: analytics.averageOrderValue.toFixed(2),
      });

      return Result.ok(analytics);
    } catch (error) {
      return Result.fail(
        new Error(`Analytics projection failed: ${error.message}`)
      );
    }
  }

  async subscribeToStreamUpdates(
    streamPattern: string,
    projectionUpdater: (event: DomainEvent) => Promise<void>
  ): Promise<string> {
    // ⭐ FOCUS: Real-time projection updates
    const subscriptionId = EntityId.createUuid().value;

    if (!this.subscriptions.has(streamPattern)) {
      this.subscriptions.set(streamPattern, []);
    }

    const subscription: ProjectionSubscription = {
      id: subscriptionId,
      streamPattern,
      updater: projectionUpdater,
      isActive: true,
      createdAt: new Date(),
    };

    this.subscriptions.get(streamPattern)!.push(subscription);

    this.logger.info('Projection subscription created', {
      subscriptionId,
      streamPattern,
    });

    return subscriptionId;
  }

  async unsubscribeFromUpdates(subscriptionId: string): Promise<void> {
    // ⭐ FOCUS: Clean up subscriptions
    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);

      if (index !== -1) {
        subscriptions[index].isActive = false;
        subscriptions.splice(index, 1);

        this.logger.info('Projection subscription removed', { subscriptionId });

        if (subscriptions.length === 0) {
          this.subscriptions.delete(pattern);
        }
        return;
      }
    }
  }

  async notifyProjectionUpdates(
    streamId: string,
    event: DomainEvent
  ): Promise<void> {
    // ⭐ FOCUS: Notify all matching subscriptions
    for (const [pattern, subscriptions] of this.subscriptions.entries()) {
      if (this.matchesPattern(streamId, pattern)) {
        for (const subscription of subscriptions.filter(sub => sub.isActive)) {
          try {
            await subscription.updater(event);

            this.logger.debug('Projection updated', {
              subscriptionId: subscription.id,
              eventType: event.eventType,
              streamId,
            });
          } catch (error) {
            this.logger.error('Projection update failed', {
              subscriptionId: subscription.id,
              error: error.message,
            });
          }
        }
      }
    }
  }

  private matchesPattern(streamId: string, pattern: string): boolean {
    // Simple pattern matching - could be enhanced with regex
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return streamId.startsWith(prefix);
    }
    return streamId === pattern;
  }

  private getAllOrderProjections(): OrderSummaryProjection[] {
    const projections: OrderSummaryProjection[] = [];

    for (const [key, projection] of this.projectionStore.entries()) {
      if (key.startsWith('order-summary-')) {
        projections.push(projection);
      }
    }

    return projections;
  }

  // ⭐ FOCUS: Query interface for projections
  async getOrderProjection(
    orderId: string
  ): Promise<Result<OrderSummaryProjection | null, Error>> {
    try {
      const projection = this.projectionStore.get(`order-summary-${orderId}`);
      return Result.ok(projection || null);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get order projection: ${error.message}`)
      );
    }
  }

  async getCustomerHistory(
    customerId: string
  ): Promise<Result<CustomerOrderHistory | null, Error>> {
    try {
      const historyResult = await this.buildCustomerOrderHistoryProjection();

      if (historyResult.isFailure()) {
        return Result.fail(historyResult.error);
      }

      const history = historyResult.value.get(customerId);
      return Result.ok(history || null);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to get customer history: ${error.message}`)
      );
    }
  }

  async getAnalytics(): Promise<Result<AnalyticsProjection, Error>> {
    return await this.buildRealTimeAnalyticsProjection();
  }

  // ⭐ FOCUS: Add test data for demonstration
  async seedTestData(): Promise<void> {
    const orders = [
      { id: '1', customerId: 'customer-1', amount: 150, items: 2 },
      { id: '2', customerId: 'customer-1', amount: 200, items: 3 },
      { id: '3', customerId: 'customer-2', amount: 75, items: 1 },
      { id: '4', customerId: 'customer-3', amount: 300, items: 4 },
      { id: '5', customerId: 'customer-2', amount: 125, items: 2 },
    ];

    for (const order of orders) {
      const orderId = EntityId.fromString(order.id);
      const events = [
        new OrderCreatedEvent(
          orderId,
          order.customerId,
          order.amount,
          'USD',
          Array(order.items)
            .fill(null)
            .map((_, i) => ({
              id: `item-${i}`,
              price: order.amount / order.items,
            }))
        ),
        new OrderStatusChangedEvent(orderId, 'draft', 'confirmed'),
        new OrderStatusChangedEvent(orderId, 'confirmed', 'processing'),
      ];

      await this.eventStore.appendEvents(`order-${order.id}`, events);
    }

    this.logger.info('Test data seeded', { orders: orders.length });
  }
}

// ⭐ FOCUS: Supporting types and interfaces
interface ProjectionSubscription {
  id: string;
  streamPattern: string;
  updater: (event: DomainEvent) => Promise<void>;
  isActive: boolean;
  createdAt: Date;
}

interface AnalyticsProjection {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  revenueByHour: Record<number, number>;
  topCustomers: Array<{
    customerId: string;
    totalSpent: number;
    orderCount: number;
  }>;
  conversionRate: number;
  lastUpdated: Date;
}

// ⭐ FOCUS: Domain events
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly items: any[]
  ) {
    super(aggregateId, 'OrderCreated', 1);
  }
}

export class OrderItemAddedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number
  ) {
    super(aggregateId, 'OrderItemAdded', 1);
  }
}

export class OrderItemRemovedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number
  ) {
    super(aggregateId, 'OrderItemRemoved', 1);
  }
}

export class OrderStatusChangedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly previousStatus: string,
    public readonly newStatus: string
  ) {
    super(aggregateId, 'OrderStatusChanged', 1);
  }
}

export class OrderDiscountAppliedEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly discountAmount: number,
    public readonly discountCode: string
  ) {
    super(aggregateId, 'OrderDiscountApplied', 1);
  }
}
```

## Usage Examples

```typescript
// Complete stream-based projections demonstration
import { StreamProjectionEngine } from './stream-projections';

async function demonstrateStreamProjections() {
  const projectionEngine = new StreamProjectionEngine();

  // ⭐ FOCUS: Seed test data
  await projectionEngine.seedTestData();

  console.log('--- Stream-Based Projections Demo ---\n');

  // ⭐ FOCUS: 1. Build order summary projections
  console.log('1. Order Summary Projections:');
  const orderSummaryResult =
    await projectionEngine.buildOrderSummaryProjection();

  if (orderSummaryResult.isSuccess()) {
    console.log('  Order summaries built successfully');

    // Check individual order projections
    for (let i = 1; i <= 5; i++) {
      const orderResult = await projectionEngine.getOrderProjection(
        i.toString()
      );

      if (orderResult.isSuccess() && orderResult.value) {
        const order = orderResult.value;
        console.log(
          `    Order ${order.orderId}: $${order.totalAmount} (${order.status}) - ${order.itemCount} items`
        );
      }
    }
  }

  // ⭐ FOCUS: 2. Build customer history projection
  console.log('\n2. Customer Order History:');
  const customerHistoryResult =
    await projectionEngine.buildCustomerOrderHistoryProjection();

  if (customerHistoryResult.isSuccess()) {
    const customerHistories = customerHistoryResult.value;

    for (const [customerId, history] of customerHistories.entries()) {
      console.log(`  Customer ${customerId}:`);
      console.log(`    Total Orders: ${history.totalOrders}`);
      console.log(`    Total Spent: $${history.totalSpent}`);
      console.log(
        `    Average Order: $${history.averageOrderValue.toFixed(2)}`
      );
      console.log(`    Last Order: ${history.lastOrderDate?.toISOString()}`);
    }
  }

  // ⭐ FOCUS: 3. Real-time analytics projection
  console.log('\n3. Real-time Analytics:');
  const analyticsResult = await projectionEngine.getAnalytics();

  if (analyticsResult.isSuccess()) {
    const analytics = analyticsResult.value;
    console.log(`  Total Revenue: $${analytics.totalRevenue}`);
    console.log(`  Total Orders: ${analytics.totalOrders}`);
    console.log(
      `  Average Order Value: $${analytics.averageOrderValue.toFixed(2)}`
    );

    console.log('  Orders by Status:');
    for (const [status, count] of Object.entries(analytics.ordersByStatus)) {
      console.log(`    ${status}: ${count}`);
    }

    console.log('  Top Customers:');
    analytics.topCustomers.slice(0, 3).forEach(customer => {
      console.log(
        `    ${customer.customerId}: $${customer.totalSpent} (${customer.orderCount} orders)`
      );
    });
  }

  // ⭐ FOCUS: 4. Real-time projection updates
  console.log('\n4. Real-time Subscription:');
  let updateCount = 0;

  const subscriptionId = await projectionEngine.subscribeToStreamUpdates(
    'order-*',
    async event => {
      updateCount++;
      console.log(`  Update ${updateCount}: ${event.eventType} received`);
    }
  );

  // Simulate new events
  const newOrderId = EntityId.createUuid();
  const newOrderEvents = [
    new OrderCreatedEvent(newOrderId, 'customer-4', 400, 'USD', [
      { id: 'item-1', price: 400 },
    ]),
    new OrderStatusChangedEvent(newOrderId, 'draft', 'confirmed'),
  ];

  // Add events and notify subscriptions
  await projectionEngine.eventStore.appendEvents(
    `order-${newOrderId.value}`,
    newOrderEvents
  );

  for (const event of newOrderEvents) {
    await projectionEngine.notifyProjectionUpdates(
      `order-${newOrderId.value}`,
      event
    );
  }

  console.log(`  Subscription received ${updateCount} updates`);

  // Cleanup subscription
  await projectionEngine.unsubscribeFromUpdates(subscriptionId);
  console.log('  Subscription cleaned up');

  // ⭐ FOCUS: 5. Query individual projections
  console.log('\n5. Individual Projection Queries:');

  const specificOrderResult = await projectionEngine.getOrderProjection('1');
  if (specificOrderResult.isSuccess() && specificOrderResult.value) {
    const order = specificOrderResult.value;
    console.log(`  Order 1 Details:`);
    console.log(`    Customer: ${order.customerId}`);
    console.log(`    Amount: $${order.totalAmount}`);
    console.log(`    Status: ${order.status}`);
    console.log(`    Items: ${order.itemCount}`);
    console.log(`    Created: ${order.createdAt.toISOString()}`);
  }

  const customerHistResult =
    await projectionEngine.getCustomerHistory('customer-1');
  if (customerHistResult.isSuccess() && customerHistResult.value) {
    const history = customerHistResult.value;
    console.log(`  Customer 1 History:`);
    console.log(`    Orders: ${history.totalOrders}`);
    console.log(`    Spent: $${history.totalSpent}`);
    console.log(`    Average: $${history.averageOrderValue.toFixed(2)}`);
  }
}

// Run the demonstration
demonstrateStreamProjections().catch(console.error);
```

## Key Features

- **Real-time Projections**: Automatically updated views as events are processed
- **Multi-View Support**: Different projections for different business
  requirements
- **Subscription System**: Real-time notifications for projection updates
- **Analytics Integration**: Built-in business intelligence and reporting
  capabilities
- **Customer History**: Comprehensive customer behavior tracking and analysis
- **Performance Optimization**: Efficient aggregation and caching strategies
- **Query Interface**: Easy access to projection data with Result pattern

## Projection Benefits

1. **CQRS Read Side**: Optimized views for different query patterns
2. **Real-time Updates**: Projections stay synchronized with event stream
3. **Business Intelligence**: Rich analytics and reporting capabilities
4. **Performance**: Pre-computed views eliminate complex query processing
5. **Scalability**: Independent scaling of read and write operations
6. **Flexibility**: Multiple views of same data for different use cases

## Common Projection Types

- **Entity Projections**: Current state of individual aggregates
- **List Projections**: Collections of entities with filtering and sorting
- **Analytics Projections**: Aggregated metrics and business intelligence
- **Search Projections**: Optimized data structures for full-text search
- **Reporting Projections**: Historical trends and time-series data
- **Notification Projections**: Real-time alerts and event subscriptions

## Performance Considerations

- **Incremental Updates**: Update projections incrementally rather than
  rebuilding
- **Materialized Views**: Store pre-computed results for complex queries
- **Caching Strategy**: Cache frequently accessed projections
- **Batch Processing**: Process multiple events together for efficiency
- **Index Optimization**: Create appropriate indices for query patterns

## Common Pitfalls

- **Event Ordering**: Ensure events are processed in correct chronological order
- **Projection Consistency**: Handle eventual consistency between write and read
  sides
- **Memory Usage**: Monitor memory consumption for large projections
- **Update Conflicts**: Handle concurrent updates to shared projection state
- **Schema Evolution**: Plan for projection schema changes and migrations

## Related Examples

- [Event Replay Engine](./example-1.md)
- [Event Versioning and Migration](./example-3.md)
- [High-Performance Event Store](../advanced/example-2.md)
