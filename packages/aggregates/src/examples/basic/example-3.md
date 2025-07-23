# Product Inventory Aggregate - Transaction Script to DDD Evolution

**Version**: 1.0.0 **Package**: @vytches-ddd/aggregates **Complexity**: Basic
**Domain**: Inventory Management **Patterns**: Aggregate Root, Optimistic
Locking, Business Invariants, Event Sourcing Ready **Dependencies**:
@vytches-ddd/aggregates, @vytches-ddd/domain-primitives, @vytches-ddd/contracts

## Description

This example shows how to evolve from a transaction script approach to a proper
DDD aggregate for inventory management. The aggregate maintains product
inventory levels with business rules for stock management, reservations, and
automatic reordering.

## Business Context

An e-commerce platform needs precise inventory tracking with features like stock
reservations for pending orders, automatic low-stock alerts, and multi-location
inventory support. The aggregate ensures inventory consistency while preventing
overselling and managing complex stock movements.

## Code Example

```typescript
// product-inventory.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/aggregates';
import { DomainEvent } from '@vytches-ddd/contracts';
import { BaseError, EntityId } from '@vytches-ddd/domain-primitives';
import {
  ProductData,
  InventoryLocation,
  StockMovement,
  ReservationData,
} from './types'; // From your application

// Domain Events
export class InventoryInitializedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly initialStock: number
  ) {
    super();
  }
}

export class StockAddedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly locationId: string,
    public readonly reference: string
  ) {
    super();
  }
}

export class StockReservedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly reservationId: string,
    public readonly quantity: number,
    public readonly orderId: string
  ) {
    super();
  }
}

export class StockReleasedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly reservationId: string,
    public readonly quantity: number,
    public readonly reason: string
  ) {
    super();
  }
}

export class LowStockAlertEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly currentStock: number,
    public readonly threshold: number,
    public readonly sku: string
  ) {
    super();
  }
}

export class StockDepletedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly lastSaleTimestamp: Date
  ) {
    super();
  }
}

// Domain Errors
export class InsufficientStockError extends BaseError {
  constructor(available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Insufficient stock: ${available} available, ${requested} requested`
    );
  }
}

export class InvalidQuantityError extends BaseError {
  constructor(quantity: number) {
    super(
      'INVALID_QUANTITY',
      `Invalid quantity: ${quantity}. Must be positive`
    );
  }
}

export class ReservationNotFoundError extends BaseError {
  constructor(reservationId: string) {
    super('RESERVATION_NOT_FOUND', `Reservation ${reservationId} not found`);
  }
}

export class DuplicateReservationError extends BaseError {
  constructor(orderId: string) {
    super(
      'DUPLICATE_RESERVATION',
      `Reservation for order ${orderId} already exists`
    );
  }
}

// Inventory Aggregate Root
export class ProductInventoryAggregate extends AggregateRoot {
  private sku: string;
  private productName: string;
  private totalStock: number;
  private availableStock: number;
  private reservedStock: number;
  private lowStockThreshold: number;
  private reorderPoint: number;
  private reorderQuantity: number;
  private locations: Map<string, InventoryLocation>;
  private reservations: Map<string, ReservationData>;
  private movements: StockMovement[];
  private lastStockCheck: Date;
  private version: number; // For optimistic locking

  private constructor(id: EntityId) {
    super(id);
    this.totalStock = 0;
    this.availableStock = 0;
    this.reservedStock = 0;
    this.lowStockThreshold = 10;
    this.reorderPoint = 20;
    this.reorderQuantity = 100;
    this.locations = new Map();
    this.reservations = new Map();
    this.movements = [];
    this.lastStockCheck = new Date();
    this.version = 0;
  }

  // ⭐ Factory method for new inventory
  static create(
    productData: ProductData & { initialStock?: number }
  ): ProductInventoryAggregate {
    const inventory = new ProductInventoryAggregate(EntityId.generate());

    // Set product details
    inventory.sku = productData.sku;
    inventory.productName = productData.name;

    // Set inventory thresholds
    if (productData.lowStockThreshold !== undefined) {
      inventory.lowStockThreshold = productData.lowStockThreshold;
    }
    if (productData.reorderPoint !== undefined) {
      inventory.reorderPoint = productData.reorderPoint;
    }
    if (productData.reorderQuantity !== undefined) {
      inventory.reorderQuantity = productData.reorderQuantity;
    }

    // Initialize with stock if provided
    if (productData.initialStock && productData.initialStock > 0) {
      inventory.addInitialStock(productData.initialStock, 'main');
    }

    // Emit initialization event
    inventory.addDomainEvent(
      new InventoryInitializedEvent(
        inventory.id.value,
        inventory.sku,
        inventory.totalStock
      )
    );

    return inventory;
  }

