# Domain Builder Command

**Focus**: Interactive domain modeling with AI-assisted guidance **Command**:
`vytches-ddd domain` | `vytches-ddd domain-builder`

## Quick Start

```bash
# Start interactive domain builder
vytches-ddd domain

# Build specific domain
vytches-ddd domain OrderManagement

# Build with guided workflow
vytches-ddd domain --guided
```

## Interactive Domain Modeling

### 1. Basic Domain Building

```bash
vytches-ddd domain
```

**Interactive Flow:**

```
🎯 VytchesDDD Domain Builder

? What domain are you building? OrderManagement
? Main business focus? E-commerce order processing
? Key entities? Order, Customer, Product, Payment
? Main use cases?
  ✓ Create order
  ✓ Process payment
  ✓ Track shipment
  ✓ Handle returns

Analyzing domain context...
Generating domain structure...
```

**Generated Structure:**

```
src/domain/order-management/
├── aggregates/
│   ├── order.aggregate.ts
│   └── customer.aggregate.ts
├── entities/
│   ├── order-item.entity.ts
│   └── payment.entity.ts
├── value-objects/
│   ├── money.vo.ts
│   ├── address.vo.ts
│   └── order-status.vo.ts
├── events/
│   ├── order-created.event.ts
│   ├── payment-processed.event.ts
│   └── order-shipped.event.ts
├── commands/
│   ├── create-order.command.ts
│   └── process-payment.command.ts
├── queries/
│   └── get-order-status.query.ts
├── services/
│   └── order-processing.service.ts
├── repositories/
│   └── order.repository.ts
└── specifications/
    └── order-validation.spec.ts
```

### 2. Guided Domain Analysis

```bash
vytches-ddd domain --guided
```

**AI-Assisted Questions:**

```
🧠 Domain Analysis Assistant

? What business problem are you solving?
> "We need to manage customer orders from creation to delivery"

💡 AI Suggestion: I detect an Order Management domain with these patterns:
   - Order aggregate with lifecycle management
   - Payment subdomain integration
   - Shipping and fulfillment tracking
   - Customer relationship management

? Does this analysis match your needs? Yes

? Should I include these suggested patterns?
  ✓ Order state machine (Created → Paid → Shipped → Delivered)
  ✓ Payment integration with external services
  ✓ Inventory checking and reservation
  ✓ Customer notification system

Generating optimized domain structure...
```

### 3. Domain Refinement

```bash
# Refine existing domain
vytches-ddd domain OrderManagement --refine

# Add missing patterns
vytches-ddd domain OrderManagement --analyze-gaps
```

**Gap Analysis Output:**

```
🔍 Domain Analysis: OrderManagement

Current Structure:
✅ Order aggregate - Complete
✅ Customer aggregate - Complete
⚠️  Payment handling - Missing error handling
❌ Shipping integration - Not implemented
❌ Audit trail - Missing
❌ Business policies - Missing validation rules

Recommendations:
1. Add PaymentFailedEvent and compensation logic
2. Implement ShippingService with tracking
3. Add AuditLogAggregate for compliance
4. Create OrderValidationPolicy for business rules

? Apply these recommendations? Yes
```

## Advanced Features

### 4. Domain Templates

```bash
# Use predefined domain template
vytches-ddd domain --template ecommerce

# Enterprise template with full patterns
vytches-ddd domain --template enterprise --domain OrderManagement
```

**Available Templates:**

- `ecommerce` - Online retail patterns
- `fintech` - Financial services patterns
- `healthcare` - Patient and care management
- `enterprise` - Full enterprise patterns
- `saas` - Multi-tenant SaaS patterns
- `iot` - IoT device management

### 5. Context Mapping

```bash
# Map relationships between domains
vytches-ddd domain --context-map

# Analyze cross-domain dependencies
vytches-ddd domain OrderManagement --analyze-dependencies
```

**Context Map Output:**

```
📊 Context Map Analysis

Domains Detected:
┌─────────────────┬──────────────────┬─────────────────┐
│ Domain          │ Relationship     │ Integration     │
├─────────────────┼──────────────────┼─────────────────┤
│ OrderManagement │ Customer-Supplier│ Events/Commands │
│ ↔ Inventory     │                  │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ OrderManagement │ Conformist       │ ACL Layer       │
│ ← PaymentGateway│                  │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ OrderManagement │ Shared Kernel    │ Domain Events   │
│ ↔ Shipping      │                  │                 │
└─────────────────┴──────────────────┴─────────────────┘

Recommendations:
- Add OrderInventoryACL for inventory integration
- Implement PaymentGatewayACL for external payment processing
- Create shared OrderShippedEvent for shipping domain
```

### 6. Domain Validation

```bash
# Validate domain consistency
vytches-ddd domain OrderManagement --validate

# Check DDD patterns compliance
vytches-ddd domain OrderManagement --check-patterns
```

**Validation Results:**

