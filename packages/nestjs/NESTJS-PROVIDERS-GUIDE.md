# VytchesDDD NestJS Providers Guide

**Complete guide for configuring custom providers with VytchesDDDModule**

## Overview

This guide shows how to configure custom providers with
`VytchesDDDModule.forRoot()` using pure NestJS patterns. You can:

- Use interface-based injection (`@Inject(IEventBus)`)
- Configure custom implementations
- Mix VytchesDDD features with custom providers
- Use factory patterns for dependencies

## Key Concepts

### Interface Tokens

Import interface tokens from VytchesDDD packages:

```typescript
// Use real interfaces from VytchesDDD packages
import { IEventBus, IEventDispatcher } from '@vytches/ddd-contracts';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

// These are abstract classes that serve as injection tokens
// IEventBus: publish(event), publishMany(events)
// IEventDispatcher: dispatchEvent(event), dispatchEvents(...events), dispatchEventsForAggregate(aggregate)
// ICommandBus: execute(command), register(commandType, handler)
// IQueryBus: execute(query), register(queryType, handler)
```

### Service Usage

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { IEventBus, IEventDispatcher } from '@vytches/ddd-contracts';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

@Injectable()
export class OrderService {
  constructor(
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    @Inject(ICommandBus) private readonly commandBus: ICommandBus,
    @Inject(IQueryBus) private readonly queryBus: IQueryBus,
    @Inject(IEventDispatcher) private readonly eventDispatcher: IEventDispatcher
  ) {}

  async createOrder(orderData: any): Promise<void> {
    await this.commandBus.execute({ type: 'CreateOrder', data: orderData });
    await this.eventBus.publish({ type: 'OrderCreated', data: orderData });
    await this.eventDispatcher.dispatchEvent({
      type: 'OrderProcessed',
      data: orderData,
    });
  }
}
```

## Configuration Patterns

### Pattern 1: Custom Providers in forRoot()

**Best for**: Full control with VytchesDDD features

```typescript
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches/ddd-events';
import { IEventBus, IEventDispatcher } from '@vytches/ddd-contracts';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      discovery: { enabled: false },

      // Custom NestJS providers
      providers: [
        // EventBus
        {
          provide: IEventBus,
          useClass: UnifiedEventBus, // Or your custom implementation
        },

        // EventDispatcher with factory pattern (REQUIRED - needs EventBus)
        {
          provide: IEventDispatcher,
          useFactory: (eventBus: IEventBus) => {
            return new UniversalEventDispatcher(eventBus);
          },
          inject: [IEventBus], // NestJS injects IEventBus
        },

        // CommandBus
        {
          provide: ICommandBus,
          useFactory: () => {
            const { EnhancedCommandBus } = require('@vytches/ddd-cqrs');
            return new EnhancedCommandBus();
          },
        },

        // QueryBus
        {
          provide: IQueryBus,
          useFactory: () => {
            const { SimpleQueryBus } = require('@vytches/ddd-cqrs');
            return new SimpleQueryBus();
          },
        },
      ],
    }),
  ],
})
export class AppModuleCustomProviders {}
```

### Pattern 2: Built-in Configuration

**Best for**: Standard usage with VytchesDDD defaults

```typescript
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      discovery: { enabled: false },

      // Built-in events configuration
      events: {
        eventBus: {
          type: 'unified',
          interfaceToken: IEventBus, // Use abstract class as token
        },
        // EventDispatcher automatically configured with factory pattern
      },

      // Built-in CQRS configuration
      cqrs: {
        commandBus: {
          implementation: 'enhanced',
          interfaceToken: ICommandBus,
        },
        queryBus: {
          implementation: 'simple',
          interfaceToken: IQueryBus,
        },
      },
    }),
  ],
})
export class AppModuleBuiltIn {}
```

### Pattern 3: Mixed Approach

**Best for**: Some defaults + some custom implementations

```typescript
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      discovery: { enabled: false },

      // Use built-in for events
      events: {
        eventBus: { type: 'unified', interfaceToken: IEventBus },
      },

      // Override with custom providers for CQRS
      providers: [
        {
          provide: ICommandBus,
          useClass: class CustomCommandBus {
            async execute(command: any): Promise<any> {
              console.log('⚡ Custom command:', command);
              return { success: true };
            }
          },
        },
        {
          provide: IQueryBus,
          useClass: class CustomQueryBus {
            async execute(query: any): Promise<any> {
              console.log('🔍 Custom query:', query);
              return { data: 'result' };
            }
          },
        },
      ],
    }),
  ],
})
export class AppModuleMixed {}
```

### Pattern 4: Pure NestJS Style (No VytchesDDDModule)

**Best for**: When you don't need VytchesDDD discovery/configuration features

```typescript
@Module({
  providers: [
    // Standard NestJS providers
    { provide: IEventBus, useClass: UnifiedEventBus },
    { provide: ICommandBus, useClass: CustomCommandBus },
    { provide: IQueryBus, useClass: CustomQueryBus },

    // Factory provider for EventDispatcher
    {
      provide: IEventDispatcher,
      useFactory: (eventBus: IEventBus) =>
        new UniversalEventDispatcher(eventBus),
      inject: [IEventBus],
    },
  ],
  exports: [IEventBus, ICommandBus, IQueryBus, IEventDispatcher],
})
export class PureNestJSModule {}
```

### Pattern 5: String Tokens

**Best for**: When you prefer string tokens over abstract classes

```typescript
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        { provide: 'IEventBus', useClass: UnifiedEventBus },
        { provide: 'ICommandBus', useClass: CustomCommandBus },
        {
          provide: 'IEventDispatcher',
          useFactory: (eventBus: any) => new UniversalEventDispatcher(eventBus),
          inject: ['IEventBus'],
        },
      ],
    }),
  ],
})
export class StringTokenModule {}

