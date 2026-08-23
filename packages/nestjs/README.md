# @vytches/ddd-nestjs

NestJS integration for VytchesDDD.

[![npm version](https://badge.fury.io/js/@vytches%2Fddd-nestjs.svg)](https://www.npmjs.com/package/@vytches/ddd-nestjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
pnpm add @vytches/ddd-nestjs @nestjs/common @nestjs/core reflect-metadata rxjs
```

## What's included

| Export                    | Kind      | Description                                                                      |
| ------------------------- | --------- | -------------------------------------------------------------------------------- |
| `VytchesDDDModule`        | class     | NestJS dynamic module — call `VytchesDDDModule.forRoot(options)`                 |
| `VytchesExplorerService`  | class     | Auto-discovers and registers CQRS / event handlers via NestJS `DiscoveryService` |
| `NestJSContainerAdapter`  | class     | Bridges NestJS `ModuleRef` to the `IDependencyContainer` interface               |
| `ACLAdapterFor`           | decorator | Marks a class as an ACL adapter so `VytchesExplorerService` can discover it      |
| `ACL_REGISTRY`            | constant  | NestJS injection token for the `ACLRegistry`                                     |
| `VytchesDDDModuleOptions` | interface | Options accepted by `VytchesDDDModule.forRoot()`                                 |
| `HandlerInfo`             | interface | Metadata shape returned by the explorer                                          |
| `ACLAdapterMetadata`      | interface | Metadata stored by the `@ACLAdapterFor` decorator                                |

## Quick start

> **Wire the buses through `VytchesDDDModule`.** `VytchesExplorerService` — the
> service that finds your `@CommandHandler` / `@QueryHandler` classes and puts
> them on a bus — only exists inside a module created by `forRoot()`,
> `forContext()`, `forContexts()`, `forFeature()` or `forTesting()`, and it
> injects the buses via `COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN`. Those factories
> bridge your `ICommandBus` / `IQueryBus` providers onto those tokens for you.
>
> Building your own module that instantiates `EnhancedCommandBus` /
> `EnhancedQueryBus` directly and skips these factories is supported for
> non-NestJS setups, but in a NestJS app it leaves you with no explorer, or an
> explorer with no bus: discovery reports success, nothing is registered, and
> every `execute()` throws `No handler registered for ...`. If you must wire by
> hand, alias the tokens yourself — see [Manual wiring](#manual-wiring).

The smallest wiring that dispatches — one module holding the buses, the
`forRoot()` import and the handlers:

```typescript
import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { NestJSContainerAdapter, VytchesDDDModule } from '@vytches/ddd-nestjs';
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: ICommandBus,
          useFactory: (ref: ModuleRef) =>
            new EnhancedCommandBus(new NestJSContainerAdapter(ref)),
          inject: [ModuleRef],
        },
        {
          provide: IQueryBus,
          useFactory: (ref: ModuleRef) =>
            new EnhancedQueryBus(new NestJSContainerAdapter(ref)),
          inject: [ModuleRef],
        },
      ],
    }),
  ],
  providers: [PlaceOrderHandler, GetOrderHandler],
})
export class AppModule {}
```

Read [Where the buses live](#where-the-buses-live) before you grow past one
module — this shape does not survive a controller in a second module.

## Where the buses live

`forRoot()` always exports `VytchesExplorerService`, `GLOBAL_COMMAND_BUS` and
`GLOBAL_QUERY_BUS`. Anything else you hand it through `options.providers` lives
_inside_ `VytchesDDDModule`, so unless you say otherwise a provider in another
module cannot inject it:

```
Nest can't resolve dependencies of the InvoicesApi (?).
Please make sure that the argument ICommandBus at index [0]
is available in the InvoicesApiModule context.
```

Handlers keep working either way (the explorer resolves them through
`ModuleRef`, not through DI visibility), so the problem only appears when
application code — a controller, an HTTP adapter, a scheduled job — injects a
bus by constructor.

There are two ways out. The direct one is `options.exports`, appended to the
three tokens above:

```typescript
VytchesDDDModule.forRoot({
  providers: [
    { provide: ICommandBus, useFactory: makeCommandBus, inject: [ModuleRef] },
    { provide: IQueryBus, useFactory: makeQueryBus, inject: [ModuleRef] },
  ],
  exports: [ICommandBus, IQueryBus],
});
```

`forTesting()` honours it too. `forRootAsync()` has no equivalent — a
`DynamicModule`'s export list has to exist before the DI container its factory
depends on — and the deprecated `forContext()` / `forContexts()` ignore it.

The second way — and the one applications tend to settle on — keeps the buses in
**your own `@Global()` module** that _provides and exports_ them and _imports_
`forRoot()`. It costs one extra module and buys two things `options.exports`
cannot: the application-specific providers that sit next to the buses anyway (an
event dispatcher, a persistence handler) get somewhere to live, and
`forRootAsync()` stays available. The explorer's bridge injects `ICommandBus` /
`IQueryBus` optionally and resolves them from the global registry, so
auto-discovery is unaffected either way.

```typescript
@Global()
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [
    {
      provide: ICommandBus,
      useFactory: (ref: ModuleRef) =>
        new EnhancedCommandBus(new NestJSContainerAdapter(ref)),
      inject: [ModuleRef],
    },
    {
      provide: IQueryBus,
      useFactory: (ref: ModuleRef) =>
        new EnhancedQueryBus(new NestJSContainerAdapter(ref)),
      inject: [ModuleRef],
    },
    { provide: IEventBus, useFactory: () => new UnifiedEventBus() },
  ],
  exports: [ICommandBus, IQueryBus, IEventBus],
})
export class DddModule {}
```

Both shapes are compiled and tested in
[`examples/nestjs`](../../examples/nestjs) — `src/orders.module.ts` and
`src/app-root.module.ts`; `tests/app-root.test.ts` pins the failure above so it
cannot quietly come back.

### `useFactory`, not `useValue`

A `useValue` bus is constructed once when the module file is first imported. One
instance is then shared by every module built in the process and survives every
teardown, so its handler factories close over a destroyed `ModuleRef` and leak
into the next module created in the same process — in practice, the next test
module, which then dispatches into handlers belonging to the previous one. A
factory gives each module its own pair, and
`VytchesExplorerService.onModuleDestroy()` resets them on teardown.

## Bounded-context modules

A context module lists its handlers as providers. That is all:

```typescript
@Module({
  imports: [DddModule, DatabaseModule],
  providers: [
    ArchiveInvoiceHandler, // @CommandHandler(ArchiveInvoiceCommand)
    GetInvoiceStateHandler, // @QueryHandler(GetInvoiceStateQuery)
    InvoiceArchivedAuditHandler, // @EventHandler(InvoiceArchived)
    { provide: INVOICE_REPOSITORY, useClass: KyselyInvoiceRepository },
  ],
  exports: [INVOICE_REPOSITORY],
})
export class InvoicesModule {}
```

No `OnModuleInit`, no `commandBus.register(...)`, no `ModuleRef.get(...)` to
fetch a handler instance. The explorer discovers every decorated provider in the
graph during `onApplicationBootstrap` — after all `onModuleInit()` hooks — and
registers the NestJS-resolved instance.

`onModuleInit()` is still the right place for ACL-registry registration and
error-mapper registration. It is handler registration specifically that is
automatic.

### What not to do

**Do not register handlers by hand on top of the decorators.** The handler then
runs twice per message. On a command bus the second registration overwrites a
map entry and nothing looks wrong; on an event bus it is a second subscription,
so an event handler that writes a row inserts it twice — a unique-constraint
violation that aborts the surrounding transaction, surfacing as a failed save
far from its cause.

```typescript
// ❌ the handler is already discovered by its decorator
export class InvoicesModule implements OnModuleInit {
  onModuleInit() {
    this.eventBus.registerHandler(InvoiceArchived, this.auditHandler);
  }
}
```

**Do not re-run discovery from a lifecycle hook.** `VytchesExplorerService` runs
its own `onApplicationBootstrap` and registers everything it found. A module
that repeats the walk registers the same handlers a second time:

```typescript
// ❌ the explorer has already done exactly this
export class DddModule implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    for (const handler of await this.explorer.discoverHandlers()) {
      await this.explorer.registerHandler(handler);
    }
  }
}
```

`explorer.registerHandler()` remains public for handlers that genuinely cannot
carry a decorator — a handler built by a factory, or one registered
conditionally at runtime. It is not a supplement to discovery.

## The recommended pattern

`forRoot()` (or `forRootAsync()`) once at the application root, then one
`forFeature()` per bounded context:

```typescript
@Module({ imports: [VytchesDDDModule.forRoot()] })
export class AppModule {}

