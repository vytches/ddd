import { Module, type DynamicModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ModulesContainer } from '@nestjs/core/injector';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens
import { CommandBus, QueryBus, ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { NestJSContainerAdapter } from '../adapters';
import { LOCAL_EVENT_BUS, FEATURE_ANCHOR_INJECTION } from '../constants';
import { FeatureHandlerRegistrar } from './feature-handler-registrar';

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
  static forFeature(contextName: string): DynamicModule {
    if (!contextName || contextName.trim() === '') {
      throw new Error('VytchesDDDModule.forFeature(): contextName cannot be empty');
    }

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
        // Per-context command bus — overrides global ICommandBus for the importing module
        {
          provide: ICommandBus,
          useFactory: (moduleRef: ModuleRef) =>
            new CommandBus(new NestJSContainerAdapter(moduleRef)),
          inject: [ModuleRef],
        },
        // Per-context query bus — overrides global IQueryBus for the importing module
        {
          provide: IQueryBus,
          useFactory: (moduleRef: ModuleRef) => new QueryBus(new NestJSContainerAdapter(moduleRef)),
          inject: [ModuleRef],
        },
        // Per-context event bus under a dedicated token
        {
          provide: LOCAL_EVENT_BUS,
          useFactory: (): IEventBus => new UnifiedEventBus(),
        },
        // ModulesContainer is provided by NestJS InternalCoreModule (global)
        ModulesContainer,
        // Registrar that wires handlers into the local buses on module init
        FeatureHandlerRegistrar,
      ],
      exports: [ICommandBus, IQueryBus, LOCAL_EVENT_BUS],
    };
  }
}
