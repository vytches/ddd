# @vytches/ddd-nestjs - Simple Integration

Clean, simple NestJS integration following proven @nestjs/cqrs patterns.

## Features

- ✅ **Simple & Clean**: ~50 lines instead of 500+ lines of complex logic
- ✅ **Familiar Patterns**: Follows @nestjs/cqrs methodology
- ✅ **Custom Provider Tokens**: Support IEventBus => UnifiedEventBus mapping
- ✅ **Auto-Discovery**: Automatic handler registration with metadata
- ✅ **No Temporal Coupling**: Synchronous discovery during module
  initialization
- ✅ **Testing Support**: Built-in `forTesting()` method with pre-configured
  buses

## Basic Usage

### Simple Setup (Recommended for Beginners)

```typescript
// app.module.ts - Easiest setup with auto-configuration
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

@Module({
  imports: [
    // ✅ Simple setup - everything configured automatically
    VytchesDDDModule.forRoot({
      // Auto-configured providers with sensible defaults
      autoRegister: true, // Automatically discovers and registers handlers
    }),
  ],
  controllers: [],
  providers: [], // Your handlers will be auto-discovered
})
export class AppModule {}
```

### Production Setup

```typescript
// app.module.ts - Manual configuration for more control
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { EnhancedCommandBus, EnhancedQueryBus } from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { SimpleContainer } from '@vytches/ddd-di';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: ICommandBus,
          useFactory: () => {
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container);
          },
        },
        {
          provide: IQueryBus,
          useFactory: () => {
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container);
          },
        },
        {
          provide: IEventBus,
          useClass: UnifiedEventBus,
        },
      ],
    }),
  ],
})
export class AppModule {}
```

### Testing Setup

```typescript
// user.service.spec.ts
import { Test } from '@nestjs/testing';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

describe('UserService', () => {
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [UserService, CreateUserCommandHandler],
    }).compile();

    // Auto-discovery happens automatically
    await module.init();
  });

  // Your tests...
});
```

## Handler Registration Examples

### 1. Command Bus & Command Handlers

#### Command Definition

```typescript
// commands/create-user.command.ts
import { ICommand } from '@vytches/ddd-cqrs';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly role: string = 'user'
  ) {}
}
```

#### Command Handler

```typescript
// handlers/create-user.handler.ts
import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@vytches/ddd-cqrs';
import { CreateUserCommand } from '../commands/create-user.command';

@Injectable()
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler
  implements ICommandHandler<CreateUserCommand, void>
{
  constructor(
    // Inject your services here
    private readonly userService: UserService
  ) {}

  async execute(command: CreateUserCommand): Promise<void> {
    // Handler implementation
    console.log(`Creating user: ${command.name} (${command.email})`);

    // Call your business service
    await this.userService.createUser({
      email: command.email,
      name: command.name,
      role: command.role,
    });
  }
}
```

### 2. Query Bus & Query Handlers

#### Query Definition

```typescript
// queries/get-user.query.ts
import { IQuery } from '@vytches/ddd-cqrs';

export class GetUserQuery implements IQuery {
  constructor(public readonly userId: string) {}
}
```

#### Query Handler

```typescript
// handlers/get-user.handler.ts
import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@vytches/ddd-cqrs';
import { GetUserQuery } from '../queries/get-user.query';
import { User } from '../models/user.model';

@Injectable()
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery, User> {
  constructor(private readonly userService: UserService) {}

  async execute(query: GetUserQuery): Promise<User> {
    console.log(`Getting user: ${query.userId}`);

    // Query your data source
    return await this.userService.findById(query.userId);
  }
}
```

### 3. Event Bus & Event Handlers

#### Event Definition

```typescript
// events/user-created.event.ts
import { IDomainEvent } from '@vytches/ddd-contracts';

export class UserCreatedEvent implements IDomainEvent {
  constructor(
    public readonly payload: {
      userId: string;
      email: string;
      name: string;
      createdAt: Date;
    }
  ) {}

  get eventType(): string {
    return 'UserCreated';
  }
}
```

#### Event Handler

```typescript
// handlers/user-created.handler.ts
import { Injectable } from '@nestjs/common';
import { EventHandler, IEventHandler } from '@vytches/ddd-events';
import { UserCreatedEvent } from '../events/user-created.event';

@Injectable()
@EventHandler(UserCreatedEvent)
export class UserCreatedEventHandler
  implements IEventHandler<UserCreatedEvent>
{
  constructor(private readonly emailService: EmailService) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    const { userId, email, name } = event.payload;

    console.log(`User created: ${name} (${userId})`);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(email, name);
  }
}
```

### 4. Publishing Events from Services

```typescript
// services/user.service.ts
import { Injectable } from '@nestjs/common';
import { IEventBus } from '@vytches/ddd-contracts';
import { UserCreatedEvent } from '../events/user-created.event';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: IEventBus // Auto-injected by VytchesDDDModule
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    // Create user
    const user = new User(userData);
    await this.userRepository.save(user);

    // Publish event
    const event = new UserCreatedEvent({
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: new Date(),
    });

    await this.eventBus.publish(event);

    return user;
  }
}
```

### 5. Using Command & Query Buses in Controllers

