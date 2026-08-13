/**
 * VF-037 — standing cross-context isolation regression suite.
 *
 * This is the first test in the repository that boots a REAL NestJS container
 * containing `VytchesDDDModule.forRoot()` **plus two** independent
 * `VytchesDDDModule.forFeature()` contexts in the SAME module graph. Every
 * pre-existing real-boot test has exactly one feature context
 * (`feature-di-wiring.e2e.test.ts`), or reaches two contexts only across two
 * SEPARATE boots (`global-bus-acl.test.ts` — orders and catalog are compiled in
 * different testing modules), or avoids the container entirely
 * (`feature-isolation.test.ts` asserts against a hand-built `Map` stand-in for
 * `ModulesContainer`; `symbol-token-injection.test.ts` goes through
 * `forTesting()`). One context can never falsify a *cross*-context claim: with a
 * single feature module there is no second bus for a message to leak into. That
 * is why the isolation invariant has been "fixed" three times and re-broken
 * twice without a test noticing.
 *
 * ── Historical incidents this file keeps closed (AC3 traceability) ───────────
 *
 * F-C4 / VB-003 (TM-VB-003-001, DREAD 14) — `forFeature()` listed the bare class
 *   `ModulesContainer` in `providers`, which in NestJS is shorthand for
 *   `{ provide: ModulesContainer, useClass: ModulesContainer }` and SHADOWS the
 *   real global singleton with a fresh, empty instance. `FeatureHandlerRegistrar`
 *   then could not find its own module, never registered handlers locally and
 *   never called `claimHandlerTypes()`, so `VytchesExplorerService`'s global
 *   fallback picked the same handler up and published it on the ROOT bus — a
 *   context-private handler becoming reachable from every other context.
 *   Covered by: "F-C4 (VB-003) — command isolation", "F-C4 (VB-003) — query
 *   isolation", "F-C4 (VB-003) — no context handler reaches the root bus".
 *
 * VF-030 (UX-C4, TM-VF-030) — DI tokens were keyed by `fn.name`, so two
 *   unrelated classes with the same name in two bounded contexts collided and
 *   `resolve()` silently returned the *other* context's instance. The
 *   container-level shape of that bug is exactly "two contexts, one identity",
 *   which only a two-context boot can observe.
 *   Covered by: "VF-030 — two forFeature() contexts resolve DISTINCT bus
 *   instances".
 *
 * VP-009 Bug #1 — the feature bus stayed empty: `forFeature(ctx)` did not
 *   register the context's handlers into its isolated bus, so isolation was
 *   nominal and dispatch through the feature bus found no handler.
 *   Covered by: "VP-009 Bug #1 — explorer/registrar registration is alive
 *   end-to-end on BOTH buses".
 *
 * VP-009 Bug #2 — there was no stable token that reached past the feature scope
 *   to the root bus, so an ACL service inside a bounded-context module got the
 *   feature-scoped bus and could not perform cross-context calls.
 *   `GLOBAL_COMMAND_BUS` / `GLOBAL_QUERY_BUS` are provided by `forRoot()` ONLY —
 *   `forFeature()` deliberately does not declare them so injection falls through
 *   to the global module. That is by design and is asserted, not "fixed".
 *   Covered by: "VP-009 Bug #2 — GLOBAL_* stays root-scoped in BOTH contexts".
 *
 * VP-009 Bug #3 — dual-package hazard (ESM + CJS): the abstract classes
 *   `ICommandBus` / `IQueryBus` used as `@Inject` tokens have two distinct
 *   identities when the package is loaded in both formats, so DI silently
 *   resolved `undefined`. The fix introduced the `Symbol.for` tokens
 *   `COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN` plus a bridge in `forRoot()`
 *   (`busTokenBridge()`) and `useExisting` aliases in `forFeature()`. With two
 *   contexts the bridge must resolve *per context*, not globally.
 *   Covered by: "VP-009 Bug #3 — Symbol token and class token agree inside each
 *   context".
 *
 * ── AC6 (mutation check) ─────────────────────────────────────────────────────
 * Every invariant is asserted both positively and negatively, so a mutation
 * fails a case outright instead of merely weakening an assertion. Each of the
 * five mutations below was applied to `packages/nestjs/src` and reverted; the
 * kill counts are measured, not predicted (12 cases total, all green unmutated):
 *   1. re-add `ModulesContainer` to `forFeature()`'s providers — the literal
 *      F-C4 regression → 6 failures (both dispatch pairs, the root-bus spies,
 *      both end-to-end round-trips, the Symbol/class agreement case);
 *   2. drop the `COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN` `useExisting` aliases
 *      from `forFeature()` — the VP-009 Bug #3 shape → 1 failure, precisely the
 *      Symbol/class agreement case;
 *   3. route plain `DomainEvent`s onto the global `IEventBus` → 3 failures, all
 *      three event-isolation cases;
 *   4. declare `GLOBAL_COMMAND_BUS` / `GLOBAL_QUERY_BUS` inside `forFeature()`
 *      → 1 failure, the root-scope case;
 *   5. collapse both contexts onto one shared bus pair — the VF-030 identity
 *      shape → 4 failures (command isolation, query isolation, the DISTINCT
 *      instance case, the Symbol/class agreement case).
 *
 * Scope note: this file adds tests only. It does not modify `packages/nestjs/src`,
 * and it lives under `packages/nestjs/tests/`, which the package's `test` target
 * picks up without an include glob — so it runs on every PR (AC2).
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { Global, Inject, Injectable, Module } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed to resolve the real DI token
import { ModulesContainer } from '@nestjs/core';
import type { Module as NestModule } from '@nestjs/core/injector/module';

// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens in a cross-package e2e test
import {
  CommandHandler,
  QueryHandler,
  ICommandBus,
  IQueryBus,
  COMMAND_BUS_TOKEN,
  QUERY_BUS_TOKEN,
} from '@vytches/ddd-cqrs';
import type { ICommand, IQuery } from '@vytches/ddd-cqrs';
import { DomainEvent, IntegrationEvent, UnifiedEventBus } from '@vytches/ddd-events';
import { IEventBus } from '@vytches/ddd-contracts';

import { VytchesDDDModule } from '../../src/vytches-ddd.module';
import {
  LOCAL_EVENT_BUS,
  GLOBAL_COMMAND_BUS,
  GLOBAL_QUERY_BUS,
  FEATURE_ANCHOR_INJECTION,
} from '../../src/constants';
import { ContextAwareEventDispatcher } from '../../src/dispatchers/context-aware-event-dispatcher';

// ─── Context A fixtures: "orders" ─────────────────────────────────────────────

class PlaceOrderCommand implements ICommand {
  constructor(public readonly orderId: string) {}
}

class GetOrderQuery implements IQuery<string> {
  constructor(public readonly orderId: string) {}
}

// Real decorators (default `autoRegister: true`) so these handlers are visible
// to BOTH FeatureHandlerRegistrar's local discovery AND VytchesExplorerService's
// global fallback — the exact race F-C4 lost.
@CommandHandler(PlaceOrderCommand)
@Injectable()
class PlaceOrderHandler {
  execute(command: PlaceOrderCommand): Promise<string> {
    return Promise.resolve(`orders:command:${command.orderId}`);
  }
}

@QueryHandler(GetOrderQuery)
@Injectable()
class GetOrderQueryHandler {
  execute(query: GetOrderQuery): Promise<string> {
    return Promise.resolve(`orders:query:${query.orderId}`);
  }
}

class OrderPlacedEvent extends DomainEvent<{ orderId: string }> {}
class OrderNoticedEvent extends DomainEvent<{ orderId: string }> {}
class OrderShippedIntegrationEvent extends IntegrationEvent<{ orderId: string }> {}

// ─── Context B fixtures: "catalog" ────────────────────────────────────────────

class AddCatalogItemCommand implements ICommand {
  constructor(public readonly sku: string) {}
}

class GetCatalogItemQuery implements IQuery<string> {
  constructor(public readonly sku: string) {}
}

@CommandHandler(AddCatalogItemCommand)
@Injectable()
class AddCatalogItemHandler {
  execute(command: AddCatalogItemCommand): Promise<string> {
    return Promise.resolve(`catalog:command:${command.sku}`);
  }
}

@QueryHandler(GetCatalogItemQuery)
@Injectable()
class GetCatalogItemQueryHandler {
  execute(query: GetCatalogItemQuery): Promise<string> {
    return Promise.resolve(`catalog:query:${query.sku}`);
  }
}

class CatalogItemAddedEvent extends DomainEvent<{ sku: string }> {}

// ─── Probes ───────────────────────────────────────────────────────────────────

/**
 * A probe lives in the CONSUMER module (the module that imports
 * `forFeature()`), so what it receives is precisely what a real bounded-context
 * provider receives. Reading the buses this way — rather than via
 * `moduleRef.get(token, { strict: false })` — matters with two contexts: a
 * non-strict lookup scans the whole container and returns whichever
 * registration happens to be last, which would make an isolation assertion
 * accidentally order-dependent and therefore worthless.
 */