  // ⭐ Reconstitute from persistence
  static fromSnapshot(id: EntityId, data: any): ProductInventoryAggregate {
    const inventory = new ProductInventoryAggregate(id);

    inventory.sku = data.sku;
    inventory.productName = data.productName;
    inventory.totalStock = data.totalStock;
    inventory.availableStock = data.availableStock;
    inventory.reservedStock = data.reservedStock;
    inventory.lowStockThreshold = data.lowStockThreshold;
    inventory.reorderPoint = data.reorderPoint;
    inventory.reorderQuantity = data.reorderQuantity;
    inventory.lastStockCheck = new Date(data.lastStockCheck);
    inventory.version = data.version;

    // Restore locations
    data.locations.forEach((loc: InventoryLocation) => {
      inventory.locations.set(loc.locationId, loc);
    });

    // Restore reservations
    data.reservations.forEach((res: ReservationData) => {
      inventory.reservations.set(res.reservationId, res);
    });

    // Restore recent movements (keep last 100)
    inventory.movements = data.movements.slice(-100);

    inventory.markAsHydrated();

    return inventory;
  }

  // ⭐ Stock management operations
  addStock(
    quantity: number,
    locationId: string = 'main',
    reference: string = ''
  ): void {
    this.validateQuantity(quantity);

    // Update location stock
    const location = this.getOrCreateLocation(locationId);
    location.stock += quantity;
    location.lastRestocked = new Date();

    // Update totals
    this.totalStock += quantity;
    this.availableStock += quantity;

    // Record movement
    this.recordMovement({
      type: 'addition',
      quantity,
      locationId,
      reference,
      timestamp: new Date(),
      resultingStock: this.totalStock,
    });

    // Increment version for optimistic locking
    this.version++;

    // Emit event
    this.addDomainEvent(
      new StockAddedEvent(this.id.value, quantity, locationId, reference)
    );
  }

  reserveStock(quantity: number, orderId: string): string {
    this.validateQuantity(quantity);

    // Check for duplicate reservation
    const existingReservation = Array.from(this.reservations.values()).find(
      r => r.orderId === orderId
    );
    if (existingReservation) {
      throw new DuplicateReservationError(orderId);
    }

    // Check available stock
    if (this.availableStock < quantity) {
      throw new InsufficientStockError(this.availableStock, quantity);
    }

    // Create reservation
    const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const reservation: ReservationData = {
      reservationId,
      orderId,
      quantity,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };

    // Update stock levels
    this.availableStock -= quantity;
    this.reservedStock += quantity;
    this.reservations.set(reservationId, reservation);

    // Record movement
    this.recordMovement({
      type: 'reservation',
      quantity,
      locationId: 'main',
      reference: orderId,
      timestamp: new Date(),
      resultingStock: this.availableStock,
    });

    this.version++;

    // Emit event
    this.addDomainEvent(
      new StockReservedEvent(this.id.value, reservationId, quantity, orderId)
    );

    // Check if we need to alert for low stock
    this.checkLowStock();

    return reservationId;
  }

  confirmReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    // Remove from reserved stock and total stock
    this.reservedStock -= reservation.quantity;
    this.totalStock -= reservation.quantity;

    // Remove reservation
    this.reservations.delete(reservationId);

    // Distribute stock removal across locations
    this.distributeStockRemoval(reservation.quantity);

    // Record movement
    this.recordMovement({
      type: 'sale',
      quantity: reservation.quantity,
      locationId: 'main',
      reference: reservation.orderId,
      timestamp: new Date(),
      resultingStock: this.totalStock,
    });

    this.version++;

    // Check for stock depletion
    if (this.totalStock === 0) {
      this.addDomainEvent(
        new StockDepletedEvent(this.id.value, this.sku, new Date())
      );
    }

