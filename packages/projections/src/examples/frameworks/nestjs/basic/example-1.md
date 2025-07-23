# Simple Projection - NestJS Manual Setup

**Version**: 1.0.0 **Package**: @vytches-ddd/projections + NestJS
**Complexity**: basic **Framework**: NestJS **Integration**: Manual setup
**Dependencies**: @nestjs/common, @vytches-ddd/projections, @vytches-ddd/events

## Description

Basic NestJS service implementing simple event projections with manual
projection setup and event handling. This example shows how to integrate
@vytches-ddd/projections into a NestJS application using standard dependency
injection patterns.

## Business Context

E-commerce applications need real-time user profile updates from various user
events (registration, profile updates, preferences changes) to provide
personalized experiences and analytics dashboards.

## Service Implementation

```typescript
// user-profile-projection.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ProjectionBase, EventHandler } from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { UserData } from '../types'; // From your application

@Injectable()
export class UserProfileProjectionService
  extends ProjectionBase<any>
  implements OnModuleInit
{
  constructor() {
    super('UserProfileProjection', 'v1.0');
    this.initializeProjection();
  }

  async onModuleInit(): Promise<void> {
    // Initialize projection when NestJS module starts
    console.log('User Profile Projection Service initialized');
  }

  private initializeProjection(): void {
    // Set initial projection state
    this.setState({
      users: new Map<string, UserData>(),
      stats: {
        totalUsers: 0,
        activeUsers: 0,
        lastUpdated: new Date(),
      },
    });
  }

  // ⭐ FOCUS: Manual event handler registration
  @EventHandler('UserRegistered')
  async onUserRegistered(event: IDomainEvent): Promise<void> {
    const userData = event.payload as UserData;
    const currentState = this.getState();

    const user: UserData = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      createdAt: new Date(event.timestamp),
      isActive: true,
      preferences: userData.preferences || {},
    };

    // Update projection state
    currentState.users.set(user.id, user);
    currentState.stats.totalUsers = currentState.users.size;
    currentState.stats.activeUsers = Array.from(
      currentState.users.values()
    ).filter(u => u.isActive).length;
    currentState.stats.lastUpdated = new Date();

    this.setState(currentState);

    console.log(`User profile created: ${user.name} (${user.id})`);
  }

  @EventHandler('UserProfileUpdated')
  async onUserProfileUpdated(event: IDomainEvent): Promise<void> {
    const updateData = event.payload;
    const currentState = this.getState();
    const existingUser = currentState.users.get(updateData.userId);

    if (!existingUser) {
      console.warn(`User ${updateData.userId} not found for profile update`);
      return;
    }

    // Update user profile
    const updatedUser: UserData = {
      ...existingUser,
      name: updateData.name || existingUser.name,
      email: updateData.email || existingUser.email,
      preferences: {
        ...existingUser.preferences,
        ...(updateData.preferences || {}),
      },
    };

    currentState.users.set(updatedUser.id, updatedUser);
    currentState.stats.lastUpdated = new Date();
    this.setState(currentState);

    console.log(`User profile updated: ${updatedUser.name}`);
  }

  @EventHandler('UserDeactivated')
  async onUserDeactivated(event: IDomainEvent): Promise<void> {
    const deactivationData = event.payload;
    const currentState = this.getState();
    const user = currentState.users.get(deactivationData.userId);

    if (!user) {
      console.warn(
        `User ${deactivationData.userId} not found for deactivation`
      );
      return;
    }

    // Mark user as inactive
    user.isActive = false;
    currentState.users.set(user.id, user);
    currentState.stats.activeUsers = Array.from(
      currentState.users.values()
    ).filter(u => u.isActive).length;
    currentState.stats.lastUpdated = new Date();

    this.setState(currentState);
    console.log(`User deactivated: ${user.name}`);
  }

  // ✅ FOCUS: Query methods for NestJS controllers
  getUserById(userId: string): UserData | undefined {
    const state = this.getState();
    return state.users.get(userId);
  }

  getAllUsers(): UserData[] {
    const state = this.getState();
    return Array.from(state.users.values());
  }

  getActiveUsers(): UserData[] {
    const state = this.getState();
    return Array.from(state.users.values()).filter(user => user.isActive);
  }

  getUserStats(): any {
    const state = this.getState();
    return {
      totalUsers: state.stats.totalUsers,
      activeUsers: state.stats.activeUsers,
      inactiveUsers: state.stats.totalUsers - state.stats.activeUsers,
      lastUpdated: state.stats.lastUpdated,
    };
  }

  getUsersByPreference(
    preferenceKey: string,
    preferenceValue: any
  ): UserData[] {
    const state = this.getState();
    return Array.from(state.users.values()).filter(
      user => user.preferences[preferenceKey] === preferenceValue
    );
  }

  // ✅ FOCUS: Manual event processing method
  async processEvent(event: IDomainEvent): Promise<void> {
    try {
      await this.handle(event);
    } catch (error) {
      console.error(`Error processing event ${event.eventType}:`, error);
      throw error;
    }
  }
}
```

## Controller Integration

