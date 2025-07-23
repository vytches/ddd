# CQRS Handler Registration - Intermediate Example

**Version**: 1.0.0  
**Package**: @vytches-ddd/di  
**Complexity**: intermediate  
**Domain**: User Management  
**Patterns**: CQRS, Handler Registration, Command-Query Separation  
**Dependencies**: @vytches-ddd/di, @vytches-ddd/cqrs

## Description

This example demonstrates automatic registration of CQRS command and query
handlers using enhanced decorators. The DI system automatically discovers and
registers handlers, making them available through the command and query buses
without manual registration.

## Business Context

In CQRS architectures, commands and queries are handled by separate handlers.
Rather than manually registering each handler, the auto-discovery system finds
decorated handlers and makes them available through the appropriate buses,
ensuring consistent registration and reducing configuration errors.

## Code Example

```typescript
// commands/create-user.command.ts
import { Command } from '@vytches-ddd/cqrs';
import { CreateUserData } from '../types'; // Import from application

/**
 * Command to create a new user
 */
export class CreateUserCommand implements Command {
  constructor(
    public readonly userData: CreateUserData,
    public readonly requestId: string
  ) {}
}
```

```typescript
// commands/update-user.command.ts
import { Command } from '@vytches-ddd/cqrs';
import { UpdateUserData } from '../types'; // Import from application

/**
 * Command to update user information
 */
export class UpdateUserCommand implements Command {
  constructor(
    public readonly userId: string,
    public readonly userData: UpdateUserData,
    public readonly requestId: string
  ) {}
}
```

```typescript
// queries/get-user.query.ts
import { Query } from '@vytches-ddd/cqrs';
import { User } from '../types'; // Import from application

/**
 * Query to get user by ID
 */
export class GetUserQuery implements Query<User> {
  constructor(public readonly userId: string) {}
}
```

```typescript
// queries/get-users.query.ts
import { Query } from '@vytches-ddd/cqrs';
import { User, PaginationParams, PaginatedResponse } from '../types'; // Import from application

/**
 * Query to get paginated users
 */
export class GetUsersQuery implements Query<PaginatedResponse<User>> {
  constructor(public readonly pagination: PaginationParams) {}
}
```

```typescript
// handlers/create-user.handler.ts
import { CommandHandler, ICommandHandler } from '@vytches-ddd/di';
import { CreateUserCommand } from '../commands/create-user.command';
import { VytchesDDD } from '@vytches-ddd/di';
import { AuditService } from '../services/audit.service';
import { User } from '../types'; // Import from application

/**
 * Handler for CreateUserCommand with auto-registration
 */
@CommandHandler(CreateUserCommand, {
  context: 'UserManagement',
  timeout: 10000,
  middleware: ['validationMiddleware', 'auditMiddleware'],
  retryPolicy: {
    maxAttempts: 3,
    baseDelay: 1000,
  },
})
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  /**
   * Handles user creation command
   */
  async handle(command: CreateUserCommand): Promise<void> {
    // ⭐ FOCUS: Auto-registered command handler
    console.log(`CreateUserHandler: Processing command ${command.requestId}`);

    // Resolve audit service using DI
    const auditService = VytchesDDD.resolve<AuditService>(
      'auditService',
      'UserManagement'
    );

    // Create user logic
    const user: User = {
      id: this.generateUserId(),
      email: command.userData.email,
      name: command.userData.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulate user creation
    await this.saveUser(user);

    // Log the action
    await auditService.logAction('UserManagement', {
      userId: user.id,
      action: 'CREATE_USER',
      resource: 'User',
      resourceId: user.id,
    });

    console.log(`CreateUserHandler: Created user ${user.id}`);
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveUser(user: User): Promise<void> {
    // Simulate database save
    console.log(`Saving user to database: ${user.id}`);
  }
}
```

```typescript
// handlers/update-user.handler.ts
import { CommandHandler, ICommandHandler } from '@vytches-ddd/di';
import { UpdateUserCommand } from '../commands/update-user.command';
import { VytchesDDD } from '@vytches-ddd/di';
import { AuditService } from '../services/audit.service';

/**
 * Handler for UpdateUserCommand with auto-registration
 */
@CommandHandler(UpdateUserCommand, {
  context: 'UserManagement',
  timeout: 8000,
  middleware: ['validationMiddleware'],
  priority: 5,
})
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  /**
   * Handles user update command
   */
  async handle(command: UpdateUserCommand): Promise<void> {
    // ⭐ FOCUS: Auto-registered command handler with validation
    console.log(
      `UpdateUserHandler: Processing update for user ${command.userId}`
    );

    // Resolve audit service
    const auditService = VytchesDDD.resolve<AuditService>(
      'auditService',
      'UserManagement'
    );

    // Validate user exists
    const existingUser = await this.getUserById(command.userId);
    if (!existingUser) {
      throw new Error(`User not found: ${command.userId}`);
    }

    // Update user logic
    const updatedUser = {
      ...existingUser,
      ...command.userData,
      updatedAt: new Date(),
    };

    await this.saveUser(updatedUser);

    // Log the action
    await auditService.logAction('UserManagement', {
      userId: command.userId,
      action: 'UPDATE_USER',
      resource: 'User',
      resourceId: command.userId,
    });

    console.log(`UpdateUserHandler: Updated user ${command.userId}`);
  }

  private async getUserById(id: string): Promise<User | null> {
    // Simulate database lookup
    console.log(`Looking up user: ${id}`);
    return null; // Simplified for example
  }

  private async saveUser(user: User): Promise<void> {
    // Simulate database save
    console.log(`Updating user in database: ${user.id}`);
  }
}
```

