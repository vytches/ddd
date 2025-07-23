# Event Interfaces with NestJS

**Focus**: Advanced event interface patterns with NestJS integration **Base
Example**: [Event Interface Architecture](../../basic/event-interfaces.md)
**Dependencies**: @nestjs/common, @nestjs/cqrs, @vytches-ddd/contracts

## Description

This example demonstrates advanced integration of VytchesDDD event interfaces
with NestJS, showing domain event handling, event bus integration, and
sophisticated event-driven patterns using NestJS CQRS module.

## Event Handler Implementation

```typescript
// user-events.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import {
  IDomainEvent,
  IEventHandler as VytchesEventHandler,
} from '@vytches-ddd/contracts';
import {
  UserRegisteredEvent,
  UserProfileUpdatedEvent,
  EmailService,
  NotificationService,
} from './types'; // From your app

// ✅ FOCUS: NestJS event handler with VytchesDDD contracts
@EventsHandler(UserRegisteredEvent)
@Injectable()
export class UserRegisteredHandler
  implements IEventHandler<UserRegisteredEvent>
{
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService
  ) {}

  async handle(event: UserRegisteredEvent): Promise<void> {
    try {
      this.logger.log('Processing user registration event', {
        userId: event.aggregateId,
        email: event.payload.email,
        correlationId: event.metadata.correlationId,
        eventType: event.eventType,
      });

      // Send welcome email
      await this.emailService.sendWelcomeEmail({
        to: event.payload.email,
        userId: event.payload.userId,
        userName: event.payload.name,
        registrationDate: event.payload.registrationDate,
      });

      // Create user profile notifications
      await this.notificationService.createWelcomeNotifications({
        userId: event.payload.userId,
        email: event.payload.email,
        preferences: event.payload.preferences,
      });

      // Update analytics
      await this.trackUserRegistration(event);

      this.logger.log('User registration event processed successfully', {
        userId: event.aggregateId,
        correlationId: event.metadata.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to process user registration event', {
        userId: event.aggregateId,
        error: error.message,
        correlationId: event.metadata.correlationId,
      });
      throw error;
    }
  }

  private async trackUserRegistration(
    event: UserRegisteredEvent
  ): Promise<void> {
    // Analytics tracking logic
    const analyticsData = {
      eventType: event.eventType,
      userId: event.aggregateId,
      timestamp: event.occurredAt,
      source: event.metadata.source,
      userType: event.payload.userType,
    };

    // In real implementation, send to analytics service
    this.logger.debug('Tracking user registration', analyticsData);
  }
}

// ✅ FOCUS: Multi-event handler pattern
@Injectable()
export class UserProfileEventHandler
  implements VytchesEventHandler<UserProfileUpdatedEvent>
{
  private readonly logger = new Logger(UserProfileEventHandler.name);

  constructor(
    private readonly profileSyncService: ProfileSyncService,
    private readonly auditService: AuditService
  ) {}

  async handle(event: UserProfileUpdatedEvent): Promise<void> {
    try {
      this.logger.log('Processing profile update event', {
        userId: event.aggregateId,
        changes: Object.keys(event.payload.changes),
        correlationId: event.metadata.correlationId,
      });

      // Sync profile across services
      await this.profileSyncService.syncProfile({
        userId: event.aggregateId,
        changes: event.payload.changes,
        timestamp: event.occurredAt,
      });

      // Create audit entry
      await this.auditService.logProfileChange({
        userId: event.aggregateId,
        changes: event.payload.changes,
        previousValues: event.payload.previousValues,
        actor: event.metadata.actor,
        timestamp: event.occurredAt,
      });

      // Trigger downstream events if needed
      if (event.payload.changes.email) {
        await this.handleEmailChange(event);
      }

      if (event.payload.changes.preferences) {
        await this.handlePreferencesChange(event);
      }
    } catch (error) {
      this.logger.error('Failed to process profile update event', {
        userId: event.aggregateId,
        error: error.message,
        correlationId: event.metadata.correlationId,
      });
      throw error;
    }
  }

  private async handleEmailChange(
    event: UserProfileUpdatedEvent
  ): Promise<void> {
    // Handle email change specific logic
    this.logger.log('Processing email change', {
      userId: event.aggregateId,
      oldEmail: event.payload.previousValues.email,
      newEmail: event.payload.changes.email,
    });
  }

  private async handlePreferencesChange(
    event: UserProfileUpdatedEvent
  ): Promise<void> {
    // Handle preferences change specific logic
    this.logger.log('Processing preferences change', {
      userId: event.aggregateId,
      preferences: event.payload.changes.preferences,
    });
  }
}
```

## Event Bus Integration Service