```typescript
// user-profile.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserProfileProjectionService } from './user-profile-projection.service';
import { UserData } from '../types'; // From your application

@Controller('api/user-profiles')
export class UserProfileController {
  constructor(
    private readonly userProfileProjection: UserProfileProjectionService
  ) {}

  @Get('stats')
  getUserStats() {
    return this.userProfileProjection.getUserStats();
  }

  @Get('active')
  getActiveUsers(): UserData[] {
    return this.userProfileProjection.getActiveUsers();
  }

  @Get('search')
  getUsersByPreference(
    @Query('key') preferenceKey: string,
    @Query('value') preferenceValue: string
  ): UserData[] {
    return this.userProfileProjection.getUsersByPreference(
      preferenceKey,
      preferenceValue
    );
  }

  @Get(':userId')
  getUserById(@Param('userId') userId: string): UserData | undefined {
    const user = this.userProfileProjection.getUserById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    return user;
  }

  @Get()
  getAllUsers(): UserData[] {
    return this.userProfileProjection.getAllUsers();
  }
}
```

## Module Configuration

```typescript
// user-profile.module.ts
import { Module } from '@nestjs/common';
import { UserProfileProjectionService } from './user-profile-projection.service';
import { UserProfileController } from './user-profile.controller';

@Module({
  providers: [UserProfileProjectionService],
  controllers: [UserProfileController],
  exports: [UserProfileProjectionService], // Export for use in other modules
})
export class UserProfileModule {}
```

## Event Processing Integration

```typescript
// event-processor.service.ts
import { Injectable } from '@nestjs/common';
import { UserProfileProjectionService } from './user-profile-projection.service';
import { IDomainEvent } from '@vytches-ddd/events';

@Injectable()
export class EventProcessorService {
  constructor(
    private readonly userProfileProjection: UserProfileProjectionService
  ) {}

  async processUserEvent(event: IDomainEvent): Promise<void> {
    try {
      // Route events to appropriate projections
      if (this.isUserEvent(event.eventType)) {
        await this.userProfileProjection.processEvent(event);
      }
    } catch (error) {
      console.error('Event processing failed:', error);
      // In production, implement proper error handling and retry logic
      throw error;
    }
  }

  private isUserEvent(eventType: string): boolean {
    const userEvents = [
      'UserRegistered',
      'UserProfileUpdated',
      'UserDeactivated',
    ];
    return userEvents.includes(eventType);
  }
}
```

## Usage Example

```typescript
// In your NestJS application
export class AppService {
  constructor(
    private readonly eventProcessor: EventProcessorService,
    private readonly userProjection: UserProfileProjectionService
  ) {}

  async handleUserRegistration(userData: UserData): Promise<void> {
    // Create domain event
    const event: IDomainEvent = {
      eventId: 'evt-' + Date.now(),
      eventType: 'UserRegistered',
      aggregateId: userData.id,
      payload: userData,
      timestamp: new Date(),
      version: 1,
    };

    // Process through projection
    await this.eventProcessor.processUserEvent(event);

    // Query updated state
    const user = this.userProjection.getUserById(userData.id);
    console.log('User registered and projected:', user);
  }

  async getUserDashboardData(userId: string): Promise<any> {
    const user = this.userProjection.getUserById(userId);
    const stats = this.userProjection.getUserStats();

    return {
      userProfile: user,
      systemStats: stats,
      relatedUsers: this.userProjection.getActiveUsers().slice(0, 5),
    };
  }
}
```

## Testing

```typescript
// user-profile-projection.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileProjectionService } from './user-profile-projection.service';
import { IDomainEvent } from '@vytches-ddd/events';

describe('UserProfileProjectionService', () => {
  let service: UserProfileProjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserProfileProjectionService],
    }).compile();

    service = module.get<UserProfileProjectionService>(
      UserProfileProjectionService
    );
  });

  it('should create user profile on UserRegistered event', async () => {
    const event: IDomainEvent = {
      eventId: 'test-1',
      eventType: 'UserRegistered',
      aggregateId: 'user-123',
      payload: {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      },
      timestamp: new Date(),
      version: 1,
    };

    await service.processEvent(event);

    const user = service.getUserById('user-123');
    expect(user).toBeDefined();
    expect(user?.name).toBe('John Doe');
    expect(user?.isActive).toBe(true);
  });

  it('should update user stats correctly', async () => {
    // Create multiple users
    for (let i = 1; i <= 3; i++) {
      const event: IDomainEvent = {
        eventId: `test-${i}`,
        eventType: 'UserRegistered',
        aggregateId: `user-${i}`,
        payload: {
          id: `user-${i}`,
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
        timestamp: new Date(),
        version: 1,
      };
      await service.processEvent(event);
    }

    const stats = service.getUserStats();
    expect(stats.totalUsers).toBe(3);
    expect(stats.activeUsers).toBe(3);
  });
});
```

## Key Features

- **Simple Integration**: Easy NestJS service integration with standard DI
  patterns
- **Manual Control**: Full control over projection lifecycle and event handling
- **Type Safety**: Full TypeScript support with proper typing
- **Query Methods**: Convenient methods for querying projection state
- **Error Handling**: Proper error handling and logging
- **Testable**: Easy to unit test with NestJS testing utilities

## Best Practices

- Use `OnModuleInit` for projection initialization
- Implement proper error handling in event processors
- Export projection services for use in other modules
- Use descriptive method names for query operations
- Implement comprehensive unit tests
- Add proper logging for debugging and monitoring

## Common Pitfalls

- **Missing Initialization**: Forgetting to call projection setup methods
- **State Mutations**: Directly mutating projection state instead of using
  setState
- **Error Propagation**: Not properly handling and propagating event processing
  errors
- **Memory Leaks**: Not cleaning up event handlers or large state objects

## Related Examples

- [Projection with Capabilities](./example-2.md)
- [Projection Engine Integration](../intermediate/example-1.md)
- [DI Integration](../intermediate/example-1.md)