    this.checkLowStock();
  }

  releaseReservation(
    reservationId: string,
    reason: string = 'Cancelled'
  ): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    // Return stock to available
    this.availableStock += reservation.quantity;
    this.reservedStock -= reservation.quantity;

    // Remove reservation
    this.reservations.delete(reservationId);

    // Record movement
    this.recordMovement({
      type: 'release',
      quantity: reservation.quantity,
      locationId: 'main',
      reference: `${reservation.orderId} - ${reason}`,
      timestamp: new Date(),
      resultingStock: this.availableStock,
    });

    this.version++;

    // Emit event
    this.addDomainEvent(
      new StockReleasedEvent(
        this.id.value,
        reservationId,
        reservation.quantity,
        reason
      )
    );
  }

  // ⭐ Automated operations
  checkAndReleaseExpiredReservations(): void {
    const now = new Date();
    const expiredReservations: string[] = [];

    this.reservations.forEach((reservation, id) => {
      if (reservation.expiresAt < now) {
        expiredReservations.push(id);
      }
    });

    expiredReservations.forEach(reservationId => {
      this.releaseReservation(reservationId, 'Expired');
    });
  }

  adjustStock(newTotalStock: number, reason: string): void {
    const difference = newTotalStock - this.totalStock;

    if (difference === 0) return;

    if (difference > 0) {
      this.addStock(difference, 'main', `Adjustment: ${reason}`);
    } else {
      // Handle negative adjustment
      const removalQuantity = Math.abs(difference);

      if (this.availableStock < removalQuantity) {
        throw new InsufficientStockError(this.availableStock, removalQuantity);
      }

      this.totalStock = newTotalStock;
      this.availableStock -= removalQuantity;
      this.distributeStockRemoval(removalQuantity);

      this.recordMovement({
        type: 'adjustment',
        quantity: difference,
        locationId: 'main',
        reference: reason,
        timestamp: new Date(),
        resultingStock: this.totalStock,
      });

      this.version++;
    }

    this.checkLowStock();
  }

  // ⭐ Private helper methods
  private validateQuantity(quantity: number): void {
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new InvalidQuantityError(quantity);
    }
  }

  private getOrCreateLocation(locationId: string): InventoryLocation {
    let location = this.locations.get(locationId);
    if (!location) {
      location = {
        locationId,
        stock: 0,
        lastRestocked: new Date(),
        isActive: true,
      };
      this.locations.set(locationId, location);
    }
    return location;
  }

  private distributeStockRemoval(quantity: number): void {
    let remaining = quantity;

    // Remove stock from locations, starting with main
    const sortedLocations = Array.from(this.locations.values()).sort((a, b) =>
      a.locationId === 'main' ? -1 : 1
    );

    for (const location of sortedLocations) {
      if (remaining <= 0) break;

      const toRemove = Math.min(location.stock, remaining);
      location.stock -= toRemove;
      remaining -= toRemove;
    }
  }

  private recordMovement(movement: StockMovement): void {
    this.movements.push(movement);

    // Keep only last 100 movements
    if (this.movements.length > 100) {
      this.movements = this.movements.slice(-100);
    }
  }

  private checkLowStock(): void {
    if (
      this.availableStock <= this.lowStockThreshold &&
      this.availableStock > 0
    ) {
      this.addDomainEvent(
        new LowStockAlertEvent(
          this.id.value,
          this.availableStock,
          this.lowStockThreshold,
          this.sku
        )
      );
    }
  }

  private addInitialStock(quantity: number, locationId: string): void {
    const location = this.getOrCreateLocation(locationId);
    location.stock = quantity;
    this.totalStock = quantity;
    this.availableStock = quantity;

    this.recordMovement({
      type: 'initial',
      quantity,
      locationId,
      reference: 'Initial stock',
      timestamp: new Date(),
      resultingStock: quantity,
    });
  }

  // ⭐ State accessors
  toSnapshot(): any {
    return {
      id: this.id.value,
      sku: this.sku,
      productName: this.productName,
      totalStock: this.totalStock,
      availableStock: this.availableStock,
      reservedStock: this.reservedStock,
      lowStockThreshold: this.lowStockThreshold,
      reorderPoint: this.reorderPoint,
      reorderQuantity: this.reorderQuantity,
      locations: Array.from(this.locations.values()),
      reservations: Array.from(this.reservations.values()),
      movements: this.movements,
      lastStockCheck: this.lastStockCheck,
      version: this.version,
    };
  }

  get currentStock(): number {
    return this.totalStock;
  }

  get available(): number {
    return this.availableStock;
  }

  get reserved(): number {
    return this.reservedStock;
  }

  get needsReorder(): boolean {
    return this.totalStock <= this.reorderPoint;
  }

  get stockByLocation(): Map<string, number> {
    const result = new Map<string, number>();
    this.locations.forEach((location, id) => {
      result.set(id, location.stock);
    });
    return result;
  }

  get aggregateVersion(): number {
    return this.version;
  }
}

