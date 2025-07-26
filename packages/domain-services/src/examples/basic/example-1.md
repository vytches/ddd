# Basic Domain Service - Beginner Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-services **Complexity**:
beginner **Domain**: user-management **Patterns**: domain-service, orchestration
**Dependencies**: @vytches/ddd-core, @vytches/ddd-utils

## Description

This example demonstrates a simple domain service that orchestrates user
management operations. It shows how to create a basic domain service that
coordinates multiple operations while maintaining domain boundaries.

## Business Context

User management often requires coordination between different domain concerns:
user validation, account creation, notification sending, and audit logging. A
domain service provides a clean way to orchestrate these operations without
violating domain boundaries.

## Code Example

````typescript
// user-management.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';
import { User, CreateUserCommand, UserCreatedEvent } from '../types';

/**
 * @llm-summary Domain service for user management operations
 * @llm-domain user-management
 * @llm-complexity Simple
 *
 * @description
 * Orchestrates user creation, validation, and notification processes.
 * Maintains domain boundaries while coordinating multiple operations.
 *
 * @example
 * ```typescript
 * const service = new UserManagementService();
 * const result = await service.createUser({
 *   email: 'john@example.com',
 *   name: 'John Doe'
 * });
 * ```
 */
export class UserManagementService extends BaseDomainService {
  constructor() {
    super('UserManagementService');
  }

  /**
   * Creates a new user with validation and notification
   *
   * @param command - User creation command
   * @returns Result containing created user or error
   */
  async createUser(command: CreateUserCommand): Promise<Result<User, Error>> {
    try {
      // Step 1: Validate user data
      const validation = await this.validateUser(command);
      if (validation.isFailure()) {
        return Result.failure(validation.error);
      }

      // Step 2: Create user entity
      const user = await this.buildUser(command);

      // Step 3: Persist user (assumed repository exists)
      const savedUser = await this.saveUser(user);

      // Step 4: Publish domain event
      await this.publishUserCreatedEvent(savedUser);

      // Step 5: Send welcome notification
      await this.sendWelcomeNotification(savedUser);

      return Result.success(savedUser);
    } catch (error) {
      return Result.failure(
        new Error(`User creation failed: ${error.message}`)
      );
    }
  }

  /**
   * Validates user creation command
   */
  private async validateUser(
    command: CreateUserCommand
  ): Promise<Result<void, Error>> {
    if (!command.email || !command.email.includes('@')) {
      return Result.failure(new Error('Valid email is required'));
    }

    if (!command.name || command.name.trim().length < 2) {
      return Result.failure(new Error('Name must be at least 2 characters'));
    }

    return Result.success();
  }

  /**
   * Builds user entity from command
   */
  private async buildUser(command: CreateUserCommand): Promise<User> {
    return {
      id: this.generateId(),
      email: command.email.toLowerCase(),
      name: command.name.trim(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Saves user to persistence (placeholder - assume repository exists)
   */
  private async saveUser(user: User): Promise<User> {
    // In real implementation, this would use a repository
    console.log('Saving user:', user.id);
    return user;
  }

  /**
   * Publishes user created domain event
   */
  private async publishUserCreatedEvent(user: User): Promise<void> {
    const event: UserCreatedEvent = {
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    // In real implementation, this would publish to event bus
    console.log('Publishing UserCreatedEvent:', event);
  }

  /**
   * Sends welcome notification to new user
   */
  private async sendWelcomeNotification(user: User): Promise<void> {
    // In real implementation, this would use notification service
    console.log(`Sending welcome notification to ${user.email}`);
  }

  /**
   * Generates unique identifier
   */
  private generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
````

## Key Features

- **Domain Service Pattern**: Extends BaseDomainService for proper domain
  service implementation
- **Orchestration**: Coordinates multiple operations in a single business
  transaction
- **Error Handling**: Uses Result pattern for clean error handling
- **Domain Events**: Publishes domain events for decoupled communication
- **Validation**: Includes business rule validation
- **Separation of Concerns**: Each operation is in its own method for clarity

## Common Pitfalls

- **Avoid Business Logic in Domain Services**: Keep complex business logic in
  entities or value objects
- **Don't Create Anemic Services**: Ensure the service provides real
  coordination value
- **Avoid Direct Database Access**: Use repositories for data persistence
- **Don't Ignore Failures**: Always handle potential failures in each step
- **Avoid Tight Coupling**: Keep services loosely coupled through events and
  interfaces

## Related Examples

- [Domain Service with Repository](./example-2.md) - Shows repository
  integration
- [Event-Driven Domain Service](../intermediate/example-1.md) - Event publishing
  patterns
- [NestJS Manual Setup](../frameworks/nestjs/basic/manual-setup.md) - Framework
  integration