```typescript
// domain-event.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { IEventBus, IDomainEvent, IEventHandler } from '@vytches-ddd/contracts';

@Injectable()
export class DomainEventService implements IEventBus {
  private readonly logger = new Logger(DomainEventService.name);
  private handlers = new Map<string, IEventHandler<any>[]>();

  constructor(private readonly nestEventBus: EventBus) {}

  // ✅ FOCUS: Bridging VytchesDDD events with NestJS CQRS
  async publish<T extends IDomainEvent>(event: T): Promise<void> {
    try {
      this.logger.debug('Publishing domain event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        correlationId: event.metadata.correlationId,
      });

      // Publish to NestJS event bus
      await this.nestEventBus.publish(event);

      // Also handle through VytchesDDD handlers if registered
      const eventHandlers = this.handlers.get(event.eventType) || [];

      if (eventHandlers.length > 0) {
        const handlerPromises = eventHandlers.map(async handler => {
          try {
            await handler.handle(event);
          } catch (error) {
            this.logger.error('VytchesDDD event handler failed', {
              eventType: event.eventType,
              handlerName: handler.constructor.name,
              error: error.message,
              correlationId: event.metadata.correlationId,
            });
            throw error;
          }
        });

        await Promise.all(handlerPromises);
      }

      this.logger.debug('Domain event published successfully', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        handlerCount: eventHandlers.length,
      });
    } catch (error) {
      this.logger.error('Failed to publish domain event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error: error.message,
      });
      throw error;
    }
  }

  async publishMany<T extends IDomainEvent>(events: T[]): Promise<void> {
    const publishPromises = events.map(event => this.publish(event));
    await Promise.all(publishPromises);
  }

  subscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler);

    this.logger.log('Event handler subscribed', {
      eventType,
      handlerName: handler.constructor.name,
      totalHandlers: this.handlers.get(eventType)!.length,
    });
  }

  unsubscribe<T extends IDomainEvent>(
    eventType: string,
    handler: IEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(eventType);
    if (!eventHandlers) return;

    const index = eventHandlers.indexOf(handler);
    if (index !== -1) {
      eventHandlers.splice(index, 1);
      this.logger.log('Event handler unsubscribed', {
        eventType,
        handlerName: handler.constructor.name,
      });
    }
  }

  getHandlers<T extends IDomainEvent>(eventType: string): IEventHandler<T>[] {
    return this.handlers.get(eventType) || [];
  }

  clear(): void {
    this.handlers.clear();
    this.logger.log('All event handlers cleared');
  }
}
```

## Domain Event Publisher

```typescript
// event-publisher.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DomainEventService } from './domain-event.service';
import { IDomainEvent, EntityId, IActor } from '@vytches-ddd/contracts';
import {
  UserRegisteredEvent,
  UserProfileUpdatedEvent,
  OrderCreatedEvent,
} from './types'; // From your app

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly domainEventService: DomainEventService) {}

  // ✅ FOCUS: Publishing domain events from NestJS services
  async publishUserRegistered(
    userId: EntityId<string>,
    userData: {
      email: string;
      name: string;
      userType: 'standard' | 'premium';
    },
    actor: IActor
  ): Promise<void> {
    const event = new UserRegisteredEvent(
      userId.getValue(),
      {
        userId: userId.getValue(),
        email: userData.email,
        name: userData.name,
        registrationDate: new Date(),
        userType: userData.userType,
        preferences: {
          newsletter: true,
          notifications: true,
        },
      },
      {
        correlationId: this.generateCorrelationId(),
        causationId: undefined,
        actor: actor.id,
        timestamp: new Date(),
        source: 'UserService',
      }
    );

    await this.domainEventService.publish(event);
  }

  async publishUserProfileUpdated(
    userId: EntityId<string>,
    changes: Record<string, any>,
    previousValues: Record<string, any>,
    actor: IActor
  ): Promise<void> {
    const event = new UserProfileUpdatedEvent(
      userId.getValue(),
      {
        userId: userId.getValue(),
        changes,
        previousValues,
        updatedAt: new Date(),
        reason: 'user_update',
      },
      {
        correlationId: this.generateCorrelationId(),
        causationId: undefined,
        actor: actor.id,
        timestamp: new Date(),
        source: 'UserService',
      }
    );

    await this.domainEventService.publish(event);
  }

  // ✅ FOCUS: Batch event publishing
  async publishUserEvents(
    events: {
      userId: EntityId<string>;
      eventType: 'registered' | 'updated' | 'deleted';
      data: any;
      actor: IActor;
    }[]
  ): Promise<void> {
    const domainEvents: IDomainEvent[] = [];

    for (const eventData of events) {
      let domainEvent: IDomainEvent;

      switch (eventData.eventType) {
        case 'registered':
          domainEvent = this.createUserRegisteredEvent(
            eventData.userId,
            eventData.data,
            eventData.actor
          );
          break;
        case 'updated':
          domainEvent = this.createUserUpdatedEvent(
            eventData.userId,
            eventData.data,
            eventData.actor
          );
          break;
        default:
          continue;
      }

      domainEvents.push(domainEvent);
    }

    if (domainEvents.length > 0) {
      await this.domainEventService.publishMany(domainEvents);
    }
  }

  private createUserRegisteredEvent(
    userId: EntityId<string>,
    data: any,
    actor: IActor
  ): UserRegisteredEvent {
    return new UserRegisteredEvent(userId.getValue(), data, {
      correlationId: this.generateCorrelationId(),
      actor: actor.id,
      timestamp: new Date(),
      source: 'UserService',
    });
  }

  private createUserUpdatedEvent(
    userId: EntityId<string>,
    data: any,
    actor: IActor
  ): UserProfileUpdatedEvent {
    return new UserProfileUpdatedEvent(userId.getValue(), data, {
      correlationId: this.generateCorrelationId(),
      actor: actor.id,
      timestamp: new Date(),
      source: 'UserService',
    });
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Integration with Application Services

```typescript
// user-application.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EntityId, IActor } from '@vytches-ddd/contracts';
import { EventPublisherService } from './event-publisher.service';
import { User, CreateUserData, UpdateUserData, UserRepository } from './types'; // From your app

