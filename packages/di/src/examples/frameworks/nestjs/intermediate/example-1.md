# NestJS Bridge Pattern Implementation - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: intermediate  
**Domain**: E-commerce Platform  
**Patterns**: Bridge Pattern, Double Instance Prevention, Advanced Integration  
**Dependencies**: @vytches-ddd/di, @nestjs/common

## Description

This example demonstrates the Bridge Pattern implementation to avoid double
instance risks when integrating VytchesDDD with NestJS. It shows how to properly
bridge between NestJS DI and VytchesDDD DI while maintaining clean architecture
boundaries.

## Business Context

When integrating VytchesDDD with NestJS, there's a risk of creating multiple
instances of the same service - one in NestJS DI and one in VytchesDDD DI. The
Bridge Pattern ensures that NestJS services act as thin wrappers around
VytchesDDD services, preventing double instantiation and maintaining
consistency.

## Code Example

```typescript
// domain/product-domain.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Product, CreateProductData, UpdateProductData } from '../types'; // Import from application

/**
 * Product domain service with business logic
 */
@DomainService({
  serviceId: 'productDomainService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
})
export class ProductDomainService {
  private products: Map<string, Product> = new Map();

  /**
   * Creates a product with business validation
   */
  async createProduct(productData: CreateProductData): Promise<Product> {
    // ⭐ FOCUS: Domain business logic
    console.log(`ProductDomainService: Creating product ${productData.name}`);

    // Business validation
    await this.validateProductData(productData);

    const product: Product = {
      id: this.generateProductId(),
      name: productData.name,
      description: productData.description,
      price: productData.price,
      category: productData.category,
      sku: productData.sku,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.products.set(product.id, product);

    // Business events
    await this.publishProductCreatedEvent(product);

    console.log(`ProductDomainService: Created product ${product.id}`);
    return product;
  }

  /**
   * Updates product with business rules
   */
  async updateProduct(
    productId: string,
    updateData: UpdateProductData
  ): Promise<Product> {
    const existingProduct = this.products.get(productId);
    if (!existingProduct) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Business validation
    await this.validateUpdateData(updateData);

    const updatedProduct = {
      ...existingProduct,
      ...updateData,
      updatedAt: new Date(),
    };

    this.products.set(productId, updatedProduct);

    await this.publishProductUpdatedEvent(updatedProduct);

    console.log(`ProductDomainService: Updated product ${productId}`);
    return updatedProduct;
  }

  /**
   * Gets product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    return this.products.get(productId) || null;
  }

  /**
   * Gets products by category
   */
  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      p => p.category === category
    );
  }

  private async validateProductData(
    productData: CreateProductData
  ): Promise<void> {
    if (!productData.name || productData.name.length < 2) {
      throw new Error('Product name must be at least 2 characters');
    }

    if (productData.price <= 0) {
      throw new Error('Product price must be positive');
    }

    // Check for duplicate SKU
    const existingProduct = Array.from(this.products.values()).find(
      p => p.sku === productData.sku
    );
    if (existingProduct) {
      throw new Error(`SKU already exists: ${productData.sku}`);
    }
  }

  private async validateUpdateData(
    updateData: UpdateProductData
  ): Promise<void> {
    if (updateData.price !== undefined && updateData.price <= 0) {
      throw new Error('Product price must be positive');
    }
  }

  private generateProductId(): string {
    return `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async publishProductCreatedEvent(product: Product): Promise<void> {
    console.log(`Publishing ProductCreated event for ${product.id}`);
  }

  private async publishProductUpdatedEvent(product: Product): Promise<void> {
    console.log(`Publishing ProductUpdated event for ${product.id}`);
  }
}
```

```typescript
// domain/inventory-domain.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';

/**
 * Inventory domain service
 */
@DomainService({
  serviceId: 'inventoryDomainService',
  lifetime: ServiceLifetime.Singleton,
  autoRegister: true,
})
export class InventoryDomainService {
  private inventory: Map<string, number> = new Map();

  /**
   * Checks product availability
   */
  async checkAvailability(productId: string): Promise<number> {
    // ⭐ FOCUS: Inventory business logic
    console.log(
      `InventoryDomainService: Checking availability for ${productId}`
    );
    return this.inventory.get(productId) || 0;
  }

