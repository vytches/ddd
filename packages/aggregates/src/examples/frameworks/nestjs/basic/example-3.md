# Product Inventory Aggregate - NestJS Integration

**Focus**: Product inventory management with stock tracking in NestJS **Base
Example**: [Basic Product Inventory Aggregate](../../basic/example-3.md)
**Dependencies**: @nestjs/common, @vytches-ddd/aggregates, @vytches-ddd/di

## Service Implementation

```typescript
// product-inventory.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { VytchesDDD } from '@vytches-ddd/di';
import { EntityId } from '@vytches-ddd/domain-primitives';
import {
  ProductInventory,
  CreateProductData,
  StockLocation,
  StockReservation,
  InventoryAdjustment,
  StockMovement,
} from './types'; // From your application

@Injectable()
export class ProductInventoryService {
  private readonly logger = new Logger(ProductInventoryService.name);

  // ✅ FOCUS: Product creation with initial inventory
  async createProduct(
    productData: CreateProductData
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );

      // Use library factory method
      const inventoryAggregate = ProductInventoryAggregateClass.create(
        productData.sku,
        productData.name,
        productData.initialStock,
        productData.minimumStockLevel,
        productData.locations
      );

      const product = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Product created: ${product.sku} with initial stock ${product.totalStock}`
      );
      return product;
    } catch (error) {
      this.logger.error(`Failed to create product: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Stock management operations
  async adjustStock(
    productId: string,
    location: string,
    quantity: number,
    reason: string
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method for stock adjustment
      inventoryAggregate.adjustStock(location, quantity, reason);

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Stock adjusted for ${productId} at ${location}: ${quantity} (${reason})`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(`Failed to adjust stock: ${error.message}`);
      throw error;
    }
  }

  async receiveStock(
    productId: string,
    location: string,
    quantity: number,
    supplierReference?: string
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method for stock receipt
      inventoryAggregate.receiveStock(location, quantity, supplierReference);

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Stock received for ${productId}: +${quantity} at ${location}`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(`Failed to receive stock: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Reservation management
  async reserveStock(
    productId: string,
    quantity: number,
    reservationId: string,
    expiresAt?: Date
  ): Promise<StockReservation> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library reservation method
      const reservation = inventoryAggregate.reserveStock(
        quantity,
        reservationId,
        expiresAt
      );

      this.logger.log(
        `Stock reserved for ${productId}: ${quantity} units (${reservationId})`
      );
      return reservation;
    } catch (error) {
      this.logger.error(`Failed to reserve stock: ${error.message}`);
      throw error;
    }
  }

  async releaseReservation(
    productId: string,
    reservationId: string
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to release reservation
      inventoryAggregate.releaseReservation(reservationId);

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Reservation released for ${productId}: ${reservationId}`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(`Failed to release reservation: ${error.message}`);
      throw error;
    }
  }

  async fulfillReservation(
    productId: string,
    reservationId: string
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to fulfill reservation
      inventoryAggregate.fulfillReservation(reservationId);

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Reservation fulfilled for ${productId}: ${reservationId}`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(`Failed to fulfill reservation: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Stock transfer operations
  async transferStock(
    productId: string,
    fromLocation: string,
    toLocation: string,
    quantity: number,
    transferReference?: string
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method for stock transfer
      inventoryAggregate.transferStock(
        fromLocation,
        toLocation,
        quantity,
        transferReference
      );

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Stock transferred for ${productId}: ${quantity} from ${fromLocation} to ${toLocation}`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(`Failed to transfer stock: ${error.message}`);
      throw error;
    }
  }

  // ✅ FOCUS: Inventory alerts and monitoring
  async checkLowStockAlerts(productId: string): Promise<StockLocation[]> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to check low stock
      const lowStockLocations = inventoryAggregate.getLowStockLocations();

      if (lowStockLocations.length > 0) {
        this.logger.warn(
          `Low stock detected for ${productId} at ${lowStockLocations.length} locations`
        );
      }

      return lowStockLocations;
    } catch (error) {
      this.logger.error(`Failed to check low stock alerts: ${error.message}`);
      return [];
    }
  }

  async updateMinimumStockLevel(
    productId: string,
    location: string,
    minimumLevel: number
  ): Promise<ProductInventory> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to update minimum stock level
      inventoryAggregate.updateMinimumStockLevel(location, minimumLevel);

      const updatedInventory = inventoryAggregate.toSnapshot();

      this.logger.log(
        `Minimum stock level updated for ${productId} at ${location}: ${minimumLevel}`
      );
      return updatedInventory;
    } catch (error) {
      this.logger.error(
        `Failed to update minimum stock level: ${error.message}`
      );
      throw error;
    }
  }

  // ✅ FOCUS: Query operations
  async getProductInventory(
    productId: string
  ): Promise<ProductInventory | null> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      return inventoryAggregate.toSnapshot();
    } catch (error) {
      this.logger.warn(`Product inventory not found: ${productId}`);
      return null;
    }
  }

  async getStockAtLocation(
    productId: string,
    location: string
  ): Promise<number> {
    try {
      const inventory = await this.getProductInventory(productId);
      const locationStock = inventory?.stockLocations.find(
        l => l.location === location
      );
      return locationStock?.availableStock || 0;
    } catch (error) {
      this.logger.error(`Failed to get stock at location: ${error.message}`);
      return 0;
    }
  }

  async getAvailableStock(productId: string): Promise<number> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to calculate available stock
      return inventoryAggregate.getAvailableStock();
    } catch (error) {
      this.logger.error(`Failed to get available stock: ${error.message}`);
      return 0;
    }
  }

  async getStockMovementHistory(productId: string): Promise<StockMovement[]> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to get movement history
      return inventoryAggregate.getStockMovementHistory();
    } catch (error) {
      this.logger.error(
        `Failed to get stock movement history: ${error.message}`
      );
      return [];
    }
  }

  async getActiveReservations(productId: string): Promise<StockReservation[]> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      // Use library method to get active reservations
      return inventoryAggregate.getActiveReservations();
    } catch (error) {
      this.logger.error(`Failed to get active reservations: ${error.message}`);
      return [];
    }
  }

  // ✅ FOCUS: Domain events access
  async getInventoryDomainEvents(productId: string): Promise<any[]> {
    try {
      const ProductInventoryAggregateClass = VytchesDDD.resolve<any>(
        'ProductInventoryAggregate'
      );
      const inventoryAggregate = await this.loadInventoryAggregate(
        productId,
        ProductInventoryAggregateClass
      );

      return inventoryAggregate.getUncommittedEvents();
    } catch (error) {
      this.logger.error(`Failed to get domain events: ${error.message}`);
      return [];
    }
  }

  // ✅ FOCUS: Batch operations for performance
  async performBulkStockAdjustment(
    adjustments: InventoryAdjustment[]
  ): Promise<ProductInventory[]> {
    const results: ProductInventory[] = [];

    for (const adjustment of adjustments) {
      try {
        const result = await this.adjustStock(
          adjustment.productId,
          adjustment.location,
          adjustment.quantity,
          adjustment.reason
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed bulk adjustment for ${adjustment.productId}: ${error.message}`
        );
        // Continue with remaining adjustments
      }
    }

    this.logger.log(
      `Bulk stock adjustment completed: ${results.length}/${adjustments.length} successful`
    );
    return results;
  }

  // Helper method for aggregate loading
  private async loadInventoryAggregate(
    productId: string,
    ProductInventoryAggregateClass: any
  ): Promise<any> {
    // Mock implementation - in reality would load from event store or repository
    return ProductInventoryAggregateClass.fromSnapshot({
      id: productId,
      sku: `SKU-${productId}`,
      name: `Product ${productId}`,
      totalStock: 100,
      reservedStock: 10,
      minimumStockLevel: 20,
      stockLocations: [
        {
          location: 'warehouse-1',
          totalStock: 60,
          availableStock: 50,
          minimumStock: 10,
        },
        {
          location: 'warehouse-2',
          totalStock: 40,
          availableStock: 40,
          minimumStock: 10,
        },
      ],
      activeReservations: [],
      movementHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// product-inventory.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { ProductInventoryService } from './product-inventory.service';

@Module({
  providers: [ProductInventoryService],
  exports: [ProductInventoryService],
})
export class ProductInventoryModule implements OnModuleInit {
  async onModuleInit() {
    // Initialize VytchesDDD container
    const container = new SimpleContainer();
    await VytchesDDD.configure(container);
  }
}
```

**Key Points:**

- Comprehensive inventory management through library aggregate
- Stock reservation system with expiration handling
- Multi-location inventory tracking capabilities
- Low stock alerting and monitoring features
- Complete audit trail through stock movement history

**Integration Benefits:**

1. **Stock Accuracy**: Real-time stock tracking across multiple locations
2. **Reservation Management**: Proper stock reservation lifecycle
3. **Business Rules**: Inventory business logic encapsulated in aggregate
4. **Audit Trail**: Complete history of all stock movements
5. **Alert System**: Proactive low stock monitoring

**Usage Example:**

```typescript
// inventory.controller.ts
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: ProductInventoryService) {}

  @Post()
  async createProduct(@Body() productData: CreateProductData) {
    return await this.inventoryService.createProduct(productData);
  }

  @Put(':id/stock')
  async adjustStock(
    @Param('id') id: string,
    @Body() adjustment: { location: string; quantity: number; reason: string }
  ) {
    return await this.inventoryService.adjustStock(
      id,
      adjustment.location,
      adjustment.quantity,
      adjustment.reason
    );
  }

  @Post(':id/reserve')
  async reserveStock(
    @Param('id') id: string,
    @Body()
    reservation: { quantity: number; reservationId: string; expiresAt?: Date }
  ) {
    return await this.inventoryService.reserveStock(
      id,
      reservation.quantity,
      reservation.reservationId,
      reservation.expiresAt
    );
  }

  @Get(':id/alerts')
  async checkLowStock(@Param('id') id: string) {
    return await this.inventoryService.checkLowStockAlerts(id);
  }
}
```
