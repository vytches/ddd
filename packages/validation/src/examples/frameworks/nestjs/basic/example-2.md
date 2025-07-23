# NestJS Product Validation - Manual Setup

**Package**: @vytches-ddd/validation  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Product validation with business rules and manual configuration

## Overview

This example demonstrates manual integration of product validation using
configurable business rules and field-level validation in NestJS. Shows
practical business validation scenarios with clear separation of concerns.

## Implementation

```typescript
// product-validation.service.ts
import { Injectable } from '@nestjs/common';
import {
  IValidator,
  ValidationResult,
  FieldValidator,
  BusinessRule,
  DataQualityValidator,
} from '@vytches-ddd/validation';
import { Product, ValidationContext } from './types'; // From your application

@Injectable()
export class ProductValidationService implements IValidator<Product> {
  private fieldValidator: FieldValidator;
  private qualityValidator: DataQualityValidator<Product>;

  constructor() {
    // ⭐ FOCUS: Manual setup with business rules configuration
    this.initializeBusinessRules();
    this.initializeQualityValidator();
  }

  async validate(
    product: Product,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Field-level validation with business rules
    const fieldResults = await this.validateProductFields(product, context);
    errors.push(...fieldResults.errors);
    warnings.push(...fieldResults.warnings);

    // Data quality assessment
    const qualityResult = await this.qualityValidator.validate(
      product,
      context
    );
    errors.push(...qualityResult.errors);
    warnings.push(...qualityResult.warnings);

    // Business logic validation
    const businessResults = await this.validateBusinessLogic(product, context);
    errors.push(...businessResults.errors);
    warnings.push(...businessResults.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: Date.now(),
        rulesApplied: [
          'product-field-validation',
          'data-quality-assessment',
          'business-logic-validation',
        ],
        skippedRules: [],
        validatorVersion: '1.0.0',
        context: context || {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard',
        },
        qualityScore: qualityResult.metadata.qualityMetrics?.overallScore || 0,
      },
    };
  }

  private async validateProductFields(
    product: Product,
    context?: ValidationContext
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const results = await Promise.all([
      this.fieldValidator.validateField(product, 'name', product.name?.length),
      this.fieldValidator.validateField(product, 'price', product.price),
      this.fieldValidator.validateField(product, 'category', product.category),
      this.fieldValidator.validateField(product, 'sku', product.sku),
      this.fieldValidator.validateField(product, 'weight', product.weight),
    ]);

    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    results.forEach(result => {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    return { errors: allErrors, warnings: allWarnings };
  }

  private async validateBusinessLogic(
    product: Product,
    context?: ValidationContext
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Price vs category consistency
    if (!this.isPriceReasonableForCategory(product.price, product.category)) {
      warnings.push({
        field: 'price',
        code: 'PRICE_CATEGORY_MISMATCH',
        message: `Price ${product.price} may be unusual for category ${product.category}`,
        suggestion: 'Review pricing for this category',
      });
    }

    // SKU format validation
    if (!this.isValidSKUFormat(product.sku)) {
      errors.push({
        field: 'sku',
        code: 'INVALID_SKU_FORMAT',
        message: 'SKU must follow company format: 3 letters + 4-6 digits',
        severity: 'error',
      });
    }

    // Inventory consistency
    if (product.availability && product.availability.quantity < 0) {
      errors.push({
        field: 'availability.quantity',
        code: 'NEGATIVE_INVENTORY',
        message: 'Product quantity cannot be negative',
        severity: 'error',
      });
    }

    // Weight reasonableness
    if (product.weight > 1000) {
      // kg
      warnings.push({
        field: 'weight',
        code: 'HEAVY_PRODUCT',
        message: 'Product weight exceeds 1000kg - verify shipping costs',
        suggestion: 'Review shipping and handling requirements',
      });
    }

    return { errors, warnings };
  }

  private isPriceReasonableForCategory(
    price: number,
    category: string
  ): boolean {
    const categoryRanges: Record<string, { min: number; max: number }> = {
      electronics: { min: 10, max: 10000 },
      clothing: { min: 5, max: 1000 },
      books: { min: 1, max: 200 },
      home: { min: 10, max: 5000 },
      sports: { min: 10, max: 2000 },
    };

    const range = categoryRanges[category?.toLowerCase()];
    if (!range) return true; // Unknown category, assume valid

    return price >= range.min && price <= range.max;
  }

  private isValidSKUFormat(sku: string): boolean {
    if (!sku) return false;

    // Company format: 3 letters followed by 4-6 digits
    const skuRegex = /^[A-Z]{3}\d{4,6}$/;
    return skuRegex.test(sku.toUpperCase());
  }

  private initializeBusinessRules(): void {
    const productRules: BusinessRule[] = [
      {
        id: 'product-name-length',
        name: 'Product Name Length',
        description: 'Product name must be between 3 and 100 characters',
        category: 'product',
        priority: 1,
        isActive: true,
        conditions: [
          { field: 'name', operator: 'greater_than', value: 2 },
          { field: 'name', operator: 'less_than', value: 101 },
        ],
        actions: [{ type: 'validate', parameters: {} }],
      },
      {
        id: 'product-price-positive',
        name: 'Positive Price',
        description: 'Product price must be greater than zero',
        category: 'product',
        priority: 1,
        isActive: true,
        conditions: [{ field: 'price', operator: 'greater_than', value: 0 }],
        actions: [{ type: 'validate', parameters: {} }],
      },
      {
        id: 'product-category-valid',
        name: 'Valid Category',
        description: 'Product must belong to a valid category',
        category: 'product',
        priority: 1,
        isActive: true,
        conditions: [
          {
            field: 'category',
            operator: 'in',
            value: ['electronics', 'clothing', 'books', 'home', 'sports'],
          },
        ],
        actions: [{ type: 'validate', parameters: {} }],
      },
      {
        id: 'sku-required',
        name: 'SKU Required',
        description: 'Product SKU is required and must be unique',
        category: 'product',
        priority: 1,
        isActive: true,
        conditions: [
          { field: 'sku', operator: 'not_equals', value: '' },
          { field: 'sku', operator: 'not_equals', value: null },
        ],
        actions: [{ type: 'validate', parameters: {} }],
      },
    ];

    this.fieldValidator = new FieldValidator(productRules);
  }

  private initializeQualityValidator(): void {
    this.qualityValidator = new DataQualityValidator<Product>({
      completeness: 0.9,
      accuracy: 0.95,
      validity: 0.98,
      consistency: 0.9,
    });
  }
}

// product.controller.ts
import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  BadRequestException,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ProductValidationService } from './product-validation.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Controller('products')
export class ProductController {
  constructor(
    private readonly productValidationService: ProductValidationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() createProductDto: CreateProductDto) {
    try {
      // ✅ FOCUS: Validate before creation
      const validationResult = await this.productValidationService.validate(
        createProductDto as Product,
        {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard',
          businessRules: { enforceUniqueSkus: true },
        }
      );

      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Product validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          qualityScore: validationResult.metadata.qualityScore,
        });
      }

      // Product creation logic would go here
      return {
        success: true,
        message: 'Product validated and ready for creation',
        qualityScore: validationResult.metadata.qualityScore,
        warnings:
          validationResult.warnings.length > 0
            ? validationResult.warnings
            : undefined,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Product creation failed',
        error: error.message,
      });
    }
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    try {
      const validationResult = await this.productValidationService.validate(
        updateProductDto as Product,
        {
          operationType: 'update',
          environment: 'production',
          validationLevel: 'standard',
        }
      );

      if (!validationResult.isValid) {
        throw new BadRequestException({
          message: 'Product update validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      }

      return {
        success: true,
        message: 'Product update validation passed',
        productId: id,
        qualityScore: validationResult.metadata.qualityScore,
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Product update failed',
        error: error.message,
      });
    }
  }

  @Post('validate-bulk')
  @HttpCode(HttpStatus.OK)
  async validateProductBulk(
    @Body() products: CreateProductDto[],
    @Query('continueOnError') continueOnError: boolean = true
  ) {
    try {
      const validationPromises = products.map((product, index) =>
        this.productValidationService
          .validate(product as Product)
          .then(result => ({ index, result }))
          .catch(error => ({ index, error: error.message, result: null }))
      );

      const results = await Promise.all(validationPromises);

      const summary = results.reduce(
        (acc, item) => {
          if (item.result?.isValid) {
            acc.valid++;
          } else {
            acc.invalid++;
          }
          return acc;
        },
        { valid: 0, invalid: 0 }
      );

      return {
        success: true,
        summary: {
          total: products.length,
          valid: summary.valid,
          invalid: summary.invalid,
          successRate: summary.valid / products.length,
        },
        results: results.map(item => ({
          index: item.index,
          isValid: item.result?.isValid || false,
          errors: item.result?.errors || [],
          warnings: item.result?.warnings || [],
          qualityScore: item.result?.metadata.qualityScore || 0,
          error: item.error,
        })),
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Bulk validation failed',
        error: error.message,
      });
    }
  }

  @Post('quality-check')
  @HttpCode(HttpStatus.OK)
  async checkProductQuality(@Body() product: CreateProductDto) {
    try {
      const validationResult = await this.productValidationService.validate(
        product as Product,
        {
          operationType: 'quality_check',
          environment: 'production',
          validationLevel: 'strict',
        }
      );

      return {
        success: true,
        qualityScore: validationResult.metadata.qualityScore,
        qualityBreakdown: validationResult.metadata.qualityMetrics,
        isValid: validationResult.isValid,
        recommendations: validationResult.warnings
          .map(w => w.suggestion)
          .filter(Boolean),
        issues: validationResult.errors.map(e => ({
          field: e.field,
          issue: e.message,
          severity: e.severity,
        })),
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Quality check failed',
        error: error.message,
      });
    }
  }
}

// product.module.ts
import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductValidationService } from './product-validation.service';

@Module({
  controllers: [ProductController],
  providers: [ProductValidationService],
  exports: [ProductValidationService],
})
export class ProductModule {}
```