@Injectable()
export class UserApplicationService {
  private readonly logger = new Logger(UserApplicationService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisherService
  ) {}

  // ✅ FOCUS: Service method with event publishing
  async createUser(userData: CreateUserData, actor: IActor): Promise<User> {
    try {
      // Create user entity
      const userId = EntityId.createWithRandomUUID();
      const user: User = {
        id: userId.getValue(),
        email: userData.email,
        name: userData.name,
        createdAt: new Date(),
        createdBy: actor.id,
      };

      // Save to repository
      await this.userRepository.save(user);

      // Publish domain event
      await this.eventPublisher.publishUserRegistered(
        userId,
        {
          email: userData.email,
          name: userData.name,
          userType: userData.userType || 'standard',
        },
        actor
      );

      this.logger.log('User created successfully', {
        userId: userId.getValue(),
        email: userData.email,
        actorId: actor.id,
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', {
        email: userData.email,
        error: error.message,
        actorId: actor.id,
      });
      throw error;
    }
  }

  async updateUser(
    userId: string,
    updates: UpdateUserData,
    actor: IActor
  ): Promise<User> {
    try {
      const entityId = EntityId.createText(userId);

      // Get current user
      const currentUser = await this.userRepository.findById(entityId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Store previous values for event
      const previousValues = {
        email: currentUser.email,
        name: currentUser.name,
      };

      // Update user
      const updatedUser: User = {
        ...currentUser,
        ...updates,
        updatedAt: new Date(),
      };

      await this.userRepository.save(updatedUser);

      // Publish domain event
      await this.eventPublisher.publishUserProfileUpdated(
        entityId,
        updates,
        previousValues,
        actor
      );

      this.logger.log('User updated successfully', {
        userId: entityId.getValue(),
        changes: Object.keys(updates),
        actorId: actor.id,
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user', {
        userId,
        error: error.message,
        actorId: actor.id,
      });
      throw error;
    }
  }
}
```

## Module Configuration

```typescript
// user-events.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DomainEventService } from './domain-event.service';
import { EventPublisherService } from './event-publisher.service';
import { UserApplicationService } from './user-application.service';
import {
  UserRegisteredHandler,
  UserProfileEventHandler,
} from './user-events.handler';

@Module({
  imports: [CqrsModule],
  providers: [
    DomainEventService,
    EventPublisherService,
    UserApplicationService,
    UserRegisteredHandler,
    UserProfileEventHandler,
  ],
  exports: [DomainEventService, EventPublisherService, UserApplicationService],
})
export class UserEventsModule {
  constructor(
    private readonly domainEventService: DomainEventService,
    private readonly userProfileHandler: UserProfileEventHandler
  ) {
    // ✅ FOCUS: Register VytchesDDD handlers manually
    this.domainEventService.subscribe(
      'UserProfileUpdated',
      this.userProfileHandler
    );
  }
}
```

## Key Points

- **Dual Event Handling**: Supports both NestJS CQRS and VytchesDDD event
  patterns
- **Event Bridge**: Seamless integration between frameworks
- **Domain Event Publishing**: Clean separation of business logic and event
  publishing
- **Advanced Patterns**: Batch publishing, correlation tracking, error handling
- **NestJS Integration**: Uses familiar NestJS decorators and dependency
  injection
- **Actor Context**: Proper actor propagation through event metadata

## Common Pitfalls

- **Event Handler Registration**: Don't forget to register VytchesDDD handlers
  manually
- **Correlation IDs**: Always include correlation IDs for event traceability
- **Error Handling**: Implement proper error handling in event handlers
- **Event Ordering**: Be aware of event processing order in complex scenarios

## Related Examples

- [Event Interface Architecture](../../basic/event-interfaces.md) - Core event
  patterns
- [Advanced Event Architecture](../../intermediate/event-architecture.md) -
  Persistence and replay
- [Contracts Integration](../basic/contracts-integration.md) - Basic NestJS
  patterns

## Best Practices

- Use correlation IDs for event traceability
- Implement idempotent event handlers
- Separate domain events from integration events
- Handle event failures gracefully
- Log all event processing for observability
- Use meaningful event names and payloads
- Implement proper error handling and retry logic