  /**
   * Updates inventory quantity
   */
  async updateInventory(productId: string, quantity: number): Promise<void> {
    if (quantity < 0) {
      throw new Error('Inventory quantity cannot be negative');
    }

    this.inventory.set(productId, quantity);

    console.log(
      `InventoryDomainService: Updated inventory for ${productId} to ${quantity}`
    );
  }

  /**
   * Reserves inventory
   */
  async reserveInventory(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    const available = await this.checkAvailability(productId);

    if (available >= quantity) {
      this.inventory.set(productId, available - quantity);
      console.log(
        `InventoryDomainService: Reserved ${quantity} units of ${productId}`
      );
      return true;
    }

    console.log(
      `InventoryDomainService: Insufficient inventory for ${productId}`
    );
    return false;
  }
}
```

```typescript
// bridge/vytches-ddd-bridge.ts
import { VytchesDDD } from '@vytches-ddd/di';

/**
 * Bridge utility for VytchesDDD integration
 */
export class VytchesDDDBridge {
  /**
   * Creates NestJS provider that bridges to VytchesDDD service
   */
  static createProvider<T>(serviceId: string) {
    return {
      provide: serviceId,
      useFactory: (): T => {
        // ⭐ FOCUS: Bridge pattern - get existing instance from VytchesDDD
        const instance = VytchesDDD.resolve<T>(serviceId);
        if (!instance) {
          throw new Error(
            `Service ${serviceId} not found in VytchesDDD container`
          );
        }
        return instance;
      },
    };
  }

  /**
   * Creates multiple providers for batch registration
   */
  static createProviders(serviceIds: string[]) {
    return serviceIds.map(serviceId => this.createProvider(serviceId));
  }

  /**
   * Gets bridge service directly
   */
  static getBridgeService<T>(serviceId: string): T {
    const instance = VytchesDDD.resolve<T>(serviceId);
    if (!instance) {
      throw new Error(`Service ${serviceId} not found in VytchesDDD container`);
    }
    return instance;
  }
}
```

```typescript
// nestjs/product.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ProductDomainService } from '../domain/product-domain.service';
import { InventoryDomainService } from '../domain/inventory-domain.service';
import { Product, CreateProductData, UpdateProductData } from '../types'; // Import from application

/**
 * NestJS product service using bridge pattern
 */
@Injectable()
export class ProductService {
  constructor(
    @Inject('productDomainService')
    private readonly productDomainService: ProductDomainService,
    @Inject('inventoryDomainService')
    private readonly inventoryDomainService: InventoryDomainService
  ) {
    // ⭐ FOCUS: Bridge pattern - services injected from VytchesDDD
  }

  /**
   * Creates product with inventory initialization
   */
  async createProduct(productData: CreateProductData): Promise<Product> {
    try {
      // ⭐ FOCUS: Orchestrates multiple domain services
      const product =
        await this.productDomainService.createProduct(productData);

      // Initialize inventory
      await this.inventoryDomainService.updateInventory(product.id, 0);

      return product;
    } catch (error) {
      console.error('ProductService: Failed to create product:', error);
      throw error;
    }
  }

  /**
   * Updates product
   */
  async updateProduct(
    productId: string,
    updateData: UpdateProductData
  ): Promise<Product> {
    try {
      return await this.productDomainService.updateProduct(
        productId,
        updateData
      );
    } catch (error) {
      console.error('ProductService: Failed to update product:', error);
      throw error;
    }
  }

  /**
   * Gets product with inventory information
   */
  async getProductWithInventory(
    productId: string
  ): Promise<{ product: Product; inventory: number } | null> {
    try {
      const product = await this.productDomainService.getProductById(productId);
      if (!product) {
        return null;
      }

      const inventory =
        await this.inventoryDomainService.checkAvailability(productId);

      return { product, inventory };
    } catch (error) {
      console.error(
        'ProductService: Failed to get product with inventory:',
        error
      );
      throw error;
    }
  }

  /**
   * Gets products by category
   */
  async getProductsByCategory(category: string): Promise<Product[]> {
    try {
      return await this.productDomainService.getProductsByCategory(category);
    } catch (error) {
      console.error(
        'ProductService: Failed to get products by category:',
        error
      );
      throw error;
    }
  }
}
```

```typescript
// nestjs/inventory.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { InventoryDomainService } from '../domain/inventory-domain.service';

