# LLM-Friendly Documentation Guide

This guide provides standards and best practices for creating documentation that
is optimized for both human developers and AI assistants (LLMs) in the
VytchesDDD ecosystem.

> **Note:** This guide implements the decisions documented in
> [ADR-0013: Enterprise Documentation Standards and LLM Optimization](../adr/0013-enterprise-documentation-standards-and-llm-optimization.md).

## Table of Contents

- [Philosophy](#philosophy)
- [Structured Metadata](#structured-metadata)
- [Documentation Patterns](#documentation-patterns)
- [Code Examples](#code-examples)
- [API Documentation](#api-documentation)
- [Context and Relationships](#context-and-relationships)
- [Testing and Validation](#testing-and-validation)
- [Automation](#automation)

## Philosophy

The VytchesDDD documentation follows these principles for AI-friendly
documentation:

1. **Structured Consistency**: Use consistent patterns that LLMs can recognize
   and learn from
2. **Complete Context**: Provide full context for each feature, including when
   and why to use it
3. **Executable Examples**: All code examples should be complete and runnable
4. **Relationship Mapping**: Clearly show how components relate to each other
5. **Pattern Recognition**: Use repeatable patterns for similar concepts across
   packages

## Structured Metadata

### Package Metadata

Every package README should include structured metadata at the top:

```markdown
<!-- LLM-METADATA
Package: @vytches/ddd-package-name
Category: Foundation|Patterns|Architecture|Integration|Infrastructure|Utility
Purpose: Brief description of what the package does
Dependencies: List of key dependencies
Peer Dependencies: List of peer dependencies
Complexity: Low|Medium|High
DDD Patterns: List of DDD patterns implemented
Integration Points: List of other packages this integrates with
-->
```

### API Metadata

For each major API component, include metadata:

```typescript
/**
 * @llm-metadata
 * @category Core|Utility|Pattern|Integration
 * @purpose Brief description of what this does
 * @ddd-pattern Aggregate|Entity|ValueObject|DomainService|Repository|etc
 * @complexity Low|Medium|High
 * @usage-frequency High|Medium|Low
 * @integration-points List of related classes/interfaces
 * @example-context Brief context for when to use this
 */
export class ExampleClass {
  // Implementation
}
```

### Example Metadata

For code examples, include context metadata:

```typescript
/**
 * @example-metadata
 * @scenario Basic Usage|Advanced Usage|Integration|Testing
 * @complexity Low|Medium|High
 * @prerequisites What knowledge/setup is required
 * @outcome What the example demonstrates
 * @next-steps What to do after this example
 */
```

## Documentation Patterns

### 1. Consistent Structure Pattern

Every concept should be documented using this pattern:

````markdown
### [Concept Name]

[Brief description of what it is]

**When to use:**

- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

**Key benefits:**

- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

**Example:**

```typescript
// Complete, runnable example
import { ExampleClass } from '@vytches/ddd-package-name';

// Setup
const instance = new ExampleClass();

// Usage
const result = instance.method();

// Result handling
if (result.isSuccess()) {
  // Success case
} else {
  // Error case
}
```
````

**Related concepts:**

- [Link to related concept 1]
- [Link to related concept 2]

````

### 2. Pattern Recognition Structure

Use consistent naming and structure that LLMs can recognize:

```typescript
// Always use this pattern for factory methods
static create(data: CreateData): Result<EntityType, Error>

// Always use this pattern for business operations
performOperation(input: InputType): Result<OutputType, Error>

// Always use this pattern for validation
validate(data: DataType): ValidationResult

// Always use this pattern for event handling
handle(event: EventType): Promise<void>
````

### 3. Integration Pattern

Show how each package integrates with others:

```typescript
// Pattern: Show imports first
import { AggregateRoot } from '@vytches/ddd-aggregates';
import { DomainEvent } from '@vytches/ddd-events';
import { CommandHandler } from '@vytches/ddd-cqrs';

// Pattern: Show the relationship
class Order extends AggregateRoot {
  static create(data: OrderData): Order {
    const order = new Order(data);

    // Show event integration
    order.addDomainEvent(new OrderCreatedEvent(data));

    return order;
  }
}

// Pattern: Show handler integration
@CommandHandler(CreateOrderCommand)
class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<void> {
    // Show aggregate integration
    const order = Order.create(command.orderData);

    // Show repository integration
    await this.orderRepository.save(order);
  }
}
```

## Code Examples

### Complete Examples

All code examples should be complete and runnable:

```typescript
// ✅ Good: Complete example with all necessary imports
import { OrderAggregate, OrderItem } from '@vytches/ddd-aggregates';
import { Money } from '@vytches/ddd-value-objects';
import { EntityId } from '@vytches/ddd-core';
import { Result } from '@vytches/ddd-utils';

// Complete working example
const order = OrderAggregate.create(EntityId.create());

const addItemResult = order.addItem(
  new OrderItem(
    EntityId.create(),
    'Product Name',
    Money.create(29.99, 'USD'),
    2
  )
);

if (addItemResult.isSuccess()) {
  const confirmResult = order.confirm();

  if (confirmResult.isSuccess()) {
    console.log('Order confirmed:', order.getId().value);
  } else {
    console.error('Cannot confirm order:', confirmResult.error.message);
  }
} else {
  console.error('Cannot add item:', addItemResult.error.message);
}
```

### Progressive Examples

Show progression from basic to advanced:

```typescript
// Basic usage
const user = User.create('John Doe', 'john@example.com');

// Intermediate usage with validation
const userResult = User.create('John Doe', 'john@example.com');
if (userResult.isFailure()) {
  throw userResult.error;
}
const user = userResult.value;

// Advanced usage with full domain integration
@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    const userResult = User.create(command.name, command.email);

    if (userResult.isFailure()) {
      throw new ValidationError(userResult.error.message);
    }

    const user = userResult.value;

    // Add business logic
    user.activate();

    // Save through repository
    await this.userRepository.save(user);

    // Publish integration event
    await this.eventBus.publish(new UserCreatedEvent(user.getId().value));
  }
}
```

## API Documentation

### Function Documentation

````typescript
/**
 * Creates a new order with the specified items and customer information.
 *
 * This method implements the Order Creation use case from the Order Management
 * bounded context. It validates the input data, creates the order aggregate,
 * and returns a Result type for proper error handling.
 *
 * @param customerId - The unique identifier of the customer placing the order
 * @param items - Array of order items with product details and quantities
 * @param shippingAddress - The shipping address for the order
 * @returns Result containing the created Order or validation errors
 *
 * @example
 * ```typescript
 * const result = OrderService.createOrder(
 *   EntityId.create(),
 *   [
 *     { productId: EntityId.create(), quantity: 2, price: Money.create(29.99, 'USD') }
 *   ],
 *   new Address('123 Main St', 'City', 'State', '12345')
 * );
 *
 * if (result.isSuccess()) {
 *   console.log('Order created:', result.value.getId().value);
 * } else {
 *   console.error('Order creation failed:', result.error.message);
 * }
 * ```
 *
 * @throws {ValidationError} When input data is invalid
 * @throws {BusinessRuleError} When business rules are violated
 *
 * @since 1.0.0
 * @category Core
 * @ddd-pattern Domain Service
 * @complexity Medium
 */
static createOrder(
  customerId: EntityId,
  items: OrderItemData[],
  shippingAddress: Address
): Result<Order, Error> {
  // Implementation
}
````

### Class Documentation

````typescript
/**
 * Represents an Order aggregate root in the Order Management bounded context.
 *
 * The Order aggregate maintains consistency for all order-related operations
 * including item management, status changes, and payment processing. It
 * implements the Aggregate Root pattern from Domain-Driven Design.
 *
 * @example
 * ```typescript
 * // Create a new order
 * const order = Order.create(customerId, items, shippingAddress);
 *
 * // Add items
 * const addResult = order.addItem(productId, quantity, price);
 *
 * // Confirm the order
 * const confirmResult = order.confirm();
 *
 * // Handle domain events
 * const events = order.getUncommittedEvents();
 * ```
 *
 * @public
 * @since 1.0.0
 * @category Aggregate
 * @ddd-pattern Aggregate Root
 * @complexity High
 * @integration-points OrderRepository, OrderItem, OrderStatus, DomainEvent
 */
export class Order extends AggregateRoot {
  // Implementation
}
````

## Context and Relationships

### Relationship Documentation

Always document how components relate to each other:

```typescript
/**
 * Order Management Domain Model Relationships
 *
 * Core Entities:
 * - Order (Aggregate Root)
 *   ├── OrderItem (Entity)
 *   ├── OrderStatus (Value Object)
 *   └── ShippingAddress (Value Object)
 *
 * Domain Events:
 * - OrderCreatedEvent → triggers inventory reservation
 * - OrderConfirmedEvent → triggers payment processing
 * - OrderShippedEvent → triggers notification sending
 *
 * Integration Points:
 * - OrderRepository → for persistence
 * - PaymentService → for payment processing
 * - InventoryService → for stock management
 * - NotificationService → for customer updates
 *
 * Business Rules:
 * - Order must have at least one item
 * - Order total must be positive
 * - Order can only be confirmed if payment is processed
 * - Order can only be shipped if confirmed
 */
```

### Usage Context

Provide context for when to use each feature:

```typescript
/**
 * When to use OrderAggregate:
 *
 * ✅ Use when:
 * - Managing order lifecycle (create, confirm, ship, cancel)
 * - Enforcing order business rules
 * - Tracking order state changes
 * - Publishing order-related domain events
 *
 * ❌ Don't use when:
 * - Querying order data for reports (use read models)
 * - Bulk operations across multiple orders
 * - Simple data transfer operations
 * - Integration with external systems (use ACL)
 *
 * Related patterns:
 * - Use OrderRepository for persistence
 * - Use OrderService for complex business logic
 * - Use OrderProjection for queries
 * - Use OrderEvent for integration
 */
```

## Testing and Validation

### Test Examples

Include test examples that show expected behavior:

```typescript
/**
 * @test-example
 * @scenario Order Creation
 * @category Unit Test
 */
describe('Order Creation', () => {
  it('should create order with valid data', () => {
    // Arrange
    const customerId = EntityId.create();
    const items = [
      {
        productId: EntityId.create(),
        quantity: 2,
        price: Money.create(29.99, 'USD'),
      },
    ];
    const address = new Address('123 Main St', 'City', 'State', '12345');

    // Act
    const result = Order.create(customerId, items, address);

    // Assert
    expect(result.isSuccess()).toBe(true);
    expect(result.value.getItems()).toHaveLength(1);
    expect(result.value.getStatus()).toBe(OrderStatus.PENDING);
  });

  it('should fail with empty items', () => {
    // Arrange
    const customerId = EntityId.create();
    const items: OrderItemData[] = [];
    const address = new Address('123 Main St', 'City', 'State', '12345');

    // Act
    const result = Order.create(customerId, items, address);

    // Assert
    expect(result.isFailure()).toBe(true);
    expect(result.error.message).toBe('Order must have at least one item');
  });
});
```

### Validation Examples

Show how to validate usage:

```typescript
/**
 * @validation-example
 * @scenario Input Validation
 */
// Validate before using
const validateOrderData = (data: OrderData): ValidationResult => {
  const errors: string[] = [];

  if (!data.customerId) {
    errors.push('Customer ID is required');
  }

  if (!data.items || data.items.length === 0) {
    errors.push('Order must have at least one item');
  }

  if (data.items.some(item => item.quantity <= 0)) {
    errors.push('All items must have positive quantity');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Usage with validation
const validation = validateOrderData(orderData);
if (!validation.isValid) {
  throw new ValidationError(validation.errors.join(', '));
}

const order = Order.create(
  orderData.customerId,
  orderData.items,
  orderData.address
);
```

## Automation

### Documentation Generation

Use these tools to maintain documentation quality:

```bash
# Generate TypeDoc documentation
pnpm exec typedoc --out docs/api src/index.ts

# Validate markdown
pnpm exec markdownlint "**/*.md"

# Check for broken links
pnpm exec markdown-link-check "**/*.md"

# Spell check
pnpm exec cspell "**/*.md" "**/*.ts"

# Generate API documentation with metadata
pnpm exec api-extractor run --config api-extractor.json
```

### Metadata Validation

Create scripts to validate metadata:

```typescript
// validate-metadata.ts
import { readFileSync } from 'fs';
import { glob } from 'glob';

interface PackageMetadata {
  package: string;
  category: string;
  purpose: string;
  complexity: 'Low' | 'Medium' | 'High';
}

const validatePackageMetadata = (filePath: string): boolean => {
  const content = readFileSync(filePath, 'utf-8');
  const metadataMatch = content.match(/<!-- LLM-METADATA([\s\S]*?)-->/);

  if (!metadataMatch) {
    console.error(`Missing LLM-METADATA in ${filePath}`);
    return false;
  }

  const metadata = metadataMatch[1];
  const required = ['Package:', 'Category:', 'Purpose:', 'Complexity:'];

  for (const field of required) {
    if (!metadata.includes(field)) {
      console.error(`Missing ${field} in ${filePath}`);
      return false;
    }
  }

  return true;
};

// Validate all package README files
const files = glob.sync('packages/*/README.md');
const allValid = files.every(validatePackageMetadata);

if (!allValid) {
  process.exit(1);
}
```

### AI-Friendly Checklist

Use this checklist to ensure documentation is AI-friendly:

- [ ] Structured metadata included
- [ ] Consistent patterns used
- [ ] Complete, runnable examples provided
- [ ] Relationships clearly documented
- [ ] Context for usage provided
- [ ] Error handling shown
- [ ] Integration patterns demonstrated
- [ ] Test examples included
- [ ] Validation examples provided
- [ ] Links to related concepts included
- [ ] JSDoc comments complete
- [ ] Type definitions fully documented
- [ ] Performance characteristics mentioned
- [ ] Migration guides provided (if applicable)
- [ ] Troubleshooting section included

This guide ensures that VytchesDDD documentation is optimized for both human
developers and AI assistants, enabling better code generation, understanding,
and assistance.
