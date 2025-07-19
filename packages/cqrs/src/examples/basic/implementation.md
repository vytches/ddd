# Basic CQRS with Commands & Queries Implementation

**Focus**: Basic CQRS implementation with commands, queries, and handlers for application architecture  
**Domain**: E-commerce Product Management  
**Complexity**: Basic  
**Dependencies**: @vytches-ddd/cqrs, @vytches-ddd/utils

## Business Context

This example demonstrates basic CQRS patterns for an e-commerce product management system that requires:
- Clear separation between commands (write operations) and queries (read operations)
- Dedicated handlers for each command and query
- Command and query buses for routing and execution
- Simple but effective error handling and validation
- Scalable architecture that can grow with business requirements

## Implementation

```typescript
// commands/product-commands.ts
import { ICommand } from '@vytches-ddd/cqrs';
import { Product, ProductCategory } from '../types'; // ALWAYS import from app

// Product management commands
export class CreateProductCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly stock: number,
    public readonly sku: string,
    public readonly createdBy: string
  ) {}
}

export class UpdateProductCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly price?: number,
    public readonly categoryId?: string,
    public readonly stock?: number,
    public readonly updatedBy?: string
  ) {}
}

export class DeleteProductCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly deletedBy: string,
    public readonly reason?: string
  ) {}
}

export class UpdateProductStockCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly operation: 'add' | 'subtract' | 'set',
    public readonly updatedBy: string,
    public readonly reason?: string
  ) {}
}

export class ChangeProductCategoryCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly newCategoryId: string,
    public readonly updatedBy: string,
    public readonly reason?: string
  ) {}
}

// queries/product-queries.ts
import { IQuery } from '@vytches-ddd/cqrs';

// Product management queries
export class GetProductByIdQuery implements IQuery {
  constructor(public readonly productId: string) {}
}

export class GetProductsByCategory implements IQuery {
  constructor(
    public readonly categoryId: string,
    public readonly limit: number = 50,
    public readonly offset: number = 0
  ) {}
}

export class SearchProductsQuery implements IQuery {
  constructor(
    public readonly searchTerm: string,
    public readonly categoryId?: string,
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
    public readonly limit: number = 20,
    public readonly offset: number = 0
  ) {}
}

export class GetProductStockQuery implements IQuery {
  constructor(public readonly productId: string) {}
}

export class GetLowStockProductsQuery implements IQuery {
  constructor(
    public readonly threshold: number = 10,
    public readonly limit: number = 100
  ) {}
}

export class GetProductSalesStatsQuery implements IQuery {
  constructor(
    public readonly productId: string,
    public readonly dateFrom: Date,
    public readonly dateTo: Date
  ) {}
}

// handlers/product-command-handlers.ts
import { 
  ICommandHandler, 
  CommandHandler 
} from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';
import {
  CreateProductCommand,
  UpdateProductCommand,
  DeleteProductCommand,
  UpdateProductStockCommand,
  ChangeProductCategoryCommand
} from '../commands/product-commands';

// ⭐ Product Creation Handler
@CommandHandler(CreateProductCommand)
export class CreateProductCommandHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository
  ) {}

  async execute(command: CreateProductCommand): Promise<Result<Product, Error>> {
    try {
      // Validate category exists
      const category = await this.categoryRepository.findById(command.categoryId);
      if (!category) {
        return Result.failure(new Error(`Category not found: ${command.categoryId}`));
      }

      // Validate SKU uniqueness
      const existingProduct = await this.productRepository.findBySku(command.sku);
      if (existingProduct) {
        return Result.failure(new Error(`Product with SKU ${command.sku} already exists`));
      }

      // Create product
      const product = new Product({
        id: this.generateProductId(),
        name: command.name,
        description: command.description,
        price: command.price,
        categoryId: command.categoryId,
        stock: command.stock,
        sku: command.sku,
        createdBy: command.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });

      // Save product
      const savedProduct = await this.productRepository.save(product);
      
      return Result.success(savedProduct);
    } catch (error) {
      return Result.failure(new Error(`Failed to create product: ${error.message}`));
    }
  }

  private generateProductId(): string {
    return `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ⭐ Product Update Handler