interface ContextProbe {
  readonly commandBus: ICommandBus;
  readonly queryBus: IQueryBus;
  readonly localEventBus: IEventBus;
  readonly globalCommandBusToken: unknown;
  readonly globalQueryBusToken: unknown;
  readonly dispatcher: ContextAwareEventDispatcher;
}

@Injectable()
class OrdersProbe implements ContextProbe {
  constructor(
    @Inject(ICommandBus) public readonly commandBus: ICommandBus,
    @Inject(IQueryBus) public readonly queryBus: IQueryBus,
    @Inject(LOCAL_EVENT_BUS) public readonly localEventBus: IEventBus,
    @Inject(GLOBAL_COMMAND_BUS) public readonly globalCommandBusToken: unknown,
    @Inject(GLOBAL_QUERY_BUS) public readonly globalQueryBusToken: unknown,
    @Inject(ContextAwareEventDispatcher) public readonly dispatcher: ContextAwareEventDispatcher
  ) {}
}

@Injectable()
class CatalogProbe implements ContextProbe {
  constructor(
    @Inject(ICommandBus) public readonly commandBus: ICommandBus,
    @Inject(IQueryBus) public readonly queryBus: IQueryBus,
    @Inject(LOCAL_EVENT_BUS) public readonly localEventBus: IEventBus,
    @Inject(GLOBAL_COMMAND_BUS) public readonly globalCommandBusToken: unknown,
    @Inject(GLOBAL_QUERY_BUS) public readonly globalQueryBusToken: unknown,
    @Inject(ContextAwareEventDispatcher) public readonly dispatcher: ContextAwareEventDispatcher
  ) {}
}