## Key Points

- **Business Rules Integration**: Configurable business rules for flexible
  validation
- **Data Quality Assessment**: Built-in data quality scoring and metrics
- **Multiple Validation Layers**: Field validation, business logic, and quality
  assessment
- **Practical Business Logic**: Real-world product validation scenarios
- **Comprehensive Error Handling**: Detailed error responses with quality scores

## Usage Examples

```bash
# Create a product
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Headphones",
    "price": 299.99,
    "category": "electronics",
    "sku": "ELE001234",
    "weight": 0.5,
    "description": "High-quality wireless headphones",
    "availability": {
      "inStock": true,
      "quantity": 100
    }
  }'

# Quality check
curl -X POST http://localhost:3000/products/quality-check \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Book",
    "price": 19.99,
    "category": "books",
    "sku": "BOO987654",
    "weight": 0.3
  }'

# Bulk validation
curl -X POST http://localhost:3000/products/validate-bulk \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "Valid Product",
      "price": 50.00,
      "category": "home",
      "sku": "HOM123456",
      "weight": 2.0
    },
    {
      "name": "",
      "price": -10,
      "category": "invalid",
      "sku": "INVALID",
      "weight": 2000
    }
  ]'
```

## Next Steps

- Explore [Basic User Validation](./example-1.md)
- Advance to [VytchesDDD DI Integration](../intermediate/example-1.md)
- Study [Enterprise Patterns](../advanced/example-1.md)