```typescript
// controllers/user.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { CreateUserCommand } from '../commands/create-user.command';
import { GetUserQuery } from '../queries/get-user.query';

@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: ICommandBus, // Auto-injected
    private readonly queryBus: IQueryBus // Auto-injected
  ) {}

  @Post()
  async createUser(
    @Body() body: { email: string; name: string; role?: string }
  ) {
    const command = new CreateUserCommand(body.email, body.name, body.role);
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const query = new GetUserQuery(id);
    const user = await this.queryBus.execute(query);
    return user;
  }
}
```

## Key Benefits

### Before (Complex Implementation)

- 500+ lines of complex discovery logic
- Temporal coupling and race conditions
- Bridge patterns and complex initialization
- Hard to debug and maintain

### After (Simple Implementation)

- ~50 lines following @nestjs/cqrs patterns
- Synchronous discovery during module init
- Clean provider token mapping
- Easy to understand and extend

## Complete Working Example

Here's a complete working example showing all handler types together:

### Module Setup

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';

// Import your handlers
import { CreateUserCommandHandler } from './handlers/create-user.handler';
import { GetUserQueryHandler } from './handlers/get-user.handler';
import { UserCreatedEventHandler } from './handlers/user-created.handler';

// Import your services and controllers
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';

@Module({
  imports: [
    VytchesDDDModule.forRoot(), // Simple auto-configuration
  ],
  controllers: [UserController],
  providers: [
    // Your business services
    UserService,

    // Your handlers (will be auto-discovered)
    CreateUserCommandHandler,
    GetUserQueryHandler,
    UserCreatedEventHandler,
  ],
})
export class UserModule {}
```

### Handler Registration Summary

| Handler Type | File Pattern                            | Auto-Discovery     |
| ------------ | --------------------------------------- | ------------------ |
| **Commands** | `*.handler.ts` with `@CommandHandler()` | ✅ Automatic       |
| **Queries**  | `*.handler.ts` with `@QueryHandler()`   | ✅ Automatic       |
| **Events**   | `*.handler.ts` with `@EventHandler()`   | ✅ Automatic       |
| **Services** | `*.service.ts` with `@Injectable()`     | ✅ Standard NestJS |

### Best Practices

#### 1. File Organization

```
src/
├── commands/
│   ├── create-user.command.ts
│   └── update-user.command.ts
├── queries/
│   ├── get-user.query.ts
│   └── list-users.query.ts
├── events/
│   ├── user-created.event.ts
│   └── user-updated.event.ts
├── handlers/
│   ├── create-user.handler.ts
│   ├── get-user.handler.ts
│   └── user-created.handler.ts
├── services/
│   └── user.service.ts
└── controllers/
    └── user.controller.ts
```

#### 2. Error Handling

```typescript
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    try {
      await this.userService.createUser(command);
    } catch (error) {
      // Handle business errors appropriately
      throw new BadRequestException(`User creation failed: ${error.message}`);
    }
  }
}
```

#### 3. Simple Event Flow

```typescript
// 1. Command creates user
@CommandHandler(CreateUserCommand)
class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    const user = await this.userService.createUser(command);
    // Event automatically published by userService
  }
}

// 2. Service publishes event
@Injectable()
class UserService {
  async createUser(data: CreateUserData): Promise<User> {
    const user = await this.userRepository.save(new User(data));

    // Publish domain event
    await this.eventBus.publish(
      new UserCreatedEvent({
        userId: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date(),
      })
    );

    return user;
  }
}

// 3. Event handler reacts
@EventHandler(UserCreatedEvent)
class UserCreatedHandler {
  async handle(event: UserCreatedEvent): Promise<void> {
    // Send welcome email, update analytics, etc.
    await this.emailService.sendWelcomeEmail(event.payload.email);
  }
}
```

## Common Patterns

### Multiple Event Handlers

You can have multiple handlers for the same event:

```typescript
// Send email
@EventHandler(UserCreatedEvent)
export class SendWelcomeEmailHandler {
  async handle(event: UserCreatedEvent): Promise<void> {
    await this.emailService.sendWelcome(event.payload.email);
  }
}

// Update analytics
@EventHandler(UserCreatedEvent)
export class UserAnalyticsHandler {
  async handle(event: UserCreatedEvent): Promise<void> {
    await this.analytics.trackUserCreation(event.payload.userId);
  }
}
```

### Async Event Processing

All handlers are async by default:

```typescript
@EventHandler(UserCreatedEvent)
export class AsyncUserCreatedHandler {
  async handle(event: UserCreatedEvent): Promise<void> {
    // All async operations are awaited
    await this.database.updateUserStats();
    await this.cache.invalidateUserData();
    await this.externalService.notifyUserCreation(event.payload);
  }
}
```

## Performance Tips

1. **Use Auto-Discovery**: Let VytchesDDD automatically find your handlers
2. **Keep Handlers Simple**: Focus on single responsibility
3. **Async Operations**: All handlers support async/await
4. **Error Boundaries**: Wrap business logic in try/catch blocks

## Architecture

The simple architecture consists of:

1. **VytchesDDDModule**: Main module with `forRoot()` and `forTesting()` methods
2. **VytchesExplorerService**: Simple auto-discovery using NestJS
   DiscoveryService
3. **Auto-Registration**: Automatic handler discovery and registration
4. **Provider Support**: Flexible bus configuration (IEventBus =>
   UnifiedEventBus)

The implementation follows the same patterns as @nestjs/cqrs for maximum
familiarity and reliability.
