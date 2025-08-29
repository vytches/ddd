# VytchesDDDBulkProvider Usage Guide

This guide demonstrates how to use the `VytchesDDDBulkProvider` utility for
efficient bulk registration of CQRS handlers, domain services, and other
VytchesDDD components in your NestJS application.

## Problem It Solves

When you have many handlers (20+ command handlers, 20+ query handlers, 20+ event
handlers), manually registering each one becomes tedious and error-prone. The
`VytchesDDDBulkProvider` solves this by providing efficient bulk registration
methods.

## Basic Usage

### 1. Simple Handler Registration (Per Module)

```typescript
// order.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDBulkProvider } from '@vytches/ddd-nestjs';
import {
  CreateOrderHandler,
  UpdateOrderHandler,
  CancelOrderHandler,
  GetOrderHandler,
  ListOrdersHandler,
  // ... 20+ more handlers
} from './handlers';

@Module({
  providers: [
    // Register all handlers at once
    ...VytchesDDDBulkProvider.forHandlers({
      handlers: [
        CreateOrderHandler,
        UpdateOrderHandler,
        CancelOrderHandler,
        GetOrderHandler,
        ListOrdersHandler,
        // ... all your handlers
      ],
      enableVytchesDDDCapabilities: true, // Also register in VytchesDDD container
    }),
    // Your other providers
    OrderService,
    OrderRepository,
  ],
  exports: [OrderService],
})
export class OrderModule {}
```

### 2. Mixed Services Registration

```typescript
// payment.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDBulkProvider } from '@vytches/ddd-nestjs';
import { CommandBus, QueryBus, UnifiedEventBus } from '@vytches/ddd-cqrs';

// Import all your classes
import * as Handlers from './handlers';
import * as Services from './services';
import * as EventHandlers from './event-handlers';
import * as Sagas from './sagas';

@Module({
  providers: [
    // Register CommandBus and QueryBus if not already available
    CommandBus,
    QueryBus,
    UnifiedEventBus,

    // Register everything at once
    ...VytchesDDDBulkProvider.forMixedServices({
      handlers: Object.values(Handlers),
      domainServices: Object.values(Services),
      eventHandlers: Object.values(EventHandlers),
      sagas: Object.values(Sagas),
      enableVytchesDDDCapabilities: true,
      context: 'PaymentContext', // Optional bounded context
    }),
  ],
})
export class PaymentModule {}
```

### 3. Domain Services Only

```typescript
// inventory.module.ts
import { Module } from '@nestjs/common';
import { VytchesDDDBulkProvider } from '@vytches/ddd-nestjs';

import {
  InventoryService,
  StockService,
  WarehouseService,
  SupplierService,
} from './services';

@Module({
  providers: [
    ...VytchesDDDBulkProvider.forDomainServices({
      services: [
        InventoryService,
        StockService,
        WarehouseService,
        SupplierService,
      ],
      enableVytchesDDDCapabilities: true,
    }),
  ],
})
export class InventoryModule {}
```

## Advanced Usage

### Multiple Modules with Different Contexts

```typescript
// shipping.module.ts
@Module({
  providers: [
    CommandBus,
    QueryBus,
    ...VytchesDDDBulkProvider.forMixedServices({
      handlers: [
        /* shipping handlers */
      ],
      context: 'ShippingContext',
      enableVytchesDDDCapabilities: true,
    }),
  ],
})
export class ShippingModule {}

// billing.module.ts
@Module({
  providers: [
    CommandBus,
    QueryBus,
    ...VytchesDDDBulkProvider.forMixedServices({
      handlers: [
        /* billing handlers */
      ],
      context: 'BillingContext',
      enableVytchesDDDCapabilities: true,
    }),
  ],
})
export class BillingModule {}

// Each module has its own registration - not global!
```

### Custom Providers with Bulk Registration

```typescript
@Module({
  providers: [
    CommandBus,
    QueryBus,
    ...VytchesDDDBulkProvider.forMixedServices({
      handlers: [
        /* handlers */
      ],
      customProviders: [
        {
          provide: 'CUSTOM_CONFIG',
          useValue: { timeout: 30000 },
        },
        {
          provide: 'LOGGER',
          useClass: CustomLogger,
        },
      ],
    }),
  ],
})
export class CustomModule {}
```

## What Happens Under the Hood

When you use `VytchesDDDBulkProvider.forMixedServices()`, it:

1. **Creates NestJS providers** for all your classes
2. **Registers a bulk registrar** that runs on module initialization
3. **Fetches instances** from NestJS DI using `ModuleRef.get()`
4. **Registers handlers** in CommandBus/QueryBus based on metadata
5. **Optionally registers** in VytchesDDD container if
   `enableVytchesDDDCapabilities: true`
6. **Prevents double instances** - only references are shared between containers

## Important Notes

### Per-Module Registration

- `forMixedServices()` is **per-module**, not global
- Each module can have its own bulk registration
- Handlers are registered in the module's scope

### No Double Registry Issues

- When `enableVytchesDDDCapabilities: true`:
  - NestJS creates the instance (primary DI)
  - VytchesDDD stores a reference (not a new instance)
  - Both containers point to the same object in memory

### CommandBus/QueryBus Requirements

- Make sure `CommandBus` and `QueryBus` are available as providers
- They can be registered in the same module or imported from another
- The bulk registrar will automatically register handlers in these buses

## Migration from Manual Registration

### Before (Manual Registration)

```typescript
@Module({
  providers: [
    CommandBus,
    QueryBus,
    CreateOrderHandler,
    UpdateOrderHandler,
    DeleteOrderHandler,
    GetOrderHandler,
    ListOrdersHandler,
    // ... 20+ more handlers manually listed
    {
      provide: 'REGISTER_HANDLERS',
      useFactory: (
        commandBus: CommandBus,
        createHandler: CreateOrderHandler,
        updateHandler: UpdateOrderHandler
        // ... all handlers as parameters
      ) => {
        commandBus.register(CreateOrderCommand, createHandler);
        commandBus.register(UpdateOrderCommand, updateHandler);
        // ... manual registration for each
      },
      inject: [
        CommandBus,
        CreateOrderHandler,
        UpdateOrderHandler,
        // ... all handlers in inject array
      ],
    },
  ],
})
export class OrderModule {}
```

### After (Bulk Registration)

```typescript
@Module({
  providers: [
    CommandBus,
    QueryBus,
    ...VytchesDDDBulkProvider.forHandlers({
      handlers: [
        CreateOrderHandler,
        UpdateOrderHandler,
        DeleteOrderHandler,
        GetOrderHandler,
        ListOrdersHandler,
        // ... all handlers in one array
      ],
      enableVytchesDDDCapabilities: true,
    }),
  ],
})
export class OrderModule {}
```

## Troubleshooting

### CommandBus/QueryBus not found

If you see errors like "CommandBus not available", ensure:

1. CommandBus/QueryBus are provided in the module
2. They're imported before the bulk registration runs

### Handlers not being registered

Check that:

1. Your handlers have the proper decorators (`@CommandHandler`, `@QueryHandler`)
2. The metadata is correctly set on the class
3. CommandBus/QueryBus are available in the module

### Double instance concerns

- This is prevented by design
- `ModuleRef.get()` fetches existing instances
- No new instances are created during registration