// ─── Consumer modules — two contexts, ONE module graph ────────────────────────

@Module({
  imports: [VytchesDDDModule.forFeature('orders')],
  providers: [PlaceOrderHandler, GetOrderQueryHandler, OrdersProbe],
})
class OrdersModule {}

@Module({
  imports: [VytchesDDDModule.forFeature('catalog')],
  providers: [AddCatalogItemHandler, GetCatalogItemQueryHandler, CatalogProbe],
})
class CatalogModule {}

/**
 * The explicit cross-context bridge. `ContextAwareEventDispatcher` injects
 * `IEventBus` optionally; `forRoot()` does not export it, so an integration bus
 * has to be published deliberately — which is the point of the last invariant:
 * an event crosses a context boundary only over a channel someone chose to open.
 */
@Global()
@Module({})
class IntegrationBusModule {
  static withBus(bus: IEventBus): DynamicModule {
    return {
      module: IntegrationBusModule,
      providers: [{ provide: IEventBus, useValue: bus }],
      exports: [IEventBus],
    };
  }
}

// ─── Harness ──────────────────────────────────────────────────────────────────

/** Stand-in for the ROOT/GLOBAL command bus — nothing context-scoped may land here. */
const rootCommandBus = {
  register: vi.fn(),
  registerFactory: vi.fn(),
  execute: vi.fn().mockRejectedValue(new Error('no handler registered on the root command bus')),
};

