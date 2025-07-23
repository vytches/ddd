# Simple Event Projection

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: basic
**Domain**: Event Sourcing
**Patterns**: Event projection, read models, event handling
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events

## Description

Basic event projection implementation that creates read models from domain events. This example demonstrates the fundamental concepts of event projections, including event handling, state building, and read model generation for efficient querying.

## Business Context

Applications need optimized views for different use cases:
- User profiles aggregated from registration and update events
- Order summaries combining multiple order-related events
- Product catalogs built from inventory and pricing events
- Dashboard metrics calculated from business activity events

Event projections transform write-side events into read-optimized data structures, enabling fast queries and reporting without impacting the write side performance.

## Code Example

```typescript
// simple-event-projection.ts
import { 
  ProjectionBase, 
  ProjectionProcessor,
  EventHandler 
} from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { 
  UserData,
  ProjectionData,
  ProjectionMetadata,
  ProjectionEventType 
} from '../types';

// ✅ FOCUS: Simple event projection implementation
export class UserProfileProjection extends ProjectionBase<UserData> {
  constructor() {
    super('UserProfileProjection', 'v1.0');
    
    // Initialize with empty state
    this.setState({
      users: new Map<string, UserData>(),
      totalUsers: 0,
      activeUsers: 0,
      lastUpdated: new Date(),
    });
  }

  // Handle user registration events
  @EventHandler('UserRegistered')
  async onUserRegistered(event: IDomainEvent): Promise<void> {
    const userData = event.payload;
    
    try {
      // Create user profile from registration data
      const userProfile: UserData = {
        id: userData.userId,
        email: userData.email,
        name: userData.name,
        role: userData.role || 'user',
        createdAt: new Date(event.timestamp),
        lastLoginAt: undefined,
        preferences: userData.preferences || {},
      };

      // Update projection state
      const currentState = this.getState();
      currentState.users.set(userProfile.id, userProfile);
      currentState.totalUsers = currentState.users.size;
      currentState.activeUsers += 1;
      currentState.lastUpdated = new Date();

      this.setState(currentState);

      // Log successful projection update
      console.log(`User profile created: ${userProfile.name} (${userProfile.id})`);
      
    } catch (error) {
      console.error('Error processing UserRegistered event:', error);
      throw error;
    }
  }

  // Handle user profile update events
  @EventHandler('UserProfileUpdated')
  async onUserProfileUpdated(event: IDomainEvent): Promise<void> {
    const updateData = event.payload;
    
    try {
      const currentState = this.getState();
      const existingUser = currentState.users.get(updateData.userId);
      
      if (!existingUser) {
        console.warn(`User ${updateData.userId} not found for profile update`);
        return;
      }

      // Update user profile with new data
      const updatedUser: UserData = {
        ...existingUser,
        name: updateData.name || existingUser.name,
        email: updateData.email || existingUser.email,
        role: updateData.role || existingUser.role,
        preferences: {
          ...existingUser.preferences,
          ...(updateData.preferences || {}),
        },
      };

      currentState.users.set(updatedUser.id, updatedUser);
      currentState.lastUpdated = new Date();
      
      this.setState(currentState);

      console.log(`User profile updated: ${updatedUser.name} (${updatedUser.id})`);
      
    } catch (error) {
      console.error('Error processing UserProfileUpdated event:', error);
      throw error;
    }
  }

  // Handle user login events to track activity
  @EventHandler('UserLoggedIn')
  async onUserLoggedIn(event: IDomainEvent): Promise<void> {
    const loginData = event.payload;
    
    try {
      const currentState = this.getState();
      const existingUser = currentState.users.get(loginData.userId);
      
      if (!existingUser) {
        console.warn(`User ${loginData.userId} not found for login tracking`);
        return;
      }

      // Update last login timestamp
      const updatedUser: UserData = {
        ...existingUser,
        lastLoginAt: new Date(event.timestamp),
      };

      currentState.users.set(updatedUser.id, updatedUser);
      currentState.lastUpdated = new Date();
      
      this.setState(currentState);

      console.log(`User login tracked: ${updatedUser.name} at ${updatedUser.lastLoginAt}`);
      
    } catch (error) {
      console.error('Error processing UserLoggedIn event:', error);
      throw error;
    }
  }

  // Handle user deactivation events
  @EventHandler('UserDeactivated')
  async onUserDeactivated(event: IDomainEvent): Promise<void> {
    const deactivationData = event.payload;
    
    try {
      const currentState = this.getState();
      const existingUser = currentState.users.get(deactivationData.userId);
      
      if (!existingUser) {
        console.warn(`User ${deactivationData.userId} not found for deactivation`);
        return;
      }

      // Mark user as deactivated (keep profile but update status)
      const deactivatedUser: UserData = {
        ...existingUser,
        role: 'deactivated',
        preferences: {
          ...existingUser.preferences,
          deactivatedAt: new Date(event.timestamp),
          deactivationReason: deactivationData.reason,
        },
      };

      currentState.users.set(deactivatedUser.id, deactivatedUser);
      currentState.activeUsers = Array.from(currentState.users.values())
        .filter(user => user.role !== 'deactivated').length;
      currentState.lastUpdated = new Date();
      
      this.setState(currentState);

      console.log(`User deactivated: ${deactivatedUser.name} (${deactivatedUser.id})`);
      
    } catch (error) {
      console.error('Error processing UserDeactivated event:', error);
      throw error;
    }
  }

  // Query methods for read model access
  getUserById(userId: string): UserData | undefined {
    return this.getState().users.get(userId);
  }

  getAllUsers(): UserData[] {
    return Array.from(this.getState().users.values());
  }

  getActiveUsers(): UserData[] {
    return Array.from(this.getState().users.values())
      .filter(user => user.role !== 'deactivated');
  }

  getUsersByRole(role: string): UserData[] {
    return Array.from(this.getState().users.values())
      .filter(user => user.role === role);
  }

  getRecentlyActiveUsers(daysBack: number = 30): UserData[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return Array.from(this.getState().users.values())
      .filter(user => user.lastLoginAt && user.lastLoginAt >= cutoffDate);
  }

  // Projection statistics and health
  getProjectionStatistics() {
    const state = this.getState();
    const users = Array.from(state.users.values());
    
    return {
      totalUsers: state.totalUsers,
      activeUsers: state.activeUsers,
      deactivatedUsers: users.filter(u => u.role === 'deactivated').length,
      recentlyActive: this.getRecentlyActiveUsers(7).length,
      usersByRole: this.getUserRoleDistribution(),
      lastUpdated: state.lastUpdated,
      projectionName: this.projectionName,
      version: this.version,
    };
  }

  private getUserRoleDistribution(): Record<string, number> {
    const users = Array.from(this.getState().users.values());
    const distribution: Record<string, number> = {};
    
    users.forEach(user => {
      distribution[user.role] = (distribution[user.role] || 0) + 1;
    });
    
    return distribution;
  }

  // Reset projection state (useful for rebuilding)
  reset(): void {
    this.setState({
      users: new Map<string, UserData>(),
      totalUsers: 0,
      activeUsers: 0,
      lastUpdated: new Date(),
    });
    
    console.log(`${this.projectionName} has been reset`);
  }

  // Validation method to ensure projection integrity
  validateState(): { isValid: boolean; errors: string[] } {
    const state = this.getState();
    const errors: string[] = [];
    
    // Check if user count matches map size
    if (state.totalUsers !== state.users.size) {
      errors.push(`Total user count mismatch: expected ${state.users.size}, got ${state.totalUsers}`);
    }
    
    // Check if active user count is correct
    const actualActiveUsers = Array.from(state.users.values())
      .filter(user => user.role !== 'deactivated').length;
    if (state.activeUsers !== actualActiveUsers) {
      errors.push(`Active user count mismatch: expected ${actualActiveUsers}, got ${state.activeUsers}`);
    }
    
    // Validate user data integrity
    for (const [id, user] of state.users) {
      if (user.id !== id) {
        errors.push(`User ID mismatch: map key ${id} does not match user.id ${user.id}`);
      }
      
      if (!user.email || !user.email.includes('@')) {
        errors.push(`Invalid email for user ${user.id}: ${user.email}`);
      }
      
      if (!user.name || user.name.trim().length === 0) {
        errors.push(`Empty name for user ${user.id}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Simple projection processor for running projections
