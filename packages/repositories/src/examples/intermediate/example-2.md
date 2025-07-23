# Specification Pattern - Advanced Query Composition

**Version**: 1.0.0 **Package**: @vytches-ddd/repositories **Complexity**:
intermediate **Domain**: product-catalog **Patterns**: specification-pattern,
query-composition, domain-criteria **Dependencies**: @vytches-ddd/repositories,
@vytches-ddd/validation

## Description

Advanced querying using the Specification pattern to create composable, reusable
business criteria. Demonstrates complex query building, specification chaining,
and domain-driven query logic with the @vytches-ddd/repositories specification
system.

## Business Context

Product catalog system requiring sophisticated filtering capabilities for
inventory management, customer searches, and administrative reporting.
Specifications encapsulate business rules for product selection and enable
complex query composition.

## Code Example

```typescript
// product-specifications.ts
import { BaseSpecification, CompositeSpecification } from '@vytches-ddd/repositories';
import { Product, QueryOptions } from './types'; // From your application

// ✅ FOCUS: Domain-specific specifications using library base classes
export class ActiveProductsSpecification extends BaseSpecification<Product> {
  isSatisfiedBy(product: Product): boolean {
    return product.isActive;
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [{ field: 'isActive', operator: 'eq', value: true }]
    };
  }
}

export class ProductsInCategorySpecification extends BaseSpecification<Product> {
  constructor(private category: string) {
    super();
  }

  isSatisfiedBy(product: Product): boolean {
    return product.category === this.category;
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [{ field: 'category', operator: 'eq', value: this.category }]
    };
  }
}

export class ProductsPriceBetweenSpecification extends BaseSpecification<Product> {
  constructor(private minPrice: number, private maxPrice: number) {
    super();
  }

  isSatisfiedBy(product: Product): boolean {
    return product.price >= this.minPrice && product.price <= this.maxPrice;
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [
        { field: 'price', operator: 'gte', value: this.minPrice },
        { field: 'price', operator: 'lte', value: this.maxPrice, logical: 'AND' }
      ]
    };
  }
}

export class ProductsWithTagsSpecification extends BaseSpecification<Product> {
  constructor(private tags: string[]) {
    super();
  }

  isSatisfiedBy(product: Product): boolean {
    return this.tags.some(tag => product.tags.includes(tag));
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [{ field: 'tags', operator: 'in', value: this.tags }]
    };
  }
}

export class ProductsInStockSpecification extends BaseSpecification<Product> {
  constructor(private minQuantity: number = 1) {
    super();
  }

  isSatisfiedBy(product: Product): boolean {
    return product.inventory.available >= this.minQuantity;
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [{ field: 'inventory.available', operator: 'gte', value: this.minQuantity }]
    };
  }
}

export class ProductsLowStockSpecification extends BaseSpecification<Product> {
  isSatisfiedBy(product: Product): boolean {
    return product.inventory.quantity <= product.inventory.minStock;
  }

  toQueryOptions(): QueryOptions {
    return {
      where: [
        { field: 'inventory.quantity', operator: 'lte', value: 'inventory.minStock' }
      ]
    };
  }
}

// ✅ FOCUS: Repository with specification support
export class ProductSpecificationRepository extends BaseRepository<Product> {
  constructor() {
    super('products');
  }

  // ✅ FOCUS: Find using single specification
  async findBySpecification(specification: BaseSpecification<Product>): Promise<Product[]> {
    const queryOptions = specification.toQueryOptions();
    return await this.find(queryOptions);
  }

  // ✅ FOCUS: Find using composite specifications
  async findByCompositeSpecification(
    specification: CompositeSpecification<Product>
  ): Promise<Product[]> {
    const queryOptions = specification.toQueryOptions();
    return await this.find(queryOptions);
  }

  // ✅ FOCUS: Count using specification
  async countBySpecification(specification: BaseSpecification<Product>): Promise<number> {
    const queryOptions = specification.toQueryOptions();
    return await this.count(queryOptions);
  }

  // ✅ FOCUS: Complex business queries using specification composition
  async findAvailableProductsInCategory(category: string, minPrice?: number, maxPrice?: number): Promise<Product[]> {
    let specification = new ActiveProductsSpecification()
      .and(new ProductsInCategorySpecification(category))
      .and(new ProductsInStockSpecification());

    if (minPrice !== undefined && maxPrice !== undefined) {
      specification = specification.and(
        new ProductsPriceBetweenSpecification(minPrice, maxPrice)
      );
    }

    return await this.findBySpecification(specification);
  }

  async findProductsForPromotion(
    categories: string[],
    excludeTags: string[],
    maxPrice: number
  ): Promise<Product[]> {
    // Products in specific categories, below max price, not having excluded tags, and in stock
    const categorySpecs = categories.map(cat => new ProductsInCategorySpecification(cat));
    const categoriesSpec = categorySpecs.reduce((acc, spec) => acc.or(spec));

    const specification = new ActiveProductsSpecification()
      .and(categoriesSpec)
      .and(new ProductsPriceBetweenSpecification(0, maxPrice))
      .and(new ProductsInStockSpecification())
      .and(new ProductsWithTagsSpecification(excludeTags).not()); // NOT having excluded tags

    return await this.findBySpecification(specification);
  }

  async findLowStockProducts(): Promise<Product[]> {
    const specification = new ActiveProductsSpecification()
      .and(new ProductsLowStockSpecification());

    return await this.findBySpecification(specification);
  }

  // ✅ FOCUS: Dynamic specification building
  async searchProducts(searchCriteria: ProductSearchCriteria): Promise<Product[]> {
    let specification: BaseSpecification<Product> = new ActiveProductsSpecification();

    // Add category filter
    if (searchCriteria.category) {
      specification = specification.and(
        new ProductsInCategorySpecification(searchCriteria.category)
      );
    }

    // Add price range filter
    if (searchCriteria.minPrice !== undefined || searchCriteria.maxPrice !== undefined) {
      const minPrice = searchCriteria.minPrice || 0;
      const maxPrice = searchCriteria.maxPrice || Number.MAX_VALUE;
      specification = specification.and(
        new ProductsPriceBetweenSpecification(minPrice, maxPrice)
      );
    }

    // Add tags filter
    if (searchCriteria.tags && searchCriteria.tags.length > 0) {
      specification = specification.and(
        new ProductsWithTagsSpecification(searchCriteria.tags)
      );
    }

    // Add stock filter
    if (searchCriteria.inStockOnly) {
      specification = specification.and(new ProductsInStockSpecification());
    }

    // Add availability filter
    if (searchCriteria.availableOnly) {
      specification = specification.and(new ProductsInStockSpecification(1));
    }

    return await this.findBySpecification(specification);
  }

  // ✅ FOCUS: Paginated specification queries
  async findBySpecificationWithPagination(
    specification: BaseSpecification<Product>,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginationResult<Product>> {
    const offset = (page - 1) * limit;
    let queryOptions = specification.toQueryOptions();

    queryOptions = {
      ...queryOptions,
      limit,
      offset,
      orderBy: [{ field: 'name', direction: 'ASC' }]
    };

    const [data, total] = await Promise.all([
      this.find(queryOptions),
      this.countBySpecification(specification)
    ]);

    return createPaginationResult(data, total, page, limit);
  }

  // ✅ FOCUS: Advanced specification queries with sorting
  async findProductsByPopularity(specification: BaseSpecification<Product>): Promise<Product[]> {
    let queryOptions = specification.toQueryOptions();

    queryOptions = {
      ...queryOptions,
      orderBy: [
        { field: 'metadata.viewCount', direction: 'DESC' },
        { field: 'metadata.salesCount', direction: 'DESC' },
        { field: 'createdAt', direction: 'DESC' }
      ]
    };

    return await this.find(queryOptions);
  }

  // ✅ FOCUS: Specification with complex aggregations
  async getProductCategoryStatistics(
    specification: BaseSpecification<Product>
  ): Promise<ProductCategoryStats[]> {
    const products = await this.findBySpecification(specification);

    // Group by category and calculate statistics
    const categoryStats = new Map<string, {
      category: string;
      totalProducts: number;
      averagePrice: number;
      totalInventory: number;
      lowStockCount: number;
    }>();

    for (const product of products) {
      const existing = categoryStats.get(product.category) || {
        category: product.category,
        totalProducts: 0,
        averagePrice: 0,
        totalInventory: 0,
        lowStockCount: 0
      };

      existing.totalProducts++;
      existing.averagePrice = (existing.averagePrice * (existing.totalProducts - 1) + product.price) / existing.totalProducts;
      existing.totalInventory += product.inventory.quantity;

      if (product.inventory.quantity <= product.inventory.minStock) {
        existing.lowStockCount++;
      }

      categoryStats.set(product.category, existing);
    }

    return Array.from(categoryStats.values());
  }

  // ✅ FOCUS: Cached specification queries
  async findBySpecificationCached(
    specification: BaseSpecification<Product>,
    cacheKey?: string,
    ttl: number = 300
  ): Promise<Product[]> {
    const actualCacheKey = cacheKey || `spec:${specification.getSpecificationKey()}`;

    return await this.findWithCache(
      specification.toQueryOptions(),
      { key: actualCacheKey, ttl }
    );
  }
}

// ✅ FOCUS: Specification factory for common business scenarios
export class ProductSpecificationFactory {
  static createForCustomerSearch(
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    inStock?: boolean
  ): BaseSpecification<Product> {
    let spec = new ActiveProductsSpecification();

    if (category) {
      spec = spec.and(new ProductsInCategorySpecification(category));
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      spec = spec.and(new ProductsPriceBetweenSpecification(
        minPrice || 0,
        maxPrice || Number.MAX_VALUE
      ));
    }

    if (inStock) {
      spec = spec.and(new ProductsInStockSpecification());
    }

    return spec;
  }

  static createForInventoryManagement(): BaseSpecification<Product> {
    return new ActiveProductsSpecification()
      .and(new ProductsLowStockSpecification());
  }

  static createForPromotionalCampaign(
    targetCategories: string[],
    maxPrice: number,
    requiredTags: string[]
  ): BaseSpecification<Product> {
    const categorySpecs = targetCategories.map(cat =>
      new ProductsInCategorySpecification(cat)
    );
    const categoriesSpec = categorySpecs.reduce((acc, spec) => acc.or(spec));

    return new ActiveProductsSpecification()
      .and(categoriesSpec)
      .and(new ProductsPriceBetweenSpecification(0, maxPrice))
      .and(new ProductsWithTagsSpecification(requiredTags))
      .and(new ProductsInStockSpecification(10)); // Minimum 10 in stock
  }

  static createForDiscountedProducts(discountThreshold: number): BaseSpecification<Product> {
    return new ActiveProductsSpecification()
      .and(new ProductsInStockSpecification())
      .and(new BaseSpecification<Product>() {
        isSatisfiedBy(product: Product): boolean {
          return product.metadata?.discount && product.metadata.discount >= discountThreshold;
        }
        toQueryOptions(): QueryOptions {
          return {
            where: [{ field: 'metadata.discount', operator: 'gte', value: discountThreshold }]
          };
        }
      });
  }
}

// Usage Example with different search scenarios
async function demonstrateSpecificationPattern() {
  const productRepo = new ProductSpecificationRepository();
  const specFactory = ProductSpecificationFactory;

  // 1. Simple specification
  console.log('=== Active Products ===');
  const activeProducts = await productRepo.findBySpecification(
    new ActiveProductsSpecification()
  );
  console.log(`Found ${activeProducts.length} active products`);

  // 2. Composite specification
  console.log('=== Electronics in Stock (Price: $100-$500) ===');
  const electronicsSpec = new ActiveProductsSpecification()
    .and(new ProductsInCategorySpecification('electronics'))
    .and(new ProductsPriceBetweenSpecification(100, 500))
    .and(new ProductsInStockSpecification());

  const electronics = await productRepo.findBySpecification(electronicsSpec);
  console.log(`Found ${electronics.length} electronics in price range`);

  // 3. Complex business query
  console.log('=== Products for Promotion ===');
  const promotionProducts = await productRepo.findProductsForPromotion(
    ['electronics', 'clothing'],
    ['expensive', 'premium'],
    200
  );
  console.log(`Found ${promotionProducts.length} products for promotion`);

  // 4. Dynamic search criteria
  console.log('=== Dynamic Search ===');
  const searchCriteria: ProductSearchCriteria = {
    category: 'books',
    minPrice: 10,
    maxPrice: 50,
    tags: ['fiction', 'bestseller'],
    inStockOnly: true
  };

  const searchResults = await productRepo.searchProducts(searchCriteria);
  console.log(`Found ${searchResults.length} books matching criteria`);

  // 5. Paginated results
  console.log('=== Paginated Low Stock Products ===');
  const lowStockSpec = specFactory.createForInventoryManagement();
  const paginatedResults = await productRepo.findBySpecificationWithPagination(
    lowStockSpec,
    1,
    20
  );
  console.log(`Page 1: ${paginatedResults.data.length} items, Total: ${paginatedResults.total}`);

  // 6. Category statistics
  console.log('=== Category Statistics ===');
  const allActiveSpec = new ActiveProductsSpecification();
  const stats = await productRepo.getProductCategoryStatistics(allActiveSpec);
  for (const stat of stats) {
    console.log(`${stat.category}: ${stat.totalProducts} products, avg price: $${stat.averagePrice.toFixed(2)}`);
  }

  // 7. Factory-created specifications
  console.log('=== Promotional Campaign Products ===');
  const campaignSpec = specFactory.createForPromotionalCampaign(
    ['electronics', 'home'],
    300,
    ['featured', 'popular']
  );
  const campaignProducts = await productRepo.findBySpecification(campaignSpec);
  console.log(`Found ${campaignProducts.length} products for campaign`);
}

// Types for search criteria
interface ProductSearchCriteria {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  inStockOnly?: boolean;
  availableOnly?: boolean;
}

interface ProductCategoryStats {
  category: string;
  totalProducts: number;
  averagePrice: number;
  totalInventory: number;
  lowStockCount: number;
}
```

## Key Features

- Composable business logic through specification chaining (AND, OR, NOT)
- Domain-driven query criteria encapsulated in specifications
- Factory pattern for common business scenarios
- Complex query building with dynamic criteria
- Pagination and sorting support with specifications
- Cached query execution with specification-based cache keys

## Common Pitfalls

- Over-complicating simple queries with unnecessary specifications
- Not optimizing specification-generated queries for database performance
- Creating too many fine-grained specifications (maintainability issues)
- Forgetting to implement both `isSatisfiedBy()` and `toQueryOptions()` methods
  consistently

## Related Examples

- [Unit of Work Pattern](example-1.md) - Transaction management across
  repositories
- [Multi-Tenant Repository](example-3.md) - Tenant-aware data access patterns