/** Stand-in for the ROOT/GLOBAL query bus. */
const rootQueryBus = {
  register: vi.fn(),
  registerFactory: vi.fn(),
  execute: vi.fn().mockRejectedValue(new Error('no handler registered on the root query bus')),
};

/** The one bus that is allowed to be shared between contexts. */
const integrationBus = new UnifiedEventBus() as unknown as IEventBus;

let app: INestApplication;
let orders: OrdersProbe;
let catalog: CatalogProbe;
let modulesContainer: ModulesContainer;

/**
 * Resolve the `VytchesDDDFeatureModule` instance that `forFeature(contextName)`
 * created, straight out of `ModulesContainer`.
 *
 * Needed because `forFeature()` provides `COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN`
 * (as `useExisting` aliases) but does NOT export them — they exist for the
 * feature module's own internals (`FeatureHandlerRegistrar`,
 * `VytchesExplorerService`), which is exactly the scope VP-009 Bug #3 broke. The
 * only way to observe them per context is to look inside the module that owns
 * them. Both feature modules share the same class, so they are told apart by the
 * unique anchor Symbol `forFeature()` mints per call
 * (`Symbol('vytches:feature:<ctx>')`); the same traversal
 * `FeatureHandlerRegistrar.findOwnModule()` performs.
 */
function featureModuleOf(contextName: string): NestModule {
  for (const [, mod] of modulesContainer.entries()) {
    const anchorWrapper = mod.providers.get(FEATURE_ANCHOR_INJECTION as unknown as never);
    const anchor = anchorWrapper?.instance as symbol | undefined;
    if (typeof anchor === 'symbol' && anchor.description === `vytches:feature:${contextName}`) {
      return mod;
    }
  }
  throw new Error(`feature module for context "${contextName}" not found in ModulesContainer`);
}

function providerInstanceOf(mod: NestModule, token: unknown): unknown {
  return mod.providers.get(token as unknown as never)?.instance;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      VytchesDDDModule.forRoot({
        providers: [
          { provide: ICommandBus, useValue: rootCommandBus },
          { provide: IQueryBus, useValue: rootQueryBus },
        ],
      }),
      IntegrationBusModule.withBus(integrationBus),
      OrdersModule,
      CatalogModule,
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  // app.init() runs the real two-phase lifecycle: onModuleInit() for every
  // module (FeatureHandlerRegistrar's local registration + claim), then
  // onApplicationBootstrap() (VytchesExplorerService's global fallback). The
  // ordering is the reason a claimed handler must never surface on the root bus.
  await app.init();

  orders = app.get(OrdersProbe, { strict: false });
  catalog = app.get(CatalogProbe, { strict: false });
  modulesContainer = app.get(ModulesContainer, { strict: false });
});

afterAll(async () => {
  await app.close();
});

// ─── F-C4 (VB-003) — command and query isolation ──────────────────────────────

