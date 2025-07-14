# VytchesDDD CLI - Enterprise Naming Conventions

## Overview

The VytchesDDD CLI follows enterprise-grade naming conventions that ensure consistency, clarity, and alignment with Domain-Driven Design principles across all generated components.

## File Naming Conventions

### Pattern: `{base-name}.{component-type}.ts`

All generated files follow a consistent pattern that makes their purpose immediately clear:

| Component Type | File Name Pattern | Example |
|----------------|------------------|---------|
| **Aggregate** | `{name}.aggregate.ts` | `customer.aggregate.ts` |
| **Entity** | `{name}.entity.ts` | `order.entity.ts` |
| **Value Object** | `{name}.value-object.ts` | `email-address.value-object.ts` |
| **Specification** | `{name}.specification.ts` | `customer-validation.specification.ts` |
| **Policy** | `{name}.policy.ts` | `pricing.policy.ts` |
| **Command** | `{name}.command.ts` | `create-customer.command.ts` |
| **Query** | `{name}.query.ts` | `get-customer.query.ts` |
| **Event** | `{name}.event.ts` | `customer-created.event.ts` |
| **Repository** | `{name}.repository.ts` | `customer.repository.ts` |
| **Domain Service** | `{name}.service.ts` | `pricing.service.ts` |

### Test Files: `{base-name}.{component-type}.test.ts`

Test files follow the same pattern with an additional `.test` suffix:

| Component Type | Test File Pattern | Example |
|----------------|------------------|---------|
| **Aggregate** | `{name}.aggregate.test.ts` | `customer.aggregate.test.ts` |
| **Entity** | `{name}.entity.test.ts` | `order.entity.test.ts` |
| **Value Object** | `{name}.value-object.test.ts` | `email-address.value-object.test.ts` |

## Class Naming Conventions

### Pattern: `{PascalCaseName}{Suffix}`

Class names use PascalCase with appropriate DDD suffixes:

| Component Type | Class Name Pattern | Example |
|----------------|------------------|---------|
| **Aggregate** | `{Name}` | `Customer` (extends AggregateRoot) |
| **Entity** | `{Name}` | `Order` (extends Entity) |
| **Value Object** | `{Name}` | `EmailAddress` (extends ValueObject) |
| **Specification** | `{Name}Specification` | `CustomerValidationSpecification` |
| **Policy** | `{Name}Policy` | `PricingPolicy` |
| **Command** | `{Name}Command` | `CreateCustomerCommand` |
| **Query** | `{Name}Query` | `GetCustomerQuery` |
| **Event** | `{Name}Event` | `CustomerCreatedEvent` |
| **Repository** | `{Name}Repository` | `CustomerRepository` |
| **Domain Service** | `{Name}Service` | `PricingService` |

## Directory Structure Conventions

Components are organized following Clean Architecture and DDD principles:

```
src/
├── domain/
│   ├── aggregates/           # customer.aggregate.ts
│   ├── entities/            # order.entity.ts
│   ├── value-objects/       # email-address.value-object.ts
│   ├── specifications/      # customer-validation.specification.ts
│   ├── policies/           # pricing.policy.ts
│   ├── events/             # customer-created.event.ts
│   └── services/           # pricing.service.ts
├── application/
│   ├── commands/           # create-customer.command.ts
│   └── queries/            # get-customer.query.ts
└── infrastructure/
    └── repositories/       # customer.repository.ts

tests/                      # Mirror structure of src/
├── domain/
│   ├── aggregates/        # customer.aggregate.test.ts
│   ├── entities/          # order.entity.test.ts
│   └── value-objects/     # email-address.value-object.test.ts
└── application/
    ├── commands/          # create-customer.command.test.ts
    └── queries/           # get-customer.query.test.ts
```

## Benefits of These Conventions

### 1. **Immediate Component Recognition**
- File names instantly communicate the component type and purpose
- No need to open files to understand their role in the domain

### 2. **Consistent Sorting and Grouping**
- Components of the same type naturally group together in file explorers
- Alphabetical sorting maintains logical organization

### 3. **IDE Integration**
- Modern IDEs can provide better autocomplete and navigation
- File search becomes more predictable and efficient

### 4. **Team Collaboration**
- New team members can quickly understand the codebase structure
- Code reviews become more efficient with clear naming patterns

### 5. **DDD Alignment**
- Naming conventions directly reflect DDD concepts
- Enforces proper separation of concerns

## Example Generation Commands

```bash
# Generates: customer.aggregate.ts with CustomerAggregate class
vytches-ddd generate --type aggregate --name Customer

# Generates: email-address.value-object.ts with EmailAddress class
vytches-ddd generate --type value-object --name EmailAddress

# Generates: create-customer.command.ts with CreateCustomerCommand class
vytches-ddd generate --type command --name CreateCustomer

# Generates: customer-created.event.ts with CustomerCreatedEvent class
vytches-ddd generate --type event --name CustomerCreated
```

## Input Transformation Examples

The CLI automatically handles name transformations:

| Input | Component Type | File Name | Class Name |
|-------|---------------|-----------|------------|
| `Customer` | aggregate | `customer.aggregate.ts` | `Customer` |
| `EmailAddress` | value-object | `email-address.value-object.ts` | `EmailAddress` |
| `CreateCustomer` | command | `create-customer.command.ts` | `CreateCustomerCommand` |
| `customer-created` | event | `customer-created.event.ts` | `CustomerCreatedEvent` |

## Migration from Previous Versions

If you have existing components with different naming patterns, the CLI will generate new files with the correct conventions. You can:

1. **Gradual Migration**: Generate new components with correct naming
2. **Bulk Rename**: Use IDE refactoring tools to rename existing files
3. **Automated Migration**: Use the CLI's migration tools (future feature)

## Validation and Quality Assurance

The CLI automatically validates:

- ✅ Component names are valid TypeScript identifiers
- ✅ File names follow kebab-case conventions
- ✅ Class names follow PascalCase conventions
- ✅ Directory structure matches DDD principles
- ✅ No naming conflicts within the same domain

## Framework-Specific Adaptations

The naming conventions remain consistent across all supported frameworks:

- **Standalone**: Standard TypeScript conventions
- **NestJS**: Adds appropriate decorators while maintaining naming
- **Express**: Compatible with Express routing patterns
- **Fastify**: Aligns with Fastify plugin conventions

---

*These conventions ensure that your DDD codebase remains maintainable, discoverable, and aligned with enterprise standards as it scales.*