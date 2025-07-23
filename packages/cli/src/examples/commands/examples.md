# Examples Command

**Focus**: Manage and work with package examples and documentation
**Command**: `vytches-ddd examples`

## Quick Start

```bash
# Generate documentation for a package
vytches-ddd examples generate cqrs

# Generate with specific complexity
vytches-ddd examples generate cqrs --complexity intermediate

# Find examples by pattern
vytches-ddd examples find-by-tag "cqrs:saga"
```

## Core Features

### 1. Generate Package Documentation

```bash
# Generate all examples for a package
vytches-ddd examples generate cqrs
```

**Generated Output:**
```
packages/cqrs/src/examples/
├── basic/
│   ├── example-1.md         # Command Handlers
│   ├── example-2.md         # Query Handlers  
│   └── example-3.md         # Middleware Pipeline
├── intermediate/
│   ├── example-1.md         # Event Integration
│   └── example-2.md         # Policy Authorization
├── advanced/
│   ├── example-1.md         # Saga Orchestration
│   └── example-2.md         # AI-Enhanced CQRS
└── frameworks/
    └── nestjs/
        ├── basic/
        │   └── example-1.md
        └── intermediate/
            └── example-1.md
```

### 2. Targeted Generation

```bash
# Generate specific complexity level
vytches-ddd examples generate cqrs --complexity intermediate

# Generate for specific framework
vytches-ddd examples generate cqrs --framework nestjs

# Generate with LLM optimization
vytches-ddd examples generate cqrs --llm-optimized
```

**Framework-Specific Output:**
```typescript
// Generated: packages/cqrs/src/examples/frameworks/nestjs/basic/example-1.md

# NestJS CQRS Integration

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly commandBus: CommandBus) {}

  async createOrder(orderData: CreateOrderData): Promise<Order> {
    const command = new CreateOrderCommand(orderData);
    return await this.commandBus.execute(command);
  }
}
```

### 3. Bundle Generation

```bash
# Create multi-package documentation bundle
vytches-ddd examples bundle --packages cqrs,events,projections

# Bundle for specific framework
vytches-ddd examples bundle --packages cqrs,events --framework nestjs
```

**Bundle Output:**
```markdown
# CQRS + Events + Projections Bundle

## Package Overview
- @vytches-ddd/cqrs: Command Query Responsibility Segregation
- @vytches-ddd/events: Domain event handling
- @vytches-ddd/projections: Event-driven projections

## Integration Examples
[Combined examples showing how packages work together]
```

## Advanced Usage

### 4. Find Examples by Tag

```bash
# Find specific patterns
vytches-ddd examples find-by-tag "cqrs:saga"

# Multiple tags
vytches-ddd examples find-by-tag "events:integration" --max-examples 5

# With complexity filter
vytches-ddd examples find-by-tag "nestjs:enterprise" --complexity advanced
```

**Search Results:**
```
Found 3 examples matching "cqrs:saga":

1. Enterprise Saga Orchestration (advanced)
   Package: @vytches-ddd/cqrs
   File: packages/cqrs/src/examples/advanced/example-1.md
   
2. NestJS Saga Integration (intermediate)
   Package: @vytches-ddd/cqrs  
   File: packages/cqrs/src/examples/frameworks/nestjs/intermediate/example-2.md

3. Distributed Transaction Patterns (advanced)
   Package: @vytches-ddd/messaging
   File: packages/messaging/src/examples/advanced/example-1.md
```

### 5. Validation and Quality Control

```bash
# Validate examples in a package
vytches-ddd examples validate --package cqrs

# Validate and fix issues
vytches-ddd examples validate --package cqrs --fix

# Validate all packages
vytches-ddd examples validate --all
```

**Validation Output:**
```
✅ packages/cqrs/src/examples/basic/example-1.md - Valid
⚠️  packages/cqrs/src/examples/basic/example-2.md - Missing import statements
❌ packages/cqrs/src/examples/advanced/example-1.md - Broken TypeScript syntax

Summary: 1 valid, 1 warning, 1 error
```

## Generation Options

### Complexity Levels
```bash
# Generate only basic examples
vytches-ddd examples generate cqrs --complexity basic

# Generate intermediate + advanced
vytches-ddd examples generate cqrs --complexity intermediate,advanced

# All complexity levels (default)
vytches-ddd examples generate cqrs
```

### Framework Targeting
```bash
# NestJS-specific examples
vytches-ddd examples generate cqrs --framework nestjs

# Multiple frameworks
vytches-ddd examples generate cqrs --framework nestjs,express

# Framework integration only
vytches-ddd examples generate cqrs --framework nestjs --complexity basic
```

### Output Customization
```bash
# Custom output location
vytches-ddd examples generate cqrs --output ./custom-docs

# Randomize examples for variety
vytches-ddd examples generate cqrs --randomize --seed "project-123"

# Limit number of examples
vytches-ddd examples generate cqrs --max-examples 5
```

## Available Options

| Option | Description | Example |
|--------|-------------|---------|
| `--complexity` | Target complexity level | `--complexity intermediate` |
| `--framework` | Framework integration | `--framework nestjs` |
| `--llm-optimized` | Optimize for LLM consumption | `--llm-optimized` |
| `--max-examples` | Limit number of examples | `--max-examples 10` |
| `--randomize` | Randomize selection | `--randomize` |
| `--seed` | Seed for reproducible randomization | `--seed "my-project"` |
| `--output` | Custom output path | `--output ./docs` |
| `--fix` | Auto-fix validation issues | `--fix` |

## Supported Packages

### Core Packages
- `core` - Meta-package with stable API
- `domain-primitives` - Base classes and errors
- `value-objects` - Value object implementations
- `aggregates` - Aggregate root patterns

### Architecture Packages  
- `cqrs` - Command Query Responsibility Segregation
- `events` - Domain event handling
- `projections` - Event-driven projections
- `messaging` - Outbox pattern and sagas

### Infrastructure Packages
- `logging` - Structured logging with DDD context
- `resilience` - Circuit breakers and retry patterns
- `validation` - Domain validation with specifications
- `policies` - Business policy engine

## Common Workflows

### 1. Package Documentation Setup
```bash
# 1. Generate core examples
vytches-ddd examples generate cqrs --complexity basic

# 2. Add framework integration
vytches-ddd examples generate cqrs --framework nestjs

# 3. Validate quality
vytches-ddd examples validate --package cqrs --fix
```

### 2. Multi-Package Integration
```bash
# 1. Generate bundle for related packages
vytches-ddd examples bundle --packages cqrs,events,projections

# 2. Find integration patterns
vytches-ddd examples find-by-tag "integration:events"

# 3. Validate cross-package examples
vytches-ddd examples validate --all
```

### 3. Custom Documentation
```bash
# 1. Generate base examples
vytches-ddd examples generate mypackage --output ./custom-docs

# 2. Customize and validate
vytches-ddd examples validate --package mypackage --fix

# 3. Create project-specific bundle
vytches-ddd examples bundle --packages mypackage,core --seed "my-company"
```

## Tips & Best Practices

- **Start with basic complexity** and add advanced examples later
- **Use framework options** when targeting specific frameworks
- **Validate frequently** to catch issues early: `--fix` saves time
- **Bundle related packages** for comprehensive documentation
- **Use seeded randomization** for consistent project documentation
- **Tag searches** help find specific patterns across packages

## Troubleshooting

**Package not found?**
```bash
vytches-ddd examples --list-packages
```

**No examples generated?**
```bash
vytches-ddd examples generate mypackage --dry-run
```

**Validation errors?**
```bash
vytches-ddd examples validate --package mypackage --verbose --fix
```