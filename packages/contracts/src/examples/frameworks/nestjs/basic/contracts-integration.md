# Contracts Integration with NestJS

**Focus**: Basic foundation contract usage in NestJS with manual instantiation
**Base Example**: [Foundation Contracts](../../basic/foundation-contracts.md)
**Dependencies**: @nestjs/common, @vytches/ddd-contracts

## Description

This example demonstrates basic integration of VytchesDDD contracts with NestJS,
showing how to use EntityId, specifications, and actors in NestJS services with
manual instantiation for beginner-friendly patterns.

## Service Implementation

```typescript
// user.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EntityId, ISpecification, IActor } from '@vytches/ddd-contracts';
import { User, CreateUserData, UpdateUserData } from './types'; // From your app

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor() {
    // ⭐ FOCUS: Manual contract setup (beginner-friendly)
  }

  // ✅ FOCUS: EntityId usage in NestJS service
  async createUser(userData: CreateUserData, actor: IActor): Promise<User> {
    try {
      this.logger.log('Creating user', {
        email: userData.email,
        actorId: actor.id,
      });

      // Create new EntityId for user
      const userId = EntityId.createWithRandomUUID();

      // Create user with EntityId
      const user: User = {
        id: userId.getValue(),
        email: userData.email,
        name: userData.name,
        createdAt: new Date(),
        createdBy: actor.id,
      };

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error.message);
      throw error;
    }
  }

  // ✅ FOCUS: EntityId lookup patterns
  async findUser(userId: string): Promise<User | null> {
    try {
      // Convert string to EntityId for validation
      const entityId = EntityId.createText(userId);

      this.logger.log('Finding user', {
        userId: entityId.getValue(),
        idType: entityId.getType(),
      });

      // In real implementation, query database with EntityId
      // This is a simplified example
      const user: User = {
        id: entityId.getValue(),
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: new Date(),
        createdBy: 'system',
      };

      return user;
    } catch (error) {
      this.logger.error('Failed to find user', error.message);
      return null;
    }
  }

  // ✅ FOCUS: Specification pattern in NestJS
  async validateUser(
    user: User
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Create specifications manually
      const emailSpec = new EmailValidationSpecification();
      const nameSpec = new MinimumLengthSpecification(2);

      // Validate email
      if (!emailSpec.isSatisfiedBy(user.email)) {
        errors.push(emailSpec.getFailureReason(user.email));
      }

      // Validate name
      if (!nameSpec.isSatisfiedBy(user.name)) {
        errors.push(nameSpec.getFailureReason(user.name));
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error('User validation failed', error.message);
      return {
        valid: false,
        errors: ['Validation error occurred'],
      };
    }
  }

  // ✅ FOCUS: Actor-based operations
  async updateUser(
    userId: string,
    updates: UpdateUserData,
    actor: IActor
  ): Promise<User> {
    try {
      // Validate actor permissions
      if (!actor.hasPermission('user:update')) {
        throw new Error('Insufficient permissions to update user');
      }

      const entityId = EntityId.createText(userId);

      this.logger.log('Updating user', {
        userId: entityId.getValue(),
        actorId: actor.id,
        actorType: actor.type,
      });

      // Create updated user
      const updatedUser: User = {
        id: entityId.getValue(),
        email: updates.email || 'current@example.com',
        name: updates.name || 'Current Name',
        createdAt: new Date(),
        createdBy: actor.id,
      };

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user', error.message);
      throw error;
    }
  }
}

// ✅ FOCUS: Manual specification implementations
class EmailValidationSpecification implements ISpecification<string> {
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  isSatisfiedBy(email: string): boolean {
    return email && this.emailRegex.test(email);
  }

  getFailureReason(email: string): string {
    if (!email) return 'Email is required';
    return 'Invalid email format';
  }
}

class MinimumLengthSpecification implements ISpecification<string> {
  constructor(private readonly minLength: number) {}

  isSatisfiedBy(value: string): boolean {
    return value && value.length >= this.minLength;
  }

  getFailureReason(value: string): string {
    return `Value must be at least ${this.minLength} characters`;
  }
}
```

## Controller Integration