/**
 * NestJS inventory service using bridge pattern
 */
@Injectable()
export class InventoryService {
  constructor(
    @Inject('inventoryDomainService')
    private readonly inventoryDomainService: InventoryDomainService
  ) {
    // ⭐ FOCUS: Bridge pattern - service injected from VytchesDDD
  }

  /**
   * Checks product availability
   */
  async checkAvailability(productId: string): Promise<number> {
    try {
      return await this.inventoryDomainService.checkAvailability(productId);
    } catch (error) {
      console.error('InventoryService: Failed to check availability:', error);
      throw error;
    }
  }

  /**
   * Updates inventory
   */
  async updateInventory(productId: string, quantity: number): Promise<void> {
    try {
      await this.inventoryDomainService.updateInventory(productId, quantity);
    } catch (error) {
      console.error('InventoryService: Failed to update inventory:', error);
      throw error;
    }
  }

  /**
   * Reserves inventory
   */
  async reserveInventory(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    try {
      return await this.inventoryDomainService.reserveInventory(
        productId,
        quantity
      );
    } catch (error) {
      console.error('InventoryService: Failed to reserve inventory:', error);
      throw error;
    }
  }
}
```

```typescript
// nestjs/product.controller.ts
import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductData, UpdateProductData } from '../types'; // Import from application

/**
 * Product controller
 */
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Creates a new product
   */
  @Post()
  async createProduct(@Body() productData: CreateProductData) {
    return await this.productService.createProduct(productData);
  }

  /**
   * Updates a product
   */
  @Put(':id')
  async updateProduct(
    @Param('id') productId: string,
    @Body() updateData: UpdateProductData
  ) {
    return await this.productService.updateProduct(productId, updateData);
  }

  /**
   * Gets product with inventory
   */
  @Get(':id/with-inventory')
  async getProductWithInventory(@Param('id') productId: string) {
    return await this.productService.getProductWithInventory(productId);
  }

  /**
   * Gets products by category
   */
  @Get('category/:category')
  async getProductsByCategory(@Param('category') category: string) {
    return await this.productService.getProductsByCategory(category);
  }
}
```

```typescript
// nestjs/inventory.controller.ts
import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';

/**
 * Inventory controller
 */
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Checks product availability
   */
  @Get(':productId/availability')
  async checkAvailability(@Param('productId') productId: string) {
    const quantity = await this.inventoryService.checkAvailability(productId);
    return { productId, quantity };
  }

  /**
   * Updates inventory
   */
  @Put(':productId')
  async updateInventory(
    @Param('productId') productId: string,
    @Body() { quantity }: { quantity: number }
  ) {
    await this.inventoryService.updateInventory(productId, quantity);
    return { productId, quantity };
  }

  /**
   * Reserves inventory
   */
  @Put(':productId/reserve')
  async reserveInventory(
    @Param('productId') productId: string,
    @Body() { quantity }: { quantity: number }
  ) {
    const success = await this.inventoryService.reserveInventory(
      productId,
      quantity
    );
    return { productId, quantity, success };
  }
}
```

```typescript
// nestjs/product.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { VytchesDDDBridge } from '../bridge/vytches-ddd-bridge';
import { ProductController } from './product.controller';
import { InventoryController } from './inventory.controller';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';

/**
 * Product module with bridge pattern
 */
@Module({
  controllers: [ProductController, InventoryController],
  providers: [
    // ⭐ FOCUS: Bridge pattern providers
    VytchesDDDBridge.createProvider('productDomainService'),
    VytchesDDDBridge.createProvider('inventoryDomainService'),

    // NestJS services
    ProductService,
    InventoryService,
  ],
  exports: [ProductService, InventoryService],
})
export class ProductModule implements OnModuleInit {
  /**
   * Initialize VytchesDDD before NestJS DI
   */
  async onModuleInit() {
    // ⭐ FOCUS: Initialize VytchesDDD before using bridge
    console.log('ProductModule: Initializing VytchesDDD...');

    const container = new SimpleContainer();
    await VytchesDDD.configure(container);

    console.log(
      'ProductModule: VytchesDDD initialized, bridge providers ready'
    );
  }
}
```

```typescript
// nestjs/app.module.ts
import { Module } from '@nestjs/common';
import { ProductModule } from './product.module';