describe('VF-037: F-C4 (VB-003 / TM-VB-003-001) — commands never cross a context boundary', () => {
  it('F-C4 (VB-003): a command dispatched on context A reaches A’s handler and NEVER B’s', async () => {
    // Positive: A → A.
    await expect(
      orders.commandBus.execute<PlaceOrderCommand, string>(new PlaceOrderCommand('o-1'))
    ).resolves.toBe('orders:command:o-1');

    // Negative: A → B is unreachable. If the two contexts ever share a bus (the
    // VF-030 shape) or the feature bus falls back to the root (the F-C4 shape),
    // this resolves instead of rejecting.
    await expect(
      orders.commandBus.execute<AddCatalogItemCommand, string>(new AddCatalogItemCommand('sku-1'))
    ).rejects.toThrow(/AddCatalogItemCommand/);

    // Symmetric: B → B works, B → A is unreachable.
    await expect(
      catalog.commandBus.execute<AddCatalogItemCommand, string>(new AddCatalogItemCommand('sku-1'))
    ).resolves.toBe('catalog:command:sku-1');
    await expect(
      catalog.commandBus.execute<PlaceOrderCommand, string>(new PlaceOrderCommand('o-1'))
    ).rejects.toThrow(/PlaceOrderCommand/);
  });

  it('F-C4 (VB-003): a query dispatched on context A reaches A’s handler and NEVER B’s', async () => {
    // The query half of F-C4 had no real-boot coverage anywhere before VF-037 —
    // `feature-di-wiring.e2e.test.ts` resolves IQueryBus only to spy on
    // dispose(), and never dispatches through it.
    await expect(
      orders.queryBus.execute<GetOrderQuery, string>(new GetOrderQuery('o-1'))
    ).resolves.toBe('orders:query:o-1');
    await expect(
      orders.queryBus.execute<GetCatalogItemQuery, string>(new GetCatalogItemQuery('sku-1'))
    ).rejects.toThrow(/GetCatalogItemQuery/);

    await expect(
      catalog.queryBus.execute<GetCatalogItemQuery, string>(new GetCatalogItemQuery('sku-1'))
    ).resolves.toBe('catalog:query:sku-1');
    await expect(
      catalog.queryBus.execute<GetOrderQuery, string>(new GetOrderQuery('o-1'))
    ).rejects.toThrow(/GetOrderQuery/);
  });

  it('F-C4 (VB-003): no context-scoped handler is ever registered on the ROOT bus', async () => {
    // The information-disclosure half of F-C4: when claimHandlerTypes() never
    // ran, VytchesExplorerService's global fallback republished every
    // context-private handler on the root bus, making it reachable from any
    // other context. With two contexts the blast radius doubles, so both must
    // stay off the root bus.
    expect(rootCommandBus.register).not.toHaveBeenCalled();
    expect(rootCommandBus.registerFactory).not.toHaveBeenCalled();
    expect(rootQueryBus.register).not.toHaveBeenCalled();
    expect(rootQueryBus.registerFactory).not.toHaveBeenCalled();

    await expect(rootCommandBus.execute(new PlaceOrderCommand('o-1'))).rejects.toThrow(
      'no handler registered on the root command bus'
    );
    await expect(rootQueryBus.execute(new GetCatalogItemQuery('sku-1'))).rejects.toThrow(
      'no handler registered on the root query bus'
    );
  });
});

// ─── VF-030 / VP-009 Bug #2 / Bug #3 — bus token identity ─────────────────────

