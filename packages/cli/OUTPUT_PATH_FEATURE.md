# Output Path Selection Feature

## Overview

The VytchesDDD CLI now supports flexible output path selection for generated
components, allowing users to specify custom directories for their DDD
components.

## Usage

### 1. Command Line Flag

Use the `--output` or `--output-path` flag to specify a custom output directory:

```bash
# Direct component generation with custom path
vytches-ddd generate --type aggregate --name Order --output ./modules/order/src

# Domain generation with custom path
vytches-ddd generate --domain ecommerce --output ./custom/ecommerce/src

# Alternative flag syntax
vytches-ddd generate --type entity --name Customer --output-path ./apps/customer/src
```

### 2. Interactive Mode

During interactive generation, you'll be prompted for the output path:

```bash
vytches-ddd generate --interactive

# CLI will ask:
# ? Enter output directory path (default: ./src): ./custom/path
```

### 3. Domain Selection Mode

When using bulk domain generation, you can specify the output path:

```bash
vytches-ddd generate --domain ecommerce

# CLI will ask:
# ? Enter aggregate root name: Order
# ? Enter output directory path (default: ./src): ./modules/ecommerce/src
```

### 4. Complete Domain Context Mode

Full domain generation also supports custom output paths:

```bash
vytches-ddd generate --domain ecommerce --full-domain

# CLI will ask for all components including:
# ? Enter output directory path (default: ./src): ./projects/ecommerce/src
```

## Generated Directory Structure

The CLI maintains the same DDD directory structure regardless of the output
path:

```
{output-path}/
├── domain/
│   ├── aggregates/        # {name}.aggregate.ts
│   ├── entities/          # {name}.entity.ts
│   ├── value-objects/     # {name}.value-object.ts
│   ├── specifications/    # {name}.specification.ts
│   ├── policies/         # {name}.policy.ts
│   ├── events/           # {name}.event.ts
│   └── services/         # {name}.service.ts
├── application/
│   ├── commands/         # {name}.command.ts
│   └── queries/          # {name}.query.ts
└── infrastructure/
    └── repositories/     # {name}.repository.ts

tests/                    # Mirror structure of {output-path}
├── domain/
│   ├── aggregates/      # {name}.aggregate.test.ts
│   ├── entities/        # {name}.entity.test.ts
│   └── value-objects/   # {name}.value-object.test.ts
└── application/
    ├── commands/        # {name}.command.test.ts
    └── queries/         # {name}.query.test.ts
```

## Examples

### Microservices Architecture

```bash
# Generate order service components
vytches-ddd generate --domain orders --output ./services/order-service/src

# Generate customer service components
vytches-ddd generate --domain customers --output ./services/customer-service/src

# Generate inventory service components
vytches-ddd generate --domain inventory --output ./services/inventory-service/src
```

### Monorepo Structure

```bash
# Generate components for different modules
vytches-ddd generate --type aggregate --name User --output ./packages/user-management/src
vytches-ddd generate --type aggregate --name Product --output ./packages/catalog/src
vytches-ddd generate --type aggregate --name Order --output ./packages/ordering/src
```

### Feature-Based Structure

```bash
# Generate by feature
vytches-ddd generate --domain checkout --output ./features/checkout/src
vytches-ddd generate --domain payment --output ./features/payment/src
vytches-ddd generate --domain shipping --output ./features/shipping/src
```

## Summary Display

The CLI now shows the selected output path in all summary displays:

```
📋 Component Generation Summary

  Type: aggregate
  Name: Order
  Domain: ecommerce
  Framework: standalone
  Output Path: ./custom/ecommerce/src
  Tests: Yes
```

## Default Behavior

- **Default Path**: `./src` (if no path is specified)
- **Interactive Prompt**: Shows default in parentheses: `(default: ./src)`
- **Flag Override**: Command line flags override interactive prompts
- **Path Validation**: CLI automatically creates directories if they don't exist

## Benefits

1. **Flexible Architecture**: Support for microservices, monorepos, and
   feature-based structures
2. **Team Collaboration**: Consistent output paths across team members
3. **Project Organization**: Better organization of large codebases
4. **Build Integration**: Easy integration with existing build systems
5. **CI/CD Friendly**: Predictable output paths for automated workflows

## Backward Compatibility

This feature is fully backward compatible:

- Existing commands without `--output` continue to work with `./src` default
- All existing functionality remains unchanged
- No breaking changes to existing workflows

---

_The output path feature makes the VytchesDDD CLI more flexible and adaptable to
different project structures and organizational patterns._
