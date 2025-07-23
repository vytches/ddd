# Simple Actor Pattern

**Version**: 2025-01-21  
**Package**: @vytches-ddd/domain-primitives  
**Complexity**: Basic  
**Category**: Actors

## Overview

The Actor pattern in DDD provides a way to track who performed actions in your
system. It's essential for audit trails, security, and understanding system
behavior.

## Basic Actor Implementation

```typescript
import {
  IActor,
  DefaultActorType,
  ActorError,
} from '@vytches-ddd/domain-primitives';
import { AuditEntry, ActionContext, UserData } from '../types';

// Basic actor implementation
export class SystemActor implements IActor {
  type = DefaultActorType.SYSTEM;
  source: string;
  id?: string;
  metadata?: Record<string, unknown>;

  constructor(source: string, metadata?: Record<string, unknown>) {
    this.source = source;
    this.id = 'system';
    this.metadata = metadata;
  }
}

// User actor with rich context
export class UserActor implements IActor {
  type = DefaultActorType.USER;
  source: string;
  id: string;
  metadata: Record<string, unknown>;

  constructor(user: UserData, source: string) {
    this.id = user.id;
    this.source = source;
    this.metadata = {
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}

// Guest actor for anonymous actions
export class GuestActor implements IActor {
  type = DefaultActorType.GUEST;
  source: string;
  id?: string;
  metadata?: Record<string, unknown>;

  constructor(sessionId: string, ipAddress: string) {
    this.source = 'web';
    this.id = sessionId;
    this.metadata = {
      ipAddress,
      timestamp: new Date(),
    };
  }
}

// ✅ Actor factory for creating appropriate actors
export class ActorFactory {
  static createFromContext(context: ActionContext, user?: UserData): IActor {
    if (user) {
      return new UserActor(user, context.userAgent ? 'web' : 'api');
    }

    if (context.sessionId) {
      return new GuestActor(context.sessionId, context.ipAddress || 'unknown');
    }

    return new SystemActor('automated-process', {
      requestId: context.requestId,
    });
  }

  static createSystemActor(processName: string): IActor {
    return new SystemActor(processName, {
      timestamp: new Date(),
      version: process.env.APP_VERSION || '1.0.0',
    });
  }
}
```

## Audit Service with Actors

```typescript
// ✅ Audit service tracking all actions
export class AuditService {
  private auditLog: AuditEntry[] = [];

  async recordAction(
    actor: IActor,
    action: string,
    resource: string,
    changes?: Record<string, unknown>
  ): Promise<AuditEntry> {
    // Validate actor
    if (!actor.type || !actor.source) {
      throw new ActorError('Invalid actor: missing required fields');
    }

    const entry: AuditEntry = {
      id: this.generateAuditId(),
      actor: {
        type: actor.type,
        id: actor.id || 'anonymous',
        source: actor.source,
        metadata: actor.metadata,
      },
      action,
      resource,
      timestamp: new Date(),
      changes,
      result: 'success',
    };

    this.auditLog.push(entry);

    // In real applications, persist to database
    await this.persistAuditEntry(entry);

    return entry;
  }

  async recordFailedAction(
    actor: IActor,
    action: string,
    resource: string,
    error: Error
  ): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: this.generateAuditId(),
      actor: {
        type: actor.type,
        id: actor.id || 'anonymous',
        source: actor.source,
        metadata: actor.metadata,
      },
      action,
      resource,
      timestamp: new Date(),
      changes: {
        error: error.message,
        errorType: error.name,
      },
      result: 'failure',
    };

    this.auditLog.push(entry);
    await this.persistAuditEntry(entry);

    return entry;
  }

  async getAuditTrail(filters?: {
    actorId?: string;
    actorType?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditEntry[]> {
    let results = [...this.auditLog];

    if (filters) {
      if (filters.actorId) {
        results = results.filter(e => e.actor.id === filters.actorId);
      }
      if (filters.actorType) {
        results = results.filter(e => e.actor.type === filters.actorType);
      }
      if (filters.resource) {
        results = results.filter(e => e.resource === filters.resource);
      }
      if (filters.startDate) {
        results = results.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter(e => e.timestamp <= filters.endDate!);
      }
    }

    return results;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistAuditEntry(entry: AuditEntry): Promise<void> {
    // In real implementation, save to database
    console.log('Persisting audit entry:', entry);
  }
}
```

## Using Actors in Domain Services

