# Basic Domain Primitives Implementation Guide

**Version**: 2025-01-21  
**Package**: @vytches-ddd/domain-primitives  
**Complexity**: Basic  
**Category**: Implementation

## Overview

This guide demonstrates how to implement basic domain primitives in your
application. We'll cover errors, actors, and interfaces working together to
create a robust domain layer.

## Complete Implementation Example

```typescript
import {
  BaseError,
  IDomainError,
  DomainErrorCode,
  IActor,
  DefaultActorType,
  InvalidParameterError,
  NotFoundError,
} from '@vytches-ddd/domain-primitives';
import { DomainEntity, Repository, ActionContext, AuditEntry } from '../types';

// ====================
// Domain Errors
// ====================

export class OrderNotFoundError extends NotFoundError {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`, {
      code: DomainErrorCode.NotFound,
      domain: 'OrderManagement',
      data: { orderId },
    });
  }
}

export class InsufficientStockError extends IDomainError {
  constructor(productId: string, available: number, requested: number) {
    super(`Insufficient stock for product ${productId}`, {
      code: DomainErrorCode.BusinessRule,
      domain: 'Inventory',
      data: { productId, available, requested },
    });
  }
}

export class InvalidOrderStateError extends IDomainError {
  constructor(orderId: string, currentState: string, attemptedAction: string) {
    super(`Cannot ${attemptedAction} order in ${currentState} state`, {
      code: DomainErrorCode.InvalidState,
      domain: 'OrderManagement',
      data: { orderId, currentState, attemptedAction },
    });
  }
}

// ====================
// Domain Interfaces
// ====================

export interface IOrder extends DomainEntity {
  customerId: string;
  items: IOrderItem[];
  status: OrderStatus;
  total: number;
}

export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface IOrderRepository extends Repository<Order> {
  findByCustomerId(customerId: string): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
}

// ====================
// Domain Entities
// ====================

export class Order implements IOrder {
  id: string;
  customerId: string;
  items: IOrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  constructor(data: { id?: string; customerId: string; items: IOrderItem[] }) {
    this.id = data.id || this.generateId();
    this.customerId = data.customerId;
    this.items = data.items;
    this.status = OrderStatus.PENDING;
    this.total = this.calculateTotal();
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.version = 1;

    this.validate();
  }

  private validate(): void {
    if (!this.customerId) {
      throw new InvalidParameterError('Customer ID is required', {
        code: DomainErrorCode.InvalidParameter,
        domain: 'OrderManagement',
        data: { field: 'customerId' },
      });
    }

    if (!this.items || this.items.length === 0) {
      throw new InvalidParameterError('Order must have at least one item', {
        code: DomainErrorCode.InvalidParameter,
        domain: 'OrderManagement',
        data: { field: 'items' },
      });
    }

    this.items.forEach((item, index) => {
      if (item.quantity <= 0) {
        throw new InvalidParameterError(`Invalid quantity for item ${index}`, {
          code: DomainErrorCode.InvalidParameter,
          domain: 'OrderManagement',
          data: { field: `items[${index}].quantity`, value: item.quantity },
        });
      }
    });
  }

  private calculateTotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  }

  confirm(): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new InvalidOrderStateError(this.id, this.status, 'confirm');
    }
    this.status = OrderStatus.CONFIRMED;
    this.updatedAt = new Date();
    this.version++;
  }

  ship(): void {
    if (this.status !== OrderStatus.CONFIRMED) {
      throw new InvalidOrderStateError(this.id, this.status, 'ship');
    }
    this.status = OrderStatus.SHIPPED;
    this.updatedAt = new Date();
    this.version++;
  }

  cancel(): void {
    if (
      this.status === OrderStatus.SHIPPED ||
      this.status === OrderStatus.DELIVERED
    ) {
      throw new InvalidOrderStateError(this.id, this.status, 'cancel');
    }
    this.status = OrderStatus.CANCELLED;
    this.updatedAt = new Date();
    this.version++;
  }

  private generateId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ====================
// Actor Implementation
// ====================

export class OrderActor implements IActor {
  type: string;
  source: string;
  id: string;
  metadata?: Record<string, unknown>;