@Module({
  imports: [VytchesDDDModule.forFeature('orders', { busType: 'enhanced' })],
  providers: [CreateOrderHandler, OrderRepository],
})
export class OrdersModule {}
```

That is the whole decision. The other factories:

| Factory                              | Use it for                                              |
| ------------------------------------ | ------------------------------------------------------- |
| `forRoot(options)`                   | the application root, one per app                       |
| `forRootAsync(options)`              | same, when the options come from `ConfigService`        |
| `forFeature(name, options)`          | one bounded context — its own buses and local event bus |
| `forTesting(options)`                | test modules; wires stubs                               |
| ~~`forContext`~~ / ~~`forContexts`~~ | **deprecated** since 0.31.0 — see below                 |

`forContext()` and `forContexts()` are deprecated predecessors of
`forFeature()`. They register a named explorer per context but leave the buses
shared, so handlers from different contexts still land on the same `ICommandBus`
— they never actually isolated anything. `forContexts()` additionally falls back
to `forRoot()` when its `contexts` option is missing or not an object, so a typo
yields a working module with zero contexts instead of an error. Migrate to one
`forFeature()` per context; both still work for one release.

A runnable end-to-end example of the full flow — aggregate → command handler →
repository → per-context event bus → event handler, wired via `forFeature()` —
lives in
[`examples/nestjs/src/inventory.context.ts`](../../examples/nestjs/src/inventory.context.ts).

### Async configuration

```typescript
VytchesDDDModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    autoDiscovery: { enabled: config.get('DDD_DISCOVERY') !== 'off' },
  }),
});
```

`useClass` and `useExisting` are supported too. One caveat worth knowing: NestJS
needs `providers`, `imports` and the `global` flag _before_ the DI container
exists, so those are declared on the async options object itself, while the
factory supplies the options read at runtime. Returning `providers` from the
factory is not an error — it is simply ignored.

## VytchesDDDModule.forRoot

The entry point for a single-context application, and the one to reach for
first. Accepts `VytchesDDDModuleOptions`:

```typescript
interface VytchesDDDModuleOptions {
  providers?: Provider[]; // bus implementations, adapters, etc.
  imports?: any[]; // additional NestJS modules to import
  autoDiscovery?: { enabled?: boolean };
  isGlobal?: boolean; // default: true
}
```

`VytchesExplorerService` is always exported and can be injected into any NestJS
provider to query discovered handler metadata. `GLOBAL_COMMAND_BUS` and
`GLOBAL_QUERY_BUS` are exported too, and always resolve to the root buses
regardless of any `forFeature()` shadowing.

`exports` is appended to that fixed list, never replaces it — use it when
something declared in `providers` has to be injectable from another module. See
[Where the buses live](#where-the-buses-live).

## Handler auto-discovery

`VytchesExplorerService` uses NestJS `DiscoveryService` to find classes
decorated with `@CommandHandler`, `@QueryHandler` (from `@vytches/ddd-cqrs`),
`@EventHandler` (from `@vytches/ddd-events`), and `@ACLAdapterFor` (this
package). Discovery runs during `onModuleInit`.

```typescript
import { Controller, Get } from '@nestjs/common';
import { VytchesExplorerService } from '@vytches/ddd-nestjs';