describe('VF-037: VF-030 / VP-009 — bus token identities across forRoot() + 2×forFeature()', () => {
  it('VF-030: two forFeature() contexts resolve DISTINCT command and query bus instances', () => {
    // VF-030's root cause was identity collapse — tokens keyed by class NAME, so
    // two contexts silently shared one registration. A single-context boot
    // cannot see that; this is the assertion that can.
    expect(orders.commandBus).toBeDefined();
    expect(catalog.commandBus).toBeDefined();
    expect(orders.commandBus).not.toBe(catalog.commandBus);

    expect(orders.queryBus).toBeDefined();
    expect(catalog.queryBus).toBeDefined();
    expect(orders.queryBus).not.toBe(catalog.queryBus);

    // …and neither context is holding the root bus.
    expect(orders.commandBus).not.toBe(rootCommandBus);
    expect(catalog.commandBus).not.toBe(rootCommandBus);
    expect(orders.queryBus).not.toBe(rootQueryBus);
    expect(catalog.queryBus).not.toBe(rootQueryBus);

    // The per-context local event buses are distinct for the same reason.
    expect(orders.localEventBus).not.toBe(catalog.localEventBus);
  });

  it('VP-009 Bug #3: COMMAND_BUS_TOKEN / QUERY_BUS_TOKEN agree with the class tokens INSIDE each context', () => {
    // Bug #3 (dual-package ESM+CJS hazard) split the abstract-class DI tokens in
    // two, so `@Inject(ICommandBus)` and `@Inject(COMMAND_BUS_TOKEN)` could
    // disagree and the explorer silently received `undefined`. forFeature()
    // repairs that per context with `useExisting` aliases; with two contexts the
    // alias must point at the OWN context's bus, never the neighbour's and never
    // the root's.
    const ordersFeature = featureModuleOf('orders');
    const catalogFeature = featureModuleOf('catalog');

    const ordersCommandByClass = providerInstanceOf(ordersFeature, ICommandBus);
    const ordersCommandBySymbol = providerInstanceOf(ordersFeature, COMMAND_BUS_TOKEN);
    const ordersQueryByClass = providerInstanceOf(ordersFeature, IQueryBus);
    const ordersQueryBySymbol = providerInstanceOf(ordersFeature, QUERY_BUS_TOKEN);

    const catalogCommandByClass = providerInstanceOf(catalogFeature, ICommandBus);
    const catalogCommandBySymbol = providerInstanceOf(catalogFeature, COMMAND_BUS_TOKEN);
    const catalogQueryByClass = providerInstanceOf(catalogFeature, IQueryBus);
    const catalogQueryBySymbol = providerInstanceOf(catalogFeature, QUERY_BUS_TOKEN);

    // Symbol path is wired at all (the `undefined` symptom of Bug #3).
    expect(ordersCommandBySymbol).toBeDefined();
    expect(ordersQueryBySymbol).toBeDefined();
    expect(catalogCommandBySymbol).toBeDefined();
    expect(catalogQueryBySymbol).toBeDefined();

    // Symbol token === class token, within the same context.
    expect(ordersCommandBySymbol).toBe(ordersCommandByClass);
    expect(ordersQueryBySymbol).toBe(ordersQueryByClass);
    expect(catalogCommandBySymbol).toBe(catalogCommandByClass);
    expect(catalogQueryBySymbol).toBe(catalogQueryByClass);

    // The class-token bus each feature module owns is the very instance the
    // consumer module injects — the alias chain is not a parallel universe.
    expect(ordersCommandByClass).toBe(orders.commandBus);
    expect(catalogCommandByClass).toBe(catalog.commandBus);
    expect(ordersQueryByClass).toBe(orders.queryBus);
    expect(catalogQueryByClass).toBe(catalog.queryBus);

    // Across contexts the Symbol path stays as separated as the class path.
    expect(ordersCommandBySymbol).not.toBe(catalogCommandBySymbol);
    expect(ordersQueryBySymbol).not.toBe(catalogQueryBySymbol);
    expect(ordersCommandBySymbol).not.toBe(rootCommandBus);
    expect(catalogQueryBySymbol).not.toBe(rootQueryBus);
  });

  it('VP-009 Bug #2: GLOBAL_COMMAND_BUS / GLOBAL_QUERY_BUS stay ROOT-scoped in BOTH contexts', () => {
    // Deliberate asymmetry, not an oversight: forRoot() provides GLOBAL_*;
    // forFeature() never declares them, so injection falls through the feature
    // scope up to the global module. That is what lets an ACL service inside a
    // bounded-context module still talk to the root context. It mirrors
    // LOCAL_EVENT_BUS in the opposite direction.
    expect(orders.globalCommandBusToken).toBe(rootCommandBus);
    expect(catalog.globalCommandBusToken).toBe(rootCommandBus);
    expect(orders.globalQueryBusToken).toBe(rootQueryBus);
    expect(catalog.globalQueryBusToken).toBe(rootQueryBus);

    // Both contexts see the SAME root bus through GLOBAL_*, while their own
    // ICommandBus / IQueryBus remain private. Both halves matter: identical
    // GLOBAL_*, distinct locals.
    expect(orders.globalCommandBusToken).toBe(catalog.globalCommandBusToken);
    expect(orders.globalQueryBusToken).toBe(catalog.globalQueryBusToken);
    expect(orders.globalCommandBusToken).not.toBe(orders.commandBus);
    expect(catalog.globalQueryBusToken).not.toBe(catalog.queryBus);
  });
});