```typescript
// handlers/get-user.handler.ts
import { QueryHandler, IQueryHandler } from '@vytches-ddd/di';
import { GetUserQuery } from '../queries/get-user.query';
import { VytchesDDD } from '@vytches-ddd/di';
import { CacheService } from '../services/cache.service';
import { User } from '../types'; // Import from application

/**
 * Handler for GetUserQuery with auto-registration
 */
@QueryHandler(GetUserQuery, {
  context: 'UserManagement',
  timeout: 5000,
  middleware: ['cacheMiddleware'],
  cacheTtl: 300000, // 5 minutes
})
export class GetUserHandler implements IQueryHandler<GetUserQuery, User> {
  /**
   * Handles get user query
   */
  async handle(query: GetUserQuery): Promise<User | null> {
    // ⭐ FOCUS: Auto-registered query handler with caching
    console.log(`GetUserHandler: Processing query for user ${query.userId}`);

    // Resolve cache service
    const cacheService = VytchesDDD.resolve<CacheService>(
      'cacheService',
      'UserManagement'
    );

    // Check cache first
    const cacheKey = `user:${query.userId}`;
    const cachedUser = await cacheService.get<User>(cacheKey);

    if (cachedUser) {
      console.log(`GetUserHandler: Cache hit for user ${query.userId}`);
      return cachedUser;
    }

    // Fetch from database
    const user = await this.fetchUserFromDatabase(query.userId);

    if (user) {
      // Cache the result
      await cacheService.set(cacheKey, user);
      console.log(`GetUserHandler: Cached user ${query.userId}`);
    }

    return user;
  }

  private async fetchUserFromDatabase(id: string): Promise<User | null> {
    // Simulate database fetch
    console.log(`Fetching user from database: ${id}`);

    // Return mock user for demonstration
    return {
      id,
      email: `user${id}@example.com`,
      name: `User ${id}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
```

```typescript
// handlers/get-users.handler.ts
import { QueryHandler, IQueryHandler } from '@vytches-ddd/di';
import { GetUsersQuery } from '../queries/get-users.query';
import { User, PaginatedResponse } from '../types'; // Import from application

/**
 * Handler for GetUsersQuery with auto-registration
 */
