# Basic Repository Use Cases - Real-World Business Scenarios

This document outlines practical business scenarios where basic repository
patterns are applied using the @vytches-ddd/repositories package.

## Use Case 1: E-Commerce Product Catalog

### Business Scenario

An e-commerce platform needs to manage product information with high read
throughput, complete audit trails, and fast search capabilities.

### Implementation Strategy

- **Generic Repository** for standard CRUD operations
- **Event-Sourced Repository** for price change history and inventory tracking
- **Cached Repository** for product search and category browsing

### Key Benefits

- Fast product search with caching layer
- Complete price change audit trail through event sourcing
- Scalable architecture supporting high traffic volumes

### Code Structure

```typescript
// Product management with multiple repository patterns
class ProductCatalogService {
  constructor(
    private productRepo: ProductRepository, // Basic CRUD
    private productEventRepo: ProductEventRepository, // Event sourcing
    private productCacheRepo: ProductCachedRepository // Performance
  ) {}

  async createProduct(data: CreateProductData): Promise<Product> {
    // Create through event repository for audit trail
    return await this.productEventRepo.createProduct(data);
  }

  async searchProducts(term: string): Promise<Product[]> {
    // Use cached repository for fast search
    return await this.productCacheRepo.searchProductsWithCache(term);
  }

  async updatePrice(id: string, newPrice: number): Promise<Product> {
    // Price changes through event sourcing
    return await this.productEventRepo.updateProductPrice(
      id,
      newPrice,
      'Market adjustment'
    );
  }
}
```

### Performance Characteristics

- **Search queries**: 10-50ms (cached)
- **Price updates**: 50-100ms (with event persistence)
- **Audit queries**: 200-500ms (event reconstruction)

---

## Use Case 2: User Account Management

### Business Scenario

SaaS platform requiring secure user management with role-based access control,
activity tracking, and profile caching for performance.

### Implementation Strategy

- **Generic Repository** for user profile CRUD operations
- **Cached Repository** for frequently accessed user data
- **Event-Sourced Repository** for user activity and permission changes

### Key Benefits

- Fast user authentication and profile loading
- Complete audit trail of permission changes
- Efficient role-based access control queries

### Code Structure

```typescript
class UserManagementService {
  constructor(
    private userRepo: UserRepository,
    private userCacheRepo: UserCachedRepository,
    private userActivityRepo: UserActivityEventRepository
  ) {}

  async authenticateUser(email: string): Promise<User | null> {
    // Fast cached lookup for authentication
    return await this.userCacheRepo.getUserByEmailCached(email);
  }

  async changeUserRole(userId: string, newRole: string): Promise<void> {
    // Log role change through event sourcing
    await this.userActivityRepo.recordRoleChange(userId, newRole);

    // Update cached user data
    await this.userCacheRepo.invalidateUserCache(userId);
  }

  async getUserActivityHistory(userId: string): Promise<UserActivity[]> {
    // Retrieve from event store
    return await this.userActivityRepo.getUserActivityHistory(userId);
  }
}
```

### Security Considerations

- Password hashing before repository storage
- Sensitive data exclusion from cache
- Audit trail immutability through event sourcing

---

## Use Case 3: Order Processing System

### Business Scenario

Order management system handling high transaction volumes with real-time
inventory tracking, customer history, and order status updates.

### Implementation Strategy

- **Generic Repository** for basic order operations
- **Cached Repository** for customer order history and frequent lookups
- **Event-Sourced Repository** for order status transitions and audit compliance

### Key Benefits

- Real-time order status tracking
- Fast customer service queries through caching
- Regulatory compliance through complete audit trails

### Code Structure

```typescript
class OrderProcessingService {
  constructor(
    private orderRepo: OrderRepository,
    private orderCacheRepo: OrderCachedRepository,
    private orderEventRepo: OrderEventRepository
  ) {}

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    // Create through event repository for tracking
    const order = await this.orderEventRepo.createOrder(orderData);

    // Warm cache for fast retrieval
    await this.orderCacheRepo.warmOrderCache(order.id);

    return order;
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus
  ): Promise<void> {
    // Status changes through event sourcing
    await this.orderEventRepo.updateOrderStatus(orderId, newStatus);

    // Invalidate cache to ensure consistency
    await this.orderCacheRepo.invalidateOrderCache(orderId);
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    // Fast retrieval from cache
    return await this.orderCacheRepo.getOrdersByCustomerCached(customerId);
  }
}
```