```typescript
import { CreateUserDto, SuccessResponse } from '../types';

// ✅ Domain service with actor tracking
export class UserManagementService {
  constructor(private auditService: AuditService) {}

  async createUser(
    dto: CreateUserDto,
    actor: IActor
  ): Promise<SuccessResponse<UserData>> {
    try {
      // Perform the action
      const user: UserData = {
        id: this.generateUserId(),
        email: dto.email,
        name: dto.name,
        role: 'user',
      };

      // Record successful action
      await this.auditService.recordAction(
        actor,
        'CREATE_USER',
        `user:${user.id}`,
        {
          email: user.email,
          name: user.name,
          role: user.role,
        }
      );

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      // Record failed action
      await this.auditService.recordFailedAction(
        actor,
        'CREATE_USER',
        'user:new',
        error as Error
      );

      throw error;
    }
  }

  async updateUserRole(
    userId: string,
    newRole: string,
    actor: IActor
  ): Promise<SuccessResponse<UserData>> {
    // Check permissions based on actor
    if (actor.type !== DefaultActorType.ADMIN) {
      const error = new Error('Insufficient permissions');
      await this.auditService.recordFailedAction(
        actor,
        'UPDATE_USER_ROLE',
        `user:${userId}`,
        error
      );
      throw error;
    }

    // Simulate user update
    const user: UserData = {
      id: userId,
      email: 'user@example.com',
      name: 'Updated User',
      role: newRole,
    };

    // Record the change
    await this.auditService.recordAction(
      actor,
      'UPDATE_USER_ROLE',
      `user:${userId}`,
      {
        oldRole: 'user',
        newRole: newRole,
        updatedBy: actor.id,
      }
    );

    return {
      success: true,
      data: user,
    };
  }

  async deleteUser(
    userId: string,
    actor: IActor
  ): Promise<SuccessResponse<void>> {
    // Admin-only action
    if (actor.type !== DefaultActorType.ADMIN) {
      const error = new Error('Only admins can delete users');
      await this.auditService.recordFailedAction(
        actor,
        'DELETE_USER',
        `user:${userId}`,
        error
      );
      throw error;
    }

    // Record deletion
    await this.auditService.recordAction(
      actor,
      'DELETE_USER',
      `user:${userId}`,
      {
        deletedAt: new Date(),
        deletedBy: actor.id,
      }
    );

    return {
      success: true,
      data: undefined,
    };
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Actor Context Provider

```typescript
// ✅ Context provider for managing current actor
export class ActorContextProvider {
  private currentActor: IActor | null = null;

  setActor(actor: IActor): void {
    this.currentActor = actor;
  }

  getActor(): IActor {
    if (!this.currentActor) {
      throw new ActorError('No actor set in context');
    }
    return this.currentActor;
  }

  clearActor(): void {
    this.currentActor = null;
  }

  // Execute with actor context
  async executeWithActor<T>(
    actor: IActor,
    operation: () => Promise<T>
  ): Promise<T> {
    const previousActor = this.currentActor;
    this.currentActor = actor;

    try {
      return await operation();
    } finally {
      this.currentActor = previousActor;
    }
  }
}

// Usage example
export class ApplicationService {
  constructor(
    private actorContext: ActorContextProvider,
    private userService: UserManagementService
  ) {}

  async handleUserCreation(
    dto: CreateUserDto,
    context: ActionContext
  ): Promise<SuccessResponse<UserData>> {
    const actor = ActorFactory.createFromContext(context);

    return this.actorContext.executeWithActor(actor, async () => {
      return this.userService.createUser(dto, actor);
    });
  }
}
```

## Key Benefits

1. **Audit Trail**: Complete record of who did what and when
2. **Security**: Track and control actions based on actor type
3. **Debugging**: Understand system behavior through actor tracking
4. **Compliance**: Meet regulatory requirements for audit logs
5. **Analytics**: Analyze system usage patterns by actor

## Best Practices

1. **Always identify actors** for sensitive operations
2. **Include rich metadata** for better context
3. **Use appropriate actor types** (user, system, service, etc.)
4. **Validate actor permissions** before operations
5. **Persist audit logs** for compliance and debugging

## Common Patterns

```typescript
// ✅ Good: Rich actor context
const actor = new UserActor(currentUser, 'web-app');
await service.performAction(data, actor);

// ❌ Bad: Missing actor information
await service.performAction(data);

// ✅ Good: System actor for automated processes
const systemActor = ActorFactory.createSystemActor('daily-cleanup');
await cleanupService.run(systemActor);

// ✅ Good: Actor validation
if (actor.type !== DefaultActorType.ADMIN) {
  throw new Error('Admin access required');
}
```

## Next Steps

- Implement context-aware actors with rich metadata
- Create actor hierarchies for complex permissions
- Build actor-based authorization systems
- Integrate with authentication providers
