# VytchesDDD

> Enterprise-grade TypeScript library implementing Domain-Driven Design patterns
> with full event-driven architecture support.

[![CI](https://github.com/PawelGozdz/vytches-ddd/actions/workflows/ci.yml/badge.svg)](https://github.com/PawelGozdz/vytches-ddd/actions/workflows/ci.yml)
[![Release](https://github.com/PawelGozdz/vytches-ddd/actions/workflows/release.yml/badge.svg)](https://github.com/PawelGozdz/vytches-ddd/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/yourusername/vytches-ddd/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/vytches-ddd)
[![npm version](https://badge.fury.io/js/%40vytches-ddd%2Fcore.svg)](https://badge.fury.io/js/%40vytches-ddd%2Fcore)

## 🎯 Philosophy

VytchesDDD provides a complete toolkit for building scalable, maintainable
applications using tactical and strategic DDD patterns, including:

- **AI-First Design**: Documentation and structure optimized for LLM
  understanding
- **Modular Architecture**: Use only what you need, compose as required
- **Production-Ready**: Enterprise features like circuit breakers, resilience
  patterns, ACL
- **TypeScript Native**: Full type safety and modern TS features
- **Framework Agnostic**: Works with any framework or standalone
- **External System Isolation**: Robust Anti-Corruption Layer patterns

## 📦 Packages

| Package | Version | Description | | ---------|
[@vytches-ddd/core](./packages/core) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/core) | Core DDD building
blocks (Value Objects, Entities, Aggregates) | |
[@vytches-ddd/utils](./packages/utils) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/utils) | Common utilities and
helpers | | [@vytches-ddd/validation](./packages/validation) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/validation) | Business rules,
specifications, and validation patterns | |
[@vytches-ddd/policies](./packages/policies) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/policies) | Business policies
and domain policies | | [@vytches-ddd/events](./packages/events) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/events) | Event-driven
architecture components | | [@vytches-ddd/cqrs](./packages/cqrs) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/cqrs) | Command Query
Responsibility Segregation | | [@vytches-ddd/acl](./packages/acl) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/acl) | Anti-Corruption Layer
for external systems | | [@vytches-ddd/projections](./packages/projections) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/projections) | Event
projections and read models | | [@vytches-ddd/messaging](./packages/messaging) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/messaging) | Outbox pattern,
sagas, and messaging patterns | |
[@vytches-ddd/resilience](./packages/resilience) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/resilience) | Circuit breakers,
retry patterns, timeouts | | [@vytches-ddd/testing](./packages/testing) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/testing) | Test utilities for
DDD patterns | | [@vytches-ddd/enterprise](./packages/enterprise) |
![npm](https://img.shields.io/npm/v/@vytches-ddd/enterprise) | All-in-one
enterprise bundle |

## 🚀 Quick Start

### Installation

```bash
# Install core package
npm install @vytches-ddd/core

# Or install the full enterprise bundle
npm install @vytches-ddd/enterprise

# For specific features
npm install @vytches-ddd/events @vytches-ddd/cqrs @vytches-ddd/acl
```

### Basic Usage

```typescript
import {
  ValueObject,
  Entity,
  AggregateRoot,
  DomainEvent,
} from '@vytches-ddd/core';

// Value Objects
class Email extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.validate();
  }

  private validate(): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
      throw new Error('Invalid email format');
    }
  }
}

// Domain Events
class UserCreated extends DomainEvent<{
  userId: string;
  email: string;
}> {}

// Aggregates with Event Sourcing
class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    private email: Email
  ) {
    super(id);
  }

  static create(email: Email): User {
    const user = new User(UserId.create(), email);

    user.apply(
      new UserCreated({
        userId: user.getId().value,
        email: email.value,
      })
    );

    return user;
  }

  changeEmail(newEmail: Email): void {
    this.email = newEmail;
    // Events are automatically collected
  }
}
```

### CQRS Example

```typescript
import { CQRSModule, CommandHandler, QueryHandler } from '@vytches-ddd/cqrs';

// Commands
class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly name: string
  ) {}
}

// Command Handlers
@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    const user = User.create(new Email(command.email));
    await this.userRepository.save(user);
  }
}

// Setup CQRS
const cqrsModule = CQRSModule.createEnhanced();
await cqrsModule.commandBus.execute(
  new CreateUserCommand('user@example.com', 'John Doe')
);
```

### External System Integration with ACL

```typescript
import { BaseACLAdapter, BaseModelTranslator } from '@vytches-ddd/acl';

// Model Translation
class PaymentModelTranslator extends BaseModelTranslator<
  PaymentRequest,
  ExternalPaymentData
> {
  protected performToExternalTranslation(
    payment: PaymentRequest
  ): ExternalPaymentData {
    return {
      transaction_id: payment.getTransactionId().value,
      amount_cents: Math.round(payment.getAmount().value * 100),
      currency_code: payment.getCurrency().value,
    };
  }
}

// ACL Adapter
class PaymentACLAdapter extends BaseACLAdapter<
  PaymentRequest,
  ExternalPaymentData
> {
  protected registerSupportedOperations(): void {
    this.registerOperation('PROCESS_PAYMENT');
    this.registerOperation('REFUND_PAYMENT');
  }
}

// Usage in Domain Service
const result = await paymentACL.execute('PROCESS_PAYMENT', paymentRequest);
```

## 🏗️ Development

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/PawelGozdz/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Available Scripts

```bash
# Development
pnpm dev                 # Start development mode
pnpm build               # Build all packages
pnpm test                # Run all tests
pnpm test:watch          # Run tests in watch mode
pnpm lint                # Lint all packages
pnpm format              # Format code with Prettier

# Affected (only changed packages)
pnpm build:affected      # Build only affected packages
pnpm test:affected       # Test only affected packages
pnpm lint:affected       # Lint only affected packages

# Utilities
pnpm clean               # Clean all build artifacts
pnpm graph               # View dependency graph
pnpm affected:graph      # View affected packages graph

# Release
pnpm release             # Release new versions
```

### Project Structure

```
vytches-ddd/
├── packages/
│   ├── core/            # Core DDD
│   ├── utils/            # Common utilities
│   ├── validation/            # Business rules,
│   ├── policies/            # Business policies
│   ├── events/            # Event-driven architecture
│   ├── cqrs/            # Command Query
│   ├── acl/            # Anti-Corruption Layer
│   ├── projections/            # Event projections
│   ├── messaging/            # Outbox pattern,
│   ├── resilience/            # Circuit breakers,
│   ├── testing/            # Test utilities
│   ├── enterprise/            # All-in-one enterprise
├── examples/
│   ├── simple/         # Basic usage examples
│   ├── ecommerce/      # E-commerce domain example
│   └── banking/        # Banking domain example
├── tools/              # Build and development tools
└── docs/               # Documentation
```

## 📚 Documentation

- [Getting Started Guide](./docs/guides/getting-started.md)
- [Core Concepts](./docs/guides/core-concepts.md)
- [CQRS Guide](./docs/guides/cqrs.md)
- [Anti-Corruption Layer](./docs/guides/acl.md)
- [Event-Driven Architecture](./docs/guides/events.md)
- [API Reference](./docs/api/index.md)
- [Examples](./examples/)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

### Code of Conduct

This project adheres to the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## 🙏 Acknowledgments

- Inspired by Domain-Driven Design principles by Eric Evans
- Built on top of proven patterns from the enterprise software community
- Designed for modern TypeScript development practices

---

**Happy Domain Modeling!** 🚀