// Usage example
export function inventoryManagementExample(): void {
  // Create product inventory
  const inventory = ProductInventoryAggregate.create({
    sku: 'LAPTOP-001',
    name: 'Gaming Laptop Pro',
    description: 'High-performance gaming laptop',
    category: 'Electronics',
    price: 1299.99,
    currency: 'USD',
    initialStock: 50,
    lowStockThreshold: 10,
    reorderPoint: 20,
    reorderQuantity: 100,
  });

  console.log('Initial stock:', inventory.currentStock);
  console.log('Available:', inventory.available);

  // Add stock from supplier
  inventory.addStock(30, 'warehouse-1', 'PO-2024-001');
  console.log('After restock:', inventory.currentStock);

  // Reserve stock for orders
  const reservation1 = inventory.reserveStock(5, 'ORDER-001');
  const reservation2 = inventory.reserveStock(3, 'ORDER-002');

  console.log('After reservations:');
  console.log('- Total:', inventory.currentStock);
  console.log('- Available:', inventory.available);
  console.log('- Reserved:', inventory.reserved);

  // Confirm one order (stock sold)
  inventory.confirmReservation(reservation1);
  console.log('After confirming ORDER-001:');
  console.log('- Total:', inventory.currentStock);
  console.log('- Available:', inventory.available);

  // Release other reservation (order cancelled)
  inventory.releaseReservation(reservation2, 'Customer cancelled');
  console.log('After releasing ORDER-002:');
  console.log('- Available:', inventory.available);

  // Check stock levels by location
  console.log('Stock by location:', inventory.stockByLocation);

  // Simulate stock adjustment (inventory count)
  inventory.adjustStock(70, 'Physical inventory count');
  console.log('After adjustment:', inventory.currentStock);

  // Check if reorder needed
  console.log('Needs reorder?', inventory.needsReorder);

  // View all events
  console.log('Domain events:', inventory.getUncommittedEvents());

  // Demonstrate optimistic locking
  console.log('Aggregate version:', inventory.aggregateVersion);
}
```

## Key Features

- **Stock Reservation System**: Temporary stock holds for pending orders
- **Multi-Location Support**: Track inventory across warehouses
- **Automatic Alerts**: Low stock and depletion notifications
- **Movement History**: Complete audit trail of stock changes
- **Optimistic Locking**: Version tracking for concurrent updates
- **Business Rules**: Reorder points, thresholds, and validations

## Stock Movement Types

1. **Initial**: Setting up initial inventory
2. **Addition**: Receiving new stock
3. **Reservation**: Holding stock for orders
4. **Sale**: Confirmed stock removal
5. **Release**: Cancelled reservations
6. **Adjustment**: Inventory count corrections

## Business Rules Enforced

1. **No Overselling**: Cannot reserve more than available
2. **Positive Quantities**: All stock movements must be positive
3. **Reservation Expiry**: Auto-release after timeout
4. **Low Stock Alerts**: Automatic notifications at threshold
5. **Version Control**: Optimistic locking prevents conflicts

## Common Pitfalls

- **Forgetting reservation cleanup**: Implement scheduled expiry checks
- **Not tracking movements**: Always record stock changes for audit
- **Ignoring concurrent updates**: Use version checking in repository
- **Missing location updates**: Properly distribute stock changes

## Related Examples

- [User Aggregate](./example-1.md)
- [Order Aggregate with State Machine](./example-2.md)
- [Event Sourced Shopping Cart](../intermediate/example-1.md)
