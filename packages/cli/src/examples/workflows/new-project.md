# New Project Workflow

**Focus**: Creating a complete DDD project from scratch **Time**: 15-30 minutes
**Result**: Production-ready DDD project structure

## Overview

This workflow guides you through creating a new DDD project with VytchesDDD CLI,
from initial setup to a working application with multiple bounded contexts.

## Prerequisites

```bash
# Install VytchesDDD CLI
npm install -g @vytches-ddd/cli

# Verify installation
vytches-ddd --version
```

## Step 1: Project Initialization

```bash
# Create new project directory
mkdir my-ddd-project
cd my-ddd-project

# Initialize Node.js project
npm init -y

# Install VytchesDDD dependencies
npm install @vytches-ddd/core @vytches-ddd/cqrs @vytches-ddd/events
npm install -D typescript @types/node ts-node
```

**Generated package.json:**

```json
{
  "name": "my-ddd-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "@vytches-ddd/core": "^1.0.0",
    "@vytches-ddd/cqrs": "^1.0.0",
    "@vytches-ddd/events": "^1.0.0"
  }
}
```

## Step 2: Create TypeScript Configuration

```bash
# Generate tsconfig.json
npx tsc --init

# Or create optimized config
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": "./",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@application/*": ["src/application/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Step 3: Build First Domain (User Management)

```bash
# Start with guided domain building
vytches-ddd domain UserManagement --guided --template enterprise
```

**Interactive Session:**

```
🎯 VytchesDDD Domain Builder

? What business problem are you solving?
> User registration, authentication, and profile management

? Key business entities?
> User, Profile, Account, Role

? Main use cases?
  ✓ Register new user
  ✓ Authenticate user
  ✓ Update profile
  ✓ Manage roles

Generating enterprise domain structure...
```

**Generated Structure:**

```
src/domain/user-management/
├── aggregates/
│   ├── user.aggregate.ts
│   └── account.aggregate.ts
├── entities/
│   ├── profile.entity.ts
│   └── role.entity.ts
├── value-objects/
│   ├── email.vo.ts
│   ├── password.vo.ts
│   └── user-id.vo.ts
├── events/
│   ├── user-registered.event.ts
│   └── profile-updated.event.ts
├── commands/
│   ├── register-user.command.ts
│   └── update-profile.command.ts
├── queries/
│   └── get-user-profile.query.ts
├── services/
│   └── user-registration.service.ts
└── repositories/
    └── user.repository.ts
```

## Step 4: Add Second Domain (Order Management)

```bash
# Build order management domain
vytches-ddd domain OrderManagement --template ecommerce
```

**Generated Structure:**

```
src/domain/order-management/
├── aggregates/
│   ├── order.aggregate.ts
│   └── cart.aggregate.ts
├── entities/
│   ├── order-item.entity.ts
│   └── shipping-info.entity.ts
├── value-objects/
│   ├── money.vo.ts
│   ├── product-id.vo.ts
│   └── order-status.vo.ts
├── events/
│   ├── order-created.event.ts
│   ├── order-paid.event.ts
│   └── order-shipped.event.ts
├── commands/
│   ├── create-order.command.ts
│   ├── process-payment.command.ts
│   └── ship-order.command.ts
├── services/
│   ├── order-processing.service.ts
│   └── pricing.service.ts
└── repositories/
    └── order.repository.ts
```

## Step 5: Generate Application Layer

```bash
# Generate CQRS handlers for UserManagement
vytches-ddd generate command-handler RegisterUser --domain UserManagement
vytches-ddd generate query-handler GetUserProfile --domain UserManagement

# Generate handlers for OrderManagement
vytches-ddd generate command-handler CreateOrder --domain OrderManagement
vytches-ddd generate command-handler ProcessPayment --domain OrderManagement
```

**Generated Command Handler:**

```typescript
// src/application/user-management/handlers/register-user.handler.ts
import { CommandHandler, ICommandHandler } from '@vytches-ddd/cqrs';
import { RegisterUserCommand } from '@domain/user-management/commands/register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler
  implements ICommandHandler<RegisterUserCommand>
{
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userRegistrationService: UserRegistrationService
  ) {}

  async execute(command: RegisterUserCommand): Promise<void> {
    const user = await this.userRegistrationService.registerUser(
      command.email,
      command.password,
      command.profile
    );

    await this.userRepository.save(user);
  }
}
```

## Step 6: Setup Infrastructure

```bash
# Generate repository implementations
vytches-ddd generate repository User --domain UserManagement --framework inmemory
vytches-ddd generate repository Order --domain OrderManagement --framework inmemory