@CommandHandler(UpdateProductCommand)
export class UpdateProductCommandHandler implements ICommandHandler<UpdateProductCommand> {
  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository
  ) {}

  async execute(command: UpdateProductCommand): Promise<Result<Product, Error>> {
    try {
      // Get existing product
      const existingProduct = await this.productRepository.findById(command.productId);
      if (!existingProduct) {
        return Result.failure(new Error(`Product not found: ${command.productId}`));
      }

      // Validate category if changing
      if (command.categoryId && command.categoryId !== existingProduct.categoryId) {
        const category = await this.categoryRepository.findById(command.categoryId);
        if (!category) {
          return Result.failure(new Error(`Category not found: ${command.categoryId}`));
        }
      }

      // Update product properties
      const updatedProduct = new Product({
        ...existingProduct,
        name: command.name ?? existingProduct.name,
        description: command.description ?? existingProduct.description,
        price: command.price ?? existingProduct.price,
        categoryId: command.categoryId ?? existingProduct.categoryId,
        stock: command.stock ?? existingProduct.stock,
        updatedBy: command.updatedBy,
        updatedAt: new Date()
      });

      // Save updated product
      const savedProduct = await this.productRepository.save(updatedProduct);
      
      return Result.success(savedProduct);
    } catch (error) {
      return Result.failure(new Error(`Failed to update product: ${error.message}`));
    }
  }
}

// ⭐ Product Stock Update Handler
@CommandHandler(UpdateProductStockCommand)
export class UpdateProductStockCommandHandler implements ICommandHandler<UpdateProductStockCommand> {
  constructor(private productRepository: ProductRepository) {}

  async execute(command: UpdateProductStockCommand): Promise<Result<Product, Error>> {
    try {
      // Get existing product
      const existingProduct = await this.productRepository.findById(command.productId);
      if (!existingProduct) {
        return Result.failure(new Error(`Product not found: ${command.productId}`));
      }

      // Calculate new stock
      let newStock = existingProduct.stock;
      
      switch (command.operation) {
        case 'add':
          newStock += command.quantity;
          break;
        case 'subtract':
          newStock -= command.quantity;
          if (newStock < 0) {
            return Result.failure(new Error('Insufficient stock'));
          }
          break;
        case 'set':
          newStock = command.quantity;
          break;
      }

      // Update product stock
      const updatedProduct = new Product({
        ...existingProduct,
        stock: newStock,
        updatedBy: command.updatedBy,
        updatedAt: new Date()
      });

      // Save updated product
      const savedProduct = await this.productRepository.save(updatedProduct);
      
      return Result.success(savedProduct);
    } catch (error) {
      return Result.failure(new Error(`Failed to update product stock: ${error.message}`));
    }
  }
}

// ⭐ Product Deletion Handler
@CommandHandler(DeleteProductCommand)
export class DeleteProductCommandHandler implements ICommandHandler<DeleteProductCommand> {
  constructor(private productRepository: ProductRepository) {}

  async execute(command: DeleteProductCommand): Promise<Result<void, Error>> {
    try {
      // Get existing product
      const existingProduct = await this.productRepository.findById(command.productId);
      if (!existingProduct) {
        return Result.failure(new Error(`Product not found: ${command.productId}`));
      }

      // Soft delete product
      const deletedProduct = new Product({
        ...existingProduct,
        isActive: false,
        deletedBy: command.deletedBy,
        deletedAt: new Date(),
        deletionReason: command.reason
      });

      // Save updated product
      await this.productRepository.save(deletedProduct);
      
      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new Error(`Failed to delete product: ${error.message}`));
    }
  }
}

// handlers/product-query-handlers.ts
import { 
  IQueryHandler, 
  QueryHandler 
} from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';
import {
  GetProductByIdQuery,
  GetProductsByCategory,
  SearchProductsQuery,
  GetProductStockQuery,
  GetLowStockProductsQuery,
  GetProductSalesStatsQuery
} from '../queries/product-queries';

// ⭐ Get Product by ID Handler
@QueryHandler(GetProductByIdQuery)
export class GetProductByIdQueryHandler implements IQueryHandler<GetProductByIdQuery> {
  constructor(private productRepository: ProductRepository) {}

  async execute(query: GetProductByIdQuery): Promise<Result<Product | null, Error>> {
    try {
      const product = await this.productRepository.findById(query.productId);
      return Result.success(product);
    } catch (error) {
      return Result.failure(new Error(`Failed to get product: ${error.message}`));
    }
  }
}

// ⭐ Get Products by Category Handler
@QueryHandler(GetProductsByCategory)
export class GetProductsByCategoryQueryHandler implements IQueryHandler<GetProductsByCategory> {
  constructor(private productRepository: ProductRepository) {}

