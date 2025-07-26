# Auto-Discovery System - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches/ddd-di  
**Complexity**: intermediate  
**Domain**: E-commerce Platform  
**Patterns**: Auto-Discovery, Enhanced Decorators, Plugin System  
**Dependencies**: @vytches/ddd-di

## Description

This example demonstrates VytchesDDD's auto-discovery system that automatically
finds and registers services using enhanced decorators. The system scans for
decorated classes and registers them with the appropriate configuration,
reducing boilerplate code and improving maintainability.

## Business Context

In large enterprise applications, manually registering dozens of services
becomes cumbersome and error-prone. Auto-discovery automatically finds services
based on decorators, ensuring all services are registered consistently and
reducing the risk of missing registrations during deployments.

## Code Example

```typescript
// product.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { User, Product } from '../types'; // Import from application

/**
 * Product service with enhanced auto-discovery configuration
 */
@DomainService({
  serviceId: 'productService',
  lifetime: ServiceLifetime.Singleton,
  context: 'ProductCatalog',
  dependencies: ['auditService', 'cacheService'],
  autoRegister: true,
  timeout: 30000,
  tags: ['catalog', 'products', 'core'],
})
export class ProductService {
  private products: Map<string, Product> = new Map();

  /**
   * Gets product by ID
   */
  async getProductById(id: string): Promise<Product | null> {
    // ⭐ FOCUS: Auto-discovered service implementation
    console.log(`ProductService: Getting product ${id}`);
    return this.products.get(id) || null;
  }

  /**
   * Creates a new product
   */
  async createProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> {
    const product: Product = {
      ...productData,
      id: this.generateProductId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.products.set(product.id, product);

    console.log(`ProductService: Created product ${product.id}`);
    return product;
  }

  private generateProductId(): string {
    return `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// inventory.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';

/**
 * Inventory service with auto-discovery
 */
@DomainService({
  serviceId: 'inventoryService',
  lifetime: ServiceLifetime.Transient,
  context: 'InventoryManagement',
  autoRegister: true,
  middleware: ['loggingMiddleware', 'validationMiddleware'],
  retryPolicy: {
    maxAttempts: 3,
    baseDelay: 1000,
  },
})
export class InventoryService {
  private inventory: Map<string, number> = new Map();

  /**
   * Checks product availability
   */
  async checkAvailability(productId: string): Promise<number> {
    // ⭐ FOCUS: Auto-discovered service with middleware
    console.log(`InventoryService: Checking availability for ${productId}`);
    return this.inventory.get(productId) || 0;
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
        `InventoryService: Reserved ${quantity} units of ${productId}`
      );
      return true;
    }

    console.log(`InventoryService: Insufficient inventory for ${productId}`);
    return false;
  }
}
```

```typescript
// audit.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * Audit service with auto-discovery
 */
@DomainService({
  serviceId: 'auditService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Compliance',
  autoRegister: true,
  priority: 10, // High priority for early registration
  healthCheck: true,
})
export class AuditService {
  private auditLog: AuditLogEntry[] = [];

  /**
   * Logs an audit entry
   */
  async logAction(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    // ⭐ FOCUS: Auto-discovered audit service
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
    };

    this.auditLog.push(auditEntry);

    console.log(
      `AuditService: Logged action ${entry.action} for ${entry.resource}`
    );
  }

  /**
   * Gets audit log for a resource
   */
  async getAuditLog(resourceId: string): Promise<AuditLogEntry[]> {
    return this.auditLog.filter(entry => entry.resourceId === resourceId);
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// cache.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { CacheConfig } from '../types'; // Import from application

/**
 * Cache service with conditional auto-discovery
 */
@DomainService({
  serviceId: 'cacheService',
  lifetime: ServiceLifetime.Singleton,
  context: 'Infrastructure',
  autoRegister: true,
  condition: () => process.env.NODE_ENV === 'production', // Conditional registration
  factory: container => {
    const config: CacheConfig = {
      provider: 'memory',
      ttl: 300000, // 5 minutes
      maxSize: 1000,
    };
    return new CacheService(config);
  },
})
export class CacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  constructor(private config: CacheConfig) {}

  /**
   * Gets cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // ⭐ FOCUS: Auto-discovered cache service
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    console.log(`CacheService: Cache hit for ${key}`);
    return cached.value;
  }

  /**
   * Sets cached value
   */
  async set(key: string, value: any): Promise<void> {
    const expiry = Date.now() + this.config.ttl;
    this.cache.set(key, { value, expiry });

    console.log(`CacheService: Cached value for ${key}`);
  }
}
```

```typescript
// discovery-configuration.ts
import { VytchesDDD, SimpleContainer, DiscoveryOptions } from '@vytches/ddd-di';

