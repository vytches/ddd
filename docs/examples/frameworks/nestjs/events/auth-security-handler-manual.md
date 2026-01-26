# AuthSecurityEventHandler - NestJS Manual Setup

**Focus**: Event handler with method-level @EventHandler decorators in NestJS
with manual instantiation **Base Example**:
[Event Handler - Basic](../../basic/event-handler/domain.md) **Dependencies**:
@nestjs/common, @vytches/ddd-events, @vytches/ddd-core

## Service Implementation

```typescript
// auth-security-event-handler.service.ts
import { Injectable } from '@nestjs/common';
import { EventHandler } from '@vytches/ddd-events';
import {
  SessionCreatedEvent,
  SessionRevokedEvent,
  UserLoginEvent,
} from './types'; // From your app

@Injectable()
export class AuthSecurityEventHandlerService {
  constructor(
    private readonly auditService: AuditService, // Your existing service
    private readonly alertService: AlertService // Your existing service
  ) {}

  // ⭐ FOCUS: Method-level @EventHandler decorators
  @EventHandler(SessionCreatedEvent, {
    priority: 100,
    eventContext: 'auth-security',
  })
  async handleSessionCreated(event: SessionCreatedEvent): Promise<void> {
    try {
      await this.auditService.logSecurityEvent('SESSION_CREATED', {
        sessionId: event.sessionId,
        userId: event.userId,
        timestamp: event.occurredOn,
      });
    } catch (error) {
      console.error('Failed to handle SessionCreated event:', error);
    }
  }

  @EventHandler(SessionRevokedEvent, {
    priority: 90,
    eventContext: 'auth-security',
  })
  async handleSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    try {
      await this.auditService.logSecurityEvent('SESSION_REVOKED', {
        sessionId: event.sessionId,
        reason: event.reason,
        timestamp: event.occurredOn,
      });
    } catch (error) {
      console.error('Failed to handle SessionRevoked event:', error);
    }
  }

  @EventHandler(UserLoginEvent, {
    priority: 80,
    eventContext: 'auth-security',
  })
  async handleUserLogin(event: UserLoginEvent): Promise<void> {
    try {
      // Check for suspicious login patterns
      if (event.isSuspicious) {
        await this.alertService.sendSecurityAlert({
          type: 'SUSPICIOUS_LOGIN',
          userId: event.userId,
          details: event.loginDetails,
        });
      }

      await this.auditService.logSecurityEvent('USER_LOGIN', {
        userId: event.userId,
        loginMethod: event.loginMethod,
        timestamp: event.occurredOn,
      });
    } catch (error) {
      console.error('Failed to handle UserLogin event:', error);
    }
  }
}
```

## Module Configuration

```typescript
// auth-security.module.ts
import { Module } from '@nestjs/common';
import { AuthSecurityEventHandlerService } from './auth-security-event-handler.service';

@Module({
  providers: [
    AuthSecurityEventHandlerService,
    // Your existing services
    AuditService,
    AlertService,
  ],
  exports: [AuthSecurityEventHandlerService],
})
export class AuthSecurityModule {}
```

## Manual Handler Registration

```typescript
// app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { AuthSecurityEventHandlerService } from './auth-security/auth-security-event-handler.service';

@Module({
  imports: [AuthSecurityModule],
})
export class AppModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    // ⭐ FOCUS: Manual registration of handler with method decorators
    const eventBus = new UnifiedEventBus();
    const handlerService = this.moduleRef.get(AuthSecurityEventHandlerService);

    // Method decorators are automatically detected and registered
    // Each decorated method becomes an individual event handler
    this.registerMethodHandlers(handlerService, eventBus);
  }

  private registerMethodHandlers(
    handlerService: any,
    eventBus: UnifiedEventBus
  ): void {
    // The @EventHandler method decorators store metadata on each method
    // This allows the event bus to automatically discover and register them
    const prototype = Object.getPrototypeOf(handlerService);
    const methodNames = Object.getOwnPropertyNames(prototype);

    for (const methodName of methodNames) {
      const method = prototype[methodName];

      // Check if method has @EventHandler metadata
      const metadata = Reflect.getMetadata('event:handler-metadata', method);
      if (metadata) {
        // Register each decorated method as a separate event handler
        eventBus.subscribe(metadata.eventType, method.bind(handlerService));
      }
    }
  }
}
```

## Key Integration Points

- **Method-Level Decorators**: Each `@EventHandler` decorated method becomes an
  independent event handler
- **NestJS DI**: Standard `@Injectable()` service with constructor dependency
  injection
- **Manual Registration**: Event handlers registered manually in module
  initialization
- **Error Handling**: Simple try/catch blocks for robust error handling
- **Context Filtering**: Use `eventContext` option to filter events by context

## Common Pitfalls

- **Missing Module Registration**: Ensure the handler service is properly
  registered in your NestJS module
- **Metadata Not Preserved**: Method decorators require proper reflection
  metadata setup
- **Handler Not Called**: Verify manual registration logic correctly identifies
  decorated methods
- **Context Isolation**: Events with different contexts won't be received unless
  properly configured

## Related Examples

- [Event Handler - DI Integration](./auth-security-handler-di.md) - Advanced DI
  approach
- [Event Bus - Basic Usage](../../basic/event-bus/domain.md) - Core event bus
  patterns