@QueryHandler(GetUsersQuery, {
  context: 'UserManagement',
  timeout: 15000,
  middleware: ['rateLimitMiddleware'],
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
})
export class GetUsersHandler
  implements IQueryHandler<GetUsersQuery, PaginatedResponse<User>>
{
  /**
   * Handles get users query with pagination
   */
  async handle(query: GetUsersQuery): Promise<PaginatedResponse<User>> {
    // ⭐ FOCUS: Auto-registered query handler with rate limiting
    console.log(
      `GetUsersHandler: Processing paginated query - Page ${query.pagination.page}`
    );

    // Fetch users from database
    const users = await this.fetchUsersFromDatabase(query.pagination);
    const totalCount = await this.getTotalUserCount();

    const response: PaginatedResponse<User> = {
      data: users,
      pagination: {
        page: query.pagination.page,
        limit: query.pagination.limit,
        total: totalCount,
        pages: Math.ceil(totalCount / query.pagination.limit),
      },
    };

    console.log(`GetUsersHandler: Returned ${users.length} users`);
    return response;
  }

  private async fetchUsersFromDatabase(
    pagination: PaginationParams
  ): Promise<User[]> {
    // Simulate database fetch with pagination
    console.log(
      `Fetching users - Page ${pagination.page}, Limit ${pagination.limit}`
    );

    // Return mock users
    const users: User[] = [];
    for (let i = 0; i < pagination.limit; i++) {
      users.push({
        id: `user_${pagination.page}_${i}`,
        email: `user${pagination.page}_${i}@example.com`,
        name: `User ${pagination.page}_${i}`,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return users;
  }

  private async getTotalUserCount(): Promise<number> {
    // Simulate total count query
    return 1000; // Mock total
  }
}
```

```typescript
// services/audit.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { AuditLogEntry } from '../types'; // Import from application

/**
 * Audit service for handlers
 */
@DomainService({
  serviceId: 'auditService',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  autoRegister: true,
})
export class AuditService {
  private auditLog: AuditLogEntry[] = [];

  async logAction(
    context: string,
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: this.generateAuditId(),
      timestamp: new Date(),
    };

    this.auditLog.push(auditEntry);
    console.log(`AuditService: Logged ${entry.action} in context ${context}`);
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

```typescript
// services/cache.service.ts
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';

/**
 * Cache service for query handlers
 */
@DomainService({
  serviceId: 'cacheService',
  lifetime: ServiceLifetime.Singleton,
  context: 'UserManagement',
  autoRegister: true,
})
export class CacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);

    if (!cached || Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  async set(key: string, value: any, ttl: number = 300000): Promise<void> {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }
}
```

```typescript
// app.ts
import { VytchesDDD, SimpleContainer } from '@vytches-ddd/di';
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { CreateUserCommand } from './commands/create-user.command';
import { UpdateUserCommand } from './commands/update-user.command';
import { GetUserQuery } from './queries/get-user.query';
import { GetUsersQuery } from './queries/get-users.query';
import { CreateUserData, UpdateUserData } from '../types'; // Import from application

/**
 * Application demonstrating CQRS handler registration
 */
async function demonstrateCQRSHandlerRegistration(): Promise<void> {
  console.log('=== CQRS Handler Registration Demo ===\n');

  // ⭐ FOCUS: Configure DI with handler auto-discovery
  const container = new SimpleContainer();
  await VytchesDDD.configure(container);

  // Get command and query buses
  const commandBus = VytchesDDD.resolve<CommandBus>('commandBus');
  const queryBus = VytchesDDD.resolve<QueryBus>('queryBus');

  console.log('1. Auto-registered handlers:');
  const registeredHandlers = VytchesDDD.getRegisteredHandlers();
  registeredHandlers.forEach(handler => {
    console.log(`  - ${handler.type}: ${handler.name}`);
  });

  console.log('\n2. Executing commands:');

  // ⭐ FOCUS: Execute commands through auto-registered handlers
  const createUserData: CreateUserData = {
    email: 'john.doe@example.com',
    name: 'John Doe',
  };

  const createCommand = new CreateUserCommand(createUserData, 'req-001');
  await commandBus.execute(createCommand);

  const updateUserData: UpdateUserData = {
    name: 'John Smith',
  };

  const updateCommand = new UpdateUserCommand(
    'user_123',
    updateUserData,
    'req-002'
  );
  await commandBus.execute(updateCommand);

  console.log('\n3. Executing queries:');

  // ⭐ FOCUS: Execute queries through auto-registered handlers
  const getUserQuery = new GetUserQuery('user_123');
  const user = await queryBus.execute(getUserQuery);
  console.log('Retrieved user:', user);

  const getUsersQuery = new GetUsersQuery({
    page: 1,
    limit: 10,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const users = await queryBus.execute(getUsersQuery);
  console.log(
    `Retrieved ${users.data.length} users, Total: ${users.pagination.total}`
  );

  console.log('\n4. Handler metadata:');
  const createHandlerMetadata =
    VytchesDDD.getHandlerMetadata('CreateUserHandler');
  console.log('CreateUserHandler metadata:', createHandlerMetadata);
}

// Run the demonstration
demonstrateCQRSHandlerRegistration().catch(console.error);
```

## Key Features

- **Automatic Handler Registration**: Handlers are automatically discovered and
  registered
- **Enhanced Decorators**: Rich configuration options for handlers
- **Context-Aware Handlers**: Handlers can be registered in specific contexts
- **Middleware Support**: Handlers can use middleware for cross-cutting concerns
- **Timeout Configuration**: Handler-specific timeout settings
- **Retry Policies**: Automatic retry logic for failed handlers
- **Rate Limiting**: Built-in rate limiting for query handlers
- **Caching Support**: Query handlers can leverage caching middleware

## Common Pitfalls

- **Missing Handler Registration**: Ensure handlers are decorated with
  `@CommandHandler` or `@QueryHandler`
- **Context Mismatches**: Handler context must match the service context
- **Timeout Issues**: Set appropriate timeouts for long-running handlers
- **Middleware Order**: Middleware execution order matters for some scenarios
- **Cache Invalidation**: Remember to invalidate cache when data changes

## Related Examples

- [Auto-Discovery System](./example-1.md) - Service auto-discovery
- [Context Isolation](./example-2.md) - Bounded context support
- [Framework Integration Patterns](../advanced/example-1.md) - Advanced
  framework integration