/**
 * Auto-discovery configuration
 */
export class DiscoveryConfiguration {
  /**
   * Configures auto-discovery with custom options
   */
  static async configure(): Promise<void> {
    const container = new SimpleContainer();

    // ⭐ FOCUS: Enhanced auto-discovery configuration
    const discoveryOptions: DiscoveryOptions = {
      // Scan specific directories
      scanPaths: ['./src/services', './src/handlers', './src/repositories'],

      // Include/exclude patterns
      include: ['**/*.service.ts', '**/*.handler.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],

      // Discovery settings
      enableAutoRegistration: true,
      enableDependencyValidation: true,
      enableCircularDependencyDetection: true,

      // Lifecycle hooks
      onServiceDiscovered: (serviceId, metadata) => {
        console.log(`Discovered service: ${serviceId}`, metadata);
      },

      onServiceRegistered: (serviceId, registration) => {
        console.log(`Registered service: ${serviceId}`, registration);
      },

      onDiscoveryComplete: discoveredServices => {
        console.log(
          `Auto-discovery complete. Found ${discoveredServices.length} services`
        );
      },
    };

    // Configure with discovery options
    await VytchesDDD.configure(container, discoveryOptions);
  }
}
```

```typescript
// app.ts
import { VytchesDDD } from '@vytches/ddd-di';
import { DiscoveryConfiguration } from './discovery-configuration';
import { ProductService } from './product.service';
import { InventoryService } from './inventory.service';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';

/**
 * Application demonstrating auto-discovery
 */
async function demonstrateAutoDiscovery(): Promise<void> {
  console.log('=== Auto-Discovery System Demo ===\n');

  // ⭐ FOCUS: Configure auto-discovery
  await DiscoveryConfiguration.configure();

  console.log('\n1. Auto-discovered services:');
  const discoveredServices = VytchesDDD.getRegisteredServices();
  discoveredServices.forEach(serviceId => {
    console.log(`  - ${serviceId}`);
  });

  console.log('\n2. Using auto-discovered services:');

  // ⭐ FOCUS: Resolve auto-discovered services
  const productService = VytchesDDD.resolve<ProductService>('productService');
  const inventoryService =
    VytchesDDD.resolve<InventoryService>('inventoryService');
  const auditService = VytchesDDD.resolve<AuditService>('auditService');
  const cacheService = VytchesDDD.resolve<CacheService>('cacheService');

  // Create and use services
  const product = await productService.createProduct({
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99,
    category: 'Electronics',
    sku: 'LAP-001',
  });

  await inventoryService.reserveInventory(product.id, 5);

  await auditService.logAction({
    userId: 'user123',
    action: 'CREATE_PRODUCT',
    resource: 'Product',
    resourceId: product.id,
  });

  await cacheService.set('recent-product', product);

  console.log('\n3. Service dependencies and metadata:');
  const productServiceMetadata =
    VytchesDDD.getServiceMetadata('productService');
  console.log('ProductService metadata:', productServiceMetadata);
}

// Run the demonstration
demonstrateAutoDiscovery().catch(console.error);
```

## Key Features

- **Automatic Registration**: Services are automatically found and registered
- **Enhanced Decorators**: Rich configuration options in `@DomainService`
- **Dependency Validation**: Validates service dependencies during discovery
- **Circular Dependency Detection**: Prevents circular dependency issues
- **Conditional Registration**: Register services based on runtime conditions
- **Custom Factories**: Support for custom service creation logic
- **Lifecycle Hooks**: Hooks for discovery and registration events

## Common Pitfalls

- **Missing Auto-Register**: Set `autoRegister: true` for automatic discovery
- **Circular Dependencies**: Avoid services that depend on each other during
  construction
- **Scan Path Configuration**: Ensure scan paths include all service locations
- **Context Isolation**: Be careful with context-specific services
- **Factory Dependencies**: Custom factories should handle their own
  dependencies

## Related Examples

- [Basic Service Registration](../basic/example-1.md) - Simple service
  registration
- [Context Isolation](./example-2.md) - Bounded context support
- [CQRS Handler Registration](./example-3.md) - Automatic handler registration