  async execute(query: GetProductsByCategory): Promise<Result<Product[], Error>> {
    try {
      const products = await this.productRepository.findByCategory(
        query.categoryId,
        query.limit,
        query.offset
      );
      return Result.success(products);
    } catch (error) {
      return Result.failure(new Error(`Failed to get products by category: ${error.message}`));
    }
  }
}

// ⭐ Search Products Handler
@QueryHandler(SearchProductsQuery)
export class SearchProductsQueryHandler implements IQueryHandler<SearchProductsQuery> {
  constructor(private productRepository: ProductRepository) {}

  async execute(query: SearchProductsQuery): Promise<Result<Product[], Error>> {
    try {
      const products = await this.productRepository.search({
        searchTerm: query.searchTerm,
        categoryId: query.categoryId,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        limit: query.limit,
        offset: query.offset
      });
      return Result.success(products);
    } catch (error) {
      return Result.failure(new Error(`Failed to search products: ${error.message}`));
    }
  }
}

// ⭐ Get Low Stock Products Handler
@QueryHandler(GetLowStockProductsQuery)
export class GetLowStockProductsQueryHandler implements IQueryHandler<GetLowStockProductsQuery> {
  constructor(private productRepository: ProductRepository) {}

  async execute(query: GetLowStockProductsQuery): Promise<Result<Product[], Error>> {
    try {
      const products = await this.productRepository.findLowStock(
        query.threshold,
        query.limit
      );
      return Result.success(products);
    } catch (error) {
      return Result.failure(new Error(`Failed to get low stock products: ${error.message}`));
    }
  }
}

// product-service.ts
import { 
  CommandBus, 
  QueryBus 
} from '@vytches-ddd/cqrs';
import { Result } from '@vytches-ddd/utils';

