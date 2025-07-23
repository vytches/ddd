# Contracts Example Types

This directory contains type definitions used across all package examples. These
are provided as Markdown documentation files that can be referenced in examples.

## Available Type Files

### Core Types

- [types.md](./types.md) - Example configuration types and interfaces
- [base-types.md](./base-types.md) - Shared fundamental types (entities, value
  objects, results)

## Usage in Examples

When creating examples, reference these types as imports:

```typescript
// Import from your application
import { User, Product, Order } from './types';
import { Result, Money, EntityId } from './base-types';
```

## Type Organization

1. **Configuration Types** (`types.md`):

   - PackageExampleConfig
   - ExampleDefinition
   - FrameworkConfig
   - etc.

2. **Base Types** (`base-types.md`):

   - BaseEntity
   - Money
   - EntityId
   - Result
   - BaseDomainEvent
   - ValidationResult
   - ServiceResponse
   - etc.

3. **Package-Specific Types**: Each package maintains its own types in
   `examples/types/`:
   - domain-services: user.md, product.md, order.md
   - di: services.md, config.md
   - etc.

## Philosophy

These type definitions serve as documentation and reference for examples. They
show the expected structure of application types that would integrate with the
library. In real applications, developers would use their own type definitions
that match these interfaces.
