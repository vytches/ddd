# Event Handler Method Decorators - Intermediate Example

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: intermediate
**Domain**: security-events **Patterns**: event-handler-methods,
method-decorators, multi-event-handling **Dependencies**: @vytches/ddd-events,
@vytches/ddd-contracts

## Description

This example demonstrates how to use @EventHandler decorators on individual
methods within a single class, allowing one handler class to handle multiple
event types with different configurations per method.

## Business Context

In enterprise security systems, you often need to handle multiple related events
(login, logout, session events) in a coordinated way while maintaining different
processing priorities and contexts for each event type.

## Code Example

@extract: eventHandler:security:intermediate

```typescript
// security-event-handler.ts
import { EventHandler } from '@vytches/ddd-events';
import type { IDomainEvent } from '@vytches/ddd-contracts';

// Domain events from your application
interface SessionCreatedEvent extends IDomainEvent {
  eventType: 'SessionCreated';
  sessionId: string;
  userId: string;
  loginMethod: string;
}

interface SessionRevokedEvent extends IDomainEvent {
  eventType: 'SessionRevoked';
  sessionId: string;
  reason: string;
}

interface UserLoginEvent extends IDomainEvent {
  eventType: 'UserLogin';
  userId: string;
  isSuspicious: boolean;
  loginDetails: any;
}

export class SecurityEventHandler {
  // ⭐ High priority for session creation
  @EventHandler(SessionCreatedEvent, {
    priority: 100,
    eventContext: 'security',
    autoRegister: true,
  })
  async handleSessionCreated(event: SessionCreatedEvent): Promise<void> {
    console.log(`Session created for user ${event.userId}: ${event.sessionId}`);
    // Handle session creation logic
  }

  // ⭐ Medium priority for session revocation
  @EventHandler(SessionRevokedEvent, {
    priority: 80,
    eventContext: 'security',
    autoRegister: true,
  })
  async handleSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    console.log(`Session revoked: ${event.sessionId}, reason: ${event.reason}`);
    // Handle session cleanup logic
  }

  // ⭐ Lower priority but with additional monitoring context
  @EventHandler(UserLoginEvent, {
    priority: 60,
    eventContext: ['security', 'monitoring'],
    autoRegister: true,
    tags: ['audit', 'security'],
  })
  async handleUserLogin(event: UserLoginEvent): Promise<void> {
    if (event.isSuspicious) {
      console.log(`🚨 Suspicious login detected for user ${event.userId}`);
      // Handle suspicious activity
    } else {
      console.log(`✅ Normal login for user ${event.userId}`);
    }
  }
}
```

@extract-end

## Key Features

- **Method-Level Configuration**: Each `@EventHandler` method can have unique
  options like priority, context, and tags
- **Multi-Event Handling**: Single class handles multiple related event types
  with centralized business logic
- **Auto-Discovery**: Methods are automatically discovered and registered when
  `autoRegister: true` is set
- **Context Filtering**: Use `eventContext` to filter events or handle events
  from multiple contexts
- **Priority-Based Processing**: Different priorities ensure critical events are
  processed first

## Common Pitfalls

- **Metadata Not Applied**: Ensure `reflect-metadata` is imported before using
  method decorators
- **Auto-Discovery Disabled**: Verify `autoRegister: true` is set on methods you
  want automatically registered
- **Context Mismatch**: Events published with different contexts won't reach
  handlers with non-matching contexts
- **Method Binding**: When manually registering, ensure methods are properly
  bound to the handler instance

## Related Examples

- [Event Handler - Class Decorators](./class-decorators.md) - Traditional
  class-level event handling
- [Event Bus - Context Filtering](../event-bus/context-filtering.md) -
  Context-based event routing
- [Event Discovery - Auto Registration](../discovery/auto-registration.md) -
  Automatic handler discovery patterns