// Usage with string tokens
@Injectable()
export class OrderService {
  constructor(
    @Inject('IEventBus') private readonly eventBus: any,
    @Inject('ICommandBus') private readonly commandBus: any,
    @Inject('IEventDispatcher') private readonly eventDispatcher: any
  ) {}
}
```

## Factory Patterns

### EventDispatcher Factory (Required)

EventDispatcher **must** use factory pattern because it needs EventBus in
constructor:

```typescript
{
  provide: IEventDispatcher,
  useFactory: (eventBus: IEventBus) => {
    // UniversalEventDispatcher now accepts IEventBus interface
    return new UniversalEventDispatcher(eventBus);
  },
  inject: [IEventBus], // Critical: NestJS injects IEventBus
}
```

### Complex Factory with Configuration

```typescript
{
  provide: ICommandBus,
  useFactory: (config: any) => {
    const { EnhancedCommandBus } = require('@vytches/ddd-cqrs');
    const bus = new EnhancedCommandBus();

    // Apply configuration
    if (config.timeout) bus.setTimeout(config.timeout);
    if (config.middleware) bus.use(...config.middleware);

    return bus;
  },
  inject: ['CONFIG'],
}
```

### Conditional Factory

```typescript
{
  provide: IEventBus,
  useFactory: (env: string) => {
    if (env === 'production') {
      return new ProductionEventBus();
    } else {
      return new UnifiedEventBus();
    }
  },
  inject: ['NODE_ENV'],
}
```

## Advanced Examples

### Custom Implementations

```typescript
// Your custom implementations
@Injectable()
export class MyEventBus implements IEventBus {
  async publish(event: any): Promise<void> {
    console.log('🚀 Publishing:', event);
    // Your custom logic
  }

  async publishMany(events: any[]): Promise<void> {
    await Promise.all(events.map(e => this.publish(e)));
  }
}

@Injectable()
export class MyEventDispatcher implements IEventDispatcher {
  constructor(@Inject(IEventBus) private readonly eventBus: IEventBus) {}

  async dispatchEvent(event: any): Promise<void> {
    console.log('📤 Dispatching:', event);
    await this.eventBus.publish({ ...event, dispatchedAt: new Date() });
  }

