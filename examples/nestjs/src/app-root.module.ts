/**
 * The wiring a real application ends up with.
 *
 * `orders.module.ts` puts everything — buses, handlers, the `forRoot()` import —
 * in one module. That is the smallest thing that dispatches, and it is what the
 * Quick start shows. It stops being enough the moment a *second* module needs
 * the bus: a controller, an HTTP adapter, a scheduled job. Buses handed to
 * `forRoot()` via `options.providers` live inside `VytchesDDDModule`, so nothing
 * outside can inject them unless `options.exports` names them.
 *
 * `options.exports` is the short answer and it works (see
 * `tests/app-root.test.ts`). The shape below is the longer one, and the one
 * applications settle on: it gives the providers that belong next to the buses —
 * here `IEventBus`, in a real application also an event dispatcher and a
 * persistence handler — a module of their own, and it keeps `forRootAsync()`
 * available, which has no `exports` option.
 *
 * The application owns a `@Global()` module that PROVIDES and EXPORTS the buses
 * and IMPORTS `forRoot()`. The explorer's bus bridge injects `ICommandBus` /
 * `IQueryBus` optionally and resolves them from the global registry — so
 * discovery works exactly as before, while ordinary application code can inject
 * the buses too.
 */
import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  CommandHandler,
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
  QueryHandler,
} from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { NestJSContainerAdapter, VytchesDDDModule } from '@vytches/ddd-nestjs';

// ─────────────────────────────────────────────────────────────────────────────
// 1. The application's DDD module — one per application.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `useFactory`, not `useValue`.
 *
 * A `useValue` bus is constructed once when the module file is first imported,
 * so one instance is shared by every module built in the process and survives
 * every teardown. Its handler factories close over a destroyed `ModuleRef`, and
 * the next module created in the same process (the next test module, typically)
 * inherits them. A factory gives each module its own pair, and
 * `VytchesExplorerService.onModuleDestroy()` resets them on teardown.
 */
@Global()
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [
    {
      provide: ICommandBus,
      useFactory: (moduleRef: ModuleRef) =>
        new EnhancedCommandBus(new NestJSContainerAdapter(moduleRef)),
      inject: [ModuleRef],
    },
    {
      provide: IQueryBus,
      useFactory: (moduleRef: ModuleRef) =>
        new EnhancedQueryBus(new NestJSContainerAdapter(moduleRef)),
      inject: [ModuleRef],
    },
    { provide: IEventBus, useFactory: () => new UnifiedEventBus() },
  ],
  exports: [ICommandBus, IQueryBus, IEventBus],
})
export class DddModule {}

// ─────────────────────────────────────────────────────────────────────────────
// 2. A bounded context — handlers are providers, nothing else.
// ─────────────────────────────────────────────────────────────────────────────

export class ArchiveInvoiceCommand {
  constructor(public readonly invoiceId: string) {}
}

export class GetInvoiceStateQuery {
  constructor(public readonly invoiceId: string) {}
}

@Injectable()
export class InvoiceStore {
  private readonly archived = new Set<string>();

  archive(invoiceId: string): void {
    this.archived.add(invoiceId);
  }

  stateOf(invoiceId: string): 'archived' | 'open' {
    return this.archived.has(invoiceId) ? 'archived' : 'open';
  }
}

@Injectable()
@CommandHandler(ArchiveInvoiceCommand)
export class ArchiveInvoiceHandler {
  constructor(@Inject(InvoiceStore) private readonly store: InvoiceStore) {}

  execute(command: ArchiveInvoiceCommand): Promise<void> {
    this.store.archive(command.invoiceId);
    return Promise.resolve();
  }
}

@Injectable()
@QueryHandler(GetInvoiceStateQuery)
export class GetInvoiceStateHandler {
  constructor(@Inject(InvoiceStore) private readonly store: InvoiceStore) {}

  execute(query: GetInvoiceStateQuery): Promise<'archived' | 'open'> {
    return Promise.resolve(this.store.stateOf(query.invoiceId));
  }
}

/**
 * A bounded-context module. Note what is NOT here: no `OnModuleInit`, no
 * `commandBus.register(...)`, no `ModuleRef.get(...)` to fetch a handler
 * instance. The explorer discovers every decorated provider in the graph during
 * `onApplicationBootstrap` and registers the NestJS-resolved instance.
 *
 * Registering by hand on top of the decorators is the one thing to avoid: the
 * handler then runs twice per message. For a command that overwrites a bus map
 * entry it is invisible; for an event handler it is a second subscription, so a
 * handler that writes a row inserts it twice — a unique-constraint violation
 * that aborts the surrounding transaction.
 *
 * `onModuleInit()` is still the right place for ACL-registry and error-mapper
 * registration; it is handler registration specifically that is now automatic.
 */
@Module({
  imports: [DddModule],
  providers: [InvoiceStore, ArchiveInvoiceHandler, GetInvoiceStateHandler],
})
export class InvoicesModule {}

// ─────────────────────────────────────────────────────────────────────────────
// 3. A third module that injects the bus — the case the one-module shape breaks.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class InvoicesApi {
  constructor(
    @Inject(ICommandBus) private readonly commands: ICommandBus,
    @Inject(IQueryBus) private readonly queries: IQueryBus
  ) {}

  async archive(invoiceId: string): Promise<'archived' | 'open'> {
    await this.commands.execute(new ArchiveInvoiceCommand(invoiceId));
    return this.queries.execute(new GetInvoiceStateQuery(invoiceId));
  }
}

/** Stands in for the HTTP layer: controllers live outside the context module. */
@Module({ imports: [InvoicesModule], providers: [InvoicesApi], exports: [InvoicesApi] })
export class InvoicesApiModule {}

@Module({ imports: [DddModule, InvoicesModule, InvoicesApiModule] })
export class AppModule {}