  static createCustomerActor(
    customerId: string,
    source: string = 'web'
  ): OrderActor {
    return new OrderActor({
      type: DefaultActorType.USER,
      id: customerId,
      source,
      metadata: { role: 'customer' },
    });
  }

  static createAdminActor(adminId: string, department: string): OrderActor {
    return new OrderActor({
      type: DefaultActorType.ADMIN,
      id: adminId,
      source: 'admin-panel',
      metadata: { department },
    });
  }

  static createSystemActor(process: string): OrderActor {
    return new OrderActor({
      type: DefaultActorType.SYSTEM,
      id: process,
      source: 'automated',
      metadata: { timestamp: new Date() },
    });
  }

  constructor(data: {
    type: string;
    id: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) {
    this.type = data.type;
    this.id = data.id;
    this.source = data.source;
    this.metadata = data.metadata;
  }
}

// ====================
// Service Implementation
// ====================

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private inventoryService: InventoryService,
    private auditService: AuditService
  ) {}

  async createOrder(
    customerId: string,
    items: IOrderItem[],
    actor: IActor
  ): Promise<Order> {
    try {
      // Check inventory
      for (const item of items) {
        const available = await this.inventoryService.checkStock(
          item.productId
        );
        if (available < item.quantity) {
          throw new InsufficientStockError(
            item.productId,
            available,
            item.quantity
          );
        }
      }

      // Create order
      const order = new Order({ customerId, items });

      // Reserve inventory
      await this.inventoryService.reserveItems(
        items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );

      // Save order
      await this.orderRepository.save(order);

      // Audit the action
      await this.auditService.recordAction(
        actor,
        'CREATE_ORDER',
        `order:${order.id}`,
        {
          customerId,
          itemCount: items.length,
          total: order.total,
        }
      );

      return order;
    } catch (error) {
      // Audit failed action
      await this.auditService.recordFailedAction(
        actor,
        'CREATE_ORDER',
        'order:new',
        error as Error
      );
      throw error;
    }
  }

  async confirmOrder(orderId: string, actor: IActor): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    try {
      order.confirm();
      await this.orderRepository.save(order);

      await this.auditService.recordAction(
        actor,
        'CONFIRM_ORDER',
        `order:${orderId}`,
        { previousStatus: OrderStatus.PENDING }
      );

      return order;
    } catch (error) {
      await this.auditService.recordFailedAction(
        actor,
        'CONFIRM_ORDER',
        `order:${orderId}`,
        error as Error
      );
      throw error;
    }
  }

  async cancelOrder(
    orderId: string,
    reason: string,
    actor: IActor
  ): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    try {
      const previousStatus = order.status;
      order.cancel();

      // Release reserved inventory if order was confirmed
      if (previousStatus === OrderStatus.CONFIRMED) {
        await this.inventoryService.releaseItems(
          order.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        );
      }

      await this.orderRepository.save(order);

      await this.auditService.recordAction(
        actor,
        'CANCEL_ORDER',
        `order:${orderId}`,
        { previousStatus, reason }
      );

      return order;
    } catch (error) {
      await this.auditService.recordFailedAction(
        actor,
        'CANCEL_ORDER',
        `order:${orderId}`,
        error as Error
      );
      throw error;
    }
  }
}

// ====================
// Supporting Services
// ====================

export class InventoryService {
  private stock: Map<string, number> = new Map();

  async checkStock(productId: string): Promise<number> {
    return this.stock.get(productId) || 0;
  }

  async reserveItems(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<void> {
    // Check all items first
    for (const item of items) {
      const available = this.stock.get(item.productId) || 0;
      if (available < item.quantity) {
        throw new InsufficientStockError(
          item.productId,
          available,
          item.quantity
        );
      }
    }

    // Reserve items
    for (const item of items) {
      const current = this.stock.get(item.productId) || 0;
      this.stock.set(item.productId, current - item.quantity);
    }
  }

  async releaseItems(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<void> {
    for (const item of items) {
      const current = this.stock.get(item.productId) || 0;
      this.stock.set(item.productId, current + item.quantity);
    }
  }

  // For testing - set initial stock
  setStock(productId: string, quantity: number): void {
    this.stock.set(productId, quantity);
  }
}

export class AuditService {
  private auditLog: AuditEntry[] = [];

  async recordAction(
    actor: IActor,
    action: string,
    resource: string,
    changes?: Record<string, unknown>
  ): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}`,
      actor: {
        type: actor.type,
        id: actor.id,
        source: actor.source,
        metadata: actor.metadata,
      },
      action,
      resource,
      timestamp: new Date(),
      changes,
      result: 'success',
    };

    this.auditLog.push(entry);
    console.log('Audit:', entry);
    return entry;
  }

  async recordFailedAction(
    actor: IActor,
    action: string,
    resource: string,
    error: Error
  ): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}`,
      actor: {
        type: actor.type,
        id: actor.id,
        source: actor.source,
        metadata: actor.metadata,
      },
      action,
      resource,
      timestamp: new Date(),
      changes: { error: error.message },
      result: 'failure',
    };

