# CQRS - Implementation Overview

**Version**: 1.0.0  
**Package**: @vytches/ddd-cqrs  
**Complexity**: beginner  
**Domain**: User Management  
**Patterns**: command-query-responsibility-segregation, mediator-pattern,
automatic-registration

## Overview

This implementation overview demonstrates the foundational patterns of the CQRS
package. The package implements Command Query Responsibility Segregation with
automatic handler registration, middleware pipeline, and performance
optimization for scalable applications.

## Core Implementation Pattern

The CQRS package follows the **MediatR-inspired architecture** where commands
and queries are routed to appropriate handlers automatically:

```typescript
// Commands modify state
const result = await commandBus.execute(new CreateUserCommand(userData));

// Queries retrieve data
const user = await queryBus.execute(new GetUserByIdQuery(userId));
```

## Basic Command Implementation

```typescript
import { CommandHandler, CommandBus } from '@vytches/ddd-cqrs';
import { Result } from '@vytches/ddd-utils';

// Command represents business intention
class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly role: 'admin' | 'user' | 'moderator'
  ) {}

  // Self-validating commands
  validate(): ValidationError[] {
    const errors = [];
    if (!this.email.includes('@')) {
      errors.push({
        field: 'email',
        message: 'Invalid email',
        code: 'INVALID_EMAIL',
      });
    }
    return errors;
  }
}

// Handler processes the command
@CommandHandler(CreateUserCommand, { autoRegister: true })
class CreateUserCommandHandler {
  constructor(private userRepository: UserRepository) {}

  async handle(command: CreateUserCommand): Promise<CommandResult<User>> {
    try {
      // Business logic and validation
      const user = await this.userRepository.create({
        email: command.email,
        name: command.name,
        role: command.role,
      });

      return { success: true, result: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Usage with automatic handler resolution
const commandBus = new CommandBus();
const command = new CreateUserCommand('user@example.com', 'John Doe', 'user');
const result = await commandBus.execute(command);
```

## Basic Query Implementation

```typescript
import { QueryHandler, QueryBus } from '@vytches/ddd-cqrs';

// Query represents data request
class GetUserByIdQuery {
  constructor(
    public readonly userId: string,
    public readonly includeProfile: boolean = true
  ) {}

  // Cache optimization
  getCacheKey(): string {
    return `user:${this.userId}:profile-${this.includeProfile}`;
  }

  getCacheTTL(): number {
    return 300; // 5 minutes
  }
}

// Handler retrieves the data
@QueryHandler(GetUserByIdQuery, { enableCaching: true })
class GetUserByIdQueryHandler {
  constructor(
    private userRepository: UserRepository,
    private cacheService: CacheService
  ) {}

  async handle(query: GetUserByIdQuery): Promise<QueryResult<User>> {
    try {
      // Check cache first
      const cacheKey = query.getCacheKey();
      const cachedUser = await this.cacheService.get(cacheKey);

      if (cachedUser) {
        return {
          success: true,
          data: cachedUser,
          metadata: { cacheHit: true },
        };
      }

      // Load from repository
      const user = await this.userRepository.findById(query.userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Cache result
      await this.cacheService.set(cacheKey, user, query.getCacheTTL());

      return {
        success: true,
        data: user,
        metadata: { cacheHit: false },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Usage with automatic caching
const queryBus = new QueryBus({ enableCaching: true });
const query = new GetUserByIdQuery('user-123');
const result = await queryBus.execute(query);
```

## Middleware Pipeline

```typescript
import {
  ValidationMiddleware,
  LoggingMiddleware,
  PerformanceMiddleware,
} from '@vytches/ddd-cqrs';

// Setup middleware pipeline
const commandBus = new CommandBus();
const queryBus = new QueryBus();

// Add middleware in order (outer to inner)
commandBus.use(new LoggingMiddleware()); // 1. Log request/response
commandBus.use(new ValidationMiddleware()); // 2. Validate command
commandBus.use(new PerformanceMiddleware()); // 3. Monitor performance

queryBus.use(new LoggingMiddleware());
queryBus.use(new ValidationMiddleware());
queryBus.use(new PerformanceMiddleware());

// Middleware executes automatically around handlers
const result = await commandBus.execute(command);
// ↳ Logging → Validation → Performance → Handler → Performance → Logging
```

## Automatic Handler Registration

```typescript
import { VytchesDDD } from '@vytches/ddd-di';

// Handlers registered automatically through decorators
@CommandHandler(CreateUserCommand, { autoRegister: true })
class CreateUserCommandHandler {}

@QueryHandler(GetUserByIdQuery, { autoRegister: true })
class GetUserByIdQueryHandler {}

// Setup automatic discovery
async function setupCQRS(): Promise<void> {
  const commandBus = new CommandBus();
  const queryBus = new QueryBus();

  // Register buses with DI container
  VytchesDDD.registerInstance('commandBus', commandBus);
  VytchesDDD.registerInstance('queryBus', queryBus);

  // Auto-discover and register handlers
  await VytchesDDD.configure();

  console.log('✅ CQRS system initialized with automatic handler registration');
}
```

## Complete System Integration

```typescript
// Application service using CQRS
class UserService {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  async createUser(userData: CreateUserData): Promise<User> {
    // Execute command
    const command = new CreateUserCommand(
      userData.email,
      userData.name,
      userData.role
    );

    const commandResult = await this.commandBus.execute(command);

    if (!commandResult.success) {
      throw new Error(commandResult.error);
    }

    // Query for complete user data
    const query = new GetUserByIdQuery(commandResult.result.id);
    const queryResult = await this.queryBus.execute(query);

    return queryResult.data!;
  }

  async getUserById(userId: string): Promise<User | null> {
    const query = new GetUserByIdQuery(userId);
    const result = await this.queryBus.execute(query);

    return result.success ? result.data! : null;
  }
}
```

## Key Implementation Features

- **🎯 Automatic Registration**: Handlers discovered and registered through
  decorators
- **🔗 Middleware Pipeline**: Cross-cutting concerns applied consistently
  through configurable pipeline
- **⚡ Performance Optimization**: Built-in caching, metrics, and performance
  monitoring
- **📊 Rich Metadata**: Commands and queries include execution metadata and
  correlation tracking
- **🛡️ Validation Support**: Commands can include validation logic executed by
  middleware
- **🏗️ Type Safety**: Full TypeScript support with compile-time handler
  validation

## Architecture Benefits

1. **Clear Separation**: Commands change state, queries retrieve data - never
   both
2. **Independent Optimization**: Different strategies for read vs write
   operations
3. **Scalable Design**: Read and write operations can scale independently
4. **Testable Architecture**: Commands and queries can be unit tested in
   isolation
5. **Maintainable Code**: Business logic concentrated in focused handlers

## Implementation Examples

For detailed implementation examples, see:

- **[Example 1: Command Handlers](./example-1.md)** - Comprehensive command
  handling with validation
- **[Example 2: Query Handlers](./example-2.md)** - Optimized query handling
  with caching
- **[Example 3: Middleware Pipeline](./example-3.md)** - Cross-cutting concerns
  with middleware
- **[Use Cases](./use-case.md)** - Real-world business scenarios and
  implementations

This foundational pattern enables building scalable, maintainable applications
with clear separation between read and write operations, comprehensive
middleware support, and excellent performance characteristics.