// ─── VP-009 Bug #1 — registration alive end-to-end, both buses ────────────────

describe('VF-037: VP-009 Bug #1 — feature-bus registration is alive end-to-end', () => {
  it('VP-009 Bug #1: dispatch → handler → result read back, on the COMMAND bus of both contexts', async () => {
    // Bug #1 was "the feature bus stays empty": forFeature() isolated the bus but
    // never registered the context's handlers into it, so isolation was real and
    // useless. A round-trip through the bus is the only thing that distinguishes
    // "isolated" from "dead".
    const fromOrders = await orders.commandBus.execute<PlaceOrderCommand, string>(
      new PlaceOrderCommand('o-42')
    );
    const fromCatalog = await catalog.commandBus.execute<AddCatalogItemCommand, string>(
      new AddCatalogItemCommand('sku-42')
    );

    expect(fromOrders).toBe('orders:command:o-42');
    expect(fromCatalog).toBe('catalog:command:sku-42');
  });

  it('VP-009 Bug #1: dispatch → handler → result read back, on the QUERY bus of both contexts', async () => {
    // The query bus had no real-boot round-trip coverage at all before VF-037.
    const fromOrders = await orders.queryBus.execute<GetOrderQuery, string>(
      new GetOrderQuery('o-42')
    );
    const fromCatalog = await catalog.queryBus.execute<GetCatalogItemQuery, string>(
      new GetCatalogItemQuery('sku-42')
    );

    expect(fromOrders).toBe('orders:query:o-42');
    expect(fromCatalog).toBe('catalog:query:sku-42');
  });
});

// ─── Event isolation — ContextAwareEventDispatcher's two branches ─────────────