# Generate event infrastructure
vytches-ddd generate event-bus --framework inmemory
```

**Generated Repository:**

```typescript
// src/infrastructure/user-management/user.repository.ts
import { IUserRepository } from '@domain/user-management/repositories/user.repository';
import { UserAggregate } from '@domain/user-management/aggregates/user.aggregate';

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, UserAggregate>();

  async save(user: UserAggregate): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<UserAggregate | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<UserAggregate | null> {
    for (const user of this.users.values()) {
      if (user.email.equals(email)) {
        return user;
      }
    }
    return null;
  }
}
```

## Step 7: Create Application Bootstrap

```bash
# Generate main application file
touch src/index.ts
```

**src/index.ts:**

```typescript
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { EventBus } from '@vytches-ddd/events';
import { RegisterUserHandler } from './application/user-management/handlers/register-user.handler';
import { CreateOrderHandler } from './application/order-management/handlers/create-order.handler';
import { InMemoryUserRepository } from './infrastructure/user-management/user.repository';
import { InMemoryOrderRepository } from './infrastructure/order-management/order.repository';

async function bootstrap() {
  // Setup infrastructure
  const eventBus = new EventBus();
  const commandBus = new CommandBus();
  const queryBus = new QueryBus();

  // Setup repositories
  const userRepository = new InMemoryUserRepository();
  const orderRepository = new InMemoryOrderRepository();

  // Register handlers
  commandBus.register(RegisterUserHandler);
  commandBus.register(CreateOrderHandler);

  console.log('🚀 DDD Application started successfully!');

  // Example usage
  await demonstrateUsage(commandBus, queryBus);
}

async function demonstrateUsage(commandBus: CommandBus, queryBus: QueryBus) {
  // Register a user
  const registerCommand = new RegisterUserCommand(
    'user@example.com',
    'securePassword123',
    {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
    }
  );

  await commandBus.execute(registerCommand);
  console.log('✅ User registered successfully');

  // Create an order
  const createOrderCommand = new CreateOrderCommand(
    'user-123',
    [
      { productId: 'product-1', quantity: 2, price: 29.99 },
      { productId: 'product-2', quantity: 1, price: 49.99 },
    ],
    {
      street: '123 Main St',
      city: 'New York',
      zipCode: '10001',
    }
  );

  await commandBus.execute(createOrderCommand);
  console.log('✅ Order created successfully');
}

bootstrap().catch(console.error);
```

## Step 8: Add Testing

```bash
# Install testing dependencies
npm install -D jest @types/jest ts-jest

# Generate test configuration
npx ts-jest config:init
```

**jest.config.js:**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  moduleNameMapping: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  },
};
```

```bash
# Generate tests for domains
vytches-ddd generate test UserAggregate --domain UserManagement
vytches-ddd generate test OrderAggregate --domain OrderManagement
```

## Step 9: Validate and Run

```bash
# Validate domain structures
vytches-ddd domain UserManagement --validate
vytches-ddd domain OrderManagement --validate

# Run the application
npm run dev
```

**Expected Output:**

```
🚀 DDD Application started successfully!
✅ User registered successfully
✅ Order created successfully
```

## Step 10: Add Framework Integration (Optional)

```bash
# Add NestJS integration
npm install @nestjs/core @nestjs/common @nestjs/platform-express

# Generate NestJS modules
vytches-ddd generate module UserManagement --framework nestjs
vytches-ddd generate module OrderManagement --framework nestjs

# Generate controllers
vytches-ddd generate controller Users --domain UserManagement --framework nestjs
vytches-ddd generate controller Orders --domain OrderManagement --framework nestjs
```

## Final Project Structure

```
my-ddd-project/
├── src/
│   ├── domain/
│   │   ├── user-management/        # First bounded context
│   │   └── order-management/       # Second bounded context
│   ├── application/
│   │   ├── user-management/
│   │   │   └── handlers/
│   │   └── order-management/
│   │       └── handlers/
│   ├── infrastructure/
│   │   ├── user-management/
│   │   └── order-management/
│   └── index.ts
├── tests/
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Next Steps

### Development

1. **Add more domains**:
   `vytches-ddd domain ProductCatalog --template ecommerce`
2. **Enhance infrastructure**: Add database repositories, external service
   integrations
3. **Add security**: Authentication, authorization, audit logging
4. **Performance**: Add caching, async processing, event sourcing

### Production Readiness

1. **Containerization**: Add Docker configuration
2. **Monitoring**: Add logging, metrics, health checks
3. **CI/CD**: Add build, test, and deployment pipelines
4. **Documentation**: API docs, architecture decision records

### Scaling

1. **Microservices**: Split domains into separate services
2. **Event Sourcing**: Add event store for audit and replay
3. **CQRS Read Models**: Add optimized query models
4. **Integration**: Add message queues, service mesh

## Troubleshooting

**Dependencies not found?**

```bash
npm install --save-dev @types/node
```

**TypeScript errors?**

```bash
vytches-ddd validate --fix-imports
```

**Domain validation fails?**

```bash
vytches-ddd domain MyDomain --validate --debug
```

## Tips for Success

- **Start small**: Begin with 1-2 domains, add more gradually
- **Validate often**: Use `--validate` after major changes
- **Follow patterns**: Let CLI generate structure, customize business logic
- **Test early**: Generate tests alongside domain code
- **Document decisions**: Use ADRs for architectural choices
- **Iterate**: Use `--refine` to improve domains based on learning
