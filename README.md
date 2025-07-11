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
- **Enterprise DI System**: Auto-discovery with context isolation and framework
  integration
- **Production-Ready**: Enterprise features like circuit breakers, resilience
  patterns, ACL
- **TypeScript Native**: Full type safety and modern TS features
- **Framework Agnostic**: Works with any framework or standalone
- **External System Isolation**: Robust Anti-Corruption Layer patterns

## 📦 Packages

| Package                                            | Version                                                       | Description                                                    |
| -------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| [@vytches-ddd/core](./packages/core)               | ![npm](https://img.shields.io/npm/v/@vytches-ddd/core)        | Core DDD building blocks (Value Objects, Entities, Aggregates) |
| [@vytches-ddd/di](./packages/di)                   | ![npm](https://img.shields.io/npm/v/@vytches-ddd/di)          | Enterprise dependency injection with auto-discovery            |
| [@vytches-ddd/utils](./packages/utils)             | ![npm](https://img.shields.io/npm/v/@vytches-ddd/utils)       | Common utilities and helpers                                   |
| [@vytches-ddd/validation](./packages/validation)   | ![npm](https://img.shields.io/npm/v/@vytches-ddd/validation)  | Business rules, specifications, and validation patterns        |
| [@vytches-ddd/policies](./packages/policies)       | ![npm](https://img.shields.io/npm/v/@vytches-ddd/policies)    | Business policies and domain policies                          |
| [@vytches-ddd/events](./packages/events)           | ![npm](https://img.shields.io/npm/v/@vytches-ddd/events)      | Event-driven architecture components                           |
| [@vytches-ddd/cqrs](./packages/cqrs)               | ![npm](https://img.shields.io/npm/v/@vytches-ddd/cqrs)        | Command Query Responsibility Segregation                       |
| [@vytches-ddd/acl](./packages/acl)                 | ![npm](https://img.shields.io/npm/v/@vytches-ddd/acl)         | Anti-Corruption Layer for external systems                     |
| [@vytches-ddd/projections](./packages/projections) | ![npm](https://img.shields.io/npm/v/@vytches-ddd/projections) | Event projections and read models                              |
| [@vytches-ddd/messaging](./packages/messaging)     | ![npm](https://img.shields.io/npm/v/@vytches-ddd/messaging)   | Outbox pattern, sagas, and messaging patterns                  |
| [@vytches-ddd/resilience](./packages/resilience)   | ![npm](https://img.shields.io/npm/v/@vytches-ddd/resilience)  | Circuit breakers, retry patterns, timeouts                     |
| [@vytches-ddd/testing](./packages/testing)         | ![npm](https://img.shields.io/npm/v/@vytches-ddd/testing)     | Test utilities for DDD patterns                                |
| [@vytches-ddd/enterprise](./packages/enterprise)   | ![npm](https://img.shields.io/npm/v/@vytches-ddd/enterprise)  | All-in-one enterprise bundle                                   |

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

### CQRS with Dependency Injection

```typescript
import {
  VytchesDDD,
  SimpleContainer,
  CommandHandler,
  DomainService,
  ServiceLifetime,
} from '@vytches-ddd/core';

// Domain Service with DI
@DomainService({
  serviceId: 'userService',
  lifetime: ServiceLifetime.Singleton,
})
class UserService {
  async createUser(email: Email): Promise<User> {
    return User.create(email);
  }
}

// Command Handler with auto-discovery
@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    // Service automatically resolved from DI container
    const userService = VytchesDDD.resolve<UserService>('userService');
    const user = await userService.createUser(new Email(command.email));
    await this.userRepository.save(user);
  }
}

// Setup DI and CQRS (one-time configuration)
const container = new SimpleContainer();
VytchesDDD.configure(container); // Auto-discovers all decorated services

// Usage - zero configuration needed
const commandBus = new CommandBus();
await commandBus.execute(new CreateUserCommand('user@example.com', 'John Doe'));
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

### Dependency Injection & Auto-Discovery

```typescript
import { VytchesDDD, SimpleContainer, DomainService } from '@vytches-ddd/core';

// Simple usage - services auto-discovered
@DomainService('notificationService')
class NotificationService {
  async sendEmail(to: string, subject: string): Promise<void> {
    // Implementation
  }
}

// Context-aware services for DDD bounded contexts
@DomainService({
  serviceId: 'orderService',
  context: 'OrderManagement',
  lifetime: ServiceLifetime.Singleton,
  dependencies: ['paymentService', 'inventoryService'],
})
class OrderService {
  processOrder(order: Order): Promise<OrderResult> {
    // Service automatically registered in OrderManagement context
    // Can access other services from same context or global container
  }
}

// One-time setup with auto-discovery
const globalContainer = new SimpleContainer();
VytchesDDD.configure(globalContainer);

// Optional: Context-specific containers for DDD isolation
const orderContainer = new SimpleContainer();
VytchesDDD.configureContext('OrderManagement', orderContainer);

// Usage - services resolved automatically
const notificationService = VytchesDDD.resolve<NotificationService>(
  'notificationService'
);
const orderService = VytchesDDD.resolve<OrderService>(
  'orderService',
  'OrderManagement'
);
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
│   ├── core/            # Core DDD building blocks
│   ├── di/              # Dependency injection system
│   ├── utils/           # Common utilities
│   ├── validation/      # Business rules and specifications
│   ├── policies/        # Business policies
│   ├── events/          # Event-driven architecture
│   ├── cqrs/            # Command Query Responsibility Segregation
│   ├── acl/             # Anti-Corruption Layer
│   ├── projections/     # Event projections
│   ├── messaging/       # Outbox pattern and messaging
│   ├── resilience/      # Circuit breakers and resilience patterns
│   ├── testing/         # Test utilities
│   └── enterprise/      # All-in-one enterprise bundle
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
