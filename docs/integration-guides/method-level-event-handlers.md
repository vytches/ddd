# Method-Level Event Handlers Integration Guide

## Overview

This guide explains how to integrate event handlers that use `@EventHandler`
decorators on **methods** (not classes) with the VytchesDDD dependency injection
system. This pattern is especially useful for NestJS services that need to
handle multiple event types in a coordinated way.

## Key Concepts

### Method Decorators vs Class Decorators

**Class Decorator Pattern (Traditional):**

```typescript
@EventHandler(UserCreatedEvent)
export class UserCreatedHandler {
  handle(event: UserCreatedEvent): void {
    // Handle single event type
  }
}
```

**Method Decorator Pattern (Advanced):**

```typescript
export class SecurityEventHandler {
  @EventHandler(SessionCreatedEvent, { priority: 100 })
  handleSessionCreated(event: SessionCreatedEvent): void {}

  @EventHandler(SessionRevokedEvent, { priority: 80 })
  handleSessionRevoked(event: SessionRevokedEvent): void {}
}
```

### Auto-Discovery Behavior

The VytchesDDD system automatically discovers and registers event handlers
through:

1. **EventDiscoveryPlugin**: Scans classes for `@EventHandler` metadata
2. **Method-Level Registration**: Each decorated method becomes an independent
   event handler
3. **Auto-Registration**: When `autoRegister: true` is set, methods are
   automatically registered with the event bus

## Integration Approaches

### 1. Manual Approach (Beginner)

**Best For**: Simple setups, learning the patterns, full control over
registration

```typescript
@Injectable()
export class AuthSecurityEventHandlerService {
  constructor(
    private readonly auditService: AuditService,
    private readonly alertService: AlertService
  ) {}

  @EventHandler(SessionCreatedEvent, {
    priority: 100,
    eventContext: 'auth-security',
  })
  async handleSessionCreated(event: SessionCreatedEvent): Promise<void> {
    // Business logic using injected services
  }
}
```

**Manual Registration:**

```typescript
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    const eventBus = new UnifiedEventBus();
    const handlerService = this.moduleRef.get(AuthSecurityEventHandlerService);

    // Manually discover and register method handlers
    this.registerMethodHandlers(handlerService, eventBus);
  }
}
```

### 2. VytchesDDD Integration (Intermediate+)

**Best For**: Enterprise applications, auto-discovery, advanced DI features

```typescript
@Injectable()
export class AuthSecurityEventHandlerService {
  private readonly auditService: AuditService;
  private readonly alertService: AlertService;

  constructor() {
    // Resolve dependencies through VytchesDDD
    this.auditService = VytchesDDD.resolve<AuditService>('auditService');
    this.alertService = VytchesDDD.resolve<AlertService>('alertService');
  }

  @EventHandler(SessionCreatedEvent, {
    autoRegister: true, // Auto-discovered by VytchesDDD
    lifetime: 'singleton',
    eventContext: 'auth-security',
  })
  async handleSessionCreated(event: SessionCreatedEvent): Promise<void> {
    // Business logic
  }
}
```

**Auto-Discovery Setup:**

```typescript
export class AuthSecurityModule implements OnModuleInit {
  async onModuleInit() {
    // Configure VytchesDDD container
    const container = new SimpleContainer();
    VytchesDDD.configure(container);

    // Register event discovery plugin
    VytchesDDD.registerDiscoveryPlugin(new EventDiscoveryPlugin());

    // Auto-discover all handlers
    await VytchesDDD.discoverAndRegisterHandlers([
      { AuthSecurityEventHandlerService },
    ]);
  }
}
```

## Method Decorator Options

Each `@EventHandler` method can have unique configuration:

```typescript
@EventHandler(EventType, {
  // Core options
  priority: 100,              // Processing priority (higher = first)
  eventContext: 'context',    // Context filtering
  autoRegister: true,         // Auto-discovery enabled

  // DI options (VytchesDDD integration)
  lifetime: 'singleton',      // Service lifetime
  tags: ['security'],         // Service tags
  context: 'SecurityContext', // DI context

  // Advanced options
  active: true,               // Handler active/inactive
  availableFrom: '1.0.0'      // Version availability
})
```

## Discovery Process

When VytchesDDD discovers method-level handlers:

1. **Class Scanning**: Scans all classes in provided assemblies
2. **Method Inspection**: Examines each method for `@EventHandler` metadata
3. **Metadata Extraction**: Retrieves event type and options from decorator
4. **Handler Registration**: Registers each method as independent event handler
5. **Service Resolution**: Resolves handler class through DI container

## Framework-Specific Considerations

### NestJS Integration

**Service Resolution Order:**

1. VytchesDDD resolves handler class
2. NestJS provides dependencies through constructor
3. Method handlers are bound to resolved instance

**Module Initialization:**

```typescript
@Module({
  providers: [HandlerService, DependencyA, DependencyB],
})
export class MyModule implements OnModuleInit {
  async onModuleInit() {
    // 1. Configure VytchesDDD FIRST
    await VytchesDDD.configure(container);

    // 2. THEN run auto-discovery
    await VytchesDDD.discoverAndRegisterHandlers();
  }
}
```

### Bridge Pattern for Hybrid DI

When mixing NestJS and VytchesDDD:

```typescript
@Injectable()
export class BridgeService {
  private readonly domainHandler: SecurityEventHandler;

  constructor() {
    // Get VytchesDDD-managed instance
    this.domainHandler =
      VytchesDDD.resolve<SecurityEventHandler>('securityHandler');
  }

  // NestJS endpoints delegate to VytchesDDD services
  async handleSecurityEvent(event: SecurityEvent): Promise<void> {
    return await this.domainHandler.processEvent(event);
  }
}
```

## Best Practices

### 1. Method Organization

- Group related events in the same handler class
- Use descriptive method names that reflect business operations
- Keep methods focused on single responsibility

### 2. Configuration Consistency

- Use consistent `eventContext` for related handlers
- Set appropriate priorities based on business criticality
- Enable `autoRegister` for production handlers

### 3. Error Handling

- Implement try/catch in each method for resilience
- Log errors with sufficient context for debugging
- Consider using Result patterns for better error propagation

### 4. Testing Strategy

- Test method handlers independently
- Mock dependencies through VytchesDDD or constructor injection
- Verify auto-discovery works in integration tests

## Troubleshooting

### Handlers Not Discovered

- Verify `autoRegister: true` is set
- Check that classes are included in discovery assemblies
- Ensure `EventDiscoveryPlugin` is registered

### Dependencies Not Resolved

- Confirm services are registered with VytchesDDD
- Check service tokens match between registration and resolution
- Verify container is configured before handler discovery

### Events Not Received

- Validate event contexts match between publishers and handlers
- Check event types are correctly specified in decorators
- Ensure event bus is properly configured and connected

### Metadata Not Applied

- Import 'reflect-metadata' before using decorators
- Verify decorator syntax and parameters are correct
- Check that TypeScript experimental decorators are enabled

## Performance Considerations

- **Method Binding**: Each decorated method creates a separate handler
  registration
- **Context Filtering**: Use specific contexts to reduce unnecessary handler
  calls
- **Priority Ordering**: Set priorities to ensure critical handlers run first
- **Lifetime Management**: Use appropriate service lifetimes to optimize memory
  usage

This integration pattern provides the flexibility of method-level event handling
with the power of enterprise dependency injection, making it ideal for complex
business scenarios where multiple related events need coordinated handling.