export class SimpleProjectionProcessor {
  private projections: Map<string, ProjectionBase<any>> = new Map();
  private isProcessing = false;
  private eventQueue: IDomainEvent[] = [];
  private processingStats = {
    totalEvents: 0,
    successfulEvents: 0,
    failedEvents: 0,
    lastProcessedAt: new Date(),
  };

  registerProjection(projection: ProjectionBase<any>): void {
    this.projections.set(projection.projectionName, projection);
    console.log(`Registered projection: ${projection.projectionName}`);
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    if (!this.isProcessing) {
      await this.processEventsFromQueue();
    }
    
    this.eventQueue.push(event);
    
    if (!this.isProcessing) {
      await this.processEventsFromQueue();
    }
  }

  private async processEventsFromQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processSingleEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleEvent(event: IDomainEvent): Promise<void> {
    this.processingStats.totalEvents++;
    
    const promises: Promise<void>[] = [];
    
    for (const [name, projection] of this.projections) {
      try {
        // Check if projection can handle this event type
        if (projection.canHandle(event.eventType)) {
          promises.push(projection.handle(event));
        }
      } catch (error) {
        console.error(`Error processing event ${event.eventType} in projection ${name}:`, error);
        this.processingStats.failedEvents++;
      }
    }
    
    // Process all projections in parallel
    try {
      await Promise.all(promises);
      this.processingStats.successfulEvents++;
    } catch (error) {
      console.error(`Error in parallel projection processing:`, error);
      this.processingStats.failedEvents++;
    }
    
    this.processingStats.lastProcessedAt = new Date();
  }