/**
 * Root application module
 */
@Module({
  imports: [ProductModule],
})
export class AppModule {}
```

```typescript
// test/bridge-pattern.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from '../nestjs/product.service';
import { InventoryService } from '../nestjs/inventory.service';
import { ProductModule } from '../nestjs/product.module';
import { VytchesDDD } from '@vytches-ddd/di';
import { ProductDomainService } from '../domain/product-domain.service';
import { InventoryDomainService } from '../domain/inventory-domain.service';
import { CreateProductData } from '../types'; // Import from application

describe('Bridge Pattern Integration', () => {
  let productService: ProductService;
  let inventoryService: InventoryService;
  let productDomainService: ProductDomainService;
  let inventoryDomainService: InventoryDomainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ProductModule],
    }).compile();

    productService = module.get<ProductService>(ProductService);
    inventoryService = module.get<InventoryService>(InventoryService);

    // ⭐ FOCUS: Access VytchesDDD services directly for testing
    productDomainService = VytchesDDD.resolve<ProductDomainService>(
      'productDomainService'
    );
    inventoryDomainService = VytchesDDD.resolve<InventoryDomainService>(
      'inventoryDomainService'
    );
  });

  it('should use the same domain service instances', async () => {
    // ⭐ FOCUS: Verify bridge pattern prevents double instances
    const injectedProductService = module.get('productDomainService');
    const injectedInventoryService = module.get('inventoryDomainService');

    expect(injectedProductService).toBe(productDomainService);
    expect(injectedInventoryService).toBe(inventoryDomainService);
  });

  it('should create product with inventory initialization', async () => {
    const productData: CreateProductData = {
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      category: 'Electronics',
      sku: 'TEST-001',
    };

    const product = await productService.createProduct(productData);

    expect(product).toBeDefined();
    expect(product.name).toBe(productData.name);

    // Verify inventory was initialized
    const inventory = await inventoryService.checkAvailability(product.id);
    expect(inventory).toBe(0);
  });

  it('should orchestrate multiple domain services', async () => {
    const productData: CreateProductData = {
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      category: 'Electronics',
      sku: 'TEST-002',
    };

    const product = await productService.createProduct(productData);

    // Update inventory
    await inventoryService.updateInventory(product.id, 100);

    // Get product with inventory
    const productWithInventory = await productService.getProductWithInventory(
      product.id
    );

    expect(productWithInventory).toBeDefined();
    expect(productWithInventory?.product.id).toBe(product.id);
    expect(productWithInventory?.inventory).toBe(100);
  });

  it('should reserve inventory correctly', async () => {
    const productData: CreateProductData = {
      name: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      category: 'Electronics',
      sku: 'TEST-003',
    };

    const product = await productService.createProduct(productData);

    // Add inventory
    await inventoryService.updateInventory(product.id, 50);

    // Reserve inventory
    const success = await inventoryService.reserveInventory(product.id, 10);
    expect(success).toBe(true);

    // Check remaining inventory
    const remaining = await inventoryService.checkAvailability(product.id);
    expect(remaining).toBe(40);
  });
});
```

## Key Features

- **Bridge Pattern**: Prevents double instance risks between NestJS and
  VytchesDDD
- **Provider Factory**: Creates NestJS providers that bridge to VytchesDDD
  services
- **Dependency Injection**: Uses standard NestJS DI with VytchesDDD bridge
- **Service Orchestration**: NestJS services orchestrate multiple domain
  services
- **Testing Integration**: Easy testing with both NestJS and VytchesDDD services
- **Error Handling**: Proper error handling in bridge layer

## Common Pitfalls

- **Double Instantiation**: Never create services in both NestJS and VytchesDDD
- **Initialization Order**: Always initialize VytchesDDD before creating bridge
  providers
- **Service Resolution**: Ensure VytchesDDD services are registered before
  bridging
- **Provider Configuration**: Use provider factories, not direct service
  instantiation
- **Testing Confusion**: Remember that bridged services are the same instances

## Related Examples

- [NestJS Basic Integration](../basic/example-1.md) - Simple NestJS integration
- [Custom Provider Factory](./example-2.md) - Advanced provider patterns
- [Framework Integration Patterns](../../advanced/example-1.md) -
  Multi-framework integration
