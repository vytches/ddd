# Generate Command

**Focus**: Generate DDD components with intelligent templates **Command**:
`vytches-ddd generate` | `vytches-ddd g`

## Quick Start

```bash
# Generate aggregate
vytches-ddd generate aggregate User

# Generate with domain context
vytches-ddd generate aggregate Order --domain OrderManagement

# Generate complete domain
vytches-ddd generate domain UserManagement
```

## Core Components

### 1. Aggregate Generation

```bash
vytches-ddd generate aggregate User --domain UserManagement
```

**Generated Output:**

```typescript
// src/domain/user-management/user.aggregate.ts
import { AggregateRoot } from '@vytches-ddd/core';

export class UserAggregate extends AggregateRoot {
  constructor(
    public readonly id: string,
    private name: string,
    private email: string
  ) {
    super(id);
  }

  // Business methods generated based on domain analysis
  updateProfile(name: string, email: string): void {
    this.name = name;
    this.email = email;

    this.addDomainEvent(
      new UserProfileUpdatedEvent(this.id, this.name, this.email)
    );
  }
}
```

### 2. Value Object Generation

```bash
vytches-ddd generate value-object Email --domain UserManagement
```

**Generated Output:**

```typescript
// src/domain/user-management/value-objects/email.vo.ts
import { ValueObject } from '@vytches-ddd/core';

export class Email extends ValueObject<string> {
  constructor(value: string) {
    super(Email.validate(value));
  }

  private static validate(email: string): string {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase();
  }

  get domain(): string {
    return this.value.split('@')[1];
  }
}
```

### 3. Domain Service Generation

```bash
vytches-ddd generate domain-service UserRegistration --domain UserManagement
```

**Generated Output:**

```typescript
// src/domain/user-management/services/user-registration.service.ts
import { DomainService } from '@vytches-ddd/di';

@DomainService('userRegistrationService', {
  context: 'UserManagement',
  lifetime: 'scoped',
})
export class UserRegistrationService {
  async registerUser(name: string, email: string): Promise<UserAggregate> {
    // Domain logic for user registration
    const user = new UserAggregate(generateId(), name, email);

    // Business rules validation
    await this.validateRegistrationRules(user);

    return user;
  }
}
```

## Advanced Options

### Domain Context Generation

```bash
# Generate complete bounded context
vytches-ddd generate domain OrderManagement --interactive
```

**Interactive Prompts:**

- Domain name: `OrderManagement`
- Main aggregate: `Order`
- Entities: `OrderItem`, `Customer`
- Value objects: `Money`, `Address`
- Events: `OrderCreated`, `OrderShipped`
- Include repository? `Yes`
- Include ACL? `Yes`

**Generated Structure:**

```
src/domain/order-management/
├── order.aggregate.ts
├── entities/
│   ├── order-item.entity.ts
│   └── customer.entity.ts
├── value-objects/
│   ├── money.vo.ts
│   └── address.vo.ts
├── events/
│   ├── order-created.event.ts
│   └── order-shipped.event.ts
├── services/
│   └── order-management.service.ts
├── repositories/
│   └── order.repository.ts
└── acl/
    └── order-management.acl.ts
```

### Template Customization

```bash
# Use custom template
vytches-ddd generate aggregate User --template custom-aggregate

# Generate with specific framework
vytches-ddd generate aggregate User --framework nestjs
```

## Common Options

| Option          | Description                | Example                   |
| --------------- | -------------------------- | ------------------------- |
| `--domain`      | Bounded context name       | `--domain UserManagement` |
| `--output`      | Custom output directory    | `--output ./src/modules`  |
| `--template`    | Custom template name       | `--template enterprise`   |
| `--framework`   | Target framework           | `--framework nestjs`      |
| `--interactive` | Interactive mode           | `--interactive`           |
| `--dry-run`     | Preview without generating | `--dry-run`               |

## Component Types

### Available Components

- `aggregate` - Domain aggregates with business logic
- `entity` - Domain entities
- `value-object` - Immutable value objects
- `domain-service` - Domain services with business logic
- `repository` - Data access repositories
- `event` - Domain events
- `command` - CQRS commands
- `query` - CQRS queries
- `policy` - Business policies
- `specification` - Domain specifications
- `acl` - Anti-corruption layers
- `saga` - Long-running processes

### Framework Integration

- `nestjs` - NestJS controllers, modules, DTOs
- `express` - Express routes and middleware
- `fastify` - Fastify routes and schemas

## Quick Workflows

### 1. New Feature Development

```bash
# 1. Generate core aggregate
vytches-ddd g aggregate Order --domain OrderManagement

# 2. Generate supporting components
vytches-ddd g repository Order --domain OrderManagement
vytches-ddd g domain-service OrderProcessing --domain OrderManagement

# 3. Generate events and commands
vytches-ddd g event OrderCreated --domain OrderManagement
vytches-ddd g command CreateOrder --domain OrderManagement
```

### 2. Complete Domain Setup

```bash
# Generate everything at once
vytches-ddd g domain OrderManagement --interactive

# Or step by step
vytches-ddd g aggregate Order --domain OrderManagement
vytches-ddd g value-object Money --domain OrderManagement
vytches-ddd g event OrderCreated --domain OrderManagement
vytches-ddd g repository Order --domain OrderManagement
```

## Tips & Best Practices

- **Use interactive mode** for complex domains: `--interactive`
- **Preview first** with `--dry-run` before generating
- **Follow naming conventions**: PascalCase for components, kebab-case for
  domains
- **Group related components** in the same domain context
- **Use framework options** when targeting specific frameworks
- **Customize templates** for consistent project patterns

## Troubleshooting

**Component not found?**

```bash
vytches-ddd g --list-components
```

**Template issues?**

```bash
vytches-ddd g --list-templates
```

**Preview generation:**

```bash
vytches-ddd g aggregate User --dry-run
```