```typescript
// user.controller.ts
import { Controller, Post, Get, Put, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { SystemActor, UserActor } from '@vytches/ddd-contracts';
import { CreateUserData, UpdateUserData } from './types'; // From your app

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ✅ FOCUS: Contract integration in HTTP endpoint
  @Post()
  async createUser(@Body() userData: CreateUserData) {
    // Create system actor for the operation
    const actor = new SystemActor({
      source: 'user-controller',
      operation: 'createUser',
    });

    const user = await this.userService.createUser(userData, actor);

    return {
      success: true,
      data: user,
    };
  }

  @Get(':id')
  async getUser(@Param('id') userId: string) {
    const user = await this.userService.findUser(userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    return {
      success: true,
      data: user,
    };
  }

  @Put(':id')
  async updateUser(
    @Param('id') userId: string,
    @Body() updates: UpdateUserData
  ) {
    // Create user actor (in real app, from JWT/session)
    const actor = new UserActor('current-user-id', 'user', 'Current User', {
      permissions: ['user:update'],
    });

    const user = await this.userService.updateUser(userId, updates, actor);

    return {
      success: true,
      data: user,
    };
  }

  @Post(':id/validate')
  async validateUser(@Param('id') userId: string) {
    const user = await this.userService.findUser(userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const validation = await this.userService.validateUser(user);

    return {
      success: true,
      data: validation,
    };
  }
}

// ✅ FOCUS: Actor factory utilities
export class ActorFactory {
  static createSystemActor(source: string): SystemActor {
    return new SystemActor({
      source,
      timestamp: new Date(),
      permissions: ['*'], // System has all permissions
    });
  }

  static createUserActor(
    userId: string,
    userName: string,
    permissions: string[]
  ): UserActor {
    return new UserActor(userId, 'user', userName, {
      permissions,
      timestamp: new Date(),
      source: 'web-application',
    });
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

## Entity ID Utilities

```typescript
// entity-id.utils.ts
import { EntityId } from '@vytches/ddd-contracts';

export class EntityIdUtils {
  // ✅ FOCUS: NestJS-specific EntityId helpers
  static createFromParam(param: string): EntityId<string> {
    try {
      // Try UUID first
      if (this.isUuid(param)) {
        return EntityId.createUuid(param);
      }

      // Try integer
      if (this.isInteger(param)) {
        return EntityId.createInteger(parseInt(param));
      }

      // Default to text
      return EntityId.createText(param);
    } catch (error) {
      throw new Error(`Invalid ID parameter: ${param}`);
    }
  }

  static validateIds(ids: string[]): EntityId<string>[] {
    const validIds: EntityId<string>[] = [];

    for (const id of ids) {
      try {
        const entityId = this.createFromParam(id);
        validIds.push(entityId);
      } catch (error) {
        // Skip invalid IDs or throw based on requirements
        console.warn(`Skipping invalid ID: ${id}`);
      }
    }

    return validIds;
  }

  private static isUuid(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  private static isInteger(value: string): boolean {
    return /^\d+$/.test(value);
  }
}
```

## Key Points

- **Manual Setup**: Simple instantiation of contracts without complex DI
- **Standard NestJS Patterns**: Uses familiar NestJS decorators and patterns
- **Entity ID Integration**: Shows practical EntityId usage in HTTP endpoints
- **Actor Support**: Demonstrates actor pattern in web application context
- **Specification Usage**: Basic business rule validation with specifications
- **Error Handling**: Proper error handling following NestJS conventions

## Common Pitfalls

- **Parameter Validation**: Always validate EntityId parameters from HTTP
  requests
- **Actor Context**: Don't forget to create appropriate actors for operations
- **Specification Reuse**: Create reusable specification classes
- **Error Messages**: Provide meaningful error messages for validation failures

## Related Examples

- [Foundation Contracts](../../basic/foundation-contracts.md) - Core contract
  patterns
- [EntityId Usage](../../basic/entity-id-usage.md) - Detailed EntityId patterns
- [Event Interfaces](../intermediate/event-interfaces.md) - Advanced NestJS
  event patterns

## Best Practices

- Use EntityId for all entity identification
- Create actors for every operation with proper permissions
- Implement reusable specifications for common business rules
- Handle EntityId validation at service boundaries
- Use meaningful actor context information
- Implement proper error handling and logging
