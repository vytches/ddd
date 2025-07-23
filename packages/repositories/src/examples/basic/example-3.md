# Cached Repository - Performance Optimization

**Version**: 1.0.0 **Package**: @vytches-ddd/repositories **Complexity**:
beginner **Domain**: order-management **Patterns**: repository-pattern,
caching-layer, performance-optimization **Dependencies**:
@vytches-ddd/repositories, @vytches-ddd/caching

## Description

Repository implementation with integrated caching layer for improved
performance. Shows cache-aside pattern, cache invalidation strategies, and
optimized data access using the @vytches-ddd/repositories caching capabilities.

## Business Context

Order management system with high read volume requiring fast data access.
Caching reduces database load and improves response times for frequently
accessed order data while maintaining data consistency.

## Code Example

```typescript
// order-cached-repository.ts
import { CachedRepository } from '@vytches-ddd/repositories';
import { EntityId } from '@vytches-ddd/domain-primitives';
import { Order, CreateOrderData, OrderStatus, CacheOptions } from './types'; // From your application

// ✅ FOCUS: Cached repository extending library CachedRepository
export class OrderCachedRepository extends CachedRepository<Order> {
  constructor() {
    super('orders', {
      // Cache configuration
      defaultTtl: 300, // 5 minutes
      keyPrefix: 'order:',
      enableMetrics: true,
      compressionEnabled: true,
    });
  }

  // ✅ FOCUS: Create with cache invalidation
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    const orderId = EntityId.generate();

    const order: Order = {
      id: orderId.value,
      orderNumber: `ORDER-${Date.now()}`,
      customerId: orderData.customerId,
      status: 'pending',
      items: orderData.items.map(item => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
      })),
      pricing: this.calculatePricing(orderData.items),
      shipping: { method: 'standard', carrier: 'fedex' },
      billingAddress: orderData.billingAddress,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: orderData.paymentMethod,
      notes: orderData.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    // ✅ FOCUS: Create with automatic caching
    const createdOrder = await this.create(order);

    // Invalidate related caches
    await this.invalidateCacheByPattern(
      `customer:${orderData.customerId}:orders`
    );
    await this.invalidateCacheByPattern('orders:recent');

    return createdOrder;
  }

  // ✅ FOCUS: Cached retrieval operations
  async getOrderById(id: string): Promise<Order | null> {
    // ✅ FOCUS: Library automatically handles caching
    return await this.findById(EntityId.fromString(id));
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const cacheKey = `order:number:${orderNumber}`;

    // ✅ FOCUS: Custom cache key with library caching
    return await this.findOneWithCache(
      { where: [{ field: 'orderNumber', operator: 'eq', value: orderNumber }] },
      { key: cacheKey, ttl: 600 } // 10 minutes cache
    );
  }

  // ✅ FOCUS: Cached queries with custom TTL
  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    const cacheKey = `customer:${customerId}:orders`;

    return await this.findWithCache(
      {
        where: [{ field: 'customerId', operator: 'eq', value: customerId }],
        orderBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      { key: cacheKey, ttl: 180 } // 3 minutes cache
    );
  }

  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    const cacheKey = `orders:status:${status}`;

    return await this.findWithCache(
      {
        where: [{ field: 'status', operator: 'eq', value: status }],
        orderBy: [{ field: 'updatedAt', direction: 'DESC' }],
      },
      { key: cacheKey, ttl: 120 } // 2 minutes cache
    );
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    const cacheKey = `orders:recent:${limit}`;

    return await this.findWithCache(
      {
        limit,
        orderBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      { key: cacheKey, ttl: 60 } // 1 minute cache
    );
  }

  // ✅ FOCUS: Update with cache invalidation
  async updateOrderStatus(
    id: string,
    status: OrderStatus
  ): Promise<Order | null> {
    const orderId = EntityId.fromString(id);

    // Update with automatic cache invalidation
    const updatedOrder = await this.update(orderId, {
      status,
      updatedAt: new Date(),
    });

    if (updatedOrder) {
      // ✅ FOCUS: Selective cache invalidation
      await this.invalidateEntityCache(orderId);
      await this.invalidateCacheByPattern(
        `customer:${updatedOrder.customerId}:orders`
      );
      await this.invalidateCacheByPattern('orders:status:*');
      await this.invalidateCacheByPattern('orders:recent');
    }

    return updatedOrder;
  }

  async addOrderNote(id: string, note: string): Promise<Order | null> {
    const orderId = EntityId.fromString(id);
    const currentOrder = await this.findById(orderId);

    if (!currentOrder) return null;

    const updatedNotes = currentOrder.notes
      ? `${currentOrder.notes}\n${note}`
      : note;

    const updatedOrder = await this.update(orderId, {
      notes: updatedNotes,
      updatedAt: new Date(),
    });

    // Invalidate only the specific order cache
    if (updatedOrder) {
      await this.invalidateEntityCache(orderId);
    }

    return updatedOrder;
  }

  // ✅ FOCUS: Cache warming strategies
  async warmCache(orderIds: string[]): Promise<void> {
    const promises = orderIds.map(async id => {
      const order = await this.findById(EntityId.fromString(id));
      if (order) {
        // Cache is automatically populated by findById
        console.log(`Warmed cache for order: ${id}`);
      }
    });

    await Promise.all(promises);
  }

  async warmCustomerOrdersCache(customerId: string): Promise<void> {
    // Pre-load customer orders into cache
    await this.getOrdersByCustomer(customerId);
    console.log(`Warmed cache for customer orders: ${customerId}`);
  }

  // ✅ FOCUS: Cache statistics and management
  async getCacheStats(): Promise<any> {
    return await this.getCacheMetrics();
  }

  async getCacheHitRate(): Promise<number> {
    const metrics = await this.getCacheMetrics();
    const total = metrics.hits + metrics.misses;
    return total > 0 ? (metrics.hits / total) * 100 : 0;
  }

  // ✅ FOCUS: Bulk operations with cache optimization
  async getMultipleOrdersById(ids: string[]): Promise<Order[]> {
    // ✅ FOCUS: Library batch loading with cache optimization
    const entityIds = ids.map(id => EntityId.fromString(id));
    return await this.findByIds(entityIds);
  }

  async searchOrdersWithCache(
    searchTerm: string,
    limit: number = 20
  ): Promise<Order[]> {
    const cacheKey = `orders:search:${searchTerm}:${limit}`;

    return await this.findWithCache(
      {
        where: [
          {
            field: 'orderNumber',
            operator: 'like',
            value: `%${searchTerm}%`,
            logical: 'OR',
          },
          { field: 'notes', operator: 'like', value: `%${searchTerm}%` },
        ],
        limit,
        orderBy: [{ field: 'createdAt', direction: 'DESC' }],
      },
      { key: cacheKey, ttl: 300 }
    );
  }

  // ✅ FOCUS: Cache maintenance operations
  async clearCustomerCache(customerId: string): Promise<void> {
    await this.invalidateCacheByPattern(`customer:${customerId}:*`);
  }

  async clearStatusCache(): Promise<void> {
    await this.invalidateCacheByPattern('orders:status:*');
  }

  async clearAllOrdersCache(): Promise<void> {
    await this.invalidateCacheByPattern('order:*');
    await this.invalidateCacheByPattern('orders:*');
    await this.invalidateCacheByPattern('customer:*:orders');
  }

  // ✅ FOCUS: Smart cache refresh
  async refreshOrderCache(id: string): Promise<Order | null> {
    const orderId = EntityId.fromString(id);

    // Invalidate cache and reload from database
    await this.invalidateEntityCache(orderId);
    return await this.findById(orderId, { bypassCache: true });
  }

  // Private helper methods
  private calculatePricing(items: any[]) {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const tax = subtotal * 0.08; // 8% tax
    const shipping = 10.0; // Flat shipping
    const total = subtotal + tax + shipping;

    return {
      subtotal,
      tax,
      shipping,
      discount: 0,
      total,
      currency: 'USD',
    };
  }
}

// Usage Example
async function demonstrateCachedRepository() {
  const orderRepo = new OrderCachedRepository();

  // Create order (automatically cached)
  const newOrder = await orderRepo.createOrder({
    customerId: 'customer-123',
    items: [
      {
        productId: 'prod-1',
        productName: 'Laptop',
        sku: 'LAP-001',
        quantity: 1,
        unitPrice: 999.99,
      },
    ],
    billingAddress: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'USA',
    },
    shippingAddress: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'USA',
    },
    paymentMethod: {
      type: 'credit_card',
      provider: 'visa',
      maskedNumber: '****1234',
    },
  });
  console.log('Created order:', newOrder.id);

  // First read (cache miss)
  console.time('First read');
  const order1 = await orderRepo.getOrderById(newOrder.id);
  console.timeEnd('First read');

  // Second read (cache hit)
  console.time('Second read');
  const order2 = await orderRepo.getOrderById(newOrder.id);
  console.timeEnd('Second read');

  // Get cache statistics
  const cacheStats = await orderRepo.getCacheStats();
  console.log('Cache stats:', cacheStats);

  const hitRate = await orderRepo.getCacheHitRate();
  console.log('Cache hit rate:', hitRate.toFixed(2) + '%');

  // Update order (invalidates cache)
  await orderRepo.updateOrderStatus(newOrder.id, 'confirmed');

  // Cache customer orders
  await orderRepo.warmCustomerOrdersCache('customer-123');
}
```

## Key Features

- Transparent caching layer with configurable TTL settings
- Automatic cache invalidation on entity updates
- Pattern-based cache invalidation for related data
- Cache warming strategies for performance optimization
- Cache metrics and hit rate monitoring
- Bulk operations with cache optimization

## Common Pitfalls

- Not invalidating related caches when updating entities
- Using cache keys that are too generic (causing false invalidations)
- Setting cache TTL too high (stale data risk) or too low (poor performance)
- Forgetting to handle cache failures gracefully

## Related Examples

- [Generic Repository Pattern](example-1.md) - Basic CRUD operations
- [Event-Sourced Repository](example-2.md) - Repository with event sourcing
