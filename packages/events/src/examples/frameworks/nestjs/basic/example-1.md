# Event System - NestJS Basic Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: basic
**Domain**: Integration **Patterns**: event-publishing, repository-pattern,
domain-events, nestjs-integration **Dependencies**: @nestjs/common,
@vytches/ddd-events, @vytches/ddd-repositories

## Description

Basic NestJS integration with the Unified Event System using manual setup. This
example demonstrates how to integrate automatic event publishing through the
repository pattern in a NestJS application with clean separation of concerns.

## Business Context

NestJS applications need to publish domain events when business operations
occur, such as user registration, order processing, or inventory updates. The
repository pattern provides automatic event publishing when aggregates are
saved, ensuring events are consistently published without requiring manual event
handling in controllers.

## Code Example

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches/ddd-events';
import { UserRepository } from './user.repository';
import { User, CreateUserData, UpdateUserData } from './types'; // From your app

@Injectable()
export class UserService {
  private readonly eventBus: UnifiedEventBus;
  private readonly eventDispatcher: UniversalEventDispatcher;

  constructor(private readonly userRepository: UserRepository) {
    // ⭐ FOCUS: Manual event system setup
    this.eventBus = new UnifiedEventBus();
    this.eventDispatcher = new UniversalEventDispatcher(this.eventBus);
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      // ⭐ FOCUS: Repository automatically publishes events when saving
      const user = User.create(userData);
      await this.userRepository.save(user);

      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(userId: string, userData: UpdateUserData): Promise<User> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // ⭐ FOCUS: Business operation that triggers domain events
      user.updateProfile(userData);
      await this.userRepository.save(user); // Automatically publishes events

      return user;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // ⭐ FOCUS: Archive user instead of hard delete
      user.archive('User requested deletion');
      await this.userRepository.save(user); // Publishes UserArchivedEvent
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

// user.controller.ts
import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserData, UpdateUserData } from './types'; // From your app

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() userData: CreateUserData) {
    // ⭐ FOCUS: Controller delegates to service, events published automatically
    return await this.userService.createUser(userData);
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() userData: UpdateUserData) {
    return await this.userService.updateUser(id, userData);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }
}

// notification.service.ts
import { Injectable } from '@nestjs/common';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { UserCreatedEvent, UserUpdatedEvent, UserArchivedEvent } from './types'; // From your app

@Injectable()
export class NotificationService {
  private readonly eventBus: UnifiedEventBus;

  constructor() {
    this.eventBus = new UnifiedEventBus();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // ⭐ FOCUS: Subscribe to domain events
    this.eventBus.subscribe('UserCreated', async (event: UserCreatedEvent) => {
      await this.sendWelcomeEmail(event);
    });

    this.eventBus.subscribe('UserUpdated', async (event: UserUpdatedEvent) => {
      await this.sendProfileUpdateNotification(event);
    });

    this.eventBus.subscribe(
      'UserArchived',
      async (event: UserArchivedEvent) => {
        await this.sendGoodbyeEmail(event);
      }
    );
  }

  private async sendWelcomeEmail(event: UserCreatedEvent): Promise<void> {
    // ⭐ FOCUS: Handle domain event with business logic
    console.log(`Sending welcome email to ${event.email}`);
    // Email sending implementation
  }

  private async sendProfileUpdateNotification(
    event: UserUpdatedEvent
  ): Promise<void> {
    console.log(`Sending profile update notification to user ${event.userId}`);
    // Notification implementation
  }

  private async sendGoodbyeEmail(event: UserArchivedEvent): Promise<void> {
    console.log(`Sending goodbye email to user ${event.userId}`);
    // Email sending implementation
  }
}

// user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { NotificationService } from './notification.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository, NotificationService],
  exports: [UserService],
})
export class UserModule {}
```

## Key Features

- **Repository Pattern Integration**: Automatic event publishing when aggregates
  are saved
- **Domain Event Handling**: Subscribe to and handle domain events across
  services
- **Clean Architecture**: Separation between controllers, services, and event
  handling
- **Manual Setup**: Simple, explicit event system configuration
- **Error Handling**: Proper error handling with meaningful messages

## Integration Benefits

1. **Automatic Event Publishing**: No manual event publishing required
2. **Loose Coupling**: Services communicate through events, not direct
   dependencies
3. **Consistency**: Repository pattern ensures events are always published
4. **Testability**: Easy to test services and event handlers independently
5. **Scalability**: Event-driven architecture supports growth

## Common Pitfalls

- **Event Bus Isolation**: Each service creates its own event bus - consider
  sharing instance
- **Error Handling**: Ensure event handlers don't throw unhandled exceptions
- **Memory Leaks**: Properly manage event subscriptions in service lifecycle
- **Event Ordering**: Events are processed asynchronously - don't rely on order

## Related Examples

- [Repository Pattern with Event Publishing](../../basic/example-1.md)
- [Event Handlers with Context Filtering](../../basic/example-2.md)
- [NestJS DI Integration](./example-2.md)
