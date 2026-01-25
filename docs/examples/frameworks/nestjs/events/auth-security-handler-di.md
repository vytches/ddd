# AuthSecurityEventHandler - NestJS DI Integration

**Focus**: Advanced event handler with method-level @EventHandler decorators
using @vytches/ddd-di integration **Base Example**:
[Event Handler - Basic](../../basic/event-handler/domain.md) **Dependencies**:
@nestjs/common, @vytches/ddd-events, @vytches/ddd-di, @vytches/ddd-core

## Service Implementation with VytchesDDD

```typescript
// auth-security-event-handler.service.ts
import { Injectable } from '@nestjs/common';
import { EventHandler } from '@vytches/ddd-events';
import { VytchesDDD } from '@vytches/ddd-di';
import {
  SessionCreatedEvent,
  SessionRevokedEvent,
  UserLoginEvent,
} from './types'; // From your app

@Injectable()
export class AuthSecurityEventHandlerService {
  private readonly auditService: AuditService;
  private readonly alertService: AlertService;

  constructor() {
    // ⭐ FOCUS: VytchesDDD service resolution
    this.auditService = VytchesDDD.resolve<AuditService>('auditService');
    this.alertService = VytchesDDD.resolve<AlertService>('alertService');
  }

  // ⭐ FOCUS: Method-level @EventHandler decorators with DI options
  @EventHandler(SessionCreatedEvent, {
    priority: 100,
    eventContext: 'auth-security',
    autoRegister: true, // Auto-discovered by VytchesDDD
    lifetime: 'singleton',
    tags: ['security', 'audit'],
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
    autoRegister: true,
    lifetime: 'singleton',
    tags: ['security', 'audit'],
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
    autoRegister: true,
    lifetime: 'singleton',
    tags: ['security', 'monitoring'],
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

## Domain Services Registration

```typescript
// domain-services.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';

@DomainService('auditService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'SecurityContext',
})
export class AuditService {
  async logSecurityEvent(eventType: string, data: any): Promise<void> {
    // Your audit implementation
  }
}

@DomainService('alertService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'SecurityContext',
})
export class AlertService {
  async sendSecurityAlert(alert: SecurityAlert): Promise<void> {
    // Your alert implementation
  }
}
```

## Module Configuration with VytchesDDD

```typescript
// auth-security.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { EventDiscoveryPlugin } from '@vytches/ddd-events';
import { AuthSecurityEventHandlerService } from './auth-security-event-handler.service';
import { AuditService, AlertService } from './domain-services';

@Module({
  providers: [AuthSecurityEventHandlerService, AuditService, AlertService],
  exports: [AuthSecurityEventHandlerService],
})
export class AuthSecurityModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ FOCUS: VytchesDDD auto-discovery with method decorators

    // 1. Configure VytchesDDD container
    const container = new SimpleContainer();
    VytchesDDD.configure(container);

    // 2. Register event discovery plugin
    const eventPlugin = new EventDiscoveryPlugin();
    VytchesDDD.registerDiscoveryPlugin(eventPlugin);

    // 3. Auto-discover and register all handlers
    // This will find ALL @EventHandler decorated methods across all classes
    await VytchesDDD.discoverAndRegisterHandlers([
      { AuthSecurityEventHandlerService, AuditService, AlertService },
    ]);

    console.log('✅ VytchesDDD auto-discovery completed');
  }
}
```

## Advanced Context Configuration

```typescript
// app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';

@Module({
  imports: [AuthSecurityModule],
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ FOCUS: Context-specific container configuration

    // Create context-specific container for security services
    const securityContainer = new SimpleContainer();

    // Register security-specific configurations
    securityContainer.registerInstance('securityConfig', {
      maxLoginAttempts: 5,
      auditLevel: 'detailed',
      alertThresholds: {
        suspiciousLogin: 3,
        failedAttempts: 5,
      },
    });

    // Configure context in VytchesDDD
    VytchesDDD.configureContext('SecurityContext', securityContainer);

    console.log('✅ Security context configured');
  }
}
```

## Handler Discovery Verification

```typescript
// verification.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';

@Injectable()
export class HandlerVerificationService {
  verifyHandlerRegistration(): void {
    // ⭐ FOCUS: Verify method-level handlers are registered

    // Check if handler service is registered
    const isHandlerRegistered = VytchesDDD.isRegistered(
      'AuthSecurityEventHandlerService'
    );
    console.log('Handler registered:', isHandlerRegistered);

    // Check if dependencies are available
    const isAuditRegistered = VytchesDDD.isRegistered(
      'auditService',
      'SecurityContext'
    );
    const isAlertRegistered = VytchesDDD.isRegistered(
      'alertService',
      'SecurityContext'
    );

    console.log('Audit service registered:', isAuditRegistered);
    console.log('Alert service registered:', isAlertRegistered);

    // Resolve and test handler
    try {
      const handler = VytchesDDD.resolve<AuthSecurityEventHandlerService>(
        'AuthSecurityEventHandlerService'
      );
      console.log('✅ Handler resolved successfully:', !!handler);
    } catch (error) {
      console.error('❌ Failed to resolve handler:', error);
    }
  }
}
```

## Key Integration Points

- **Auto-Discovery**: Method decorators are automatically discovered by
  `EventDiscoveryPlugin`
- **Service Resolution**: Dependencies resolved through `VytchesDDD.resolve()`
  pattern
- **Context Isolation**: Security services isolated in `SecurityContext`
- **Metadata-Driven**: Each `@EventHandler` method registered independently
- **Enterprise Configuration**: Advanced options like lifetime, tags, and
  contexts

## Method Decorator Advantages

- **Granular Control**: Each method can have different options and contexts
- **Single Responsibility**: One handler class, multiple event types
- **Auto-Registration**: No manual subscription required
- **Metadata Rich**: Full decorator options available per method
- **Framework Integration**: Works seamlessly with NestJS DI

## Common Pitfalls

- **Auto-Discovery Timing**: Ensure `discoverAndRegisterHandlers()` is called
  before event publishing
- **Context Mismatch**: Verify event contexts match handler contexts
- **Service Resolution**: Dependencies must be registered before handler
  instantiation
- **Circular Dependencies**: Avoid circular dependencies between VytchesDDD and
  NestJS containers
- **Assembly Configuration**: Ensure all classes are included in discovery
  assemblies

## Related Examples

- [Event Handler - Manual Setup](./auth-security-handler-manual.md) - Basic
  manual approach
- [DI Container - Advanced Configuration](../../di/container/advanced.md) -
  Container patterns
- [Event Discovery - Plugin System](../../events/discovery/plugins.md) -
  Discovery mechanisms