  async dispatchEvents(...events: any[]): Promise<void> {
    for (const event of events) {
      await this.dispatchEvent(event);
    }
  }

  async dispatchEventsForAggregate(aggregate: any): Promise<void> {
    const events = aggregate.getDomainEvents?.() || [];
    await this.dispatchEvents(...events);
    if (aggregate.commit) aggregate.commit();
  }
}
```

### Provider Constants

For better organization, extract providers to constants:

```typescript
const EVENT_BUS_PROVIDER = {
  provide: IEventBus,
  useClass: UnifiedEventBus,
};

const COMMAND_BUS_PROVIDER = {
  provide: ICommandBus,
  useClass: MyCommandBus,
};

const EVENT_DISPATCHER_PROVIDER = {
  provide: IEventDispatcher,
  useFactory: (eventBus: IEventBus) => new UniversalEventDispatcher(eventBus),
  inject: [IEventBus],
};

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        EVENT_BUS_PROVIDER,
        COMMAND_BUS_PROVIDER,
        EVENT_DISPATCHER_PROVIDER,
      ],
    }),
  ],
})
export class CleanModule {}
```

### Provider Factory Functions

```typescript
export function createDDDProviders(config: {
  eventBus?: any;
  commandBus?: any;
  queryBus?: any;
}): Provider[] {
  return [
    { provide: IEventBus, useClass: config.eventBus || UnifiedEventBus },
    { provide: ICommandBus, useClass: config.commandBus || DefaultCommandBus },
    { provide: IQueryBus, useClass: config.queryBus || DefaultQueryBus },
    {
      provide: IEventDispatcher,
      useFactory: (eventBus: IEventBus) =>
        new UniversalEventDispatcher(eventBus),
      inject: [IEventBus],
    },
  ];
}

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: createDDDProviders({
        eventBus: MyEventBus,
        commandBus: MyCommandBus,
      }),
    }),
  ],
})
export class FactoryModule {}
```

## VytchesDDD Module Architecture

### Dual DI Support (NestJS + VytchesDDD Fallback)

**The VytchesDDDModule supports both approaches:**

1. **NestJS DI (Recommended)**: Services with `@Injectable` decorator
2. **VytchesDDD DI (Fallback)**: Pure `@DomainService` without `@Injectable`

```typescript
// Option 1: NestJS managed (recommended)
@Injectable()
@DomainService('userService')
export class UserService {
  // NestJS handles lifecycle, VytchesDDD adds capabilities
}

// Option 2: Pure VytchesDDD (fallback)
@DomainService('userService')
export class UserService {
  // VytchesDDD container manages lifecycle completely
}
```

**How it works:**

- **Discovery service checks for @Injectable** first
- **If found**: NestJS manages instance, VytchesDDD wraps with capabilities
- **If not found**: VytchesDDD container handles complete lifecycle
- **This enables gradual migration** and supports mixed architectures

## Key Changes Made

### UniversalEventDispatcher Refactored

**Before**: Required `UnifiedEventBus` specifically **After**: Accepts any
`IEventBus<IDomainEvent>` implementation

```typescript
// Old (concrete dependency)
constructor(unifiedBus?: UnifiedEventBus)

