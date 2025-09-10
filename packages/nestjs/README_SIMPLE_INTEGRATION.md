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

### Production Setup

```typescript
// app.module.ts
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

## Handler Definition

```typescript
// create-user.handler.ts
import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@vytches/ddd-cqrs';
import { ICommandHandler, ICommand } from '@vytches/ddd-cqrs';

class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string
  ) {}
}

@Injectable()
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler
  implements ICommandHandler<CreateUserCommand, void>
{
  async execute(command: CreateUserCommand): Promise<void> {
    // Handler implementation
    console.log(`Creating user: ${command.name} (${command.email})`);
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

## Architecture

The simple architecture consists of:

1. **VytchesDDDModule**: Main module with `forRoot()` and `forTesting()` methods
2. **VytchesExplorerService**: Simple auto-discovery using NestJS
   DiscoveryService
3. **Custom Provider Support**: Flexible provider token mapping (IEventBus =>
   UnifiedEventBus)

The implementation follows the same patterns as @nestjs/cqrs for maximum
familiarity and reliability.