### Performance Targets

- **Order creation**: < 200ms
- **Status updates**: < 100ms
- **Customer history**: < 50ms (cached)

---

## Use Case 4: Financial Transaction Ledger

### Business Scenario

Financial system requiring immutable transaction records, real-time balance
calculations, and regulatory compliance reporting.

### Implementation Strategy

- **Event-Sourced Repository** as primary pattern for immutability
- **Cached Repository** for account balance snapshots
- **Generic Repository** for reference data (account details, etc.)

### Key Benefits

- Immutable transaction history
- Fast balance inquiries through caching
- Complete audit trail for compliance

### Code Structure

```typescript
class FinancialLedgerService {
  constructor(
    private transactionEventRepo: TransactionEventRepository,
    private accountCacheRepo: AccountCachedRepository,
    private accountRepo: AccountRepository
  ) {}

  async recordTransaction(transaction: TransactionData): Promise<void> {
    // All transactions through event sourcing
    await this.transactionEventRepo.recordTransaction(transaction);

    // Update cached balances
    await this.accountCacheRepo.updateBalanceCache(transaction.accountId);
  }

  async getAccountBalance(accountId: string): Promise<number> {
    // Fast balance retrieval from cache
    return await this.accountCacheRepo.getCachedBalance(accountId);
  }

  async generateComplianceReport(
    accountId: string,
    period: DateRange
  ): Promise<TransactionReport> {
    // Reconstruct from events for compliance
    return await this.transactionEventRepo.generateComplianceReport(
      accountId,
      period
    );
  }
}
```

### Compliance Features

- Immutable transaction records
- Point-in-time balance reconstruction
- Complete audit trail with timestamps

---

## Use Case 5: Content Management System

### Business Scenario

CMS platform with content versioning, user collaboration, draft management, and
performance optimization for public-facing content.

### Implementation Strategy

- **Event-Sourced Repository** for content versioning and change tracking
- **Cached Repository** for published content delivery
- **Generic Repository** for content metadata and relationships

### Key Benefits

- Complete content version history
- Fast content delivery through caching
- Collaborative editing with change tracking

### Code Structure

```typescript
class ContentManagementService {
  constructor(
    private contentEventRepo: ContentEventRepository,
    private contentCacheRepo: ContentCachedRepository,
    private contentMetaRepo: ContentRepository
  ) {}

  async publishContent(contentId: string): Promise<void> {
    // Record publish event
    await this.contentEventRepo.publishContent(contentId);

    // Cache published content for fast delivery
    await this.contentCacheRepo.cachePublishedContent(contentId);
  }

  async getPublishedContent(contentId: string): Promise<Content> {
    // Fast delivery from cache
    return await this.contentCacheRepo.getPublishedContentCached(contentId);
  }

  async getContentHistory(contentId: string): Promise<ContentVersion[]> {
    // Version history from event store
    return await this.contentEventRepo.getContentHistory(contentId);
  }
}
```

---

## Common Patterns Across Use Cases

### Repository Selection Criteria

| Pattern                  | Best For                       | Performance | Audit Trail | Complexity |
| ------------------------ | ------------------------------ | ----------- | ----------- | ---------- |
| Generic Repository       | Simple CRUD, Reference Data    | Good        | Basic       | Low        |
| Event-Sourced Repository | Audit Requirements, Versioning | Moderate    | Complete    | High       |
| Cached Repository        | High Read Volume, Performance  | Excellent   | Basic       | Medium     |

### Performance Optimization Strategies

1. **Read-Heavy Workloads**: Use cached repositories with appropriate TTL
   settings
2. **Audit Requirements**: Implement event sourcing for complete change tracking
3. **High Write Volume**: Consider generic repositories with async event
   publishing
4. **Complex Queries**: Combine patterns with read replicas and materialized
   views

### Data Consistency Patterns

1. **Eventual Consistency**: Cache invalidation with background refresh
2. **Strong Consistency**: Direct database queries bypassing cache
3. **Event Consistency**: Event sourcing ensures consistent state reconstruction

### Scalability Considerations

1. **Horizontal Scaling**: Repository pattern supports database sharding
2. **Cache Distribution**: Redis clustering for cached repository scaling
3. **Event Store Scaling**: Event stream partitioning by aggregate ID
4. **Read Replicas**: Route read operations to dedicated database instances

These use cases demonstrate how the @vytches-ddd/repositories patterns can be
combined to address real-world business requirements while maintaining
performance, consistency, and auditability.
