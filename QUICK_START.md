# VytchesDDD - Quick Start Guide

This guide will help you get started with VytchesDDD library quickly.

## 🚀 Prerequisites

Before starting, ensure you have:

- **Node.js** >= 18.0.0 ([Download here](https://nodejs.org/))
- **pnpm** >= 8.0.0 (Install: `npm install -g pnpm`)
- **Git** installed and configured

## 📋 Getting Started

### Option 1: Clone and Use (Recommended)

```bash
# Clone the repository
git clone https://github.com/vytches/vytches-ddd.git
cd vytches-ddd

# Install dependencies
pnpm install

# Setup git hooks
pnpm prepare

# Verify installation
pnpm build
pnpm test
```

### Option 2: Install Individual Packages

```bash
# Install specific packages you need
npm install @vytches-ddd/core @vytches-ddd/events @vytches-ddd/cqrs

# Or install the complete suite
npm install @vytches-ddd/core
```

## 🔧 Verify Installation

```bash
# Development commands (if you cloned the repo)
pnpm build    # Build all packages
pnpm test     # Run tests
pnpm lint     # Check linting
pnpm dev      # Development mode

# Individual package usage
npm test      # Test your application using VytchesDDD
```

## 🏗️ Basic Usage Example

```typescript
// app.ts
import { AggregateRoot, EntityId, DomainEvent } from '@vytches-ddd/core';
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { EventBus } from '@vytches-ddd/events';

// Create a simple aggregate
class User extends AggregateRoot {
  constructor(
    id: EntityId<string>,
    private email: string,
    private name: string
  ) {
    super(id);
  }

  static create(email: string, name: string): User {
    const id = EntityId.createWithRandomUUID();
    const user = new User(id, email, name);

    // Add domain event
    user.addDomainEvent(new UserCreatedEvent(id.getValue(), email, name));

    return user;
  }
}

// Usage in your application
const user = User.create('john@example.com', 'John Doe');
console.log('User created:', user.getId().getValue());
```

## 📦 Available Packages

| Package                      | Description                              | Installation                             |
| ---------------------------- | ---------------------------------------- | ---------------------------------------- |
| `@vytches-ddd/core`          | Meta-package with all essentials         | `npm install @vytches-ddd/core`          |
| `@vytches-ddd/events`        | Event-driven architecture                | `npm install @vytches-ddd/events`        |
| `@vytches-ddd/cqrs`          | Command Query Responsibility Segregation | `npm install @vytches-ddd/cqrs`          |
| `@vytches-ddd/aggregates`    | Aggregate root patterns                  | `npm install @vytches-ddd/aggregates`    |
| `@vytches-ddd/repositories`  | Repository patterns                      | `npm install @vytches-ddd/repositories`  |
| `@vytches-ddd/value-objects` | Value object implementations             | `npm install @vytches-ddd/value-objects` |
| `@vytches-ddd/policies`      | Business policy patterns                 | `npm install @vytches-ddd/policies`      |
| `@vytches-ddd/resilience`    | Resilience patterns                      | `npm install @vytches-ddd/resilience`    |

## 📋 Project Structure (if cloned)

```
vytches-ddd/
├── packages/                   # All DDD packages
│   ├── core/                  # Meta-package
│   ├── aggregates/            # Aggregate patterns
│   ├── events/                # Event system
│   ├── cqrs/                  # CQRS implementation
│   └── ...                    # 21 total packages
├── examples/                  # Usage examples
│   ├── simple/               # Basic examples
│   └── playground/           # Interactive examples
├── docs/                     # Documentation
└── scripts/                  # Build tools
```

## 🎯 Next Steps

### For Library Users

1. **Explore Examples**: Check individual package READMEs for usage examples
2. **Read Documentation**: Visit package documentation for detailed API
   reference
3. **Join Community**: Get help and share experiences with other users

### For Contributors (if you cloned the repo)

1. **Development Mode**: Use `pnpm dev` for active development
2. **Testing**: Run `pnpm test` before committing changes
3. **Documentation**: Update docs when adding new features

## 📚 Learn More

- **📖 Documentation**: Comprehensive guides in each package README
- **💡 Examples**: 365+ practical examples across all packages
- **🏗️ Architecture**: See `docs/` folder for design decisions
- **🤝 Contributing**: Read `CONTRIBUTING.md` for contribution guidelines

## 🚨 Troubleshooting

### Common Issues

**Installation Problems:**

```bash
# Clear npm/pnpm cache
npm cache clean --force
# or
pnpm store prune
```

**Build Issues:**

```bash
# Clean and rebuild
pnpm clean && pnpm build
# or for individual packages
npm run build
```

**TypeScript Errors:**

- Check your TypeScript version (should be >= 5.0)
- Ensure proper imports from `@vytches-ddd/*` packages

### Getting Help

- 📖 Check package READMEs for detailed documentation
- 🐛 Open issues on GitHub for bugs
- 💬 Join discussions for questions and feature requests

## ✅ Quick Verification

After setup, test basic functionality:

```typescript
// test.ts
import { EntityId } from '@vytches-ddd/core';

const id = EntityId.createWithRandomUUID();
console.log('VytchesDDD is working!', id.getValue());
```

**You're ready to build enterprise-grade Domain-Driven Design applications with
VytchesDDD!** 🚀