describe('VF-037: domain events stay local, integration events cross (ADR-0034 / F-C4 event half)', () => {
  it('F-C4 (VB-003): a plain DomainEvent published in context A is NOT observed in context B', async () => {
    // ContextAwareEventDispatcher routes on `event instanceof IntegrationEvent`.
    // This is the else-branch: everything that is not an IntegrationEvent goes to
    // the publishing context's LOCAL_EVENT_BUS and stops there.
    const seenByOrders: OrderPlacedEvent[] = [];
    const seenByCatalog: OrderPlacedEvent[] = [];
    const seenByIntegration: OrderPlacedEvent[] = [];

    orders.localEventBus.subscribe(OrderPlacedEvent, (event: unknown) => {
      seenByOrders.push(event as OrderPlacedEvent);
    });
    catalog.localEventBus.subscribe(OrderPlacedEvent, (event: unknown) => {
      seenByCatalog.push(event as OrderPlacedEvent);
    });
    integrationBus.subscribe(OrderPlacedEvent, (event: unknown) => {
      seenByIntegration.push(event as OrderPlacedEvent);
    });

    const event = new OrderPlacedEvent({ orderId: 'o-7' });
    await orders.dispatcher.dispatchEvent(event);

    expect(seenByOrders).toHaveLength(1);
    expect(seenByOrders[0]?.eventId).toBe(event.eventId);
    // The whole point: context B never sees it, and it never leaks onto the
    // cross-context integration channel either.
    expect(seenByCatalog).toHaveLength(0);
    expect(seenByIntegration).toHaveLength(0);
  });

  it('F-C4 (VB-003): the isolation is symmetric — a DomainEvent published in B stays in B', async () => {
    const seenByCatalog: CatalogItemAddedEvent[] = [];
    const seenByOrders: CatalogItemAddedEvent[] = [];

    catalog.localEventBus.subscribe(CatalogItemAddedEvent, (event: unknown) => {
      seenByCatalog.push(event as CatalogItemAddedEvent);
    });
    orders.localEventBus.subscribe(CatalogItemAddedEvent, (event: unknown) => {
      seenByOrders.push(event as CatalogItemAddedEvent);
    });

    await catalog.dispatcher.dispatchEvent(new CatalogItemAddedEvent({ sku: 'sku-7' }));

    expect(seenByCatalog).toHaveLength(1);
    expect(seenByOrders).toHaveLength(0);
  });

  it('VP-009 Bug #2: an IntegrationEvent published in A DOES cross to B — but only over the explicit bridge', async () => {
    // The if-branch of the same router. Crossing a context boundary is legal
    // exactly when the payload is declared as an IntegrationEvent and an
    // integration IEventBus has been published — the ACL path. It must still not
    // touch either context's LOCAL_EVENT_BUS.
    const seenByCatalogAcl: OrderShippedIntegrationEvent[] = [];
    const seenByOrdersLocal: OrderShippedIntegrationEvent[] = [];
    const seenByCatalogLocal: OrderShippedIntegrationEvent[] = [];

    integrationBus.subscribe(OrderShippedIntegrationEvent, (event: unknown) => {
      seenByCatalogAcl.push(event as OrderShippedIntegrationEvent);
    });
    orders.localEventBus.subscribe(OrderShippedIntegrationEvent, (event: unknown) => {
      seenByOrdersLocal.push(event as OrderShippedIntegrationEvent);
    });
    catalog.localEventBus.subscribe(OrderShippedIntegrationEvent, (event: unknown) => {
      seenByCatalogLocal.push(event as OrderShippedIntegrationEvent);
    });

    const event = new OrderShippedIntegrationEvent({ orderId: 'o-9' });
    await orders.dispatcher.dispatchEvent(event);

    expect(seenByCatalogAcl).toHaveLength(1);
    expect(seenByCatalogAcl[0]?.eventId).toBe(event.eventId);
    expect(seenByOrdersLocal).toHaveLength(0);
    expect(seenByCatalogLocal).toHaveLength(0);
  });

  it('F-C4 (VB-003): a context-B subscriber on the SAME event class still misses A’s domain event', async () => {
    // The sharpest form of the negative: both contexts subscribe to the very same
    // class, so nothing but bus identity separates them. If the two feature
    // modules ever collapse onto one LOCAL_EVENT_BUS (module deduplication, a
    // shared useValue bus, or the VF-030 identity collapse), this is the case
    // that fails first.
    const seenByOrders: OrderNoticedEvent[] = [];
    const seenByCatalog: OrderNoticedEvent[] = [];

    orders.localEventBus.subscribe(OrderNoticedEvent, (event: unknown) => {
      seenByOrders.push(event as OrderNoticedEvent);
    });
    catalog.localEventBus.subscribe(OrderNoticedEvent, (event: unknown) => {
      seenByCatalog.push(event as OrderNoticedEvent);
    });

    await orders.dispatcher.dispatchEvent(new OrderNoticedEvent({ orderId: 'o-11' }));
    await catalog.dispatcher.dispatchEvent(new OrderNoticedEvent({ orderId: 'o-12' }));

    expect(seenByOrders).toHaveLength(1);
    expect(seenByOrders[0]?.payload?.orderId).toBe('o-11');
    expect(seenByCatalog).toHaveLength(1);
    expect(seenByCatalog[0]?.payload?.orderId).toBe('o-12');
  });
});