// ⭐ Basic Product Service using CQRS
export class ProductService {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  // Command operations
  async createProduct(productData: CreateProductData): Promise<Result<Product, Error>> {
    try {
      const command = new CreateProductCommand(
        productData.name,
        productData.description,
        productData.price,
        productData.categoryId,
        productData.stock,
        productData.sku,
        productData.createdBy
      );

      const result = await this.commandBus.execute(command);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to create product: ${error.message}`));
    }
  }

  async updateProduct(productId: string, updateData: UpdateProductData): Promise<Result<Product, Error>> {
    try {
      const command = new UpdateProductCommand(
        productId,
        updateData.name,
        updateData.description,
        updateData.price,
        updateData.categoryId,
        updateData.stock,
        updateData.updatedBy
      );

      const result = await this.commandBus.execute(command);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to update product: ${error.message}`));
    }
  }

  async deleteProduct(productId: string, deletedBy: string, reason?: string): Promise<Result<void, Error>> {
    try {
      const command = new DeleteProductCommand(productId, deletedBy, reason);
      const result = await this.commandBus.execute(command);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to delete product: ${error.message}`));
    }
  }

  async updateProductStock(
    productId: string,
    quantity: number,
    operation: 'add' | 'subtract' | 'set',
    updatedBy: string,
    reason?: string
  ): Promise<Result<Product, Error>> {
    try {
      const command = new UpdateProductStockCommand(
        productId,
        quantity,
        operation,
        updatedBy,
        reason
      );

      const result = await this.commandBus.execute(command);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to update product stock: ${error.message}`));
    }
  }

  // Query operations
  async getProductById(productId: string): Promise<Result<Product | null, Error>> {
    try {
      const query = new GetProductByIdQuery(productId);
      const result = await this.queryBus.execute(query);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to get product: ${error.message}`));
    }
  }

  async getProductsByCategory(
    categoryId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Result<Product[], Error>> {
    try {
      const query = new GetProductsByCategory(categoryId, limit, offset);
      const result = await this.queryBus.execute(query);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to get products by category: ${error.message}`));
    }
  }

  async searchProducts(searchParams: SearchProductsParams): Promise<Result<Product[], Error>> {
    try {
      const query = new SearchProductsQuery(
        searchParams.searchTerm,
        searchParams.categoryId,
        searchParams.minPrice,
        searchParams.maxPrice,
        searchParams.limit,
        searchParams.offset
      );

      const result = await this.queryBus.execute(query);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to search products: ${error.message}`));
    }
  }

  async getLowStockProducts(
    threshold: number = 10,
    limit: number = 100
  ): Promise<Result<Product[], Error>> {
    try {
      const query = new GetLowStockProductsQuery(threshold, limit);
      const result = await this.queryBus.execute(query);
      return result;
    } catch (error) {
      return Result.failure(new Error(`Failed to get low stock products: ${error.message}`));
    }
  }

  // Bulk operations
  async bulkUpdateStock(
    updates: Array<{
      productId: string;
      quantity: number;
      operation: 'add' | 'subtract' | 'set';
    }>,
    updatedBy: string,
    reason?: string
  ): Promise<Result<Product[], Error>> {
    try {
      const results: Product[] = [];
      const errors: Error[] = [];

      for (const update of updates) {
        const result = await this.updateProductStock(
          update.productId,
          update.quantity,
          update.operation,
          updatedBy,
          reason
        );

        if (result.isSuccess()) {
          results.push(result.value);
        } else {
          errors.push(result.error);
        }
      }

      if (errors.length > 0) {
        return Result.failure(new Error(`Bulk update failed: ${errors.map(e => e.message).join(', ')}`));
      }

      return Result.success(results);
    } catch (error) {
      return Result.failure(new Error(`Bulk stock update failed: ${error.message}`));
    }
  }

  async bulkCreateProducts(
    productsData: CreateProductData[],
    createdBy: string
  ): Promise<Result<Product[], Error>> {
    try {
      const results: Product[] = [];
      const errors: Error[] = [];

      for (const productData of productsData) {
        const result = await this.createProduct({ ...productData, createdBy });

        if (result.isSuccess()) {
          results.push(result.value);
        } else {
          errors.push(result.error);
        }
      }

      if (errors.length > 0) {
        return Result.failure(new Error(`Bulk creation failed: ${errors.map(e => e.message).join(', ')}`));
      }

      return Result.success(results);
    } catch (error) {
      return Result.failure(new Error(`Bulk product creation failed: ${error.message}`));
    }
  }
}

// cqrs-setup.ts
import { 
  CommandBus, 
  QueryBus,
  EnhancedCommandBus,
  EnhancedQueryBus 
} from '@vytches-ddd/cqrs';

// ⭐ Basic CQRS Setup
export class CQRSSetup {
  private commandBus: CommandBus;
  private queryBus: QueryBus;

  constructor(
    private productRepository: ProductRepository,
    private categoryRepository: CategoryRepository
  ) {
    this.initializeBuses();
    this.registerHandlers();
  }

  private initializeBuses(): void {
    this.commandBus = new EnhancedCommandBus();
    this.queryBus = new EnhancedQueryBus();
  }

  private registerHandlers(): void {
    // Register command handlers
    this.commandBus.register(
      CreateProductCommand,
      new CreateProductCommandHandler(this.productRepository, this.categoryRepository)
    );
    
    this.commandBus.register(
      UpdateProductCommand,
      new UpdateProductCommandHandler(this.productRepository, this.categoryRepository)
    );
    
    this.commandBus.register(
      DeleteProductCommand,
      new DeleteProductCommandHandler(this.productRepository)
    );
    
    this.commandBus.register(
      UpdateProductStockCommand,
      new UpdateProductStockCommandHandler(this.productRepository)
    );

    // Register query handlers
    this.queryBus.register(
      GetProductByIdQuery,
      new GetProductByIdQueryHandler(this.productRepository)
    );
    
    this.queryBus.register(
      GetProductsByCategory,
      new GetProductsByCategoryQueryHandler(this.productRepository)
    );
    
    this.queryBus.register(
      SearchProductsQuery,
      new SearchProductsQueryHandler(this.productRepository)
    );
    
    this.queryBus.register(
      GetLowStockProductsQuery,
      new GetLowStockProductsQueryHandler(this.productRepository)
    );
  }

  getCommandBus(): CommandBus {
    return this.commandBus;
  }

  getQueryBus(): QueryBus {
    return this.queryBus;
  }

  createProductService(): ProductService {
    return new ProductService(this.commandBus, this.queryBus);
  }
}

// Mock repositories for demonstration
export class MockProductRepository implements ProductRepository {
  private products: Product[] = [];
  private nextId = 1;

  async save(product: Product): Promise<Product> {
    const existingIndex = this.products.findIndex(p => p.id === product.id);
    if (existingIndex >= 0) {
      this.products[existingIndex] = product;
    } else {
      this.products.push(product);
    }
    return product;
  }

  async findById(id: string): Promise<Product | null> {
    return this.products.find(p => p.id === id && p.isActive) || null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.products.find(p => p.sku === sku && p.isActive) || null;
  }

  async findByCategory(categoryId: string, limit: number, offset: number): Promise<Product[]> {
    return this.products
      .filter(p => p.categoryId === categoryId && p.isActive)
      .slice(offset, offset + limit);
  }

  async search(params: SearchProductsParams): Promise<Product[]> {
    return this.products
      .filter(p => {
        if (!p.isActive) return false;
        
        const matchesSearch = !params.searchTerm || 
          p.name.toLowerCase().includes(params.searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(params.searchTerm.toLowerCase());
        
        const matchesCategory = !params.categoryId || p.categoryId === params.categoryId;
        const matchesMinPrice = !params.minPrice || p.price >= params.minPrice;
        const matchesMaxPrice = !params.maxPrice || p.price <= params.maxPrice;
        
        return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
      })
      .slice(params.offset || 0, (params.offset || 0) + (params.limit || 20));
  }

  async findLowStock(threshold: number, limit: number): Promise<Product[]> {
    return this.products
      .filter(p => p.isActive && p.stock <= threshold)
      .slice(0, limit);
  }
}

export class MockCategoryRepository implements CategoryRepository {
  private categories: ProductCategory[] = [
    { id: 'cat-1', name: 'Electronics', description: 'Electronic products' },
    { id: 'cat-2', name: 'Clothing', description: 'Clothing and accessories' },
    { id: 'cat-3', name: 'Books', description: 'Books and literature' }
  ];

  async findById(id: string): Promise<ProductCategory | null> {
    return this.categories.find(c => c.id === id) || null;
  }

  async findAll(): Promise<ProductCategory[]> {
    return [...this.categories];
  }
}
```

## Key Features

- **Command Query Separation**: Clear separation between write and read operations
- **Dedicated Handlers**: Each command and query has its own handler
- **Command & Query Buses**: Centralized routing and execution
- **Result Pattern**: Consistent error handling with Result type
- **Scalable Architecture**: Easy to extend with new commands and queries
- **Repository Pattern**: Clean data access layer abstraction

## Usage Example

```typescript
// Usage in e-commerce application
export class ProductController {
  constructor(private productService: ProductService) {}

  async createProduct(productData: CreateProductData): Promise<Result<Product, Error>> {
    try {
      // Create product using CQRS command
      const result = await this.productService.createProduct(productData);
      
      if (result.isFailure()) {
        console.log('Product creation failed:', result.error.message);
        return Result.failure(result.error);
      }

      console.log('Product created successfully:', result.value);
      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Product creation failed: ${error.message}`));
    }
  }

  async getProduct(productId: string): Promise<Result<Product | null, Error>> {
    try {
      // Get product using CQRS query
      const result = await this.productService.getProductById(productId);
      
      if (result.isFailure()) {
        console.log('Product retrieval failed:', result.error.message);
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Product retrieval failed: ${error.message}`));
    }
  }

  async updateProductStock(
    productId: string,
    quantity: number,
    operation: 'add' | 'subtract' | 'set',
    updatedBy: string
  ): Promise<Result<Product, Error>> {
    try {
      const result = await this.productService.updateProductStock(
        productId,
        quantity,
        operation,
        updatedBy
      );
      
      if (result.isFailure()) {
        console.log('Stock update failed:', result.error.message);
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Stock update failed: ${error.message}`));
    }
  }

  async searchProducts(searchParams: SearchProductsParams): Promise<Result<Product[], Error>> {
    try {
      const result = await this.productService.searchProducts(searchParams);
      
      if (result.isFailure()) {
        console.log('Product search failed:', result.error.message);
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Product search failed: ${error.message}`));
    }
  }

  async getLowStockAlert(): Promise<Result<Product[], Error>> {
    try {
      const result = await this.productService.getLowStockProducts(5); // 5 item threshold
      
      if (result.isFailure()) {
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Low stock check failed: ${error.message}`));
    }
  }
}
```

## Common Pitfalls

- **Command vs Query Confusion**: Remember commands modify state, queries only read
- **Handler Registration**: Ensure all handlers are properly registered with buses
- **Error Handling**: Use Result pattern consistently across all handlers
- **Async Operations**: Always await async operations in handlers
- **Repository Abstraction**: Keep repositories focused on data access only
- **Command Validation**: Validate commands before execution, not in handlers