```
🔍 Domain Validation: OrderManagement

DDD Pattern Compliance:
✅ Aggregates have clear boundaries
✅ Entities have identity and lifecycle
✅ Value objects are immutable
⚠️  Domain services - Some business logic in aggregates
❌ Repository pattern - Missing interfaces
❌ Domain events - Not consistently used

Business Rules Validation:
✅ Order cannot be modified after payment
⚠️  Customer can have unlimited orders (business rule unclear)
❌ Order total calculation - Missing tax calculation

Architectural Compliance:
✅ Dependencies point inward (clean architecture)
⚠️  Some aggregates have circular references
❌ Missing anti-corruption layers for external services

Score: 75/100 (Good - needs improvement)
```

## Code Generation Integration

### 7. Generate from Domain Model

```bash
# Generate all components for domain
vytches-ddd domain OrderManagement --generate-all

# Generate specific patterns
vytches-ddd domain OrderManagement --generate commands,events,repositories
```

**Generated Code Example:**

```typescript
// Generated: src/domain/order-management/commands/create-order.command.ts
export class CreateOrderCommand extends Command {
  constructor(
    public readonly customerId: string,
    public readonly items: OrderItemData[],
    public readonly shippingAddress: Address,
    public readonly paymentMethod: PaymentMethod
  ) {
    super();
  }
}

// Generated: src/domain/order-management/aggregates/order.aggregate.ts
export class OrderAggregate extends AggregateRoot {
  private constructor(
    id: string,
    private customerId: string,
    private items: OrderItem[],
    private status: OrderStatus
  ) {
    super(id);
  }

  static create(command: CreateOrderCommand): OrderAggregate {
    const order = new OrderAggregate(
      generateId(),
      command.customerId,
      command.items.map(data => OrderItem.create(data)),
      OrderStatus.CREATED
    );

    order.addDomainEvent(
      new OrderCreatedEvent(order.id, order.customerId, order.calculateTotal())
    );

    return order;
  }
}
```

## Available Options

| Option           | Description                  | Example                |
| ---------------- | ---------------------------- | ---------------------- |
| `--guided`       | AI-assisted domain analysis  | `--guided`             |
| `--template`     | Use predefined template      | `--template ecommerce` |
| `--refine`       | Refine existing domain       | `--refine`             |
| `--context-map`  | Analyze domain relationships | `--context-map`        |
| `--validate`     | Validate domain patterns     | `--validate`           |
| `--generate-all` | Generate all components      | `--generate-all`       |
| `--analyze-gaps` | Find missing patterns        | `--analyze-gaps`       |
| `--interactive`  | Interactive mode             | `--interactive`        |

## Common Workflows

### 1. New Domain from Scratch

```bash
# 1. Start with guided analysis
vytches-ddd domain --guided

# 2. Refine based on feedback
vytches-ddd domain MyDomain --refine --analyze-gaps

# 3. Generate implementation
vytches-ddd domain MyDomain --generate-all

# 4. Validate final structure
vytches-ddd domain MyDomain --validate --check-patterns
```

### 2. Existing Domain Enhancement

```bash
# 1. Analyze current domain
vytches-ddd domain ExistingDomain --analyze-gaps

# 2. Apply recommendations
vytches-ddd domain ExistingDomain --refine

# 3. Generate missing components
vytches-ddd domain ExistingDomain --generate commands,policies

# 4. Validate improvements
vytches-ddd domain ExistingDomain --validate
```

### 3. Multi-Domain Architecture

```bash
# 1. Map domain relationships
vytches-ddd domain --context-map

# 2. Build each domain with context
vytches-ddd domain OrderManagement --template ecommerce
vytches-ddd domain UserManagement --template enterprise

# 3. Validate cross-domain integration
vytches-ddd domain --validate --analyze-dependencies
```

## Domain Templates

### E-commerce Template

```bash
vytches-ddd domain --template ecommerce
```

**Includes**: Order management, cart, checkout, inventory, customer

### Enterprise Template

```bash
vytches-ddd domain --template enterprise
```

**Includes**: Full DDD patterns, audit, security, multi-tenancy

### FinTech Template

```bash
vytches-ddd domain --template fintech
```

**Includes**: Account management, transactions, risk assessment, compliance

## Tips & Best Practices

- **Start with guided mode** for new domains: `--guided`
- **Use templates** as starting points for common patterns
- **Validate frequently** during development: `--validate`
- **Analyze gaps** before considering domain complete: `--analyze-gaps`
- **Map contexts early** in multi-domain projects: `--context-map`
- **Refine iteratively** based on business feedback: `--refine`

## Troubleshooting

**Domain analysis stuck?**

```bash
vytches-ddd domain --interactive --debug
```

**Missing patterns?**

```bash
vytches-ddd domain MyDomain --analyze-gaps --verbose
```

**Validation errors?**

```bash
vytches-ddd domain MyDomain --validate --check-patterns --debug
```
