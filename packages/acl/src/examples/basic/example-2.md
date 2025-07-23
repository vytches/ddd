# Inventory Data Translation with ACL

**Version**: 1.0.0  
**Package**: @vytches-ddd/acl  
**Complexity**: Basic  
**Domain**: Product Management  
**Patterns**: Data Translation, Schema Mapping  
**Dependencies**: @vytches-ddd/acl, @vytches-ddd/core

## Description

This example shows how to use the Anti-Corruption Layer for translating
inventory data from a legacy system with different schema and field naming
conventions.

## Business Context

A retail company needs to integrate with multiple inventory management systems
that have different data formats. The ACL ensures consistent product data
representation regardless of the source system.

## Code Example

```typescript
// inventory-data.translator.ts
import { IDataTranslator } from '@vytches-ddd/acl';
import { Result } from '@vytches-ddd/utils';
import { Product, LegacyInventoryData } from '../types'; // From your application

export class InventoryDataTranslator
  implements IDataTranslator<LegacyInventoryData, Product>
{
  translate(legacyData: LegacyInventoryData): Result<Product, Error> {
    try {
      // Validate required fields
      if (!legacyData.sku || !legacyData.product_name) {
        return Result.failure(
          new Error('Missing required fields: sku or product_name')
        );
      }

      const product: Product = {
        id: legacyData.sku,
        name: legacyData.product_name,
        description: legacyData.description || '',
        price: legacyData.unit_price,
        currency: legacyData.currency_code,
        category: this.mapCategoryId(legacyData.category_id),
        availability: {
          inStock: legacyData.stock_info.available,
          quantity: legacyData.stock_info.count,
          warehouse: legacyData.stock_info.location,
          estimatedDelivery: this.parseDeliveryDate(
            legacyData.stock_info.delivery_estimate
          ),
        },
      };

      return Result.success(product);
    } catch (error) {
      return Result.failure(
        new Error(`Inventory translation failed: ${error.message}`)
      );
    }
  }

  private mapCategoryId(categoryId: string): string {
    // Map legacy category IDs to meaningful names
    const categoryMap: Record<string, string> = {
      CAT001: 'Electronics',
      CAT002: 'Clothing',
      CAT003: 'Books',
      CAT004: 'Home & Garden',
      CAT005: 'Sports & Outdoors',
    };

    return categoryMap[categoryId] || 'Uncategorized';
  }

  private parseDeliveryDate(dateString: string | null): Date | undefined {
    if (!dateString) return undefined;

    try {
      // Handle different date formats from legacy system
      if (dateString.includes('/')) {
        // MM/DD/YYYY format
        return new Date(dateString);
      } else if (dateString.includes('-')) {
        // YYYY-MM-DD format
        return new Date(dateString);
      } else {
        // Days from now (e.g., "7" means 7 days)
        const days = parseInt(dateString, 10);
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
      }
    } catch {
      return undefined;
    }
  }
}

// inventory.acl.ts
import { AntiCorruptionLayer } from '@vytches-ddd/acl';
import { Product, LegacyInventoryData, ProductSyncRequest } from '../types'; // From your application

export class InventoryACL extends AntiCorruptionLayer<
  LegacyInventoryData,
  Product
> {
  constructor(private legacyInventoryAPI: LegacyInventoryAPI) {
    super(new InventoryDataTranslator());
  }

  async getProduct(productId: string): Promise<Result<Product, Error>> {
    try {
      const legacyData = await this.legacyInventoryAPI.getProduct(productId);
      return this.translateData(legacyData);
    } catch (error) {
      return Result.failure(
        new Error(`Failed to get product: ${error.message}`)
      );
    }
  }

  async getProductsByCategory(
    category: string
  ): Promise<Result<Product[], Error>> {
    try {
      // Convert domain category to legacy category ID
      const legacyCategoryId = this.convertCategoryToLegacyId(category);
      const legacyProducts =
        await this.legacyInventoryAPI.getProductsByCategory(legacyCategoryId);

      // Translate all products
      const translatedProducts: Product[] = [];
      const errors: string[] = [];

      for (const legacyProduct of legacyProducts) {
        const result = this.translateData(legacyProduct);
        if (result.isSuccess()) {
          translatedProducts.push(result.value);
        } else {
          errors.push(`Product ${legacyProduct.sku}: ${result.error.message}`);
        }
      }

      if (errors.length > 0 && translatedProducts.length === 0) {
        return Result.failure(
          new Error(`All products failed translation: ${errors.join(', ')}`)
        );
      }

      return Result.success(translatedProducts);
    } catch (error) {
      return Result.failure(
        new Error(`Failed to get products by category: ${error.message}`)
      );
    }
  }

  async syncProducts(
    request: ProductSyncRequest
  ): Promise<Result<Product[], Error>> {
    try {
      const legacyRequest = this.convertSyncRequest(request);
      const legacyProducts =
        await this.legacyInventoryAPI.getUpdatedProducts(legacyRequest);

      const products: Product[] = [];
      for (const legacyProduct of legacyProducts) {
        const result = this.translateData(legacyProduct);
        if (result.isSuccess()) {
          products.push(result.value);
        }
      }

      return Result.success(products);
    } catch (error) {
      return Result.failure(new Error(`Product sync failed: ${error.message}`));
    }
  }

  private convertCategoryToLegacyId(category: string): string {
    const categoryMap: Record<string, string> = {
      Electronics: 'CAT001',
      Clothing: 'CAT002',
      Books: 'CAT003',
      'Home & Garden': 'CAT004',
      'Sports & Outdoors': 'CAT005',
    };

    return categoryMap[category] || 'CAT999'; // Default category
  }

  private convertSyncRequest(request: ProductSyncRequest): LegacySyncRequest {
    return {
      category_id: request.category
        ? this.convertCategoryToLegacyId(request.category)
        : undefined,
      modified_since: request.modifiedSince?.toISOString(),
      warehouse_code: request.warehouseId,
    };
  }
}

// Usage in domain service
export class ProductCatalogService {
  constructor(private inventoryACL: InventoryACL) {}

  async getProductDetails(productId: string): Promise<Result<Product, Error>> {
    return await this.inventoryACL.getProduct(productId);
  }

  async searchProductsByCategory(
    category: string
  ): Promise<Result<Product[], Error>> {
    return await this.inventoryACL.getProductsByCategory(category);
  }

  async refreshCatalog(category?: string): Promise<Result<Product[], Error>> {
    const syncRequest: ProductSyncRequest = {
      category,
      modifiedSince: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    };

    return await this.inventoryACL.syncProducts(syncRequest);
  }
}

// External API interfaces
interface LegacyInventoryAPI {
  getProduct(sku: string): Promise<LegacyInventoryData>;
  getProductsByCategory(categoryId: string): Promise<LegacyInventoryData[]>;
  getUpdatedProducts(
    request: LegacySyncRequest
  ): Promise<LegacyInventoryData[]>;
}

interface LegacySyncRequest {
  category_id?: string;
  modified_since?: string;
  warehouse_code?: string;
}
```

## Key Features

- **Schema Transformation**: Converts legacy field names to domain model
- **Data Validation**: Ensures data integrity during translation
- **Category Mapping**: Translates legacy category IDs to meaningful names
- **Date Parsing**: Handles multiple date formats from legacy systems

## Common Pitfalls

- **Hardcoded Mappings**: Consider storing mapping configurations externally
- **Missing Validation**: Always validate external data before translation
- **Performance**: Cache category mappings to avoid repeated lookups

## Related Examples

- [Multi-System Integration](/packages/acl/src/examples/intermediate/example-2.md)
- [Data Enrichment ACL](/packages/acl/src/examples/advanced/example-2.md)
