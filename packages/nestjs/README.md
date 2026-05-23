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

The only static factory method available. Accepts `VytchesDDDModuleOptions`:

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

## Package boundaries

`@vytches/ddd-nestjs` depends on:

- `@nestjs/common`, `@nestjs/core` — peer dependencies
- `@vytches/ddd-cqrs` — `ICommandBus`, `IQueryBus`, handler metadata
- `@vytches/ddd-events` — `IEventBus`, `EventHandler` metadata
- `@vytches/ddd-acl` — `ACLRegistry`
- `@vytches/ddd-di` — `IDependencyContainer`

## License

MIT