// New (interface dependency)
constructor(eventBus?: IEventBus<IDomainEvent>)
```

This enables:

- ✅ Loose coupling with interfaces
- ✅ Easy testing with mocks
- ✅ Custom EventBus implementations
- ✅ Factory pattern compatibility

### VytchesDDDModule.forRoot() Enhanced

**New feature**: `providers` array option

```typescript
VytchesDDDModule.forRoot({
  // Standard VytchesDDD configuration
  discovery: { enabled: false },
  events: { ... },
  cqrs: { ... },

  // NEW: Custom NestJS providers
  providers: [
    { provide: Token, useClass: Implementation },
    { provide: Token, useFactory: factory, inject: [Deps] },
    // ... any NestJS provider pattern
  ]
})
```

## Best Practices

### 1. Interface-Based Injection

✅ **Do**: Use abstract classes as tokens

```typescript
@Inject(IEventBus) private readonly eventBus: IEventBus
```

❌ **Don't**: Use concrete classes directly

```typescript
@Inject(UnifiedEventBus) private readonly eventBus: UnifiedEventBus
```

### 2. Factory Patterns for Dependencies

✅ **Do**: Use factory when service needs dependencies

```typescript
{
  provide: IEventDispatcher,
  useFactory: (eventBus: IEventBus) => new UniversalEventDispatcher(eventBus),
  inject: [IEventBus],
}
```

❌ **Don't**: Try to use useClass when dependencies are needed

```typescript
{ provide: IEventDispatcher, useClass: UniversalEventDispatcher } // Won't work - no EventBus
```

### 3. Consistent Token Usage

✅ **Do**: Use same token type throughout

```typescript
// All abstract classes
@Inject(IEventBus) // Abstract class token
@Inject(ICommandBus) // Abstract class token
```

✅ **Alternative**: All strings

```typescript
// All strings
@Inject('IEventBus') // String token
@Inject('ICommandBus') // String token
```

❌ **Don't**: Mix token types

```typescript
@Inject(IEventBus) // Abstract class
@Inject('ICommandBus') // String - inconsistent
```

### 4. Discovery Configuration

✅ **Do**: Explicitly disable discovery for performance

```typescript
VytchesDDDModule.forRoot({
  discovery: { enabled: false }, // Prevent auto-discovery overhead
  providers: [...]
})
```

### 5. Error Handling

The module has built-in error handling:

- ✅ Application won't hang on startup
- ✅ Discovery failures don't crash the app
- ✅ Timeout protection (5 seconds default)
- ✅ Comprehensive error logging

## Migration Guide

### From Previous Versions

1. **Update EventDispatcher usage**:

   ```typescript
   // Before
   new UniversalEventDispatcher(unifiedEventBus);

   // After (same, but now works with any IEventBus)
   new UniversalEventDispatcher(anyEventBusImplementation);
   ```

2. **Use new providers option**:

   ```typescript
   // Before (not available)
   VytchesDDDModule.forRoot({ events: {...} })

   // After (providers option available)
   VytchesDDDModule.forRoot({
     events: {...},
     providers: [...] // New option
   })
   ```

3. **Simplified discovery**:
   - All discovery services unified into `VytchesDiscoveryService`
   - Same functionality, cleaner implementation
   - Better timeout and error handling

## Troubleshooting

### Application Hanging

**Problem**: App hangs on startup with `VytchesDDDModule.forRoot()`

**Solution**: Discovery is now disabled by default

```typescript
// Works out of the box
VytchesDDDModule.forRoot(); // Discovery disabled by default

// Explicitly enable if needed
VytchesDDDModule.forRoot({ discovery: { enabled: true } });
```

### EventDispatcher Not Working

**Problem**: EventDispatcher not getting EventBus injected

**Solution**: Use factory pattern

```typescript
{
  provide: IEventDispatcher,
  useFactory: (eventBus: IEventBus) => new UniversalEventDispatcher(eventBus),
  inject: [IEventBus], // Don't forget inject array!
}
```

### Type Errors

**Problem**: TypeScript errors with custom providers

**Solution**: Use proper interface definitions

```typescript
// Define proper interfaces
export abstract class IEventBus {
  abstract publish(event: any): Promise<void>;
  // ... other methods
}

// Use in injection
@Inject(IEventBus) private readonly eventBus: IEventBus
```

## Summary

This guide covers all patterns for configuring custom providers with
VytchesDDDModule:

✅ **Interface-based injection** - Clean dependency injection with abstract
classes  
✅ **Factory patterns** - Proper dependency handling for services like
EventDispatcher  
✅ **Mixed configurations** - Combine VytchesDDD features with custom
implementations  
✅ **Pure NestJS style** - Standard NestJS providers without VytchesDDD
wrapper  
✅ **Error handling** - Built-in timeout and error recovery  
✅ **Performance** - Discovery disabled by default for fast startup

Choose the pattern that best fits your needs!
