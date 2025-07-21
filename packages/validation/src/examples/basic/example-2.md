# Field-Level Validation with Business Rules

**Version**: 1.0.0
**Package**: @vytches-ddd/validation
**Complexity**: Basic
**Domain**: Product Management
**Patterns**: Field Validation, Business Rules, Configuration-driven Validation
**Dependencies**: @vytches-ddd/validation, @vytches-ddd/core

## Description

This example demonstrates field-level validation using configurable business rules for product management. It shows how to create validation rules that can be configured externally and applied consistently across different entity types.

## Business Context

E-commerce platforms need flexible validation rules for products that can vary by category, region, or business requirements. Field-level validation allows for granular control over data quality while maintaining performance and flexibility.

## Code Example

```typescript
// field-validators.ts
import { 
  IFieldValidator, 
  ValidationResult,
  BusinessRule,
  RuleCondition,
  RuleAction 
} from '@vytches-ddd/validation';
import { Product } from './types'; // Import from your application

// Generic field validator for business rules
export class FieldValidator implements IFieldValidator<Product> {
  constructor(private rules: BusinessRule[]) {}

  async validateField(
    entity: Product, 
    fieldName: keyof Product, 
    value: any,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const applicableRules = this.getApplicableRules(fieldName, context);

    for (const rule of applicableRules) {
      const ruleResult = await this.executeRule(rule, entity, fieldName, value);
      
      if (!ruleResult.isValid) {
        if (rule.actions.some(a => a.type === 'reject')) {
          errors.push({
            field: fieldName as string,
            code: rule.id.toUpperCase(),
            message: ruleResult.message || `Validation failed for rule: ${rule.name}`,
            severity: 'error',
            details: ruleResult.details
          });
        } else if (rule.actions.some(a => a.type === 'warn')) {
          warnings.push({
            field: fieldName as string,
            code: rule.id.toUpperCase(),
            message: ruleResult.message || `Warning for rule: ${rule.name}`,
            suggestion: ruleResult.suggestion
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: Date.now(),
        rulesApplied: applicableRules.map(r => r.id),
        skippedRules: [],
        validatorVersion: '1.0.0',
        context: context || {
          operationType: 'update',
          environment: 'production',
          validationLevel: 'standard'
        }
      }
    };
  }

  private getApplicableRules(fieldName: keyof Product, context?: ValidationContext): BusinessRule[] {
    return this.rules.filter(rule => 
      rule.isActive && 
      rule.conditions.some(c => c.field === fieldName) &&
      this.isRuleApplicableInContext(rule, context)
    );
  }

  private isRuleApplicableInContext(rule: BusinessRule, context?: ValidationContext): boolean {
    if (!context) return true;
    
    // Check if rule is effective
    if (rule.effectiveDate && new Date() < rule.effectiveDate) return false;
    if (rule.expirationDate && new Date() > rule.expirationDate) return false;
    
    return true;
  }

  private async executeRule(
    rule: BusinessRule, 
    entity: Product, 
    fieldName: keyof Product, 
    value: any
  ): Promise<{ isValid: boolean; message?: string; suggestion?: string; details?: any }> {
    for (const condition of rule.conditions) {
      if (condition.field !== fieldName) continue;
      
      const conditionResult = this.evaluateCondition(condition, value);
      if (!conditionResult) {
        return {
          isValid: false,
          message: this.getErrorMessage(rule, condition, value),
          details: { rule: rule.id, condition: condition.operator, value }
        };
      }
    }
    
    return { isValid: true };
  }

  private evaluateCondition(condition: RuleCondition, value: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return false;
    }
  }

  private getErrorMessage(rule: BusinessRule, condition: RuleCondition, value: any): string {
    return `${rule.description}. Expected ${condition.operator} ${condition.value}, got ${value}`;
  }
}

// Product validation service with configurable rules
export class ProductValidationService {
  private fieldValidator: FieldValidator;

  constructor() {
    // Configure validation rules for products
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
          { field: 'name', operator: 'less_than', value: 101 }
        ],
        actions: [{ type: 'reject', parameters: {} }]
      },
      {
        id: 'product-price-positive',
        name: 'Positive Price',
        description: 'Product price must be greater than zero',
        category: 'product',
        priority: 1,
        isActive: true,
        conditions: [
          { field: 'price', operator: 'greater_than', value: 0 }
        ],
        actions: [{ type: 'reject', parameters: {} }]
      },
      {
        id: 'product-weight-reasonable',
        name: 'Reasonable Weight',
        description: 'Product weight should be reasonable for shipping',
        category: 'product',
        priority: 2,
        isActive: true,
        conditions: [
          { field: 'weight', operator: 'less_than', value: 1000 }
        ],
        actions: [{ type: 'warn', parameters: {} }]
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
            value: ['electronics', 'clothing', 'books', 'home', 'sports']
          }
        ],
        actions: [{ type: 'reject', parameters: {} }]
      }
    ];

    this.fieldValidator = new FieldValidator(productRules);
  }

  async validateProduct(product: Product, context?: ValidationContext): Promise<ValidationResult> {
    const validationPromises = [
      this.fieldValidator.validateField(product, 'name', product.name?.length, context),
      this.fieldValidator.validateField(product, 'price', product.price, context),
      this.fieldValidator.validateField(product, 'weight', product.weight, context),
      this.fieldValidator.validateField(product, 'category', product.category, context)
    ];

    const results = await Promise.all(validationPromises);
    
    // Aggregate results
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    const allRulesApplied: string[] = [];

    results.forEach(result => {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allRulesApplied.push(...result.metadata.rulesApplied);
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      metadata: {
        validatedAt: new Date(),
        validationDuration: Date.now(),
        rulesApplied: [...new Set(allRulesApplied)],
        skippedRules: [],
        validatorVersion: '1.0.0',
        context: context || {
          operationType: 'create',
          environment: 'production',
          validationLevel: 'standard'
        }
      }
    };
  }

  async validateFieldOnly(
    product: Product, 
    fieldName: keyof Product, 
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const fieldValue = product[fieldName];
    return await this.fieldValidator.validateField(product, fieldName, fieldValue, context);
  }
}

// Usage example
const productService = new ProductValidationService();

const newProduct: Product = {
  id: 'prod-001',
  name: 'Wireless Headphones',
  description: 'High-quality wireless headphones with noise cancellation',
  category: 'electronics',
  price: 299.99,
  currency: 'USD',
  sku: 'WH-001',
  weight: 0.5,
  dimensions: {
    length: 20,
    width: 15,
    height: 8,
    unit: 'cm'
  },
  availability: {
    inStock: true,
    quantity: 100,
    minStockLevel: 10,
    maxStockLevel: 500,
    reservedQuantity: 0
  },
  tags: ['wireless', 'audio', 'electronics'],
  attributes: [
    { name: 'color', value: 'black', type: 'color' },
    { name: 'battery_life', value: '30', type: 'number' }
  ],
  createdDate: new Date(),
  updatedDate: new Date()
};

const context: ValidationContext = {
  operationType: 'create',
  environment: 'production',
  validationLevel: 'strict',
  businessRules: { validateInventory: true }
};

// Validate entire product
const validationResult = await productService.validateProduct(newProduct, context);
console.log('Product validation:', validationResult.isValid);
console.log('Errors:', validationResult.errors);
console.log('Warnings:', validationResult.warnings);

// Validate single field
const priceValidation = await productService.validateFieldOnly(newProduct, 'price', context);
console.log('Price validation:', priceValidation.isValid);
```

## Key Features

- **Configurable Rules**: Business rules can be configured externally and modified without code changes
- **Field-Level Granularity**: Validate individual fields or entire entities
- **Multiple Validation Actions**: Support for rejection, warnings, and transformations
- **Context-Aware**: Validation rules can be applied based on operation context
- **Performance Optimized**: Only applicable rules are executed for each field

## Common Pitfalls

- **Rule Conflicts**: Ensure business rules don't contradict each other
- **Performance Impact**: Avoid overly complex rules that slow down validation
- **Rule Maintenance**: Keep rules organized and documented for team maintenance
- **Context Overuse**: Don't make validation overly dependent on context parameters

## Related Examples

- [Specification Pattern Implementation](./example-1.md)
- [Real-World Basic Use Cases](./use-case.md)
- [Composite Validation Strategies](../intermediate/example-1.md)