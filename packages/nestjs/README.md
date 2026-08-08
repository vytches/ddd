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

```typescript
import { Module } from '@nestjs/common';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';
import { UnifiedEventBus, IEventBus } from '@vytches/ddd-events';

@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        { provide: ICommandBus, useClass: EnhancedCommandBus },
        { provide: IQueryBus, useClass: EnhancedQueryBus },
        { provide: IEventBus, useClass: UnifiedEventBus },
      ],
    }),
  ],
})
export class AppModule {}
```

## VytchesDDDModule.forRoot

The entry point for a single-context application, and the one to reach for
first. `forContext()` / `forContexts()` scope an explorer per bounded context,
`forFeature()` gives a module its own isolated buses, and `forTesting()` wires
stubs. Accepts `VytchesDDDModuleOptions`:

```typescript
interface VytchesDDDModuleOptions {
  providers?: Provider[]; // bus implementations, adapters, etc.
  imports?: any[]; // additional NestJS modules to import
  exports?: any[]; // additional symbols to export
}
```

`VytchesExplorerService` is always exported and can be injected into any NestJS
provider to query discovered handler metadata.

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