@Controller('debug')
export class DebugController {
  constructor(private readonly explorer: VytchesExplorerService) {}

  @Get('handlers')
  listHandlers() {
    return this.explorer.getHandlers(); // HandlerInfo[]
  }
}
```

## ACL adapter registration

```typescript
import { ACLAdapterFor } from '@vytches/ddd-nestjs';
import { Injectable } from '@nestjs/common';
import { SimpleACLAdapter } from '@vytches/ddd-acl';

@Injectable()
@ACLAdapterFor('PaymentsContext')
export class PaymentsACLAdapter extends SimpleACLAdapter<
  Order,
  ExternalPayment
> {
  // ...
}
```

The explorer discovers all `@ACLAdapterFor`-decorated classes and registers them
in the `ACLRegistry` provided under the `ACL_REGISTRY` token.

## Manual wiring

If your application already builds its own DDD module and cannot move to
`forRoot()` yet, alias the Symbol tokens onto whatever you provide the buses
under. Without this the explorer receives `undefined` and registers nothing:

```typescript
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-nestjs';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';

providers: [
  { provide: ICommandBus, useValue: myCommandBus },
  { provide: IQueryBus, useValue: myQueryBus },
  { provide: COMMAND_BUS_TOKEN, useExisting: ICommandBus },
  { provide: QUERY_BUS_TOKEN, useExisting: IQueryBus },
];
```

Use `useExisting` only where the class-token provider is guaranteed to exist —
NestJS raises a DI error for `useExisting` against an absent token even under
`@Optional()`. Where it may be missing, mirror what the module factories do:

```typescript
{
  provide: COMMAND_BUS_TOKEN,
  useFactory: (bus?: ICommandBus) => bus,
  inject: [{ token: ICommandBus, optional: true }],
}
```

You still need `VytchesExplorerService` itself in the graph, which means
importing one of the module factories. If handlers are discovered but no bus
resolved, the explorer says so at `warn` level during bootstrap.

## Package boundaries

`@vytches/ddd-nestjs` depends on:

- `@nestjs/common`, `@nestjs/core` — peer dependencies
- `@vytches/ddd-cqrs` — `ICommandBus`, `IQueryBus`, handler metadata
- `@vytches/ddd-events` — `IEventBus`, `EventHandler` metadata
- `@vytches/ddd-acl` — `ACLRegistry`
- `@vytches/ddd-di` — `IDependencyContainer`

## License

MIT