    this.auditLog.push(entry);
    console.log('Audit (Failed):', entry);
    return entry;
  }
}
```

## Usage Example

```typescript
// ====================
// Usage Example
// ====================

async function demonstrateOrderWorkflow() {
  // Setup services
  const orderRepository = new InMemoryOrderRepository();
  const inventoryService = new InventoryService();
  const auditService = new AuditService();

  const orderService = new OrderService(
    orderRepository,
    inventoryService,
    auditService
  );

  // Set initial inventory
  inventoryService.setStock('prod_001', 100);
  inventoryService.setStock('prod_002', 50);

  // Create actors
  const customerActor = OrderActor.createCustomerActor('customer_123');
  const adminActor = OrderActor.createAdminActor('admin_456', 'operations');

  try {
    // Customer creates an order
    const order = await orderService.createOrder(
      'customer_123',
      [
        {
          productId: 'prod_001',
          productName: 'Widget A',
          quantity: 5,
          unitPrice: 10.99,
        },
        {
          productId: 'prod_002',
          productName: 'Widget B',
          quantity: 3,
          unitPrice: 15.99,
        },
      ],
      customerActor
    );

    console.log('Order created:', order.id);

    // Admin confirms the order
    const confirmedOrder = await orderService.confirmOrder(
      order.id,
      adminActor
    );

    console.log('Order confirmed:', confirmedOrder.status);

    // Check remaining inventory
    const stock1 = await inventoryService.checkStock('prod_001');
    const stock2 = await inventoryService.checkStock('prod_002');
    console.log('Remaining stock:', { prod_001: stock1, prod_002: stock2 });
  } catch (error) {
    if (error instanceof IDomainError) {
      console.error('Domain error:', {
        message: error.message,
        code: error.code,
        domain: error.domain,
        data: error.data,
      });
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Simple in-memory repository
class InMemoryOrderRepository implements IOrderRepository {
  private orders: Map<string, Order> = new Map();

  async save(order: Order): Promise<Order> {
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async findAll(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return this.orders.has(id);
  }

  async count(): Promise<number> {
    return this.orders.size;
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      order => order.customerId === customerId
    );
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      order => order.status === status
    );
  }
}
```

## Key Implementation Points

1. **Error Hierarchy**: Create specific error types for different scenarios
2. **Actor Tracking**: Always track who performs actions
3. **Interface Contracts**: Define clear interfaces for all domain concepts
4. **State Validation**: Validate entity state transitions
5. **Audit Trail**: Record all significant actions and failures

## Best Practices Applied

1. **Domain-Specific Errors**: Each error carries meaningful context
2. **Actor Factory Methods**: Consistent actor creation
3. **Repository Pattern**: Abstract data access
4. **Service Layer**: Orchestrate domain operations
5. **Audit Integration**: Built-in audit trail

## Common Pitfalls to Avoid

```typescript
// ❌ Bad: Generic errors
throw new Error('Order not found');

// ✅ Good: Domain-specific errors
throw new OrderNotFoundError(orderId);

// ❌ Bad: No actor tracking
await orderService.createOrder(customerId, items);

// ✅ Good: Always track actors
await orderService.createOrder(customerId, items, actor);

// ❌ Bad: Anemic domain model
class Order {
  status: string;
  // No behavior, just data
}

// ✅ Good: Rich domain model
class Order {
  confirm(): void {
    // Business logic here
  }
}
```

## Next Steps

- Add event sourcing to track all changes
- Implement more complex business rules
- Add integration with external services
- Build comprehensive test suites
