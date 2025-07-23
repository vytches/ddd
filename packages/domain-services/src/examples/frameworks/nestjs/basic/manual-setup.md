# Manual Domain Service Setup - NestJS Basic

**Focus**: Basic @vytches-ddd/domain-services usage in NestJS with manual
instantiation **Base Example**:
[Basic Domain Service](../../../basic/example-1.md) **Dependencies**:
@nestjs/common, @vytches-ddd/core

## Service Implementation

```typescript
// user-management.service.ts
import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '@vytches-ddd/domain-services';
import { Result } from '@vytches-ddd/utils';
import { User, CreateUserCommand, UserCreatedEvent } from '../types';

@Injectable()
export class UserManagementService extends BaseDomainService {
  constructor() {
    super('UserManagementService');
  }

  /**
   * Creates a new user with validation and notification
   */
  async createUser(command: CreateUserCommand): Promise<Result<User, Error>> {
    try {
      // ⭐ FOCUS: Library domain service pattern
      const validation = await this.validateUser(command);
      if (validation.isFailure()) {
        return Result.failure(validation.error);
      }

      const user = await this.buildUser(command);
      const savedUser = await this.saveUser(user);

      await this.publishUserCreatedEvent(savedUser);
      await this.sendWelcomeNotification(savedUser);

      return Result.success(savedUser);
    } catch (error) {
      return Result.failure(
        new Error(`User creation failed: ${error.message}`)
      );
    }
  }

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

  private async saveUser(user: User): Promise<User> {
    console.log('Saving user:', user.id);
    return user;
  }

  private async publishUserCreatedEvent(user: User): Promise<void> {
    const event: UserCreatedEvent = {
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    console.log('Publishing UserCreatedEvent:', event);
  }

  private async sendWelcomeNotification(user: User): Promise<void> {
    console.log(`Sending welcome notification to ${user.email}`);
  }

  private generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Controller Integration

```typescript
// user.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { CreateUserCommand } from '../types';

@Controller('users')
export class UserController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  async createUser(@Body() command: CreateUserCommand) {
    // ⭐ FOCUS: Direct service usage
    const result = await this.userManagementService.createUser(command);

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return result.value;
  }
}
```

## Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserManagementService } from './user-management.service';

@Module({
  controllers: [UserController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserModule {}
```

## Key Points

- **Manual Setup**: Simple manual instantiation of domain service
- **Standard NestJS DI**: Uses standard NestJS dependency injection
- **Direct Library Usage**: Extends BaseDomainService from
  @vytches-ddd/domain-services
- **Simple Integration**: Minimal configuration required
- **Framework Pattern**: Follows standard NestJS service patterns

## Related Examples

- [Simple NestJS Service](./simple-service.md) - Alternative approach
- [Basic Domain Service](../../../basic/example-1.md) - Core library usage
- [DI Integration](../intermediate/di-integration.md) - Advanced dependency
  injection