  getProcessingStatistics() {
    return {
      ...this.processingStats,
      registeredProjections: this.projections.size,
      projectionNames: Array.from(this.projections.keys()),
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  getProjection<T>(name: string): ProjectionBase<T> | undefined {
    return this.projections.get(name) as ProjectionBase<T>;
  }

  getAllProjections(): ProjectionBase<any>[] {
    return Array.from(this.projections.values());
  }

  async stop(): Promise<void> {
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log('Projection processor stopped');
  }
}
```

## Key Features

- **Event-Driven Updates**: Automatic state updates from domain events
- **Type-Safe Handlers**: Strongly typed event handlers with decorators
- **Query Interface**: Optimized read methods for different access patterns
- **State Validation**: Built-in validation to ensure projection integrity
- **Statistics**: Comprehensive metrics and health monitoring
- **Reset Capability**: Support for projection rebuilding and maintenance

## Usage Examples

```typescript
// Create and setup projection
const userProjection = new UserProfileProjection();
const processor = new SimpleProjectionProcessor();

// Register projection with processor
processor.registerProjection(userProjection);

// Process events
await processor.processEvent({
  eventId: '12345',
  eventType: 'UserRegistered',
  aggregateId: 'user-1',
  payload: {
    userId: 'user-1',
    email: 'john@example.com',
    name: 'John Doe',
    role: 'user',
    preferences: { theme: 'dark' }
  },
  timestamp: new Date(),
  version: 1
});

await processor.processEvent({
  eventId: '12346',
  eventType: 'UserLoggedIn',
  aggregateId: 'user-1',
  payload: {
    userId: 'user-1',
    loginTime: new Date()
  },
  timestamp: new Date(),
  version: 2
});

// Query the projection
const user = userProjection.getUserById('user-1');
console.log('User profile:', user);

const activeUsers = userProjection.getActiveUsers();
console.log('Active users:', activeUsers.length);

const stats = userProjection.getProjectionStatistics();
console.log('Projection statistics:', stats);

// Validate projection state
const validation = userProjection.validateState();
if (!validation.isValid) {
  console.error('Projection validation errors:', validation.errors);
}

// Get processor statistics
const processingStats = processor.getProcessingStatistics();
console.log('Processing statistics:', processingStats);
```

## Event Handling Patterns

### **Idempotent Operations**
Handle duplicate events gracefully without corrupting state.

### **State Validation**  
Ensure projection consistency with built-in validation methods.

### **Error Recovery**
Proper error handling prevents projection corruption from bad events.

### **Query Optimization**
Provide multiple query methods optimized for different access patterns.

## Best Practices

- **Single Responsibility**: Each projection handles one specific read model
- **Event Versioning**: Handle different versions of the same event type
- **State Immutability**: Create new state objects rather than mutating existing ones
- **Error Handling**: Graceful handling of malformed or unexpected events
- **Performance**: Optimize for read patterns, not write complexity

## Common Pitfalls

- **State Mutations**: Directly modifying projection state can cause race conditions
- **Missing Events**: Not handling all relevant events leads to incomplete projections
- **Memory Growth**: Long-running projections need cleanup strategies
- **Event Ordering**: Ensure events are processed in the correct order

## Related Examples

- [Projection with Capabilities](./example-2.md)
- [Projection Engine Setup](./example-3.md)
- [Basic Implementation Guide](./implementation.md)