import { Module, type DynamicModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens
import {
  CQRSConfiguration,
  ICommandBus,
  IQueryBus,
  COMMAND_BUS_TOKEN,
  QUERY_BUS_TOKEN,
} from '@vytches/ddd-cqrs';
import type { ICQRSMiddleware } from '@vytches/ddd-cqrs';
import type { IEventBus } from '@vytches/ddd-contracts';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { NestJSContainerAdapter } from '../adapters';
import { LOCAL_EVENT_BUS, FEATURE_ANCHOR_INJECTION } from '../constants';
import { InvalidContextNameError } from '../errors';
import { ContextAwareEventDispatcher } from '../dispatchers/context-aware-event-dispatcher';
import { FeatureHandlerRegistrar } from './feature-handler-registrar';

/**
 * Per-context CQRS options for {@link VytchesDDDModule.forFeature}.
 *
 * The middleware type is the real `ICQRSMiddleware` from `@vytches/ddd-cqrs` —
 * the same contract `CQRSConfiguration` consumes — so a middleware written for
 * the root buses works unchanged on a feature bus.
 *
 * @example Enhanced buses with a shared middleware
 * ```typescript
 * @Module({
 *   imports: [
 *     VytchesDDDModule.forFeature('orders', {
 *       busType: 'enhanced',
 *       middlewares: [new LoggingMiddleware()],
 *     }),
 *   ],
 * })
 * export class OrdersModule {}
 * ```
 *
 * @public
 * @since 0.31.0
 */
export interface VytchesDDDFeatureOptions {
  /**
   * `'enhanced'` selects the metrics/performance-tracking buses for this
   * context; `'basic'` the light ones. Applies to the command and query bus
   * alike — a context that needs them to differ should build its own
   * `CQRSConfiguration`.
   *
   * @default 'basic'
   */
  busType?: 'basic' | 'enhanced';

  /**
   * Middlewares attached to both per-context buses, in order.
   *
   * @default []
   */
  middlewares?: ICQRSMiddleware[];
}

/**
 * Internal token holding the per-context {@link CQRSConfiguration}. Not
 * exported from the package barrel: the buses it builds are reachable through
 * ICommandBus / IQueryBus, and exposing the configuration would invite
 * consumers to mutate a context's bus wiring after the fact.
 */
const FEATURE_CQRS_CONFIGURATION = Symbol('vytches:feature:cqrs-configuration');

/**
 * Module class used by VytchesDDDModule.forFeature().
 *
 * Must be a separate class from VytchesDDDModule to prevent NestJS module
 * deduplication from collapsing multiple forFeature() calls into one.
 */
@Module({})
export class VytchesDDDFeatureModule {
  /**
   * Creates an isolated CQRS environment for one bounded context.
   *
   * Provides:
   * - `ICommandBus` — fresh CommandBus instance, scoped to this context
   * - `IQueryBus` — fresh QueryBus instance, scoped to this context
   * - `LOCAL_EVENT_BUS` — fresh UnifiedEventBus instance, scoped to this context
   *
   * Exports all three so the importing bounded-context module can inject them.
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [VytchesDDDModule.forFeature('orders')],
   *   providers: [CreateOrderHandler, GetOrderQueryHandler],
   * })
   * export class OrdersModule {}
   * ```
   */
  static forFeature(contextName: string, options: VytchesDDDFeatureOptions = {}): DynamicModule {
    if (!contextName || contextName.trim() === '') {
      throw new InvalidContextNameError('forFeature');
    }

    const { busType = 'basic', middlewares = [] } = options;

    // Unique symbol per forFeature() call — used by FeatureHandlerRegistrar to
    // locate its own module in ModulesContainer. Never use Symbol.for() here.
    const anchorToken = Symbol(`vytches:feature:${contextName}`);

    return {
      module: VytchesDDDFeatureModule,
      providers: [
        // Anchor: marks this specific module instance in ModulesContainer
        { provide: anchorToken, useValue: contextName },
        // Passes the anchor symbol into FeatureHandlerRegistrar via stable token
        { provide: FEATURE_ANCHOR_INJECTION, useValue: anchorToken },
        // Per-context CQRS bootstrap. Routing both buses through
        // CQRSConfiguration is what makes `busType` and `middlewares` reachable
        // here at all — building `new CommandBus(...)` by hand (as this module
        // did before VF-032a) gave a context no supported way to opt into the
        // enhanced buses or attach middleware, defeating the point of
        // forFeature(). One configuration instance backs both providers so a
        // middleware attaches to the command and query bus exactly once.
        {
          provide: FEATURE_CQRS_CONFIGURATION,
          useFactory: (moduleRef: ModuleRef) =>
            new CQRSConfiguration(new NestJSContainerAdapter(moduleRef), {
              commandBusType: busType,
              queryBusType: busType,
              middlewares,
            }),
          inject: [ModuleRef],
        },
        // Per-context command bus — overrides global ICommandBus for the importing module
        {
          provide: ICommandBus,
          useFactory: (cqrs: CQRSConfiguration) => cqrs.commandBus,
          inject: [FEATURE_CQRS_CONFIGURATION],
        },
        // Per-context query bus — overrides global IQueryBus for the importing module
        {
          provide: IQueryBus,
          useFactory: (cqrs: CQRSConfiguration) => cqrs.queryBus,
          inject: [FEATURE_CQRS_CONFIGURATION],
        },
        // Symbol aliases for the two buses above. The class tokens are shadowed
        // per context; without these the Symbol tokens would keep resolving the
        // root buses, so `@Inject(COMMAND_BUS_TOKEN)` and `@Inject(ICommandBus)`
        // would disagree inside the same module. GLOBAL_COMMAND_BUS /
        // GLOBAL_QUERY_BUS stay deliberately absent — those exist precisely to
        // reach past the feature scope to the root bus.
        {
          provide: COMMAND_BUS_TOKEN,
          useExisting: ICommandBus,
        },
        {
          provide: QUERY_BUS_TOKEN,
          useExisting: IQueryBus,
        },
        // Per-context event bus under a dedicated token
        {
          provide: LOCAL_EVENT_BUS,
          useFactory: (): IEventBus => new UnifiedEventBus(),
        },
        // NOTE: ModulesContainer is intentionally NOT listed here. It is a global
        // provider from NestJS's InternalCoreModule, injectable in any module
        // without being declared. Adding a bare `ModulesContainer` class here is
        // shorthand for `{ provide: ModulesContainer, useClass: ModulesContainer }`,
        // which SHADOWS the global singleton with a fresh, empty instance scoped to
        // this module — breaking FeatureHandlerRegistrar.findOwnModule() (F-C4,
        // TM-VB-003-001, DREAD 14: cross-context handler/event leakage). Do not
        // re-add it.
        // Registrar that wires handlers into the local buses on module init
        FeatureHandlerRegistrar,
        // Dispatcher that routes DomainEvents → LOCAL_EVENT_BUS, IntegrationEvents → IEventBus
        ContextAwareEventDispatcher,
      ],
      exports: [ICommandBus, IQueryBus, LOCAL_EVENT_BUS, ContextAwareEventDispatcher],
    };
  }
}
